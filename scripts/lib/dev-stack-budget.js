#!/usr/bin/env node
"use strict";

// Machine-wide budget for local dev stacks, read by `pnpm run dev:tmux:start` before it starts a
// new stack:
//
//   node scripts/lib/dev-stack-budget.js check --worktree <path> [--force]
//
// Exit 0: start. Exit 3: over budget or under memory pressure (lists the live stacks, which look
// idle, and how to stop each; --force starts anyway). Exit 4: a next-server already serves this
// worktree outside its tmux session (never overridden: a second server for one worktree is the
// duplicate this guard exists to stop).
//
// VPK_DEV_STACK_INVENTORY=<file.json> replaces the live inventory (tests).

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { findCurrentWorktree } = require("./worktree-kill.js");

// Defaults from the 2026-11-13 incident on a 48 GB Mac: ten next-servers held about 39 GB
// (about 4 GB each), and six stacks plus one validation run exhausted it again. Four stacks
// (about 16 GB) leave room for agents and one heavy validation run.
const DEV_STACK_BUDGET = 4; // live stacks, counting the one about to start
const PRESSURE_SWAP_USED_GB = 16; // same limits as the vpk-system-clean pressure mode
const PRESSURE_LEVEL_MIN = 4; // kern.memorystatus_vm_pressure_level: 4 is critical
const IDLE_CPU_MAX = 20; // %CPU below which a stack is listed as idle

const EXIT_OVER_BUDGET = 3;
const EXIT_DUPLICATE_SERVER = 4;

function run(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	return result.status === 0 ? result.stdout : "";
}

function parseSwapUsedGb(text) {
	const match = /used = ([\d.]+)([KMG])/u.exec(text);
	if (!match) return null;
	const value = Number(match[1]);
	return Math.floor(match[2] === "G" ? value : match[2] === "M" ? value / 1024 : 0);
}

function collectInventory() {
	const pids = run("pgrep", ["-f", "next-server"]).split("\n").map(Number).filter((pid) => pid > 0 && pid !== process.pid);
	const servers = pids.map((pid) => {
		const cwd = run("lsof", ["-a", "-d", "cwd", "-p", String(pid), "-Fn"]).split("\n").find((line) => line.startsWith("n"))?.slice(1) ?? null;
		const cpu = Number(run("ps", ["-o", "%cpu=", "-p", String(pid)]).trim());
		return { pid, cwd, cpu: Number.isFinite(cpu) ? cpu : null };
	}).filter((server) => server.cwd);
	const level = Number(run("sysctl", ["-n", "kern.memorystatus_vm_pressure_level"]).trim());
	return {
		servers,
		swapUsedGb: parseSwapUsedGb(run("sysctl", ["-n", "vm.swapusage"])),
		pressureLevel: Number.isInteger(level) && level > 0 ? level : null,
	};
}

// Every worktree root of this repository. Linked worktrees can sit inside the main checkout
// (.claude/worktrees/<name>), so a server belongs to the deepest root that contains its cwd.
function listWorktreeRoots(cwd) {
	const result = spawnSync("git", ["worktree", "list", "--porcelain"], { cwd, encoding: "utf8" });
	if (result.status !== 0) return [];
	return result.stdout.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length));
}

function realPath(value) {
	try {
		return fs.realpathSync(value);
	} catch {
		return path.resolve(value);
	}
}

