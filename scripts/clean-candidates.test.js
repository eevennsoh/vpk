"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { cleanBlockers } = require("./clean-candidates");

const synced = (evidence = {}) => ({ status: "main-synced", nextAction: "clean up", evidence: { openPrs: [], ...evidence } });
const target = { branch: "feature", worktree: { path: "/w/feature" } };
const where = { defaultBranch: "main", currentPath: "/w/current", mainCheckoutPath: "/w/main" };

test("a landed branch is retained while any open PR owns it, not only the latest PR", () => {
	assert.deepEqual(cleanBlockers({ derived: synced(), target, ...where }), []);
	assert.deepEqual(cleanBlockers({ derived: synced({ openPrs: [41], pr: { number: 42, state: "MERGED" } }), target, ...where }), ["open PR #41"]);
});

test("a landed branch is retained when its pull requests could not be read", () => {
	assert.deepEqual(cleanBlockers({ derived: synced({ openPrs: null }), target, ...where }), ["pull requests could not be read in full"]);
	// A detached worktree has no branch for a PR to own.
	assert.deepEqual(cleanBlockers({ derived: synced({ openPrs: null }), target: { branch: null, worktree: { path: "/w/detached" } }, ...where }), []);
});

test("the default branch, the main checkout and the current worktree are always retained", () => {
	assert.deepEqual(cleanBlockers({ derived: synced(), target: { branch: "main", worktree: { path: "/w/main" } }, ...where }), ["default branch", "persistent main checkout"]);
	assert.deepEqual(cleanBlockers({ derived: synced(), target: { branch: "x", worktree: { path: "/w/current" } }, ...where }), ["current worktree"]);
});
