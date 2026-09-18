#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

const usage = "Usage: plan-frontend-delta.mjs <target-root> <prior-image-root> --base-image docker.atl-paas.net/<service>@sha256:<digest> [--out <overlay-dir> --apply] [--accept-prior-dependencies]";
// Match backend/Dockerfile's application source COPY inputs, excluding dependencies.
const runtimeRoots = ["backend", "lib", "rovo", "scripts/lib/worktree-ports.js"];
const dependencyInputs = ["package.json", "backend/package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"];
let targetRoot;
let priorRoot;
let baseImage;
let overlayDir;
let apply = false;
let acceptPriorDependencies = false;
try {
	targetRoot = path.resolve(process.argv[2]);
	priorRoot = path.resolve(process.argv[3]);
	for (let index = 4; index < process.argv.length; index += 1) {
		const arg = process.argv[index];
		if (arg === "--base-image") baseImage = process.argv[++index];
		else if (arg === "--out") overlayDir = path.resolve(process.argv[++index]);
		else if (arg === "--apply") apply = true;
		else if (arg === "--accept-prior-dependencies") acceptPriorDependencies = true;
		else throw new Error("Unknown option");
	}
	if (!fs.statSync(targetRoot).isDirectory() || !fs.statSync(priorRoot).isDirectory()) {
		throw new Error("Both roots must be directories");
	}
	if (!/^docker\.atl-paas\.net\/[a-z0-9-]+@sha256:[a-f0-9]{64}$/u.test(baseImage || "")) {
		throw new Error("Base image must use an immutable Atlassian registry digest");
	}
	const descriptorPath = path.join(targetRoot, "service-descriptor.yml");
	if (!fs.existsSync(descriptorPath)) throw new Error("Target service descriptor is required");
	const descriptorImage = fs.readFileSync(descriptorPath, "utf8").match(/^\s*image:\s*(docker\.atl-paas\.net\/[a-z0-9-]+)\s*$/mu)?.[1];
	if (descriptorImage !== baseImage.split("@")[0]) throw new Error("Base image repository must match the target descriptor");
	if (apply && !overlayDir) throw new Error("--apply requires --out");
	const selectedOut = path.join(targetRoot, "out");
	const priorPublic = path.join(priorRoot, "backend", "public");
	if (apply && (overlayDir === selectedOut || overlayDir.startsWith(`${selectedOut}${path.sep}`)
		|| overlayDir === priorPublic || overlayDir.startsWith(`${priorPublic}${path.sep}`))) {
		throw new Error("Overlay directory must be outside the selected export and prior image files");
	}
} catch (error) {
	console.error(`${usage}\n${error.message}`);
	process.exit(2);
}

