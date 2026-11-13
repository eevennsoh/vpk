"use strict";

// One line about this machine's memory for agents: swap in use, the pressure level, the
// live dev stacks and the largest one, and under pressure which stack to stop. It measures
// nothing itself: memory comes from scripts/lib/memory-pressure.js (the sweep's limits),
// stacks from the dev-stack budget's inventory (scripts/lib/dev-stack-budget.js), and the
// stop command is the one `pnpm ports` prints. It never stops anything.
//
// A stack's size is its servers' vmmap "Physical footprint", the measure doctor.sh and the
// sweep use (ps RSS reads 0.2 GB for a server whose footprint is 8 GB). vmmap takes about
// 4 s per server, so live runs (`pnpm run mem --brief`, `pnpm run check`, the
// vpk-system-clean sweep) measure every server at once and write the result to a cache;
// the SessionStart hook reads memory live and the stacks from the cache, with their age.

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { pressureReasons, readMemoryState } = require("./memory-pressure.js");

const CACHE_FILE = path.join(os.homedir(), ".config", "vpk-system-clean", "machine-state.json");
// Provisional: cached stacks older than this are not reported at all. The sweep's pressure
// check runs every 5 minutes and skips 15 minutes after a run, so a cache written under
// pressure is at most about 20 minutes old while the pressure lasts.
const MACHINE_STATE_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const CODEX_PROBE = path.resolve(__dirname, "../../.agents/skills/vpk-system-clean/scripts/codex-thread-recency.js");

function cacheFile(env = process.env) {
	return env.VPK_MACHINE_STATE_CACHE || CACHE_FILE;
}

// VPK_MEMORY_STATE_FIXTURE=<json> replaces the memory reading (tests).
function readMemory(env = process.env) {
	if (env.VPK_MEMORY_STATE_FIXTURE) return JSON.parse(env.VPK_MEMORY_STATE_FIXTURE);
	return readMemoryState();
}

function gb(value) {
	return value === null || value === undefined ? "?" : `${value >= 10 ? Math.round(value) : value.toFixed(1)} GB`;
}

