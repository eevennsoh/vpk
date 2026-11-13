#!/usr/bin/env node
"use strict";

// Every local branch and worktree with its landing status, and which ones vpk-git-clean
// may remove. Read-only: it removes nothing (see scripts/lib/branch-facts.js). Removal,
// and its process-ownership proof, stay with the vpk-git-clean skill.
//
//   node scripts/clean-candidates.js [--fetch] [--json]

const fs = require("node:fs");

const { deriveBranchLanding } = require("./lib/branch-landing");
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

async function collectCleanCandidates({ cwd = process.cwd(), fetch = false, runCommand = createRunner({ timeoutMs: 15_000 }) } = {}) {
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
	const prsByBranch = await readPullRequests(runCommand, cwd, branches);
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
		const blockers = cleanBlockers({ derived, target, defaultBranch, currentPath: top, mainCheckoutPath: worktrees[0]?.path });
		return {
			branch: target.branch,
			worktree: target.worktree?.path ?? null,
			status: derived.status,
			nextAction: derived.nextAction,
			evidence: derived.evidence,
			cleanable: blockers.length === 0,
			blockers,
		};
	});
	return {
		defaultBranch,
		prsRead: prsByBranch !== null,
		candidates: results.filter((entry) => entry.cleanable),
		retained: results.filter((entry) => !entry.cleanable),
		missingWorktrees: missing.map((entry) => ({ worktree: entry.path, branch: entry.branch ?? null, head: entry.head ?? null, locked: entry.locked === true })),
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

module.exports = { cleanBlockers, collectCleanCandidates, formatCleanCandidates, parseArgs };
