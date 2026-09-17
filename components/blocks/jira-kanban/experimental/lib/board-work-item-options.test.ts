import assert from "node:assert/strict";
import test from "node:test";

import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { appendBoardCardFromDraft, boardHasWorkItem, nextBoardIssueKey, toAgentSessionWorkItemOptions } from "./board-work-item-options.ts";

function column(
	title: string,
	cards: readonly { code: string; title: string; issueType?: JiraKanbanColumnData["cards"][number]["issueType"] }[],
): JiraKanbanColumnData {
	return {
		cards: cards.map((card) => ({
			code: card.code,
			issueType: card.issueType,
			priority: "medium",
			tags: [],
			title: card.title,
		})),
		count: cards.length,
		title,
	};
}

test("work-item options carry the key, summary and type the picker renders", () => {
	const options = toAgentSessionWorkItemOptions([
		column("To do", [{ code: "RFP-101", title: "Prepare the bid" }]),
		column("Doing", [{ code: "RFP-102", issueType: "story", title: "Parse the questionnaire" }]),
	]);

	assert.deepEqual(options, [
		{ issueType: undefined, key: "RFP-101", summary: "Prepare the bid" },
		{ issueType: "story", key: "RFP-102", summary: "Parse the questionnaire" },
	]);
});

test("work-item options flatten every column, so the picker is not one column's view", () => {
	const options = toAgentSessionWorkItemOptions([
		column("To do", [{ code: "RFP-101", title: "One" }, { code: "RFP-102", title: "Two" }]),
		column("Done", [{ code: "RFP-103", title: "Three" }]),
	]);

	assert.deepEqual(options.map((option) => option.key), ["RFP-101", "RFP-102", "RFP-103"]);
});

test("an empty board offers no work items rather than a phantom row", () => {
	assert.deepEqual(toAgentSessionWorkItemOptions([]), []);
	assert.deepEqual(toAgentSessionWorkItemOptions([column("To do", [])]), []);
});

test("the next key continues the board's own prefix and sequence", () => {
	const columns = [
		column("To do", [{ code: "RFP-101", title: "One" }]),
		column("Done", [{ code: "RFP-107", title: "Seven" }]),
	];

	assert.equal(nextBoardIssueKey(columns), "RFP-108");
});

test("the next key takes the highest number, not the last card scanned", () => {
	// Column order need not match key order; taking the last card would mint a
	// key that already exists.
	const columns = [
		column("To do", [{ code: "PAY-90", title: "Ninety" }]),
		column("Doing", [{ code: "PAY-12", title: "Twelve" }]),
	];

	assert.equal(nextBoardIssueKey(columns), "PAY-91");
});

test("an empty board still mints an addressable key", () => {
	assert.equal(nextBoardIssueKey([]), "NEW-1");
});

test("a draft becomes a card in the first column, carrying the typed title and type", () => {
	const columns = [
		column("To do", [{ code: "RFP-101", title: "One" }]),
		column("Done", [{ code: "RFP-102", title: "Two" }]),
	];

	const result = appendBoardCardFromDraft(columns, {
		issueType: "story",
		summary: "Telemetry gap follow-up",
	});

	assert.equal(result.issueKey, "RFP-103");
	const created = result.columns[0].cards.at(-1);
	assert.equal(created?.code, "RFP-103");
	assert.equal(created?.title, "Telemetry gap follow-up");
	assert.equal(created?.issueType, "story");
	// The count the column header renders has to move with the card.
	assert.equal(result.columns[0].count, 2);
	// Untouched columns keep their identity so React can skip them.
	assert.equal(result.columns[1], columns[1]);
});

test("appending a draft does not mutate the columns it was given", () => {
	const columns = [column("To do", [{ code: "RFP-101", title: "One" }])];

	appendBoardCardFromDraft(columns, { issueType: "task", summary: "Second" });

	assert.equal(columns[0].cards.length, 1);
	assert.equal(columns[0].count, 1);
});

test("column create appends an unlinked task to the named column", () => {
	const columns = [column("To do", [{ code: "PAY-101", title: "One" }]), column("In review", [])];
	const result = appendBoardCardFromDraft(columns, { issueType: "task", summary: "Review follow-up" }, "In review");
	assert.equal(result.columns[0], columns[0]);
	assert.equal(result.columns[1].count, 1);
	assert.equal(result.columns[1].cards[0].title, "Review follow-up");
	assert.equal(result.columns[1].cards[0].code, "PAY-102");
	assert.equal(result.columns[1].cards[0].agentActivities, undefined);
});

test("column create declines an unknown destination without changing the board", () => {
	const columns = [column("To do", [])];
	const result = appendBoardCardFromDraft(columns, { issueType: "task", summary: "No destination" }, "Missing");
	assert.equal(result.columns, columns);
	assert.equal(result.issueKey, undefined);
});

test("a draft against an empty board reports no key rather than inventing a column", () => {
	const result = appendBoardCardFromDraft([], { issueType: "task", summary: "Nowhere to land" });

	assert.equal(result.issueKey, undefined);
	assert.deepEqual(result.columns, []);
});

test("a freshly created card is offered by the picker on the next open", () => {
	// The picker reads the same columns the create wrote to, so a create is
	// immediately linkable instead of appearing only after a reload.
	const columns = [column("To do", [{ code: "RFP-101", title: "One" }])];
	const { columns: next } = appendBoardCardFromDraft(columns, {
		issueType: "bug",
		summary: "Fresh",
	});

	assert.deepEqual(
		toAgentSessionWorkItemOptions(next).map((option) => option.key),
		["RFP-101", "RFP-102"],
	);
});

test("the board reports whether a key has a card to link against", () => {
	// Capture hides a session from untracked work, so callers check this first:
	// linking against a key no column carries would lose the session to nothing.
	const columns = [
		column("To do", [{ code: "RFP-101", title: "One" }]),
		column("Done", [{ code: "RFP-102", title: "Two" }]),
	];

	assert.equal(boardHasWorkItem(columns, "RFP-101"), true);
	assert.equal(boardHasWorkItem(columns, "RFP-102"), true);
	assert.equal(boardHasWorkItem(columns, "RFP-999"), false);
	assert.equal(boardHasWorkItem([], "RFP-101"), false);
	assert.equal(boardHasWorkItem([column("To do", [])], "RFP-101"), false);
});
