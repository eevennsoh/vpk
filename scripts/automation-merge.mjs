#!/usr/bin/env node

// The `automation-merge` job's whole decision chain (decision D11). For each open PR
// labelled `automation` + `automerge:allowed`, in ascending number:
//   1. eligibility (scripts/automation-merge-eligibility.mjs), which fixes the head SHA;
//   2. a clean Codex signal on exactly that SHA;
//   3. the vpk-git-ship review gate with --require-clear semantics, no waiting, no reruns;
//   4. eligibility again, pinned to the SHA, immediately before merging;
//   5. merge-remote.js with that SHA, which runs one more full gate itself.
// A failing check labels the PR `automerge:blocked` and comments the check names and URLs.
// After any merge, a clean checkout that has `main` checked out is fast-forwarded.
// Decisions read only labels, SHAs, file metadata, check states, review states and
// reaction metadata; never PR titles, bodies or comment text.
//
//   node scripts/automation-merge.mjs --repo <owner/name> [--json]
//
// Exit 0 when the run completed (each PR's outcome is in the report), 1 on a fatal error.

import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkEligibility, gh } from "./automation-merge-eligibility.mjs";

const require = createRequire(import.meta.url);

export const CODEX_LOGIN = "chatgpt-codex-connector[bot]";
export const BLOCKED_LABEL = "automerge:blocked";
// A Codex review body that carries findings; its no-findings signal is a +1 reaction.
const CODEX_FINDINGS_BODY = /\bP[0-3] Badge\b|review suggestions/iu;

function flatten(value) {
	return Array.isArray(value) ? value.flat(Infinity) : [];
}

async function ghJson(runGh, args) {
	const text = await runGh(args);
	return JSON.parse(text);
}

