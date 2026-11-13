"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	BRANCH_LANDING_STATUSES,
	deriveBranchLanding,
	mergedPrLanding,
	provenLanded,
} = require("./branch-landing");

const HEAD = "a".repeat(40);
const PR_HEAD = "b".repeat(40);

// A clean, pushed branch with one commit ahead of main and no PR.
function facts(overrides = {}) {
	return {
		branch: "sm-bt-5-branch-landing",
		head: HEAD,
		defaultBranch: "main",
		localBranchExists: true,
		worktree: { path: "/repo/.claude/worktrees/x", dirty: false },
		pushed: true,
		unpushed: 0,
		inOriginDefault: false,
		contentLanded: false,
		prs: [],
		commitsPastPrHead: {},
		gate: null,
		landingInLocalDefault: null,
		...overrides,
	};
}

const openPr = { number: 7, state: "OPEN", headRefOid: HEAD, baseRefName: "main", createdAt: "2026-11-13T01:00:00Z" };
const mergedPr = { number: 7, state: "MERGED", headRefOid: HEAD, baseRefName: "main", createdAt: "2026-11-13T01:00:00Z", mergedAt: "2026-11-13T02:00:00Z", mergeCommit: { oid: "c".repeat(40) } };
const passingGate = { isDraft: false, checks: "passing", failingChecks: [], reviewGateClear: true };

test("statuses are listed in landing order", () => {
	assert.deepEqual(BRANCH_LANDING_STATUSES, ["dirty", "committed", "pushed", "pr-open", "checks", "review-clear", "merged", "main-synced", "cleaned"]);
});

