const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
	linkJiraKanbanAgentSession,
} = require("../../../blocks/jira-kanban/state.ts");
const {
	applyAssignedAgentIdsToColumns,
	applyListOrder,
	appendBoardCreatedListOrder,
	createBoardWorkItemFromSession,
	createListRows,
	createListRowIndex,
	selectListRows,
	createListWorkItemFromSession,
	getNextPayIssueKey,
	insertListOrderKey,
	insertWorkItemCard,
	moveListOrder,
	progressJiraTeamEu26WorkItemOnStart,
	toKanbanCardFromDraft,
} = require("./list-rows.ts");
const {
	JIRA_TEAM_EU26_PAY_CURRENT_USER,
} = require("../data/current-user.ts");

const PAY_BOARD_CATALOG = [
	{
		id: "claude-code",
		name: "Claude Code",
		byline: "Coding agent by Anthropic",
		brandName: "claude",
	},
	{
		id: "review-agent",
		name: "Codex",
		byline: "Reviews every pull request",
		brandName: "openai-codex",
	},
	{
		id: "test-agent",
		name: "Cursor",
		byline: "Writes and repairs tests",
		brandName: "cursor",
	},
	{
		id: "release-agent",
		name: "GitHub Copilot",
		byline: "Owns the flag and rollout",
		brandName: "github-copilot",
	},
];

const COLUMNS = [
	{
		title: "To do",
		count: 2,
		cards: [
			{
				code: "PAY-118",
				title: "First",
				priority: "medium",
				tags: [],
				assignee: { id: "diego", name: "Diego Santos", avatarSrc: "/diego.png" },
			},
			{
				code: "PAY-107",
				title: "Second",
				priority: "major",
				tags: [{ text: "wallet", color: "purple" }],
			},
		],
	},
	{
		title: "In progress",
		count: 1,
		cards: [
			{
				code: "PAY-101",
				title: "Third",
				priority: "minor",
				tags: [],
				agentActivities: [{
					id: "claude",
					invokedBy: {
						avatarSrc: JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc,
						name: JIRA_TEAM_EU26_PAY_CURRENT_USER.name,
					},
					name: "Claude Code",
					role: "owner",
					state: "working",
				}],
			agentDoneRuns: [{ agentName: "Codex", state: "done" }],
			},
		],
	},
];

test("createListRows flattens board columns and maps agent sessions", () => {
	const rows = createListRows(COLUMNS, PAY_BOARD_CATALOG);

	assert.deepEqual(rows.map((row) => row.issueKey), ["PAY-118", "PAY-107", "PAY-101"]);
	assert.equal(rows[0]?.status, "To do");
	assert.equal(rows[0]?.statusVariant, "neutral");
	assert.equal(rows[2]?.status, "In progress");
	assert.equal(rows[2]?.statusVariant, "information");
	assert.deepEqual(rows[2]?.agentSessions, [
		{
			id: "claude-code",
			name: "Claude Code",
			byline: "Coding agent by Anthropic",
				brandName: "claude",
				invokedBy: {
					avatarSrc: JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc,
					name: JIRA_TEAM_EU26_PAY_CURRENT_USER.name,
				},
				role: "owner",
				statusKind: "working",
			statusLabel: "Working",
		},
		{
			id: "review-agent",
			name: "Codex",
			byline: "Reviews every pull request",
			brandName: "openai-codex",
			statusKind: "finished",
			statusLabel: "Finished",
		},
	]);
	assert.equal(rows[0]?.assignee?.name, "Diego Santos");
	assert.equal(rows[1]?.assignee, undefined);
	assert.deepEqual(rows[0]?.agentSessions, []);
});

test("createListRows preserves local and cloud session hosts", () => {
	const cards = ["local", "cloud"].map((host, index) => ({
		code: `PAY-${200 + index}`,
		title: "Session host",
		agentActivities: [{ id: "test-agent", name: "Cursor", state: "working", host }],
	}));
	const rows = createListRows([{ title: "In progress", cards }], PAY_BOARD_CATALOG);
	assert.deepEqual(rows.map((row) => row.agentSessions[0].host), ["local", "cloud"]);
});