function collect(root, relativeRoot, excluded = () => false) {
	const files = new Map();
	const start = path.join(root, relativeRoot);
	if (!fs.existsSync(start)) return files;
	if (fs.statSync(start).isFile()) {
		files.set(relativeRoot, start);
		return files;
	}
	if (!fs.statSync(start).isDirectory()) return files;
	function walk(directory, relativeDirectory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const relative = path.join(relativeDirectory, entry.name);
			if (excluded(relative)) continue;
			const absolute = path.join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Symlink in comparison tree: ${relative}`);
			if (entry.isDirectory()) walk(absolute, relative);
			else if (entry.isFile()) files.set(relative, absolute);
		}
	}
	walk(start, relativeRoot);
	return files;
}

function sameFile(left, right) {
	if (!left || !right || !fs.existsSync(left) || !fs.existsSync(right)) return false;
	if (fs.statSync(left).size !== fs.statSync(right).size) return false;
	return fs.readFileSync(left).equals(fs.readFileSync(right));
}

function excludedRuntime(relative) {
	const normalized = relative.split(path.sep).join("/");
	return normalized.split("/").some((part) => ["node_modules", ".git", ".next", ".pnpm-store", ".venv", "output"].includes(part))
		|| normalized === "backend/public" || normalized.startsWith("backend/public/")
		|| normalized === "backend/data" || normalized.startsWith("backend/data/")
		|| /\.test\.[cm]?[jt]s$/u.test(path.basename(relative))
		|| path.basename(relative).endsWith(".tsbuildinfo");
}

try {
	const targetRuntime = new Map();
	const priorRuntime = new Map();
	for (const root of runtimeRoots) {
		for (const [relative, absolute] of collect(targetRoot, root, excludedRuntime)) targetRuntime.set(relative, absolute);
		for (const [relative, absolute] of collect(priorRoot, root, excludedRuntime)) priorRuntime.set(relative, absolute);
	}
	const runtimeDifferences = [...new Set([...targetRuntime.keys(), ...priorRuntime.keys()])]
		.sort().filter((relative) => !sameFile(targetRuntime.get(relative), priorRuntime.get(relative)));
	if (runtimeDifferences.length) {
		throw new Error(`Runtime file parity failed (${runtimeDifferences.length} paths): ${runtimeDifferences.slice(0, 8).join(", ")}`);
	}
	const dependencyDifferences = dependencyInputs.filter((relative) =>
		!sameFile(path.join(targetRoot, relative), path.join(priorRoot, relative)));
	const targetOut = path.join(targetRoot, "out");
	const priorPublic = path.join(priorRoot, "backend", "public");
	if (!fs.existsSync(path.join(targetOut, "index.html")) || !fs.existsSync(path.join(priorPublic, "index.html"))) {
		throw new Error("Both new out/ and prior backend/public/ need index.html");
	}
	const targetStatic = collect(targetRoot, "out");
	const priorStatic = collect(priorRoot, "backend/public");
	const changed = [];
	for (const [relative, absolute] of targetStatic) {
		const underOut = path.relative("out", relative);
		const previous = priorStatic.get(path.join("backend/public", underOut));
		if (/\.(?:html|css|m?js|json|svg|txt|xml)$/iu.test(relative)) {
			for (const [extension, decode] of [["gz", gunzipSync], ["br", brotliDecompressSync]]) {
				const sibling = `${relative}.${extension}`;
				const prepared = targetStatic.get(sibling);
				if (prepared && !decode(fs.readFileSync(prepared)).equals(fs.readFileSync(absolute))) {
					throw new Error(`Stale compression sibling: ${path.relative("out", sibling)}; prepare the selected export again`);
				}
				if (!prepared && priorStatic.has(path.join("backend/public", `${underOut}.${extension}`)) && !sameFile(absolute, previous)) {
					throw new Error(`Changed source would retain prior ${extension} sibling: ${underOut}; run prepare-static-export.mjs out --compress`);
				}
			}
		}
		if (!sameFile(absolute, previous)) changed.push({ relative: underOut, absolute, bytes: fs.statSync(absolute).size });
	}
	const oldOnly = [...priorStatic.keys()].map((relative) => path.relative("backend/public", relative))
		.filter((relative) => !targetStatic.has(path.join("out", relative))).sort();
	const summary = {
		baseImage,
		runtimeFilesChecked: targetRuntime.size,
		dependencyDifferences,
		changedExportFiles: changed.length,
		changedExportBytes: changed.reduce((sum, item) => sum + item.bytes, 0),
		oldOnlyExportFiles: oldOnly.length,
		oldOnlySample: oldOnly.slice(0, 12),
		acceptedPriorDependencies: acceptPriorDependencies && dependencyDifferences.length > 0,
	};
	console.log(JSON.stringify(summary, null, 2));
	if (dependencyDifferences.length && !acceptPriorDependencies) {
		throw new Error("Dependency inputs differ; the layer would retain prior installed packages. Review that choice or build a full image. Add --accept-prior-dependencies only for an approved frontend-only release.");
	}
	if (apply) {
		if (!changed.length) throw new Error("No changed export files to package");
		if (fs.existsSync(overlayDir) && fs.readdirSync(overlayDir).length) throw new Error("Overlay directory must be empty");
		const dockerfile = `${overlayDir}.Dockerfile`;
		const planFile = `${overlayDir}.plan.json`;
		if (fs.existsSync(dockerfile) || fs.existsSync(planFile)) throw new Error("Overlay Dockerfile or plan already exists");
		for (const item of changed) {
			const destination = path.join(overlayDir, item.relative);
			fs.mkdirSync(path.dirname(destination), { recursive: true });
			fs.copyFileSync(item.absolute, destination);
		}
		fs.writeFileSync(dockerfile, `FROM ${baseImage}\nCOPY . ./backend/public/\n`);
		fs.writeFileSync(planFile, JSON.stringify({ ...summary, changedPaths: changed.map((item) => item.relative) }, null, 2) + "\n");
		console.log(`Overlay context: ${overlayDir}`);
		console.log(`Dockerfile: ${dockerfile}`);
	}
} catch (error) {
	console.error(`Frontend delta plan failed: ${error.message}`);
	process.exitCode = 1;
}
