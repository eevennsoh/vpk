#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const usage = "Usage: plan-target-refresh.mjs <plan.json> <stage-dir> <target-dir> --baseline <verified-source-revision> --out <manifest.json>\n       plan-target-refresh.mjs --apply <manifest.json>";
const sourceRoots = new Set(["app", "backend", "components", "hooks", "lib", "public", "rovo", "scripts", "types"]);
const ignored = new Set([".git", ".agents", ".claude", ".codex", ".cursor", ".next", ".pnpm-store", ".venv", "node_modules", "out", "output", "test-results"]);
const preserved = new Set(["README.md", "AGENTS.md", "CLAUDE.md", ".gitignore", ".dockerignore", "service-descriptor.yml", "scripts/dev-backend-backed.mjs"]);
const readBuffer = Buffer.allocUnsafe(1024 * 1024);

function copyable(relative) {
	return typeof relative === "string" && relative.length > 0
		&& !path.isAbsolute(relative) && !relative.includes("\\")
		&& !relative.split("/").some((part) => !part || part === ".." || part === "." || ignored.has(part))
		&& sourceRoots.has(relative.split("/")[0]) && !preserved.has(relative)
		&& !/^backend\/(?:data|public)(?:\/|$)/u.test(relative);
}

function collect(root) {
	const files = new Map();
	const visit = (directory, prefix = "") => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (ignored.has(entry.name) || /^backend\/(?:data|public)(?:\/|$)/u.test(relative)
				|| /^\.(?:env|deploy)(?:\.|$)/u.test(relative)) continue;
			const absolute = path.join(root, relative);
			if (entry.isSymbolicLink()) {
				if (copyable(relative)) throw new Error(`Source-file symlink requires manual review: ${relative}`);
				continue;
			}
			if (entry.isDirectory()) visit(absolute, relative);
			else if (entry.isFile()) files.set(relative, absolute);
		}
	};
	visit(root);
	return files;
}

