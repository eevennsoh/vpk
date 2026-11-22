const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { PRESSURE_SWAP_USED_GB: SWAP } = require("./memory-pressure.js");
const { EXIT_OVER_BUDGET, evaluateBudget, formatVerdict } = require("./dev-stack-budget.js");
const { autoStopOverBudget, planAutoStop } = require("./dev-stack-auto-stop.js");

// Every process, port, session and activity reading here is a fake: no real stack is stopped.
const NOW = Date.parse("2026-11-16T10:00:00Z");
const HOUR = 3600_000;
const MAIN = "/repo";
const OWN = "/repo/.claude/worktrees/new";
const wt = (name) => `/repo/.claude/worktrees/${name}`;
// Not under /home: on macOS that is an automount, and resolving it takes about 300 ms.
const CODEX = "/Users/me/.codex/worktrees/ab12/vpk";
const ENV = { HOME: "/Users/me" };
const calm = { swapUsedGb: 2, pressureLevel: 1, sessions: [], operators: [] };

// Main checkout, a Codex worktree, a foreign server, an agent-held worktree, a fresh dev log,
// and three idle linked worktrees of different ages: 8 other stacks, so 5 must stop for budget 4.
function crowdedMachine() {
	const servers = [
		{ pid: 1, cwd: MAIN, cpu: 1 },
		{ pid: 2, cwd: CODEX, cpu: 1 },
		{ pid: 3, cwd: "/elsewhere/vpk-grab/apps/website", cpu: 1 },
		{ pid: 4, cwd: wt("agent"), cpu: 1 },
		{ pid: 5, cwd: wt("fresh"), cpu: 1 },
		{ pid: 6, cwd: wt("idle-2h"), cpu: 1 },
		{ pid: 7, cwd: wt("idle-9h"), cpu: 1 },
		{ pid: 8, cwd: wt("never"), cpu: 1 },
	];
	const activity = {
		[MAIN]: NOW - 10 * HOUR,
		[CODEX]: NOW - 10 * HOUR,
		[wt("agent")]: NOW - 10 * HOUR,
		[wt("fresh")]: NOW - 5 * 60_000,
		[wt("idle-2h")]: NOW - 2 * HOUR,
		[wt("idle-9h")]: NOW - 9 * HOUR,
	};
	return {
		inventory: { ...calm, servers, operators: [{ name: "claude", pid: 70, cwd: `${wt("agent")}/components` }] },
		options: {
			env: ENV,
			worktree: OWN,
			worktreeRoots: [MAIN, CODEX, wt("agent"), wt("fresh"), wt("idle-2h"), wt("idle-9h"), wt("never"), OWN],
			activityOf: (worktree) => (activity[worktree] ? { source: "dev log", mtimeMs: activity[worktree] } : null),
			now: NOW,
		},
	};
}

function runAutoStop({ inventory, options }, { budget = 4, recheck = () => null, stopStatus = () => 0, survives = () => false } = {}) {
	const evaluate = (remaining) => evaluateBudget(remaining, { ...options, budget });
	const verdict = evaluate(inventory);
	const stopped = [];
	const log = [];
	// The fake machine: a stopped stack's servers are gone unless `survives` keeps them.
	const gone = new Set();
	const result = autoStopOverBudget(verdict, {
		evaluate,
		worktree: OWN,
		env: ENV,
		now: NOW,
		log: (line) => log.push(line),
		recheck,
		stop: (stack) => {
			stopped.push(stack.worktree);
			const status = stopStatus(stack);
			if (status === 0 && !survives(stack)) for (const server of stack.servers) gone.add(server.pid);
			return status;
		},
		refresh: () => ({ ...inventory, servers: inventory.servers.filter((server) => !gone.has(server.pid)) }),
	});
	return { verdict, result, stopped, log };
}

