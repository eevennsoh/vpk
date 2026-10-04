const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
					export {
					asxKanbanReducer,
					createInitialAsxKanbanState,
					resolveAsxKanbanColumns,
				} from "./components/projects/jira-golden-journeys-v0/lib/kanban-lifecycle";
				export {
					createAsxKanbanActivity,
					getAsxGenerativeAgentSelection,
					getAsxGenerativeActivityId,
				} from "./components/projects/jira-golden-journeys-v0/data/kanban-data";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "asx-kanban-lifecycle-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

function column(state, title) {
	return state.columns.find((candidate) => candidate.title === title);
}

test("ASX board starts with no Drafting cards and derives every count", async () => {
	const { createInitialAsxKanbanState } = await loadHarness();
	const state = createInitialAsxKanbanState();

	assert.equal(column(state, "Drafting").cards.length, 0);
	for (const boardColumn of state.columns) {
		assert.equal(boardColumn.count, boardColumn.cards.length);
	}
});

test("quick agent assignment moves an Intake card into Drafting and supports multiple agents", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState, resolveAsxKanbanColumns } = await loadHarness();
	let state = createInitialAsxKanbanState();

	state = asxKanbanReducer(state, { type: "assign-agent", cardCodes: ["RFP-102"], agent: { id: "rfp-drafter" } });
	assert.equal(column(state, "Drafting").cards[0].code, "RFP-102");
	assert.deepEqual(state.lifecycleByCode["RFP-102"], {
		agentIds: ["rfp-drafter"],
		agentSelectionsById: { "rfp-drafter": { id: "rfp-drafter" } },
		phase: "thinking",
	});

	state = asxKanbanReducer(state, { type: "assign-agent", cardCodes: ["RFP-102"], agent: { id: "dependency-mapper" } });
	const presentedCard = resolveAsxKanbanColumns(state)
		.find((candidate) => candidate.title === "Drafting").cards[0];
	assert.equal(presentedCard.agentActivityMode, "working");
	assert.equal(presentedCard.agentActivities.length, 2);
});

test("skill and custom-agent actions resolve to distinct activity rows", async () => {
	const { createAsxKanbanActivity, getAsxGenerativeAgentSelection, getAsxGenerativeActivityId } = await loadHarness();
	const skillRequest = {
		kind: "skill",
		issue: { issueKey: "RFP-102", summary: "Draft an RFP" },
		prompt: "Use the skill",
		selectedItem: { id: "skill:design-landing-page", label: "Design landing page" },
	};
	const agentRequest = {
		kind: "agent",
		issue: { issueKey: "RFP-102", summary: "Draft an RFP" },
		prompt: "Ask the agent",
		selectedItem: {
			id: "subagent:readiness-checker",
			label: "Readiness Checker",
			avatarSrc: "/avatar-agent/custom/selected-readiness.svg",
		},
	};

	const skillActivity = createAsxKanbanActivity(getAsxGenerativeActivityId(skillRequest));
	const agentSelection = getAsxGenerativeAgentSelection(agentRequest);
	const agentActivity = createAsxKanbanActivity(agentSelection.id, false, agentSelection);

	assert.equal(skillActivity.id, "skill:design-landing-page");
	assert.equal(skillActivity.name, "Rovo");
	assert.match(skillActivity.avatarSrc, /^data:image\/svg\+xml,/u);
	assert.equal(skillActivity.label, "Auditing message hierarchy");
	assert.match(skillActivity.message, /landing-page narrative/u);
	assert.equal(agentActivity.id, "readiness-checker");
	assert.equal(agentActivity.name, "Readiness Checker");
	assert.equal(agentActivity.avatarSrc, "/avatar-agent/custom/selected-readiness.svg");
	assert.equal(agentActivity.label, "Checking requirement coverage");
	assert.match(agentActivity.message, /mandatory requirements/u);
});

