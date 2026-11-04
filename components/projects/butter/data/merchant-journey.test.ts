import assert from "node:assert/strict";
import test from "node:test";
import { applyMerchantJourneyToBoard, createMerchantJourneyAgentActivity, merchantJourneyAuthoredCard, projectMerchantJourneyActivities, type MerchantJourneyPhase } from "./merchant-journey.ts";
import type { JiraKanbanColumnData } from "../../../blocks/jira-kanban/index.tsx";

const PHASES: readonly MerchantJourneyPhase[] = ["prepare", "invoke", "working", "pr", "failed", "fixing", "passed", "merged"];

function board(): JiraKanbanColumnData[] {
	return [
		{ title: "To do", count: 2, cards: [
			{ code: "PAY-999", title: "Onboarding", tags: [{ text: "merchant", color: "blue" }], priority: "medium", storyPoints: 5, dueDate: "2026-11-12", agentActivities: [{ id: "other-claude", name: "Claude", label: "Earlier request", state: "working", prompt: "Keep this request" }, { id: "review", name: "Codex", label: "Reviewing", state: "awaiting-input" }] },
			{ code: "PAY-118", title: "Other work", tags: [], priority: "minor" },
		] },
		{ title: "In progress", count: 0, cards: [] },
		{ title: "Done", count: 0, cards: [] },
	];
}

function journeyCard(columns: readonly JiraKanbanColumnData[]) {
	const column = columns.find((item) => item.cards.some((card) => card.code === "PAY-999"));
	const card = column?.cards.find((item) => item.code === "PAY-999");
	assert.ok(column);
	assert.ok(card);
	return { column, card };
}

test("every journey phase can be reached directly with a coherent card and stable Claude session", () => {
	for (const phase of PHASES) {
		const columns = applyMerchantJourneyToBoard(board(), phase, "journey-session");
		const { column, card } = journeyCard(columns);
		const beforeWork = phase === "prepare" || phase === "invoke";
		assert.equal(column.title, phase === "merged" ? "Done" : beforeWork ? "To do" : "In progress", phase);
		assert.equal(card.status, column.title, phase);
		assert.equal(card.pullRequestNumber, beforeWork || phase === "working" ? undefined : 284, phase);
		assert.equal(card.pullRequestStatus, beforeWork || phase === "working" ? undefined : phase === "failed" ? "failed" : phase === "merged" ? "merged" : "open", phase);
		const session = card.agentActivities?.find((activity) => activity.id === "journey-session");
		assert.equal(session?.state, beforeWork ? undefined : phase === "merged" ? "completed" : "working", phase);
		if (session) {
			assert.equal(session.name, "Claude");
			assert.equal(session.invokedBy?.name, "Venn");
			assert.equal(session.agentBrandName, "claude");
		}
		assert.equal(columns.every((item) => item.count === item.cards.length), true, phase);
	}
});

test("any phase can jump backward or forward without stale PR or completion state", () => {
	for (const from of PHASES) {
		for (const to of PHASES) {
			const projected = applyMerchantJourneyToBoard(applyMerchantJourneyToBoard(board(), from, "journey-session"), to, "journey-session");
			assert.deepEqual(projected, applyMerchantJourneyToBoard(board(), to, "journey-session"), `${from} → ${to}`);
		}
	}
});

test("repeated projections are idempotent and do not duplicate sessions", () => {
	for (const phase of PHASES) {
		const once = applyMerchantJourneyToBoard(board(), phase, "journey-session");
		assert.deepEqual(applyMerchantJourneyToBoard(once, phase, "journey-session"), once, phase);
	}
});

test("rewinding removes only journey activity and restores automatic assignment", () => {
	const initial = board();
	const original = journeyCard(initial).card;
	const reset = applyMerchantJourneyToBoard(applyMerchantJourneyToBoard(initial, "merged", "journey-session"), "prepare");
	const { card } = journeyCard(reset);
	assert.deepEqual(card.agentActivities, original.agentActivities);
	assert.equal(card.assignee, undefined);
	assert.equal(card.avatarSrc, undefined);
	assert.equal(card.pullRequestNumber, undefined);
	assert.equal(card.pullRequestPreview, undefined);
	assert.equal(card.pullRequestStatus, undefined);
	assert.equal(card.title, original.title);
	assert.equal(card.tags, original.tags);
	assert.equal(card.storyPoints, 5);
	assert.equal(card.dueDate, "2026-11-12");
	assert.equal(reset[0].cards.find((item) => item.code === "PAY-118"), initial[0].cards[1]);
});

test("authored changes made during the journey survive a rewind", () => {
	const columns = applyMerchantJourneyToBoard(board(), "merged", "journey-session");
	const { card } = journeyCard(columns);
	card.assignee = { id: "alex", name: "Alex" };
	card.avatarSrc = "/alex.png";
	card.title = "Edited onboarding";
	card.storyPoints = 8;
	const rewound = journeyCard(applyMerchantJourneyToBoard(columns, "invoke", "journey-session")).card;
	assert.equal(rewound.assignee?.name, "Alex");
	assert.equal(rewound.avatarSrc, "/alex.png");
	assert.equal(rewound.title, "Edited onboarding");
	assert.equal(rewound.storyPoints, 8);
});

