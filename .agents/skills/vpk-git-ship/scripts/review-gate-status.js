#!/usr/bin/env node

"use strict";

const { spawnSync } = require("node:child_process");

const GRAPHQL_QUERY = `query($owner:String!,$name:String!,$number:Int!,$after:String){
	repository(owner:$owner,name:$name){pullRequest(number:$number){
		reviewDecision mergeStateStatus
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

function spawnGhJson(spawn, args, env) {
	return spawn("gh", args, {
		encoding: "utf8",
		env,
		maxBuffer: 20 * 1024 * 1024,
	});
}

function workflowRunId(url) {
	const match = /\/actions\/runs\/(\d+)/u.exec(url ?? "");
	return match ? match[1] : null;
}

function rerunWorkflowRun(runId, { env = process.env, spawn = spawnSync } = {}) {
	const result = spawn("gh", ["run", "rerun", runId], { encoding: "utf8", env });
	if (result.status !== 0) {
		const detail = (result.stderr ?? "").trim().split("\n")[0] || `exit ${result.status ?? 1}`;
		throw new Error(`gh run rerun ${runId} failed: ${detail}`);
	}
}

function isAuthenticationFailure(result) {
	return /bad credentials|authentication|HTTP 401|invalid token|requires authentication/iu
		.test(`${result.stderr ?? ""}\n${result.stdout ?? ""}`);
}

function runGhJson(args, { env = process.env, spawn = spawnSync } = {}) {
	let result = spawnGhJson(spawn, args, env);
	if (
		result.status !== 0 &&
		Object.prototype.hasOwnProperty.call(env, "GITHUB_TOKEN") &&
		isAuthenticationFailure(result)
	) {
		const keyringEnv = { ...env };
		delete keyringEnv.GITHUB_TOKEN;
		result = spawnGhJson(spawn, args, keyringEnv);
	}
	if (result.status !== 0) {
		const detail = (result.stderr ?? "").trim().split("\n")[0] || `exit ${result.status ?? 1}`;
		throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${detail}`);
	}
	try {
		return JSON.parse(result.stdout);
	} catch {
		throw new Error(`gh ${args.slice(0, 2).join(" ")} returned invalid JSON`);
	}
}

function flattenPages(value) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((page) => Array.isArray(page) ? page : [page]);
}

function splitRepository(repository) {
	const parts = repository.split("/");
	if (parts.length !== 2 || parts.some((part) => !part)) {
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
		if (!pullRequest) throw new Error(`Pull request #${prNumber} was not returned by GraphQL`);
		pullRequestState = pullRequest;
		threads.push(...(pullRequest.reviewThreads?.nodes ?? []));
		pageCount += 1;
		const pageInfo = pullRequest.reviewThreads?.pageInfo ?? {};
		after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
		if (pageInfo.hasNextPage && !after) {
			throw new Error("GraphQL reviewThreads hasNextPage without an endCursor");
		}
	} while (after);
	return {
		mergeStateStatus: pullRequestState?.mergeStateStatus ?? null,
		pageCount,
		reviewDecision: pullRequestState?.reviewDecision ?? null,
		threads,
	};
}

