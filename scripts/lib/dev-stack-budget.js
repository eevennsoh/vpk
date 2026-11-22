#!/usr/bin/env node
"use strict";

// Machine-wide budget for local dev stacks, read by `pnpm run dev:tmux:start` before it starts a
// new stack:
//
//   node scripts/lib/dev-stack-budget.js check --worktree <path> [--force] [--no-auto-stop]
//
// Exit 0: start. Exit 3: over budget, or under memory pressure while another stack runs (lists
// the live stacks, which show a live task, and how to stop the ones that do not; --force starts
// anyway). Exit 4: a next-server already serves this
// worktree outside its tmux session (never overridden: a second server for one worktree is the
// duplicate this guard exists to stop).
//
// Over the stack count, the check first stops the fewest idle worktree stacks of this repo that
// gets it back under budget (scripts/lib/dev-stack-auto-stop.js), then starts.
// --no-auto-stop or VPK_DEV_NO_AUTO_STOP=1 turns that off; --force never stops anything.
//
// VPK_DEV_STACK_INVENTORY=<file.json> replaces the live inventory (tests).

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { DEFAULT_IDLE_SECS, OPERATOR_NAMES, newestActivity } = require("./dev-stack-activity.js");
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
// reads under 20% between requests. Recent activity is (scripts/lib/dev-stack-activity.js): an
// agent working in a worktree often keeps its own cwd elsewhere.
function inUseEvidence(stack, inventory, { primaryRoot, newest, now, idleSecs }) {
	if (primaryRoot && stack.worktree === realPath(primaryRoot)) return "the primary checkout";
	const attached = (inventory.sessions ?? []).find((session) => session.attached && realPath(session.path) === stack.worktree);
	if (attached) return `a tmux client is attached to ${attached.name}`;
	const operator = (inventory.operators ?? []).find((candidate) => within(realPath(candidate.cwd), stack.worktree));
	if (operator) return `${operator.name} pid ${operator.pid} has its cwd here`;
	if (newest && now - newest.mtimeMs < idleSecs * 1000) return `recent activity: ${newest.source} written ${Math.max(0, Math.round((now - newest.mtimeMs) / 60_000))}m ago`;
	return null;
}

// The live dev stacks (next-servers grouped by the worktree that holds them), each with
// whether a live task uses it and whether every server is quiet. Shared by the budget
// below and the machine-state line (scripts/lib/machine-state.js).
function describeStacks(inventory, {
	env = process.env,
	idleCpuMax = IDLE_CPU_MAX,
	extraRoots = [],
	worktreeRoots = [],
	activityOf = (worktree) => newestActivity(worktree),
	now = Date.now(),
	idleSecs = DEFAULT_IDLE_SECS,
} = {}) {
	const roots = [...new Set([...extraRoots, ...worktreeRoots].map(realPath))].map((root) => ({ path: root }));
	const rootOf = (server) => findCurrentWorktree(realPath(server.cwd), roots)?.path ?? realPath(server.cwd);
	const byRoot = new Map();
	for (const server of inventory.servers) {
		const root = rootOf(server);
		const stack = byRoot.get(root) ?? { worktree: root, servers: [] };
		stack.servers.push(server);
		byRoot.set(root, stack);
	}
	const primaryRoot = worktreeRoots[0] ?? null;
	// With the repo's worktree list known, a stack outside every root is another project's
	// next-server (e.g. a sibling repo's docs site): `pnpm ports kill` cannot stop it.
	const knownRoots = new Set(worktreeRoots.map(realPath));
	return [...byRoot.values()].map((stack) => {
		const newest = activityOf(stack.worktree);
		return {
			...stack,
			codex: isCodexWorktree(stack.worktree, env),
			external: knownRoots.size > 0 && !knownRoots.has(stack.worktree),
			// A linked worktree `git worktree list` names, other than the primary checkout: the only
			// stacks auto-stop may consider.
			linkedWorktree: knownRoots.has(stack.worktree) && (!primaryRoot || stack.worktree !== realPath(primaryRoot)),
			inUse: inUseEvidence(stack, inventory, { primaryRoot, newest, now, idleSecs }),
			lastActivityMs: newest?.mtimeMs ?? null,
			quiet: stack.servers.every((server) => server.cpu !== null && server.cpu < idleCpuMax),
		};
	});
}