// Regression (Codex review on #2348): a stop that exits 0 but leaves its server running must not
// count toward the budget.
test("a stop that exits 0 but leaves its server running does not count", () => {
	const machine = crowdedMachine();
	const { result, stopped, log } = runAutoStop(machine, { budget: 8, survives: (stack) => stack.worktree === wt("never") });
	assert.deepEqual(stopped, [wt("never")]);
	assert.equal(result.exitCode, EXIT_OVER_BUDGET);
	assert.match(log[0], /Could not auto-stop never .*its stop exited 0 but pid 8 still runs\./u);
	assert.match(formatVerdict(result, { worktree: OWN }), /Running dev stacks \(8\)/u);
});

test("only idle linked worktrees of this repo are candidates, idlest first", () => {
	const { inventory, options } = crowdedMachine();
	const plan = planAutoStop(evaluateBudget(inventory, options), { worktree: OWN });
	assert.deepEqual(plan.candidates.map((stack) => stack.worktree), [wt("never"), wt("idle-9h"), wt("idle-2h")]);
});

test("auto-stop stops the minimum number, then the start fits", () => {
	const machine = crowdedMachine();
	// Budget 7: 8 others + this one is 9, so exactly 2 must stop.
	const { verdict, result, stopped, log } = runAutoStop(machine, { budget: 7 });
	assert.equal(verdict.exitCode, EXIT_OVER_BUDGET);
	assert.deepEqual(stopped, [wt("never"), wt("idle-9h")]);
	assert.equal(result.exitCode, 0);
	assert.equal(result.otherStacks.length, 6);
	assert.equal(log.length, 2);
	assert.match(log[0], /^\[dev:tmux\] Auto-stopped never \(\/repo\/\.claude\/worktrees\/never\): a linked worktree of this repo with no agent, tool or attached tmux client, no recorded activity\.$/u);
	assert.match(log[1], /Auto-stopped idle-9h .*last activity 9h ago\.$/u);
});

test("never touches foreign, Codex, main-checkout or active stacks, and refuses when the safe ones are not enough", () => {
	const machine = crowdedMachine();
	// Budget 4: 5 must stop, only 3 are safe.
	const { result, stopped } = runAutoStop(machine);
	assert.deepEqual(stopped, [], "nothing stops when stopping cannot get under budget");
	assert.equal(result.exitCode, EXIT_OVER_BUDGET);
	const text = formatVerdict(result, { worktree: OWN });
	assert.match(text, /Auto-stop needs 5 stacks safe to stop and found 3, so it stopped nothing\./u);
	assert.match(text, /Running dev stacks \(8\)/u);
	assert.match(text, /Stop it: kill 3\n/u, "the foreign server keeps its PID suggestion");
	assert.match(text, /Codex worktree\. Check its thread before stopping it\./u);
});

