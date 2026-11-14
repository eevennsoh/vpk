"use strict";

// The commit a shrink-only baseline is compared with. CI checks out the PR merged into its
// base, so compare with the base tip there; push builds pass the pre-push tip as
// VPK_SUPPRESSIONS_BASE (see ci.yml); locally compare with the merge-base, so commits that
// landed on main after the branch was cut do not count against it.

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
		return git(["rev-parse", "--verify", "--quiet", `origin/${env.GITHUB_BASE_REF}`]);
	}
	return git(["merge-base", "HEAD", "origin/main"]);
}

// An explicitly named base must resolve: skipping would let a baseline grow unchecked.
function isBaseRequired(env = process.env) {
	return Boolean(env.GITHUB_BASE_REF || env.VPK_SUPPRESSIONS_BASE);
}

module.exports = { isBaseRequired, resolveBaseRef, runGit };
