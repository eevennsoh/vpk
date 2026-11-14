"use strict";

// The commit a shrink-only baseline is compared with: the commit the change is measured
// from, so only what the change itself does counts. Push builds pass the pre-push tip as
// VPK_SUPPRESSIONS_BASE (see ci.yml). A pull_request run checks out GitHub's merge of the PR
// into its base, so HEAD^1 is the base that merge was built on and HEAD^1..HEAD is exactly
// the PR's change. Comparing with the base tip instead counted every baseline drop that
// landed on the base after that merge as a raise by the PR. A checkout of the PR head
// itself, and local runs, compare with the merge-base, so commits that landed on main after
// the branch was cut do not count against it.

const { spawnSync } = require("node:child_process");

function runGit(args, { cwd } = {}) {
	const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
	return result.status === 0 ? result.stdout.trim() : null;
}

function resolveBaseRef({ env = process.env, git = runGit } = {}) {
	if (env.VPK_SUPPRESSIONS_BASE) {
		return git(["rev-parse", "--verify", "--quiet", env.VPK_SUPPRESSIONS_BASE]);
	}
	if (env.GITHUB_BASE_REF) {
		if (git(["rev-parse", "--verify", "--quiet", "HEAD^2"])) {
			return git(["rev-parse", "--verify", "--quiet", "HEAD^1"]);
		}
		return git(["merge-base", "HEAD", `origin/${env.GITHUB_BASE_REF}`]);
	}
	return git(["merge-base", "HEAD", "origin/main"]);
}

// An explicitly named base must resolve: skipping would let a baseline grow unchecked.
function isBaseRequired(env = process.env) {
	return Boolean(env.GITHUB_BASE_REF || env.VPK_SUPPRESSIONS_BASE);
}

module.exports = { isBaseRequired, resolveBaseRef, runGit };