// Earliest time GitHub saw this head: the first check suite created for the SHA. GitHub
// sets this on push, unlike author or committer dates, which the pusher controls.
async function headSeenAt(runGh, repository, sha) {
	const pages = await ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/commits/${sha}/check-suites?per_page=100`]);
	const times = flatten(pages.map((page) => page?.check_suites ?? []))
		.map((suite) => Date.parse(suite?.created_at ?? ""))
		.filter(Number.isFinite);
	return times.length > 0 ? Math.min(...times) : null;
}

/**
 * Returns { state: "clean" | "findings" | "missing", reason }.
 * Clean means a Codex review on `sha` with no findings, or a Codex +1 on the PR created
 * after GitHub first saw `sha`. Any Codex review on `sha` with findings blocks, even when
 * its threads are resolved.
 */
export async function codexSignal({ prNumber, repository, sha, runGh = gh }) {
	const [reviewPages, commentPages, reactionPages, seenAt] = await Promise.all([
		ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/pulls/${prNumber}/reviews?per_page=100`]),
		ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/pulls/${prNumber}/comments?per_page=100`]),
		ghJson(runGh, ["api", "--paginate", "--slurp", `repos/${repository}/issues/${prNumber}/reactions?per_page=100`]),
		headSeenAt(runGh, repository, sha),
	]);
	const comments = flatten(commentPages);
	const headReviews = flatten(reviewPages).filter((review) => review?.user?.login === CODEX_LOGIN && review.commit_id === sha);
	const findings = headReviews.filter((review) => (
		String(review.state).toUpperCase() === "CHANGES_REQUESTED" ||
		comments.some((comment) => comment?.pull_request_review_id === review.id) ||
		CODEX_FINDINGS_BODY.test(String(review.body ?? ""))
	));
	if (findings.length > 0) return { state: "findings", reason: `Codex review ${findings.map((review) => review.id).join(", ")} on ${sha} has findings` };
	if (headReviews.length > 0) return { state: "clean", reason: `Codex review ${headReviews[0].id} on ${sha} has no findings` };
	if (seenAt === null) return { state: "missing", reason: `no check suite records when ${sha} was pushed` };
	const plusOne = flatten(reactionPages).find((reaction) => (
		reaction?.user?.login === CODEX_LOGIN && reaction.content === "+1" && Date.parse(reaction.created_at ?? "") > seenAt
	));
	return plusOne
		? { state: "clean", reason: `Codex +1 at ${plusOne.created_at} after ${sha} was pushed` }
		: { state: "missing", reason: `no Codex review or +1 for ${sha} yet` };
}

function checkList(checks) {
	return checks.map((check) => `- ${check.name}${check.url ? `: ${check.url}` : ""}`).join("\n");
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

	const codex = await deps.codexSignal({ prNumber, repository, sha, runGh: deps.runGh });
	if (codex.state !== "clean") return skip(sha, codex.reason);

	const gate = await deps.collectGate({ prNumber, repository });
	if (gate.headRefOid !== sha) return skip(sha, `head moved to ${gate.headRefOid} during the review gate`);
	if (gate.checks?.state === "failing") {
		await markBlocked({ prNumber, repository, sha, failing: gate.checks.failing ?? [], runGh: deps.runGh });
		return { number: prNumber, head: sha, outcome: "blocked", reasons: (gate.checks.failing ?? []).map((check) => `failing check ${check.name}`) };
	}
	if (gate.checks?.state !== "passing") return skip(sha, `checks are ${gate.checks?.state ?? "unknown"}`);
	const otherReviews = (gate.nonApprovingReviews ?? []).filter((review) => review.user !== CODEX_LOGIN);
	if (otherReviews.length > 0) return skip(sha, `non-approving reviews from ${[...new Set(otherReviews.map((review) => review.user))].join(", ")} need a human`);
	if (!gate.readyToMerge) {
		return skip(sha, `review gate not clear (unresolved threads ${gate.unresolvedThreads?.length ?? "?"}, merge state ${gate.mergeStateStatus ?? "unknown"})`);
	}

	const second = await deps.checkEligibility({ prNumber, repository, expectedHead: sha });
	if (!second.eligible) return skip(sha, ...second.reasons.map((reason) => `before merge: ${reason}`));

	const merged = await deps.mergeRemote({ prNumber, repository, expectedHead: sha });
	return {
		number: prNumber,
		head: sha,
		outcome: "merged",
		reasons: [codex.reason],
		mergeCommit: merged.mergeCommit,
		branchDeletion: merged.branchDeletion?.state ?? "unknown",
	};
}

function runGit(args) {
	return new Promise((resolve, reject) => {
		execFile("git", args, { encoding: "utf8", timeout: 120000 }, (error, stdout, stderr) => {
			if (error) reject(new Error(`git ${args.join(" ")} failed: ${(stderr || error.message).trim()}`));
			else resolve(stdout);
		});
	});
}

/** Fast-forwards the checkout that has `main` checked out, only when it is on main and clean. */
export async function syncMain({ runGit: git = runGit } = {}) {
	const listing = await git(["worktree", "list", "--porcelain"]);
	const worktree = listing.split("\n\n").map((block) => block.split("\n"))
		.find((lines) => lines.includes("branch refs/heads/main"))?.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
	if (!worktree) return { state: "skipped", reason: "no worktree has main checked out" };
	const branch = (await git(["-C", worktree, "branch", "--show-current"])).trim();
	if (branch !== "main") return { state: "skipped", worktree, reason: `checkout is on ${branch || "a detached HEAD"}` };
	if ((await git(["-C", worktree, "status", "--porcelain"])).trim()) return { state: "skipped", worktree, reason: "checkout has uncommitted changes" };
	await git(["-C", worktree, "pull", "--ff-only", "origin", "main"]);
	return { state: "synced", worktree };
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
			results.push({ number: prNumber, outcome: "error", reasons: [error instanceof Error ? error.message : String(error)] });
		}
	}
	let sync = { state: "skipped", reason: "nothing merged" };
	if (results.some((result) => result.outcome === "merged")) {
		try {
			sync = await syncMain({ runGit: deps.runGit });
		} catch (error) {
			sync = { state: "failed", reason: error instanceof Error ? error.message : String(error) };
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
		} else throw new Error(`Unknown argument: ${argument}`);
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
		const message = error instanceof Error ? error.message : String(error);
		if (options?.json) console.log(JSON.stringify({ error: message }));
		else console.error(`ERROR automation-merge: ${message}`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	await main();
}
