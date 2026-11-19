#!/usr/bin/env node

// The `automation-merge` job's whole decision chain (decision D11). For each open PR
// labelled `automation` + `automerge:allowed`, in ascending number:
//   1. eligibility (scripts/automation-merge-eligibility.mjs), which fixes the head SHA;
//   2. a clean Codex signal on exactly that SHA;
//   3. the vpk-git-ship review gate with --require-clear semantics, no waiting, no reruns;
//   4. eligibility pinned to the SHA and the Codex signal again, immediately before merging;
//   5. merge-remote.js with that SHA, which runs one more full gate itself.
// A failing check labels the PR `automerge:blocked` and comments the check names and URLs.
// After any merge, a clean checkout that has `main` checked out is fast-forwarded.
// Decisions read only labels, SHAs, file metadata, check states, review states and
// reaction metadata; never PR titles, bodies or comment text. Report reasons are fixed
// codes; PR-controlled strings pass through displayText().
//
//   node scripts/automation-merge.mjs --repo <owner/name> [--json]
//
// Exit 0 when the run completed (each PR's outcome is in the report), 1 on a fatal error.

import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkEligibility, displayText, gh } from "./automation-merge-eligibility.mjs";

const require = createRequire(import.meta.url);

export const CODEX_LOGIN = "chatgpt-codex-connector[bot]";
export const BLOCKED_LABEL = "automerge:blocked";

export const MERGE_REASONS = {
	codexFindings: "codex-findings",
	codexMissing: "codex-missing",
	codexUndated: "codex-head-push-unknown",
	codexApproved: "codex-approved",
	codexPlusOne: "codex-plus-one",
	headMoved: "head-moved-during-gate",
	failingCheck: "failing-check",
	checks: "checks-not-passing",
	humanReview: "non-codex-review-needs-human",
	gateNotClear: "review-gate-not-clear",
	beforeMerge: "before-merge",
	error: "error",
};

const reason = (code, detail) => (detail === undefined ? code : `${code}: ${detail}`);

// Error text can carry gh or git output; keep it to safe characters and a bounded length.
function errorText(error) {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/[^A-Za-z0-9 ._:/#,()=+-]/gu, "?").slice(0, 200);
}

function flatten(value) {
	return Array.isArray(value) ? value.flat(Infinity) : [];
}

async function ghJson(runGh, args) {
	const text = await runGh(args);
	return JSON.parse(text);
}

// When this head reached the PR's branch: the LATEST check suite GitHub created for the SHA
// on that branch. GitHub sets suite times on push, unlike commit dates, and taking the
// latest on the PR branch means an earlier push of the same SHA elsewhere cannot backdate it.
async function headSeenAt(runGh, repository, sha, headRefName) {
	const pages = await ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/commits/${sha}/check-suites?per_page=100`]);
	const times = flatten(pages.map((page) => page?.check_suites ?? []))
		.filter((suite) => suite?.head_branch === headRefName)
		.map((suite) => Date.parse(suite?.created_at ?? ""))
		.filter(Number.isFinite);
	return times.length > 0 ? Math.max(...times) : null;
}

/**
 * Returns { state: "clean" | "findings" | "missing", reason }.
 * Clean means a Codex APPROVED review on `sha` with no comments, or a Codex +1 on the PR
 * created after `sha` last reached `headRefName`. Any other Codex review on `sha` counts as
 * findings and blocks, even when its threads are resolved.
 */
export async function codexSignal({ prNumber, repository, sha, headRefName, runGh = gh }) {
	const [reviewPages, commentPages, reactionPages, seenAt] = await Promise.all([
		ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/pulls/${prNumber}/reviews?per_page=100`]),
		ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/pulls/${prNumber}/comments?per_page=100`]),
		ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/issues/${prNumber}/reactions?per_page=100`]),
		headSeenAt(runGh, repository, sha, headRefName),
	]);
	const comments = flatten(commentPages);
	const headReviews = flatten(reviewPages).filter((review) => review?.user?.login === CODEX_LOGIN && review.commit_id === sha);
	const isPureApproval = (review) => (
		String(review.state).toUpperCase() === "APPROVED" &&
		!String(review.body ?? "").trim() &&
		!comments.some((comment) => comment?.pull_request_review_id === review.id)
	);
	if (headReviews.some((review) => !isPureApproval(review))) return { state: "findings", reason: reason(MERGE_REASONS.codexFindings, sha) };
	if (headReviews.length > 0) return { state: "clean", reason: reason(MERGE_REASONS.codexApproved, sha) };
	if (seenAt === null) return { state: "missing", reason: reason(MERGE_REASONS.codexUndated, sha) };
	const plusOne = flatten(reactionPages).some((reaction) => (
		reaction?.user?.login === CODEX_LOGIN && reaction.content === "+1" && Date.parse(reaction.created_at ?? "") > seenAt
	));
	return plusOne
		? { state: "clean", reason: reason(MERGE_REASONS.codexPlusOne, sha) }
		: { state: "missing", reason: reason(MERGE_REASONS.codexMissing, sha) };
}

