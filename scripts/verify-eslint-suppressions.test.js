const assert = require("node:assert/strict");
const test = require("node:test");

const {
	findSuppressionGrowth,
	isBaseRequired,
	resolveBaseRef,
	totalsByRule,
} = require("./verify-eslint-suppressions.js");

const BASE = {
	"components/a.tsx": { "react-hooks/refs": { count: 2 }, "react/jsx-no-leaked-render": { count: 1 } },
	"components/b.tsx": { "react-hooks/refs": { count: 1 } },
};

test("totals are summed per rule across files", () => {
	assert.deepEqual(Object.fromEntries(totalsByRule(BASE)), {
		"react-hooks/refs": 3,
		"react/jsx-no-leaked-render": 1,
	});
});

test("fixing debt or moving a file does not count as growth", () => {
	const current = {
		"components/renamed-a.tsx": { "react-hooks/refs": { count: 2 } },
		"components/b.tsx": { "react-hooks/refs": { count: 1 } },
	};
	assert.deepEqual(findSuppressionGrowth(BASE, current), []);
});

test("a regenerated baseline that hides a new violation is reported per rule", () => {
	const current = {
		...BASE,
		"components/c.tsx": { "react-hooks/refs": { count: 1 }, "no-restricted-syntax": { count: 2 } },
	};
	assert.deepEqual(findSuppressionGrowth(BASE, current), [
		{ after: 2, before: 0, ruleId: "no-restricted-syntax" },
		{ after: 4, before: 3, ruleId: "react-hooks/refs" },
	]);
});

test("CI compares with the PR base tip; local runs use the merge-base", () => {
	const calls = [];
	const git = (args) => {
		calls.push(args.join(" "));
		return "abc123";
	};
	resolveBaseRef({ env: { GITHUB_BASE_REF: "main" }, git });
	resolveBaseRef({ env: {}, git });
	resolveBaseRef({ env: { VPK_SUPPRESSIONS_BASE: "HEAD~1" }, git });
	assert.deepEqual(calls, [
		"rev-parse --verify --quiet origin/main",
		"merge-base HEAD origin/main",
		"rev-parse --verify --quiet HEAD~1",
	]);
});

test("a push build compares with its pre-push tip and fails when that base is missing", () => {
	const calls = [];
	const git = (args) => {
		calls.push(args.join(" "));
		return null;
	};
	// ci.yml passes github.event.before; an empty value on other events must not count.
	const pushEnv = { GITHUB_EVENT_NAME: "push", VPK_SUPPRESSIONS_BASE: "0f1e2d3c" };
	assert.equal(resolveBaseRef({ env: pushEnv, git }), null);
	assert.deepEqual(calls, ["rev-parse --verify --quiet 0f1e2d3c"]);
	assert.equal(isBaseRequired(pushEnv), true);
	assert.equal(isBaseRequired({ GITHUB_BASE_REF: "main" }), true);
	assert.equal(isBaseRequired({ VPK_SUPPRESSIONS_BASE: "" }), false);
	assert.equal(isBaseRequired({}), false);
});
