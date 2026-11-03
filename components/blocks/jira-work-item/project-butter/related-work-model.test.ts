import assert from "node:assert/strict";
import { test } from "node:test";

import { relatedGroupVisibility, relatedListWindow, relatedSummaryItems } from "./related-work-model.ts";

const closed = { attachments: false, children: false, linked: false };

test("filled items hide empty groups unless their composer is open", () => {
	const visibility = relatedGroupVisibility({ counts: { attachments: 2, children: 0, linked: 1 }, composerOpen: closed, dismissed: [], empty: false });
	assert.deepEqual(visibility.shown, { attachments: true, children: false, linked: true });
	assert.equal(visibility.allEmpty, false);
	assert.equal(visibility.count, 2);
	const requested = relatedGroupVisibility({ counts: { attachments: 2, children: 0, linked: 1 }, composerOpen: { ...closed, children: true }, dismissed: [], empty: false });
	assert.equal(requested.shown.children, true);
});

test("a non-empty item with nothing related shows every group, and Empty shows only requested ones", () => {
	const none = { attachments: 0, children: 0, linked: 0 };
	const filled = relatedGroupVisibility({ counts: none, composerOpen: closed, dismissed: [], empty: false });
	assert.deepEqual(filled, { shown: { attachments: true, children: true, linked: true }, allEmpty: true, count: 3 });
	const empty = relatedGroupVisibility({ counts: none, composerOpen: { ...closed, linked: true }, dismissed: [], empty: true });
	assert.deepEqual(empty, { shown: { attachments: false, children: false, linked: true }, allEmpty: false, count: 1 });
});

test("dismissed groups return with content, and a Subtask parent hides child work unless all are empty", () => {
	const none = { attachments: 0, children: 0, linked: 0 };
	assert.equal(relatedGroupVisibility({ counts: none, composerOpen: closed, dismissed: ["linked"], empty: false }).shown.linked, false);
	assert.equal(relatedGroupVisibility({ counts: { ...none, linked: 1 }, composerOpen: closed, dismissed: ["linked"], empty: false }).shown.linked, true);
	assert.equal(relatedGroupVisibility({ counts: { attachments: 1, children: 2, linked: 0 }, composerOpen: closed, dismissed: [], empty: false, parentIsSubtask: true }).shown.children, false);
	assert.equal(relatedGroupVisibility({ counts: none, composerOpen: closed, dismissed: [], empty: false, parentIsSubtask: true }).shown.children, true);
});

test("the collapsed summary uses real counts, singular labels and skips hidden or zero groups", () => {
	const shown = { attachments: true, children: true, linked: true };
	assert.deepEqual(relatedSummaryItems({ attachments: 8, children: 15, linked: 8 }, shown).map((item) => item.label), ["8 attachments", "15 subitems", "8 linked work items"]);
	assert.deepEqual(relatedSummaryItems({ attachments: 1, children: 0, linked: 1 }, { ...shown, linked: false }).map((item) => item.label), ["1 attachment"]);
	assert.deepEqual(relatedSummaryItems({ attachments: 0, children: 1, linked: 1 }, shown).map((item) => item.label), ["1 subitem", "1 linked work item"]);
});

test("list cards show 5 rows, 4 with the composer, and fade the last row only when rows are hidden", () => {
	const items = Array.from({ length: 8 }, (_, index) => index);
	assert.deepEqual(relatedListWindow(items, { expanded: false, composerOpen: false }), { shown: [0, 1, 2, 3, 4], hiddenCount: 3, fadedIndex: 4, showToggle: true });
	assert.deepEqual(relatedListWindow(items, { expanded: false, composerOpen: true }).hiddenCount, 4);
	assert.deepEqual(relatedListWindow(items, { expanded: true, composerOpen: false }), { shown: items, hiddenCount: 0, fadedIndex: null, showToggle: true });
	assert.deepEqual(relatedListWindow([1, 2, 3], { expanded: false, composerOpen: false }), { shown: [1, 2, 3], hiddenCount: 0, fadedIndex: null, showToggle: false });
});
