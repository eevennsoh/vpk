#!/usr/bin/env node
"use strict";

// Machine-wide budget for local dev stacks, read by `pnpm run dev:tmux:start` before it starts a
// new stack:
//
//   node scripts/lib/dev-stack-budget.js check --worktree <path> [--force]
//
// Exit 0: start. Exit 3: over budget, or under memory pressure while another stack runs (lists
// the live stacks, which show a live task, and how to stop the ones that do not; --force starts
// anyway). Exit 4: a next-server already serves this
// worktree outside its tmux session (never overridden: a second server for one worktree is the
// duplicate this guard exists to stop).
//
// VPK_DEV_STACK_INVENTORY=<file.json> replaces the live inventory (tests).

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { pressureReasons, readMemoryState } = require("./memory-pressure.js");
const { findCurrentWorktree } = require("./worktree-kill.js");

// Defaults from the 2026-11-13 incident on a 48 GB Mac: ten next-servers held about 39 GB
// (about 4 GB each), and six stacks plus one validation run exhausted it again. Four stacks
// (about 16 GB) leave room for agents and one heavy validation run.
const DEV_STACK_BUDGET = 4; // live stacks, counting the one about to start
const IDLE_CPU_MAX = 20; // %CPU below which a stack is listed as idle

const EXIT_OVER_BUDGET = 3;
const EXIT_DUPLICATE_SERVER = 4;

function run(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	return result.status === 0 ? result.stdout : "";
}

// Agent and tool processes whose cwd marks a worktree as in use (the same guard the
// vpk-system-clean sweep uses before stopping a stack).
const OPERATOR_NAMES = ["claude", "codex", "cursor-agent", "lazygit", "caffeinate"];

function cwdOf(pid) {
	return run("lsof", ["-a", "-d", "cwd", "-p", String(pid), "-Fn"]).split("\n").find((line) => line.startsWith("n"))?.slice(1) ?? null;
}

function listTmuxSessions(env) {
	const tmux = env.VPK_TMUX_BIN || "tmux";
	const sessions = [];
	for (const socket of ["vpk-dev", "default"]) {
		const args = socket === "default" ? [] : ["-L", socket];
		for (const line of run(tmux, [...args, "list-sessions", "-F", "#{session_name}|#{session_path}|#{session_attached}"]).split("\n")) {
			const [name, sessionPath, attached] = line.split("|");
			if (name && sessionPath) sessions.push({ name, path: sessionPath, attached: Number(attached) > 0 });
		}
	}
	return sessions;
}

function collectInventory({ env = process.env } = {}) {
	const pids = run("pgrep", ["-f", "next-server"]).split("\n").map(Number).filter((pid) => pid > 0 && pid !== process.pid);
	const servers = pids.map((pid) => {
		const cpu = Number(run("ps", ["-o", "%cpu=", "-p", String(pid)]).trim());
		return { pid, cwd: cwdOf(pid), cpu: Number.isFinite(cpu) ? cpu : null };
	}).filter((server) => server.cwd);
	const operators = OPERATOR_NAMES.flatMap((name) => run("pgrep", ["-x", name]).split("\n").map(Number).filter((pid) => pid > 0)
		.map((pid) => ({ name, pid, cwd: cwdOf(pid) })).filter((operator) => operator.cwd));
	const { pressureLevel, swapUsedGb } = readMemoryState();
	return { operators, pressureLevel, servers, sessions: listTmuxSessions(env), swapUsedGb };
}

// Every worktree root of this repository; the first is the primary checkout. Linked worktrees can
// sit inside the main checkout (.claude/worktrees/<name>), so a stack is named after the deepest
// root that contains its server's cwd.
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

function within(child, root) {
	return child === root || child.startsWith(`${root}${path.sep}`);
}

function isCodexWorktree(worktree, env = process.env) {
	const homes = [env.CODEX_HOME, env.HOME && path.join(env.HOME, ".codex")].filter(Boolean).map(realPath);
	return homes.some((home) => within(worktree, path.join(home, "worktrees")));
}