test("finished list sessions preserve the human who invoked the run", () => {
	const invokedBy = { name: "Maya Ferreira", avatarSrc: "/maya.png" };
	const rows = createListRows([{ title: "Done", cards: [{
		code: "PAY-101",
		title: "Inventory",
		agentDoneRuns: [{ id: "inventory", agentName: "Claude Code", state: "done", invokedBy }],
	}] }], PAY_BOARD_CATALOG);
	assert.deepEqual(rows[0].agentSessions[0].invokedBy, invokedBy);
	assert.equal(rows[0].agentSessions[0].statusKind, "finished");
});

test("applyListOrder keeps a custom rank and appends new keys", () => {
	const rows = createListRows(COLUMNS, PAY_BOARD_CATALOG);

	assert.deepEqual(
		applyListOrder(rows, ["PAY-101", "PAY-118"]).map((row) => row.issueKey),
		["PAY-101", "PAY-118", "PAY-107"],
	);
	assert.deepEqual(
		applyListOrder(rows, []).map((row) => row.issueKey),
		["PAY-118", "PAY-107", "PAY-101"],
	);
});

test("moveListOrder rearranges among visible keys and leaves hidden keys in place", () => {
	assert.deepEqual(
		moveListOrder(["PAY-118", "PAY-107", "PAY-101"], ["PAY-118", "PAY-107", "PAY-101"], "PAY-101", 0),
		["PAY-101", "PAY-118", "PAY-107"],
	);
	assert.deepEqual(
		moveListOrder(["PAY-118", "HIDDEN", "PAY-107", "PAY-101"], ["PAY-118", "PAY-107", "PAY-101"], "PAY-107", 0),
		["PAY-107", "HIDDEN", "PAY-118", "PAY-101"],
	);
	assert.deepEqual(
		moveListOrder([], ["PAY-118", "PAY-107", "PAY-101"], "PAY-118", 2),
		["PAY-107", "PAY-101", "PAY-118"],
	);
});

test("insertListOrderKey places a created key at the list insertion index", () => {
	assert.deepEqual(
		insertListOrderKey(["PAY-118", "PAY-107"], ["PAY-118", "PAY-107"], "PAY-200", 1),
		["PAY-118", "PAY-200", "PAY-107"],
	);
	assert.deepEqual(
		insertListOrderKey(["PAY-118", "PAY-107"], ["PAY-118", "PAY-107"], "PAY-200", null),
		["PAY-118", "PAY-107", "PAY-200"],
	);
});

test("getNextPayIssueKey increments the highest PAY issue number", () => {
	assert.equal(getNextPayIssueKey(COLUMNS), "PAY-119");
});

test("toKanbanCardFromDraft keeps the create editor issue type and due date", () => {
	const card = toKanbanCardFromDraft({
		issueKey: "PAY-200",
		summary: "New work",
		issueType: "bug",
		dueDate: "2026-09-04",
	});
	const rows = createListRows(
		[{ title: "To do", count: 1, cards: [card] }],
		PAY_BOARD_CATALOG,
	);

	assert.equal(card.issueType, "bug");
	assert.equal(card.dueDate, "2026-09-04");
	assert.equal(card.avatarUnassignedKind, "person");
	assert.equal(card.avatarSrc, undefined);
	assert.equal(card.assignee, undefined);
	assert.equal(rows[0]?.issueType, "bug");
	assert.equal(rows[0]?.dueDate, "2026-09-04");
});

test("insertWorkItemCard appends to the named status column", () => {
	const card = toKanbanCardFromDraft({
		issueKey: "PAY-200",
		summary: "New work",
		assignee: { id: "maya", name: "Maya Ferreira", avatarSrc: "/maya.png" },
	});
	const next = insertWorkItemCard(COLUMNS, card, "In progress");
	const inProgress = next.find((column) => column.title === "In progress");

	assert.equal(inProgress?.cards.at(-1)?.code, "PAY-200");
	assert.equal(inProgress?.count, 2);
	assert.equal(card.avatarSrc, "/maya.png");
	assert.equal(card.avatarUnassignedKind, undefined);
	assert.equal(next.find((column) => column.title === "To do")?.count, 2);
});

