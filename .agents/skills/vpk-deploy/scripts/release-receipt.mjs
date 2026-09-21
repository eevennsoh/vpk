#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const requiredChecks = ["install", "typecheck", "export", "inventory", "compression"];
const ignoredDirectories = new Set([".git", ".agents", ".claude", ".codex", ".cursor", ".next", "node_modules", "out", "output", "artifacts", "test-results", ".pnpm-store", ".venv"]);
const ignoredFiles = new Set(["README.md", "AGENTS.md", "CLAUDE.md", "next-env.d.ts", ".deploy.local", ".asap-config", ".DS_Store"]);
const buffer = Buffer.allocUnsafe(1024 * 1024);

function readJson(file, label) {
	try { return JSON.parse(fs.readFileSync(file, "utf8")); }
	catch { throw new Error(`Invalid ${label} JSON`); }
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function fingerprint(file) {
	const stat = fs.lstatSync(file);
	if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Build input symlink or non-file requires review");
	const hash = createHash("sha256");
	const descriptor = fs.openSync(file, "r");
	try {
		let count;
		while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
	} finally { fs.closeSync(descriptor); }
	return { sha256: hash.digest("hex"), bytes: stat.size, mode: stat.mode & 0o777 };
}

function collect(root, exportOnly = false) {
	const files = {};
	const visit = (directory, prefix = "") => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			const publicAsset = relative === "public" || relative.startsWith("public/");
			if (!exportOnly && !publicAsset && ((prefix === "" && (ignoredDirectories.has(entry.name) || ignoredFiles.has(entry.name) || entry.name.startsWith(".dev-"))) || ["node_modules", ".git", ".next", ".pnpm-store", ".venv"].includes(entry.name) || entry.name.endsWith(".tsbuildinfo") || entry.name === ".DS_Store" || /^backend\/(?:data|public)(?:\/|$)/u.test(relative))) continue;
			const absolute = path.join(root, relative);
			if (entry.isSymbolicLink()) throw new Error(`Build input symlink requires review: ${relative}`);
			if (entry.isDirectory()) visit(absolute, relative);
			else if (entry.isFile()) files[relative] = fingerprint(absolute);
		}
	};
	visit(root);
	return files;
}