function fileStat(file) {
	try { return fs.lstatSync(file); }
	catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function fingerprint(file, objectFormat) {
	const stat = fileStat(file);
	if (!stat) return null;
	if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Expected an ordinary source file");
	const hash = createHash("sha256");
	const blob = objectFormat ? createHash(objectFormat).update(`blob ${stat.size}\0`) : null;
	const fd = fs.openSync(file, "r");
	try {
		let read;
		while ((read = fs.readSync(fd, readBuffer, 0, readBuffer.length, null)) > 0) {
			hash.update(readBuffer.subarray(0, read));
			blob?.update(readBuffer.subarray(0, read));
		}
	} finally { fs.closeSync(fd); }
	return { sha256: hash.digest("hex"), blob: blob?.digest("hex"), bytes: stat.size, mode: stat.mode & 0o777 };
}

function git(root, args) {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function tree(root, revision) {
	return new Map(git(root, ["ls-tree", "-r", "-z", revision]).split("\0").filter(Boolean).map((row) => {
		const separator = row.indexOf("\t");
		const [mode, , blob] = row.slice(0, separator).split(" ");
		return [row.slice(separator + 1), { blob, mode: parseInt(mode, 8) & 0o777 }];
	}));
}

function roots(sourceRoot, stageRoot, targetRoot) {
	const actual = [sourceRoot, stageRoot, targetRoot].map((root) => fs.realpathSync(root));
	if (actual[2] === actual[0] || actual[1] === actual[0] || actual[1] === actual[2]
		|| actual[1].startsWith(`${actual[2]}${path.sep}`) || actual[2].startsWith(`${actual[1]}${path.sep}`)) {
		throw new Error("Source, staging, and target must use separate checkouts");
	}
	return actual;
}

function planRefresh(planFile, stageDir, targetDir, baseline) {
	const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
	if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(plan.sourceRevision || "") || !baseline || baseline.startsWith("-")) {
		throw new Error("A traced source SHA and verified baseline revision are required");
	}
	const [sourceRoot, stageRoot, targetRoot] = roots(plan.repoRoot, stageDir, targetDir);
	const baselineRevision = git(sourceRoot, ["rev-parse", "--verify", `${baseline}^{commit}`]).trim();
	const objectFormat = git(sourceRoot, ["rev-parse", "--show-object-format"]).trim();
	const selected = tree(sourceRoot, plan.sourceRevision);
	const previous = tree(sourceRoot, baselineRevision);
	const staged = collect(stageRoot);
	const target = collect(targetRoot);
	const manifest = {
		version: 1, sourceRoot, sourceRevision: plan.sourceRevision, baselineRevision, stageRoot, targetRoot,
		copy: [], overlaps: [], localOverrides: [], manualReview: [], preserved: [], oldOnly: [],
	};
	for (const [relative, stagedFile] of staged) {
		if (preserved.has(relative)) { manifest.preserved.push(relative); continue; }
		const next = fingerprint(stagedFile);
		const current = target.has(relative) ? fingerprint(target.get(relative)) : null;
		if (next.sha256 === current?.sha256 && next.mode === current.mode) continue;
		const selectedFile = selected.get(relative);
		const previousFile = previous.get(relative);
		if (!copyable(relative) || fingerprint(stagedFile, objectFormat).blob !== selectedFile?.blob || next.mode !== selectedFile.mode) {
			manifest.manualReview.push(relative);
			continue;
		}
		if (selectedFile.blob === previousFile?.blob && selectedFile.mode === previousFile.mode) {
			if (current) manifest.localOverrides.push(relative);
			else manifest.manualReview.push(relative);
			continue;
		}
		const item = { path: relative, bytes: next.bytes, mode: next.mode, stageSha256: next.sha256, targetSha256: current?.sha256 ?? null, targetMode: current?.mode ?? null };
		if (current ? (fingerprint(target.get(relative), objectFormat).blob === previousFile?.blob && current.mode === previousFile.mode) : !previous.has(relative)) {
			manifest.copy.push(item);
		} else manifest.overlaps.push(item);
	}
	manifest.oldOnly = [...target.keys()].filter((relative) => copyable(relative) && !staged.has(relative)).sort();
	return manifest;
}

function checkAncestorLinks(root, relative) {
	let cursor = root;
	for (const part of relative.split("/")) {
		cursor = path.join(cursor, part);
		if (fileStat(cursor)?.isSymbolicLink()) throw new Error(`Source-file symlink requires manual review: ${relative}`);
	}
}

function applyRefresh(manifestFile) {
	const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
	if (manifest.version !== 1 || !Array.isArray(manifest.copy) || !Array.isArray(manifest.overlaps)) throw new Error("Unsupported refresh manifest");
	const [, stageRoot, targetRoot] = roots(manifest.sourceRoot, manifest.stageRoot, manifest.targetRoot);
	if (manifest.overlaps.length) throw new Error("Resolve overlapping local edits before applying the refresh");
	const seen = new Set();
	const check = (item) => {
		if (!copyable(item.path)) throw new Error("Refresh manifest contains a protected or invalid path");
		if (!Number.isInteger(item.mode) || item.mode < 0 || item.mode > 0o777) throw new Error("Invalid staged file mode");
		checkAncestorLinks(stageRoot, item.path);
		checkAncestorLinks(targetRoot, item.path);
		const staged = fingerprint(path.join(stageRoot, item.path));
		const target = fingerprint(path.join(targetRoot, item.path));
		if (staged?.sha256 !== item.stageSha256 || staged?.mode !== item.mode
			|| (target?.sha256 ?? null) !== item.targetSha256 || (target?.mode ?? null) !== item.targetMode) {
			throw new Error(`Source or target changed after review: ${item.path}`);
		}
	};
	for (const item of manifest.copy) {
		if (seen.has(item.path)) throw new Error("Duplicate refresh path");
		seen.add(item.path);
		check(item);
	}
	for (const item of manifest.copy) {
		check(item);
		const destination = path.join(targetRoot, item.path);
		fs.mkdirSync(path.dirname(destination), { recursive: true });
		fs.copyFileSync(path.join(stageRoot, item.path), destination, fs.constants.COPYFILE_FICLONE);
		fs.chmodSync(destination, item.mode);
	}
	console.log(JSON.stringify({ sourceRevision: manifest.sourceRevision, copied: manifest.copy.length, localOverrides: manifest.localOverrides, preserved: manifest.preserved, manualReview: manifest.manualReview, oldOnly: manifest.oldOnly }, null, 2));
}

try {
	const args = process.argv.slice(2);
	if (args[0] === "--apply") {
		if (args.length !== 2) throw new Error(usage);
		applyRefresh(path.resolve(args[1]));
	} else {
		const [planFile, stageDir, targetDir, ...flags] = args;
		let baseline, out;
		for (let index = 0; index < flags.length; index++) {
			if (flags[index] === "--baseline") baseline = flags[++index];
			else if (flags[index] === "--out") out = flags[++index];
			else throw new Error(usage);
		}
		if (!planFile || !stageDir || !targetDir || !baseline || !out) throw new Error(usage);
		const manifest = planRefresh(path.resolve(planFile), path.resolve(stageDir), path.resolve(targetDir), baseline);
		const output = path.resolve(out);
		if ([manifest.sourceRoot, manifest.stageRoot, manifest.targetRoot].some((root) => output === root || output.startsWith(`${root}${path.sep}`))
			&& !output.split(path.sep).includes("output") && !output.split(path.sep).includes(".cache")) {
			throw new Error("Write the manifest outside source files or under ignored output/.cache");
		}
		fs.mkdirSync(path.dirname(output), { recursive: true });
		fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
		console.log(JSON.stringify({ sourceRevision: manifest.sourceRevision, copy: manifest.copy.map((item) => item.path), overlaps: manifest.overlaps.map((item) => item.path), localOverrides: manifest.localOverrides, manualReview: manifest.manualReview, preserved: manifest.preserved, oldOnly: manifest.oldOnly, manifest: output }, null, 2));
	}
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
