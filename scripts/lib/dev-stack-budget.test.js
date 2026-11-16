const assert = require("node:assert/strict");
const test = require("node:test");
const { PRESSURE_LEVEL_MIN: LEVEL, PRESSURE_SWAP_USED_GB: SWAP } = require("./memory-pressure.js");
// Pressure fixtures follow the sweep's limits, so changing them there breaks no test.
const OVER = SWAP + 13;

const { DEV_STACK_BUDGET, EXIT_DUPLICATE_SERVER, EXIT_OVER_BUDGET, evaluateBudget, formatVerdict } = require("./dev-stack-budget.js");

const calm = { servers: [], swapUsedGb: 2, pressureLevel: 1 };
const stacks = (count) => Array.from({ length: count }, (_, index) => ({ pid: 100 + index, cwd: `/wt/${index}`, cpu: 1 }));

test("starting is allowed up to the budget and refused one past it", () => {
	assert.equal(DEV_STACK_BUDGET, 4);
	assert.equal(evaluateBudget({ ...calm, servers: stacks(3) }, { worktree: "/wt/new" }).exitCode, 0);
	const over = evaluateBudget({ ...calm, servers: stacks(4) }, { worktree: "/wt/new" });
	assert.equal(over.exitCode, EXIT_OVER_BUDGET);
	assert.equal(evaluateBudget({ ...calm, servers: stacks(4) }, { force: true, worktree: "/wt/new" }).exitCode, 0);
});

test("two servers in one other worktree count as one stack", () => {
	const servers = [...stacks(3), { pid: 200, cwd: "/wt/0", cpu: 90 }];
	const verdict = evaluateBudget({ ...calm, servers }, { worktree: "/wt/new" });
	assert.equal(verdict.exitCode, 0);
	assert.equal(verdict.otherStacks.length, 3);
	assert.equal(verdict.otherStacks[0].quiet, false, "one busy server makes the stack busy");
});

test("memory pressure refuses within the budget when another stack runs; unknown readings do not", () => {
	const other = [{ pid: 9, cwd: "/wt/other", cpu: 1 }];
	assert.equal(evaluateBudget({ ...calm, servers: other, swapUsedGb: SWAP }, { worktree: "/wt/new" }).exitCode, EXIT_OVER_BUDGET);
	assert.equal(evaluateBudget({ ...calm, servers: other, pressureLevel: LEVEL }, { worktree: "/wt/new" }).exitCode, EXIT_OVER_BUDGET);
	assert.equal(evaluateBudget({ ...calm, servers: other, pressureLevel: LEVEL - 1 }, { worktree: "/wt/new" }).exitCode, 0);
	assert.equal(evaluateBudget({ servers: other, swapUsedGb: null, pressureLevel: null }, { worktree: "/wt/new" }).exitCode, 0);
});

test("a server whose cwd is this worktree is a duplicate that --force does not override", () => {
	const verdict = evaluateBudget({ ...calm, servers: [{ pid: 9, cwd: "/wt/new", cpu: 1 }] }, { force: true, worktree: "/wt/new" });
	assert.equal(verdict.exitCode, EXIT_DUPLICATE_SERVER);
	assert.match(formatVerdict(verdict, { worktree: "/wt/new" }), /pid 9/u);
	assert.equal(evaluateBudget({ ...calm, servers: [{ pid: 9, cwd: "/wt/new-other", cpu: 1 }] }, { worktree: "/wt/new" }).exitCode, 0);
});

test("a server in a linked worktree nested inside this checkout belongs to that worktree", () => {
	// .claude/worktrees/<name> lives inside the main checkout; its server is another stack.
	const servers = [{ pid: 31, cwd: "/repo/.claude/worktrees/feature", cpu: 2 }];
	const worktreeRoots = ["/repo", "/repo/.claude/worktrees/feature"];
	const fromMain = evaluateBudget({ ...calm, servers }, { worktree: "/repo", worktreeRoots });
	assert.equal(fromMain.exitCode, 0);
	assert.deepEqual(fromMain.otherStacks.map((stack) => stack.worktree), ["/repo/.claude/worktrees/feature"]);
	const fromFeature = evaluateBudget({ ...calm, servers }, { worktree: "/repo/.claude/worktrees/feature", worktreeRoots });
	assert.equal(fromFeature.exitCode, EXIT_DUPLICATE_SERVER);
	// Only a server whose cwd is exactly the root is a duplicate of it.
	const exact = evaluateBudget({ ...calm, servers: [{ pid: 33, cwd: "/repo", cpu: 1 }] }, { worktree: "/repo", worktreeRoots });
	assert.equal(exact.exitCode, EXIT_DUPLICATE_SERVER);
	const below = evaluateBudget({ ...calm, servers: [{ pid: 32, cwd: "/repo/somewhere/else", cpu: 1 }] }, { worktree: "/repo", worktreeRoots });
	assert.equal(below.exitCode, 0);
});

