import assert from "node:assert/strict";
import test from "node:test";

import {
	measureSessionDragChipPointer,
	sessionDragChipViewportStyle,
} from "./agent-session-drag.ts";

test("the travelling mention chip pins to the viewport while it follows the pointer", () => {
	assert.deepEqual(sessionDragChipViewportStyle(true), {
		left: 0,
		position: "fixed",
		top: 0,
	});
	assert.equal(sessionDragChipViewportStyle(false), undefined);
});

test("pointer coordinates subtract a transformed containing block", () => {
	assert.deepEqual(
		measureSessionDragChipPointer({ x: 785, y: 482 }, { left: 618, top: 384 }),
		{ x: 167, y: 98 },
	);
	assert.deepEqual(
		measureSessionDragChipPointer({ x: 814, y: 482 }, { left: 0, top: 0 }),
		{ x: 814, y: 482 },
	);
});