function normalizeCheck(check) {
	const conclusion = String(check.conclusion ?? check.state ?? "").toUpperCase();
	const status = String(check.status ?? "").toUpperCase();
	return {
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
	const failing = [];
	const interrupted = [];
	const pending = [];
	const passing = [];
	for (const check of normalized) {
		if (PENDING_STATES.has(check.status) || PENDING_STATES.has(check.conclusion) || !check.conclusion) {
			pending.push(check);
		} else if (PASSING_CONCLUSIONS.has(check.conclusion)) {
			passing.push(check);
		} else if (INTERRUPTED_CONCLUSIONS.has(check.conclusion)) {
			interrupted.push(check);
		} else {
			failing.push(check);
		}
	}
	let state = "passing";
	if (failing.length > 0) state = "failing";
	else if (pending.length > 0) state = "pending";
	else if (interrupted.length > 0) state = "interrupted";
	return {
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
		reviewDecision !== "CHANGES_REQUESTED"
	);
	return {
		checks,
		graphqlPageCount: snapshot.graphql.pageCount,
		headRefOid: snapshot.pullRequest.headRefOid,
		mergeStateStatus,
		missingRestCommentIds,
		nonApprovingReviews,
		number: snapshot.pullRequest.number,
		readyToMerge: reviewGateClear && checks.state === "passing" && mergeStateStatus === "CLEAN",
		repository: snapshot.repository,
		reviewDecision,
		reviewGateClear,
		threadCount: snapshot.graphql.threads.length,
		unresolvedThreads,
		updatedAt: snapshot.pullRequest.updatedAt,
		url: snapshot.pullRequest.url,
	};
}

async function collectSnapshot({ prNumber, repository, runGh }) {
	const { name, owner } = splitRepository(repository);
	const [pullRequest, graphql, commentsPages, reviewsPages] = await Promise.all([
		runGh([
			"pr",
			"view",
			String(prNumber),
			"--repo",
			repository,
			"--json",
			"number,url,headRefOid,updatedAt,reviewDecision,mergeStateStatus,statusCheckRollup",
		]),
		fetchGraphqlThreads({ name, owner, prNumber, runGh }),
		runGh(["api", `repos/${repository}/pulls/${prNumber}/comments`, "--paginate", "--slurp"]),
		runGh(["api", `repos/${repository}/pulls/${prNumber}/reviews`, "--paginate", "--slurp"]),
	]);
	return {
		graphql,
		pullRequest,
		repository,
		restComments: flattenPages(commentsPages),
		restReviews: flattenPages(reviewsPages),
	};
}

async function collectReviewGateStatus({
	consistencyRetries = 6,
	delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
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
	// Poll while required checks are still running, up to waitSeconds.
	while (true) {
		checkPolls += 1;
		consistencyAttempts = 0;
		do {
			consistencyAttempts += 1;
			status = reconcileSnapshot(await collectSnapshot({
				prNumber,
				repository: resolvedRepository,
				runGh,
			}), requiredChecks);
			if (status.missingRestCommentIds.length === 0 || consistencyAttempts > consistencyRetries) break;
			await delay(5000);
		} while (true);
		if (status.checks.state === "interrupted" && reruns.length < rerunInterrupted) {
			const fresh = status.checks.interrupted.filter((check) => !rerunJobUrls.has(check.url));
			const runIds = [...new Set(fresh.map((check) => workflowRunId(check.url)).filter(Boolean))];
			if (runIds.length > 0) {
				for (const check of fresh) rerunJobUrls.add(check.url);
				for (const runId of runIds) await rerunRun(runId);
				reruns.push(...runIds);
				deadline = now() + waitSeconds * 1000;
				await delay(pollSeconds * 1000);
				continue;
			}
		}
		const rerunSettling = status.checks.state === "interrupted" &&
			status.checks.interrupted.every((check) => rerunJobUrls.has(check.url));
		if ((status.checks.state !== "pending" && !rerunSettling) || now() >= deadline) break;
		await delay(pollSeconds * 1000);
	}
	return {
		...status,
		checkPolls,
		consistencyAttempts,
		reruns,
		queriedAt: new Date().toISOString(),
	};
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
	].join("\n") + "\n");
}

function formatStatus(status) {
	return [
		`PR: ${status.url}`,
		`Head: ${status.headRefOid}`,
		`Review gate: ${status.reviewGateClear ? "clear" : "blocked"} (${status.unresolvedThreads.length} unresolved, ${status.missingRestCommentIds.length} REST mismatches)`,
		`Checks: ${status.checks.state} (${status.checks.passing.length} passing, ${status.checks.pending.length} pending, ${status.checks.interrupted.length} interrupted, ${status.checks.failing.length} failing)`,
		`Reruns: ${status.reruns.length > 0 ? status.reruns.join(", ") : "none"}`,
		`Merge state: ${status.mergeStateStatus}`,
		`Ready to merge: ${status.readyToMerge ? "yes" : "no"}`,
	].join("\n") + "\n";
}

async function main(argv = process.argv.slice(2)) {
	const options = parseArgs(argv);
	if (options.help) {
		printHelp();
		return;
	}
	const status = await collectReviewGateStatus(options);
	process.stdout.write(options.json ? `${JSON.stringify(status, null, "\t")}\n` : formatStatus(status));
	if (options.requireClear && !status.readyToMerge) process.exitCode = 2;
}

if (require.main === module) {
	main().catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = {
	classifyChecks,
	collectReviewGateStatus,
	flattenPages,
	reconcileSnapshot,
	rerunWorkflowRun,
	runGhJson,
	workflowRunId,
};
