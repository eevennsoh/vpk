#!/usr/bin/env node

"use strict";

const { execFile } = require("node:child_process");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GRAPHQL_QUERY = `query($owner:String!,$name:String!,$number:Int!,$after:String){
	repository(owner:$owner,name:$name){pullRequest(number:$number){
		headRefOid reviewDecision mergeStateStatus
		reviewThreads(first:100,after:$after){
			pageInfo{hasNextPage endCursor}
			nodes{id isResolved isOutdated path line startLine
				comments(first:100){nodes{databaseId url author{login} createdAt}}}
		}
	}}
}`;

const PASSING_CONCLUSIONS = new Set(["NEUTRAL", "SKIPPED", "SUCCESS"]);
const PENDING_STATES = new Set(["EXPECTED", "IN_PROGRESS", "PENDING", "QUEUED", "REQUESTED", "WAITING"]);
// A cancelled or timed-out run never reached a verdict, so it is rerunnable rather than failing.
const INTERRUPTED_CONCLUSIONS = new Set(["CANCELLED", "TIMED_OUT"]);
// GitHub branch protection is not enforced on this private repo, so the merge gate
// itself must require CI. A required check that has not reported yet counts as pending.
const DEFAULT_REQUIRED_CHECKS = ["PR checks"];
const REVIEW_DECISIONS = new Set([null, "APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"]);
// GitHub refuses to start Actions jobs when account billing fails. The check then reports
// FAILURE after 1-2 seconds with this annotation, so it says nothing about the code.
const BILLING_ANNOTATION_PATTERN = /spending limit|payments have failed|billing & plans/iu;
// Billing-blocked is not clear, but it is the one CI state the caller may replace with a
// local `pnpm run ci:pr` run on the PR head. Real failures still exit 2.
const BILLING_BLOCKED_EXIT_CODE = 3;
// A failed check makes an unprotected PR UNSTABLE; anything else (DIRTY, BLOCKED, ...) still blocks.
const LOCAL_CI_MERGE_STATES = new Set(["CLEAN", "UNSTABLE"]);

// Resolve process errors as results so reads can classify transient failures without
// retrying JSON/schema errors or mutations with an unknown outcome.
function executeGh(command, args, options) {
	return new Promise((resolve) => {
		execFile(command, args, { ...options, timeout: 60000 }, (error, stdout, stderr) => {
			resolve({ status: error ? (Number.isInteger(error.code) ? error.code : 1) : 0, stdout, stderr: stderr || error?.message || "" });
		});
	});
}

function workflowRunId(url) {
	const match = /\/actions\/runs\/(\d+)/u.exec(url ?? "");
	return match ? match[1] : null;
}

function checkRunId(url) {
	const match = /\/job\/(\d+)/u.exec(url ?? "");
	return match ? match[1] : null;
}

function isBillingAnnotation(annotation) {
	return BILLING_ANNOTATION_PATTERN.test(`${annotation?.title ?? ""}\n${annotation?.message ?? ""}`);
}

async function rerunWorkflowRun(runId, options = {}) {
	// No retry: the server may have accepted a mutation even when the connection fails.
	await runGhJson(["api", `repos/${options.repository}/actions/runs/${runId}/rerun`, "--method", "POST"], { ...options, readOnly: false, allowEmpty: true });
}

function isAuthenticationFailure(result) {
	return /bad credentials|authentication|HTTP 401|invalid token|requires authentication/iu
		.test(`${result.stderr ?? ""}\n${result.stdout ?? ""}`);
}

function isTransientReadFailure(result) {
	return /HTTP (?:408|429|500|502|503|504)\b|ECONNRESET|ETIMEDOUT|EAI_AGAIN|connection reset|connection timed out|TLS handshake timeout|\bEOF\b|temporary failure in name resolution/iu
		.test(`${result.stderr ?? ""}\n${result.stdout ?? ""}`);
}

