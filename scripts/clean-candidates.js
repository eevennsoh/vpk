#!/usr/bin/env node
"use strict";

// Every local branch and worktree with its landing status and which ones vpk-git-clean
// may remove, which worktrees are stale (no branch activity and no process for
// --stale-days), and every index.lock with whether a process holds it. A report: it
// removes nothing, with one exception behind an explicit flag, --remove-stale-locks,
// which deletes an index.lock that no process holds, no git command in that worktree
// owns, and that is older than --lock-min-age-minutes (never in the persistent main
// checkout). Worktree and branch removal stay with the vpk-git-clean skill.
//
//   node scripts/clean-candidates.js [--fetch] [--json] [--stale-days N]
//     [--remove-stale-locks] [--lock-min-age-minutes N]
//
// "cleanable" covers: the branch's committed work is proven landed on origin/<default>
// and in the local <default>; no tracked, untracked, skip-worktree or assume-unchanged
// change; no ignored content outside the regenerable list (REGENERABLE_IGNORED in
// branch-facts.js; .env* is listed, not judged); no rebase, merge, cherry-pick, revert or
// bisect in progress; no commit that only a reflog reaches; nothing on origin/<branch>
// the branch lacks; no open PR (and PRs were readable); not the default branch, the
// persistent main checkout, the current worktree, a locked or shared worktree; and, for a
// worktree, no process with its cwd inside it and no activity for --stale-days (a process
// check that cannot run is never "none").

const fs = require("node:fs");
const path = require("node:path");

const { deriveBranchLanding } = require("./lib/branch-landing");
const { inspectIndexLocks, removeStaleIndexLocks } = require("./lib/index-locks");
const { listProcessCwds, processesUnder } = require("./lib/process-holders");
const {
	DEFAULT_LOCK_MIN_AGE_MINUTES,
	DEFAULT_STALE_DAYS,
	MINUTE_MS,
	deriveWorktreeStaleness,
} = require("./lib/worktree-staleness");
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

function positiveNumber(value, flag) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) throw new Error(`${flag} needs a positive number`);
	return number;
}

