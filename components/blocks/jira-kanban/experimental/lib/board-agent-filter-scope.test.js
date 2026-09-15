const assert = require("node:assert/strict");
const test = require("node:test");

const {
	cardMatchesAgentFilter,
	filterAgentSessionsByAgentFilter,
	filterJiraKanbanColumnsByAgentFilter,
	resolveAgentFilterViewer,
	sessionMatchesAgentFilter,
} = require("./board-agent-filter.ts");
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
			count: 3,
			cards: [
				card({
					code: "PAY-112",
					agentActivities: [activity("blocked-agent", "awaiting-input")],
				}),
				// Shares the column with PAY-112 and nothing else.
				card({ code: "PAY-115" }),
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

function codesByColumn(columns) {
	return Object.fromEntries(
		columns.map((column) => [column.title, column.cards.map((entry) => entry.code)]),
	);
}

test("Needs input drops cards that only share a column with a waiting session", () => {
	const scoped = filterJiraKanbanColumnsByAgentFilter(columnsFixture(), "needs-input");

	assert.deepEqual(codesByColumn(scoped), {
		"To do": [],
		"In progress": [],
		"In review": ["PAY-112"],
		Done: [],
	});
});

test("scoped columns report the surviving card count, not the original", () => {
	const scoped = filterJiraKanbanColumnsByAgentFilter(columnsFixture(), "needs-input");
	const inReview = scoped.find((column) => column.title === "In review");

	assert.equal(inReview.count, 1);
	assert.equal(scoped.find((column) => column.title === "To do").count, 0);
});

test("Working and Finished scope to their own linked chrome", () => {
	const working = filterJiraKanbanColumnsByAgentFilter(columnsFixture(), "working");
	const finished = filterJiraKanbanColumnsByAgentFilter(columnsFixture(), "finished");

	assert.deepEqual(codesByColumn(working), {
		"To do": [],
		"In progress": ["PAY-105"],
		"In review": ["PAY-121"],
		Done: [],
	});
	assert.deepEqual(codesByColumn(finished), {
		"To do": [],
		"In progress": [],
		"In review": [],
		Done: ["PAY-101"],
	});
});

test("clearing the focus returns every card", () => {
	const cleared = filterJiraKanbanColumnsByAgentFilter(columnsFixture(), null);

	assert.deepEqual(codesByColumn(cleared), {
		"To do": ["PAY-118"],
		"In progress": ["PAY-105"],
		"In review": ["PAY-112", "PAY-115", "PAY-121"],
		Done: ["PAY-101"],
	});
});

test("Untracked leaves status columns alone instead of emptying the board", () => {
	const untracked = filterJiraKanbanColumnsByAgentFilter(columnsFixture(), "untracked");

	assert.deepEqual(codesByColumn(untracked), codesByColumn(columnsFixture()));
});

test("columns with nothing to drop keep their identity", () => {
	const columns = columnsFixture();
	const scoped = filterJiraKanbanColumnsByAgentFilter(columns, "working");
	const inProgressIndex = 1;

	assert.equal(scoped[inProgressIndex], columns[inProgressIndex]);
});

test("agent focus composes with assignee scope", () => {
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
					agentActivities: [activity("waiting-agent", "awaiting-input")],
				}),
			],
		},
	];

	const scoped = filterJiraKanbanColumnsByAgentFilter(
		filterJiraKanbanColumnsByAssignee(columns, new Set(["maya"])),
		"needs-input",
	);

	assert.deepEqual(codesByColumn(scoped), { "In review": ["PAY-121"] });
});

test("the matcher reads the same awaiting-input state the pill counts", () => {
	assert.equal(
		cardMatchesAgentFilter(
			card({ agentActivities: [activity("blocked-agent", "awaiting-input")] }),
			"needs-input",
		),
		true,
	);
	assert.equal(
		cardMatchesAgentFilter(
			card({ agentActivities: [activity("release-agent", "working")] }),
			"needs-input",
		),
		false,
	);
	assert.equal(cardMatchesAgentFilter(card(), "needs-input"), false);
});

const VENN_VIEWER = {
	avatarSrc: "/avatar-user/venn/venn.png",
	id: "venn",
	name: "Venn",
};

function session(id, overrides = {}) {
	return {
		agent: { brandName: "claude", id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id,
		state: "complete",
		title: `${id} title`,
		...overrides,
	};
}

test("Needs input keeps the viewer's waiting unlink sessions and drops the rest", () => {
	const items = [
		session("venn-waiting", {
			invokedBy: { avatarSrc: VENN_VIEWER.avatarSrc, name: VENN_VIEWER.name },
			state: "needs-input",
		}),
		session("venn-attention", {
			invokedBy: { avatarSrc: VENN_VIEWER.avatarSrc, name: VENN_VIEWER.name },
			state: "attention",
		}),
		session("venn-running", {
			invokedBy: { avatarSrc: VENN_VIEWER.avatarSrc, name: VENN_VIEWER.name },
			state: "running",
		}),
		session("maya-waiting", {
			invokedBy: { avatarSrc: "/maya.png", name: "Maya Ferreira" },
			state: "needs-input",
		}),
		session("unowned-waiting", { role: "owner", state: "needs-input" }),
		session("viewer-waiting", { role: "viewer", state: "needs-input" }),
	];

	assert.deepEqual(
		filterAgentSessionsByAgentFilter(items, "needs-input", VENN_VIEWER).map((item) => item.id),
		["venn-waiting", "venn-attention", "unowned-waiting"],
	);
});

test("Needs input without a viewer keeps every waiting unlink session", () => {
	const items = [
		session("maya-waiting", {
			invokedBy: { name: "Maya Ferreira" },
			state: "needs-input",
		}),
		session("running", { state: "running" }),
	];

	assert.deepEqual(
		filterAgentSessionsByAgentFilter(items, "needs-input").map((item) => item.id),
		["maya-waiting"],
	);
});

test("clearing the Agents focus returns every unlink session", () => {
	const items = [session("a"), session("b", { state: "needs-input" })];

	assert.equal(filterAgentSessionsByAgentFilter(items, null), items);
});

test("the session matcher reads the same lifecycle the board cards use", () => {
	assert.equal(
		sessionMatchesAgentFilter(session("waiting", { state: "needs-input" }), "needs-input"),
		true,
	);
	assert.equal(
		sessionMatchesAgentFilter(session("running", { state: "running" }), "working"),
		true,
	);
	assert.equal(
		sessionMatchesAgentFilter(session("done", { state: "complete" }), "finished"),
		true,
	);
	assert.equal(
		sessionMatchesAgentFilter(session("waiting", { state: "needs-input" }), "working"),
		false,
	);
});

test("the prototype viewer resolves from the Pulse roster id", () => {
	const viewer = resolveAgentFilterViewer([
		{ avatarSrc: "/maya.png", id: "maya", name: "Maya Ferreira" },
		{ avatarSrc: VENN_VIEWER.avatarSrc, id: "venn", name: "Venn" },
	]);

	assert.deepEqual(viewer, VENN_VIEWER);
	assert.equal(resolveAgentFilterViewer([{ id: "maya", name: "Maya Ferreira" }]), null);
});