// Check names come from workflow files, which eligible PRs cannot change; still bound them.
const CHECK_NAME = /^[A-Za-z0-9 ._/()-]{1,80}$/u;
const checkName = (name) => (CHECK_NAME.test(String(name ?? "")) ? name : displayText(name));
const GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9._/-]{1,200}$/u;

function checkList(checks) {
	return checks.map((check) => {
		const url = GITHUB_URL.test(String(check.url ?? "")) ? `: ${check.url}` : "";
		return `- ${checkName(check.name)}${url}`;
	}).join("\n");
}

async function markBlocked({ prNumber, repository, sha, failing, runGh }) {
	await runGh(["api", "--method", "POST", `repos/${repository}/issues/${prNumber}/labels`, "-f", `labels[]=${BLOCKED_LABEL}`]);
	const body = [
		`automation-merge did not merge \`${sha}\` because these checks failed:`,
		"",
		checkList(failing),
		"",
		`Fix the failures and remove \`${BLOCKED_LABEL}\` to make the PR a merge candidate again.`,
	].join("\n");
	await runGh(["api", "--method", "POST", `repos/${repository}/issues/${prNumber}/comments`, "-f", `body=${body}`]);
}

function defaultDeps() {
	const { collectReviewGateStatus } = require("../.agents/skills/vpk-git-ship/scripts/review-gate-status.js");
	const { mergeRemote } = require("../.agents/skills/vpk-git-ship/scripts/merge-remote.js");
	return {
		runGh: gh,
		checkEligibility,
		codexSignal,
		collectGate: (options) => collectReviewGateStatus({ ...options, rerunInterrupted: 0, waitSeconds: 0 }),
		mergeRemote,
		runGit,
	};
}

/** Runs the chain for one PR and returns { number, head?, outcome, reasons[], ... }. */
export async function processCandidate({ prNumber, repository, deps }) {
	const skip = (head, ...reasons) => ({ number: prNumber, head, outcome: "skipped", reasons });

	const first = await deps.checkEligibility({ prNumber, repository });
	const sha = first.headRefOid;
	if (!first.eligible) return skip(sha, ...first.reasons);
	// Eligible decisions carry a validated `automation/...` branch name.
	const codexOptions = { prNumber, repository, sha, headRefName: first.headRefName, runGh: deps.runGh };

	const codex = await deps.codexSignal(codexOptions);
	if (codex.state !== "clean") return skip(sha, codex.reason);

	const gate = await deps.collectGate({ prNumber, repository });
	if (gate.headRefOid !== sha) return skip(sha, reason(MERGE_REASONS.headMoved, displayText(gate.headRefOid)));
	if (gate.checks?.state === "failing") {
		const failing = gate.checks.failing ?? [];
		await markBlocked({ prNumber, repository, sha, failing, runGh: deps.runGh });
		return { number: prNumber, head: sha, outcome: "blocked", reasons: failing.map((check) => reason(MERGE_REASONS.failingCheck, checkName(check.name))) };
	}
	if (gate.checks?.state !== "passing") return skip(sha, reason(MERGE_REASONS.checks, displayText(gate.checks?.state ?? "unknown")));
	if ((gate.nonApprovingReviews ?? []).some((review) => review.user !== CODEX_LOGIN)) return skip(sha, MERGE_REASONS.humanReview);
	if (!gate.readyToMerge) return skip(sha, MERGE_REASONS.gateNotClear);

	const [second, codexAgain] = await Promise.all([
		deps.checkEligibility({ prNumber, repository, expectedHead: sha }),
		deps.codexSignal(codexOptions),
	]);
	if (!second.eligible) return skip(sha, ...second.reasons.map((entry) => reason(MERGE_REASONS.beforeMerge, entry)));
	if (codexAgain.state !== "clean") return skip(sha, reason(MERGE_REASONS.beforeMerge, codexAgain.reason));

	const merged = await deps.mergeRemote({ prNumber, repository, expectedHead: sha });
	return {
		number: prNumber,
		head: sha,
		outcome: "merged",
		reasons: [codexAgain.reason],
		mergeCommit: displayText(merged.mergeCommit),
		branchDeletion: displayText(merged.branchDeletion?.state ?? "unknown"),
	};
}