function evaluateBudget(inventory, {
	budget = DEV_STACK_BUDGET,
	env = process.env,
	force = false,
	idleCpuMax = IDLE_CPU_MAX,
	worktree,
	worktreeRoots = [],
	activityOf,
	now,
}) {
	const ownRoot = realPath(worktree);
	// A next-server's cwd is its project root, so only a server whose cwd is exactly this
	// worktree is a duplicate; one in a worktree nested inside it is another stack.
	const ownServers = inventory.servers.filter((server) => realPath(server.cwd) === ownRoot);
	if (ownServers.length > 0) return { exitCode: EXIT_DUPLICATE_SERVER, ownServers, otherStacks: [], reasons: [], warnings: [] };

	const otherStacks = describeStacks(inventory, { env, idleCpuMax, extraRoots: [ownRoot], worktreeRoots, ...(activityOf ? { activityOf } : {}), ...(now ? { now } : {}) });
	const reasons = [];
	const warnings = [];
	const overBy = Math.max(0, otherStacks.length + 1 - budget);
	if (overBy > 0) reasons.push(`${otherStacks.length} dev stacks already run; starting this one would make ${otherStacks.length + 1} > budget ${budget}`);
	// Memory pressure refuses only when there is another stack to stop; with none, it warns.
	const pressure = pressureReasons(inventory);
	if (pressure.length > 0 && otherStacks.length > 0) reasons.push(...pressure);
	else if (pressure.length > 0) warnings.push(`memory pressure (${pressure.join("; ")}), but no other dev stack runs; starting`);
	const exitCode = reasons.length > 0 && !force ? EXIT_OVER_BUDGET : 0;
	return { exitCode, forced: reasons.length > 0 && force, overBy, ownServers, otherStacks, pressure, reasons, warnings };
}

function shellQuote(value) {
	return `'${String(value).replace(/'/gu, "'\\''")}'`;
}

const RULE = "─".repeat(60);

function describeServers(stack) {
	const servers = stack.servers.map((server) => `pid ${server.pid} ${server.cpu ?? "?"}%`).join(", ");
	return `${stack.quiet ? "quiet" : "busy"} · ${servers}`;
}

// What to do with one stack: leave it, check it, or the exact command that stops it.
function stackAdvice(stack) {
	if (stack.inUse) return [`In use: ${stack.inUse}. Leave it running.`];
	if (stack.codex) return ["Codex worktree. Check its thread before stopping it."];
	if (stack.external) return [`Stop it: kill ${stack.servers.map((server) => server.pid).join(" ")}`];
	// `pnpm ports kill` names this worktree as the requester, so the target refuses the stop
	// if the stack turns out to be in use and logs who stopped it.
	return ["No live task seen.", `Stop it: pnpm ports kill ${shellQuote(stack.worktree)}`];
}

// Codex worktrees all end in /vpk, so a bare basename repeats; widen a repeated
// label to its parent folder too (e.g. "c891/vpk") so each stack reads distinctly.
function stackLabels(worktrees) {
	const basenames = worktrees.map((worktree) => path.basename(worktree));
	return worktrees.map((worktree, index) =>
		basenames.filter((name) => name === basenames[index]).length > 1
			? `${path.basename(path.dirname(worktree))}/${basenames[index]}`
			: basenames[index],
	);
}

