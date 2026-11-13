const assert = require("node:assert/strict");
const test = require("node:test");

const { DEV_STACK_BUDGET, EXIT_DUPLICATE_SERVER, EXIT_OVER_BUDGET, evaluateBudget, formatVerdict, parseSwapUsedGb } = require("./dev-stack-budget.js");

const calm = { servers: [], swapUsedGb: 2, pressureLevel: 1 };
const stacks = (count) => Array.from({ length: count }, (_, index) => ({ pid: 100 + index, cwd: `/wt/${index}`, cpu: 1 }));

test("parses swap in use from sysctl vm.swapusage", () => {
	assert.equal(parseSwapUsedGb("total = 38912.00M  used = 37580.80M  free = 1331.20M  (encrypted)"), 36);
	assert.equal(parseSwapUsedGb("total = 6144.00M  used = 0.00M  free = 6144.00M"), 0);
	assert.equal(parseSwapUsedGb("vm.swapusage: unknown"), null);
});

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
	assert.equal(evaluateBudget({ ...calm, servers: other, swapUsedGb: 16 }, { worktree: "/wt/new" }).exitCode, EXIT_OVER_BUDGET);
	assert.equal(evaluateBudget({ ...calm, servers: other, pressureLevel: 4 }, { worktree: "/wt/new" }).exitCode, EXIT_OVER_BUDGET);
	assert.equal(evaluateBudget({ ...calm, servers: other, pressureLevel: 2 }, { worktree: "/wt/new" }).exitCode, 0);
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
	assert.match(text, /quiet {2}\/main .*\n {8}in use: the primary checkout; leave it running/u);
	assert.match(text, /quiet {2}\/wt\/attached .*\n {8}in use: a tmux client is attached to vpk-dev-attached; leave it running/u);
	assert.match(text, /quiet {2}\/wt\/operated .*\n {8}in use: claude pid 77 has its cwd here; leave it running/u);
	assert.match(text, /busy {3}\/wt\/free .*\n {8}no live task seen; stop: \(cd '\/wt\/free' && pnpm run dev:tmux:stop\)/u);
	assert.match(text, /quiet {2}\/home\/me\/\.codex\/worktrees\/ab12\/vpk .*\n {8}Codex worktree: check its thread before stopping/u);
	assert.equal((text.match(/stop: \(cd/gu) ?? []).length, 1, "a stop command only for the stack with no live task");
	assert.doesNotMatch(text, /\bidle\b/u);
});

test("memory pressure with no other stack warns and starts; with one it refuses", () => {
	const alone = evaluateBudget({ ...calm, swapUsedGb: 29 }, { worktree: "/wt/new" });
	assert.equal(alone.exitCode, 0);
	assert.match(formatVerdict(alone, { worktree: "/wt/new" }), /Warning: memory pressure \(swap in use is 29 GB >= 16 GB\), but no other dev stack runs; starting/u);
	const crowded = evaluateBudget({ ...calm, swapUsedGb: 29, servers: [{ pid: 9, cwd: "/wt/other", cpu: 1 }] }, { worktree: "/wt/new" });
	assert.equal(crowded.exitCode, EXIT_OVER_BUDGET);
});