function parseArgs(argv) {
	const options = {
		fetch: false,
		json: false,
		lockMinAgeMinutes: DEFAULT_LOCK_MIN_AGE_MINUTES,
		removeStaleLocks: false,
		staleDays: DEFAULT_STALE_DAYS,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") options.json = true;
		else if (arg === "--fetch") options.fetch = true;
		else if (arg === "--remove-stale-locks") options.removeStaleLocks = true;
		else if (arg === "--stale-days") options.staleDays = positiveNumber(argv[++index], arg);
		else if (arg === "--lock-min-age-minutes") options.lockMinAgeMinutes = positiveNumber(argv[++index], arg);
		else if (arg === "--help" || arg === "-h") options.help = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

function mtimeOrNull(file) {
	try {
		return fs.statSync(file).mtimeMs;
	} catch {
		return null;
	}
}

// The newest of: the head commit, the worktree's HEAD reflog (commits, checkouts,
// resets) and its index (staging, status refreshes by other tools). null when none reads.
async function readWorktreeActivity(git, worktreePath, gitDir) {
	const commitTime = await git(["-C", worktreePath, "log", "-1", "--format=%ct", "HEAD"]);
	const times = [
		commitTime.ok && commitTime.stdout.trim() ? Number(commitTime.stdout.trim()) * 1000 : null,
		gitDir ? mtimeOrNull(path.join(gitDir, "logs", "HEAD")) : null,
		gitDir ? mtimeOrNull(path.join(gitDir, "index")) : null,
	].filter((time) => Number.isFinite(time));
	return times.length ? Math.max(...times) : null;
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
	lockMinAgeMinutes = DEFAULT_LOCK_MIN_AGE_MINUTES,
	now = Date.now(),
	processCwds: readProcessCwds = listProcessCwds,
	removeStaleLocks = false,
	runCommand = createRunner({ timeoutMs: 15_000 }),
	readPrs = (branches) => readPullRequests(runCommand, cwd, branches),
	staleDays = DEFAULT_STALE_DAYS,
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

	const [prsByBranch, processCwds] = await Promise.all([readPrs(branches), readProcessCwds()]);
	const mainCheckoutPath = worktrees[0]?.path;
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
		const lastActivityMs = facts.worktree ? await readWorktreeActivity(git, facts.worktree.path, facts.worktree.gitDir) : null;
		return { target, facts, lastActivityMs };
	});
	// A rebase leaves its branch detached in the worktree doing it; that branch stays too.
	const rebasing = new Map();
	for (const { facts } of inspected) {
		const operation = facts.worktree?.operation;
		if (operation?.branch) rebasing.set(operation.branch, facts.worktree.path);
	}
	const results = inspected.map(({ target, facts, lastActivityMs }) => {
		const derived = deriveBranchLanding(facts);
		const landingBlockers = cleanBlockers({ derived, facts, target, defaultBranch, currentPath: top, mainCheckoutPath, rebasing });
		// A worktree is a candidate only when its staleness check says safe: one created a
		// minute ago, or with any process in it, stays whatever its landing.
		const staleness = facts.worktree
			? deriveWorktreeStaleness({
				lastActivityMs,
				now,
				staleDays,
				processes: processesUnder(processCwds, facts.worktree.path, { exclude: [process.pid] })?.map(({ pid, command }) => ({ pid, command })) ?? null,
				blockers: landingBlockers,
			})
			: null;
		const blockers = landingBlockers.length === 0 && staleness && !staleness.safe ? staleness.reasons : landingBlockers;
		return {
			gitDir: facts.worktree?.gitDir ?? null,
			staleness,
			branch: target.branch,
			worktree: target.worktree?.path ?? null,
			status: derived.status,
			nextAction: derived.nextAction,
			evidence: {
				...derived.evidence,
				ignoredEnvFiles: facts.worktree?.ignored?.env ?? [],
				// Whether vpk-git-clean may delete origin/<branch>: only when it has nothing the
				// landed local branch lacks. null when there is no remote branch or it is unknown.
				remoteSafeToDelete: facts.pushed ? facts.remoteAhead === 0 && landingBlockers.length === 0 : null,
			},
			cleanable: blockers.length === 0,
			blockers,
		};
	});
	const lockEntries = results.filter((entry) => entry.gitDir).map((entry) => ({
		worktree: entry.worktree,
		gitDir: entry.gitDir,
		protectedCheckout: entry.worktree === mainCheckoutPath,
	}));
	const indexLocks = await inspectIndexLocks(lockEntries, { now, minAgeMs: lockMinAgeMinutes * MINUTE_MS, readProcessCwds: async () => processCwds });
	// The recheck before each unlink reads the process table again.
	const lockRemovals = removeStaleLocks ? await removeStaleIndexLocks(indexLocks, { readProcessCwds }) : null;
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
		staleDays,
		processCheck: processCwds === null ? "unavailable" : "ok",
		stale: results.filter((entry) => entry.staleness?.stale === true).map(({ branch, worktree, staleness }) => ({ branch, worktree, ...staleness })),
		indexLocks: indexLocks.map(({ worktree, lock, ageMs, holders, worktreeProcesses, decision }) => ({
			worktree,
			lock,
			ageMinutes: Math.floor(ageMs / MINUTE_MS),
			holders,
			worktreeProcesses,
			decision: decision.action,
			reason: decision.reason,
		})),
		lockRemovals,
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
	lines.push(`stale worktrees (no activity for ${report.staleDays} days${report.processCheck === "ok" ? "" : "; process check unavailable, so none is safe"}): ${report.stale.length}`);
	for (const entry of report.stale) {
		lines.push(`  ${entry.safe ? "safe   " : "unsafe "} ${entry.worktree}  idle ${entry.idleDays}d  ${entry.reasons.join("; ")}`);
	}
	lines.push(`index.lock files: ${report.indexLocks.length}`);
	for (const lock of report.indexLocks) {
		const removal = report.lockRemovals?.find((entry) => entry.lock === lock.lock);
		const outcome = removal ? (removal.removed ? "removed" : `kept (${removal.reason})`) : lock.decision === "remove" ? "stale (pass --remove-stale-locks to remove)" : "kept";
		lines.push(`  ${lock.lock}  ${lock.ageMinutes} min  ${outcome}${lock.decision === "keep" && !removal ? `: ${lock.reason}` : ""}`);
	}
	lines.push("Worktrees and branches are never removed here; vpk-git-clean proves process ownership and removes them.");
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
