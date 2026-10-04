import assert from "node:assert/strict";
import test from "node:test";

import { AGENT_SESSION_DECK_STACKED, deckRunFrame, groupDeckRuns } from "./deck-model.ts";
import { applyDeckHostStyle, deckHostStyle, deckRowFromLayout, deckRunZIndex, shouldMeasureDeckItem, type DeckStyleTarget } from "./deck-write.ts";

test("deckRowFromLayout subtracts the scrollport layout origin", () => {
	assert.deepEqual(
		deckRowFromLayout(100, 220, true, 62),
		{ height: 62, marked: true, top: 120 },
	);
});

test("layout rows are independent of transient viewport transforms", () => {
	const row = deckRowFromLayout(100, 220, false, 62);
	assert.equal(row.top, 120);
	assert.equal(row.height, 62);
});

test("shouldMeasureDeckItem skips placeholders, missing hosts, and zero height", () => {
	assert.equal(shouldMeasureDeckItem(false, true, 62), true);
	assert.equal(shouldMeasureDeckItem(true, true, 62), false);
	assert.equal(shouldMeasureDeckItem(false, false, 62), false);
	assert.equal(shouldMeasureDeckItem(false, true, 0), false);
});

test("identity frames clear inline styles instead of writing 1 / none", () => {
	const run = groupDeckRuns([{ height: 62, marked: false, top: 0 }])[0];
	assert.ok(run);
	const frame = deckRunFrame(run, 480, 0, 0, AGENT_SESSION_DECK_STACKED);
	assert.equal(deckHostStyle(frame, 62, "auto"), null);

	const target: DeckStyleTarget = {
		opacity: "0.4",
		transform: "translateY(12px) scale(0.9)",
		transformOrigin: "50% 62px",
		willChange: "transform, opacity",
		zIndex: "12",
	};
	applyDeckHostStyle(target, frame, 0, 12, "auto");
	assert.deepEqual(target, {
		opacity: "",
		transform: "",
		transformOrigin: "",
		willChange: "",
		zIndex: "",
	});
});

test("tucked frames write transform on the host and z-index for the run", () => {
	const rows = Array.from({ length: 16 }, (_, index) => ({
		height: 62,
		marked: false,
		top: index * 66,
	}));
	const last = groupDeckRuns(rows)[15];
	assert.ok(last);
	const portLength = 480;
	const scrollTop = last.top + last.height - portLength;
	const frame = deckRunFrame(last, portLength, scrollTop, 0, AGENT_SESSION_DECK_STACKED);
	const target: DeckStyleTarget = {
		opacity: "",
		transform: "",
		transformOrigin: "",
		willChange: "",
		zIndex: "",
	};
	const zIndex = deckRunZIndex(AGENT_SESSION_DECK_STACKED, last.top);
	applyDeckHostStyle(target, frame, last.top, zIndex, "auto");
	assert.match(target.transform, /translateY\(/u);
	assert.match(target.transform, /scale\(/u);
	assert.equal(target.transformOrigin, `50% ${frame.originTop - last.top}px`);
	assert.equal(target.zIndex, String(zIndex));
	assert.equal(target.willChange, "");
});

test("will-change stays on the host only while the entrance spring is live", () => {
	const run = groupDeckRuns([{ height: 62, marked: false, top: 0 }])[0];
	assert.ok(run);
	const frame = deckRunFrame(run, 480, 0, 0, AGENT_SESSION_DECK_STACKED);
	const style = deckHostStyle(frame, 62, "transform, opacity");
	assert.ok(style);
	assert.equal(style.willChange, "transform, opacity");
	assert.equal(style.transform, "translateY(0px) scale(1)");
});

test("fused rows share one origin, so later cards origin above their own top", () => {
	const run = groupDeckRuns([
		{ height: 58, marked: true, top: 0 },
		{ height: 62, marked: true, top: 58 },
	])[0];
	assert.ok(run);
	const frame = deckRunFrame(run, 480, 0, 1, AGENT_SESSION_DECK_STACKED);
	const first = deckHostStyle(frame, frame.originTop - 0, "transform, opacity");
	const second = deckHostStyle(frame, frame.originTop - 58, "transform, opacity");
	assert.ok(first);
	assert.ok(second);
	assert.equal(first.transformOrigin, "50% 120px");
	assert.equal(second.transformOrigin, "50% 62px");
});
