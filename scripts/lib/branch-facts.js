"use strict";

// Reads the git and gh facts that scripts/lib/branch-landing.js derives a status from.
// Read-only: git plumbing that reads refs and objects, `git status`, and gh queries. It
// never fetches unless asked (`fetch: true` runs `git fetch origin <default>`, which only
// moves remote-tracking refs), and never writes a ref, a worktree, or the index of
// another checkout. A command that fails yields null, which the derivation reads as
// unknown.

const { createRunner, fetchPullRequests, parseWorktreeList } = require("../vpk-remote-status");
const { provenLanded } = require("./branch-landing");

const GH_TIMEOUT_MS = 15_000;
const PR_BATCH_SIZE = 40;

function trimmed(result) {
	return result.ok ? result.stdout.trim() : null;
}

// Exit 0 → true, exit 1 → false, anything else (a missing ref, a timeout) → null.
function exitAnswer(result) {
	if (result.code === 0) return true;
	if (result.code === 1) return false;
	return null;
}

function countOrNull(result) {
	if (!result.ok) return null;
	const value = Number.parseInt(result.stdout.trim(), 10);
	return Number.isInteger(value) ? value : null;
}

async function resolveDefaultBranch(git) {
	const ref = trimmed(await git(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]));
	return ref ? ref.replace(/^refs\/remotes\/origin\//u, "") : "main";
}

async function listWorktrees(git) {
	const result = await git(["worktree", "list", "--porcelain"]);
	return result.ok ? parseWorktreeList(result.stdout).filter((entry) => !entry.bare) : null;
}

async function listLocalBranches(git) {
	const result = await git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
	return result.ok ? result.stdout.split("\n").map((line) => line.trim()).filter(Boolean) : null;
}

// PRs for each branch, in batches so one GraphQL query stays small. null when gh failed.
async function readPullRequests(runCommand, cwd, branches) {
	const byBranch = new Map();
	for (let index = 0; index < branches.length; index += PR_BATCH_SIZE) {
		const batch = branches.slice(index, index + PR_BATCH_SIZE);
		const prs = await fetchPullRequests(runCommand, cwd, batch, { timeoutMs: GH_TIMEOUT_MS });
		if (prs === null) return null;
		for (const [branch, nodes] of prs) byBranch.set(branch, nodes);
	}
	return byBranch;
}

async function objectExists(git, oid) {
	if (!oid) return false;
	return (await git(["cat-file", "-e", `${oid}^{commit}`])).code === 0;
}

// Every commit's patch is on the target and no merge commit (which git cherry ignores) is
// ahead of it. null when either read failed.
function patchEquivalence(cherry, mergesAhead) {
	if (!cherry?.ok || mergesAhead === null || mergesAhead === undefined) return null;
	return mergesAhead === 0 && !/^\+ /mu.test(cherry.stdout);
}

// Does the local default branch hold the commit (or the patches) that landed the work?
async function landingInLocalDefault(git, { landing, ref, prs, defaultBranch }) {
	const localDefault = `refs/heads/${defaultBranch}`;
	const hasLocalDefault = exitAnswer(await git(["show-ref", "--verify", "--quiet", localDefault]));
	if (hasLocalDefault !== true) return hasLocalDefault;
	if (landing.proof === "ancestry") return exitAnswer(await git(["merge-base", "--is-ancestor", ref, localDefault]));
	if (landing.proof === "merged-pr") {
		const oid = prs.find((pr) => pr.number === landing.pr)?.mergeCommit?.oid;
		// A merge commit this clone has never fetched cannot be in its local default branch.
		if (!(await objectExists(git, oid))) return oid ? false : null;
		return exitAnswer(await git(["merge-base", "--is-ancestor", oid, localDefault]));
	}
	const [cherry, mergesAhead] = await Promise.all([
		git(["cherry", localDefault, ref]),
		git(["rev-list", "--merges", "--count", `${localDefault}..${ref}`]).then(countOrNull),
	]);
	return patchEquivalence(cherry, mergesAhead);
}

/**
 * Facts for one branch (or one detached worktree). `prs` is this branch's PR list, or
 * null when gh failed. `worktree` is its `git worktree list` entry, or null.
 */
async function collectBranchFacts({ git, branch, worktree = null, defaultBranch, prs, localBranchExists, gate = null }) {
	const prList = prs ?? [];
	const latestPrHead = [...prList].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0))[0]?.headRefOid ?? null;
	// A deleted branch is judged by its PR's head.
	const ref = localBranchExists ? `refs/heads/${branch}` : worktree?.head ?? latestPrHead;
	const head = ref ? trimmed(await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])) : null;
	const originDefault = `refs/remotes/origin/${defaultBranch}`;
	const remoteRef = branch ? `refs/remotes/origin/${branch}` : null;

	const [status, pushed, inOriginDefault, cherry, mergesAhead] = await Promise.all([
		worktree ? git(["-C", worktree.path, "status", "--porcelain=v1", "--untracked-files=all"]) : null,
		remoteRef ? git(["show-ref", "--verify", "--quiet", remoteRef]).then(exitAnswer) : false,
		head ? git(["merge-base", "--is-ancestor", head, originDefault]).then(exitAnswer) : null,
		head ? git(["cherry", originDefault, head]) : null,
		// git cherry skips merge commits, so a merge's own changes (a conflict resolution)
		// cannot be proven by patch equivalence.
		head ? git(["rev-list", "--merges", "--count", `${originDefault}..${head}`]).then(countOrNull) : null,
	]);
	// Commits not on the remote branch; irrelevant (0) when there is no remote branch.
	const unpushed = pushed && head ? countOrNull(await git(["rev-list", "--count", `${remoteRef}..${head}`])) : pushed === false ? 0 : null;

	const commitsPastPrHead = {};
	await Promise.all(prList.filter((pr) => pr.state === "MERGED").map(async (pr) => {
		if (!localBranchExists && !worktree) {
			commitsPastPrHead[pr.number] = 0;
			return;
		}
		commitsPastPrHead[pr.number] = head && (await objectExists(git, pr.headRefOid))
			? countOrNull(await git(["rev-list", "--count", `${pr.headRefOid}..${head}`]))
			: null;
	}));

	const facts = {
		branch,
		head,
		defaultBranch,
		localBranchExists,
		worktree: worktree ? { path: worktree.path, dirty: status.ok ? status.stdout.trim().length > 0 : null } : null,
		pushed,
		unpushed,
		inOriginDefault,
		patchEquivalent: patchEquivalence(cherry, mergesAhead),
		prs,
		commitsPastPrHead,
		gate,
		landingInLocalDefault: null,
	};
	const landing = provenLanded(facts);
	if (landing.landed === true) {
		facts.landingInLocalDefault = await landingInLocalDefault(git, { landing, ref: head, prs: prList, defaultBranch });
	}
	return facts;
}

function createGit(runCommand, cwd) {
	return (args) => runCommand("git", args, { cwd });
}

async function fetchDefault(runCommand, cwd, defaultBranch) {
	const result = await runCommand("git", ["fetch", "--quiet", "--no-tags", "origin", defaultBranch], { cwd, timeoutMs: 60_000 });
	return result.ok;
}

module.exports = {
	collectBranchFacts,
	createGit,
	createRunner,
	fetchDefault,
	listLocalBranches,
	listWorktrees,
	readPullRequests,
	resolveDefaultBranch,
};
