const assert = require("node:assert/strict");
const test = require("node:test");

const {
	BILLING_BLOCKED_EXIT_CODE,
	checkRunId,
	collectReviewGateStatus,
	gateExitCode,
	runGhJson,
} = require("./review-gate-status");

const BILLING_MESSAGE = "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings";
const BILLING_ANNOTATIONS = [
	{ annotation_level: "failure", message: BILLING_MESSAGE, path: ".github", title: "" },
	{ annotation_level: "notice", message: "The ubuntu-latest label will migrate to Ubuntu 26.", path: ".github", title: "" },
];

function fixtureRunner({
	annotations = {},
	checks = [{ conclusion: "SUCCESS", name: "PR checks", status: "COMPLETED" }],
	comments = [{ id: 101, html_url: "https://example.test/comment/101", in_reply_to_id: null }],
	graphPages,
	mergeStateStatus = "CLEAN",
	reviewDecision = "APPROVED",
	reviews = [{ id: 201, state: "APPROVED", user: { login: "reviewer" } }],
} = {}) {
	const calls = [];
	const pages = graphPages ?? [{
		pageInfo: { endCursor: null, hasNextPage: false },
		threads: [{
			comments: { nodes: [{ author: { login: "reviewer" }, databaseId: 101, url: "https://example.test/comment/101" }] },
			id: "PRRT_1",
			isOutdated: false,
			isResolved: true,
			line: 10,
			path: "src/example.js",
		}],
	}];
	let graphPage = 0;
	const runGh = async (args) => {
		calls.push(args);
		if (args[0] === "repo") return { nameWithOwner: "owner/repo" };
		if (args[0] === "pr") {
			return {
				headRefOid: "abc123",
				mergeStateStatus,
				number: 42,
				reviewDecision,
				statusCheckRollup: typeof checks === "function" ? checks(calls.filter((call) => call[0] === "pr").length) : checks,
				updatedAt: "2026-09-05T00:00:00Z",
				url: "https://github.com/owner/repo/pull/42",
			};
		}
		if (args[0] === "api" && args[1] === "graphql") {
			const page = pages[graphPage++ % pages.length];
			return {
				data: {
					repository: {
						pullRequest: {
							mergeStateStatus,
							reviewDecision,
							reviewThreads: {
								nodes: page.threads,
								pageInfo: page.pageInfo,
							},
						},
					},
				},
			};
		}
		const annotationMatch = args[0] === "api" ? /\/check-runs\/(\d+)\/annotations$/u.exec(args[1]) : null;
		if (annotationMatch) return [annotations[annotationMatch[1]] ?? []];
		if (args[0] === "api" && args[1].endsWith("/comments")) return [comments];
		if (args[0] === "api" && args[1].endsWith("/reviews")) return [reviews];
		throw new Error(`Unexpected gh call: ${args.join(" ")}`);
	};
	return { calls, runGh };
}

test("paginates GraphQL threads and reconciles every top-level REST comment", async () => {
	const runner = fixtureRunner({
		comments: [
			{ id: 101, html_url: "https://example.test/comment/101", in_reply_to_id: null },
			{ id: 102, html_url: "https://example.test/comment/102", in_reply_to_id: null },
		],
		graphPages: [
			{
				pageInfo: { endCursor: "CURSOR_1", hasNextPage: true },
				threads: [{
					comments: { nodes: [{ databaseId: 101, url: "https://example.test/comment/101" }] },
					id: "PRRT_1",
					isOutdated: false,
					isResolved: true,
					path: "src/one.js",
				}],
			},
			{
				pageInfo: { endCursor: null, hasNextPage: false },
				threads: [{
					comments: { nodes: [{ databaseId: 102, url: "https://example.test/comment/102" }] },
					id: "PRRT_2",
					isOutdated: false,
					isResolved: true,
					path: "src/two.js",
				}],
			},
		],
	});

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		prNumber: 42,
		runGh: runner.runGh,
	});

	assert.equal(status.graphqlPageCount, 2);
	assert.equal(status.threadCount, 2);
	assert.deepEqual(status.missingRestCommentIds, []);
	assert.equal(status.reviewGateClear, true);
	assert.equal(status.checks.state, "passing");
	assert.equal(status.readyToMerge, true);
	assert.equal(
		runner.calls.filter((args) => args[0] === "api" && args[1] === "graphql").length,
		2,
	);
});