function runGit(args) {
	return new Promise((resolve, reject) => {
		execFile("git", args, { encoding: "utf8", timeout: 120000 }, (error, stdout) => {
			if (error) reject(new Error(`git ${args.filter((part) => !part.startsWith("/")).join(" ")} failed (exit ${error.code ?? "unknown"})`));
			else resolve(stdout);
		});
	});
}

/** Fast-forwards the checkout that has `main` checked out, only when it is on main and clean. */
export async function syncMain({ runGit: git = runGit } = {}) {
	const listing = await git(["worktree", "list", "--porcelain"]);
	const worktree = listing.split("\n\n").map((block) => block.split("\n"))
		.find((lines) => lines.includes("branch refs/heads/main"))?.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
	if (!worktree) return { state: "skipped", reason: "no-main-worktree" };
	const branch = (await git(["-C", worktree, "branch", "--show-current"])).trim();
	if (branch !== "main") return { state: "skipped", reason: "main-worktree-not-on-main" };
	if ((await git(["-C", worktree, "status", "--porcelain"])).trim()) return { state: "skipped", reason: "main-worktree-dirty" };
	await git(["-C", worktree, "pull", "--ff-only", "origin", "main"]);
	return { state: "synced" };
}

export async function runAutomationMerge({ repository, deps = defaultDeps() }) {
	const candidates = (await ghJson(deps.runGh, [
		"pr", "list", "--repo", repository, "--state", "open", "--label", "automation", "--label", "automerge:allowed",
		"--limit", "100", "--json", "number",
	])).map((pr) => pr.number).filter(Number.isInteger).sort((left, right) => left - right);

	const results = [];
	for (const prNumber of candidates) {
		try {
			results.push(await processCandidate({ prNumber, repository, deps }));
		} catch (error) {
			results.push({ number: prNumber, outcome: "error", reasons: [reason(MERGE_REASONS.error, errorText(error))] });
		}
	}
	let sync = { state: "skipped", reason: "nothing-merged" };
	if (results.some((result) => result.outcome === "merged")) {
		try {
			sync = await syncMain({ runGit: deps.runGit });
		} catch (error) {
			sync = { state: "failed", reason: reason(MERGE_REASONS.error, errorText(error)) };
		}
	}
	return { repository, ranAt: new Date().toISOString(), candidates, results, sync };
}

export function formatReport(report) {
	const lines = [`automation-merge ${report.repository}: ${report.candidates.length} candidate(s)`];
	for (const result of report.results) {
		const detail = result.outcome === "merged" ? `merge ${result.mergeCommit}, branch ${result.branchDeletion}` : result.reasons.join("; ");
		lines.push(`#${result.number} ${result.outcome} @ ${result.head ?? "unknown"}: ${detail}`);
	}
	lines.push(`main sync: ${report.sync.state}${report.sync.reason ? ` (${report.sync.reason})` : ""}`);
	return lines.join("\n");
}

export function parseArgs(argv) {
	const options = { json: false };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--json") options.json = true;
		else if (argument === "--repo") {
			options.repository = argv[index + 1];
			index += 1;
		} else throw new Error(`Unknown argument: ${displayText(argument)}`);
	}
	if (!/^[\w.-]+\/[\w.-]+$/u.test(options.repository ?? "")) throw new Error("--repo <owner/name> is required");
	return options;
}

async function main() {
	let options;
	try {
		options = parseArgs(process.argv.slice(2));
		const report = await runAutomationMerge({ repository: options.repository });
		console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
	} catch (error) {
		if (options?.json) console.log(JSON.stringify({ error: errorText(error) }));
		else console.error(`ERROR automation-merge: ${errorText(error)}`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	await main();
}
