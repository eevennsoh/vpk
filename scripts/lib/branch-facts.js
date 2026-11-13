"use strict";

// Reads the git and gh facts that scripts/lib/branch-landing.js derives a status from, and
// the local-state facts clean-candidates needs before it calls anything removable.
// Read-only: every git command runs with --no-optional-locks (no index refresh, no
// index.lock in another worktree), it fetches only when asked (`git fetch origin`, which
// moves remote-tracking refs only), and it never writes a ref, a worktree or an index. A
// read that fails, or warns on stderr, yields null, which the derivation reads as unknown.

const fs = require("node:fs");
const path = require("node:path");

const { createRunner, fetchPullRequests, parseWorktreeList } = require("../vpk-remote-status");
const { provenLanded } = require("./branch-landing");

const GH_TIMEOUT_MS = 15_000;
const PR_BATCH_SIZE = 40;
const REFLOG_LIMIT = 1000;

// Ignored content `git worktree remove` would delete that is regenerable, so it does not
// block removal. Everything else ignored blocks (artifacts/ is durable by AGENTS.md;
// backend/data/ holds the dev backend's runtime data; nested worktrees under
// .claude/worktrees/ hold their own work). `.env*` files do not block: the worktree
// bootstrap seeds them from another checkout, and they are listed, never opened.
const REGENERABLE_IGNORED = [
	/(^|\/)node_modules\/?$/u,
	/^\.next\/?$/u,
	/^out\/?$/u,
	/^output\/?$/u,
	/^test-results\/?$/u,
	/^\.pnpm-store\/?$/u,
	/^\.cache\/?$/u,
	/^tsconfig\.tsbuildinfo$/u,
	/^next-env\.d\.ts$/u,
	/^\.dev-[a-z]+-ports?$/u,
	/(^|\/)\.DS_Store$/u,
];
const ENV_FILE = /(^|\/)\.env[^/]*$/u;

// Files in a worktree's git directory that mean an operation is half done.
const OPERATION_MARKERS = [
	["rebase-merge", "rebase"],
	["rebase-apply", "rebase"],
	["MERGE_HEAD", "merge"],
	["CHERRY_PICK_HEAD", "cherry-pick"],
	["REVERT_HEAD", "revert"],
	["BISECT_LOG", "bisect"],
];

// A successful read with nothing on stderr; a warning ("could not open directory") means
// the answer is incomplete.
function cleanOutput(result) {
	return result?.ok && !result.stderr.trim() ? result.stdout : null;
}

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

