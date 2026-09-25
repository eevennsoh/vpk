import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { groupJiraIssueAgentActivityRows, resolveRelatedJiraIssueAgentActivityMode, summarizeJiraIssueAgentActivities } from "./agent-activity-model.ts";

test("single working agent uses the direct Working label", () => {
	assert.deepEqual(
		summarizeJiraIssueAgentActivities([{ state: "working" }]),
		{
			activityCount: 1,
			featuredActivityIndex: 0,
			label: "Working",
			priorityCount: 1,
			priorityState: "working",
		},
	);
});

test("multiple working agents use the direct Working label", () => {
	assert.deepEqual(
		summarizeJiraIssueAgentActivities([
			{ state: "working" },
			{ state: "working" },
		]),
		{
			activityCount: 2,
			featuredActivityIndex: null,
			label: "Working",
			priorityCount: 2,
			priorityState: "working",
		},
	);
});

test("one agent needing input takes priority over every working agent", () => {
	assert.deepEqual(
		summarizeJiraIssueAgentActivities([
			{ state: "working" },
			{ state: "working" },
			{ state: "awaiting-input" },
			{ state: "working" },
			{ state: "working" },
		]),
		{
			activityCount: 5,
			featuredActivityIndex: 2,
			label: "Needs input",
			priorityCount: 1,
			priorityState: "awaiting-input",
		},
	);
});

test("multiple agents needing input use the direct Needs input label", () => {
	assert.deepEqual(
		summarizeJiraIssueAgentActivities([
			{ state: "awaiting-input" },
			{ state: "working" },
			{ state: "awaiting-input" },
		]),
		{
			activityCount: 3,
			featuredActivityIndex: null,
			label: "Needs input",
			priorityCount: 2,
			priorityState: "awaiting-input",
		},
	);
});

test("merged layout keeps every active agent in one prioritized row", () => {
	assert.deepEqual(
		groupJiraIssueAgentActivityRows(
			[
				{ id: "service-impact-agent", state: "working" },
				{ id: "dependency-mapper", state: "working" },
			],
			"merged",
		),
		[
			{
				activities: [
					{ id: "service-impact-agent", state: "working" },
					{ id: "dependency-mapper", state: "working" },
				],
				key: "working-2",
			},
		],
	);
});

test("split layout gives every active agent its own row keyed by agent id", () => {
	assert.deepEqual(
		groupJiraIssueAgentActivityRows(
			[
				{ id: "service-impact-agent", state: "awaiting-input" },
				{ id: "dependency-mapper", state: "working" },
			],
			"split",
		),
		[
			{ activities: [{ id: "service-impact-agent", state: "awaiting-input" }], key: "service-impact-agent" },
			{ activities: [{ id: "dependency-mapper", state: "working" }], key: "dependency-mapper" },
		],
	);
});

test("completed agents never join an active chin row", () => {
	const activities = [
		{ id: "service-impact-agent", state: "completed" },
		{ id: "dependency-mapper", state: "working" },
	] as const;

	assert.deepEqual(
		groupJiraIssueAgentActivityRows(activities, "split"),
		[{ activities: [{ id: "dependency-mapper", state: "working" }], key: "dependency-mapper" }],
	);
	assert.deepEqual(
		groupJiraIssueAgentActivityRows(activities, "merged"),
		[{ activities: [{ id: "dependency-mapper", state: "working" }], key: "working-1" }],
	);
});

test("completed-only activities render one session row per agent in either layout", () => {
	const activities = [
		{ id: "service-impact-agent", state: "completed" },
		{ id: "dependency-mapper", state: "completed" },
	] as const;

	assert.deepEqual(
		groupJiraIssueAgentActivityRows(activities, "merged"),
		[
			{ activities: [{ id: "service-impact-agent", state: "completed" }], key: "service-impact-agent" },
			{ activities: [{ id: "dependency-mapper", state: "completed" }], key: "dependency-mapper" },
		],
	);
	assert.deepEqual(
		groupJiraIssueAgentActivityRows(activities, "split"),
		[
			{ activities: [{ id: "service-impact-agent", state: "completed" }], key: "service-impact-agent" },
			{ activities: [{ id: "dependency-mapper", state: "completed" }], key: "dependency-mapper" },
		],
	);
	assert.deepEqual(
		summarizeJiraIssueAgentActivities([{ state: "completed" }]),
		{
			activityCount: 1,
			featuredActivityIndex: 0,
			label: "Finished",
			priorityCount: 1,
			priorityState: "working",
		},
	);
});

test("related detached sessions keep working mode so the grey backdrop stays", () => {
	assert.equal(resolveRelatedJiraIssueAgentActivityMode("none", true), "working");
	assert.equal(resolveRelatedJiraIssueAgentActivityMode(undefined, true), "working");
	assert.equal(resolveRelatedJiraIssueAgentActivityMode("none", false), "none");
	assert.equal(resolveRelatedJiraIssueAgentActivityMode(undefined, false), undefined);
	assert.equal(resolveRelatedJiraIssueAgentActivityMode("working", true), "working");
	assert.equal(resolveRelatedJiraIssueAgentActivityMode("awaiting-input", true), "awaiting-input");
	assert.equal(resolveRelatedJiraIssueAgentActivityMode("completed", true), "completed");
});