test("agent and skill selections produce distinct thinking, flyout, and unblock copy", async () => {
	const { createAsxKanbanActivity } = await loadHarness();
	const aiInsights = createAsxKanbanActivity("ai-insights-agent", true);
	const readiness = createAsxKanbanActivity("readiness-checker", true);
	const landingPage = createAsxKanbanActivity("skill:design-landing-page", true);
	const mobileInterface = createAsxKanbanActivity("skill:develop-mobile-app-interface", true);

	assert.notDeepEqual(aiInsights.labels, readiness.labels);
	assert.notEqual(aiInsights.message, readiness.message);
	assert.equal(aiInsights.question.label, "Which AI narrative should lead the response?");
	assert.equal(readiness.question.label, "Which readiness gap should we resolve first?");
	assert.notDeepEqual(landingPage.labels, mobileInterface.labels);
	assert.notEqual(landingPage.cycleIntervalMs, mobileInterface.cycleIntervalMs);
	assert.equal(landingPage.question.label, "What should the landing page optimize for?");
	assert.equal(mobileInterface.question.label, "Which mobile journey should we prototype first?");
});

test("multi-selected Intake cards batch-start when dropped into Drafting", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();
	const toggle = { shiftKey: false, metaOrCtrlKey: true };

	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-102", columnTitle: "RFP Intake", indexInColumn: 1, modifiers: toggle });
	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-103", columnTitle: "RFP Intake", indexInColumn: 2, modifiers: toggle });
	state = asxKanbanReducer(state, { type: "drag-start", cardCode: "RFP-102", sourceColumnTitle: "RFP Intake" });
	state = asxKanbanReducer(state, { type: "drop", targetColumnTitle: "Drafting" });

	assert.deepEqual(column(state, "Drafting").cards.map((card) => card.code), ["RFP-102", "RFP-103"]);
	assert.deepEqual(state.lifecycleByCode["RFP-102"].agentIds, ["rfp-drafter"]);
	assert.deepEqual(state.lifecycleByCode["RFP-103"].agentIds, ["rfp-drafter"]);
	assert.equal(state.selectedCardCodes.size, 0);
});

test("shift selection only includes cards visible in filtered columns", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();
	const selectionColumns = state.columns.map((item) => ({
		...item,
		cards: item.cards.filter((card) => card.code !== "RFP-102"),
	}));
	state = asxKanbanReducer(state, {
		type: "select",
		cardCode: "RFP-101",
		columnTitle: "RFP Intake",
		indexInColumn: 0,
		modifiers: { metaOrCtrlKey: false, shiftKey: false },
		selectionColumns,
	});
	state = asxKanbanReducer(state, {
		type: "select",
		cardCode: "RFP-103",
		columnTitle: "RFP Intake",
		indexInColumn: 1,
		modifiers: { metaOrCtrlKey: false, shiftKey: true },
		selectionColumns,
	});
	assert.deepEqual([...state.selectedCardCodes].sort(), ["RFP-101", "RFP-103"]);
});

test("RFP-101 resolves needs-input and completion states before moving to Review", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState, resolveAsxKanbanColumns } = await loadHarness();
	let state = createInitialAsxKanbanState();
	state = asxKanbanReducer(state, { type: "assign-agent", cardCodes: ["RFP-101"], agent: { id: "rfp-drafter" } });
	state = asxKanbanReducer(state, { type: "advance-generating", cardCode: "RFP-101" });
	assert.equal(state.lifecycleByCode["RFP-101"].phase, "generating");

	state = asxKanbanReducer(state, { type: "request-input", cardCode: "RFP-101" });
	let presentedCard = resolveAsxKanbanColumns(state)
		.find((candidate) => candidate.title === "Drafting").cards[0];
	assert.equal(presentedCard.agentActivityMode, "awaiting-input");
	assert.equal(presentedCard.agentActivities[0].question.kind, "single-select");

	state = asxKanbanReducer(state, { type: "answer-question", cardCode: "RFP-101" });
	assert.equal(state.lifecycleByCode["RFP-101"].phase, "generating");
	state = asxKanbanReducer(state, { type: "complete", cardCode: "RFP-101", generatedOutput: "Draft ready" });
	presentedCard = resolveAsxKanbanColumns(state)
		.find((candidate) => candidate.title === "Review").cards[0];
	assert.equal(presentedCard.code, "RFP-101");
	assert.equal(presentedCard.agentActivityMode, "completed");
	assert.equal(presentedCard.agentDoneRuns.length, 1);
	assert.deepEqual(presentedCard.agentDoneRuns[0], {
		id: "RFP-101:rfp-drafter",
		summary: "Draft ready",
		agentName: "RFP Drafter",
		agentAvatarSrc: presentedCard.agentDoneRuns[0].agentAvatarSrc,
		issueKey: "RFP-101",
		issueSummary: "Acmecorp: Prepare for bid recommendation for ESM RFP",
		relativeTime: "Just now",
		state: "done",
	});
	assert.equal(column(state, "Drafting").cards.length, 0);
});

