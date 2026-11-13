#!/usr/bin/env node
"use strict";

// Where the current branch (or --branch <name>) is on its way to main, and what to do
// next. Read-only: see scripts/lib/branch-facts.js. The status and "proven landed" are
// defined in scripts/lib/branch-landing.js.
//
//   node scripts/ship-status.js [--branch <name>] [--fetch] [--json]

const { deriveBranchLanding } = require("./lib/branch-landing");
const {
	collectBranchFacts,
	createGit,
	createRunner,
	fetchDefault,
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

async function collectShipStatus({ cwd = process.cwd(), branch: requested = null, fetch = false, runCommand = createRunner({ timeoutMs: 15_000 }), gateReader = readGate } = {}) {
	const git = createGit(runCommand, cwd);
	const defaultBranch = await resolveDefaultBranch(git);
	if (fetch) await fetchDefault(runCommand, cwd, defaultBranch);
	const current = (await git(["symbolic-ref", "--quiet", "--short", "HEAD"])).stdout.trim() || null;
	const branch = requested ?? current;
	const top = (await git(["rev-parse", "--show-toplevel"])).stdout.trim();
	const worktrees = (await listWorktrees(git)) ?? [];
	const worktree = branch
		? worktrees.find((entry) => entry.branch === branch) ?? null
		: worktrees.find((entry) => entry.path === top) ?? null;
	const localBranchExists = branch ? (await git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`])).code === 0 : false;
	const prsByBranch = branch ? await readPullRequests(runCommand, cwd, [branch]) : new Map();
	const prs = prsByBranch === null ? null : prsByBranch.get(branch) ?? [];
	const latest = prs?.length ? [...prs].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0))[0] : null;
	const gate = latest?.state === "OPEN" ? await gateReader(latest) : null;
	const facts = await collectBranchFacts({ git, branch, worktree, defaultBranch, prs, localBranchExists, gate });
	return { defaultBranch, ...deriveBranchLanding(facts) };
}

function formatShipStatus(status) {
	const { evidence } = status;
	const lines = [`ship status: ${status.status} (${evidence.branch ?? "detached HEAD"}) — next: ${status.nextAction}`];
	const proof = evidence.landed === true
		? `landed: yes, by ${evidence.proof}${evidence.landedBy ? ` #${evidence.landedBy}${evidence.exactHead ? " (exact head)" : " (tip differs from the PR head)"}` : ""}`
		: `landed: ${evidence.landed === false ? "no" : `unknown (${(evidence.missing ?? []).join(", ")})`}`;
	lines.push(`  ${proof}`);
	if (evidence.pr) lines.push(`  latest PR: #${evidence.pr.number} ${evidence.pr.state}${evidence.pr.url ? ` ${evidence.pr.url}` : ""}`);
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
