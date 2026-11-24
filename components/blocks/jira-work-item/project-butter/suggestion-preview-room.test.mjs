import assert from "node:assert/strict";
import test from "node:test";

import { releasedPreviewPadding } from "./suggestion-preview-room.ts";

test("ending a preview keeps the room the reader is scrolled into, so the details never snap back", () => {
	// Regression: hover-out dropped all 300px of preview room at once, clamping a scrollport parked at its bottom.
	assert.equal(releasedPreviewPadding({ padding: 300, minimum: 16, scrollHeight: 1300, scrollTop: 800, clientHeight: 500 }), 300);
	// 100px of room sits below the viewport; only that goes.
	assert.equal(releasedPreviewPadding({ padding: 300, minimum: 16, scrollHeight: 1300, scrollTop: 700, clientHeight: 500 }), 200);
});

test("the original padding returns once the reader has scrolled clear of the preview room", () => {
	assert.equal(releasedPreviewPadding({ padding: 300, minimum: 16, scrollHeight: 1300, scrollTop: 400, clientHeight: 500 }), null);
});