test("completed runs preserve agent-specific summary and selected avatar", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState, resolveAsxKanbanColumns } = await loadHarness();
	let state = createInitialAsxKanbanState();
	state = asxKanbanReducer(state, {
		type: "assign-agent",
		cardCodes: ["RFP-102"],
		agent: {
			id: "ai-insights-agent",
			name: "AI Insights Agent",
			avatarSrc: "/avatar-agent/custom/ai-insights.svg",
		},
	});
	state = asxKanbanReducer(state, { type: "complete", cardCode: "RFP-102" });
	const completedRun = resolveAsxKanbanColumns(state)
		.find((candidate) => candidate.title === "Review").cards[0].agentDoneRuns[0];

	assert.match(completedRun.summary, /credible AI innovation angle/u);
	assert.equal(completedRun.agentName, "AI Insights Agent");
	assert.equal(completedRun.agentAvatarSrc, "/avatar-agent/custom/ai-insights.svg");
	assert.equal(completedRun.issueKey, "RFP-102");
});

test("toolbar set-status moves all selected cards to the chosen column", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();
	const toggle = { shiftKey: false, metaOrCtrlKey: true };

	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-102", columnTitle: "RFP Intake", indexInColumn: 1, modifiers: toggle });
	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-103", columnTitle: "RFP Intake", indexInColumn: 2, modifiers: toggle });
	state = asxKanbanReducer(state, { type: "set-status", targetColumnTitle: "Review" });

	const reviewCodes = column(state, "Review").cards.map((card) => card.code);
	assert.ok(reviewCodes.includes("RFP-102"));
	assert.ok(reviewCodes.includes("RFP-103"));
});

test("toolbar assign/unassign toggles agents across selected cards", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();
	const toggle = { shiftKey: false, metaOrCtrlKey: true };

	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-102", columnTitle: "RFP Intake", indexInColumn: 1, modifiers: toggle });
	state = asxKanbanReducer(state, { type: "assign-toolbar-agent", agent: { id: "rfp-drafter" }, assigned: true });
	assert.deepEqual(state.lifecycleByCode["RFP-102"].agentIds, ["rfp-drafter"]);

	state = asxKanbanReducer(state, { type: "assign-toolbar-agent", agent: { id: "rfp-drafter" }, assigned: false });
	assert.deepEqual(state.lifecycleByCode["RFP-102"].agentIds, []);
});

test("toolbar clear-selection empties the selection", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();

	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-102", columnTitle: "RFP Intake", indexInColumn: 1, modifiers: { shiftKey: false, metaOrCtrlKey: false } });
	assert.equal(state.anchor.cardCode, "RFP-102");
	assert.equal(state.selectedCardCodes.size, 1);
	state = asxKanbanReducer(state, { type: "clear-selection" });
	assert.equal(state.selectedCardCodes.size, 0);
	assert.equal(state.anchor, null);
});

test("shared ranges shrink and moving the anchor invalidates it", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();
	const choose = (code) => {
		state = asxKanbanReducer(state, {
			type: "select", cardCode: code, columnTitle: "RFP Intake", indexInColumn: 0,
			modifiers: { shiftKey: true, metaOrCtrlKey: false },
		});
	};
	choose("RFP-102");
	choose("RFP-104");
	choose("RFP-103");
	assert.deepEqual([...state.selectedCardCodes], ["RFP-102", "RFP-103"]);
	state = asxKanbanReducer(state, { type: "set-status", targetColumnTitle: "Review" });
	assert.equal(state.anchor, null);
});

