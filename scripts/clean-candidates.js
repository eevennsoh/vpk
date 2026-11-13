#!/usr/bin/env node
"use strict";

// Every local branch and worktree with its landing status, which worktrees are stale
// (no branch activity and no process for --stale-days), and every index.lock with
// whether a process holds it. A report: it removes nothing, with one exception behind
// an explicit flag, --remove-stale-locks, which deletes an index.lock that no process
// holds and that is older than --lock-min-age-minutes (never in the persistent main
// checkout). Worktree and branch removal stay with the vpk-git-clean skill.
//
//   node scripts/clean-candidates.js [--fetch] [--json] [--stale-days N]
//     [--remove-stale-locks] [--lock-min-age-minutes N]

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
	fetchDefault,
	listLocalBranches,
	listWorktrees,
	readPullRequests,
	resolveDefaultBranch,
} = require("./lib/branch-facts");

const CONCURRENCY = 8;

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
async function readWorktreeActivity(git, worktreePath) {
	const [gitDirResult, commitTime] = await Promise.all([
		git(["-C", worktreePath, "rev-parse", "--absolute-git-dir"]),
		git(["-C", worktreePath, "log", "-1", "--format=%ct", "HEAD"]),
	]);
	const gitDir = gitDirResult.ok ? gitDirResult.stdout.trim() : null;
	const times = [
		commitTime.ok && commitTime.stdout.trim() ? Number(commitTime.stdout.trim()) * 1000 : null,
		gitDir ? mtimeOrNull(path.join(gitDir, "logs", "HEAD")) : null,
		gitDir ? mtimeOrNull(path.join(gitDir, "index")) : null,
	].filter((time) => Number.isFinite(time));
	return { gitDir, lastActivityMs: times.length ? Math.max(...times) : null };
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

// Why a target must stay, from its derived status and where it lives. Empty means it is
// landed, synced and clean; vpk-git-clean still proves process ownership before removal.
function cleanBlockers({ derived, target, defaultBranch, currentPath, mainCheckoutPath }) {
	const blockers = [];
	if (derived.status !== "main-synced") blockers.push(`${derived.status}: ${derived.nextAction}`);
	if (target.branch === defaultBranch) blockers.push("default branch");
	if (target.worktree?.path === mainCheckoutPath) blockers.push("persistent main checkout");
	if (target.worktree?.path === currentPath) blockers.push("current worktree");
	if (target.worktree?.locked) blockers.push("worktree is locked");
	if (derived.evidence.pr?.state === "OPEN") blockers.push(`open PR #${derived.evidence.pr.number}`);
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
	staleDays = DEFAULT_STALE_DAYS,
} = {}) {
	const git = createGit(runCommand, cwd);
	const defaultBranch = await resolveDefaultBranch(git);
	if (fetch) await fetchDefault(runCommand, cwd, defaultBranch);
	const [worktrees, branches, top] = await Promise.all([
		listWorktrees(git),
		listLocalBranches(git),
		git(["rev-parse", "--show-toplevel"]).then((result) => result.stdout.trim()),
	]);
	if (worktrees === null || branches === null) throw new Error("git could not list worktrees or branches");

	// A registered worktree whose directory is gone has nothing to inspect or remove:
	// `git worktree prune` is the cleanup (after `git worktree unlock` for a locked one),
	// and vpk-git-clean decides when to run it.
	const isMissing = (entry) => entry.prunable || !fs.existsSync(entry.path);
	const missing = worktrees.filter(isMissing);
	const live = worktrees.filter((entry) => !isMissing(entry));
	const targets = [
		...branches.map((branch) => ({ branch, worktree: live.find((entry) => entry.branch === branch) ?? null })),
		...live.filter((entry) => !entry.branch).map((worktree) => ({ branch: null, worktree })),
	];
	const [prsByBranch, processCwds] = await Promise.all([readPullRequests(runCommand, cwd, branches), readProcessCwds()]);
	const mainCheckoutPath = worktrees[0]?.path;
	const results = await mapLimit(targets, CONCURRENCY, async (target) => {
		const prs = target.branch === null ? [] : prsByBranch === null ? null : prsByBranch.get(target.branch) ?? [];
		const facts = await collectBranchFacts({
			git,
			branch: target.branch,
			worktree: target.worktree,
			defaultBranch,
			prs,
			localBranchExists: target.branch !== null,
		});
		const derived = deriveBranchLanding(facts);
		const blockers = cleanBlockers({ derived, target, defaultBranch, currentPath: top, mainCheckoutPath });
		const entry = {
			branch: target.branch,
			worktree: target.worktree?.path ?? null,
			status: derived.status,
			nextAction: derived.nextAction,
			evidence: derived.evidence,
			cleanable: blockers.length === 0,
			blockers,
		};
		if (target.worktree) {
			const activity = await readWorktreeActivity(git, target.worktree.path);
			entry.gitDir = activity.gitDir;
			entry.staleness = deriveWorktreeStaleness({
				lastActivityMs: activity.lastActivityMs,
				now,
				staleDays,
				processes: processesUnder(processCwds, target.worktree.path, { exclude: [process.pid] })?.map(({ pid, command }) => ({ pid, command })) ?? null,
				blockers,
			});
		}
		return entry;
	});

	const lockEntries = results.filter((entry) => entry.gitDir).map((entry) => ({
		worktree: entry.worktree,
		gitDir: entry.gitDir,
		protectedCheckout: entry.worktree === mainCheckoutPath,
	}));
	const indexLocks = await inspectIndexLocks(lockEntries, { now, minAgeMs: lockMinAgeMinutes * MINUTE_MS });
	const lockRemovals = removeStaleLocks ? await removeStaleIndexLocks(indexLocks) : null;
	return {
		defaultBranch,
		prsRead: prsByBranch !== null,
		candidates: results.filter((entry) => entry.cleanable),
		retained: results.filter((entry) => !entry.cleanable),
		missingWorktrees: missing.map((entry) => ({ worktree: entry.path, branch: entry.branch ?? null, head: entry.head ?? null, locked: entry.locked === true })),
		staleDays,
		processCheck: processCwds === null ? "unavailable" : "ok",
		stale: results.filter((entry) => entry.staleness?.stale === true).map(({ branch, worktree, staleness }) => ({ branch, worktree, ...staleness })),
		indexLocks: indexLocks.map(({ worktree, lock, ageMs, holders, decision }) => ({
			worktree,
			lock,
			ageMinutes: Math.floor(ageMs / MINUTE_MS),
			holders,
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
		lines.push(`  ${report.missingWorktrees.length} registered worktree(s) whose directory is gone (${locked} locked); see git worktree prune --dry-run --verbose`);
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

module.exports = { cleanBlockers, collectCleanCandidates, formatCleanCandidates, parseArgs };
