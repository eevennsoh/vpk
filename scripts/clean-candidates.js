#!/usr/bin/env node
"use strict";

// Every local branch and worktree with its landing status, and which ones vpk-git-clean
// may remove. Read-only: it removes nothing (see scripts/lib/branch-facts.js). Removal,
// and its process-ownership proof, stay with the vpk-git-clean skill.
//
//   node scripts/clean-candidates.js [--fetch] [--json]
//
// "cleanable" covers: the branch's committed work is proven landed on origin/<default>
// and in the local <default>; no tracked, untracked, skip-worktree or assume-unchanged
// change; no ignored content outside the regenerable list (REGENERABLE_IGNORED in
// branch-facts.js; .env* is listed, not judged); no rebase, merge, cherry-pick, revert or
// bisect in progress; no commit that only a reflog reaches; nothing on origin/<branch>
// the branch lacks; no open PR (and PRs were readable); not the default branch, the
// persistent main checkout, the current worktree, a locked or shared worktree. It does
// not cover running processes.

const fs = require("node:fs");

const { deriveBranchLanding } = require("./lib/branch-landing");
const {
	collectBranchFacts,
	createGit,
	createRunner,
	fetchOrigin,
	listLocalBranches,
	listWorktrees,
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
		if (worktree.reflogOnlyCommits === null) blockers.push("the worktree's HEAD reflog could not be read");
		else if (worktree.reflogOnlyCommits > 0) blockers.push(`${worktree.reflogOnlyCommits} commit(s) only the worktree's HEAD reflog reaches`);
	}
	if (facts.branchReflogOnlyCommits === null) blockers.push("the branch reflog could not be read");
	else if (facts.branchReflogOnlyCommits > 0) blockers.push(`${facts.branchReflogOnlyCommits} commit(s) only the branch reflog reaches`);
	if (facts.pushed && facts.remoteAhead !== 0) {
		blockers.push(facts.remoteAhead === null
			? `origin/${target.branch} could not be compared`
			: `origin/${target.branch} has ${facts.remoteAhead} commit(s) this branch lacks`);
	}
	return blockers;
}

async function collectCleanCandidates({
	cwd = process.cwd(),
	fetch = false,
	runCommand = createRunner({ timeoutMs: 15_000 }),
	readPrs = (branches) => readPullRequests(runCommand, cwd, branches),
} = {}) {
	const git = createGit(runCommand, cwd);
	const defaultBranch = await resolveDefaultBranch(git);
	if (fetch) await fetchOrigin(runCommand, cwd);
	const [worktrees, branches, top] = await Promise.all([
		listWorktrees(git),
		listLocalBranches(git),
		git(["rev-parse", "--show-toplevel"]).then((result) => result.stdout.trim()),
	]);
	if (worktrees === null || branches === null) throw new Error("git could not list worktrees or branches");

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
				// Whether vpk-git-clean may delete origin/<branch>: only when it has nothing the
				// landed local branch lacks. null when there is no remote branch or it is unknown.
				remoteSafeToDelete: facts.pushed ? facts.remoteAhead === 0 && blockers.length === 0 : null,
			},
			cleanable: blockers.length === 0,
			blockers,
		};
	});
	return {
		defaultBranch,
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
	for (const entry of report.candidates) {
		const proof = entry.evidence.landedBy ? `${entry.evidence.proof} #${entry.evidence.landedBy}${entry.evidence.exactHead ? "" : ", tip differs from PR head"}` : entry.evidence.proof;
		lines.push(`  clean   ${entry.branch ?? "(detached)"}${entry.worktree ? `  ${entry.worktree}` : ""}  [${proof}]`);
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

module.exports = { cleanBlockers, collectCleanCandidates, formatCleanCandidates, missingWorktreeLabel, parseArgs };
