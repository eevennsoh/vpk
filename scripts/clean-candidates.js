#!/usr/bin/env node
"use strict";

// Every local branch and worktree with its landing status, and which ones vpk-git-clean
// may remove. It removes nothing and writes no ref, worktree, index or config; what it
// does write (merge-tree's unreferenced objects, and with --fetch the remote-tracking refs)
// is listed in scripts/lib/branch-facts.js. Removal, and its process-ownership proof, stay
// with the vpk-git-clean skill.
//
//   node scripts/clean-candidates.js [--fetch] [--json]
//
// "cleanable" covers: the branch's committed work is proven landed on origin/<default>
// and in the local <default>; no tracked, untracked, skip-worktree or assume-unchanged
// change; no ignored content outside the regenerable list (REGENERABLE_IGNORED in
// branch-facts.js; the env files the bootstrap seeds are listed, not judged); no rebase,
// merge, cherry-pick, revert or bisect in progress; no commit that only a reflog or a
// per-worktree ref reaches (remote-tracking refs count as keeping a commit only after a
// successful --fetch, and only while their branch still exists on origin); nothing on
// origin/<branch> the branch lacks; no open PR (and PRs were readable); not the default
// branch, the persistent main checkout, the current worktree, a locked or shared worktree.
// It does not cover running processes. remoteSafeToDelete is decided only after a
// successful --fetch in the same run.

const fs = require("node:fs");

const { deriveBranchLanding } = require("./lib/branch-landing");
const {
	DEFAULT_KEEP_REFS,
	collectBranchFacts,
	createGit,
	createRunner,
	fetchOrigin,
	listLocalBranches,
	listWorktrees,
	readLiveKeepRefs,
	readPullRequests,
	resolveDefaultBranch,
} = require("./lib/branch-facts");

const CONCURRENCY = 8;
const SHOWN_PATHS = 5;

function parseArgs(argv) {
	const options = { fetch: false, json: false };
	for (const arg of argv) {
		if (arg === "--json") options.json = true;
		else if (arg === "--fetch") options.fetch = true;
		else if (arg === "--help" || arg === "-h") options.help = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

async function mapLimit(items, limit, fn) {
	const results = new Array(items.length);
	let next = 0;
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next;
			next += 1;
			results[index] = await fn(items[index]);
		}
	}));
	return results;
}

function listPaths(paths) {
	const shown = paths.slice(0, SHOWN_PATHS).join(", ");
	return paths.length > SHOWN_PATHS ? `${shown} (+${paths.length - SHOWN_PATHS} more)` : shown;
}

// Why a registered worktree could not be inspected: its directory is gone, or it exists
// but git no longer recognises it (its .git file is missing or broken).
function missingWorktreeLabel(entry, { exists }) {
	if (!exists) return `registered worktree ${entry.path} is missing${entry.locked ? " (locked)" : ""}`;
	return `worktree ${entry.path} exists but git no longer recognises it (${typeof entry.prunable === "string" ? entry.prunable : "prunable"}); its files were not inspected`;
}

/**
 * Why a target must stay. Empty means removable as far as git can tell; vpk-git-clean still
 * proves process ownership. Every unreadable fact blocks. Pure: facts in, reasons out.
 */
function cleanBlockers({ derived, facts = {}, target, defaultBranch, currentPath, mainCheckoutPath, rebasing = new Map() }) {
	const blockers = [];
	if (derived.status !== "main-synced") blockers.push(`${derived.status}: ${derived.nextAction}`);
	if (target.branch === defaultBranch) blockers.push("default branch");
	if (target.worktree?.path === mainCheckoutPath) blockers.push("persistent main checkout");
	if (target.worktree?.path === currentPath) blockers.push("current worktree");
	if (target.worktree?.locked) blockers.push("worktree is locked");
	if (target.missing) blockers.push(target.missing);
	if (target.sharedBy > 1) blockers.push(`branch is checked out in ${target.sharedBy} worktrees`);
	if (target.branch !== null && rebasing.has(target.branch)) blockers.push(`being rebased in ${rebasing.get(target.branch)}`);
	// No open PR may own it: every PR on the branch counts, and an unreadable or incomplete
	// PR list proves nothing.
	if (target.branch !== null && derived.evidence.openPrs === null) blockers.push("pull requests could not be read in full");
	for (const number of derived.evidence.openPrs ?? []) blockers.push(`open PR #${number}`);

	const worktree = facts.worktree;
	if (worktree) {
		if (worktree.ignored === null) blockers.push("ignored files could not be listed");
		else if (worktree.ignored.blocking.length > 0) blockers.push(`ignored content that is not regenerable: ${listPaths(worktree.ignored.blocking)}`);
		if (worktree.operation === null) blockers.push("could not tell whether an operation is in progress");
		else if (worktree.operation) blockers.push(`a ${worktree.operation.name} is in progress`);
		const localOnly = worktree.localOnlyCommits;
		if (localOnly.unknown) blockers.push(`the worktree's HEAD reflog or its own refs ${localOnly.unknown}`);
		else if (localOnly.count > 0) blockers.push(`${localOnly.count} commit(s) only the worktree's HEAD reflog or its own refs reach`);
	}
	const branchReflog = facts.branchReflogOnlyCommits;
	if (branchReflog?.unknown) blockers.push(`the branch reflog ${branchReflog.unknown}`);
	else if (branchReflog?.count > 0) blockers.push(`${branchReflog.count} commit(s) only the branch reflog reaches`);
	if (facts.pushed && facts.remoteAhead !== 0) {
		blockers.push(facts.remoteAhead === null
			? `origin/${target.branch} could not be compared`
			: `origin/${target.branch} has ${facts.remoteAhead} commit(s) this branch lacks`);
	}
	return blockers;
}

