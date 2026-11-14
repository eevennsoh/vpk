"use strict";

// What a worktree's `.next` holds, and an opt-in clean of the dev output.
//
// Next 16 keeps `next dev` output (`.next/dev/static`, `.next/dev/server`) across restarts and
// prunes it only at server start, and only files older than
// `experimental.turbopackStaleOutputMaxAge` (7 days by default). It never prunes it while a
// server runs, so an active stack's chunks grow by about a GiB an hour. The persistent Turbopack
// cache (`.next/dev/cache`) is separate; it keeps restarts warm and lets Turbopack evict memory.
//
//   node scripts/lib/next-dev-output.js sizes [--worktree PATH]   JSON byte counts (du, sizes only)
//   node scripts/lib/next-dev-output.js clean [--worktree PATH] [--socket S] [--session N]
//                                     remove the dev output, keep the cache; refuses unless the
//                                     stack is stopped or absent (`dev:tmux:stop --clean-dev-output`)

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// The directories Next itself prunes at dev start (TURBOPACK_OUTPUT_DIRS sit under these two).
const DEV_OUTPUT_DIRS = ["dev/static", "dev/server"];

function duBytes(target, { spawnSyncImpl = spawnSync } = {}) {
	if (!fs.existsSync(target)) return 0;
	const result = spawnSyncImpl("du", ["-sk", target], { encoding: "utf8" });
	const kib = Number.parseInt(String(result.stdout ?? ""), 10);
	return Number.isFinite(kib) ? kib * 1024 : 0;
}

/**
 * Byte counts of a worktree's `.next`, from `du` (allocated size, no file contents read).
 * Returns null when there is no `.next`.
 */
function measureNextDir(worktreePath, { measure = duBytes } = {}) {
	const nextDir = path.join(worktreePath, ".next");
	if (!fs.existsSync(nextDir)) return null;
	const total = measure(nextDir);
	const dev = measure(path.join(nextDir, "dev"));
	const devOutput = DEV_OUTPUT_DIRS.reduce((sum, dir) => sum + measure(path.join(nextDir, dir)), 0);
	const devCache = measure(path.join(nextDir, "dev", "cache"));
	const buildCache = measure(path.join(nextDir, "cache"));
	return {
		totalBytes: total,
		devOutputBytes: devOutput,
		devCacheBytes: devCache,
		devOtherBytes: Math.max(dev - devOutput - devCache, 0),
		buildCacheBytes: buildCache,
		buildOutputBytes: Math.max(total - dev - buildCache, 0),
	};
}

/**
 * Remove `.next/dev/static` and `.next/dev/server` and keep `.next/dev/cache`. Next prunes the
 * same directories at its next start; doing it at stop frees a stopped worktree's disk too.
 * The caller must make sure no dev server runs in the worktree.
 */
function cleanDevOutput(worktreePath, { measure = duBytes, rmSync = fs.rmSync } = {}) {
	const nextDir = path.join(worktreePath, ".next");
	const removed = [];
	let freedBytes = 0;
	for (const dir of DEV_OUTPUT_DIRS) {
		const target = path.join(nextDir, dir);
		if (!fs.existsSync(target)) continue;
		freedBytes += measure(target);
		rmSync(target, { recursive: true, force: true });
		removed.push(dir);
	}
	return { removed, freedBytes };
}

function formatGiB(bytes) {
	return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

// One line for `pnpm run doctor`.
function describeNextDir(sizes) {
	if (!sizes) return "no .next";
	return `${formatGiB(sizes.totalBytes)}: dev output ${formatGiB(sizes.devOutputBytes)}, dev cache ${formatGiB(sizes.devCacheBytes)}, build cache ${formatGiB(sizes.buildCacheBytes)}, build output ${formatGiB(sizes.buildOutputBytes)}`;
}

module.exports = {
	DEV_OUTPUT_DIRS,
	cleanDevOutput,
	describeNextDir,
	measureNextDir,
};

if (require.main === module) {
	const [command, ...rest] = process.argv.slice(2);
	const at = rest.indexOf("--worktree");
	const worktreePath = path.resolve(at >= 0 ? rest[at + 1] : process.cwd());
	if (command === "sizes") {
		process.stdout.write(`${JSON.stringify(measureNextDir(worktreePath), null, "\t")}\n`);
	} else if (command === "clean") {
		const option = (name) => (rest.indexOf(name) >= 0 ? rest[rest.indexOf(name) + 1] : undefined);
		// Never under a running server: it would request chunks that are gone.
		require("./dev-stack-state")
			.readStackStatus({ worktreePath, socket: option("--socket"), sessionName: option("--session") })
			.then((report) => {
				if (!["stopped", "absent"].includes(report.status)) {
					console.error(`[dev:tmux] Not removing the dev output: the stack is ${report.status} (${report.reason}).`);
					process.exit(1);
				}
				const { removed, freedBytes } = cleanDevOutput(worktreePath);
				console.log(
					removed.length > 0
						? `[dev:tmux] Removed .next/${removed.join(" and .next/")} (${formatGiB(freedBytes)}); kept .next/dev/cache.`
						: "[dev:tmux] No dev output to remove.",
				);
			});
	} else {
		console.error("Usage: next-dev-output.js sizes|clean [--worktree PATH]");
		process.exit(2);
	}
}