test("each other stack is labelled by evidence of a live task, not by CPU", () => {
	const worktreeRoots = ["/main", "/wt/attached", "/wt/operated", "/wt/free", "/home/me/.codex/worktrees/ab12/vpk"];
	const inventory = {
		...calm,
		servers: [
			{ pid: 1, cwd: "/main", cpu: 1 },
			{ pid: 2, cwd: "/wt/attached", cpu: 1 },
			{ pid: 3, cwd: "/wt/operated", cpu: 1 },
			{ pid: 4, cwd: "/wt/free", cpu: 150 },
			{ pid: 5, cwd: "/home/me/.codex/worktrees/ab12/vpk", cpu: 1 },
		],
		sessions: [{ name: "vpk-dev-attached", path: "/wt/attached", attached: true }, { name: "vpk-dev-free", path: "/wt/free", attached: false }],
		operators: [{ name: "claude", pid: 77, cwd: "/wt/operated/components" }],
	};
	const verdict = evaluateBudget(inventory, { env: { HOME: "/home/me" }, worktree: "/wt/new", worktreeRoots });
	assert.equal(verdict.exitCode, EXIT_OVER_BUDGET);
	const text = formatVerdict(verdict, { worktree: "/wt/new" });
	assert.match(text, /\(quiet · pid 1 1%\)\n {5}\/main\n {5}In use: the primary checkout\. Leave it running\./u);
	assert.match(text, /\/wt\/attached\n {5}In use: a tmux client is attached to vpk-dev-attached\. Leave it running\./u);
	assert.match(text, /\/wt\/operated\n {5}In use: claude pid 77 has its cwd here\. Leave it running\./u);
	assert.match(text, /free {2}\(busy · pid 4 150%\)\n {5}\/wt\/free\n {5}No live task seen\.\n {5}Stop it: pnpm ports kill '\/wt\/free'/u);
	assert.match(text, /\/home\/me\/\.codex\/worktrees\/ab12\/vpk\n {5}Codex worktree\. Check its thread before stopping it\./u);
	assert.equal((text.match(/Stop it: /gu) ?? []).length, 1, "a stop command only for the stack with no live task");
	assert.doesNotMatch(text, /\bidle\b/u);
});

test("memory pressure with no other stack warns and starts; with one it refuses", () => {
	const alone = evaluateBudget({ ...calm, swapUsedGb: OVER }, { worktree: "/wt/new" });
	assert.equal(alone.exitCode, 0);
	assert.match(formatVerdict(alone, { worktree: "/wt/new" }), new RegExp(`Warning: memory pressure \\(swap in use is ${OVER} GB >= ${SWAP} GB\\), but no other dev stack runs; starting`, "u"));
	const crowded = evaluateBudget({ ...calm, swapUsedGb: OVER, servers: [{ pid: 9, cwd: "/wt/other", cpu: 1 }] }, { worktree: "/wt/new" });
	assert.equal(crowded.exitCode, EXIT_OVER_BUDGET);
});

// Regression: a workflow subagent's process keeps its cwd in the main checkout, so its worktree's
// stack showed "no live task seen" with a stop command while the agent was mid-task.
test("a stack with recent activity is in use even with no agent process in it, and gets no stop command", () => {
	const now = Date.parse("2026-11-16T10:00:00Z");
	const activity = { "/wt/busy-agent": { source: "dev log", mtimeMs: now - 4 * 60_000 }, "/wt/stale": { source: "dev log", mtimeMs: now - 3 * 3600_000 } };
	const verdict = evaluateBudget(
		{ ...calm, servers: [{ pid: 1, cwd: "/wt/busy-agent", cpu: 1 }, { pid: 2, cwd: "/wt/stale", cpu: 1 }, ...stacks(3)] },
		{ worktree: "/wt/new", activityOf: (worktree) => activity[worktree] ?? null, now },
	);
	const text = formatVerdict(verdict, { worktree: "/wt/new" });
	assert.match(text, /\/wt\/busy-agent\n {5}In use: recent activity: dev log written 4m ago\. Leave it running\./u);
	assert.match(text, /\/wt\/stale\n {5}No live task seen\.\n {5}Stop it: pnpm ports kill '\/wt\/stale'/u);
});

// Regression: the budget listed a sibling repo's next-server (vpk-grab's docs site) with
// "stop: pnpm ports kill '<its path>'", which fails because that path is not a worktree here.
test("a stack outside this repo's worktrees gets a PID stop command, not pnpm ports kill", () => {
	const worktreeRoots = ["/repo", "/repo/.claude/worktrees/a", "/repo/.claude/worktrees/b", "/repo/.claude/worktrees/c"];
	const verdict = evaluateBudget(
		{ ...calm, servers: [
			{ pid: 11, cwd: "/repo/.claude/worktrees/a", cpu: 1 },
			{ pid: 12, cwd: "/repo/.claude/worktrees/b", cpu: 1 },
			{ pid: 13, cwd: "/repo/.claude/worktrees/c", cpu: 1 },
			{ pid: 14, cwd: "/elsewhere/vpk-grab/apps/website", cpu: 30 },
		] },
		{ worktree: "/repo/.claude/worktrees/new", worktreeRoots, activityOf: () => null },
	);
	assert.equal(verdict.exitCode, EXIT_OVER_BUDGET);
	const text = formatVerdict(verdict, { worktree: "/repo/.claude/worktrees/new" });
	assert.match(text, /\/elsewhere\/vpk-grab\/apps\/website\n {5}Not a worktree of this repo, so `pnpm ports kill` can't stop it\.\n {5}Stop it: kill 14/u);
	assert.doesNotMatch(text, /pnpm ports kill '\/elsewhere/u);
	assert.match(text, /Stop it: pnpm ports kill '\/repo\/\.claude\/worktrees\/a'/u);
});

test("each listed stack is its own numbered block with its path on a separate line", () => {
	const verdict = evaluateBudget({ ...calm, servers: stacks(4) }, { worktree: "/wt/new", activityOf: () => null });
	const text = formatVerdict(verdict, { worktree: "/wt/new" });
	assert.match(text, /Running dev stacks \(4\)/u);
	assert.match(text, /\n {2}1\. 0 {2}\(quiet · pid 100 1%\)\n {5}\/wt\/0\n/u);
	assert.match(text, /\n\n {2}2\. 1 /u, "a blank line separates stacks");
});
