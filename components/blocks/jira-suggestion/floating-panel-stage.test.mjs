import assert from "node:assert/strict";
import test from "node:test";

import { reconcileFloatingPanelStage } from "./floating-panel-stage.ts";

const opening = { phase: "expanding", height: 500 };

test("suggestions returning to an open caught-up panel unpack in place instead of waiting for an open animation", () => {
	// Undo or Check again: the panel never reopens, so an opening stage would leave the cards stacked forever.
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "caught-up" }, 5, opening, false), { phase: "unpacking" });
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "caught-up" }, 2, opening, true), { phase: "list" });
});

test("reopening still runs the opening expansion, and an empty panel closes unless it is caught up or closing", () => {
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "reopening" }, 3, opening, false), opening);
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "reopening" }, 0, opening, false), { phase: "caught-up" });
	assert.deepEqual(reconcileFloatingPanelStage({ phase: "list" }, 0, opening, false), { phase: "closed" });
	assert.equal(reconcileFloatingPanelStage({ phase: "closing" }, 0, opening, false), null);
	assert.equal(reconcileFloatingPanelStage({ phase: "unpacking" }, 5, opening, false), null);
});