test("one row per status", () => {
	const rows = [
		["dirty", facts({ worktree: { path: "/w", dirty: true } }), /^commit or stash the changes in \/w$/u],
		["committed", facts({ pushed: false }), /^push a branch that is not on the remote$/u],
		["committed", facts({ unpushed: 2 }), /^push 2 unpushed commit\(s\)$/u],
		["pushed", facts(), /^open a PR$/u],
		["pr-open", facts({ prs: [openPr], gate: { ...passingGate, checks: "pending" } }), /^wait for the checks on #7 \(pending\)$/u],
		["pr-open", facts({ prs: [openPr], gate: { ...passingGate, checks: "failing", failingChecks: ["Unit shard 2/4"] } }), /^fix the failing checks on #7: Unit shard 2\/4$/u],
		["pr-open", facts({ prs: [openPr], gate: { ...passingGate, isDraft: true } }), /^mark #7 ready for review$/u],
		["pr-open", facts({ prs: [openPr], gate: null }), /review-gate-status\.js --pr 7$/u],
		["checks", facts({ prs: [openPr], gate: { ...passingGate, reviewGateClear: false } }), /^resolve the review conversations on #7$/u],
		["review-clear", facts({ prs: [openPr], gate: passingGate }), new RegExp(`merge-remote\\.js --pr 7 --head ${HEAD}$`, "u")],
		["merged", facts({ prs: [mergedPr], commitsPastPrHead: { 7: 0 }, landingInLocalDefault: false }), /^sync main: git fetch origin main:main/u],
		["main-synced", facts({ prs: [mergedPr], commitsPastPrHead: { 7: 0 }, landingInLocalDefault: true }), /^clean up with vpk-git-clean/u],
		["cleaned", facts({ localBranchExists: false, worktree: null, prs: [mergedPr], commitsPastPrHead: { 7: 0 }, landingInLocalDefault: true }), /^none$/u],
	];
	for (const [status, input, nextAction] of rows) {
		const derived = deriveBranchLanding(input);
		assert.equal(derived.status, status, JSON.stringify(derived));
		assert.match(derived.nextAction, nextAction, `${status}: ${derived.nextAction}`);
	}
});

test("a PR that merged while the local main is behind is merged, with 'sync main' next", () => {
	const derived = deriveBranchLanding(facts({ prs: [mergedPr], commitsPastPrHead: { 7: 0 }, landingInLocalDefault: false }));
	assert.equal(derived.status, "merged");
	assert.match(derived.nextAction, /^sync main/u);
	assert.equal(derived.evidence.landed, true);
	assert.equal(derived.evidence.proof, "merged-pr");
	assert.equal(derived.evidence.landedBy, 7);
	assert.equal(derived.evidence.exactHead, true);
});

test("unpushed commits on top of a merged PR are not landed", () => {
	const derived = deriveBranchLanding(facts({ prs: [mergedPr], commitsPastPrHead: { 7: 2 }, unpushed: 2, landingInLocalDefault: true }));
	assert.equal(derived.status, "committed");
	assert.equal(derived.evidence.landed, false);
	assert.match(derived.nextAction, /^push 2 unpushed commit\(s\) \(#7 merged; these commits came after it\)$/u);

	const pushedPastMerge = deriveBranchLanding(facts({ prs: [mergedPr], commitsPastPrHead: { 7: 2 } }));
	assert.equal(pushedPastMerge.status, "pushed");
	assert.match(pushedPastMerge.nextAction, /^open a PR \(#7 merged; these commits came after it\)$/u);
});

test("evidence lists every open PR, and none known when PRs could not be read", () => {
	const older = { ...openPr, number: 6, createdAt: "2026-11-12T01:00:00Z" };
	assert.deepEqual(deriveBranchLanding(facts({ inOriginDefault: true, landingInLocalDefault: true, prs: [older, mergedPr] })).evidence.openPrs, [6]);
	assert.equal(deriveBranchLanding(facts({ inOriginDefault: true, landingInLocalDefault: true, prs: null })).evidence.openPrs, null);
});

test("a dirty worktree on a landed branch is dirty, not cleanable", () => {
	const derived = deriveBranchLanding(facts({ worktree: { path: "/w", dirty: true }, inOriginDefault: true, landingInLocalDefault: true }));
	assert.equal(derived.status, "dirty");
	assert.equal(derived.evidence.landed, true);
});

test("a PR closed unmerged is pushed, with reopen next", () => {
	const derived = deriveBranchLanding(facts({ prs: [{ ...openPr, state: "CLOSED" }] }));
	assert.equal(derived.status, "pushed");
	assert.match(derived.nextAction, /^#7 was closed unmerged/u);
});

test("an open PR with local commits not yet pushed asks for the push first", () => {
	const derived = deriveBranchLanding(facts({ prs: [openPr], unpushed: 1, gate: passingGate }));
	assert.equal(derived.status, "committed");
});

test("failed reads are unknown, never a status that permits cleanup", () => {
	const unknowns = [
		facts({ worktree: { path: "/w", dirty: null } }),
		facts({ inOriginDefault: null }),
		facts({ prs: null }),
		facts({ contentLanded: null }),
		facts({ prs: [mergedPr], commitsPastPrHead: { 7: null } }),
		facts({ prs: [{ ...mergedPr, baseRefName: undefined }], commitsPastPrHead: { 7: 0 } }),
		facts({ inOriginDefault: true, landingInLocalDefault: null }),
		facts({ inOriginDefault: true, landingInLocalDefault: true, localBranchExists: null }),
		facts({ pushed: null }),
		facts({ unpushed: null }),
	];
	for (const input of unknowns) {
		assert.equal(deriveBranchLanding(input).status, "unknown", JSON.stringify(input));
	}
});

test("proven landed: ancestry, merged PR (squash or merge commit), patch equivalence", () => {
	// Merge commit or fast-forward: the head is on origin/main.
	assert.deepEqual(provenLanded(facts({ inOriginDefault: true })), { landed: true, proof: "ancestry", pr: null, exactHead: null, missing: [] });
	// Squash: not an ancestor, but the merged PR carried every commit.
	assert.equal(provenLanded(facts({ prs: [mergedPr], commitsPastPrHead: { 7: 0 } })).proof, "merged-pr");
	// The local tip trails the PR head (more commits were pushed from elsewhere): landed, not an exact head.
	const behind = provenLanded(facts({ prs: [{ ...mergedPr, headRefOid: PR_HEAD }], commitsPastPrHead: { 7: 0 } }));
	assert.deepEqual([behind.landed, behind.exactHead], [true, false]);
	// Recreated commits: every patch is already on main.
	assert.equal(provenLanded(facts({ contentLanded: true })).proof, "content");
	// Merged into another base proves nothing about main.
	assert.equal(provenLanded(facts({ prs: [{ ...mergedPr, baseRefName: "release" }], commitsPastPrHead: { 7: 0 } })).landed, false);
	// The latest PR is open but an older merged one carried every commit: landed.
	assert.equal(provenLanded(facts({ prs: [mergedPr, { ...openPr, number: 8, createdAt: "2026-11-13T03:00:00Z" }], commitsPastPrHead: { 7: 0 } })).landed, true);
	assert.deepEqual(provenLanded(facts()), { landed: false, proof: null, pr: null, exactHead: null, missing: [] });
});

test("mergedPrLanding needs a merged PR into the default branch and no commits past its head", () => {
	const options = { defaultBranch: "main", commitsPastHead: 0 };
	assert.deepEqual(mergedPrLanding(mergedPr, options), { landed: true });
	assert.deepEqual(mergedPrLanding(openPr, options), { landed: false });
	assert.deepEqual(mergedPrLanding(mergedPr, { ...options, commitsPastHead: 1 }), { landed: false });
	assert.deepEqual(mergedPrLanding(mergedPr, { ...options, commitsPastHead: null }), { landed: null, missing: "commits past #7" });
	// A PR record without its base branch proves nothing.
	const { baseRefName: _base, ...noBase } = mergedPr;
	assert.deepEqual(mergedPrLanding(noBase, options), { landed: null, missing: "base branch of #7" });
	assert.deepEqual(mergedPrLanding(noBase, { ...options, commitsPastHead: 2 }), { landed: false });
	assert.deepEqual(mergedPrLanding({ ...mergedPr, baseRefName: "release" }, options), { landed: false });
});