test("toKanbanCardFromDraft keeps a selected subagent avatar kind", () => {
	const card = toKanbanCardFromDraft({
		issueKey: "PAY-201",
		summary: "Agent-owned work",
		assignee: {
			id: "review-agent",
			name: "Codex",
			avatarShape: "hexagon",
			avatarUnassignedKind: "agent",
		},
	});

	assert.equal(card.assignee?.id, "review-agent");
	assert.equal(card.avatarSrc, undefined);
	assert.equal(card.avatarShape, "hexagon");
	assert.equal(card.avatarUnassignedKind, "agent");
});

test("applyAssignedAgentIdsToColumns archives and assigns against board columns", () => {
	const archived = applyAssignedAgentIdsToColumns(COLUMNS, "PAY-101", ["review-agent"], PAY_BOARD_CATALOG);
	const archivedCard = archived
		.find((column) => column.title === "In progress")
		?.cards.find((card) => card.code === "PAY-101");

	assert.equal(archivedCard?.agentActivities, undefined);
	assert.deepEqual(archivedCard?.agentDoneRuns?.map((run) => run.agentName), ["Codex"]);

	const assigned = applyAssignedAgentIdsToColumns(COLUMNS, "PAY-118", ["test-agent"], PAY_BOARD_CATALOG);
	const assignedCard = assigned
		.find((column) => column.title === "In progress")
		?.cards.find((card) => card.code === "PAY-118");

	const assignedFromSessionId = applyAssignedAgentIdsToColumns(
		COLUMNS,
		"PAY-118",
		["PAY-118:test-agent"],
		PAY_BOARD_CATALOG,
	);
	const assignedFromSessionIdCard = assignedFromSessionId
		.find((column) => column.title === "In progress")
		?.cards.find((card) => card.code === "PAY-118");
	assert.equal(assignedFromSessionIdCard?.agentActivities?.[0]?.id, "PAY-118:test-agent");
	assert.equal(assignedFromSessionIdCard?.agentActivities?.[0]?.name, "Cursor");

	assert.equal(assignedCard?.agentActivities?.[0]?.id, "PAY-118:test-agent");
	assert.equal(assignedCard?.agentActivities?.[0]?.name, "Cursor");
	assert.equal(assignedCard?.agentActivities?.[0]?.state, "working");
	assert.equal(assignedCard?.agentActivities?.[0]?.startupSequence, "jira-work-item-start");
	assert.equal(typeof assignedCard?.agentActivities?.[0]?.startedAtMs, "number");
	assert.deepEqual(assignedCard?.agentActivities?.[0]?.invokedBy, {
		avatarSrc: JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc,
		name: JIRA_TEAM_EU26_PAY_CURRENT_USER.name,
	});
	assert.equal(assignedCard?.agentActivities?.[0]?.role, "owner");

	const keptFromSessionIds = applyAssignedAgentIdsToColumns(
		COLUMNS,
		"PAY-101",
		["PAY-101:claude-code", "review-agent"],
		PAY_BOARD_CATALOG,
	);
	const keptFromSessionIdsCard = keptFromSessionIds
		.find((column) => column.title === "In progress")
		?.cards.find((card) => card.code === "PAY-101");
	assert.equal(keptFromSessionIdsCard?.agentActivities?.[0]?.name, "Claude Code");
	assert.equal(keptFromSessionIdsCard?.agentDoneRuns?.[0]?.agentName, "Codex");

	const unchanged = applyAssignedAgentIdsToColumns(
		COLUMNS,
		"PAY-101",
		["claude-code", "review-agent"],
		PAY_BOARD_CATALOG,
	);
	const unchangedCard = unchanged
		.find((column) => column.title === "In progress")
		?.cards.find((card) => card.code === "PAY-101");
	assert.equal(unchangedCard?.agentActivities?.[0]?.name, "Claude Code");
	assert.equal(unchangedCard?.agentDoneRuns?.[0]?.agentName, "Codex");

	const directoryAssigned = applyAssignedAgentIdsToColumns(
		COLUMNS,
		"PAY-118",
		["readiness-checker"],
		[
			...PAY_BOARD_CATALOG,
			{
				id: "readiness-checker",
				name: "Readiness Checker",
				byline: "Rovo agent by Enterprise Solutions",
			},
		],
	);
	const directoryCard = directoryAssigned
		.find((column) => column.title === "In progress")
		?.cards.find((card) => card.code === "PAY-118");
	assert.equal(directoryCard?.agentActivities?.[0]?.id, "PAY-118:readiness-checker");
	assert.equal(directoryCard?.agentActivities?.[0]?.name, "Readiness Checker");
});

