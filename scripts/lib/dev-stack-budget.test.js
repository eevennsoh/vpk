const assert = require("node:assert/strict");
const test = require("node:test");

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
	assert.equal(verdict.otherStacks[0].idle, false, "one busy server makes the stack busy");
});

test("memory pressure refuses within the budget; unknown readings do not", () => {
	assert.equal(evaluateBudget({ ...calm, swapUsedGb: 16 }, { worktree: "/wt/new" }).exitCode, EXIT_OVER_BUDGET);
	assert.equal(evaluateBudget({ ...calm, pressureLevel: 4 }, { worktree: "/wt/new" }).exitCode, EXIT_OVER_BUDGET);
	assert.equal(evaluateBudget({ ...calm, pressureLevel: 2 }, { worktree: "/wt/new" }).exitCode, 0);
	assert.equal(evaluateBudget({ servers: [], swapUsedGb: null, pressureLevel: null }, { worktree: "/wt/new" }).exitCode, 0);
});

test("a server in this worktree (or below it) is a duplicate that --force does not override", () => {
	const verdict = evaluateBudget({ ...calm, servers: [{ pid: 9, cwd: "/wt/new/app", cpu: 1 }] }, { force: true, worktree: "/wt/new" });
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
	// A server started from a subdirectory of the main checkout is still the main checkout's.
	const nestedCwd = evaluateBudget({ ...calm, servers: [{ pid: 32, cwd: "/repo/app", cpu: 1 }] }, { worktree: "/repo", worktreeRoots });
	assert.equal(nestedCwd.exitCode, EXIT_DUPLICATE_SERVER);
});