function isReadOnlyRequest(args) {
	if (["pr", "repo"].includes(args[0])) return args[1] === "view";
	if (args[0] !== "api") return false;
	if (args[1] === "graphql") return args.some((arg) => /^query=\s*(?:query\b|\{)/u.test(arg));
	const methodIndex = args.findIndex((arg) => arg === "--method" || arg === "-X");
	if (methodIndex !== -1) return args[methodIndex + 1] === "GET";
	// Fields make gh api default to POST; unknown method spellings fail closed.
	return !args.some((arg) => /^(?:-f|-F|--field|--raw-field|-X|--method)/u.test(arg));
}

async function runGhJson(args, { env = process.env, spawn = executeGh, readOnly = true, retries = 2, sleep = delay, allowEmpty = false } = {}) {
	if (!Number.isInteger(retries) || retries < 0 || retries > 3) throw new Error("Read retries must be between 0 and 3");
	const retryRead = readOnly && isReadOnlyRequest(args);
	let currentEnv = env;
	let fallbackUsed = false;
	let attempt = 0;
	while (true) {
		const result = await spawn("gh", args, { encoding: "utf8", env: currentEnv, maxBuffer: 20 * 1024 * 1024 });
		if (result.status !== 0) {
			if (retryRead && !fallbackUsed && Object.hasOwn(currentEnv, "GITHUB_TOKEN") && isAuthenticationFailure(result)) {
				currentEnv = { ...currentEnv };
				delete currentEnv.GITHUB_TOKEN;
				fallbackUsed = true;
				continue;
			}
			if (retryRead && !isAuthenticationFailure(result) && isTransientReadFailure(result) && attempt < retries) {
				await sleep(250 * 2 ** attempt++);
				continue;
			}
			const detail = (result.stderr ?? "").trim().split("\n")[0] || `exit ${result.status ?? 1}`;
			throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${detail}`);
		}
		if (allowEmpty && !result.stdout?.trim()) return null;
		let parsed;
		try { parsed = JSON.parse(result.stdout); }
		catch { throw new Error(`gh ${args.slice(0, 2).join(" ")} returned invalid JSON`); }
		if (parsed?.errors?.length) throw new Error("GitHub returned GraphQL errors");
		return parsed;
	}
}

function flattenPages(value) {
	if (!Array.isArray(value) || value.some((page) => !Array.isArray(page))) {
		throw new Error("GitHub paginated REST response must contain arrays of pages");
	}
	return value.flat();
}

function splitRepository(repository) {
	const parts = repository.split("/");
	if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_.-]+$/u.test(part))) {
		throw new Error(`Repository must be owner/name: ${repository}`);
	}
	return { name: parts[1], owner: parts[0] };
}

async function resolveRepository(runGh, repository) {
	if (repository) return repository;
	const result = await runGh(["repo", "view", "--json", "nameWithOwner"]);
	if (typeof result.nameWithOwner !== "string") {
		throw new Error("gh repo view did not return nameWithOwner");
	}
	return result.nameWithOwner;
}

async function fetchGraphqlThreads({ name, owner, prNumber, runGh }) {
	const threads = [];
	let after = null;
	let pageCount = 0;
	let pullRequestState = null;
	const cursors = new Set();
	do {
		const args = [
			"api",
			"graphql",
			"-f",
			`owner=${owner}`,
			"-f",
			`name=${name}`,
			"-F",
			`number=${prNumber}`,
			"-f",
			`query=${GRAPHQL_QUERY}`,
		];
		if (after) args.push("-f", `after=${after}`);
		const result = await runGh(args);
		const pullRequest = result.data?.repository?.pullRequest;
		if (result.errors?.length || !pullRequest || typeof pullRequest.headRefOid !== "string" ||
			!REVIEW_DECISIONS.has(pullRequest.reviewDecision) || typeof pullRequest.mergeStateStatus !== "string" ||
			!Array.isArray(pullRequest.reviewThreads?.nodes) ||
			typeof pullRequest.reviewThreads?.pageInfo?.hasNextPage !== "boolean") {
			throw new Error(`Invalid GraphQL reviewThreads response for #${prNumber}`);
		}
		if (pullRequestState && pullRequestState.headRefOid !== pullRequest.headRefOid) throw new Error("PR head changed during GraphQL pagination");
		for (const thread of pullRequest.reviewThreads.nodes) {
			if (typeof thread.id !== "string" || typeof thread.isResolved !== "boolean" || !Array.isArray(thread.comments?.nodes)) {
				throw new Error("Invalid GraphQL review thread");
			}
		}
		pullRequestState = pullRequest;
		threads.push(...(pullRequest.reviewThreads?.nodes ?? []));
		pageCount += 1;
		const pageInfo = pullRequest.reviewThreads?.pageInfo ?? {};
		after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
		if (pageInfo.hasNextPage && (typeof after !== "string" || !after || cursors.has(after))) {
			throw new Error("GraphQL reviewThreads has missing or repeated endCursor");
		}
		if (after) cursors.add(after);
	} while (after);
	return {
		headRefOid: pullRequestState.headRefOid,
		mergeStateStatus: pullRequestState?.mergeStateStatus ?? null,
		pageCount,
		reviewDecision: pullRequestState?.reviewDecision ?? null,
		threads,
	};
}

function checkConclusion(check) {
	return String(check.conclusion ?? check.state ?? "").toUpperCase();
}

function normalizeCheck(check) {
	const conclusion = checkConclusion(check);
	const status = String(check.status ?? "").toUpperCase();
	return {
		billingBlocked: check.billingBlocked === true,
		conclusion: conclusion || null,
		name: check.name ?? check.context ?? "Unnamed check",
		status: status || null,
		url: check.detailsUrl ?? check.targetUrl ?? null,
	};
}

function classifyChecks(checks, requiredChecks = []) {
	const normalized = checks.map(normalizeCheck);
	const reported = new Set(normalized.map((check) => check.name));
	for (const name of requiredChecks) {
		if (!reported.has(name)) normalized.push({ conclusion: null, name, status: "MISSING", url: null });
	}
	const billingBlocked = [];
	const failing = [];
	const interrupted = [];
	const pending = [];
	const passing = [];
	for (const check of normalized) {
		if (PENDING_STATES.has(check.status) || PENDING_STATES.has(check.conclusion) || !check.conclusion) {
			pending.push(check);
		} else if (PASSING_CONCLUSIONS.has(check.conclusion) && (!requiredChecks.includes(check.name) || check.conclusion === "SUCCESS")) {
			passing.push(check);
		} else if (INTERRUPTED_CONCLUSIONS.has(check.conclusion)) {
			interrupted.push(check);
		} else if (check.billingBlocked) {
			billingBlocked.push(check);
		} else {
			failing.push(check);
		}
	}
	let state = "passing";
	if (failing.length > 0) state = "failing";
	else if (pending.length > 0) state = "pending";
	else if (interrupted.length > 0) state = "interrupted";
	else if (billingBlocked.length > 0) state = "billing-blocked";
	return {
		billingBlocked,
		failing,
		interrupted,
		passing,
		pending,
		state,
	};
}

function threadComments(thread) {
	if (Array.isArray(thread.comments)) return thread.comments;
	return Array.isArray(thread.comments?.nodes) ? thread.comments.nodes : [];
}

function summarizeThread(thread) {
	return {
		commentUrls: threadComments(thread).map((comment) => comment.url).filter(Boolean),
		id: thread.id,
		isOutdated: Boolean(thread.isOutdated),
		line: thread.line ?? null,
		path: thread.path ?? null,
		startLine: thread.startLine ?? null,
	};
}

function reconcileSnapshot(snapshot, requiredChecks = DEFAULT_REQUIRED_CHECKS) {
	const graphCommentIds = new Set(
		snapshot.graphql.threads.flatMap((thread) => (
			threadComments(thread).map((comment) => comment.databaseId).filter(Number.isInteger)
		)),
	);
	const topLevelComments = snapshot.restComments.filter((comment) => !comment.in_reply_to_id);
	const missingRestCommentIds = topLevelComments
		.map((comment) => comment.id)
		.filter((id) => Number.isInteger(id) && !graphCommentIds.has(id))
		.sort((left, right) => left - right);
	const unresolvedThreads = snapshot.graphql.threads
		.filter((thread) => !thread.isResolved)
		.map(summarizeThread);
	const nonApprovingReviews = snapshot.restReviews
		.filter((review) => !["APPROVED", "DISMISSED"].includes(String(review.state).toUpperCase()))
		.map((review) => ({
			id: review.id,
			state: review.state,
			user: review.user?.login ?? null,
		}));
	const checks = classifyChecks(snapshot.pullRequest.statusCheckRollup ?? [], requiredChecks);
	const reviewDecision = snapshot.pullRequest.reviewDecision ?? snapshot.graphql.reviewDecision;
	const mergeStateStatus = snapshot.pullRequest.mergeStateStatus ?? snapshot.graphql.mergeStateStatus;
	const reviewGateClear = (
		unresolvedThreads.length === 0 &&
		missingRestCommentIds.length === 0 &&
		reviewDecision !== "CHANGES_REQUESTED" &&
		snapshot.graphql.reviewDecision !== "CHANGES_REQUESTED"
	);
	return {
		checks,
		// Everything but CI is clear and CI never ran because of billing: a local ci:pr pass may stand in.
		clearExceptBillingBlockedChecks: (
			reviewGateClear && snapshot.pullRequest.state === "OPEN" && !snapshot.pullRequest.isDraft &&
			checks.state === "billing-blocked" &&
			LOCAL_CI_MERGE_STATES.has(mergeStateStatus)
		),
		graphqlPageCount: snapshot.graphql.pageCount,
		headRefOid: snapshot.pullRequest.headRefOid,
		mergeStateStatus,
		missingRestCommentIds,
		nonApprovingReviews,
		number: snapshot.pullRequest.number,
		readyToMerge: reviewGateClear && checks.state === "passing" && mergeStateStatus === "CLEAN" &&
			snapshot.pullRequest.state === "OPEN" && !snapshot.pullRequest.isDraft,
		repository: snapshot.repository,
		reviewDecision,
		reviewGateClear,
		threadCount: snapshot.graphql.threads.length,
		unresolvedThreads,
		updatedAt: snapshot.pullRequest.updatedAt,
		url: snapshot.pullRequest.url,
	};
}

// Marks FAILURE checks whose check-run annotations say GitHub never started the job for billing.
// An annotation fetch error leaves the check failing, the stricter classification.
async function markBillingBlockedChecks({ checks, repository, runGh }) {
	return Promise.all(checks.map(async (check) => {
		const id = checkConclusion(check) === "FAILURE" ? checkRunId(check.detailsUrl ?? check.targetUrl) : null;
		if (!id) return check;
		try {
			const annotations = flattenPages(await runGh([
				"api",
				`repos/${repository}/check-runs/${id}/annotations`,
				"--paginate",
				"--slurp",
			]));
			return annotations.some(isBillingAnnotation) ? { ...check, billingBlocked: true } : check;
		} catch {
			return check;
		}
	}));
}

const PR_FIELDS = "number,url,state,isDraft,headRefOid,updatedAt,reviewDecision,mergeStateStatus,statusCheckRollup";

async function readPullRequest({ prNumber, repository, runGh, fields = PR_FIELDS }) {
	const pr = await runGh(["pr", "view", String(prNumber), "--repo", repository, "--json", fields]);
	if (typeof pr.headRefOid !== "string" || !pr.headRefOid || typeof pr.updatedAt !== "string") throw new Error("Invalid PR head response");
	if (fields === PR_FIELDS && (pr.number !== prNumber || !["OPEN", "CLOSED", "MERGED"].includes(pr.state) ||
		typeof pr.isDraft !== "boolean" || !Array.isArray(pr.statusCheckRollup) ||
		typeof pr.mergeStateStatus !== "string" || (!REVIEW_DECISIONS.has(pr.reviewDecision) && pr.reviewDecision !== ""))) throw new Error("Invalid PR status response");
	// gh exports a nullable GraphQL enum as an empty Go string on unprotected PRs.
	return fields === PR_FIELDS ? { ...pr, reviewDecision: pr.reviewDecision || null } : pr;
}

async function collectSnapshot({ prNumber, repository, runGh }) {
	const { name, owner } = splitRepository(repository);
	const [pullRequest, graphql, commentsPages, reviewsPages] = await Promise.all([
		readPullRequest({ prNumber, repository, runGh }),
		fetchGraphqlThreads({ name, owner, prNumber, runGh }),
		runGh(["api", `repos/${repository}/pulls/${prNumber}/comments`, "--paginate", "--slurp"]),
		runGh(["api", `repos/${repository}/pulls/${prNumber}/reviews`, "--paginate", "--slurp"]),
	]);
	const restComments = flattenPages(commentsPages);
	const restReviews = flattenPages(reviewsPages);
	if (restComments.some((comment) => !Number.isInteger(comment?.id)) || restReviews.some((review) => !Number.isInteger(review?.id) || typeof review.state !== "string")) {
		throw new Error("Invalid REST review response");
	}
	const statusCheckRollup = await markBillingBlockedChecks({ checks: pullRequest.statusCheckRollup, repository, runGh });
	const confirmed = await readPullRequest({ prNumber, repository, runGh, fields: "headRefOid,updatedAt" });
	if (pullRequest.headRefOid !== confirmed.headRefOid || graphql.headRefOid !== confirmed.headRefOid) {
		throw new Error("PR head changed during review reconciliation; rerun for the current candidate");
	}
	return {
		graphql,
		pullRequest: { ...pullRequest, statusCheckRollup },
		repository,
		restComments,
		restReviews,
		stable: pullRequest.updatedAt === confirmed.updatedAt && pullRequest.reviewDecision === graphql.reviewDecision && pullRequest.mergeStateStatus === graphql.mergeStateStatus,
		fingerprint: JSON.stringify(pullRequest),
	};
}

async function collectReviewGateStatus({
	consistencyRetries = 6,
	delay: sleep = delay,
	prNumber,
	repository,
	requiredChecks = DEFAULT_REQUIRED_CHECKS,
	runGh = runGhJson,
	rerunInterrupted = 0,
	rerunRun = rerunWorkflowRun,
	waitSeconds = 0,
	pollSeconds = 30,
	now = () => Date.now(),
} = {}) {
	if (!Number.isInteger(prNumber) || prNumber < 1) {
		throw new Error("prNumber must be a positive integer");
	}
	const resolvedRepository = await resolveRepository(runGh, repository);
	let deadline = now() + waitSeconds * 1000;
	let checkPolls = 0;
	const reruns = [];
	// A rerun job gets a new URL, so a URL already rerun is a stale rollup entry, not a new interruption.
	const rerunJobUrls = new Set();
	let consistencyAttempts = 0;
	let status;
	let fingerprint;
	let fullReconciliations = 0;
	let lightweightPolls = 0;
	try {
		// Poll while required checks are still running, up to waitSeconds.
		while (true) {
			checkPolls += 1;
			let reconcile = !status || now() >= deadline;
			if (!reconcile) {
				const current = await readPullRequest({ prNumber, repository: resolvedRepository, runGh });
				lightweightPolls += 1;
				if (current.headRefOid !== status.headRefOid) throw new Error("PR head changed while waiting; rerun for the current candidate");
				reconcile = JSON.stringify(current) !== fingerprint;
			}
			if (reconcile) {
				consistencyAttempts = 0;
				for (;;) {
					consistencyAttempts += 1;
					const snapshot = await collectSnapshot({ prNumber, repository: resolvedRepository, runGh });
					fullReconciliations += 1;
					if (status && snapshot.pullRequest.headRefOid !== status.headRefOid) throw new Error("PR head changed while waiting");
					status = reconcileSnapshot(snapshot, requiredChecks);
					fingerprint = snapshot.fingerprint;
					if (snapshot.stable && status.missingRestCommentIds.length === 0) break;
					if (consistencyAttempts > consistencyRetries) {
						if (!snapshot.stable) throw new Error("PR changed throughout review reconciliation");
						break;
					}
					await sleep(5000);
				}
			}
			if (status.checks.state === "interrupted" && reruns.length < rerunInterrupted) {
				const fresh = status.checks.interrupted.filter((check) => !rerunJobUrls.has(check.url));
				// Never rerun a run GitHub refused to start for billing; it would be refused again.
				const billingRunIds = new Set(status.checks.billingBlocked.map((check) => workflowRunId(check.url)));
				const runIds = [...new Set(fresh.map((check) => workflowRunId(check.url)).filter(Boolean))]
					.filter((runId) => !billingRunIds.has(runId)).slice(0, rerunInterrupted - reruns.length);
				if (runIds.length > 0) {
					for (const check of fresh) {
						if (runIds.includes(workflowRunId(check.url))) rerunJobUrls.add(check.url);
					}
					for (const runId of runIds) {
						reruns.push(runId);
						process.stderr.write(`Attempting interrupted-run rerun ${runId}; total attempts: ${reruns.length}/${rerunInterrupted}\n`);
						try { await rerunRun(runId, { repository: resolvedRepository }); }
						catch (error) { throw new Error(`Rerun outcome unknown; do not repeat automatically. Attempted runs: ${reruns.join(", ")}. ${error.message}`); }
					}
					deadline = now() + waitSeconds * 1000;
					await sleep(pollSeconds * 1000);
					continue;
				}
			}
			const rerunSettling = status.checks.state === "interrupted" &&
				status.checks.interrupted.every((check) => rerunJobUrls.has(check.url));
			if ((status.checks.state !== "pending" && !rerunSettling) || now() >= deadline) break;
			await sleep(pollSeconds * 1000);
		}
		return {
			...status,
			checkPolls,
			fullReconciliations,
			lightweightPolls,
			consistencyAttempts,
			reruns,
			queriedAt: new Date().toISOString(),
		};
	} catch (error) {
		error.reruns = [...reruns];
		if (reruns.length) error.message += `; attempted reruns (including unknown outcomes): ${reruns.join(", ")}`;
		throw error;
	}
}

function parseArgs(argv) {
	const options = {
		consistencyRetries: 6,
		json: false,
		requireClear: false,
		requiredChecks: [...DEFAULT_REQUIRED_CHECKS],
		rerunInterrupted: 0,
		waitSeconds: 0,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--json") {
			options.json = true;
			continue;
		}
		if (argument === "--require-clear") {
			options.requireClear = true;
			continue;
		}
		if (["--pr", "--repo", "--consistency-retries", "--wait", "--required-check", "--rerun-interrupted"].includes(argument)) {
			const value = argv[index + 1];
			if (!value) throw new Error(`${argument} requires a value`);
			index += 1;
			if (argument === "--pr") options.prNumber = Number(value);
			if (argument === "--repo") options.repository = value;
			if (argument === "--consistency-retries") options.consistencyRetries = Number(value);
			if (argument === "--wait") options.waitSeconds = Number(value);
			if (argument === "--rerun-interrupted") options.rerunInterrupted = Number(value);
			if (argument === "--required-check") {
				if (!options.requiredChecksSet) options.requiredChecks = [];
				options.requiredChecksSet = true;
				options.requiredChecks.push(value);
			}
			continue;
		}
		if (argument === "--help" || argument === "-h") {
			options.help = true;
			continue;
		}
		throw new Error(`Unknown argument: ${argument}`);
	}
	if (!Number.isInteger(options.consistencyRetries) || options.consistencyRetries < 0) {
		throw new Error("--consistency-retries must be a non-negative integer");
	}
	if (!Number.isInteger(options.rerunInterrupted) || options.rerunInterrupted < 0) {
		throw new Error("--rerun-interrupted must be a non-negative integer");
	}
	if (!Number.isFinite(options.waitSeconds) || options.waitSeconds < 0) {
		throw new Error("--wait must be a non-negative number of seconds");
	}
	delete options.requiredChecksSet;
	return options;
}

