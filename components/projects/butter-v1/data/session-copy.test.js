const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

let dataPromise;
function loadData() {
	dataPromise ??= esbuild.build({
		stdin: {
			contents: `
				export * from "./components/projects/butter-v1/data/agent-session-sync";
				export * from "./components/projects/butter-v1/data/presentation-board";
				export * from "./components/projects/butter-v1/data/presentation-build";
				export * from "./components/projects/butter-v1/data/work-item-placeholders/done";
				export * from "./components/projects/butter-v1/data/wac-content";
				export * from "./components/projects/butter-v1/data/merchant-journey";
				export * from "./components/projects/butter-v1/lib/list-rows";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "butter-v1-session-copy-harness.ts",
		},
		bundle: true,
		format: "cjs",
		loader: { ".css": "empty" },
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).then((result) => loadCjsModuleFromText(result.outputFiles[0].text, "butter-v1-session-copy-harness.cjs"));
	return dataPromise;
}

test("merchant session snapshot preserves the request and shows ongoing work", async () => {
	const { merchantJourneyChatSnapshot } = await loadData();
	const activity = { id: "PAY-999:session", name: "Claude", label: "Working", state: "working", prompt: "Check the sandbox setup" };
	const snapshot = merchantJourneyChatSnapshot(activity);
	assert.equal(snapshot.messages[0].parts[0].text, "Check the sandbox setup");
	assert.match(snapshot.messages[1].parts[0].text, /first test payment/u);
	const thinking = snapshot.messages.at(-1);
	assert.equal(thinking.id, snapshot.thinkingMessageId);
	assert.equal(thinking.parts.at(-1).data.phase, "start");
	assert.match(merchantJourneyChatSnapshot({ ...activity, prompt: "@Claude" }).messages[0].parts[0].text, /merchant onboarding/u);
});

test("new work-item sessions show their instruction and ongoing work without replacing recorded sessions", async () => {
	const { workItemChatSnapshot } = await loadData();
	const session = { id: "VITA-1:new", agent: { name: "Claude" }, state: "running", message: "Ready to work on Redesign onboarding.", prompt: "Check keyboard navigation" };
	const snapshot = workItemChatSnapshot(session, "Redesign onboarding");
	assert.equal(snapshot.messages[0].parts[0].text, "Check keyboard navigation");
	assert.match(snapshot.messages[1].parts[0].text, /Redesign onboarding/u);
	assert.equal(snapshot.messages.at(-1).id, snapshot.thinkingMessageId);
	assert.equal(snapshot.messages.at(-1).parts.at(-1).data.phase, "start");
	assert.equal(workItemChatSnapshot({ ...session, state: "complete" }, "Redesign onboarding"), undefined);
	assert.equal(workItemChatSnapshot({ ...session, message: "Existing session history" }, "Redesign onboarding"), undefined);
	assert.equal(workItemChatSnapshot({ ...session, prompt: "@Claude" }, "Redesign onboarding").messages[0].role, "assistant");
});

test("seeded and arriving sessions use stable, work-specific titles", async () => {
	const data = await loadData();
	const sessions = [
		...data.BUTTER_SEEDED_AGENT_SESSION_OVERRIDES.values(),
		...data.BUTTER_SYNC_SESSIONS,
		...data.WAC_SEEDED_AGENT_SESSION_OVERRIDES.values(),
		...data.WAC_AGENT_SESSIONS,
	];
	assert.ok(sessions.length > 0);
	for (const session of sessions) {
		assert.equal(session.title, session.shortTitle, session.id);
		assert.doesNotMatch(session.title, /^(?:Cursor|Claude|Codex|GitHub Copilot)$/iu, session.id);
	}
	for (const source of [data.BUTTER_DEFAULT_SYNC_SOURCE, data.WAC_AGENT_SESSION_SYNC_SOURCE]) {
		for (const session of source.sessions) {
			const next = data.advanceButterSyncSession([session], new Map(), session.id, source.cohortById);
			if (!next.nextState) continue;
			assert.equal(next.sessions[0].title, session.title, session.id);
			const final = data.advanceButterSyncSession(next.sessions, next.stateChangeVersions, session.id, source.cohortById);
			if (final.nextState) assert.equal(final.sessions[0].title, session.title, session.id);
		}
	}
});

test("board activities and detached sessions retain work titles and agent names", async () => {
	const data = await loadData();
	for (const columns of [data.createButterPayBoardColumns(), data.createButterWacBoardColumns()]) {
		for (const card of columns.flatMap((column) => column.cards)) {
			for (const activity of card.agentActivities ?? []) {
				assert.ok(activity.sessionTitle, activity.id);
				assert.notEqual(activity.sessionTitle, activity.name, activity.id);
				assert.doesNotMatch(activity.sessionTitle, /^(?:Working|Needs input|Finished|Assigned)$/iu, activity.id);
				const detached = data.toButterDetachedAgentSession(activity, card);
				assert.equal(detached.title, activity.sessionTitle, activity.id);
				assert.equal(detached.agent.name, activity.name, activity.id);
				assert.equal(detached.privateTo, activity.privateTo, activity.id);
				assert.equal(data.toButterAgentActivityFromSession(detached).sessionTitle, activity.sessionTitle, activity.id);
				assert.equal(data.toButterAgentActivityFromSession(detached).privateTo, activity.privateTo, activity.id);
			}
		}
	}
});

test("board sessions show the requested ownership, status and menu defaults", async () => {
	const data = await loadData();
	const cards = data.createButterPayBoardColumns().flatMap((column) => column.cards);
	const card = (code) => cards.find((item) => item.code === code);
	assert.deepEqual(card("PAY-105").agentActivities.map(({ name, role, state }) => [name, role, state]), [["Cursor", "owner", "working"], ["Claude", "owner", "working"]]);
	assert.equal(card("PAY-107").teammateSessionsPresentation, "count");
	assert.deepEqual(card("PAY-107").agentActivities.map(({ role, state }) => [role, state]), [["viewer", "working"], ["viewer", "awaiting-input"]]);
	assert.deepEqual(card("PAY-107").agentActivities.map(({ privateTo }) => privateTo), ["Maya Ferreira", "Jordan Okafor"]);
	assert.equal(card("PAY-123").teammateSessionsPresentation, "expanded");
	assert.deepEqual(card("PAY-123").agentActivities.map(({ name }) => name), ["Claude", "Cursor"]);
	assert.deepEqual(data.assignedAgentsFromCard(card("PAY-123"), data.BUTTER_PAY_BOARD_AGENTS).map(({ name }) => name), ["Claude", "Cursor"]);
	assert.deepEqual(card("PAY-123").agentActivities.map(({ role, state, invokedBy }) => [role, state, invokedBy.name]), [["owner", "working", "Venn"], ["viewer", "awaiting-input", "Jordan Okafor"]]);
	assert.deepEqual(card("PAY-123").agentActivities.map(({ privateTo }) => privateTo), [undefined, "Jordan Okafor"]);
	assert.deepEqual(card("PAY-130").agentActivities.map(({ role, state, invokedBy }) => [role, state, invokedBy.name]), [["owner", "working", "Venn"], ["owner", "awaiting-input", "Venn"]]);
	for (const [key, owners] of [["PAY-132", ["Diego Santos"]], ["PAY-104", ["Jordan Okafor", "Maya Ferreira"]]]) {
		assert.deepEqual(card(key).agentActivities.map(({ role, state, invokedBy }) => [role, state, invokedBy.name]), owners.map((owner) => ["viewer", "working", owner]));
	}
	for (const key of ["PAY-121", "PAY-128"]) assert.equal(card(key).agentActivities?.length ?? 0, 0);
});

test("additional work items include their existing subtasks", async () => {
	const data = await loadData();
	const columns = data.createButterPayBoardColumns();
	const cards = columns.flatMap((column) => column.cards);
	assert.equal(cards.filter((card) => card.parentIssueKey === "PAY-101").length, 0);
	for (const key of ["PAY-102", "PAY-104"]) assert.equal(cards.find((card) => card.code === key).parentIssueKey, undefined);
	assert.equal(data.BUTTER_DONE_PLACEHOLDERS["PAY-101"].children.length, 0);
	assert.equal(data.createButterPay101BuildState().contextResources.subtasks.length, 0);
	for (const [parent, children] of Object.entries({
		"PAY-118": ["PAY-201", "PAY-202", "PAY-203"],
		"PAY-999": ["PAY-265", "PAY-266", "PAY-267"],
		"PAY-127": ["PAY-210", "PAY-211", "PAY-212"],
		"PAY-113": ["PAY-291", "PAY-292", "PAY-293", "PAY-294", "PAY-295"],
	})) {
		assert.deepEqual(cards.filter((card) => card.parentIssueKey === parent).map((card) => card.code).sort(), children);
	}
	const quickstart = cards.find((card) => card.code === "PAY-265");
	assert.equal(quickstart.storyPoints, 3);
	assert.equal(quickstart.dueDate, "2026-08-25");
	assert.equal(quickstart.assignee.name, "Maya Ferreira");
	assert.equal(columns.find((column) => column.cards.includes(quickstart)).title, "To do");
	const rows = data.createListRows(columns, data.BUTTER_PAY_BOARD_AGENTS);
	const collapsed = data.arrangeListHierarchy(rows, new Set());
	assert.equal(collapsed.some((row) => row.issueKey === "PAY-104"), true);
	assert.equal(collapsed.some((row) => row.issueKey === "PAY-291"), false);
	const expanded = data.arrangeListHierarchy(rows, new Set(["PAY-113"]));
	assert.equal(expanded.some((row) => row.issueKey === "PAY-291" && row.parentIssueKey === "PAY-113"), true);
});

test("list projects teammate sessions and keeps PAY-104 independent", async () => {
	const data = await loadData();
	const rows = data.arrangeListHierarchy(data.createListRows(data.createButterPayBoardColumns(), data.BUTTER_PAY_BOARD_AGENTS), new Set());
	for (const [key, count] of [["PAY-132", 1], ["PAY-104", 2], ["PAY-121", 0], ["PAY-128", 0]]) {
		const row = rows.find((item) => item.issueKey === key);
		assert.ok(row, key);
		if (key === "PAY-104") assert.equal(row.parentIssueKey, undefined);
		assert.equal(row.agentSessions.length, count, key);
		assert.ok(row.agentSessions.every((session) => session.role === "viewer" && session.statusKind === "working"), key);
	}
});

test("every Payments SDK work item has an estimate and due date by default", async () => {
	const data = await loadData();
	const cards = data.createButterPayBoardColumns().flatMap((column) => column.cards);
	assert.equal(cards.length, 35);
	for (const card of cards) {
		assert.equal(typeof card.storyPoints, "number", card.code);
		assert.match(card.dueDate ?? "", /^\d{4}-\d{2}-\d{2}$/u, card.code);
	}
	const first = cards.find((card) => card.code === "PAY-118");
	assert.equal(first.storyPoints, 3);
	assert.equal(first.dueDate, "2026-11-23");
});
