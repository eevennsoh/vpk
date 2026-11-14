#!/usr/bin/env node
"use strict";

// Where the current branch (or --branch <name>) is on its way to main, and what to do
// next. It writes no ref, worktree, index or config (what it does write is listed in
// scripts/lib/branch-facts.js). The status and "proven landed" are defined in
// scripts/lib/branch-landing.js. It does not decide cleanup: `main-synced` here is not
// "removable"; scripts/clean-candidates.js applies the cleanup blockers.
//
//   node scripts/ship-status.js [--branch <name>] [--fetch] [--json]

const { deriveBranchLanding } = require("./lib/branch-landing");
const {
	UNKNOWN_WORKTREE,
	collectBranchFacts,
	createGit,
	createRunner,
	fetchOrigin,
	listWorktrees,
	readPullRequests,
	resolveDefaultBranch,
} = require("./lib/branch-facts");

function parseArgs(argv) {
	const options = { branch: null, fetch: false, json: false };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") options.json = true;
		else if (arg === "--fetch") options.fetch = true;
		else if (arg === "--branch") options.branch = argv[++index] ?? null;
		else if (arg === "--help" || arg === "-h") options.help = true;
		else throw new Error(`unknown argument: ${arg}`);
	}
	return options;
}

// The open PR's review gate, reduced to what the derivation needs. null when it cannot be read.
async function readGate(pr) {
	try {
		const { collectReviewGateStatus } = require("../.agents/skills/vpk-git-ship/scripts/review-gate-status");
		const gate = await collectReviewGateStatus({ prNumber: pr.number, consistencyRetries: 1, delay: async () => {} });
		return {
			isDraft: pr.isDraft === true,
			checks: gate.checks.state,
			failingChecks: gate.checks.failing.map((check) => check.name),
			reviewGateClear: gate.reviewGateClear,
		};
	} catch {
		return null;
	}
}

const CLEANUP_NOTE = "not decided here: pnpm run clean-candidates -- --fetch decides whether a branch or worktree can be removed";

async function collectShipStatus({ cwd = process.cwd(), branch: requested = null, fetch = false, runCommand = createRunner({ timeoutMs: 15_000 }), gateReader = readGate } = {}) {
	const git = createGit(runCommand, cwd);
	const defaultBranch = await resolveDefaultBranch(git);
	const fetchState = fetch ? ((await fetchOrigin(runCommand, cwd)) ? "ok" : "failed") : "skipped";
	// Exit 1 is a detached HEAD; any other failure is not an answer.
	const symbolic = await git(["symbolic-ref", "--quiet", "--short", "HEAD"]);
	if (symbolic.code !== 0 && symbolic.code !== 1) throw new Error("git could not read the current branch");
	const current = symbolic.code === 0 ? symbolic.stdout.trim() || null : null;
	const branch = requested ?? current;
	const topResult = await git(["rev-parse", "--show-toplevel"]);
	const top = topResult.ok ? topResult.stdout.trim() : "";
	if (!top) throw new Error("git could not tell which worktree this is");
	// An unreadable worktree list is unknown, never "no worktree": the branch could be
	// checked out with changes in it.
	const worktrees = await listWorktrees(git);
	const worktree = worktrees === null
		? UNKNOWN_WORKTREE
		: branch
			? worktrees.find((entry) => entry.branch === branch) ?? null
			: worktrees.find((entry) => entry.path === top) ?? null;
	// Exit 0 exists, exit 1 does not; anything else (a timeout) is unknown, never "deleted".
	const shown = branch ? (await git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`])).code : 1;
	const localBranchExists = shown === 0 ? true : shown === 1 ? false : null;
	const prsByBranch = branch ? await readPullRequests(runCommand, cwd, [branch]) : new Map();
	const prs = prsByBranch === null ? null : prsByBranch.get(branch) ?? [];
	const latest = prs?.length ? [...prs].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0))[0] : null;
	const gate = latest?.state === "OPEN" ? await gateReader(latest) : null;
	const facts = await collectBranchFacts({ git, branch, worktree, defaultBranch, prs, localBranchExists, gate });
	return { defaultBranch, fetch: fetchState, ...deriveBranchLanding(facts), cleanup: CLEANUP_NOTE };
}

function formatShipStatus(status) {
	const { evidence } = status;
	const lines = [`ship status: ${status.status} (${evidence.branch ?? "detached HEAD"}) — next: ${status.nextAction}`];
	const proof = evidence.landed === true
		? `landed: yes, by ${evidence.proof}${evidence.landedBy ? ` #${evidence.landedBy}${evidence.exactHead ? " (exact head)" : " (tip differs from the PR head)"}` : ""}`
		: `landed: ${evidence.landed === false ? "no" : `unknown (${(evidence.missing ?? []).join(", ")})`}`;
	lines.push(`  ${proof}`);
	if (evidence.pr) lines.push(`  latest PR: #${evidence.pr.number} ${evidence.pr.state}${evidence.pr.url ? ` ${evidence.pr.url}` : ""}`);
	if (status.fetch === "failed") lines.push("  fetch failed: origin/* refs are from an earlier fetch");
	lines.push(`  cleanup: ${status.cleanup}`);
	return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
	const options = parseArgs(argv);
	if (options.help) {
		console.log("usage: node scripts/ship-status.js [--branch <name>] [--fetch] [--json]");
		return 0;
	}
	const status = await collectShipStatus(options);
	console.log(options.json ? JSON.stringify(status, null, 2) : formatShipStatus(status));
	return 0;
}

if (require.main === module) {
	main().then((code) => {
		process.exitCode = code;
	}, (error) => {
		console.error(`ship-status: ${error.message}`);
		process.exitCode = 1;
	});
}

module.exports = { collectShipStatus, formatShipStatus, parseArgs };