function environmentHash(environment) {
	const settings = Object.fromEntries(Object.entries(environment).filter(([key]) => key.startsWith("NEXT_PUBLIC_") || ["NODE_ENV", "NEXT_OUTPUT"].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
	return sha256(JSON.stringify(settings));
}

function sourceSelection(target) {
	const metadata = path.join(target, ".vpk-source.json");
	if (fs.existsSync(metadata)) {
		const source = readJson(metadata, "extraction source metadata");
		if (source.version !== 1 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(source.sourceRevision ?? "")) throw new Error("Invalid extraction source metadata");
		return { sourceRevision: source.sourceRevision, route: source.route, sourceWasDirty: Boolean(source.sourceWasDirty), kind: "vpk-extraction" };
	}
	try {
		const revision = execFileSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		const status = execFileSync("git", ["-C", target, "status", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
		return { sourceRevision: revision, sourceWasDirty: Boolean(status.trim()), kind: "checkout" };
	} catch { return { sourceRevision: null, kind: "unversioned-checkout" }; }
}

function assertChecks(checks) {
	if (!Array.isArray(checks) || requiredChecks.some(check => !checks.includes(check))) throw new Error("Receipt requires successful install, typecheck, export, inventory and compression checks");
}

export function captureBuildInputs(targetDirectory, { environment = process.env } = {}) {
	const target = fs.realpathSync(targetDirectory);
	return { version: 1, kind: "vpk-build-inputs", target, source: sourceSelection(target), environmentSha256: environmentHash(environment), inputs: collect(target) };
}

function verifyBuildInputs(target, snapshot, environment) {
	if (snapshot?.version !== 1 || snapshot.kind !== "vpk-build-inputs" || snapshot.target !== target) throw new Error("A pre-build input snapshot for this target is required");
	if (snapshot.environmentSha256 !== environmentHash(environment)) throw new Error("Build environment changed during verification");
	assertFilesUnchanged(snapshot.inputs, collect(target), "Build inputs");
}

export function createReleaseReceipt(targetDirectory, { checks, buildScript, inputSnapshot, environment = process.env } = {}) {
	assertChecks(checks);
	if (!["build", "build:export"].includes(buildScript)) throw new Error("Receipt requires the verified build script");
	const target = fs.realpathSync(targetDirectory);
	verifyBuildInputs(target, inputSnapshot, environment);
	const inventoryPath = path.join(target, "output/export-inventory.json");
	const inventory = readJson(inventoryPath, "export inventory");
	const exported = collect(path.join(target, "out"), true);
	if (!exported["index.html"] || inventory.kind !== "static-export-inventory" || inventory.packagedFiles !== Object.keys(exported).length || inventory.packagedBytes !== Object.values(exported).reduce((sum, file) => sum + file.bytes, 0)) throw new Error("Export inventory is invalid or changed");
	for (const relative of Object.keys(exported).filter(name => /\.(?:html|css|m?js|json|svg|txt|xml)$/iu.test(name))) {
		if (!exported[`${relative}.gz`] || !exported[`${relative}.br`]) throw new Error(`Compression check missing representations: ${relative}`);
	}
	return {
		version: 2, kind: "vpk-verified-export", target, createdAt: new Date().toISOString(),
		source: inputSnapshot.source, buildScript, checks: [...requiredChecks],
		environmentSha256: inputSnapshot.environmentSha256, inputs: inputSnapshot.inputs, exported,
		inventory: fingerprint(inventoryPath),
	};
}

function sameFingerprint(expected, actual) {
	return expected && actual && expected.sha256 === actual.sha256 && expected.bytes === actual.bytes && expected.mode === actual.mode;
}

function assertFilesUnchanged(expected, actual, label) {
	if (!expected || typeof expected !== "object" || Array.isArray(expected)) throw new Error("Invalid release receipt file manifest");
	const changed = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].filter(name => !sameFingerprint(expected[name], actual[name]));
	if (changed.length) throw new Error(`${label} changed after verification: ${changed.slice(0, 5).join(", ")}`);
}

export function verifyReleaseReceipt(targetDirectory, receipt, { environment = process.env } = {}) {
	if (receipt?.version !== 2 || receipt.kind !== "vpk-verified-export") throw new Error("Unsupported release receipt");
	const target = fs.realpathSync(targetDirectory);
	if (receipt.target !== target) throw new Error("Release receipt belongs to another target");
	assertChecks(receipt.checks);
	if (environmentHash(environment) !== receipt.environmentSha256) throw new Error("Build environment changed after verification");
	assertFilesUnchanged(receipt.inputs, collect(target), "Build inputs");
	assertFilesUnchanged(receipt.exported, collect(path.join(target, "out"), true), "Export bytes");
	if (!sameFingerprint(receipt.inventory, fingerprint(path.join(target, "output/export-inventory.json")))) throw new Error("Export inventory changed after verification");
	return { verified: true, target, source: receipt.source, buildScript: receipt.buildScript, exportedFiles: receipt.exported ? Object.keys(receipt.exported).length : null };
}

export function main(args) {
	const action = args.shift();
	let target = process.cwd(), receiptPath, checks, buildScript, inputsFile;
	for (let index = 0; index < args.length; index++) {
		const flag = args[index], value = args[++index];
		if (!value || value.startsWith("--")) throw new Error("Receipt option value is required");
		if (flag === "--target") target = path.resolve(value);
		else if (flag === "--receipt") receiptPath = path.resolve(value);
		else if (flag === "--inputs-file") inputsFile = path.resolve(value);
		else if (flag === "--checks") checks = value.split(",");
		else if (flag === "--build-script") buildScript = value;
		else throw new Error("Unsupported receipt option");
	}
	if (!["inputs", "capture", "verify"].includes(action)) throw new Error("Use inputs, capture or verify for a release receipt");
	const requestedTarget = path.resolve(target);
	const canonicalTarget = fs.realpathSync(target);
	if (receiptPath?.startsWith(`${requestedTarget}${path.sep}`)) receiptPath = path.join(canonicalTarget, path.relative(requestedTarget, receiptPath));
	target = canonicalTarget;
	receiptPath ??= path.join(target, "output", action === "inputs" ? "build-inputs.json" : "release-receipt.json");
	if (action === "capture" || action === "inputs") {
		const outputDirectory = path.join(fs.realpathSync(target), "output");
		if (!receiptPath.startsWith(`${outputDirectory}${path.sep}`)) throw new Error("Store release receipts under the target's ignored output directory");
		const receipt = action === "inputs" ? captureBuildInputs(target) : createReleaseReceipt(target, { checks, buildScript, inputSnapshot: inputsFile ? readJson(inputsFile, "build input snapshot") : undefined });
		fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
		fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
		console.log(JSON.stringify({ receipt: receiptPath, source: receipt.source, exportedFiles: receipt.exported ? Object.keys(receipt.exported).length : null }));
	} else {
		const receipt = readJson(receiptPath, "release receipt");
		console.log(JSON.stringify(verifyReleaseReceipt(target, receipt)));
	}
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try { main(process.argv.slice(2)); }
	catch (error) { console.error(error.message); process.exitCode = 2; }
}