const REMOTE_UNKNOWN = {
	skipped: "not judged: run with --fetch",
	failed: "unknown: the fetch (or listing origin's branches) failed, so origin/<branch> may be stale",
};

// Whether vpk-git-clean may delete origin/<branch>, and the tip it saw (the lease for the
// delete). true only when this run fetched, the remote branch has nothing the landed local
// branch lacks, and the target is cleanable. null when there is no remote branch, or when
// it was not fetched in this run (`remoteUnknown` says why).
function remoteVerdict({ facts, blockers, fetchState }) {
	if (!facts.pushed) return { remoteTip: null, remoteSafeToDelete: null, remoteUnknown: facts.pushed === null ? "the remote branch could not be read" : null };
	if (fetchState !== "ok") return { remoteTip: facts.remoteTip, remoteSafeToDelete: null, remoteUnknown: REMOTE_UNKNOWN[fetchState] };
	if (facts.remoteTip === null) return { remoteTip: null, remoteSafeToDelete: null, remoteUnknown: "the remote branch could not be read" };
	return { remoteTip: facts.remoteTip, remoteSafeToDelete: facts.remoteAhead === 0 && blockers.length === 0, remoteUnknown: null };
}

async function collectCleanCandidates({
	cwd = process.cwd(),
	fetch = false,
	runCommand = createRunner({ timeoutMs: 15_000 }),
	readPrs = (branches) => readPullRequests(runCommand, cwd, branches),
} = {}) {
	const git = createGit(runCommand, cwd);
	const defaultBranch = await resolveDefaultBranch(git);
	// "ok" only when this run fetched origin and listed its branches: then the remote-tracking
	// refs are current, the live ones keep commits, and a remote branch can be judged.
	let fetchState = "skipped";
	let keepRefs = DEFAULT_KEEP_REFS;
	if (fetch) {
		const liveKeepRefs = (await fetchOrigin(runCommand, cwd)) ? await readLiveKeepRefs(git) : null;
		fetchState = liveKeepRefs ? "ok" : "failed";
		keepRefs = liveKeepRefs ?? DEFAULT_KEEP_REFS;
	}
	const [worktrees, branches, topResult] = await Promise.all([
		listWorktrees(git),
		listLocalBranches(git),
		git(["rev-parse", "--show-toplevel"]),
	]);
	if (worktrees === null || branches === null) throw new Error("git could not list worktrees or branches");
	// Without the current worktree's path it could not be kept out of the candidates.
	const top = topResult.ok ? topResult.stdout.trim() : "";
	if (!top) throw new Error("git could not tell which worktree this is");

	// A registered worktree that cannot be inspected (directory gone, or git no longer
	// recognises it) is never removable here; `git worktree prune` (after `git worktree
	// unlock` for a locked one) is vpk-git-clean's call.
	for (const entry of worktrees) {
		const exists = fs.existsSync(entry.path);
		entry.missing = !exists || entry.prunable ? missingWorktreeLabel(entry, { exists }) : null;
	}
	const targets = [];
	for (const branch of branches) {
		const owners = worktrees.filter((entry) => entry.branch === branch);
		if (owners.length === 0) targets.push({ branch, worktree: null, sharedBy: 0, missing: null });
		for (const entry of owners) targets.push({ branch, worktree: entry, sharedBy: owners.length, missing: entry.missing });
	}
	for (const entry of worktrees.filter((candidate) => !candidate.branch && !candidate.missing)) {
		targets.push({ branch: null, worktree: entry, sharedBy: 1, missing: null });
	}

	const prsByBranch = await readPrs(branches);
	const inspected = await mapLimit(targets, CONCURRENCY, async (target) => {
		const prs = target.branch === null ? [] : prsByBranch === null ? null : prsByBranch.get(target.branch) ?? [];
		const facts = await collectBranchFacts({
			git,
			branch: target.branch,
			worktree: target.worktree && !target.missing ? target.worktree : null,
			defaultBranch,
			prs,
			localBranchExists: target.branch !== null,
			keepRefs,
		});
		return { target, facts };
	});
	// A rebase leaves its branch detached in the worktree doing it; that branch stays too.
	const rebasing = new Map();
	for (const { facts } of inspected) {
		const operation = facts.worktree?.operation;
		if (operation?.branch) rebasing.set(operation.branch, facts.worktree.path);
	}
	const results = inspected.map(({ target, facts }) => {
		const derived = deriveBranchLanding(facts);
		const blockers = cleanBlockers({ derived, facts, target, defaultBranch, currentPath: top, mainCheckoutPath: worktrees[0]?.path, rebasing });
		return {
			branch: target.branch,
			worktree: target.worktree?.path ?? null,
			status: derived.status,
			nextAction: derived.nextAction,
			evidence: {
				...derived.evidence,
				ignoredEnvFiles: facts.worktree?.ignored?.env ?? [],
				...remoteVerdict({ facts, blockers, fetchState }),
			},
			cleanable: blockers.length === 0,
			blockers,
		};
	});
	return {
		defaultBranch,
		fetch: fetchState,
		prsRead: prsByBranch !== null,
		candidates: results.filter((entry) => entry.cleanable),
		retained: results.filter((entry) => !entry.cleanable),
		missingWorktrees: worktrees.filter((entry) => entry.missing).map((entry) => ({
			worktree: entry.path,
			branch: entry.branch ?? null,
			head: entry.head ?? null,
			locked: entry.locked === true,
			reason: entry.missing,
		})),
	};
}