// Why auto-stop did not get this start under budget, for the refusal message.
function describeAutoStop(autoStop) {
	if (!autoStop) return null;
	if (autoStop.disabled) return "Auto-stop is off (--no-auto-stop or VPK_DEV_NO_AUTO_STOP=1).";
	const { needed, safe, stopped } = autoStop;
	const plural = (count) => `${count} stack${count === 1 ? "" : "s"}`;
	if (stopped > 0) return `Auto-stopped ${plural(stopped)}, but ${plural(needed - stopped)} more must stop; the rest are listed below.`;
	if (needed > 0) return `Auto-stop needs ${plural(needed)} safe to stop and found ${safe}, so it stopped nothing.`;
	return null;
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
	const autoStopNote = describeAutoStop(verdict.autoStop);
	if (autoStopNote) lines.push(`[dev:tmux] ${autoStopNote}`);
	if (verdict.otherStacks.length > 0) {
		lines.push("", `  Running dev stacks (${verdict.otherStacks.length})`, `  ${RULE}`);
		const labels = stackLabels(verdict.otherStacks.map((stack) => stack.worktree));
		for (const [index, stack] of verdict.otherStacks.entries()) {
			if (index > 0) lines.push("");
			lines.push(`  ${index + 1}. ${labels[index]}  (${describeServers(stack)})`);
			lines.push(`     ${stack.worktree}`);
			for (const advice of stackAdvice(stack)) lines.push(`     ${advice}`);
		}
		lines.push(`  ${RULE}`, "  quiet = every next-server is under 20% CPU right now; that is not proof it is unused.");
	}
	if (!verdict.forced) {
		lines.push("", "[dev:tmux] Stop a stack marked \"Stop it\" above, or start anyway:", `  pnpm run dev:tmux:start -- --force   (in ${worktree})`);
	}
	return lines.join("\n");
}

function readInventory(env = process.env) {
	if (env.VPK_DEV_STACK_INVENTORY) return JSON.parse(fs.readFileSync(env.VPK_DEV_STACK_INVENTORY, "utf8"));
	return collectInventory({ env });
}

function autoStopDisabled(argv, env) {
	return argv.includes("--no-auto-stop") || ["1", "true", "yes"].includes(String(env.VPK_DEV_NO_AUTO_STOP ?? "").toLowerCase());
}

function main(argv, { env = process.env, stderr = process.stderr } = {}) {
	const [command, ...rest] = argv;
	const worktreeIndex = rest.indexOf("--worktree");
	const worktree = worktreeIndex >= 0 ? rest[worktreeIndex + 1] : null;
	if (command !== "check" || !worktree) {
		stderr.write("Usage: dev-stack-budget.js check --worktree <path> [--force] [--no-auto-stop]\n");
		return 2;
	}
	const worktreeRoots = listWorktreeRoots(worktree);
	const options = { env, force: rest.includes("--force"), worktree, worktreeRoots };
	const inventory = readInventory(env);
	let verdict = evaluateBudget(inventory, options);
	if (verdict.exitCode === EXIT_OVER_BUDGET && autoStopDisabled(rest, env)) {
		verdict = { ...verdict, autoStop: { disabled: true } };
	} else if (verdict.exitCode === EXIT_OVER_BUDGET) {
		// Required here, not at the top: the auto-stop's stop path loads modules that load this one.
		const { autoStopOverBudget } = require("./dev-stack-auto-stop.js");
		verdict = autoStopOverBudget(verdict, {
			evaluate: (remaining) => evaluateBudget(remaining, options),
			// Re-read after the stops: a stop that exits 0 can still leave a server running.
			refresh: () => readInventory(env),
			worktree,
			env,
			log: (line) => stderr.write(`${line}\n`),
		});
	}
	const message = formatVerdict(verdict, { worktree });
	if (message) stderr.write(`${message}\n`);
	return verdict.exitCode;
}

module.exports = {
	DEV_STACK_BUDGET,
	EXIT_DUPLICATE_SERVER,
	EXIT_OVER_BUDGET,
	collectInventory,
	describeStacks,
	listTmuxSessions,
	main,
	realPath,
	stackLabels,
	evaluateBudget,
	formatVerdict,
	listWorktreeRoots,
};

// After the exports: main() loads the auto-stop module, which requires this one back.
if (require.main === module) process.exitCode = main(process.argv.slice(2));
