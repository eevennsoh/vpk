const assert = require("node:assert/strict");
const test = require("node:test");

const { pullRequestReviewersLabel } = require("./pull-request-reviewers-label.ts");

test("nobody assigned reads as No reviewers", () => {
	assert.equal(pullRequestReviewersLabel({ approved: 0, total: 0 }), "No reviewers");
});

test("a single reviewer is singular, several are plural", () => {
	assert.equal(pullRequestReviewersLabel({ approved: 0, total: 1 }), "0/1 reviewer");
	assert.equal(pullRequestReviewersLabel({ approved: 1, total: 2 }), "1/2 reviewers");
	assert.equal(pullRequestReviewersLabel({ approved: 2, total: 2 }), "2/2 reviewers");
});

test("approved is clamped into 0..total", () => {
	assert.equal(pullRequestReviewersLabel({ approved: 5, total: 2 }), "2/2 reviewers");
	assert.equal(pullRequestReviewersLabel({ approved: -1, total: 2 }), "0/2 reviewers");
});
