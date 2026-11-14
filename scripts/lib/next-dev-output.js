"use strict";

// What a worktree's `.next` holds, and the clean of the dev output that `dev:tmux:stop` runs.
//
// Next 16 keeps `next dev` output (`.next/dev/static`, `.next/dev/server`) across restarts and
// prunes it only at server start, and only files older than
// `experimental.turbopackStaleOutputMaxAge` (7 days by default). It never prunes it while a
// server runs, so an active stack's chunks grow by about a GiB an hour. The persistent Turbopack
// cache (`.next/dev/cache`) is separate; it keeps restarts warm and lets Turbopack evict memory.
// Two bounds keep the output to about one session: `dev:tmux:stop` removes it (and keeps the
// cache), and next.config.ts lowers the stale-output age to a day for any other start (a
// foreground `pnpm run dev`, `rovo:tmux`, a stop that was skipped or refused).
//
//   node scripts/lib/next-dev-output.js sizes [--worktree PATH]   JSON byte counts (du, sizes only)
//   node scripts/lib/next-dev-output.js clean [--worktree PATH] [--socket S] [--session N]
//                                     remove the dev output, keep the cache; refuses unless the
//                                     stack is stopped or absent (run by `dev:tmux:stop`)

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// `experimental.turbopackStaleOutputMaxAge` in next.config.ts: at dev start Next deletes dev
// output files older than this (its default is 7 days). The persistent cache is untouched.
const DEV_STALE_OUTPUT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// The directories Next itself prunes at dev start (TURBOPACK_OUTPUT_DIRS sit under these two).
const DEV_OUTPUT_DIRS = ["dev/static", "dev/server"];

// One `du` pass over `.next`, two levels deep: KiB per path, keyed relative to `.next` ("" for
// `.next` itself, "dev", "dev/static", "cache", …). Sizes only; no file is read.
function duTree(nextDir, { spawnSyncImpl = spawnSync } = {}) {
	const result = spawnSyncImpl("du", ["-k", "-d", "2", nextDir], { encoding: "utf8" });
	const sizes = new Map();
	for (const line of String(result.stdout ?? "").split("\n")) {
		const match = /^(\d+)\s+(.+)$/u.exec(line);
		if (!match) continue;
		const relative = path.relative(nextDir, match[2]);
		if (!relative.startsWith("..")) sizes.set(relative.split(path.sep).join("/"), Number(match[1]) * 1024);
	}
	return sizes;
}

/**
 * Byte counts of a worktree's `.next`, from one depth-limited `du` (allocated size, no file
 * contents read). Returns null when there is no `.next`.
 */
function measureNextDir(worktreePath, { tree = duTree } = {}) {
	const nextDir = path.join(worktreePath, ".next");
	if (!fs.existsSync(nextDir)) return null;
	const sizes = tree(nextDir);
	const size = (relative) => sizes.get(relative) ?? 0;
	const total = size("");
	const dev = size("dev");
	const devOutput = DEV_OUTPUT_DIRS.reduce((sum, dir) => sum + size(dir), 0);
	const devCache = size("dev/cache");
	const buildCache = size("cache");
	return {
		totalBytes: total,
		devOutputBytes: devOutput,
		devCacheBytes: devCache,
		devOtherBytes: Math.max(dev - devOutput - devCache, 0),
		buildCacheBytes: buildCache,
		buildOutputBytes: Math.max(total - dev - buildCache, 0),
	};
}

// `next dev` holds `.next/dev/lock` while it runs; the file names its pid. A lock whose pid is
// alive (or cannot be checked) means a dev server may be serving these files, whether or not a
// tmux session or a stack record knows about it (a foreground `pnpm run dev`).
function nextDevServerHolding(worktreePath, { readFile = fs.readFileSync, kill = process.kill } = {}) {
	let content;
	try {
		content = readFile(path.join(worktreePath, ".next", "dev", "lock"), "utf8");
	} catch (error) {
		return error?.code === "ENOENT" ? null : { pid: null, reason: "its dev lock cannot be read" };
	}
	let pid = null;
	try {
		pid = Number.parseInt(JSON.parse(content).pid, 10);
	} catch {
		// Not Next's JSON lock.
	}
	if (!Number.isInteger(pid) || pid <= 0) return { pid: null, reason: "its dev lock names no process" };
	try {
		kill(pid, 0);
	} catch (error) {
		if (error?.code === "ESRCH") return null;
	}
	return { pid, reason: `next dev (pid ${pid}) holds its dev lock` };
}

/**
 * Remove `.next/dev/static` and `.next/dev/server` and keep `.next/dev/cache`. Next prunes the
 * same directories at its next start; doing it at stop frees a stopped worktree's disk too.
 * The caller must make sure no dev server runs in the worktree.
 */
function cleanDevOutput(worktreePath, { measure = (target) => duTree(target).get("") ?? 0, rmSync = fs.rmSync } = {}) {
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
	DEV_STALE_OUTPUT_MAX_AGE_MS,
	cleanDevOutput,
	describeNextDir,
	duTree,
	measureNextDir,
	nextDevServerHolding,
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
				const refuse = (why) => {
					console.error(`[dev:tmux] Not removing the dev output: ${why}. A later dev start prunes output older than 24 h.`);
					process.exit(1);
				};
				// Checked first and without lsof or ps: a foreground dev server holds Next's lock.
				const holder = nextDevServerHolding(worktreePath);
				if (holder) refuse(holder.reason);
				if (!["stopped", "absent"].includes(report.status)) refuse(`the stack is ${report.status} (${report.reason})`);
				// A recorded process that cannot be verified may still be serving.
				const unverified = Object.entries(report.services).filter(([, fact]) => (fact.pid && fact.pidAlive !== false) || (fact.childPid && fact.childPidAlive !== false));
				if (unverified.length > 0) refuse(`${unverified.map(([service]) => service).join(" and ")} has a recorded process that cannot be confirmed gone`);
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
