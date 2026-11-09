const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createJiraInsightSelectionState,
	getUnreadCheckpointIds,
	reconcileJiraInsightSelectionState,
	selectLatestUnreadCheckpoint,
	sortJiraInsightCheckpoints,
} = require("./jira-insight-model.ts");
const {
	mergeJiraActivityEntriesWithInsights,
	projectJiraInsightCheckpointsToActivityEntries,
} = require("./jira-insight-activity.ts");

const CHECKPOINTS = [
	{ id: "middle", capturedAtMs: 200 },
	{ id: "latest", capturedAtMs: 300 },
	{ id: "earliest", capturedAtMs: 100 },
];

function snapshot(overrides = {}) {
	return {
		summary: "Current state",
		checkpoints: CHECKPOINTS,
		unreadCheckpointIds: ["middle", "latest"],
		revision: "launch-1",
		...overrides,
	};
}

test("sortJiraInsightCheckpoints returns a stable oldest-first copy", () => {
	const sorted = sortJiraInsightCheckpoints(CHECKPOINTS);

	assert.deepEqual(sorted.map((checkpoint) => checkpoint.id), [
		"earliest",
		"middle",
		"latest",
	]);
	assert.deepEqual(CHECKPOINTS.map((checkpoint) => checkpoint.id), [
		"middle",
		"latest",
		"earliest",
	]);
});

test("selection starts on the newest checkpoint and exposes unread ids in checkpoint order", () => {
	const state = createJiraInsightSelectionState(snapshot());

	assert.equal(state.activeCheckpointId, "latest");
	assert.deepEqual(getUnreadCheckpointIds(snapshot(), state), ["middle", "latest"]);
});

test("selecting the latest unread checkpoint marks the current unread set read", () => {
	const current = createJiraInsightSelectionState(snapshot());
	const next = selectLatestUnreadCheckpoint(snapshot(), current);

	assert.equal(next.activeCheckpointId, "latest");
	assert.deepEqual(next.readCheckpointIds, ["middle", "latest"]);
	assert.deepEqual(getUnreadCheckpointIds(snapshot(), next), []);
});

test("reconciliation preserves valid selection and surfaces later unread checkpoints", () => {
	const current = selectLatestUnreadCheckpoint(
		snapshot(),
		createJiraInsightSelectionState(snapshot()),
	);
	const expanded = snapshot({
		checkpoints: [...CHECKPOINTS, { id: "newest", capturedAtMs: 400 }],
		unreadCheckpointIds: ["middle", "latest", "newest"],
	});
	const next = reconcileJiraInsightSelectionState(expanded, current);

	assert.equal(next.activeCheckpointId, "latest");
	assert.deepEqual(getUnreadCheckpointIds(expanded, next), ["newest"]);
});

test("a new revision resets read state and falls back to the newest available checkpoint", () => {
	const current = {
		activeCheckpointId: "removed",
		readCheckpointIds: ["middle", "latest"],
		revision: "launch-1",
	};
	const reset = snapshot({
		checkpoints: CHECKPOINTS.slice(0, 2),
		revision: "launch-2",
	});
	const next = reconcileJiraInsightSelectionState(reset, current);

	assert.equal(next.activeCheckpointId, "latest");
	assert.deepEqual(next.readCheckpointIds, []);
	assert.equal(next.revision, "launch-2");
});

test("empty snapshots expose no selection or unread ids", () => {
	const empty = snapshot({ checkpoints: [], unreadCheckpointIds: [] });
	const state = createJiraInsightSelectionState(empty);

	assert.equal(state.activeCheckpointId, null);
	assert.deepEqual(getUnreadCheckpointIds(empty, state), []);
});

test("checkpoints project to insight-tagged Jira Activity event rows", () => {
	const [entry] = projectJiraInsightCheckpointsToActivityEntries([{
		id: "decision-1",
		title: "Keep pricing server-owned",
		description: "The server remains authoritative.",
		capturedAtMs: 200,
		sources: [],
	}]);

	assert.equal(entry.id, "decision-1");
	assert.equal(entry.kind, "event");
	assert.equal(entry.category, "insight");
	assert.equal(entry.createdAtMs, 200);
	assert.equal(entry.showActor, false);
	assert.equal(entry.showTimestamp, false);
	assert.deepEqual(entry.segments, []);
});

test("activity and insight rows merge oldest-first without mutating either input", () => {
	const actor = { id: "person-1", name: "Venn", kind: "person" };
	const activityEntries = [
		{
			id: "activity-early",
			kind: "event",
			actor,
			timestamp: "earlier",
			segments: [],
			createdAtMs: 100,
		},
		{
			id: "activity-late",
			kind: "event",
			actor,
			timestamp: "later",
			segments: [],
			createdAtMs: 300,
		},
	];
	const checkpoints = [
		{
			id: "decision-middle",
			title: "Middle decision",
			description: "Captured between activity rows.",
			capturedAtMs: 200,
			sources: [],
		},
		{
			id: "decision-tied",
			title: "Tied decision",
			description: "Captured after the activity at the same time.",
			capturedAtMs: 300,
			sources: [],
		},
	];

	const merged = mergeJiraActivityEntriesWithInsights(activityEntries, checkpoints);

	assert.deepEqual(merged.map((entry) => entry.id), [
		"activity-early",
		"decision-middle",
		"activity-late",
		"decision-tied",
	]);
	assert.deepEqual(activityEntries.map((entry) => entry.id), [
		"activity-early",
		"activity-late",
	]);
	assert.deepEqual(checkpoints.map((checkpoint) => checkpoint.id), [
		"decision-middle",
		"decision-tied",
	]);
});