test("starting an agent session progresses only To do and Done work items", () => {
	const columns = [
		{ title: "To do", count: 1, cards: [{ code: "PAY-201", title: "Todo card" }] },
		{ title: "In progress", count: 0, cards: [] },
		{ title: "In review", count: 1, cards: [{ code: "PAY-202", title: "Review card" }] },
		{ title: "Done", count: 1, cards: [{ code: "PAY-203", title: "Done card" }] },
	];
	const activity = {
		id: "test-agent",
		label: "Reading the Jira context",
		name: "Cursor",
		state: "working",
	};

	const fromTodo = progressJiraTeamEu26WorkItemOnStart(
		linkJiraKanbanAgentSession(columns, "PAY-201", activity),
		"PAY-201",
	);
	assert.deepEqual(fromTodo.find((column) => column.title === "To do")?.cards, []);
	assert.equal(
		fromTodo.find((column) => column.title === "In progress")?.cards[0]?.code,
		"PAY-201",
	);
	assert.equal(fromTodo.find((column) => column.title === "In progress")?.count, 1);

	const fromDone = progressJiraTeamEu26WorkItemOnStart(
		linkJiraKanbanAgentSession(columns, "PAY-203", activity),
		"PAY-203",
	);
	assert.deepEqual(fromDone.find((column) => column.title === "Done")?.cards, []);
	assert.equal(
		fromDone.find((column) => column.title === "In progress")?.cards[0]?.code,
		"PAY-203",
	);

	const fromReview = progressJiraTeamEu26WorkItemOnStart(
		linkJiraKanbanAgentSession(columns, "PAY-202", activity),
		"PAY-202",
	);
	assert.equal(
		fromReview.find((column) => column.title === "In review")?.cards[0]?.code,
		"PAY-202",
	);
	assert.equal(fromReview.find((column) => column.title === "In progress")?.count, 0);
});

test("createListWorkItemFromSession mints a To-do card titled from the session and attaches the activity", () => {
	const activity = {
		id: "lw-scope-thread",
		label: "Scope the adapter thread",
		name: "Claude Code",
		state: "working",
	};
	const created = createListWorkItemFromSession({
		activity,
		columns: COLUMNS,
		insertion: { insertAtIndex: 1, position: "after", relativeToIssueKey: "PAY-118" },
		linkSession: linkJiraKanbanAgentSession,
		listOrder: ["PAY-118", "PAY-107", "PAY-101"],
		session: { id: "lw-scope-thread", title: "Scope the adapter keep-or-delete argument" },
		visibleKeys: ["PAY-118", "PAY-107", "PAY-101"],
	});

	assert.equal(created.kind, "created");
	assert.equal(created.issueKey, "PAY-119");
	assert.deepEqual(created.listOrder, ["PAY-118", "PAY-119", "PAY-107", "PAY-101"]);
	const todoCard = created.columns
		.find((column) => column.title === "To do")
		?.cards.find((card) => card.code === "PAY-119");
	assert.equal(todoCard?.title, "Scope the adapter keep-or-delete argument");
	assert.equal(todoCard?.issueType, "task");
	assert.equal(todoCard?.assignee?.id, JIRA_TEAM_EU26_PAY_CURRENT_USER.id);
	assert.equal(todoCard?.assignee?.name, JIRA_TEAM_EU26_PAY_CURRENT_USER.name);
	assert.equal(todoCard?.avatarSrc, JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc);
	assert.equal(todoCard?.avatarUnassignedKind, undefined);
	assert.equal(todoCard?.agentActivities?.[0], activity);
	assert.equal(todoCard?.agentActivities?.[0]?.id, "lw-scope-thread");

	const again = createListWorkItemFromSession({
		activity,
		columns: created.columns,
		insertion: { insertAtIndex: 0, position: "before", relativeToIssueKey: "PAY-118" },
		linkSession: linkJiraKanbanAgentSession,
		listOrder: created.listOrder,
		session: { id: "lw-scope-thread", title: "Scope the adapter keep-or-delete argument" },
		visibleKeys: created.listOrder,
	});
	assert.equal(again.kind, "already-attached");
	assert.equal(again.issueKey, "PAY-119");
	assert.equal(again.columns, created.columns);
	assert.equal(again.listOrder, created.listOrder);
	assert.equal(
		created.columns.flatMap((column) => column.cards).filter((card) => card.code === "PAY-119").length,
		1,
	);
});