test("reports unresolved threads, REST mismatches, change requests, and failed checks", async () => {
	const runner = fixtureRunner({
		checks: [{ conclusion: "FAILURE", name: "PR checks", status: "COMPLETED" }],
		comments: [{ id: 999, html_url: "https://example.test/comment/999", in_reply_to_id: null }],
		graphPages: [{
			pageInfo: { endCursor: null, hasNextPage: false },
			threads: [{
				comments: { nodes: [{ databaseId: 101, url: "https://example.test/comment/101" }] },
				id: "PRRT_open",
				isOutdated: false,
				isResolved: false,
				path: "src/broken.js",
			}],
		}],
		mergeStateStatus: "BLOCKED",
		reviewDecision: "CHANGES_REQUESTED",
		reviews: [{ id: 202, state: "CHANGES_REQUESTED", user: { login: "reviewer" } }],
	});

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		prNumber: 42,
		runGh: runner.runGh,
	});

	assert.deepEqual(status.unresolvedThreads.map((thread) => thread.id), ["PRRT_open"]);
	assert.deepEqual(status.missingRestCommentIds, [999]);
	assert.deepEqual(status.nonApprovingReviews, [{ id: 202, state: "CHANGES_REQUESTED", user: "reviewer" }]);
	assert.equal(status.reviewGateClear, false);
	assert.equal(status.checks.state, "failing");
	assert.equal(status.readyToMerge, false);
});

test("retries a temporarily incomplete GraphQL-to-REST reconciliation", async () => {
	let attempt = 0;
	const delays = [];
	const runner = fixtureRunner({ comments: [{ id: 101, in_reply_to_id: null }] });
	const runGh = async (args) => {
		if (args[0] === "api" && args[1] === "graphql") {
			attempt += 1;
			if (attempt === 1) {
				return {
					data: { repository: { pullRequest: {
						mergeStateStatus: "CLEAN",
						reviewDecision: "APPROVED",
						reviewThreads: {
							nodes: [],
							pageInfo: { endCursor: null, hasNextPage: false },
						},
					} } },
				};
			}
		}
		return runner.runGh(args);
	};

	const status = await collectReviewGateStatus({
		consistencyRetries: 1,
		delay: async (ms) => delays.push(ms),
		prNumber: 42,
		runGh,
	});

	assert.equal(status.consistencyAttempts, 2);
	assert.deepEqual(status.missingRestCommentIds, []);
	assert.deepEqual(delays, [5000]);
});

test("retries read-only gh calls without an invalid injected GITHUB_TOKEN", () => {
	const calls = [];
	const result = runGhJson(["repo", "view", "--json", "nameWithOwner"], {
		env: {
			GITHUB_TOKEN: "invalid-test-token",
			PATH: "/usr/bin",
		},
		spawn: (_command, _args, options) => {
			calls.push(options.env);
			return calls.length === 1
				? { status: 1, stderr: "HTTP 401: Bad credentials", stdout: "" }
				: { status: 0, stderr: "", stdout: '{"nameWithOwner":"owner/repo"}' };
		},
	});

	assert.deepEqual(result, { nameWithOwner: "owner/repo" });
	assert.equal(calls.length, 2);
	assert.equal(calls[0].GITHUB_TOKEN, "invalid-test-token");
	assert.equal("GITHUB_TOKEN" in calls[1], false);
	assert.equal(calls[1].PATH, "/usr/bin");
});