function formatCleanCandidates(report) {
	const lines = [`clean candidates: ${report.candidates.length} landed and clean, ${report.retained.length} retained${report.prsRead ? "" : " (gh unreachable: PR-based proof unknown)"}`];
	if (report.fetch === "failed") lines.push("  fetch failed: origin/* refs are from an earlier fetch; no remote branch is safe to delete, and remote-tracking refs do not count as keeping commits");
	if (report.fetch === "skipped") lines.push("  no --fetch: remote branches are not judged, and remote-tracking refs do not count as keeping commits");
	for (const entry of report.candidates) {
		const { evidence } = entry;
		const proof = evidence.landedBy ? `${evidence.proof} #${evidence.landedBy}${evidence.exactHead ? "" : ", tip differs from PR head"}` : evidence.proof;
		lines.push(`  clean   ${entry.branch ?? "(detached)"}${entry.worktree ? `  ${entry.worktree}` : ""}  [${proof}]`);
		if (evidence.remoteSafeToDelete === true) lines.push(`          origin/${entry.branch}: safe to delete at ${evidence.remoteTip}`);
		else if (evidence.remoteTip || evidence.remoteUnknown) lines.push(`          origin/${entry.branch}: ${evidence.remoteUnknown ?? "not safe to delete"}`);
		if (evidence.ignoredEnvFiles.length > 0) lines.push(`          env files removal deletes (show the owner; not opened): ${evidence.ignoredEnvFiles.join(", ")}`);
	}
	for (const entry of report.retained) {
		lines.push(`  keep    ${entry.branch ?? "(detached)"}${entry.worktree ? `  ${entry.worktree}` : ""}  ${entry.blockers.join("; ")}`);
	}
	if (report.missingWorktrees.length > 0) {
		const locked = report.missingWorktrees.filter((entry) => entry.locked).length;
		lines.push(`  ${report.missingWorktrees.length} registered worktree(s) that cannot be inspected (${locked} locked); see git worktree prune --dry-run --verbose`);
	}
	lines.push("Process ownership is not checked here; vpk-git-clean proves it before removing anything.");
	return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
	const options = parseArgs(argv);
	if (options.help) {
		console.log("usage: node scripts/clean-candidates.js [--fetch] [--json]");
		return 0;
	}
	const report = await collectCleanCandidates(options);
	console.log(options.json ? JSON.stringify(report, null, 2) : formatCleanCandidates(report));
	return 0;
}

if (require.main === module) {
	main().then((code) => {
		process.exitCode = code;
	}, (error) => {
		console.error(`clean-candidates: ${error.message}`);
		process.exitCode = 1;
	});
}

module.exports = { cleanBlockers, collectCleanCandidates, formatCleanCandidates, missingWorktreeLabel, parseArgs, remoteVerdict };