test("two session creates on one gap keep both issue keys", () => {
	const firstActivity = {
		id: "lw-a",
		label: "First marked session",
		name: "Claude Code",
		state: "complete",
	};
	const secondActivity = {
		id: "lw-b",
		label: "Second marked session",
		name: "Claude Code",
		state: "complete",
	};
	const first = createListWorkItemFromSession({
		activity: firstActivity,
		columns: COLUMNS,
		insertion: { insertAtIndex: 1, position: "after", relativeToIssueKey: "PAY-118" },
		linkSession: linkJiraKanbanAgentSession,
		listOrder: ["PAY-118", "PAY-107", "PAY-101"],
		session: { id: "lw-a", title: "First marked session" },
		visibleKeys: ["PAY-118", "PAY-107", "PAY-101"],
	});
	const second = createListWorkItemFromSession({
		activity: secondActivity,
		columns: first.columns,
		insertion: { insertAtIndex: 2, position: "after", relativeToIssueKey: "PAY-118" },
		linkSession: linkJiraKanbanAgentSession,
		listOrder: first.listOrder,
		session: { id: "lw-b", title: "Second marked session" },
		visibleKeys: first.listOrder,
	});

	assert.equal(first.kind, "created");
	assert.equal(second.kind, "created");
	assert.equal(first.issueKey, "PAY-119");
	assert.equal(second.issueKey, "PAY-120");
	assert.deepEqual(second.listOrder, ["PAY-118", "PAY-119", "PAY-120", "PAY-107", "PAY-101"]);
	const todoCards = second.columns
		.find((column) => column.title === "To do")
		?.cards ?? [];
	assert.equal(todoCards.some((card) => card.code === "PAY-119"), true);
	assert.equal(todoCards.some((card) => card.code === "PAY-120"), true);
});

test("createBoardWorkItemFromSession appends a task to the requested status and attaches its session", () => {
	const activity = {
		id: "lw-board-review",
		label: "Review the board drop behavior",
		name: "Claude Code",
		state: "complete",
	};
	const created = createBoardWorkItemFromSession({
		activity,
		columns: COLUMNS,
		columnTitle: "In progress",
		linkSession: linkJiraKanbanAgentSession,
		session: {
			id: "lw-board-review",
			invokedBy: { avatarSrc: "/maya.png", name: "Maya Ferreira" },
			title: "Review the board drop behavior",
		},
	});

	assert.equal(created.kind, "created");
	assert.equal(created.issueKey, "PAY-119");
	const inProgress = created.columns.find((column) => column.title === "In progress");
	const createdCard = inProgress?.cards.at(-1);
	assert.equal(inProgress?.count, 2);
	assert.equal(createdCard?.code, "PAY-119");
	assert.equal(createdCard?.title, "Review the board drop behavior");
	assert.equal(createdCard?.issueType, "task");
	assert.equal(createdCard?.agentActivities?.[0], activity);
	assert.equal(createdCard?.assignee?.id, JIRA_TEAM_EU26_PAY_CURRENT_USER.id);
	assert.equal(createdCard?.assignee?.name, JIRA_TEAM_EU26_PAY_CURRENT_USER.name);
	assert.equal(createdCard?.avatarSrc, JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc);
	assert.equal(createdCard?.avatarUnassignedKind, undefined);

	const again = createBoardWorkItemFromSession({
		activity,
		columns: created.columns,
		columnTitle: "To do",
		linkSession: linkJiraKanbanAgentSession,
		session: {
			id: "lw-board-review",
			invokedBy: { avatarSrc: "/maya.png", name: "Maya Ferreira" },
			title: "Review the board drop behavior",
		},
	});
	assert.equal(again.kind, "already-attached");
	assert.equal(again.issueKey, "PAY-119");
	assert.equal(again.columns, created.columns);
	assert.equal(
		again.columns.flatMap((column) => column.cards).filter((card) => card.code === "PAY-119").length,
		1,
	);
});