// Full ref names, so a branch that shares its name with a tag is never read as `heads/<name>`.
async function listLocalBranches(git) {
	const result = await git(["for-each-ref", "--format=%(refname)", "refs/heads"]);
	return result.ok
		? result.stdout.split("\n").map((line) => line.trim()).filter(Boolean).map((ref) => ref.replace(/^refs\/heads\//u, ""))
		: null;
}

// PRs for each branch, newest first, in batches so one GraphQL query stays small. null when
// gh failed. A branch with more PRs than returned is marked truncated (fetchPullRequests).
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

// The head's work is already on `target`, judged by content: merge the head into the target
// in memory (`git merge-tree --write-tree`); a clean result whose tree is the target's own
// tree means the head adds nothing. A conflict means it adds something. This is exact,
// where git cherry's patch-ids ignore whitespace and skip merge commits. A failed read is null.
async function contentLanded(git, target, head) {
	const [merged, targetTree] = await Promise.all([
		git(["merge-tree", "--write-tree", target, head]),
		git(["rev-parse", `${target}^{tree}`]),
	]);
	if (merged.code === 1) return false;
	if (merged.code !== 0 || !targetTree.ok) return null;
	return merged.stdout.split("\n")[0].trim() === targetTree.stdout.trim();
}

// Does the local default branch hold the commit (or the content) that landed the work?
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
	return contentLanded(git, localDefault, ref);
}

// Commits a reflog reaches that no branch, remote-tracking ref or tag does: work only the
// reflog still remembers (a detached worktree that committed and moved on, a branch reset
// after committing). Removing the worktree or branch drops that reflog. `logArgs` names the
// reflog (`HEAD` in a worktree, or `refs/heads/<branch>`).
async function reflogOnlyCommits(git, logArgs) {
	const output = cleanOutput(await git(["log", "-g", "--format=%H", `-n${REFLOG_LIMIT}`, ...logArgs]));
	if (output === null) return null;
	const commits = [...new Set(output.split("\n").map((line) => line.trim()).filter(Boolean))];
	if (commits.length === 0) return 0;
	return countOrNull(await git(["rev-list", "--count", ...commits, "--not", "--branches", "--remotes", "--tags"]));
}

function classifyIgnored(paths) {
	const blocking = [];
	const env = [];
	for (const entry of paths) {
		if (ENV_FILE.test(entry.replace(/\/$/u, ""))) env.push(entry);
		else if (!REGENERABLE_IGNORED.some((pattern) => pattern.test(entry))) blocking.push(entry);
	}
	return { blocking, env };
}

// { name, branch } of a half-done operation in this git directory, or false; null if unreadable.
function readOperation(gitDir) {
	try {
		for (const [marker, name] of OPERATION_MARKERS) {
			if (!fs.existsSync(path.join(gitDir, marker))) continue;
			let branch = null;
			if (name === "rebase") {
				const headName = path.join(gitDir, marker, "head-name");
				if (fs.existsSync(headName)) branch = fs.readFileSync(headName, "utf8").trim().replace(/^refs\/heads\//u, "") || null;
			}
			return { name, branch };
		}
		return false;
	} catch {
		return null;
	}
}

/**
 * What `git worktree remove` would lose beyond committed history, for one worktree:
 * tracked or untracked changes, edits hidden by skip-worktree/assume-unchanged, ignored
 * content that is not regenerable, a half-done operation, and commits only its HEAD
 * reflog reaches. Each fact is null when it could not be read.
 */
async function collectWorktreeFacts(git, worktreePath) {
	const at = (args) => git(["-C", worktreePath, ...args]);
	const [status, flagged, sparse, ignored, gitDirResult, headReflogOnly] = await Promise.all([
		at(["status", "--porcelain=v1", "--untracked-files=all"]),
		at(["ls-files", "-v"]),
		at(["config", "--bool", "core.sparseCheckout"]),
		at(["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"]),
		at(["rev-parse", "--absolute-git-dir"]),
		reflogOnlyCommits(at, ["HEAD"]),
	]);
	const statusOut = cleanOutput(status);
	// ls-files -v: a lowercase tag is assume-unchanged, S is skip-worktree. A sparse checkout
	// marks every file outside it skip-worktree, so there the count proves nothing.
	const flaggedOut = cleanOutput(flagged);
	const sparseOn = sparse.ok && sparse.stdout.trim() === "true";
	const hiddenEdits = flaggedOut === null || sparseOn
		? null
		: flaggedOut.split("\n").filter((line) => /^[a-zS] /u.test(line)).length;
	const ignoredOut = cleanOutput(ignored);
	const gitDir = gitDirResult.ok ? gitDirResult.stdout.trim() : null;
	return {
		path: worktreePath,
		gitDir,
		dirty: statusOut === null ? null : statusOut.trim().length > 0,
		hiddenEdits,
		ignored: ignoredOut === null ? null : classifyIgnored(ignoredOut.split("\n").map((line) => line.trim()).filter(Boolean)),
		operation: gitDir === null ? null : readOperation(gitDir),
		reflogOnlyCommits: headReflogOnly,
	};
}

/**
 * Facts for one branch (or one detached worktree). `prs` is this branch's PR list, or
 * null when gh failed. `worktree` is its `git worktree list` entry, or null.
 * `localBranchExists` may be null (the read failed): then nothing about it is assumed.
 */
async function collectBranchFacts({ git, branch, worktree = null, defaultBranch, prs, localBranchExists, gate = null }) {
	const prList = prs ?? [];
	const latestPrHead = [...prList].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0))[0]?.headRefOid ?? null;
	// A deleted branch is judged by its PR's head.
	const ref = localBranchExists !== false && branch ? `refs/heads/${branch}` : worktree?.head ?? latestPrHead;
	const head = ref ? trimmed(await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])) : null;
	const originDefault = `refs/remotes/origin/${defaultBranch}`;
	const remoteRef = branch ? `refs/remotes/origin/${branch}` : null;

	const [worktreeFacts, pushed, inOriginDefault, contentProof, branchReflogOnly] = await Promise.all([
		worktree ? collectWorktreeFacts(git, worktree.path) : null,
		remoteRef ? git(["show-ref", "--verify", "--quiet", remoteRef]).then(exitAnswer) : false,
		head ? git(["merge-base", "--is-ancestor", head, originDefault]).then(exitAnswer) : null,
		head ? contentLanded(git, originDefault, head) : null,
		!branch || localBranchExists === false ? 0 : localBranchExists ? reflogOnlyCommits(git, [`refs/heads/${branch}`]) : null,
	]);
	// Commits not on the remote branch; and the reverse, commits someone pushed to the remote
	// branch that this branch lacks. Both 0 when there is no remote branch.
	const [unpushed, remoteAhead] = pushed && head
		? await Promise.all([
			git(["rev-list", "--count", `${remoteRef}..${head}`]).then(countOrNull),
			git(["rev-list", "--count", `${head}..${remoteRef}`]).then(countOrNull),
		])
		: pushed === false ? [0, 0] : [null, null];

	const commitsPastPrHead = {};
	await Promise.all(prList.filter((pr) => pr.state === "MERGED").map(async (pr) => {
		if (localBranchExists === false && !worktree) {
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
		worktree: worktreeFacts,
		pushed,
		unpushed,
		remoteAhead,
		inOriginDefault,
		contentLanded: contentProof,
		prs,
		prsTruncated: prs?.truncated === true,
		commitsPastPrHead,
		branchReflogOnlyCommits: branchReflogOnly,
		gate,
		landingInLocalDefault: null,
	};
	const landing = provenLanded(facts);
	if (landing.landed === true) {
		facts.landingInLocalDefault = await landingInLocalDefault(git, { landing, ref: head, prs: prList, defaultBranch });
	}
	return facts;
}

// Every read goes through here, with --no-optional-locks.
function createGit(runCommand, cwd) {
	return (args) => runCommand("git", ["--no-optional-locks", ...args], { cwd });
}

// Remote-tracking refs only (no tags, no prune): the default branch and every branch tip.
async function fetchOrigin(runCommand, cwd) {
	const result = await runCommand("git", ["fetch", "--quiet", "--no-tags", "origin"], { cwd, timeoutMs: 120_000 });
	return result.ok;
}

module.exports = {
	REGENERABLE_IGNORED,
	classifyIgnored,
	collectBranchFacts,
	collectWorktreeFacts,
	contentLanded,
	createGit,
	createRunner,
	fetchOrigin,
	listLocalBranches,
	listWorktrees,
	readOperation,
	readPullRequests,
	resolveDefaultBranch,
};