test("bulk-assigning one agent produces varied, non-lockstep working states per card", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState, resolveAsxKanbanColumns } = await loadHarness();
	let state = createInitialAsxKanbanState();
	const toggle = { shiftKey: false, metaOrCtrlKey: true };

	// Select three Intake cards and assign the SAME agent to all of them.
	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-102", columnTitle: "RFP Intake", indexInColumn: 1, modifiers: toggle });
	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-103", columnTitle: "RFP Intake", indexInColumn: 2, modifiers: toggle });
	state = asxKanbanReducer(state, { type: "select", cardCode: "RFP-104", columnTitle: "RFP Intake", indexInColumn: 3, modifiers: toggle });
	state = asxKanbanReducer(state, {
		type: "assign-agent",
		cardCodes: ["RFP-102", "RFP-103", "RFP-104"],
		agent: { id: "rfp-drafter" },
	});

	const draftingCards = resolveAsxKanbanColumns(state)
		.find((candidate) => candidate.title === "Drafting").cards;
	const activities = ["RFP-102", "RFP-103", "RFP-104"].map((code) =>
		draftingCards.find((card) => card.code === code).agentActivities[0],
	);

	// Same agent, but each card should start on a different working label and
	// cycle at a different cadence so they don't march in lockstep.
	const startLabels = activities.map((activity) => activity.label);
	assert.equal(new Set(startLabels).size, startLabels.length, "start labels should be distinct per card");

	const cadences = activities.map((activity) => activity.cycleIntervalMs);
	assert.ok(new Set(cadences).size > 1, "cadence should vary across cards");

	// Variation must be deterministic (stable across renders / SSR).
	const rerender = ["RFP-102", "RFP-103", "RFP-104"].map((code) =>
		resolveAsxKanbanColumns(state).find((candidate) => candidate.title === "Drafting").cards
			.find((card) => card.code === code).agentActivities[0].label,
	);
	assert.deepEqual(rerender, startLabels, "labels must be deterministic for a given card");
});

test("drops outside Intake to Drafting do not start a lifecycle", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();
	state = asxKanbanReducer(state, { type: "drag-start", cardCode: "RFP-161", sourceColumnTitle: "Review" });
	state = asxKanbanReducer(state, { type: "drop", targetColumnTitle: "Drafting" });

	assert.equal(state.lifecycleByCode["RFP-161"], undefined);
	assert.equal(column(state, "Review").cards[0].code, "RFP-161");
});

test("dropping a completed card into Submitted moves it and clears the Agent done footer", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState, resolveAsxKanbanColumns } = await loadHarness();
	let state = createInitialAsxKanbanState();

	// Drive RFP-102 through its lifecycle so it lands in Review with a completed run.
	state = asxKanbanReducer(state, { type: "assign-agent", cardCodes: ["RFP-102"], agent: { id: "rfp-drafter" } });
	state = asxKanbanReducer(state, { type: "complete", cardCode: "RFP-102" });
	const reviewCard = resolveAsxKanbanColumns(state)
		.find((candidate) => candidate.title === "Review").cards
		.find((card) => card.code === "RFP-102");
	assert.equal(reviewCard.agentDoneRuns.length, 1);

	// Drag it into Submitted.
	state = asxKanbanReducer(state, { type: "drag-start", cardCode: "RFP-102", sourceColumnTitle: "Review" });
	state = asxKanbanReducer(state, { type: "drop", targetColumnTitle: "Submitted" });

	// The card moved and no longer has a lifecycle entry / completed-run footer.
	assert.ok(column(state, "Submitted").cards.some((card) => card.code === "RFP-102"));
	assert.ok(!column(state, "Review").cards.some((card) => card.code === "RFP-102"));
	assert.equal(state.lifecycleByCode["RFP-102"], undefined);
	const submittedCard = resolveAsxKanbanColumns(state)
		.find((candidate) => candidate.title === "Submitted").cards
		.find((card) => card.code === "RFP-102");
	assert.equal(submittedCard.agentDoneRuns, undefined);
	assert.equal(state.dragged, null);
});

test("dropping into Submitted does not start a new generative lifecycle", async () => {
	const { asxKanbanReducer, createInitialAsxKanbanState } = await loadHarness();
	let state = createInitialAsxKanbanState();

	// RFP-105 starts in Intake with no lifecycle; dropping it into Submitted
	// should move it without assigning an agent or running work.
	state = asxKanbanReducer(state, { type: "drag-start", cardCode: "RFP-105", sourceColumnTitle: "RFP Intake" });
	state = asxKanbanReducer(state, { type: "drop", targetColumnTitle: "Submitted" });

	assert.ok(column(state, "Submitted").cards.some((card) => card.code === "RFP-105"));
	assert.equal(state.lifecycleByCode["RFP-105"], undefined);
});