test("treats a required check that has not reported yet as pending", async () => {
	const runner = fixtureRunner({
		checks: [{ conclusion: "SUCCESS", name: "react-doctor", status: "COMPLETED" }],
	});

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		prNumber: 42,
		runGh: runner.runGh,
	});

	assert.equal(status.checks.state, "pending");
	assert.deepEqual(status.checks.pending.map((check) => check.name), ["PR checks"]);
	assert.equal(status.readyToMerge, false);
});

test("waits for pending checks to finish before reporting ready", async () => {
	const runner = fixtureRunner({
		checks: (prCalls) => [{
			conclusion: prCalls < 3 ? null : "SUCCESS",
			name: "PR checks",
			status: prCalls < 3 ? "IN_PROGRESS" : "COMPLETED",
		}],
	});
	let clock = 0;

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		delay: async (ms) => { clock += ms; },
		now: () => clock,
		pollSeconds: 30,
		prNumber: 42,
		runGh: runner.runGh,
		waitSeconds: 600,
	});

	assert.equal(status.checkPolls, 3);
	assert.equal(status.checks.state, "passing");
	assert.equal(status.readyToMerge, true);
});

test("stops waiting at the deadline and stays not ready", async () => {
	const runner = fixtureRunner({
		checks: [{ conclusion: null, name: "PR checks", status: "IN_PROGRESS" }],
	});
	let clock = 0;

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		delay: async (ms) => { clock += ms; },
		now: () => clock,
		pollSeconds: 30,
		prNumber: 42,
		runGh: runner.runGh,
		waitSeconds: 90,
	});

	assert.equal(status.checkPolls, 4);
	assert.equal(status.checks.state, "pending");
	assert.equal(status.readyToMerge, false);
});

test("classifies cancelled and timed-out checks as interrupted, not failing", async () => {
	const runner = fixtureRunner({
		checks: [{
			conclusion: "CANCELLED",
			detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/1",
			name: "PR checks",
			status: "COMPLETED",
		}],
	});

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		prNumber: 42,
		runGh: runner.runGh,
	});

	assert.equal(status.checks.state, "interrupted");
	assert.equal(status.checks.failing.length, 0);
	assert.deepEqual(status.reruns, []);
	assert.equal(status.readyToMerge, false);
});

