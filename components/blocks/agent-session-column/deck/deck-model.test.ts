import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { SCROLLING_ENTRANCE_SPRING } from "../../../visual/scrolling/data.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { AGENT_SESSION_DECK_END_SPACE_PX, AGENT_SESSION_DECK_FLAT, AGENT_SESSION_DECK_STACKED, deckRunFrame, groupDeckRuns, isAgentSessionDeckActive, isIdentityFrame, resolveAgentSessionDeckCollapse, resolveAgentSessionDeckMotion, type AgentSessionDeck, type DeckRow } from "./deck-model.ts";

const STACKED_WITH_ENTRANCE: AgentSessionDeck = {
	...AGENT_SESSION_DECK_STACKED,
	entrance: {
		origin: "top",
		transition: SCROLLING_ENTRANCE_SPRING,
	},
};

function row(top: number, marked = false, height = 62): DeckRow {
	return { height, marked, top };
}

test("FLAT is inactive and STACKED is active", () => {
	assert.equal(isAgentSessionDeckActive(AGENT_SESSION_DECK_FLAT), false);
	assert.equal(isAgentSessionDeckActive(AGENT_SESSION_DECK_STACKED), true);
});

test("STACKED has no entrance and starts laid out", () => {
	assert.equal(AGENT_SESSION_DECK_STACKED.entrance, null);
});

test("a deck without an entrance stays laid out when its scrollport remounts", () => {
	assert.equal(resolveAgentSessionDeckCollapse(AGENT_SESSION_DECK_STACKED, false), 0);
	assert.equal(resolveAgentSessionDeckCollapse(AGENT_SESSION_DECK_STACKED, true), 0);
});

test("a deck with an entrance collapses only until that entrance has played", () => {
	assert.equal(resolveAgentSessionDeckCollapse(STACKED_WITH_ENTRANCE, false), 1);
	assert.equal(resolveAgentSessionDeckCollapse(STACKED_WITH_ENTRANCE, true), 0);
});

test("reduced motion keeps deck order but removes movement", () => {
	assert.equal(
		resolveAgentSessionDeckMotion(AGENT_SESSION_DECK_STACKED, false),
		AGENT_SESSION_DECK_STACKED,
	);
	assert.deepEqual(
		resolveAgentSessionDeckMotion(AGENT_SESSION_DECK_STACKED, true),
		{
			depth: "none",
			entrance: null,
			stackOrder: AGENT_SESSION_DECK_STACKED.stackOrder,
		},
	);
});

test("groupDeckRuns returns no runs for an empty list", () => {
	assert.deepEqual(groupDeckRuns([]), []);
});

test("groupDeckRuns keeps unmarked rows as runs of one", () => {
	const runs = groupDeckRuns([row(0), row(66), row(132)]);
	assert.equal(runs.length, 3);
	assert.equal(runs[0]?.rows.length, 1);
	assert.equal(runs[1]?.rows.length, 1);
	assert.equal(runs[2]?.top, 132);
});

test("groupDeckRuns fuses adjacent marked rows into one run", () => {
	const runs = groupDeckRuns([row(0, true), row(58, true), row(124)]);
	assert.equal(runs.length, 2);
	assert.equal(runs[0]?.rows.length, 2);
	assert.equal(runs[0]?.top, 0);
	assert.equal(runs[0]?.height, 120);
	assert.equal(runs[1]?.rows.length, 1);
});

test("groupDeckRuns does not fuse non-adjacent marked rows", () => {
	const runs = groupDeckRuns([row(0, true), row(66), row(132, true)]);
	assert.equal(runs.length, 3);
	assert.equal(runs[0]?.rows.length, 1);
	assert.equal(runs[2]?.rows.length, 1);
});

test("deckRunFrame is identity when the port has not been measured", () => {
	const run = groupDeckRuns([row(0)])[0];
	assert.ok(run);
	assert.equal(isIdentityFrame(deckRunFrame(run, 0, 0, 0, AGENT_SESSION_DECK_STACKED)), true);
	assert.equal(isIdentityFrame(deckRunFrame(run, Number.NaN, 0, 0, AGENT_SESSION_DECK_STACKED)), true);
	assert.equal(
		isIdentityFrame(deckRunFrame(run, Number.POSITIVE_INFINITY, 0, 0, AGENT_SESSION_DECK_STACKED)),
		true,
	);
});

test("deckRunFrame is identity for a non-finite scroll or collapse", () => {
	const run = groupDeckRuns([row(0)])[0];
	assert.ok(run);
	assert.equal(
		isIdentityFrame(deckRunFrame(run, 480, Number.POSITIVE_INFINITY, 0, AGENT_SESSION_DECK_STACKED)),
		true,
	);
	assert.equal(
		isIdentityFrame(deckRunFrame(run, 480, 0, Number.NaN, AGENT_SESSION_DECK_STACKED)),
		true,
	);
});