function evaluateBudget(inventory, {
	budget = DEV_STACK_BUDGET,
	force = false,
	idleCpuMax = IDLE_CPU_MAX,
	pressureLevelMin = PRESSURE_LEVEL_MIN,
	swapLimitGb = PRESSURE_SWAP_USED_GB,
	worktree,
	worktreeRoots = [],
}) {
	const ownRoot = realPath(worktree);
	const roots = [...new Set([ownRoot, ...worktreeRoots.map(realPath)])].map((root) => ({ path: root }));
	// The worktree a server serves: the deepest known root containing its cwd, else its cwd.
	const rootOf = (server) => findCurrentWorktree(realPath(server.cwd), roots)?.path ?? server.cwd;
	const ownServers = inventory.servers.filter((server) => rootOf(server) === ownRoot);
	if (ownServers.length > 0) return { exitCode: EXIT_DUPLICATE_SERVER, ownServers, otherStacks: [], reasons: [] };

	const byRoot = new Map();
	for (const server of inventory.servers) {
		const root = rootOf(server);
		const stack = byRoot.get(root) ?? { worktree: root, servers: [] };
		stack.servers.push(server);
		byRoot.set(root, stack);
	}
	const otherStacks = [...byRoot.values()].map((stack) => ({
		...stack,
		idle: stack.servers.every((server) => server.cpu !== null && server.cpu < idleCpuMax),
	}));
	const reasons = [];
	if (otherStacks.length + 1 > budget) reasons.push(`${otherStacks.length} dev stacks already run; starting this one would make ${otherStacks.length + 1} > budget ${budget}`);
	if (inventory.swapUsedGb !== null && inventory.swapUsedGb >= swapLimitGb) reasons.push(`swap in use is ${inventory.swapUsedGb} GB >= ${swapLimitGb} GB`);
	if (inventory.pressureLevel !== null && inventory.pressureLevel >= pressureLevelMin) reasons.push(`memory-pressure level is ${inventory.pressureLevel} >= ${pressureLevelMin}`);
	const exitCode = reasons.length > 0 && !force ? EXIT_OVER_BUDGET : 0;
	return { exitCode, forced: reasons.length > 0 && force, ownServers, otherStacks, reasons };
}

function shellQuote(value) {
	return `'${String(value).replace(/'/gu, "'\\''")}'`;
}

function formatVerdict(verdict, { worktree }) {
	if (verdict.exitCode === EXIT_DUPLICATE_SERVER) {
		return [
			`[dev:tmux] A next-server already serves this worktree outside its tmux session: ${verdict.ownServers.map((server) => `pid ${server.pid}`).join(", ")} (cwd ${verdict.ownServers[0].cwd}).`,
			"[dev:tmux] Not starting a second one. Stop it first: pnpm run dev:tmux:stop (stops every listener in this worktree), then start again.",
		].join("\n");
	}
	if (verdict.reasons.length === 0) return "";
	const lines = [
		`[dev:tmux] ${verdict.forced ? "Starting anyway (--force): " : "Not starting: "}${verdict.reasons.join("; ")}.`,
	];
	if (verdict.otherStacks.length > 0) {
		lines.push("[dev:tmux] Live dev stacks (idle = every next-server under 20% CPU):");
		for (const stack of verdict.otherStacks) {
			const cpu = stack.servers.map((server) => `pid ${server.pid} ${server.cpu ?? "?"}%`).join(", ");
			lines.push(`  ${stack.idle ? "idle" : "busy"}  ${stack.worktree}  (${cpu})`);
			lines.push(`        stop: (cd ${shellQuote(stack.worktree)} && pnpm run dev:tmux:stop)`);
		}
	}
	if (!verdict.forced) lines.push(`[dev:tmux] Stop an idle stack above, or start anyway: pnpm run dev:tmux:start -- --force   (in ${worktree})`);
	return lines.join("\n");
}

function readInventory(env = process.env) {
	if (env.VPK_DEV_STACK_INVENTORY) return JSON.parse(fs.readFileSync(env.VPK_DEV_STACK_INVENTORY, "utf8"));
	return collectInventory();
}

function main(argv) {
	const [command, ...rest] = argv;
	const worktreeIndex = rest.indexOf("--worktree");
	const worktree = worktreeIndex >= 0 ? rest[worktreeIndex + 1] : null;
	if (command !== "check" || !worktree) {
		process.stderr.write("Usage: dev-stack-budget.js check --worktree <path> [--force]\n");
		return 2;
	}
	const verdict = evaluateBudget(readInventory(), { force: rest.includes("--force"), worktree, worktreeRoots: listWorktreeRoots(worktree) });
	const message = formatVerdict(verdict, { worktree });
	if (message) process.stderr.write(`${message}\n`);
	return verdict.exitCode;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {
	DEV_STACK_BUDGET,
	EXIT_DUPLICATE_SERVER,
	EXIT_OVER_BUDGET,
	evaluateBudget,
	formatVerdict,
	parseSwapUsedGb,
};