function printHelp() {
	process.stdout.write([
		"Usage: review-gate-status --pr <number> [--repo owner/name] [--json] [--require-clear]",
		"                          [--wait <seconds>] [--rerun-interrupted <count>] [--required-check <name>]...",
		"",
		"Fetches current-head PR checks, every GraphQL review thread page, and paginated REST review surfaces.",
		"Use --require-clear to exit non-zero unless checks pass, review surfaces agree, and merge state is CLEAN.",
		"Use --wait to keep polling while checks are pending. A required check that has not reported yet",
		`counts as pending (default required: ${DEFAULT_REQUIRED_CHECKS.join(", ")}).`,
		"Use --rerun-interrupted to rerun cancelled or timed-out workflow runs up to <count> times, waiting",
		"the full --wait again after each rerun. Real failures are never rerun.",
		"A failed check whose annotation says GitHub did not start the job for billing is billing-blocked,",
		`not failing. It is never rerun. With --require-clear, exit ${BILLING_BLOCKED_EXIT_CODE} means billing-blocked checks are`,
		"the only blocker: run `pnpm run ci:pr` locally on the PR head instead. Other blockers exit 2.",
	].join("\n") + "\n");
}

function formatStatus(status) {
	return [
		`PR: ${status.url}`,
		`Head: ${status.headRefOid}`,
		`Review gate: ${status.reviewGateClear ? "clear" : "blocked"} (${status.unresolvedThreads.length} unresolved, ${status.missingRestCommentIds.length} REST mismatches)`,
		`Checks: ${status.checks.state} (${status.checks.passing.length} passing, ${status.checks.pending.length} pending, ${status.checks.interrupted.length} interrupted, ${status.checks.billingBlocked.length} billing-blocked, ${status.checks.failing.length} failing)`,
		`Reruns: ${status.reruns.length > 0 ? status.reruns.join(", ") : "none"}`,
		`Merge state: ${status.mergeStateStatus}`,
		`Ready to merge: ${status.readyToMerge ? "yes" : "no"}`,
	].join("\n") + "\n";
}