test("deckRunFrame is identity for a card scrolled fully above the port", () => {
	const run = groupDeckRuns([row(0)])[0];
	assert.ok(run);
	assert.equal(
		isIdentityFrame(deckRunFrame(run, 480, 500, 0, AGENT_SESSION_DECK_STACKED)),
		true,
	);
});

test("depth tail still tucks a card whose top sits just below the clip", () => {
	const atClip = groupDeckRuns([row(480)])[0];
	const crossing = groupDeckRuns([row(500)])[0];
	assert.ok(atClip);
	assert.ok(crossing);
	for (const run of [atClip, crossing]) {
		const frame = deckRunFrame(run, 480, 0, 0, AGENT_SESSION_DECK_STACKED);
		assert.equal(isIdentityFrame(frame), false);
		assert.ok(frame.scale < 1);
		assert.ok(frame.y < 0);
	}
});

test("fansIn still gates the entrance fan, not the depth tail", () => {
	const run = groupDeckRuns([row(500)])[0];
	assert.ok(run);
	const frame = deckRunFrame(run, 480, 0, 0.65, STACKED_WITH_ENTRANCE);
	assert.equal(frame.opacity, 1);
	assert.equal(frame.scale, 1);
});

test("FLAT at rest is an identity frame", () => {
	const run = groupDeckRuns([row(0)])[0];
	assert.ok(run);
	assert.equal(isIdentityFrame(deckRunFrame(run, 480, 0, 0, AGENT_SESSION_DECK_FLAT)), true);
});

test("depthGate holds scale at 1 while entrance opacity is still ramping", () => {
	const run = groupDeckRuns([row(400)])[0];
	assert.ok(run);
	const frame = deckRunFrame(run, 480, 0, 0.65, STACKED_WITH_ENTRANCE);
	assert.equal(frame.scale, 1);
	assert.ok(frame.opacity < 1);
});

test("depthGate pins opacity at 1 once the tail is allowed to run", () => {
	const run = groupDeckRuns([row(400)])[0];
	assert.ok(run);
	const frame = deckRunFrame(run, 480, 0, 0.45, STACKED_WITH_ENTRANCE);
	assert.equal(frame.opacity, 1);
	assert.ok(frame.scale < 1);
});

test("fused runs share one origin at the run bottom for depth bottom", () => {
	const run = groupDeckRuns([row(0, true), row(58, true)])[0];
	assert.ok(run);
	const frame = deckRunFrame(run, 480, 0, 0, AGENT_SESSION_DECK_STACKED);
	assert.equal(frame.originTop, run.top + run.height);
});

test("select all keeps a tall fused run at natural size throughout scrolling", () => {
	const run = groupDeckRuns(Array.from({ length: 24 }, (_, index) => row(index * 62, true)))[0];
	assert.ok(run);
	for (const portLength of [320, 480, 720]) {
		for (const scrollTop of [0, 300, run.height - portLength]) {
			assert.equal(isIdentityFrame(deckRunFrame(run, portLength, scrollTop, 0, AGENT_SESSION_DECK_STACKED)), true);
		}
	}
});

test("STACKED tucks the last card when the list is scrolled to the end", () => {
	const rows: DeckRow[] = [];
	for (let index = 0; index < 16; index += 1) {
		rows.push(row(index * 66));
	}
	const runs = groupDeckRuns(rows);
	const last = runs[runs.length - 1];
	assert.ok(last);
	const contentEnd = last.top + last.height;
	const portLength = 480;
	const scrollTop = contentEnd - portLength;
	const frame = deckRunFrame(last, portLength, scrollTop, 0, AGENT_SESSION_DECK_STACKED);
	assert.ok(frame.scale < 1);
	assert.equal(isIdentityFrame(frame), false);
});

test("STACKED end space lets the last card finish at full size", () => {
	const rows: DeckRow[] = [];
	for (let index = 0; index < 16; index += 1) {
		rows.push(row(index * 66));
	}
	const runs = groupDeckRuns(rows);
	const last = runs[runs.length - 1];
	assert.ok(last);
	const contentEnd = last.top + last.height;
	const portLength = 480;
	const scrollTop = contentEnd + AGENT_SESSION_DECK_END_SPACE_PX - portLength;
	const frame = deckRunFrame(last, portLength, scrollTop, 0, AGENT_SESSION_DECK_STACKED);
	assert.deepEqual(frame, {
		opacity: 1,
		originTop: last.top + last.height,
		scale: 1,
		y: 0,
	});
});
