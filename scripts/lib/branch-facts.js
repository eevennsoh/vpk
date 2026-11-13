"use strict";

// Reads the git and gh facts that scripts/lib/branch-landing.js derives a status from, and
// the local-state facts clean-candidates needs before it calls anything removable.
// What it writes: it never writes a ref, a worktree, an index or config. Every git command
// runs with --no-optional-locks (no index refresh, no index.lock in another worktree). The
// content proof (`git merge-tree --write-tree`) adds the merged result's blobs and trees to
// the object store, unreferenced, for gc to remove. `fetchOrigin`, only when asked, runs
// `git fetch origin`, which moves remote-tracking refs (no prune, no tags, no FETCH_HEAD). A read that fails, or warns on
// stderr, yields null, which the derivation reads as unknown.

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
// The env files the worktree bootstrap seeds (`.agents/hooks/lib/worktree-bootstrap.sh`):
// a regular file named `.env` or `.env.*`, not `*.example`, outside the provider worktree
// folders. Only those are exempt; a directory such as `.envs/` or `.environment-notes/`,
// a symlink, or anything else an `.env*` ignore rule matches blocks like other content.
const ENV_FILE_NAME = /^\.env(\..*)?$/u;
const PROVIDER_WORKTREES = /^\.(claude|rovo|codex|cursor)\/worktrees\//u;

// Files in a worktree's git directory that mean an operation is half done.
const OPERATION_MARKERS = [
	["rebase-merge", "rebase"],
	["rebase-apply", "rebase"],
	["MERGE_HEAD", "merge"],
	["CHERRY_PICK_HEAD", "cherry-pick"],
	["REVERT_HEAD", "revert"],
	["BISECT_LOG", "bisect"],
	// A multi-commit cherry-pick or revert keeps this after its *_HEAD is gone (a commit made
	// by hand mid-sequence), until --continue or --quit.
	["sequencer", "cherry-pick or revert sequence"],
];

// Passed as `worktree` when the worktree list could not be read.
const UNKNOWN_WORKTREE = Symbol("unknown worktree");

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

