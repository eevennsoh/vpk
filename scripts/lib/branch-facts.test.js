"use strict";

// The git plumbing behind branch-landing, against a real throwaway repository and its
// bare "origin" (no network, no gh: PR records are passed in as data).

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { deriveBranchLanding } = require("./branch-landing");
const { collectBranchFacts, createGit, createRunner } = require("./branch-facts");

function setup(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "branch-facts-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const env = {
		PATH: process.env.PATH,
		HOME: root,
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_AUTHOR_NAME: "Test",
		GIT_AUTHOR_EMAIL: "test@example.com",
		GIT_COMMITTER_NAME: "Test",
		GIT_COMMITTER_EMAIL: "test@example.com",
	};
	const origin = path.join(root, "origin.git");
	const clone = path.join(root, "clone");
	const sh = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
	sh(root, "init", "--quiet", "--bare", "--initial-branch=main", origin);
	sh(root, "clone", "--quiet", origin, clone);
	const commit = (file, text) => {
		fs.writeFileSync(path.join(clone, file), text);
		sh(clone, "add", file);
		sh(clone, "commit", "--quiet", "-m", `${file}: ${text}`);
		return sh(clone, "rev-parse", "HEAD");
	};
	commit("README", "base");
	sh(clone, "push", "--quiet", "origin", "main");
	sh(clone, "remote", "set-head", "origin", "main");
	const git = createGit(createRunner({ timeoutMs: 10_000, env }), clone);
	return { clone, commit, git, sh };
}

const facts = (git, overrides) => collectBranchFacts({ git, defaultBranch: "main", localBranchExists: true, prs: [], ...overrides });

test("unpushed, pushed, squash-merged with local main behind, synced, and commits past the merge", async (t) => {
	const { clone, commit, git, sh } = setup(t);
	const worktree = { path: clone, branch: "feature" };
	sh(clone, "checkout", "--quiet", "-b", "feature");
	const featureHead = commit("feature.txt", "one");

	let derived = deriveBranchLanding(await facts(git, { branch: "feature", worktree }));
	assert.equal(derived.status, "committed");
	assert.match(derived.nextAction, /not on the remote/u);

	fs.writeFileSync(path.join(clone, "scratch.txt"), "untracked");
	assert.equal(deriveBranchLanding(await facts(git, { branch: "feature", worktree })).status, "dirty");
	fs.rmSync(path.join(clone, "scratch.txt"));

	sh(clone, "push", "--quiet", "-u", "origin", "feature");
	assert.equal(deriveBranchLanding(await facts(git, { branch: "feature", worktree })).status, "pushed");

	// Squash-merge on origin's main from a detached checkout; the local main stays behind.
	const base = sh(clone, "rev-parse", "main");
	sh(clone, "checkout", "--quiet", "--detach", "origin/main");
	sh(clone, "merge", "--quiet", "--squash", "feature");
	sh(clone, "commit", "--quiet", "-m", "Squash feature (#7)");
	const squash = sh(clone, "rev-parse", "HEAD");
	sh(clone, "push", "--quiet", "origin", "HEAD:main");
	sh(clone, "fetch", "--quiet", "origin");
	sh(clone, "checkout", "--quiet", "feature");
	assert.equal(sh(clone, "rev-parse", "main"), base);

	const pr = { number: 7, state: "MERGED", headRefOid: featureHead, baseRefName: "main", createdAt: "2026-11-13T01:00:00Z", mergedAt: "2026-11-13T02:00:00Z", mergeCommit: { oid: squash } };
	const merged = await facts(git, { branch: "feature", worktree, prs: [pr] });
	assert.equal(merged.inOriginDefault, false, "a squash is not an ancestor");
	derived = deriveBranchLanding(merged);
	assert.equal(derived.status, "merged");
	assert.match(derived.nextAction, /^sync main/u);
	assert.equal(derived.evidence.proof, "merged-pr");

	sh(clone, "update-ref", "refs/heads/main", squash);
	derived = deriveBranchLanding(await facts(git, { branch: "feature", worktree, prs: [pr] }));
	assert.equal(derived.status, "main-synced");

	// A commit past the merged PR's head is not landed.
	commit("feature.txt", "two");
	const past = await facts(git, { branch: "feature", worktree, prs: [pr] });
	assert.equal(past.commitsPastPrHead[7], 1);
	derived = deriveBranchLanding(past);
	assert.equal(derived.status, "committed");
	assert.equal(derived.evidence.landed, false);
});

