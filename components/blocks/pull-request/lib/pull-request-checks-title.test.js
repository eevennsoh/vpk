const assert = require("node:assert/strict");
const test = require("node:test");

const { pullRequestChecksSummary } = require("./pull-request-checks-title.ts");

const check = (status) => ({ id: status, name: status, status, details: "" });

test("all passed reads as a settled summary", () => {
	assert.deepEqual(pullRequestChecksSummary([check("passed"), check("passed")]), {
		failed: 0,
		inProgress: false,
		label: "2/2 builds passed",
		running: false,
		segments: [{ status: "passed", weight: 2 }],
	});
});

test("queued and running checks keep the summary in progress", () => {
	const summary = pullRequestChecksSummary([check("passed"), check("running"), check("queued")]);
	assert.equal(summary.label, "1/3 builds passed");
	assert.equal(summary.inProgress, true);
	assert.equal(summary.running, true);
});

test("segments group checks by status and skip empty groups", () => {
	const summary = pullRequestChecksSummary([check("passed"), check("passed"), check("failed"), check("queued")]);
	assert.deepEqual(summary.segments, [
		{ status: "passed", weight: 2 },
		{ status: "failed", weight: 1 },
		{ status: "pending", weight: 1 },
	]);
});

test("queued-only checks are in progress but not running", () => {
	const summary = pullRequestChecksSummary([check("queued"), check("queued")]);
	assert.equal(summary.inProgress, true);
	assert.equal(summary.running, false);
	assert.deepEqual(summary.segments, [{ status: "pending", weight: 2 }]);
});

test("failures are called out and singular totals drop the plural", () => {
	assert.equal(pullRequestChecksSummary([check("failed"), check("passed")]).label, "1/2 builds passed · 1 failed");
	assert.equal(pullRequestChecksSummary([check("passed")]).label, "1/1 build passed");
});