// Evidence that a live task uses this stack, or null. CPU is not evidence: a dev server in use
// reads under 20% between requests.
function inUseEvidence(stack, inventory, { primaryRoot }) {
	if (primaryRoot && stack.worktree === realPath(primaryRoot)) return "the primary checkout";
	const attached = (inventory.sessions ?? []).find((session) => session.attached && realPath(session.path) === stack.worktree);
	if (attached) return `a tmux client is attached to ${attached.name}`;
	const operator = (inventory.operators ?? []).find((candidate) => within(realPath(candidate.cwd), stack.worktree));
	if (operator) return `${operator.name} pid ${operator.pid} has its cwd here`;
	return null;
}

function evaluateBudget(inventory, {
	budget = DEV_STACK_BUDGET,
	env = process.env,
	force = false,
	idleCpuMax = IDLE_CPU_MAX,
	worktree,
	worktreeRoots = [],
}) {
	const ownRoot = realPath(worktree);
	// A next-server's cwd is its project root, so only a server whose cwd is exactly this
	// worktree is a duplicate; one in a worktree nested inside it is another stack.
	const ownServers = inventory.servers.filter((server) => realPath(server.cwd) === ownRoot);
	if (ownServers.length > 0) return { exitCode: EXIT_DUPLICATE_SERVER, ownServers, otherStacks: [], reasons: [], warnings: [] };

	const roots = [...new Set([ownRoot, ...worktreeRoots.map(realPath)])].map((root) => ({ path: root }));
	const rootOf = (server) => findCurrentWorktree(realPath(server.cwd), roots)?.path ?? realPath(server.cwd);
	const byRoot = new Map();
	for (const server of inventory.servers) {
		const root = rootOf(server);
		const stack = byRoot.get(root) ?? { worktree: root, servers: [] };
		stack.servers.push(server);
		byRoot.set(root, stack);
	}
	const primaryRoot = worktreeRoots[0] ?? null;
	const otherStacks = [...byRoot.values()].map((stack) => ({
		...stack,
		codex: isCodexWorktree(stack.worktree, env),
		inUse: inUseEvidence(stack, inventory, { primaryRoot }),
		quiet: stack.servers.every((server) => server.cpu !== null && server.cpu < idleCpuMax),
	}));
	const reasons = [];
	const warnings = [];
	if (otherStacks.length + 1 > budget) reasons.push(`${otherStacks.length} dev stacks already run; starting this one would make ${otherStacks.length + 1} > budget ${budget}`);
	// Memory pressure refuses only when there is another stack to stop; with none, it warns.
	const pressure = pressureReasons(inventory);
	if (pressure.length > 0 && otherStacks.length > 0) reasons.push(...pressure);
	else if (pressure.length > 0) warnings.push(`memory pressure (${pressure.join("; ")}), but no other dev stack runs; starting`);
	const exitCode = reasons.length > 0 && !force ? EXIT_OVER_BUDGET : 0;
	return { exitCode, forced: reasons.length > 0 && force, ownServers, otherStacks, reasons, warnings };
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
	const lines = (verdict.warnings ?? []).map((warning) => `[dev:tmux] Warning: ${warning}.`);
	if (verdict.reasons.length === 0) return lines.join("\n");
	lines.push(`[dev:tmux] ${verdict.forced ? "Starting anyway (--force): " : "Not starting: "}${verdict.reasons.join("; ")}.`);
	if (verdict.otherStacks.length > 0) {
		lines.push("[dev:tmux] Live dev stacks (quiet = every next-server under 20% CPU right now; that is not proof it is unused):");
		for (const stack of verdict.otherStacks) {
			const cpu = stack.servers.map((server) => `pid ${server.pid} ${server.cpu ?? "?"}%`).join(", ");
			lines.push(`  ${stack.quiet ? "quiet" : "busy "}  ${stack.worktree}  (${cpu})`);
			if (stack.inUse) lines.push(`        in use: ${stack.inUse}; leave it running`);
			else if (stack.codex) lines.push("        Codex worktree: check its thread before stopping");
			else lines.push(`        no live task seen; stop: (cd ${shellQuote(stack.worktree)} && pnpm run dev:tmux:stop)`);
		}
	}
	if (!verdict.forced) lines.push(`[dev:tmux] Stop a stack with no live task above, or start anyway: pnpm run dev:tmux:start -- --force   (in ${worktree})`);
	return lines.join("\n");
}

function readInventory(env = process.env) {
	if (env.VPK_DEV_STACK_INVENTORY) return JSON.parse(fs.readFileSync(env.VPK_DEV_STACK_INVENTORY, "utf8"));
	return collectInventory({ env });
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
};