test("a merge-commit landing is proven by ancestry; a deleted branch with a synced main is cleaned", async (t) => {
	const { clone, commit, git, sh } = setup(t);
	sh(clone, "checkout", "--quiet", "-b", "topic");
	const topicHead = commit("topic.txt", "one");
	sh(clone, "push", "--quiet", "-u", "origin", "topic");
	sh(clone, "checkout", "--quiet", "main");
	sh(clone, "merge", "--quiet", "--no-ff", "-m", "Merge topic", "topic");
	sh(clone, "push", "--quiet", "origin", "main");
	sh(clone, "fetch", "--quiet", "origin");

	const landed = await facts(git, { branch: "topic" });
	assert.equal(landed.inOriginDefault, true);
	assert.equal(deriveBranchLanding(landed).status, "main-synced");

	sh(clone, "branch", "--quiet", "-D", "topic");
	const pr = { number: 9, state: "MERGED", headRefOid: topicHead, baseRefName: "main", createdAt: "2026-11-13T01:00:00Z", mergedAt: "2026-11-13T02:00:00Z", mergeCommit: { oid: sh(clone, "rev-parse", "main") } };
	const gone = await facts(git, { branch: "topic", localBranchExists: false, prs: [pr] });
	assert.equal(deriveBranchLanding(gone).status, "cleaned");
});

test("a merge commit's own changes are not proven by patch equivalence (git cherry skips merges)", async (t) => {
	const { clone, commit, git, sh } = setup(t);
	commit("shared.txt", "base");
	sh(clone, "push", "--quiet", "origin", "main");
	const base = sh(clone, "rev-parse", "HEAD");
	// Two branches change the same line.
	sh(clone, "checkout", "--quiet", "-b", "left", base);
	commit("shared.txt", "left");
	sh(clone, "checkout", "--quiet", "-b", "right", base);
	commit("shared.txt", "right");
	const resolve = (text, message) => {
		fs.writeFileSync(path.join(clone, "shared.txt"), text);
		sh(clone, "add", "shared.txt");
		sh(clone, "commit", "--quiet", "-m", message);
	};
	const mergeBoth = (resolution) => {
		sh(clone, "merge", "--quiet", "--no-ff", "-m", "merge left", "left");
		try {
			sh(clone, "merge", "--quiet", "--no-ff", "-m", "merge right", "right");
		} catch {
			resolve(resolution, "merge right");
		}
	};
	// main resolves the conflict one way, the feature branch another.
	sh(clone, "checkout", "--quiet", "main");
	mergeBoth("main's resolution");
	sh(clone, "push", "--quiet", "origin", "main");
	sh(clone, "checkout", "--quiet", "-b", "feature", base);
	mergeBoth("feature's resolution");
	sh(clone, "push", "--quiet", "-u", "origin", "feature");
	sh(clone, "fetch", "--quiet", "origin");
	assert.equal(sh(clone, "cherry", "origin/main", "feature"), "", "git cherry sees nothing to land");

	const result = await facts(git, { branch: "feature", worktree: { path: clone, branch: "feature" } });
	assert.equal(result.patchEquivalent, false);
	const derived = deriveBranchLanding(result);
	assert.equal(derived.evidence.landed, false);
	assert.equal(derived.status, "pushed");
});

test("a branch that merged main into itself and adds nothing more is landed by content", async (t) => {
	const { clone, commit, git, sh } = setup(t);
	sh(clone, "checkout", "--quiet", "-b", "feature");
	commit("feature.txt", "work");
	sh(clone, "push", "--quiet", "-u", "origin", "feature");
	// main moves on, the feature branch merges it in, then main takes the feature's change.
	sh(clone, "checkout", "--quiet", "main");
	commit("main.txt", "other work");
	sh(clone, "push", "--quiet", "origin", "main");
	sh(clone, "checkout", "--quiet", "feature");
	sh(clone, "merge", "--quiet", "--no-ff", "-m", "merge main", "main");
	sh(clone, "push", "--quiet", "origin", "feature");
	sh(clone, "checkout", "--quiet", "main");
	fs.writeFileSync(path.join(clone, "feature.txt"), "work");
	sh(clone, "add", "feature.txt");
	sh(clone, "commit", "--quiet", "-m", "land the feature by hand");
	sh(clone, "push", "--quiet", "origin", "main");
	sh(clone, "fetch", "--quiet", "origin");
	sh(clone, "checkout", "--quiet", "feature");

	const result = await facts(git, { branch: "feature", worktree: { path: clone, branch: "feature" } });
	assert.equal(result.inOriginDefault, false);
	assert.equal(result.patchEquivalent, true);
	const derived = deriveBranchLanding(result);
	assert.equal(derived.evidence.proof, "patch-equivalent");
	assert.equal(derived.status, "main-synced");
});