test("the first board create seeds List order from existing board rows before appending", () => {
	assert.deepEqual(
		appendBoardCreatedListOrder({
			columns: COLUMNS,
			issueKey: "PAY-119",
			listOrder: [],
			visibleKeys: [],
		}),
		["PAY-118", "PAY-107", "PAY-101", "PAY-119"],
	);
});

test("sequential board session creates mint distinct PAY keys in the requested status", () => {
	const first = createBoardWorkItemFromSession({
		activity: {
			id: "lw-board-first",
			label: "First board session",
			name: "Claude Code",
			state: "complete",
		},
		columns: COLUMNS,
		columnTitle: "In progress",
		linkSession: linkJiraKanbanAgentSession,
		session: { id: "lw-board-first", title: "First board session" },
	});
	const second = createBoardWorkItemFromSession({
		activity: {
			id: "lw-board-second",
			label: "Second board session",
			name: "Claude Code",
			state: "complete",
		},
		columns: first.columns,
		columnTitle: "In progress",
		linkSession: linkJiraKanbanAgentSession,
		session: { id: "lw-board-second", title: "Second board session" },
	});

	assert.equal(first.kind, "created");
	assert.equal(second.kind, "created");
	assert.equal(first.issueKey, "PAY-119");
	assert.equal(second.issueKey, "PAY-120");
	assert.deepEqual(
		second.columns
			.find((column) => column.title === "In progress")
			?.cards.slice(-2).map((card) => card.code),
		["PAY-119", "PAY-120"],
	);
});

test("a multi-session drop keeps its created rows adjacent when other rows are hidden", () => {
	// Replays the loop `createFromAgentSession` runs once per marked session:
	// board columns, list order, and visible keys all advance in refs so the
	// second session's insertion index is measured against a list that already
	// holds the first session's row. Skipping the visible-keys advance is what
	// used to land the second row one gap too far down.
	const hiddenKey = "PAY-999";
	let columns = COLUMNS;
	let listOrder = ["PAY-118", hiddenKey, "PAY-107", "PAY-101"];
	let visibleKeys = ["PAY-118", "PAY-107", "PAY-101"];
	const dropInsertion = { insertAtIndex: 1, position: "after", relativeToIssueKey: "PAY-118" };
	const created = [];

	["lw-a", "lw-b", "lw-c"].forEach((sessionId, index) => {
		const insertion = { ...dropInsertion, insertAtIndex: dropInsertion.insertAtIndex + index };
		const result = createListWorkItemFromSession({
			activity: { id: sessionId, label: sessionId, name: "Claude Code", state: "complete" },
			columns,
			insertion,
			linkSession: linkJiraKanbanAgentSession,
			listOrder,
			session: { id: sessionId, title: `Session ${sessionId}` },
			visibleKeys,
		});
		columns = result.columns;
		listOrder = result.listOrder;
		visibleKeys = insertListOrderKey(visibleKeys, visibleKeys, result.issueKey, insertion.insertAtIndex);
		created.push(result.issueKey);
	});

	assert.deepEqual(created, ["PAY-119", "PAY-120", "PAY-121"]);
	assert.deepEqual(visibleKeys, ["PAY-118", "PAY-119", "PAY-120", "PAY-121", "PAY-107", "PAY-101"]);
	// The hidden row keeps its rank; what matters is that no visible row is left
	// stranded between the three the drop created.
	assert.equal(listOrder.includes(hiddenKey), true);
	assert.deepEqual(
		listOrder.filter((key) => key !== hiddenKey),
		["PAY-118", "PAY-119", "PAY-120", "PAY-121", "PAY-107", "PAY-101"],
	);
});

