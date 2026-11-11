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
				export * from "./components/projects/butter-v1/data/wac-content";
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
				assert.equal(data.toButterAgentActivityFromSession(detached).sessionTitle, activity.sessionTitle, activity.id);
			}
		}
	}
});

test("PAY-123 includes Venn's sessions and four teammate sessions", async () => {
	const data = await loadData();
	const card = data.createButterPayBoardColumns().flatMap((column) => column.cards).find((item) => item.code === "PAY-123");
	const sessions = card.agentActivities;
	assert.deepEqual(sessions.filter((session) => session.role === "owner").map((session) => session.invokedBy.name), ["Venn", "Venn"]);
	assert.deepEqual(sessions.filter((session) => session.role === "viewer").map((session) => session.invokedBy.name).sort(), ["Diego Santos", "Jordan Okafor", "Maya Ferreira", "Priya Raman"]);
});

test("additional work items include their existing subtasks", async () => {
	const data = await loadData();
	const columns = data.createButterPayBoardColumns();
	const cards = columns.flatMap((column) => column.cards);
	for (const [parent, children] of Object.entries({
		"PAY-118": ["PAY-201", "PAY-202", "PAY-203"],
		"PAY-999": ["PAY-265", "PAY-266", "PAY-267"],
		"PAY-127": ["PAY-210", "PAY-211", "PAY-212"],
	})) {
		assert.deepEqual(cards.filter((card) => card.parentIssueKey === parent).map((card) => card.code).sort(), children);
	}
	const quickstart = cards.find((card) => card.code === "PAY-265");
	assert.equal(quickstart.storyPoints, 3);
	assert.equal(quickstart.dueDate, "2026-08-25");
	assert.equal(quickstart.assignee.name, "Maya Ferreira");
	assert.equal(columns.find((column) => column.cards.includes(quickstart)).title, "To do");
});
