import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { AGENT_SESSION_RAIL_FOCUS_GUTTER_PX, AGENT_SESSION_RAIL_ITEM_GAP_PX, AGENT_SESSION_RAIL_ITEM_HEIGHT_PX, AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS, advanceAgentSessionRailOrder, releaseAgentSessionRailOrder, settleAgentSessionRailOrder, toAgentSessionRailHitSlopStyle, toAgentSessionRailViewportMaxHeight } from "./agent-session-column-rail-viewport.ts";

const TEN_ITEM_HEIGHT = AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS * AGENT_SESSION_RAIL_ITEM_HEIGHT_PX
	+ (AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS - 1) * AGENT_SESSION_RAIL_ITEM_GAP_PX
	+ AGENT_SESSION_RAIL_FOCUS_GUTTER_PX;

test("the gutter rail caps its viewport at ten notches", () => {
	assert.equal(
		toAgentSessionRailViewportMaxHeight(3, AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS),
		3 * AGENT_SESSION_RAIL_ITEM_HEIGHT_PX
			+ 2 * AGENT_SESSION_RAIL_ITEM_GAP_PX
			+ AGENT_SESSION_RAIL_FOCUS_GUTTER_PX,
	);
	assert.equal(
		toAgentSessionRailViewportMaxHeight(10, AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS),
		TEN_ITEM_HEIGHT,
	);
	assert.equal(
		toAgentSessionRailViewportMaxHeight(16, AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS),
		TEN_ITEM_HEIGHT,
	);
	assert.equal(
		toAgentSessionRailViewportMaxHeight(0, AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS),
		0,
	);
});

test("the embedded column rail does not cap the viewport to ten notches", () => {
	assert.equal(toAgentSessionRailViewportMaxHeight(16, undefined), undefined);
	assert.equal(toAgentSessionRailViewportMaxHeight(0, undefined), undefined);
});

test("collapsed rail hit slop keeps the 32px column and grows a 24px target to 56px", () => {
	assert.deepEqual(toAgentSessionRailHitSlopStyle(16), {
		marginInline: -16,
		width: "calc(100% + 32px)",
	});
});

test("a status revision retires the old mark in place before the new top order enters", () => {
	const initial = [
		{ id: "newer", state: "running" },
		{ id: "session", state: "running" },
		{ id: "older", state: "complete" },
	];
	const baseline = advanceAgentSessionRailOrder(undefined, initial, new Map([["session", 0]]), false);
	const needsInput = [
		{ id: "session", state: "needs-input" },
		initial[0],
		initial[2],
	];
	const leaving = advanceAgentSessionRailOrder(baseline, needsInput, new Map([["session", 1]]), false);
	assert.equal(leaving.phase, "exit");
	assert.equal(leaving.changingItemId, "session");
	assert.deepEqual(leaving.visibleItems, initial);
	assert.equal(leaving.visibleItems.findIndex((item) => item.id === "session"), 1);

	const entering = releaseAgentSessionRailOrder(leaving);
	assert.equal(entering.phase, "enter");
	assert.deepEqual(entering.visibleItems, needsInput);
	assert.equal(entering.visibleItems[0].id, "session");

	const finished = [
		{ id: "session", state: "complete" },
		initial[0],
		initial[2],
	];
	const topUpdate = advanceAgentSessionRailOrder(
		settleAgentSessionRailOrder(entering),
		finished,
		new Map([["session", 2]]),
		false,
	);
	assert.equal(topUpdate.phase, "rest", "a marker already first needs only its glyph swap");
	assert.equal(topUpdate.visibleItems[0].state, "complete");
	assert.equal(topUpdate.changingItemId, null);
});

test("initial arrivals, filtered changes, and reduced motion skip the old-position exit", () => {
	const initial = [{ id: "existing", state: "running" }];
	const baseline = advanceAgentSessionRailOrder(undefined, initial, new Map([["existing", 0]]), false);
	const arrived = [{ id: "new", state: "running" }, ...initial];
	const arrival = advanceAgentSessionRailOrder(baseline, arrived, new Map([["existing", 0], ["new", 0]]), false);
	assert.equal(arrival.phase, "rest");
	assert.deepEqual(arrival.visibleItems, arrived);

	const filtered = advanceAgentSessionRailOrder(
		arrival,
		[{ id: "new", state: "running" }],
		new Map([["existing", 1], ["new", 0]]),
		false,
	);
	assert.equal(filtered.phase, "rest");

	const reduced = advanceAgentSessionRailOrder(
		baseline,
		[{ id: "existing", state: "needs-input" }],
		new Map([["existing", 1]]),
		true,
	);
	assert.equal(reduced.phase, "rest");
	assert.equal(reduced.visibleItems[0].state, "needs-input");
});