test("reruns an interrupted run and reports ready once the rerun passes", async () => {
	const runner = fixtureRunner({
		checks: (prCalls) => {
			if (prCalls === 1) {
				return [{ conclusion: "TIMED_OUT", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/1", name: "PR checks", status: "COMPLETED" }];
			}
			if (prCalls === 2) {
				return [{ conclusion: "TIMED_OUT", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/1", name: "PR checks", status: "COMPLETED" }];
			}
			const done = prCalls >= 4;
			return [{ conclusion: done ? "SUCCESS" : null, detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/2", name: "PR checks", status: done ? "COMPLETED" : "IN_PROGRESS" }];
		},
	});
	const rerunCalls = [];
	let clock = 0;

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		delay: async (ms) => { clock += ms; },
		now: () => clock,
		pollSeconds: 30,
		prNumber: 42,
		rerunInterrupted: 3,
		rerunRun: async (runId) => { rerunCalls.push(runId); },
		runGh: runner.runGh,
		waitSeconds: 600,
	});

	assert.deepEqual(rerunCalls, ["777"]);
	assert.deepEqual(status.reruns, ["777"]);
	assert.equal(status.checks.state, "passing");
	assert.equal(status.readyToMerge, true);
});

test("never reruns a real failure and stops after the rerun budget", async () => {
	const failing = fixtureRunner({
		checks: [{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/1", name: "PR checks", status: "COMPLETED" }],
	});
	const rerunCalls = [];
	const failed = await collectReviewGateStatus({
		consistencyRetries: 0,
		prNumber: 42,
		rerunInterrupted: 3,
		rerunRun: async (runId) => { rerunCalls.push(runId); },
		runGh: failing.runGh,
	});
	assert.equal(failed.checks.state, "failing");
	assert.deepEqual(rerunCalls, []);

	let job = 0;
	const flaky = fixtureRunner({
		checks: () => [{ conclusion: "CANCELLED", detailsUrl: `https://github.com/owner/repo/actions/runs/777/job/${job}`, name: "PR checks", status: "COMPLETED" }],
	});
	let clock = 0;
	const exhausted = await collectReviewGateStatus({
		consistencyRetries: 0,
		delay: async (ms) => { clock += ms; },
		now: () => clock,
		pollSeconds: 30,
		prNumber: 42,
		rerunInterrupted: 2,
		rerunRun: async (runId) => { job += 1; rerunCalls.push(runId); },
		runGh: flaky.runGh,
		waitSeconds: 60,
	});
	assert.deepEqual(rerunCalls, ["777", "777"]);
	assert.equal(exhausted.checks.state, "interrupted");
	assert.equal(exhausted.readyToMerge, false);
});

test("extracts the check-run id from both job URL shapes", () => {
	assert.equal(checkRunId("https://github.com/owner/repo/actions/runs/40080183280/job/120831937842"), "120831937842");
	assert.equal(checkRunId("https://github.com/owner/repo/runs/120831937842"), null);
	assert.equal(checkRunId("https://github.com/owner/repo/job/120831937516"), "120831937516");
	assert.equal(checkRunId(null), null);
});

test("classifies a billing-annotated failure as billing-blocked and exits 3 under require-clear", async () => {
	const runner = fixtureRunner({
		annotations: { 11: BILLING_ANNOTATIONS, 12: BILLING_ANNOTATIONS },
		checks: [
			{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" },
			{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/778/job/12", name: "react-doctor", status: "COMPLETED" },
		],
		mergeStateStatus: "UNSTABLE",
	});

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		prNumber: 42,
		runGh: runner.runGh,
	});

	assert.equal(status.checks.state, "billing-blocked");
	assert.deepEqual(status.checks.billingBlocked.map((check) => check.name), ["PR checks", "react-doctor"]);
	assert.equal(status.checks.failing.length, 0);
	assert.equal(status.readyToMerge, false);
	assert.equal(status.clearExceptBillingBlockedChecks, true);
	assert.equal(gateExitCode(status, { requireClear: true }), BILLING_BLOCKED_EXIT_CODE);
	assert.equal(BILLING_BLOCKED_EXIT_CODE, 3);
	assert.equal(gateExitCode(status, { requireClear: false }), 0);
	assert.ok(runner.calls.some((args) => args[1] === "repos/owner/repo/check-runs/11/annotations"));
});

test("billing-blocked with an unresolved thread or conflicts still exits 2", async () => {
	const unresolved = fixtureRunner({
		annotations: { 11: BILLING_ANNOTATIONS },
		checks: [{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" }],
		graphPages: [{
			pageInfo: { endCursor: null, hasNextPage: false },
			threads: [{
				comments: { nodes: [{ databaseId: 101, url: "https://example.test/comment/101" }] },
				id: "PRRT_open",
				isOutdated: false,
				isResolved: false,
				path: "src/open.js",
			}],
		}],
		mergeStateStatus: "UNSTABLE",
	});
	const openThread = await collectReviewGateStatus({ consistencyRetries: 0, prNumber: 42, runGh: unresolved.runGh });
	assert.equal(openThread.checks.state, "billing-blocked");
	assert.equal(gateExitCode(openThread, { requireClear: true }), 2);

	const dirty = fixtureRunner({
		annotations: { 11: BILLING_ANNOTATIONS },
		checks: [{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" }],
		mergeStateStatus: "DIRTY",
	});
	const conflicted = await collectReviewGateStatus({ consistencyRetries: 0, prNumber: 42, runGh: dirty.runGh });
	assert.equal(conflicted.checks.state, "billing-blocked");
	assert.equal(gateExitCode(conflicted, { requireClear: true }), 2);
});

test("keeps an ordinary failure failing", async () => {
	const runner = fixtureRunner({
		annotations: { 11: [{ annotation_level: "failure", message: "Process completed with exit code 1.", title: "" }] },
		checks: [{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" }],
	});

	const status = await collectReviewGateStatus({ consistencyRetries: 0, prNumber: 42, runGh: runner.runGh });

	assert.equal(status.checks.state, "failing");
	assert.deepEqual(status.checks.failing.map((check) => check.name), ["PR checks"]);
	assert.equal(status.checks.billingBlocked.length, 0);
	assert.equal(gateExitCode(status, { requireClear: true }), 2);
});

test("keeps a failure failing when its annotations cannot be fetched", async () => {
	const runner = fixtureRunner({
		checks: [{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" }],
	});
	const runGh = async (args) => {
		if (args[0] === "api" && args[1].includes("/check-runs/")) throw new Error("gh api failed: HTTP 502");
		return runner.runGh(args);
	};

	const status = await collectReviewGateStatus({ consistencyRetries: 0, prNumber: 42, runGh });

	assert.equal(status.checks.state, "failing");
	assert.equal(status.checks.billingBlocked.length, 0);
});

test("a real failure alongside a billing-blocked check is failing", async () => {
	const runner = fixtureRunner({
		annotations: {
			11: [{ annotation_level: "failure", message: "Process completed with exit code 1.", title: "" }],
			12: BILLING_ANNOTATIONS,
		},
		checks: [
			{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" },
			{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/778/job/12", name: "react-doctor", status: "COMPLETED" },
		],
		mergeStateStatus: "UNSTABLE",
	});

	const status = await collectReviewGateStatus({ consistencyRetries: 0, prNumber: 42, runGh: runner.runGh });

	assert.equal(status.checks.state, "failing");
	assert.deepEqual(status.checks.failing.map((check) => check.name), ["PR checks"]);
	assert.deepEqual(status.checks.billingBlocked.map((check) => check.name), ["react-doctor"]);
	assert.equal(status.clearExceptBillingBlockedChecks, false);
	assert.equal(gateExitCode(status, { requireClear: true }), 2);
});

test("never reruns or waits on a billing-blocked run", async () => {
	const runner = fixtureRunner({
		annotations: { 11: BILLING_ANNOTATIONS, 12: BILLING_ANNOTATIONS },
		checks: [
			{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" },
			{ conclusion: "CANCELLED", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/12", name: "lint", status: "COMPLETED" },
		],
		mergeStateStatus: "UNSTABLE",
	});
	const rerunCalls = [];
	let clock = 0;

	const status = await collectReviewGateStatus({
		consistencyRetries: 0,
		delay: async (ms) => { clock += ms; },
		now: () => clock,
		pollSeconds: 30,
		prNumber: 42,
		rerunInterrupted: 3,
		rerunRun: async (runId) => { rerunCalls.push(runId); },
		runGh: runner.runGh,
		waitSeconds: 600,
	});

	assert.deepEqual(rerunCalls, []);
	assert.deepEqual(status.reruns, []);

	const billingOnly = fixtureRunner({
		annotations: { 11: BILLING_ANNOTATIONS },
		checks: [{ conclusion: "FAILURE", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/11", name: "PR checks", status: "COMPLETED" }],
		mergeStateStatus: "UNSTABLE",
	});
	const settled = await collectReviewGateStatus({
		consistencyRetries: 0,
		delay: async (ms) => { clock += ms; },
		now: () => clock,
		pollSeconds: 30,
		prNumber: 42,
		rerunInterrupted: 3,
		rerunRun: async (runId) => { rerunCalls.push(runId); },
		runGh: billingOnly.runGh,
		waitSeconds: 600,
	});
	assert.equal(settled.checks.state, "billing-blocked");
	assert.equal(settled.checkPolls, 1);
	assert.deepEqual(rerunCalls, []);
});
