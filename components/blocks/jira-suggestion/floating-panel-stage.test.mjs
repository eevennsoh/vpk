import assert from "node:assert/strict";
import test from "node:test";

import { reconcileFloatingPanelStage } from "./floating-panel-stage.ts";

test("suggestions returning to an open caught-up panel unpack in place instead of waiting for an open animation", () => {
	// Undo or Check again: the panel never reopens, so an opening stage would leave the cards stacked forever.
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "caught-up" }, 5, false), { phase: "unpacking" });
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "caught-up" }, 2, true), { phase: "list" });
});

test("an empty panel closes unless it is caught up or closing", () => {
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "list" }, 0, false), { phase: "closed" });
	assert.equal(reconcileFloatingPanelStage({ phase: "closing" }, 0, false), null);
	assert.equal(reconcileFloatingPanelStage({ phase: "unpacking" }, 5, false), null);
});
