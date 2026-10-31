const assert = require("node:assert/strict");
const test = require("node:test");

const { JIRA_ACTIVITY_ENTRIES } = require("../data.ts");
const {
	activityEntryNeedsInput,
	filterJiraActivityEntries,
	matchesJiraActivityFilter,
} = require("./jira-activity-filter.ts");

const PERSON = {
	id: "person-1",
	name: "Venn",
	kind: "person",
};

const AGENT = {
	id: "agent-1",
	name: "Rovo",
	kind: "agent",
};

test("needs-input matches comments whose session summary is needs-input", () => {
	assert.equal(
		activityEntryNeedsInput({
			id: "c1",
			kind: "comment",
			actor: AGENT,
			timestamp: "now",
			body: [],
			sessionItem: {
				id: "s1",
				title: "Waiting",
				state: "needs-input",
				agent: { name: "Rovo" },
			},
		}),
		true,
	);
});

test("needs-input matches comments with a nested reply session that needs input", () => {
	assert.equal(
		activityEntryNeedsInput({
			id: "c1",
			kind: "comment",
			actor: AGENT,
			timestamp: "now",
			body: [],
			sessionItem: {
				id: "s1",
				title: "Lead",
				state: "running",
				agent: { name: "Rovo" },
			},
			replies: [
				{
					id: "r1",
					actor: AGENT,
					timestamp: "now",
					body: "Need a decision",
					sessionItem: {
						id: "s2",
						title: "Child",
						state: "needs-input",
						agent: { name: "Helper" },
					},
				},
			],
		}),
		true,
	);
});

test("needs-input ignores running comments and plain events", () => {
	assert.equal(
		activityEntryNeedsInput({
			id: "c1",
			kind: "comment",
			actor: AGENT,
			timestamp: "now",
			body: [],
			sessionItem: {
				id: "s1",
				title: "Working",
				state: "running",
				agent: { name: "Rovo" },
			},
		}),
		false,
	);
	assert.equal(
		activityEntryNeedsInput({
			id: "e1",
			kind: "event",
			actor: PERSON,
			timestamp: "now",
			segments: [{ type: "text", text: "created the issue" }],
		}),
		false,
	);
});

test("agents-only keeps agent comments and generated-output cards", () => {
	const visible = filterJiraActivityEntries(JIRA_ACTIVITY_ENTRIES, "agents-only");
	assert.deepEqual(
		visible.map((entry) => entry.kind),
		["comment", "changed-files"],
	);
	assert.ok(visible.every((entry) => entry.actor.kind === "agent"));
});

test("needs-input filter keeps only entries awaiting viewer input", () => {
	const visible = filterJiraActivityEntries(JIRA_ACTIVITY_ENTRIES, "needs-input");
	assert.equal(visible.length, 1);
	assert.equal(visible[0].id, "root-cause");
	assert.equal(visible[0].kind, "comment");
	assert.equal(visible[0].sessionItem?.state, "needs-input");
});

test("comments-only keeps human and agent comments", () => {
	const visible = filterJiraActivityEntries(JIRA_ACTIVITY_ENTRIES, "comments-only");
	assert.ok(visible.length >= 2);
	assert.ok(visible.every((entry) => entry.kind === "comment"));
	assert.ok(visible.some((entry) => entry.actor.kind === "person"));
	assert.ok(visible.some((entry) => entry.actor.kind === "agent"));
	assert.ok(!visible.some((entry) => entry.kind === "event" || entry.kind === "changed-files"));
});

test("all returns the original feed reference", () => {
	assert.equal(filterJiraActivityEntries(JIRA_ACTIVITY_ENTRIES, "all"), JIRA_ACTIVITY_ENTRIES);
});

test("history-only retains changes and events without comment cards", () => {
	const comments = filterJiraActivityEntries(JIRA_ACTIVITY_ENTRIES, "comments-only");
	const history = filterJiraActivityEntries(JIRA_ACTIVITY_ENTRIES, "history-only");
	assert.ok(history.length > 0);
	assert.ok(history.every((entry) => entry.kind !== "comment"));
	assert.equal(history.length + comments.length, JIRA_ACTIVITY_ENTRIES.length);
});

test("comments-only matching is kind-based", () => {
	assert.equal(
		matchesJiraActivityFilter(
			{
				id: "c1",
				kind: "comment",
				actor: PERSON,
				timestamp: "now",
				body: [],
			},
			"comments-only",
		),
		true,
	);
	assert.equal(
		matchesJiraActivityFilter(
			{
				id: "e1",
				kind: "event",
				actor: PERSON,
				timestamp: "now",
				segments: [{ type: "text", text: "moved" }],
			},
			"comments-only",
		),
		false,
	);
});

test("insights-only keeps only activity entries tagged as insights", () => {
	const insight = {
		id: "insight-1",
		kind: "event",
		actor: AGENT,
		timestamp: "now",
		segments: [],
		category: "insight",
		createdAtMs: 200,
	};
	const regular = {
		id: "event-1",
		kind: "event",
		actor: PERSON,
		timestamp: "now",
		segments: [{ type: "text", text: "moved" }],
		createdAtMs: 100,
	};

	assert.equal(matchesJiraActivityFilter(insight, "insights-only"), true);
	assert.equal(matchesJiraActivityFilter(regular, "insights-only"), false);
	assert.deepEqual(
		filterJiraActivityEntries([regular, insight], "insights-only"),
		[insight],
	);
});
