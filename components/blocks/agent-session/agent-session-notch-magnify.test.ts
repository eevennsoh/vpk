import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { AGENT_SESSION_NOTCH_LENGTH, AGENT_SESSION_NOTCH_MAGNIFY_RADIUS, AGENT_SESSION_NOTCH_NO_NEAREST, AGENT_SESSION_NOTCH_POINTER_AWAY, AGENT_SESSION_NOTCH_TONE, AGENT_SESSION_USER_NOTCH_DIAMETER, toAgentSessionNotchLength, toAgentSessionNotchMagnification, toAgentSessionNotchTone, toAgentSessionUserNotchDiameter, toNearestAgentSessionNotchIndex } from "./agent-session-notch-magnify.ts";

/** The rail's pitch: a 20px notch row plus the list's 4px gap. */
const PITCH = 24;

/** Sixteen notches on the rail's pitch, centred like the measured ones. */
const CENTERS = Array.from({ length: 16 }, (_unused, index) => index * PITCH + 10);

test("the notch under the pointer is the peak, and the radius is the floor", () => {
	assert.equal(toAgentSessionNotchMagnification(0), 1);
	assert.equal(toAgentSessionNotchMagnification(AGENT_SESSION_NOTCH_MAGNIFY_RADIUS), 0);
	assert.equal(toAgentSessionNotchMagnification(AGENT_SESSION_NOTCH_MAGNIFY_RADIUS * 4), 0);
});

test("the profile is a mountain: monotonic falloff, symmetric either side", () => {
	// This is the whole visual promise — each notch further from the cursor is
	// strictly shorter than the one before it, so the rail reads as one slope
	// rather than a cluster of equally lit marks.
	let previous = Number.POSITIVE_INFINITY;
	for (let step = 0; step * PITCH <= AGENT_SESSION_NOTCH_MAGNIFY_RADIUS; step += 1) {
		const distance = step * PITCH;
		const current = toAgentSessionNotchMagnification(distance);
		assert.ok(current < previous, `expected ${distance}px to fall below ${distance - PITCH}px`);
		assert.equal(
			toAgentSessionNotchMagnification(-distance),
			current,
			"a notch above the pointer must match the one the same distance below",
		);
		previous = current;
	}
});

test("the slope tapers rather than cutting off — it is smooth at both ends", () => {
	// Quartic, so the derivative vanishes under the cursor and at the radius: the
	// notch nearest the pointer does not snap to peak, and the outermost one does
	// not pop as it enters range.
	const nearPeak = toAgentSessionNotchMagnification(0) - toAgentSessionNotchMagnification(4);
	const nearEdge = toAgentSessionNotchMagnification(AGENT_SESSION_NOTCH_MAGNIFY_RADIUS - 4);
	assert.ok(nearPeak < 0.02, "the crest must be flat, not a spike");
	assert.ok(nearEdge < 0.01, "the tail must reach zero, not step to it");
	// Three neighbours either side still move — a seven-notch slope — which is
	// what makes it read as a surface being pushed instead of one mark lighting
	// up, without the whole rail lifting at once.
	assert.ok(toAgentSessionNotchMagnification(PITCH * 3) > 0);
	assert.equal(toAgentSessionNotchMagnification(PITCH * 4), 0);
});

test("a parked pointer and non-finite input leave every notch at rest", () => {
	assert.ok(AGENT_SESSION_NOTCH_POINTER_AWAY < 0, "the parked pointer must read as out of range");
	assert.ok(Number.isFinite(AGENT_SESSION_NOTCH_POINTER_AWAY), "an Infinity would poison the motion value");
	assert.equal(toAgentSessionNotchMagnification(Number.NaN), 0);
	assert.equal(toAgentSessionNotchMagnification(Number.POSITIVE_INFINITY), 0);
	assert.equal(toAgentSessionNotchMagnification(10, 0), 0);
});

test("length interpolates between the resting mark and the rail's 24px channel", () => {
	assert.equal(toAgentSessionNotchLength(0, false), AGENT_SESSION_NOTCH_LENGTH.rest);
	assert.equal(toAgentSessionNotchLength(1, false), AGENT_SESSION_NOTCH_LENGTH.peak);
	assert.equal(toAgentSessionNotchLength(0.5, false), 18);
	// A newly synced notch rests part-way up the ramp — already lit — and still
	// tops out at the same channel, so it can never overrun the rail.
	assert.equal(toAgentSessionNotchLength(0, true), AGENT_SESSION_NOTCH_LENGTH.newRest);
	assert.equal(toAgentSessionNotchLength(1, true), AGENT_SESSION_NOTCH_LENGTH.peak);
});

test("user dots grow from four pixels to a twelve pixel avatar without exceeding it", () => {
	assert.equal(toAgentSessionUserNotchDiameter(0), AGENT_SESSION_USER_NOTCH_DIAMETER.rest);
	assert.equal(toAgentSessionUserNotchDiameter(1), 12);
	assert.equal(toAgentSessionUserNotchDiameter(0.5), 8);
	assert.equal(toAgentSessionUserNotchDiameter(4), 12);
	assert.equal(toAgentSessionUserNotchDiameter(Number.NaN), AGENT_SESSION_USER_NOTCH_DIAMETER.rest);
});

test("circle dots rest at four pixels while line markers retain their new-state tone", () => {
	assert.equal(toAgentSessionUserNotchDiameter(0), AGENT_SESSION_USER_NOTCH_DIAMETER.rest);
	assert.equal(toAgentSessionUserNotchDiameter(1), AGENT_SESSION_USER_NOTCH_DIAMETER.peak);
	assert.equal(toAgentSessionUserNotchDiameter(0.5), 8);
	assert.equal(toAgentSessionNotchTone(false, true), AGENT_SESSION_NOTCH_TONE.selected);
	assert.equal(toAgentSessionNotchTone(false, false), AGENT_SESSION_NOTCH_TONE.rest);
});

