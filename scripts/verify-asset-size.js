#!/usr/bin/env node

// Per-file byte cap for everything under public/. A file over the cap fails unless
// scripts/asset-size-baseline.json records it; a recorded file may not grow past its
// recorded size, and an entry whose file is gone or back under the cap is stale. The ledger
// only shrinks: `--update` lowers entries to the current size and drops the ones that no
// longer need it, and it never adds a file. Re-encode or resize an asset instead of
// baselining it.

const { spawnSync } = require("node:child_process");
const { existsSync, lstatSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const BASELINE_PATH = path.join(__dirname, "asset-size-baseline.json");
const ASSET_ROOT = "public/";

function listAssetFiles({ cwd = process.cwd() } = {}) {
	const result = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", ASSET_ROOT], {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}

	return result.stdout
		.split("\n")
		.map((filePath) => filePath.trim())
		.filter(Boolean);
}

// Regular files only: a deleted-but-staged path or a symlink has no bytes of its own here.
function readAssetEntries(filePaths, { cwd = process.cwd() } = {}) {
	return filePaths
		.map((filePath) => {
			const absolutePath = path.join(cwd, filePath);
			if (!existsSync(absolutePath)) return null;
			const stats = lstatSync(absolutePath);
			return stats.isFile() ? { filePath, bytes: stats.size } : null;
		})
		.filter(Boolean);
}

function readBaseline(filePath = BASELINE_PATH) {
	return JSON.parse(readFileSync(filePath, "utf8"));
}

function evaluateAssetSize(entries, baseline) {
	const capBytes = baseline.capBytes;
	const recordedByPath = baseline.files ?? {};
	const currentByPath = new Map(entries.map((entry) => [entry.filePath, entry.bytes]));
	const failures = [];

	for (const entry of entries) {
		const recordedBytes = recordedByPath[entry.filePath];
		if (recordedBytes === undefined) {
			if (entry.bytes > capBytes) {
				failures.push({ type: "new-oversized-asset", filePath: entry.filePath, bytes: entry.bytes, capBytes });
			}
			continue;
		}

		if (entry.bytes > recordedBytes) {
			failures.push({ type: "baselined-asset-grew", filePath: entry.filePath, bytes: entry.bytes, recordedBytes });
		} else if (entry.bytes <= capBytes) {
			failures.push({ type: "baseline-entry-under-cap", filePath: entry.filePath, bytes: entry.bytes, capBytes });
		}
	}

	for (const [filePath, recordedBytes] of Object.entries(recordedByPath)) {
		if (!currentByPath.has(filePath)) {
			failures.push({ type: "stale-baseline-entry", filePath, recordedBytes });
		}
	}

	return failures.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

// Shrink-only: entries fall to the current size or go away; a file the ledger does not
// already record is never added.
function shrinkBaseline(entries, baseline) {
	const capBytes = baseline.capBytes;
	const currentByPath = new Map(entries.map((entry) => [entry.filePath, entry.bytes]));
	const files = {};

	for (const filePath of Object.keys(baseline.files ?? {}).sort()) {
		const bytes = currentByPath.get(filePath);
		if (bytes === undefined || bytes <= capBytes) continue;
		files[filePath] = Math.min(bytes, baseline.files[filePath]);
	}

	return { ...baseline, files };
}

function formatBytes(bytes) {
	return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatFailure(failure) {
	if (failure.type === "new-oversized-asset") {
		return `${failure.filePath}: ${formatBytes(failure.bytes)} is over the ${formatBytes(failure.capBytes)} per-file cap. Resize or re-encode it (2x its largest displayed size); the baseline does not take new files.`;
	}

	if (failure.type === "baselined-asset-grew") {
		return `${failure.filePath}: ${formatBytes(failure.bytes)} is larger than its recorded ${formatBytes(failure.recordedBytes)}. Baselined assets may only shrink.`;
	}

	if (failure.type === "baseline-entry-under-cap") {
		return `${failure.filePath}: now ${formatBytes(failure.bytes)}, under the cap; remove its baseline entry (node scripts/verify-asset-size.js --update).`;
	}

	if (failure.type === "stale-baseline-entry") {
		return `${failure.filePath}: baselined at ${formatBytes(failure.recordedBytes)} but the file no longer exists; run node scripts/verify-asset-size.js --update.`;
	}

	return `${failure.filePath}: unknown asset-size failure.`;
}

function main() {
	const entries = readAssetEntries(listAssetFiles());
	const baseline = readBaseline();

	if (process.argv.includes("--update")) {
		const updated = shrinkBaseline(entries, baseline);
		writeFileSync(BASELINE_PATH, `${JSON.stringify(updated, null, "\t")}\n`);
		console.log(`Updated ${path.relative(process.cwd(), BASELINE_PATH)}: ${Object.keys(updated.files).length} baselined assets.`);
		return;
	}

	const failures = evaluateAssetSize(entries, baseline);
	if (failures.length === 0) {
		console.log(`Verified asset size (${entries.length} files under ${ASSET_ROOT}, cap ${formatBytes(baseline.capBytes)})`);
		return;
	}

	console.error("Asset-size budget failed:");
	for (const failure of failures) {
		console.error(`- ${formatFailure(failure)}`);
	}
	process.exitCode = 1;
}

if (require.main === module) {
	main();
}

module.exports = {
	evaluateAssetSize,
	formatFailure,
	listAssetFiles,
	readAssetEntries,
	shrinkBaseline,
};
