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
				isDraft: false,
				state: "OPEN",
				mergeStateStatus,
				number: 42,
				reviewDecision,
				statusCheckRollup: typeof checks === "function" ? checks(calls.filter((call) => call[0] === "pr" && call.at(-1) !== "headRefOid,updatedAt").length) : checks,
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
							headRefOid: "abc123",
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
						headRefOid: "abc123",
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

test("retries read-only gh calls without an invalid injected GITHUB_TOKEN", async () => {
	const calls = [];
	const result = await runGhJson(["repo", "view", "--json", "nameWithOwner"], {
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

test("default gh adapter starts concurrent child processes rather than blocking Promise.all", async () => {
	const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
	const { tmpdir } = require("node:os");
	const path = require("node:path");
	const root = mkdtempSync(path.join(tmpdir(), "vpk-fake-gh-"));
	try {
		writeFileSync(path.join(root, "gh"), `#!${process.execPath}\nconst fs = require('node:fs'); const path = require('node:path');
const root = process.env.FAKE_GH_ROOT; const name = process.argv[2];
fs.writeFileSync(path.join(root, name), 'started');
const deadline = Date.now() + 2000;
const timer = setInterval(() => {
 if (fs.existsSync(path.join(root, name === 'one' ? 'two' : 'one'))) { clearInterval(timer); process.stdout.write(JSON.stringify({ concurrent: true })); }
 else if (Date.now() >= deadline) { clearInterval(timer); process.exit(1); }
}, 10);\n`, { mode: 0o755 });
		const env = { PATH: root, FAKE_GH_ROOT: root };
		const result = await Promise.all([runGhJson(["one"], { env }), runGhJson(["two"], { env })]);
		assert.deepEqual(result, [{ concurrent: true }, { concurrent: true }]);
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("snapshot starts all four independent review reads before awaiting any", async () => {
	const runner = fixtureRunner();
	let active = 0;
	let maximum = 0;
	const status = await collectReviewGateStatus({ prNumber: 42, repository: "owner/repo", runGh: async (args) => {
		maximum = Math.max(maximum, ++active);
		await new Promise((resolve) => setImmediate(resolve));
		active -= 1;
		return runner.runGh(args);
	} });
	assert.equal(maximum, 4);
	assert.equal(status.readyToMerge, true);
});

test("transient read retries are bounded, back off, and preserve authentication/schema failures", async () => {
	let attempts = 0;
	const delays = [];
	const spawn = async () => (++attempts < 3 ? { status: 1, stderr: "HTTP 502: Bad Gateway" } : { status: 0, stdout: '{}' });
	assert.deepEqual(await runGhJson(["api", "test"], { spawn, sleep: async (ms) => delays.push(ms) }), {});
	assert.equal(attempts, 3);
	assert.deepEqual(delays, [250, 500]);
	for (const stderr of ['Post "https://api.github.com/graphql": EOF', "unexpected EOF"]) {
		attempts = 0;
		assert.deepEqual(await runGhJson(["api", "test"], { spawn: async () => (++attempts === 1 ? { status: 1, stderr } : { status: 0, stdout: '{}' }), sleep: async () => {} }), {});
		assert.equal(attempts, 2);
	}
	for (const failure of [{ status: 1, stderr: "HTTP 503" }, { status: 1, stderr: "HTTP 401: Bad credentials" }, { status: 1, stderr: "HTTP 403: Resource not accessible" }, { status: 0, stdout: 'invalid JSON' }, { status: 0, stdout: '{"errors":[{"message":"schema mismatch"}]}' }]) {
		attempts = 0;
		await assert.rejects(runGhJson(["api", "test"], { env: {}, spawn: async () => { attempts += 1; return failure; }, sleep: async () => {} }));
		assert.equal(attempts, failure.stderr === "HTTP 503" ? 3 : 1);
	}
	attempts = 0;
	await assert.rejects(runGhJson(["api", "mutation"], { readOnly: false, spawn: async () => { attempts += 1; return { status: 1, stderr: "HTTP 502" }; } }));
	assert.equal(attempts, 1);
});

test("unchanged pending checks use light polling, then fully reconcile new review blockers", async () => {
	const runner = fixtureRunner({ checks: (calls) => [{ name: "PR checks", status: calls >= 5 ? "COMPLETED" : "IN_PROGRESS", conclusion: calls >= 5 ? "SUCCESS" : null }] });
	let clock = 0;
	let graphCalls = 0;
	const status = await collectReviewGateStatus({ prNumber: 42, waitSeconds: 600, now: () => clock,
		delay: async (ms) => { clock += ms; }, runGh: async (args) => {
			const result = await runner.runGh(args);
			if (args[1] === "graphql" && ++graphCalls === 2) result.data.repository.pullRequest.reviewThreads.nodes[0].isResolved = false;
			return result;
		} });
	assert.equal(status.fullReconciliations, 2);
	assert.equal(status.lightweightPolls, 4);
	assert.equal(status.reviewGateClear, false);
	assert.equal(status.readyToMerge, false);
});

test("head changes during snapshots, pagination and light waits fail closed", async () => {
	for (const change of ["confirmation", "graphql", "poll"]) {
		const runner = fixtureRunner({ checks: [{ name: "PR checks", status: "IN_PROGRESS", conclusion: null }] });
		let prCalls = 0;
		let clock = 0;
		await assert.rejects(collectReviewGateStatus({ prNumber: 42, waitSeconds: 100, now: () => clock, delay: async (ms) => { clock += ms; }, runGh: async (args) => {
			const result = await runner.runGh(args);
			if (args[0] === "pr") prCalls += 1;
			if ((change === "confirmation" && args.at(-1) === "headRefOid,updatedAt") || (change === "poll" && prCalls >= 3 && args[0] === "pr")) result.headRefOid = "changed";
			if (change === "graphql" && args[1] === "graphql") result.data.repository.pullRequest.headRefOid = "changed";
			return result;
		} }), /head changed/u);
	}
});

test("malformed review surfaces and pagination cannot produce a clear gate", async () => {
	for (const surface of ["pr", "graphql", "comments", "reviews", "cursor"]) {
		const runner = fixtureRunner();
		await assert.rejects(collectReviewGateStatus({ prNumber: 42, runGh: async (args) => {
			const result = await runner.runGh(args);
			if (surface === "pr" && args[0] === "pr") delete result.statusCheckRollup;
			if (surface === "graphql" && args[1] === "graphql") delete result.data.repository.pullRequest.reviewThreads;
			if (surface === "cursor" && args[1] === "graphql") result.data.repository.pullRequest.reviewThreads.pageInfo = { hasNextPage: true, endCursor: null };
			if (["comments", "reviews"].includes(surface) && args[1]?.endsWith(`/${surface}`)) return {};
			return result;
		} }), /Invalid|paginated|endCursor/u);
	}
});

test("required skipped checks, drafts and closed PRs never pass", async () => {
	for (const changes of [{ state: "MERGED" }, { isDraft: true }, { statusCheckRollup: [{ name: "PR checks", conclusion: "SKIPPED", status: "COMPLETED" }] }]) {
		const runner = fixtureRunner();
		const status = await collectReviewGateStatus({ prNumber: 42, runGh: async (args) => {
			const result = await runner.runGh(args);
			return args[0] === "pr" ? { ...result, ...changes } : result;
		} });
		assert.equal(status.readyToMerge, false);
		assert.equal(gateExitCode(status, { requireClear: true }), 2);
	}
});

test("multiple interrupted runs respect the total budget and unknown reruns are never retried", async () => {
	const runner = fixtureRunner({ checks: [1, 2, 3].map((id) => ({ name: id === 1 ? "PR checks" : `shard ${id}`, conclusion: "CANCELLED", status: "COMPLETED", detailsUrl: `https://github.com/owner/repo/actions/runs/${id}/job/${id}` })) });
	const reruns = [];
	const status = await collectReviewGateStatus({ prNumber: 42, runGh: runner.runGh, rerunInterrupted: 2, rerunRun: async (id) => reruns.push(id), delay: async () => {} });
	assert.deepEqual(reruns, ["1", "2"]);
	assert.deepEqual(status.reruns, reruns);
	let mutations = 0;
	await assert.rejects(collectReviewGateStatus({ prNumber: 42, runGh: runner.runGh, rerunInterrupted: 3, rerunRun: async () => { mutations += 1; throw new Error("HTTP 502"); } }), /outcome unknown.*Attempted runs: 1/u);
	assert.equal(mutations, 1);
});

const { mergeRemote } = require("./merge-remote");
const HEAD = "a".repeat(40);
const MERGE = "b".repeat(40);

function mergeFixture() {
	const calls = [];
	let merged = false;
	const identity = () => ({ number: 42, state: merged ? "closed" : "open", draft: false, merged, merge_commit_sha: merged ? MERGE : null,
		base: { ref: "main", repo: { full_name: "owner/repo" } }, head: { sha: HEAD, ref: "feature/test", repo: { full_name: "owner/repo" } } });
	return {
		calls,
		options: { prNumber: 42, repository: "owner/repo", expectedHead: HEAD,
			collectGate: async () => { calls.push(["gate"]); return { readyToMerge: true, headRefOid: HEAD, repository: "owner/repo", number: 42 }; },
			runGh: async (args) => {
				calls.push(args);
				if (args[1] === "repos/owner/repo") return { default_branch: "main", full_name: "owner/repo" };
				if (args[1].includes("/git/ref/")) return { ref: "refs/heads/feature/test", object: { sha: HEAD } };
				return identity();
			},
			mutateGh: async (args) => { calls.push(args); merged = true; return { merged: true, sha: MERGE }; },
			deleteRef: async (args) => calls.push(args),
		},
	};
}

test("remote merge uses a fresh gate, expected SHA and atomic branch lease without local cleanup", async () => {
	const fixture = mergeFixture();
	const report = await mergeRemote(fixture.options);
	assert.equal(report.mergeCommit, MERGE);
	assert.equal(report.branchDeletion, "deleted");
	const mutation = fixture.calls.find((call) => call.includes("PUT"));
	assert.ok(mutation.includes(`sha=${HEAD}`));
	assert.ok(mutation.includes("merge_method=merge"));
	assert.ok(fixture.calls.findIndex((call) => call[0] === "gate") < fixture.calls.indexOf(mutation));
	const deletion = fixture.calls.find((call) => call.includes("push"));
	assert.ok(deletion.includes(`--force-with-lease=refs/heads/feature/test:${HEAD}`));
	assert.ok(deletion.includes("https://github.com/owner/repo.git"));
	assert.ok(deletion.includes(":refs/heads/feature/test"));
	assert.ok(deletion.includes("core.hooksPath=/dev/null"));
	assert.ok(fixture.calls.every((call) => !call.includes("checkout") && !call.includes("branch") && !call.includes("--delete-branch")));
});

test("remote merge refuses stale heads, review/check blockers and billing without mutations", async () => {
	for (const gate of [{ readyToMerge: false }, { readyToMerge: true, headRefOid: "c".repeat(40) }, { readyToMerge: false, clearExceptBillingBlockedChecks: true }]) {
		const fixture = mergeFixture();
		await assert.rejects(mergeRemote({ ...fixture.options, collectGate: async () => ({ headRefOid: HEAD, repository: "owner/repo", number: 42, ...gate }) }), (error) => error.exitCode === (gate.clearExceptBillingBlockedChecks ? 3 : 2));
		assert.ok(!fixture.calls.some((call) => call.includes("PUT") || call.includes("push")));
	}
});

test("fork, default/base branches and changed remote refs are preserved after merging", async () => {
	for (const change of ["fork", "default", "base", "advanced", "identity"]) {
		const fixture = mergeFixture();
		const runGh = async (args) => {
			const result = await fixture.options.runGh(args);
			if (args[1].endsWith("/pulls/42")) {
				if (change === "fork") result.head.repo.full_name = "fork/repo";
				if (change === "default") result.head.ref = "main";
				if (change === "base") result.head.ref = result.base.ref = "release";
				if (change === "identity" && result.merged) result.head.ref = "replacement";
			}
			if (change === "advanced" && args[1].includes("/git/ref/")) result.object.sha = "c".repeat(40);
			return result;
		};
		assert.equal((await mergeRemote({ ...fixture.options, runGh })).branchDeletion, "preserved");
		assert.ok(!fixture.calls.some((call) => call.includes("push")));
	}
});

test("unknown merge outcomes are reconciled once; rejected leases never trigger an unsafe delete", async () => {
	const fixture = mergeFixture();
	let mutations = 0;
	const report = await mergeRemote({ ...fixture.options, mutateGh: async (args) => { mutations += 1; await fixture.options.mutateGh(args); throw new Error("HTTP 502"); } });
	assert.equal(report.mergeCommit, MERGE);
	assert.equal(mutations, 1);
	const refused = mergeFixture();
	await assert.rejects(mergeRemote({ ...refused.options, deleteRef: async () => { throw new Error("stale info: lease rejected"); } }), /lease rejected/u);
	assert.equal(refused.calls.filter((call) => call.includes("PUT")).length, 1);
	assert.ok(!refused.calls.some((call) => call.includes("DELETE")));
});

test("default rerun accepts an empty successful POST response without retrying the mutation", async () => {
	const { rerunWorkflowRun } = require("./review-gate-status");
	const calls = [];
	await rerunWorkflowRun("777", { repository: "owner/repo", spawn: async (_command, args) => { calls.push(args); return { status: 0, stdout: "" }; } });
	assert.deepEqual(calls, [["api", "repos/owner/repo/actions/runs/777/rerun", "--method", "POST"]]);
});

test("read failures after a rerun preserve accounting so callers cannot silently reset the budget", async () => {
	const runner = fixtureRunner({ checks: [{ name: "PR checks", conclusion: "CANCELLED", status: "COMPLETED", detailsUrl: "https://github.com/owner/repo/actions/runs/777/job/1" }] });
	let reran = false;
	await assert.rejects(collectReviewGateStatus({ prNumber: 42, rerunInterrupted: 3, delay: async () => {}, rerunRun: async () => { reran = true; }, runGh: async (args) => {
		if (reran) throw new Error("HTTP 503 after bounded read retries");
		return runner.runGh(args);
	} }), (error) => { assert.deepEqual(error.reruns, ["777"]); return /attempted reruns/u.test(error.message); });
});

test("GraphQL pagination head changes and repeated cursors are rejected", async () => {
	for (const change of ["head", "cursor"]) {
		const runner = fixtureRunner({ graphPages: [{ pageInfo: { hasNextPage: true, endCursor: "same" }, threads: [] }, { pageInfo: { hasNextPage: true, endCursor: "same" }, threads: [] }] });
		let pages = 0;
		await assert.rejects(collectReviewGateStatus({ prNumber: 42, runGh: async (args) => {
			const result = await runner.runGh(args);
			if (args[1] === "graphql" && ++pages === 2 && change === "head") result.data.repository.pullRequest.headRefOid = "different";
			return result;
		} }), /head changed|repeated endCursor/u);
	}
});

test("review updates during pending checks trigger full reconciliation even without check changes", async () => {
	const runner = fixtureRunner({ checks: [{ name: "PR checks", conclusion: null, status: "IN_PROGRESS" }] });
	let clock = 0;
	let graphs = 0;
	const status = await collectReviewGateStatus({ prNumber: 42, waitSeconds: 60, now: () => clock, delay: async (ms) => { clock += ms; }, runGh: async (args) => {
		const result = await runner.runGh(args);
		if (args[0] === "pr" && clock >= 30000) result.updatedAt = "2026-09-06T00:00:00Z";
		if (args[1] === "graphql") {
			graphs += 1;
			if (clock >= 30000) result.data.repository.pullRequest.reviewThreads.nodes[0].isResolved = false;
		}
		return result;
	} });
	assert.equal(graphs, 3); // initial, changed review, deadline
	assert.equal(status.readyToMerge, false);
	assert.equal(status.reviewGateClear, false);
});

test("remote metadata blockers and refused merge responses preserve all refs", async () => {
	for (const changes of [{ draft: true }, { state: "closed" }, { head: { sha: "c".repeat(40), ref: "feature/test" } }]) {
		const fixture = mergeFixture();
		await assert.rejects(mergeRemote({ ...fixture.options, runGh: async (args) => {
			const result = await fixture.options.runGh(args);
			return args[1].endsWith("/pulls/42") ? { ...result, ...changes } : result;
		} }));
		assert.ok(!fixture.calls.some((call) => call[0] === "gate" || call.includes("PUT") || call.includes("push")));
	}
	const fixture = mergeFixture();
	await assert.rejects(mergeRemote({ ...fixture.options, mutateGh: async () => ({ merged: false }) }), /did not confirm/u);
	assert.ok(!fixture.calls.some((call) => call.includes("push")));
});

test("mutation arguments disable retries even when a caller omits readOnly: false", async () => {
	for (const args of [["api", "test", "--method", "PUT"], ["api", "test", "-XPOST"], ["api", "test", "-f", "sha=test"], ["api", "graphql", "-f", "query=mutation{test}"]]) {
		let calls = 0;
		await assert.rejects(runGhJson(args, { spawn: async () => { calls += 1; return { status: 1, stderr: "HTTP 502" }; }, sleep: async () => {} }));
		assert.equal(calls, 1);
	}
});

test("nullable review decisions normalize gh's empty string and GraphQL null consistently", async () => {
	const runner = fixtureRunner({ reviewDecision: null });
	const status = await collectReviewGateStatus({ prNumber: 42, runGh: async (args) => {
		const result = await runner.runGh(args);
		if (args[0] === "pr") result.reviewDecision = "";
		return result;
	} });
	assert.equal(status.reviewDecision, null);
	assert.equal(status.readyToMerge, true);
});