test("insertWorkItemCard splices at a named slot and still appends without one", () => {
	const card = { code: "PAY-900", title: "Gap", priority: "medium", tags: [] };
	const toDo = (columns) => columns.find((column) => column.title === "To do");

	assert.deepEqual(
		toDo(insertWorkItemCard(COLUMNS, card, "To do", 1)).cards.map((entry) => entry.code),
		["PAY-118", "PAY-900", "PAY-107"],
	);
	assert.deepEqual(
		toDo(insertWorkItemCard(COLUMNS, card, "To do", 0)).cards.map((entry) => entry.code),
		["PAY-900", "PAY-118", "PAY-107"],
	);
	// The column can change between the drag resolving and the drop committing,
	// so an out-of-range slot clamps rather than tearing a hole in the array.
	assert.deepEqual(
		toDo(insertWorkItemCard(COLUMNS, card, "To do", 99)).cards.map((entry) => entry.code),
		["PAY-118", "PAY-107", "PAY-900"],
	);
	assert.equal(toDo(insertWorkItemCard(COLUMNS, card, "To do", 1)).count, 3);
	// Omitting the slot is what every create-well caller does.
	assert.deepEqual(
		toDo(insertWorkItemCard(COLUMNS, card, "To do")).cards.map((entry) => entry.code),
		["PAY-118", "PAY-107", "PAY-900"],
	);
});

test("createBoardWorkItemFromSession lands a cohort in drag order at one gap", () => {
	// Replays what the board page does per cohort member: the slot advances and
	// the columns from the previous create feed the next one.
	let columns = COLUMNS;
	const created = [];

	["lw-a", "lw-b", "lw-c"].forEach((sessionId, memberIndex) => {
		const result = createBoardWorkItemFromSession({
			activity: { id: sessionId, label: sessionId, name: "Claude Code", state: "complete" },
			columns,
			columnTitle: "To do",
			insertAtIndex: 1 + memberIndex,
			linkSession: linkJiraKanbanAgentSession,
			session: { id: sessionId, title: `Session ${sessionId}` },
		});
		columns = result.columns;
		created.push(result.issueKey);
	});

	assert.deepEqual(
		columns.find((column) => column.title === "To do").cards.map((card) => card.code),
		["PAY-118", created[0], created[1], created[2], "PAY-107"],
	);
	assert.deepEqual(
		columns
			.find((column) => column.title === "To do")
			.cards.flatMap((card) => (card.agentActivities ?? []).map((activity) => activity.id)),
		["lw-a", "lw-b", "lw-c"],
	);
});


test("indexed list rows keep identity through filtering and ordering without stale card content", () => {
	const index = createListRowIndex(COLUMNS, PAY_BOARD_CATALOG);
	const rows = selectListRows(COLUMNS, PAY_BOARD_CATALOG, index);
	const filteredColumns = [{ ...COLUMNS[0], cards: [COLUMNS[0].cards[1]] }, COLUMNS[1]];
	const filtered = applyListOrder(selectListRows(filteredColumns, PAY_BOARD_CATALOG, index), ["PAY-101", "PAY-107"]);
	assert.strictEqual(filtered[0], rows[2]);
	assert.strictEqual(filtered[1], rows[1]);
	assert.strictEqual(selectListRows(COLUMNS, PAY_BOARD_CATALOG, index)[0], rows[0]);

	const editedCard = { ...COLUMNS[0].cards[0], title: "Edited", dueDate: "2026-09-20" };
	const changed = selectListRows([{ ...COLUMNS[0], cards: [editedCard, COLUMNS[0].cards[1]] }], PAY_BOARD_CATALOG, index);
	assert.equal(changed[0].summary, "Edited");
	assert.equal(changed[0].dueDate, "2026-09-20");
	assert.notStrictEqual(changed[0], rows[0]);
	assert.strictEqual(changed[1], rows[1]);
	assert.equal(rows[0].summary, "First");
});

test("indexed rows reflect status moves and session visibility filters", () => {
	const index = createListRowIndex(COLUMNS, PAY_BOARD_CATALOG);
	const moved = selectListRows([{ title: "Done", cards: [COLUMNS[0].cards[0]], count: 1 }], PAY_BOARD_CATALOG, index);
	assert.equal(moved[0].status, "Done");
	assert.equal(moved[0].statusVariant, "success");
	const filteredCard = { ...COLUMNS[1].cards[0], agentActivities: undefined };
	const filtered = selectListRows([{ ...COLUMNS[1], cards: [filteredCard] }], PAY_BOARD_CATALOG, index);
	assert.deepEqual(filtered[0].agentSessions.map((agent) => agent.name), ["Codex"]);
	assert.equal(selectListRows(COLUMNS, PAY_BOARD_CATALOG, index)[2].agentSessions.length, 2);
});
