const assert = require("node:assert/strict");
const test = require("node:test");

const {
	getJiraInsightEditorialSelection,
} = require("./jira-insight-editorial-model.ts");

const CHECKPOINTS = [
	{
		id: "scope",
		capturedAtMs: 100,
		sources: [
			{ id: "description", kind: "work-item-section", label: "Description", sectionId: "description" },
		],
		title: "Confirm the guest checkout scope",
		description: "Keep the existing signed-in flow unchanged.",
	},
	{
		id: "delivery",
		capturedAtMs: 200,
		sources: [
			{ id: "pr", identity: "#1847", kind: "pull-request", label: "PR #1847" },
		],
		title: "Keep safeguards server-owned",
		description: "Pricing and inventory remain authoritative on the server.",
	},
	{
		id: "approval",
		capturedAtMs: 300,
		sources: [
			{ id: "session", kind: "agent-session", label: "Agent session", sessionId: "session-1" },
			{ id: "pr-checks", identity: "#1847", kind: "pull-request", label: "Merge checks" },
		],
		title: "Require two approvals",
		description: "Merge only after both reviewers approve.",
	},
];

test("resolves the active decision and its adjacent chronological checkpoints", () => {
	const selection = getJiraInsightEditorialSelection(CHECKPOINTS, "delivery");

	assert.equal(selection?.checkpoint.id, "delivery");
	assert.equal(selection?.position, 2);
	assert.equal(selection?.total, 3);
	assert.equal(selection?.previousCheckpointId, "scope");
	assert.equal(selection?.nextCheckpointId, "approval");
	assert.equal(selection?.category, "Pull request");
});

test("falls back to the newest decision without creating a second selection", () => {
	const selection = getJiraInsightEditorialSelection(CHECKPOINTS, "removed");

	assert.equal(selection?.checkpoint.id, "approval");
	assert.equal(selection?.position, 3);
	assert.equal(selection?.previousCheckpointId, "delivery");
	assert.equal(selection?.nextCheckpointId, null);
});

test("reports boundary and source metadata for the first decision", () => {
	const selection = getJiraInsightEditorialSelection(CHECKPOINTS, "scope");

	assert.equal(selection?.previousCheckpointId, null);
	assert.equal(selection?.nextCheckpointId, "delivery");
	assert.equal(selection?.sourceCount, 1);
	assert.equal(selection?.category, "Work item");
});

test("uses a neutral category when a decision combines source kinds", () => {
	const selection = getJiraInsightEditorialSelection(CHECKPOINTS, "approval");

	assert.equal(selection?.category, "Mixed evidence");
	assert.equal(selection?.sourceCount, 2);
});

test("returns no editorial selection for an empty timeline", () => {
	assert.equal(getJiraInsightEditorialSelection([], null), null);
});
