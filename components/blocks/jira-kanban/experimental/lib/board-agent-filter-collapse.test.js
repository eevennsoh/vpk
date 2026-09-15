const assert = require("node:assert/strict");
const test = require("node:test");

const {
	agentSessionColumnCollapsedForAgentFilter,
	collapsedColumnsForAgentFilter,
	displayedAgentSessionColumnCollapsedForAgentFilter,
	displayedCollapsedColumnsForAgentFilter,
} = require("./board-agent-filter.ts");
const { shownSessionStateIdsForAgentFilter } = require("../data/board-view-options.ts");
const { filterJiraKanbanColumnsByAssignee } = require("../../state.ts");

function activity(id, state) {
	return { id, label: id, name: id, state };
}

function card(overrides = {}) {
	return {
		code: "PAY-1",
		priority: "major",
		tags: [],
		title: "Port the v2 client",
		...overrides,
	};
}

function columnsFixture() {
	return [
		{
			title: "To do",
			count: 1,
			cards: [card({ code: "PAY-118" })],
		},
		{
			title: "In progress",
			count: 1,
			cards: [card({
				code: "PAY-105",
				agentActivities: [activity("working-agent", "working")],
			})],
		},
		{
			title: "In review",
			count: 2,
			cards: [
				card({
					code: "PAY-112",
					agentActivities: [activity("blocked-agent", "awaiting-input")],
				}),
				card({
					code: "PAY-121",
					agentActivities: [activity("release-agent", "working")],
				}),
			],
		},
		{
			title: "Done",
			count: 1,
			cards: [card({
				code: "PAY-101",
				agentActivityMode: "completed",
				agentDoneRuns: [{ id: "done-run", summary: "Captured inventory" }],
			})],
		},
	];
}

test("Needs input collapses every status column that has no waiting session", () => {
	const collapsed = collapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "needs-input",
	});

	assert.deepEqual([...collapsed].sort(), ["Done", "In progress", "To do"]);
	assert.equal(collapsed.has("In review"), false);
});

test("Working keeps every column that still shows a working session", () => {
	const collapsed = collapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "working",
	});

	assert.deepEqual([...collapsed].sort(), ["Done", "To do"]);
	assert.equal(collapsed.has("In progress"), false);
	assert.equal(collapsed.has("In review"), false);
});

test("Finished keeps only columns with completed-run chrome", () => {
	const collapsed = collapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "finished",
	});

	assert.deepEqual([...collapsed].sort(), ["In progress", "In review", "To do"]);
	assert.equal(collapsed.has("Done"), false);
});

test("Untracked collapses every status column because none hold linked chrome", () => {
	const collapsed = collapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "untracked",
	});

	assert.deepEqual([...collapsed].sort(), ["Done", "In progress", "In review", "To do"]);
});

test("switching filters replaces the collapsed set instead of accumulating", () => {
	const needsInput = collapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "needs-input",
	});
	const finished = collapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "finished",
	});

	assert.equal(needsInput.has("Done"), true);
	assert.equal(finished.has("Done"), false);
	assert.equal(finished.has("In review"), true);
});

test("assignee filter only keeps columns whose remaining cards match the agent state", () => {
	const columns = [
		{
			title: "In review",
			count: 2,
			cards: [
				card({
					assignee: { id: "jordan", name: "Jordan", avatarSrc: "/jordan.png" },
					code: "PAY-112",
					agentActivities: [activity("blocked-agent", "awaiting-input")],
				}),
				card({
					assignee: { id: "maya", name: "Maya", avatarSrc: "/maya.png" },
					code: "PAY-121",
					agentActivities: [activity("release-agent", "working")],
				}),
			],
		},
	];

	const jordanNeedsInput = collapsedColumnsForAgentFilter({
		columns: filterJiraKanbanColumnsByAssignee(columns, new Set(["jordan"])),
		filterId: "needs-input",
	});
	const jordanWorking = collapsedColumnsForAgentFilter({
		columns: filterJiraKanbanColumnsByAssignee(columns, new Set(["jordan"])),
		filterId: "working",
	});

	assert.equal(jordanNeedsInput.has("In review"), false);
	assert.equal(jordanWorking.has("In review"), true);
});