test("out-of-range magnification is clamped, never extrapolated", () => {
	// The transform multiplies falloff by the swell amount; a stray value must not
	// be able to grow a notch past the 24px channel or invert it.
	assert.equal(toAgentSessionNotchLength(4, false), AGENT_SESSION_NOTCH_LENGTH.peak);
	assert.equal(toAgentSessionNotchLength(-3, false), AGENT_SESSION_NOTCH_LENGTH.rest);
	assert.equal(toAgentSessionNotchLength(Number.NaN, false), AGENT_SESSION_NOTCH_LENGTH.rest);
});

test("colour is the named icon tokens, never an alpha mix", () => {
	// Resting marks paint `color.icon.disabled` and the selected mark paints
	// `color.icon`. A 0.66–0.68 alpha of `color.icon` used to approximate the
	// resting grey over the old plane; that mix is a third grey on `bg-surface`.
	assert.equal(AGENT_SESSION_NOTCH_TONE.rest, "var(--color-icon-disabled)");
	assert.equal(AGENT_SESSION_NOTCH_TONE.selected, "var(--color-icon)");
	assert.equal(toAgentSessionNotchTone(false, false), AGENT_SESSION_NOTCH_TONE.rest);
	assert.equal(toAgentSessionNotchTone(true, false), AGENT_SESSION_NOTCH_TONE.selected);
	// Newly synced notches stay on `color.icon` whether or not they are nearest.
	assert.equal(toAgentSessionNotchTone(false, true), AGENT_SESSION_NOTCH_TONE.selected);
	assert.equal(toAgentSessionNotchTone(true, true), AGENT_SESSION_NOTCH_TONE.selected);
});

test("colour marks the selected notch alone, never the slope around it", () => {
	// The regression this guards: darkening every notch in proportion to its
	// distance turned seven marks into one grey gradient, and the notch actually
	// under the pointer stopped being findable. Length carries proximity; colour
	// carries selection, and selection is one notch.
	assert.equal(
		toAgentSessionNotchTone(true, false),
		AGENT_SESSION_NOTCH_TONE.selected,
		"the selected notch takes color.icon",
	);
	assert.equal(
		toAgentSessionNotchTone(false, false),
		AGENT_SESSION_NOTCH_TONE.rest,
		"an unselected notch holds color.icon.subtlest",
	);
	// Its neighbour is still visibly longer — the slope is intact, unpainted.
	assert.ok(
		toAgentSessionNotchLength(toAgentSessionNotchMagnification(PITCH), false)
			> toAgentSessionNotchLength(0, false),
		"the notch beside the selected one must still ride the swell",
	);
});

test("the nearest notch owns the pointer, with no gap between two of them", () => {
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, 10), 0);
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, 178), 7);
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, CENTERS[15]), 15);
	// Exactly between two centres, and one pixel either side of that midpoint:
	// somebody always owns the pointer, and the winner flips where it should.
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, 21), 0);
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, 22), 0, "a tie resolves to the first, never to nothing");
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, 23), 1);
	// Past either end the outermost notch still claims it, so sliding off the
	// top of the rail does not blank the selection before the pointer leaves.
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, 0), 0);
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, 9000), 15);
});

test("a parked pointer or an unmeasured rail selects nothing", () => {
	assert.ok(AGENT_SESSION_NOTCH_NO_NEAREST < 0, "no-selection must read as out of range");
	assert.ok(Number.isFinite(AGENT_SESSION_NOTCH_NO_NEAREST), "an Infinity would poison the motion value");
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, AGENT_SESSION_NOTCH_POINTER_AWAY), AGENT_SESSION_NOTCH_NO_NEAREST);
	assert.equal(toNearestAgentSessionNotchIndex(CENTERS, Number.NaN), AGENT_SESSION_NOTCH_NO_NEAREST);
	// Before the first measure the centres array is empty; no notch may claim it.
	assert.equal(toNearestAgentSessionNotchIndex([], 100), AGENT_SESSION_NOTCH_NO_NEAREST);
});

test("an arrival under a stationary pointer re-aims the slope at the new centres", () => {
	// The dock measures and republishes in one step because measuring alone
	// cannot reach the marks: centres live in a ref, and writing a ref notifies
	// no `useTransform`. This is the case that proves the republish is not
	// bookkeeping — the pointer never moves, and the answer still changes.
	//
	// A rail that grows past a resting pointer is the clean demonstration. Until
	// the new notch is measured the pointer is past the end of the array and the
	// last notch keeps claiming it; once it is measured the pointer belongs to
	// the arrival instead.
	const grown = [...CENTERS, 16 * PITCH + 10];
	const stationary = grown[16];

	assert.equal(
		toNearestAgentSessionNotchIndex(CENTERS, stationary),
		15,
		"stale centres end early, so the last notch over-claims the pointer",
	);
	assert.equal(
		toNearestAgentSessionNotchIndex(grown, stationary),
		16,
		"measured centres hand the pointer to the notch that actually sits under it",
	);

	// And the crest moves with the selection. Against the stale array the old
	// last notch is a pitch away and still riding the slope; against the measured
	// one the arrival takes the peak.
	assert.ok(toAgentSessionNotchMagnification(stationary - CENTERS[15]) < 1);
	assert.equal(toAgentSessionNotchMagnification(stationary - grown[16]), 1);

	// The unmeasured tail is the failure mode in full: a notch whose centre has
	// not been written yet has no place on the slope at all.
	assert.equal(CENTERS[16], undefined);
});