test("an authored unassignment is not overwritten by later phases", () => {
	const columns = applyMerchantJourneyToBoard(board(), "working", "journey-session");
	const { card } = journeyCard(columns);
	card.assignee = undefined;
	card.avatarSrc = undefined;
	const advanced = journeyCard(applyMerchantJourneyToBoard(columns, "pr", "journey-session")).card;
	assert.equal(advanced.assignee, undefined);
	assert.equal(advanced.avatarSrc, undefined);
});

test("opening a projected card exposes authored assignment without mutating the board", () => {
	const columns = applyMerchantJourneyToBoard(board(), "pr", "journey-session");
	const { card } = journeyCard(columns);
	const authored = merchantJourneyAuthoredCard(card);
	assert.equal(authored.assignee, undefined);
	assert.equal(authored.avatarSrc, undefined);
	assert.equal(authored.pullRequestNumber, 284);
	assert.equal(authored.title, card.title);
	assert.equal(card.assignee?.name, "Venn");
	assert.equal(card.avatarSrc, "/avatar-user/venn/venn.png");
	const copiedCard = journeyCard(structuredClone(columns)).card;
	assert.equal(merchantJourneyAuthoredCard(copiedCard).assignee, undefined);
});

test("an explicit later Venn assignment remains authored even though it matches the generated identity", () => {
	const columns = applyMerchantJourneyToBoard(board(), "pr", "journey-session");
	const { card } = journeyCard(columns);
	const explicit = { id: "venn", name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" };
	card.assignee = explicit;
	assert.equal(merchantJourneyAuthoredCard(card).assignee, explicit);
	assert.equal(merchantJourneyAuthoredCard(card).avatarSrc, explicit.avatarSrc);
	const rewound = journeyCard(applyMerchantJourneyToBoard(columns, "prepare", "journey-session")).card;
	assert.equal(rewound.assignee, explicit);
	assert.equal(rewound.avatarSrc, explicit.avatarSrc);
});

test("authored reassignment, unassignment, and avatar edits are returned unchanged", () => {
	const columns = applyMerchantJourneyToBoard(board(), "working", "journey-session");
	const { card } = journeyCard(columns);
	card.avatarSrc = "/custom-avatar.png";
	assert.equal(merchantJourneyAuthoredCard(card).avatarSrc, "/custom-avatar.png");
	card.assignee = { id: "alex", name: "Alex" };
	assert.equal(merchantJourneyAuthoredCard(card).assignee, card.assignee);
	card.assignee = undefined;
	assert.equal(merchantJourneyAuthoredCard(card).assignee, undefined);
});

test("a real journey session is restored from the host after rewinding without losing authored metadata", () => {
	const columns = board();
	const { card } = journeyCard(columns);
	const original = { id: "real-session", name: "Claude", label: "My authored request", state: "awaiting-input" as const, prompt: "Preserve my prompt", invokedBy: { name: "Alex" } };
	card.agentActivities = [...(card.agentActivities ?? []), original];
	const completed = applyMerchantJourneyToBoard(columns, "merged", original);
	const mergedSession = journeyCard(completed).card.agentActivities?.find((activity) => activity.id === original.id);
	assert.equal(mergedSession?.state, "completed");
	assert.equal(mergedSession?.label, original.label);
	assert.equal(mergedSession?.prompt, original.prompt);
	assert.equal(mergedSession?.invokedBy?.name, "Alex");
	const rewound = applyMerchantJourneyToBoard(completed, "prepare", original);
	assert.equal(journeyCard(rewound).card.agentActivities?.some((activity) => activity.id === original.id), false);
	const restored = journeyCard(applyMerchantJourneyToBoard(rewound, "working", original)).card;
	assert.deepEqual(restored.agentActivities?.find((activity) => activity.id === original.id), { ...original, state: "working" });
	assert.equal(restored.agentActivities?.find((activity) => activity.id === "other-claude")?.state, "working");
});

test("preexisting PR data is restored when the journey PR is hidden", () => {
	const columns = board();
	const { card } = journeyCard(columns);
	card.pullRequestNumber = 120;
	card.pullRequestStatus = "open";
	const merged = applyMerchantJourneyToBoard(columns, "merged", "journey-session");
	assert.equal(journeyCard(merged).card.pullRequestNumber, 284);
	const working = journeyCard(applyMerchantJourneyToBoard(merged, "working", "journey-session")).card;
	assert.equal(working.pullRequestNumber, 120);
	assert.equal(working.pullRequestStatus, "open");
});

test("activity helpers are pure and absent session capability does not change unrelated sessions", () => {
	assert.deepEqual(createMerchantJourneyAgentActivity("stable"), createMerchantJourneyAgentActivity("stable"));
	const activities = journeyCard(board()).card.agentActivities;
	assert.equal(projectMerchantJourneyActivities(activities, "merged"), activities);
	assert.deepEqual(projectMerchantJourneyActivities(activities, "merged", "journey-session")?.slice(0, 2), activities);
	assert.equal(activities?.length, 2);
});