test("Untracked and Needs input expand the session column; Working and Finished collapse it", () => {
	assert.equal(agentSessionColumnCollapsedForAgentFilter("untracked"), false);
	assert.equal(agentSessionColumnCollapsedForAgentFilter("needs-input"), false);
	assert.equal(agentSessionColumnCollapsedForAgentFilter("working"), true);
	assert.equal(agentSessionColumnCollapsedForAgentFilter("finished"), true);
});

test("an active focus overlays viewer collapse without mutating the saved set", () => {
	const viewer = new Set(["In review"]);
	const displayed = displayedCollapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "needs-input",
		viewerCollapsed: viewer,
	});

	assert.deepEqual([...displayed].sort(), ["Done", "In progress", "To do"]);
	assert.deepEqual([...viewer], ["In review"]);
});

test("an active focus honors a temporary viewer override so empty columns can expand", () => {
	const viewer = new Set(["In review"]);
	const focusedOverride = new Set(["Done", "In progress"]);
	const displayed = displayedCollapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: "needs-input",
		focusedOverride,
		viewerCollapsed: viewer,
	});

	assert.equal(displayed, focusedOverride);
	assert.equal(displayed.has("To do"), false);
	assert.deepEqual([...viewer], ["In review"]);
});

test("clearing the overlay returns the viewer's collapse set by identity", () => {
	const viewer = new Set(["Done"]);
	const displayed = displayedCollapsedColumnsForAgentFilter({
		columns: columnsFixture(),
		filterId: null,
		viewerCollapsed: viewer,
	});

	assert.equal(displayed, viewer);
});

test("assignee scope changes which focused columns stay expanded", () => {
	const columns = [
		{
			title: "In review",
			count: 2,
			cards: [
				card({
					assignee: { id: "jordan", name: "Jordan", avatarSrc: "/jordan.png" },
					code: "PAY-112",
					agentActivities: [activity("blocked-agent", "awaiting-input")],
				}),
				card({
					assignee: { id: "maya", name: "Maya", avatarSrc: "/maya.png" },
					code: "PAY-121",
					agentActivities: [activity("release-agent", "working")],
				}),
			],
		},
	];

	const jordan = displayedCollapsedColumnsForAgentFilter({
		columns: filterJiraKanbanColumnsByAssignee(columns, new Set(["jordan"])),
		filterId: "working",
		viewerCollapsed: new Set(),
	});
	const maya = displayedCollapsedColumnsForAgentFilter({
		columns: filterJiraKanbanColumnsByAssignee(columns, new Set(["maya"])),
		filterId: "working",
		viewerCollapsed: new Set(),
	});

	assert.equal(jordan.has("In review"), true);
	assert.equal(maya.has("In review"), false);
});

test("Untracked and Needs input overlays expand the session column without writing viewer collapse", () => {
	assert.equal(displayedAgentSessionColumnCollapsedForAgentFilter("untracked", true), false);
	assert.equal(displayedAgentSessionColumnCollapsedForAgentFilter("needs-input", true), false);
	assert.equal(displayedAgentSessionColumnCollapsedForAgentFilter("working", false), true);
	assert.equal(displayedAgentSessionColumnCollapsedForAgentFilter(null, true), true);
});

test("shown session ids for a focus row are a singleton, or empty for Untracked", () => {
	assert.deepEqual([...shownSessionStateIdsForAgentFilter("working")], ["working"]);
	assert.deepEqual([...shownSessionStateIdsForAgentFilter("needs-input")], ["needs-input"]);
	assert.deepEqual([...shownSessionStateIdsForAgentFilter("finished")], ["finished"]);
	assert.equal(shownSessionStateIdsForAgentFilter("untracked").size, 0);
});