function formatAge(ms) {
	if (ms < 60_000) return "under a minute";
	const minutes = Math.round(ms / 60_000);
	return minutes < 120 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

/**
 * The live stacks, reduced to what the line needs. `stacks` come from describeStacks();
 * `worktrees` from getAllWorktreePortInfo(), which names the `pnpm ports kill` handle.
 * A stack may be named as the one to stop (`idle`) only when every server is quiet, no
 * live task was seen, it is not the current worktree's own stack, and, for a Codex
 * worktree, the R-2 thread-recency probe ran and said `idle` (the sweep's own rule).
 */
function summarizeStacks(stacks, { worktrees = [], killCommand, footprints = new Map(), codexVerdicts = new Map(), currentWorktree = null }) {
	return stacks.map((stack) => {
		const worktree = worktrees.find((entry) => path.resolve(entry.path) === stack.worktree) ?? null;
		const sizes = stack.servers.map((server) => footprints.get(server.pid) ?? null);
		const codexVerdict = stack.codex ? codexVerdicts.get(stack.worktree) ?? "unknown" : null;
		const current = currentWorktree !== null && stack.worktree === currentWorktree;
		return {
			worktree: stack.worktree,
			name: worktree?.worktreeName ?? path.basename(stack.worktree),
			footprintGb: sizes.every((value) => typeof value === "number") ? sizes.reduce((sum, value) => sum + value, 0) : null,
			idle: stack.quiet && !stack.inUse && !current && (!stack.codex || codexVerdict === "idle"),
			inUse: stack.inUse ?? null,
			codex: stack.codex === true,
			codexVerdict,
			current,
			stop: worktree ? killCommand(worktree) : `(cd ${stack.worktree} && pnpm run dev:tmux:stop)`,
		};
	});
}

/**
 * @param {{
 *   memory: { swapUsedGb: number | null, pressureLevel: number | null },
 *   stacks: Array<{ name, rssGb, idle, stop }> | null,   // null: no inventory to hand
 *   stacksAgeMs?: number | null,                          // set when the stacks are cached
 *   advise?: boolean,      // name a stack to stop; false for cached stacks, whose idle verdict is old
 *   limits?: { swapLimitGb?: number, levelMin?: number },
 * }} state
 * @returns {{ pressure: boolean, line: string }}
 */
function formatMachineLine({ memory, stacks, stacksAgeMs = null, advise = true, limits = {} }) {
	const reasons = pressureReasons(memory, limits);
	const pressure = reasons.length > 0;
	const parts = [`swap ${gb(memory.swapUsedGb)} used`, `pressure level ${memory.pressureLevel ?? "?"}`];
	let advice = null;
	if (stacks === null) {
		parts.push("dev stacks unknown (run pnpm run mem --brief)");
	} else {
		const sized = [...stacks].sort((a, b) => (b.footprintGb ?? -1) - (a.footprintGb ?? -1));
		const largest = sized[0];
		const age = stacksAgeMs === null ? "" : `, as of ${formatAge(stacksAgeMs)} ago`;
		parts.push(`${stacks.length} dev stack${stacks.length === 1 ? "" : "s"}${largest ? `, largest ${largest.name} ${gb(largest.footprintGb)}` : ""}${age}`);
		if (pressure && !advise) {
			advice = "run pnpm run mem --brief to see which stack is safe to stop";
		} else if (pressure) {
			const idle = sized.find((stack) => stack.idle);
			advice = idle
				? `stop the largest idle stack: ${idle.stop}`
				: stacks.length > 0
					? "no stack is safe to name: each is busy, shows a live task, is a Codex worktree whose thread is not idle, or is this worktree's own"
					: "no dev stack runs; look at other processes";
		}
	}
	const head = pressure ? `machine: MEMORY PRESSURE (${reasons.join("; ")})` : "machine: normal";
	return { pressure, line: `${head}: ${parts.join(", ")}${advice ? `; ${advice}` : ""}` };
}

function writeCache(stacks, { env = process.env, now = Date.now() } = {}) {
	const file = cacheFile(env);
	try {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(`${file}.tmp`, `${JSON.stringify({ writtenAt: now, stacks })}\n`);
		fs.renameSync(`${file}.tmp`, file);
		return true;
	} catch {
		return false;
	}
}

// The cache, or null when it is missing, unreadable or older than the maximum age.
function readCache({ env = process.env, now = Date.now(), maxAgeMs = MACHINE_STATE_CACHE_MAX_AGE_MS } = {}) {
	try {
		const parsed = JSON.parse(fs.readFileSync(cacheFile(env), "utf8"));
		if (!Array.isArray(parsed.stacks) || !Number.isFinite(parsed.writtenAt)) return null;
		return now - parsed.writtenAt <= maxAgeMs ? parsed : null;
	} catch {
		return null;
	}
}

// The R-2 probe's verdict for a Codex worktree: active | recent | idle | unknown.
function probeCodex(worktree, { pressure }) {
	try {
		const { IDLE_HOURS, PRESSURE_IDLE_HOURS, probeCodexThreadRecency } = require(CODEX_PROBE);
		return probeCodexThreadRecency({ cwd: worktree, idleHours: pressure ? PRESSURE_IDLE_HOURS : IDLE_HOURS }).verdict;
	} catch {
		return "unknown";
	}
}

function currentWorktreeRoot(cwd) {
	try {
		const { spawnSync } = require("node:child_process");
		const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
		return top.status === 0 ? fs.realpathSync(top.stdout.trim()) : null;
	} catch {
		return null;
	}
}

// `Physical footprint:   8.4G` from `vmmap -summary`, in GB; null when absent.
function parseFootprintGb(text) {
	const match = /^Physical footprint:\s+([\d.]+)([KMG])/mu.exec(text ?? "");
	if (!match) return null;
	const value = Number(match[1]);
	return match[2] === "G" ? value : match[2] === "M" ? value / 1024 : value / 2 ** 20;
}

function readFootprintGb(pid) {
	return new Promise((resolve) => {
		try {
			execFile("vmmap", ["-summary", String(pid)], { timeout: 20_000, maxBuffer: 16 * 1024 * 1024, encoding: "utf8" }, (error, stdout) => {
				resolve(error ? null : parseFootprintGb(stdout));
			});
		} catch {
			resolve(null);
		}
	});
}

// The live inventory and every server's footprint, measured at once (about 4 s).
// Loaded lazily so the hook path stays light.
async function collectStacks({ cwd = process.cwd(), env = process.env, pressure = false, probe = probeCodex } = {}) {
	const { collectInventory, describeStacks, listWorktreeRoots } = require("./dev-stack-budget.js");
	const { getAllWorktreePortInfo } = require("./worktree-ports.js");
	const { killCommand } = require("../show-worktree-ports.js");
	const stacks = describeStacks(collectInventory({ env }), { env, worktreeRoots: listWorktreeRoots(cwd) });
	const pids = stacks.flatMap((stack) => stack.servers.map((server) => server.pid));
	const footprints = new Map(await Promise.all(pids.map(async (pid) => [pid, await readFootprintGb(pid)])));
	let worktrees = [];
	try {
		worktrees = getAllWorktreePortInfo();
	} catch {
		// Without names the stop command falls back to dev:tmux:stop in the worktree.
	}
	const codexVerdicts = new Map(stacks.filter((stack) => stack.codex).map((stack) => [stack.worktree, probe(stack.worktree, { pressure })]));
	return summarizeStacks(stacks, { worktrees, killCommand, footprints, codexVerdicts, currentWorktree: currentWorktreeRoot(cwd) });
}

module.exports = {
	CACHE_FILE,
	MACHINE_STATE_CACHE_MAX_AGE_MS,
	collectStacks,
	formatMachineLine,
	parseFootprintGb,
	readCache,
	readMemory,
	summarizeStacks,
	writeCache,
};