function billingBlockedNotice(status) {
	if (status.checks.state !== "billing-blocked") return null;
	const names = status.checks.billingBlocked.map((check) => check.name).join(", ");
	return [
		`GitHub Actions did not run because of account billing (failed payment or spending limit): ${names}.`,
		`Skip GitHub CI: run \`pnpm run ci:pr\` locally on PR head ${status.headRefOid} and merge only if it exits 0.`,
	].join("\n") + "\n";
}

function gateExitCode(status, { requireClear = false } = {}) {
	if (!requireClear || status.readyToMerge) return 0;
	return status.clearExceptBillingBlockedChecks ? BILLING_BLOCKED_EXIT_CODE : 2;
}

async function main(argv = process.argv.slice(2)) {
	const options = parseArgs(argv);
	if (options.help) {
		printHelp();
		return;
	}
	const status = await collectReviewGateStatus(options);
	process.stdout.write(options.json ? `${JSON.stringify(status, null, "\t")}\n` : formatStatus(status));
	// stderr keeps --json output parseable.
	const notice = billingBlockedNotice(status);
	if (notice) process.stderr.write(notice);
	process.exitCode = gateExitCode(status, options);
}

if (require.main === module) {
	main().catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = {
	BILLING_BLOCKED_EXIT_CODE,
	checkRunId,
	classifyChecks,
	collectSnapshot,
	collectReviewGateStatus,
	flattenPages,
	gateExitCode,
	isBillingAnnotation,
	reconcileSnapshot,
	rerunWorkflowRun,
	splitRepository,
	runGhJson,
	workflowRunId,
};
