import assert from "node:assert/strict";
import test from "node:test";

import { reconcileFloatingPanelStage, settleMeasuredStage } from "./floating-panel-stage.ts";

test("suggestions returning to an open caught-up panel measure, then unpack in place instead of waiting for an open animation", () => {
	// Undo or Check again: the panel never reopens, so an opening stage would leave the cards stacked forever.
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "caught-up" }, 5, false, false), { phase: "measuring", then: "unpacking" });
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "caught-up" }, 2, true, false), { phase: "list" });
});

test("a measured panel holds the list's full height through the unpack, like the first open", () => {
	// Regression: Check again unpacked at the stack's height and grew under the cards, so they had no room to fan into.
	assert.deepEqual(settleMeasuredStage({ phase: "measuring", then: "unpacking" }, 312), { phase: "unpacking", height: 312 });
	assert.deepEqual(settleMeasuredStage({ phase: "measuring", then: "expanding" }, 420), { phase: "expanding", height: 420 });
	assert.equal(settleMeasuredStage({ phase: "closed" }, 312), null);
});

test("an empty panel closes unless it is caught up or closing", () => {
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "list" }, 0, false, false), { phase: "closed" });
	assert.equal(reconcileFloatingPanelStage({ phase: "closing" }, 0, false, false), null);
	assert.equal(reconcileFloatingPanelStage({ phase: "unpacking", height: 312 }, 5, false, false), null);
});

test("a check holds the stack until it ends, then unpacks in place at the same height", () => {
	assert.equal(reconcileFloatingPanelStage({ phase: "checking", height: 420 }, 5, false, true), null);
	// Finished or cancelled: either way the stack unpacks back into the list.
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "checking", height: 420 }, 7, false, false), { phase: "unpacking", height: 420 });
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "checking", height: 420 }, 5, true, false), { phase: "list" });
});