// origin's default branch from origin/HEAD. A failed or missing read throws: every landing
// proof is judged against it, so a guess would judge against the wrong branch.
async function resolveDefaultBranch(git) {
	const ref = trimmed(await git(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]));
	if (!ref?.startsWith("refs/remotes/origin/")) {
		throw new Error("could not read origin's default branch from origin/HEAD (if it is unset: git remote set-head origin --auto)");
	}
	return ref.replace(/^refs\/remotes\/origin\//u, "");
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

// What every content proof needs once per repository: the empty tree (its id depends on the
// hash), whether $GIT_COMMON_DIR/info/attributes sets anything (no option turns that file
// off), and whether any config scope defines a merge driver (git looks a driver up by name
// before its built-in ones, so `merge.text.driver` would replace even the text merge).
const mergeSettingsByGit = new WeakMap();
function readMergeSettings(git) {
	if (!mergeSettingsByGit.has(git)) {
		mergeSettingsByGit.set(git, Promise.all([
			git(["hash-object", "-t", "tree", "/dev/null"]),
			git(["rev-parse", "--path-format=absolute", "--git-common-dir"]),
			git(["config", "--get-regexp", "^merge\\..*\\.driver$"]),
		]).then(([emptyTree, commonDir, drivers]) => {
			if (!emptyTree.ok || !commonDir.ok) return null;
			// Exit 1 is "none defined"; anything else that is not a match is unknown.
			if (drivers.code !== 0 && drivers.code !== 1) return null;
			let infoAttributes = "";
			try {
				infoAttributes = fs.readFileSync(path.join(commonDir.stdout.trim(), "info", "attributes"), "utf8");
			} catch (error) {
				if (error.code !== "ENOENT") return null;
			}
			const setsAttributes = infoAttributes.split("\n").some((line) => line.trim() && !line.trim().startsWith("#"));
			return { emptyTree: emptyTree.stdout.trim(), setsAttributes, definesDriver: drivers.code === 0 };
		}));
	}
	return mergeSettingsByGit.get(git);
}

// The head's work is already on `target`, judged by content: merge the head into the target
// in memory (`git merge-tree --write-tree`); a clean result whose tree is the target's own
// tree means the head adds nothing. A conflict means it adds something. Unlike git cherry's
// patch-ids it sees whitespace and merge commits. A merge driver or attribute could pick a
// side (`merge=ours` with `merge.ours.driver=true` makes any conflicting branch look
// landed), so: attributes are read from the empty tree, not the checkout or a commit;
// the global (core.attributesFile) and system attribute files are off; merge.default is
// `text` and merge.renormalize is off. What cannot be switched off for one command makes
// the proof unknown (null): an info/attributes file that sets anything, or a merge driver
// defined in any config scope. A failed read is null too.
async function contentLanded(git, target, head) {
	const settings = await readMergeSettings(git);
	if (settings === null || settings.setsAttributes || settings.definesDriver) return null;
	const [merged, targetTree] = await Promise.all([
		git([
			`--attr-source=${settings.emptyTree}`,
			"-c", "core.attributesFile=/dev/null",
			"-c", "merge.default=text",
			"-c", "merge.renormalize=false",
			"merge-tree", "--write-tree", target, head,
		], { env: { GIT_ATTR_NOSYSTEM: "1" } }),
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

// The refs that keep a commit after a removal: local branches and tags. Remote-tracking refs
// count only when the caller proved them live (`liveRemoteRefs`), since a stale
// origin/<other> goes with the next `git fetch --prune`.
const DEFAULT_KEEP_REFS = Object.freeze(["--branches", "--tags"]);

// { count, unknown }: how many commits `tips` reach that `keepRefs` do not, or why that is
// unknown (`count` null).
async function commitsOnlyFrom(git, tips, keepRefs) {
	if (tips.length === 0) return { count: 0, unknown: null };
	const count = countOrNull(await git(["rev-list", "--count", ...tips, "--not", ...keepRefs]));
	return count === null ? { count: null, unknown: "could not be read" } : { count, unknown: null };
}

// Commits a reflog reaches that no kept ref does: work only the reflog still remembers (a
// detached worktree that committed and moved on, a branch reset after committing). Removing
// the worktree or branch drops that reflog. `logArgs` names the reflog (`HEAD` in a
// worktree, or `refs/heads/<branch>`). A reflog longer than REFLOG_LIMIT is not scanned in
// full, so its answer is unknown. `extraTips` are other commits removal would drop.
async function reflogOnlyCommits(git, logArgs, { keepRefs = DEFAULT_KEEP_REFS, extraTips = [] } = {}) {
	const output = cleanOutput(await git(["log", "-g", "--format=%H", `-n${REFLOG_LIMIT + 1}`, ...logArgs]));
	if (output === null) return { count: null, unknown: "could not be read" };
	const entries = output.split("\n").map((line) => line.trim()).filter(Boolean);
	if (entries.length > REFLOG_LIMIT) return { count: null, unknown: `has more than ${REFLOG_LIMIT} entries, so it was not scanned in full` };
	return commitsOnlyFrom(git, [...new Set([...entries, ...extraTips])], keepRefs);
}

function isSeededEnvFile(entry, isRegularFile) {
	if (entry.endsWith("/") || PROVIDER_WORKTREES.test(entry)) return false;
	const name = entry.slice(entry.lastIndexOf("/") + 1);
	return ENV_FILE_NAME.test(name) && !name.endsWith(".example") && isRegularFile(entry);
}

// `isRegularFile(relativePath)` says whether the path is a regular file (not followed
// through a symlink).
function classifyIgnored(paths, { isRegularFile }) {
	const blocking = [];
	const env = [];
	for (const entry of paths) {
		if (isSeededEnvFile(entry, isRegularFile)) env.push(entry);
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

// Refs that belong to one worktree and go with it: refs/worktree/*, and the bisect and
// rebase --rebase-merges refs.
const PER_WORKTREE_REFS = ["refs/worktree/", "refs/bisect/", "refs/rewritten/"];

/**
 * What `git worktree remove` would lose beyond committed history, for one worktree:
 * tracked or untracked changes, edits hidden by skip-worktree/assume-unchanged, ignored
 * content that is not regenerable, a half-done operation, and commits only its HEAD
 * reflog or its own refs reach. Each fact is null when it could not be read.
 */
async function collectWorktreeFacts(git, worktreePath, { keepRefs = DEFAULT_KEEP_REFS } = {}) {
	const at = (args) => git(["-C", worktreePath, ...args]);
	const ownRefs = cleanOutput(await at(["for-each-ref", "--format=%(objectname)", ...PER_WORKTREE_REFS]));
	const [status, flagged, sparse, ignored, gitDirResult, localOnly] = await Promise.all([
		at(["status", "--porcelain=v1", "--untracked-files=all"]),
		at(["ls-files", "-v"]),
		at(["config", "--bool", "core.sparseCheckout"]),
		at(["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"]),
		at(["rev-parse", "--absolute-git-dir"]),
		ownRefs === null
			? { count: null, unknown: "could not be read" }
			: reflogOnlyCommits(at, ["HEAD"], { keepRefs, extraTips: ownRefs.split("\n").map((line) => line.trim()).filter(Boolean) }),
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
		ignored: ignoredOut === null ? null : classifyIgnored(ignoredOut.split("\n").map((line) => line.trim()).filter(Boolean), {
			isRegularFile: (relative) => {
				try {
					return fs.lstatSync(path.join(worktreePath, relative)).isFile();
				} catch {
					return false;
				}
			},
		}),
		operation: gitDir === null ? null : readOperation(gitDir),
		localOnlyCommits: localOnly,
	};
}

const OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/u;

// A registered worktree whose directory is gone, or that git no longer recognises: what
// `git worktree remove` (or prune) of its admin directory would drop. Its HEAD, its HEAD
// reflog and its own refs (refs/worktree, refs/bisect, refs/rewritten) live in
// $GIT_COMMON_DIR/worktrees/<id>/ and go with it. Returns { removeSafe, unreachableCommits,
// rescue }: removeSafe is true when every commit those name is reachable from `keepRefs`;
// rescue lists the fewest commits to put on a branch first. null fields when unknown.
async function missingWorktreeFacts(git, entry, { keepRefs = DEFAULT_KEEP_REFS } = {}) {
	const unknown = { removeSafe: null, unreachableCommits: null, rescue: null };
	const commonDir = trimmed(await git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));
	const adminDir = commonDir ? findAdminDir(path.join(commonDir, "worktrees"), entry.path) : null;
	const tips = adminDir ? readAdminTips(adminDir) : null;
	if (tips === null) return unknown;
	if (entry.head && OID.test(entry.head)) tips.add(entry.head);
	if (tips.size > REFLOG_LIMIT * 2) return unknown;
	if (tips.size === 0) return { removeSafe: true, unreachableCommits: 0, rescue: [] };
	const listed = cleanOutput(await git(["rev-list", "--ignore-missing", ...tips, "--not", ...keepRefs]));
	if (listed === null) return unknown;
	const unreachable = new Set(listed.split("\n").map((line) => line.trim()).filter(Boolean));
	if (unreachable.size === 0) return { removeSafe: true, unreachableCommits: 0, rescue: [] };
	const lost = [...tips].filter((oid) => unreachable.has(oid));
	const independent = lost.length > 1 ? cleanOutput(await git(["merge-base", "--independent", ...lost])) : lost.join("\n");
	if (independent === null) return unknown;
	return {
		removeSafe: false,
		unreachableCommits: unreachable.size,
		rescue: independent.split("\n").map((line) => line.trim()).filter(Boolean),
	};
}


// The admin directory whose gitdir file points at `<worktreePath>/.git`, or null.
function findAdminDir(worktreesDir, worktreePath) {
	let names;
	try {
		names = fs.readdirSync(worktreesDir);
	} catch {
		return null;
	}
	for (const name of names) {
		const dir = path.join(worktreesDir, name);
		try {
			if (path.dirname(fs.readFileSync(path.join(dir, "gitdir"), "utf8").trim()) === worktreePath) return dir;
		} catch {
			// No gitdir file: not this one.
		}
	}
	return null;
}

// Every commit id the admin directory names: its HEAD, both sides of each logs/HEAD entry,
// and its loose per-worktree refs. null when any of it cannot be read, or the refs are not
// loose files (reftable).
function readAdminTips(adminDir) {
	const tips = new Set();
	try {
		if (fs.existsSync(path.join(adminDir, "reftable"))) return null;
		const head = fs.readFileSync(path.join(adminDir, "HEAD"), "utf8").trim();
		if (OID.test(head)) tips.add(head);
		const logPath = path.join(adminDir, "logs", "HEAD");
		if (fs.existsSync(logPath)) {
			for (const line of fs.readFileSync(logPath, "utf8").split("\n")) {
				for (const oid of line.split(" ").slice(0, 2)) if (OID.test(oid) && !/^0+$/u.test(oid)) tips.add(oid);
			}
		}
		for (const prefix of PER_WORKTREE_REFS) {
			const dir = path.join(adminDir, prefix);
			if (!fs.existsSync(dir)) continue;
			for (const file of fs.readdirSync(dir, { recursive: true })) {
				const full = path.join(dir, file);
				if (!fs.statSync(full).isFile()) continue;
				const value = fs.readFileSync(full, "utf8").trim();
				if (OID.test(value)) tips.add(value);
			}
		}
	} catch {
		return null;
	}
	return tips;
}

// A worktree that is registered but whose facts could not be read at all: every fact unknown.
function unreadableWorktreeFacts(worktreePath = null) {
	return {
		path: worktreePath,
		gitDir: null,
		dirty: null,
		hiddenEdits: null,
		ignored: null,
		operation: null,
		localOnlyCommits: { count: null, unknown: "could not be read" },
	};
}

/**
 * Facts for one branch (or one detached worktree). `prs` is this branch's PR list, or
 * null when gh failed. `worktree` is its `git worktree list` entry, null for none, or
 * `UNKNOWN_WORKTREE` when the worktree list could not be read. `localBranchExists` may be
 * null (the read failed): then nothing about it is assumed. `keepRefs` are the refs that
 * keep a commit after removal (DEFAULT_KEEP_REFS unless remote refs were proven live).
 */
async function collectBranchFacts({ git, branch, worktree = null, defaultBranch, prs, localBranchExists, gate = null, keepRefs = DEFAULT_KEEP_REFS }) {
	const worktreeUnknown = worktree === UNKNOWN_WORKTREE;
	if (worktreeUnknown) worktree = null;
	const prList = prs ?? [];
	const latestPrHead = [...prList].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0))[0]?.headRefOid ?? null;
	// A deleted branch is judged by its PR's head.
	const ref = localBranchExists !== false && branch ? `refs/heads/${branch}` : worktree?.head ?? latestPrHead;
	const head = ref ? trimmed(await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])) : null;
	const originDefault = `refs/remotes/origin/${defaultBranch}`;
	const remoteRef = branch ? `refs/remotes/origin/${branch}` : null;

	const [worktreeFacts, pushed, inOriginDefault, contentProof, branchReflogOnly] = await Promise.all([
		worktree ? collectWorktreeFacts(git, worktree.path, { keepRefs }) : worktreeUnknown ? unreadableWorktreeFacts() : null,
		remoteRef ? git(["show-ref", "--verify", "--quiet", remoteRef]).then(exitAnswer) : false,
		head ? git(["merge-base", "--is-ancestor", head, originDefault]).then(exitAnswer) : null,
		head ? contentLanded(git, originDefault, head) : null,
		!branch || localBranchExists === false
			? { count: 0, unknown: null }
			: localBranchExists ? reflogOnlyCommits(git, [`refs/heads/${branch}`], { keepRefs }) : { count: null, unknown: "could not be read" },
	]);
	// Commits not on the remote branch; and the reverse, commits someone pushed to the remote
	// branch that this branch lacks. Both 0 when there is no remote branch.
	const [unpushed, remoteAhead, remoteTip] = pushed && head
		? await Promise.all([
			git(["rev-list", "--count", `${remoteRef}..${head}`]).then(countOrNull),
			git(["rev-list", "--count", `${head}..${remoteRef}`]).then(countOrNull),
			git(["rev-parse", "--verify", "--quiet", remoteRef]).then(trimmed),
		])
		: pushed === false ? [0, 0, null] : [null, null, null];

	const commitsPastPrHead = {};
	// Also for a deleted branch, judged by its latest PR's head: a newer PR's head is not
	// carried by an older merged one. Unknown when the objects to compare are missing.
	await Promise.all(prList.filter((pr) => pr.state === "MERGED").map(async (pr) => {
		if (head && head === pr.headRefOid) {
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
		remoteTip,
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
	return (args, options = {}) => runCommand("git", ["--no-optional-locks", ...args], { cwd, ...options });
}

// Remote-tracking refs only (no tags, no prune even with fetch.prune set, no FETCH_HEAD):
// the default branch and every branch tip.
// true when the fetch succeeded.
async function fetchOrigin(runCommand, cwd) {
	const result = await runCommand("git", ["fetch", "--quiet", "--no-tags", "--no-prune", "--no-write-fetch-head", "origin"], { cwd, timeoutMs: 120_000 });
	return result.ok;
}

// The kept refs once origin's branch list is known: local branches, tags, and the
// origin/* refs whose tip is exactly the tip origin advertises for that branch. Any other
// origin/* ref is left out: a branch origin deleted (`git fetch --prune` would delete the
// ref) or moved (a narrowed fetch refspec leaves the ref behind, and the next fetch that
// covers it moves it). origin/HEAD is always left out, since it resolves to another ref.
// null when origin could not be listed.
async function readLiveKeepRefs(git) {
	const [remote, local] = await Promise.all([
		git(["ls-remote", "--heads", "origin"], { timeoutMs: 60_000 }),
		git(["for-each-ref", "--format=%(objectname) %(refname)", "refs/remotes/origin/"]),
	]);
	if (!remote.ok || !local.ok) return null;
	const advertised = new Map();
	for (const line of remote.stdout.split("\n")) {
		const [oid, ref] = line.trim().split("\t");
		if (oid && ref?.startsWith("refs/heads/")) advertised.set(ref.replace(/^refs\/heads\//u, "refs/remotes/origin/"), oid);
	}
	const unproven = [];
	for (const line of local.stdout.split("\n")) {
		const [oid, ref] = line.trim().split(" ");
		if (ref && advertised.get(ref) !== oid) unproven.push(ref);
	}
	return [...DEFAULT_KEEP_REFS, ...unproven.map((ref) => `--exclude=${ref}`), "--glob=refs/remotes/origin/*"];
}

module.exports = {
	DEFAULT_KEEP_REFS,
	REFLOG_LIMIT,
	REGENERABLE_IGNORED,
	UNKNOWN_WORKTREE,
	classifyIgnored,
	collectBranchFacts,
	collectWorktreeFacts,
	contentLanded,
	createGit,
	createRunner,
	fetchOrigin,
	listLocalBranches,
	listWorktrees,
	missingWorktreeFacts,
	readOperation,
	readLiveKeepRefs,
	readPullRequests,
	resolveDefaultBranch,
};