test("a stack that turned busy just before its stop is skipped, and the next idle one stops instead", () => {
	const machine = crowdedMachine();
	const { result, stopped, log } = runAutoStop(machine, {
		budget: 8,
		recheck: (stack) => (stack.worktree === wt("never") ? "recent activity: dev log written 0s ago" : null),
	});
	assert.deepEqual(stopped, [wt("idle-9h")]);
	assert.match(log[0], /Not auto-stopping never .*in use now \(recent activity/u);
	assert.equal(result.exitCode, 0);
});

test("a failed or refused stop does not count, and a shortfall still refuses", () => {
	const machine = crowdedMachine();
	const { result, log } = runAutoStop(machine, { budget: 6, stopStatus: (stack) => (stack.worktree === wt("idle-2h") ? 6 : 0) });
	assert.equal(result.exitCode, EXIT_OVER_BUDGET);
	assert.ok(log.some((line) => /Could not auto-stop idle-2h .*exited 6/u.test(line)), log.join("\n"));
	assert.match(formatVerdict(result, { worktree: OWN }), /Auto-stopped 2 stacks, but 1 stack more must stop/u);
});

test("memory pressure that would still refuse after the stops stops nothing", () => {
	const machine = crowdedMachine();
	machine.inventory.swapUsedGb = SWAP + 5;
	const { result, stopped } = runAutoStop(machine, { budget: 8 });
	assert.deepEqual(stopped, []);
	assert.equal(result.exitCode, EXIT_OVER_BUDGET);
});

test("with no git worktree list nothing counts as a linked worktree, so nothing is auto-stopped", () => {
	const inventory = { ...calm, servers: [1, 2, 3, 4].map((index) => ({ pid: index, cwd: `/wt/${index}`, cpu: 1 })) };
	const verdict = evaluateBudget(inventory, { worktree: "/wt/new", activityOf: () => null });
	assert.equal(planAutoStop(verdict, { worktree: "/wt/new" }).candidates.length, 0);
});

// End to end through `dev-stack-budget.js check`: a real temporary git repo with linked worktrees,
// a fake inventory and a fake tmux. Each target's stop script is a stub that records how it was
// called, then runs the real stop guard, which writes dev-stops.log.
function createRepo() {
	const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dev-stack-auto-stop-")));
	const main = path.join(tempDir, "main");
	const git = (...args) => {
		const result = spawnSync("git", args, { cwd: main, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
	};
	fs.mkdirSync(main);
	git("init", "-q", "-b", "main");
	git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
	const codexHome = path.join(tempDir, "codex");
	const roots = {
		main,
		own: path.join(main, ".claude", "worktrees", "own"),
		idleA: path.join(main, ".claude", "worktrees", "idle-a"),
		idleB: path.join(main, ".claude", "worktrees", "idle-b"),
		active: path.join(main, ".claude", "worktrees", "active"),
		codex: path.join(codexHome, "worktrees", "ab12", "vpk"),
	};
	const stopCalls = path.join(tempDir, "stop-calls.log");
	const old = new Date(NOW - 10 * HOUR);
	for (const [name, root] of Object.entries(roots)) {
		if (name === "main") continue;
		git("worktree", "add", "-q", "--detach", root);
		const index = spawnSync("git", ["-C", root, "rev-parse", "--git-path", "index"], { encoding: "utf8" }).stdout.trim();
		fs.utimesSync(path.resolve(root, index), old, old);
		fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
		fs.writeFileSync(
			path.join(root, "scripts", "dev-tmux-plain.sh"),
			[
				"#!/usr/bin/env bash",
				`echo "$PWD|\${VPK_DEV_TMUX_SESSION:-}|\${VPK_TMUX_SOCKET:-}|$*" >> ${JSON.stringify(stopCalls)}`,
				`node ${JSON.stringify(path.join(__dirname, "dev-stack-activity.js"))} stop-guard --worktree "$PWD" --session "\${VPK_DEV_TMUX_SESSION:-none}" || exit $?`,
				// The guard allowed it, so the fake server under this worktree exits: drop it from the fake inventory.
				`node -e 'const fs=require("fs");const f=process.env.VPK_DEV_STACK_INVENTORY;const i=JSON.parse(fs.readFileSync(f,"utf8"));i.servers=i.servers.filter((s)=>s.cwd!==process.argv[1]);fs.writeFileSync(f,JSON.stringify(i))' "$PWD"`,
			].join("\n"),
		);
	}
	fs.utimesSync(path.join(main, ".git", "index"), old, old);
	// A dev log written a minute ago keeps the active worktree in use.
	const activeLog = path.join(roots.active, "output", "logs", "active", "dev.log");
	fs.mkdirSync(path.dirname(activeLog), { recursive: true });
	fs.writeFileSync(activeLog, "GET /\n");

	const sessionsFile = path.join(tempDir, "sessions");
	fs.writeFileSync(sessionsFile, `vpk-dev-idle-a|${roots.idleA}\nvpk-dev-idle-b|${roots.idleB}\nvpk-dev-active|${roots.active}\n`);
	const tmux = path.join(tempDir, "tmux");
	fs.writeFileSync(
		tmux,
		[
			"#!/usr/bin/env bash",
			"[[ \"$1\" == \"-L\" ]] || exit 1",
			"fmt=\"${@: -1}\"",
			"while IFS='|' read -r name p; do",
			"\tif [[ \"$fmt\" == *session_attached* ]]; then echo \"$name|$p|0\"; else echo \"$name|$p\"; fi",
			`done < ${JSON.stringify(sessionsFile)}`,
		].join("\n"),
	);
	fs.chmodSync(tmux, 0o755);
	return { tempDir, roots, codexHome, stopCalls, tmux, cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }) };
}

function check(repo, servers, extraArgs = [], extraEnv = {}) {
	const inventoryFile = path.join(repo.tempDir, `inventory-${Math.random().toString(36).slice(2)}.json`);
	fs.writeFileSync(inventoryFile, JSON.stringify({ ...calm, servers }));
	return spawnSync(process.execPath, [path.join(__dirname, "dev-stack-budget.js"), "check", "--worktree", repo.roots.own, ...extraArgs], {
		encoding: "utf8",
		env: { ...process.env, VPK_DEV_STACK_INVENTORY: inventoryFile, VPK_TMUX_BIN: repo.tmux, CODEX_HOME: repo.codexHome, VPK_DEV_NO_AUTO_STOP: "", ...extraEnv },
	});
}

test("dev-stack-budget check auto-stops through each worktree's own stop path and logs who asked", () => {
	const repo = createRepo();
	try {
		const { roots } = repo;
		const servers = [
			{ pid: 11, cwd: roots.main, cpu: 1 },
			{ pid: 12, cwd: roots.codex, cpu: 1 },
			{ pid: 13, cwd: path.join(repo.tempDir, "other-repo"), cpu: 1 },
			{ pid: 14, cwd: roots.active, cpu: 1 },
			{ pid: 15, cwd: roots.idleA, cpu: 1 },
		];
		// 5 others + this one = 6 > 4: two must stop, and only idle-a is safe, so nothing stops.
		const short = check(repo, servers);
		assert.equal(short.status, EXIT_OVER_BUDGET, short.stderr);
		assert.match(short.stderr, /found 1, so it stopped nothing/u);
		assert.equal(fs.existsSync(repo.stopCalls), false);

		// The opt-out refuses without stopping even when one stop would do.
		const withIdleB = [...servers.slice(0, 1), servers[2], servers[4], { pid: 16, cwd: roots.idleB, cpu: 1 }];
		const optedOut = check(repo, withIdleB, ["--no-auto-stop"]);
		assert.equal(optedOut.status, EXIT_OVER_BUDGET);
		assert.match(optedOut.stderr, /Auto-stop is off/u);
		const optedOutEnv = check(repo, withIdleB, [], { VPK_DEV_NO_AUTO_STOP: "1" });
		assert.equal(optedOutEnv.status, EXIT_OVER_BUDGET);
		assert.equal(fs.existsSync(repo.stopCalls), false);
		// --force starts and stops nothing.
		assert.equal(check(repo, withIdleB, ["--force"]).status, 0);
		assert.equal(fs.existsSync(repo.stopCalls), false);

		// main, other-repo, idle-a, idle-b + this one = 5 > 4: one stop. idle-a and idle-b tie on
		// activity, so the path order picks idle-a.
		const started = check(repo, withIdleB);
		assert.equal(started.status, 0, started.stderr);
		assert.match(started.stderr, new RegExp(`Auto-stopped idle-a \\(${roots.idleA.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\): a linked worktree of this repo`, "u"));
		assert.deepEqual(fs.readFileSync(repo.stopCalls, "utf8").trim().split("\n"), [`${roots.idleA}|vpk-dev-idle-a|vpk-dev|stop`]);
		const entries = fs.readFileSync(path.join(roots.idleA, "output", "logs", "idle-a", "dev-stops.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
		assert.equal(entries.length, 1);
		assert.equal(entries[0].outcome, "stopping");
		assert.equal(entries[0].by, `auto-stopped by dev:tmux:start from ${roots.own}`);
		assert.equal(entries[0].from, roots.own);
		assert.equal(entries[0].session, "vpk-dev-idle-a");
		for (const untouched of [roots.main, roots.codex, roots.active, roots.idleB]) {
			assert.equal(fs.existsSync(path.join(untouched, "output", "logs", path.basename(untouched), "dev-stops.log")), false, untouched);
		}
	} finally {
		repo.cleanup();
	}
});
