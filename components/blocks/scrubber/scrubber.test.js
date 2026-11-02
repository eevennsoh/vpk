import assert from "node:assert/strict";
import test from "node:test";

import {
	MAGNIFY_RADIUS,
	POINTER_AWAY,
	RULE_WEIGHT,
	toMagnification,
	toMarkState,
	toNearestEntryIndex,
	toResolvedIndex,
} from "./lib/scrubber-geometry.ts";
import { buildScrubberEntries, toScrubberMarkLabel } from "./lib/scrubber-entries.ts";
import {
	SCRUBBER_MAGNIFY_IN,
	SCRUBBER_MAGNIFY_OUT,
	SCRUBBER_REDUCED,
	resolveScrubberTransition,
} from "./scrubber-motion.ts";

const MARK_STATES = ["current", "muted", "resting"];

/** Three majors, two minors each — the smallest rail that exercises both ranks. */
const THREE_BY_TWO = [
	{
		id: "a",
		heading: "A",
		label: "A",
		children: [
			{ id: "a1", heading: "A1", label: "A1" },
			{ id: "a2", heading: "A2", label: "A2" },
		],
	},
	{
		id: "b",
		heading: "B",
		label: "B",
		children: [
			{ id: "b1", heading: "B1", label: "B1" },
			{ id: "b2", heading: "B2", label: "B2" },
		],
	},
	{
		id: "c",
		heading: "C",
		label: "C",
		children: [
			{ id: "c1", heading: "C1", label: "C1" },
			{ id: "c2", heading: "C2", label: "C2" },
		],
	},
];

/* ------------------------------------------------------------------ */
/* Falloff                                                             */
/* ------------------------------------------------------------------ */

test("Scrubber magnification peaks under the pointer and dies at the radius", () => {
	assert.equal(toMagnification(0), 1, "the mark under the pointer must be fully swollen");
	assert.equal(
		toMagnification(MAGNIFY_RADIUS),
		0,
		"the falloff must reach exactly zero at the radius, not merely get small",
	);
	assert.equal(
		toMagnification(MAGNIFY_RADIUS * 4),
		0,
		"support is compact on purpose: the far half of the rail must sit perfectly still",
	);
	assert.ok(
		toMagnification(MAGNIFY_RADIUS / 2) > 0 && toMagnification(MAGNIFY_RADIUS / 2) < 1,
		"a mark inside the radius must be partly swollen, so the swell reads as a curve",
	);
});

test("Scrubber magnification is symmetric about the pointer", () => {
	for (const distance of [1, 19, 38, 75]) {
		assert.equal(
			toMagnification(-distance),
			toMagnification(distance),
			`marks ${distance}px either side of the pointer must swell equally, or the rail leans`,
		);
	}
});

test("Scrubber magnification refuses a non-finite distance", () => {
	// POINTER_AWAY is finite precisely so this never happens in practice, but a
	// NaN reaching a motion value poisons it for the life of the component.
	assert.equal(toMagnification(Number.NaN), 0, "NaN must resolve to rest, never propagate");
	assert.equal(toMagnification(Number.POSITIVE_INFINITY), 0);
	assert.equal(toMagnification(Number.NEGATIVE_INFINITY), 0);
});

test("Scrubber magnification refuses a zero or negative radius", () => {
	assert.equal(
		toMagnification(0, 0),
		0,
		"a rail measured before layout has zero width; every mark must rest rather than divide by zero",
	);
	assert.equal(toMagnification(10, -5), 0);
});

test("Scrubber magnification refuses a non-finite radius", () => {
	// Regression: the guard only tested `radius <= 0`, which is false for NaN, so
	// a NaN rail width returned NaN straight into a motion value — and an infinite
	// radius answered a full 1 for every mark on the rail at once.
	assert.equal(toMagnification(10, Number.NaN), 0, "NaN must resolve to rest, never propagate");
	assert.equal(
		toMagnification(10, Number.POSITIVE_INFINITY),
		0,
		"an infinite radius must not swell the whole rail to its peak",
	);
	assert.equal(toMagnification(10, Number.NEGATIVE_INFINITY), 0);
});

test("Scrubber parks the pointer outside the rail but inside the number line", () => {
	assert.ok(Number.isFinite(POINTER_AWAY), "an infinite park value permanently poisons a motion value");
	assert.ok(POINTER_AWAY < 0, "the park value must fall outside 0-1 so it can never read as a position");
});

/* ------------------------------------------------------------------ */
/* Nearest entry                                                       */
/* ------------------------------------------------------------------ */

test("Scrubber resolves the pointer to the nearest entry", () => {
	const entries = [{ offset: 0 }, { offset: 0.5 }, { offset: 0.75 }];

	assert.equal(toNearestEntryIndex(entries, 0.04), 0);
	assert.equal(toNearestEntryIndex(entries, 0.49), 1);
	assert.equal(toNearestEntryIndex(entries, 0.7), 2);
});

test("Scrubber clamps an off-rail sweep to an end instead of dropping it", () => {
	const entries = [{ offset: 0 }, { offset: 0.5 }, { offset: 0.75 }];

	assert.equal(toNearestEntryIndex(entries, -4), 0, "running off the left must hold the first entry");
	assert.equal(toNearestEntryIndex(entries, 9), 2, "running off the right must hold the last entry");
});

test("Scrubber keeps the incumbent when two marks tie", () => {
	// Strict comparison, so two entries stacked on one pixel cannot oscillate.
	assert.equal(toNearestEntryIndex([{ offset: 0.5 }, { offset: 0.5 }], 0.5), 0);
});

test("Scrubber commits nothing for a non-finite offset", () => {
	const entries = [{ offset: 0 }, { offset: 0.5 }];

	assert.equal(toNearestEntryIndex(entries, Number.NaN), null);
	assert.equal(toNearestEntryIndex(entries, Number.POSITIVE_INFINITY), null);
});

test("Scrubber commits nothing on an empty rail", () => {
	assert.equal(toNearestEntryIndex([], 0.5), null, "an empty rail has no nearest mark to select");
});

/* ------------------------------------------------------------------ */
/* Mark state                                                          */
/* ------------------------------------------------------------------ */

test("Scrubber lets muting beat the current position", () => {
	// Rule length encodes "survived the filter"; the pill encodes "you are here".
	// If current won, scrubbing onto a filtered-out mark would repaint an absence
	// as the loudest thing on the rail.
	assert.equal(toMarkState(true, true), "muted", "a filtered-out mark stays muted even while active");
	assert.equal(toMarkState(true, false), "muted");
	assert.equal(toMarkState(false, true), "current");
	assert.equal(toMarkState(false, false), "resting");
});

/* ------------------------------------------------------------------ */
/* Committed index                                                     */
/* ------------------------------------------------------------------ */

test("Scrubber clamps a committed index that overflows a shortened rail", () => {
	// Regression: the pill read `entries[activeIndex]` raw, so filtering the rail
	// down under a committed index blanked the pill, left no option
	// `aria-selected`, and made the pointer hook's "did the nearest entry change?"
	// test permanently true — re-committing on every single pointermove.
	assert.equal(toResolvedIndex(7, 3), 2, "an overflowing index must hold the last entry, not fall off the rail");
	assert.equal(toResolvedIndex(3, 3), 2, "one past the end is still past the end");
	assert.equal(toResolvedIndex(2, 3), 2, "the last entry is in range and must be left alone");
	assert.equal(toResolvedIndex(0, 3), 0);
});

test("Scrubber leaves a negative index alone as the uncommitted sentinel", () => {
	assert.equal(toResolvedIndex(-1, 3), -1, "clamping to 0 would fake a selection nobody made");
});

test("Scrubber resolves an empty rail to nothing committed", () => {
	assert.equal(toResolvedIndex(0, 0), -1, "there is no last entry to hold");
});

test("Scrubber refuses a non-finite committed index", () => {
	assert.equal(toResolvedIndex(Number.NaN, 3), -1);
	assert.equal(toResolvedIndex(Number.POSITIVE_INFINITY, 3), -1);
});

/* ------------------------------------------------------------------ */
/* Rule weights                                                        */
/* ------------------------------------------------------------------ */

test("Scrubber keeps minors below majors in every state, at rest and at peak", () => {
	// The two ranks must never trade places under the pointer. A minor that
	// out-grew a major mid-sweep would make the rail's hierarchy depend on where
	// the mouse happens to be, so the ordering has to hold at both ends of the
	// swell, not just at rest.
	for (const state of MARK_STATES) {
		const major = RULE_WEIGHT.major[state];
		const minor = RULE_WEIGHT.minor[state];

		assert.ok(
			minor.rest < major.rest,
			`a resting ${state} minor (${minor.rest}px) must stay shorter than a resting major (${major.rest}px)`,
		);
		assert.ok(
			minor.peak < major.peak,
			`a fully swollen ${state} minor (${minor.peak}px) must stay shorter than a fully swollen major (${major.peak}px)`,
		);
	}
});

test("Scrubber makes every rule grow rather than shrink under the pointer", () => {
	for (const kind of ["major", "minor"]) {
		for (const state of MARK_STATES) {
			const weight = RULE_WEIGHT[kind][state];

			assert.ok(
				weight.peak > weight.rest,
				`a ${state} ${kind} must swell toward the pointer, not contract`,
			);
			assert.ok(
				weight.peakOpacity >= weight.restOpacity,
				`a ${state} ${kind} must not fade as it is approached`,
			);
		}
	}
});

test("Scrubber keeps a muted rule quieter than a resting one at both ends of the swell", () => {
	// Magnification is a pointer affordance; it must not undo the filter's signal
	// by repainting an absence as presence when the pointer sweeps past.
	for (const kind of ["major", "minor"]) {
		const muted = RULE_WEIGHT[kind].muted;
		const resting = RULE_WEIGHT[kind].resting;

		assert.ok(muted.rest < resting.rest, `an untouched muted ${kind} must be the shorter of the two`);
		assert.ok(
			muted.peak < resting.peak,
			`a fully swollen muted ${kind} must still be shorter than a fully swollen unfiltered one`,
		);
		assert.ok(muted.restOpacity < resting.restOpacity, `an untouched muted ${kind} must be the fainter of the two`);
		assert.ok(
			muted.peakOpacity < resting.peakOpacity,
			`a fully swollen muted ${kind} must still be fainter than a fully swollen unfiltered one`,
		);
	}
});

/* ------------------------------------------------------------------ */
/* Entry layout                                                        */
/* ------------------------------------------------------------------ */

test("Scrubber spaces majors evenly across the rail", () => {
	const majors = buildScrubberEntries(THREE_BY_TWO).filter((entry) => entry.kind === "major");

	assert.deepEqual(
		majors.map((entry) => entry.offset),
		[0, 1 / 3, 2 / 3],
		"every major owns an equal slice, including the last — the step is 1/count, not 1/(count-1)",
	);
});

test("Scrubber puts a lone major at the start of the rail", () => {
	const entries = buildScrubberEntries([{ id: "only", heading: "Only", label: "Only" }]);

	assert.equal(entries.length, 1);
	assert.equal(entries[0].offset, 0);
});

test("Scrubber emits exactly one entry for a major with no minors", () => {
	const entries = buildScrubberEntries([
		{ id: "bare", heading: "Bare", label: "Bare" },
		{ id: "empty", heading: "Empty", label: "Empty", children: [] },
	]);

	assert.deepEqual(
		entries.map((entry) => entry.id),
		["bare", "empty"],
		"a childless major still needs a mark; it is a real outcome with no sections",
	);
});

test("Scrubber lands every minor strictly inside its own major's slice", () => {
	const entries = buildScrubberEntries(THREE_BY_TWO);
	const majorOffsets = entries.filter((entry) => entry.kind === "major").map((entry) => entry.offset);

	let majorIndex = -1;
	for (const entry of entries) {
		if (entry.kind === "major") {
			majorIndex += 1;
			continue;
		}

		const sliceStart = majorOffsets[majorIndex];
		// The last major's slice runs to the end of the rail, which is why the
		// step divides by the major count rather than by the gaps between them.
		const sliceEnd = majorIndex + 1 < majorOffsets.length ? majorOffsets[majorIndex + 1] : 1;

		assert.ok(
			entry.offset > sliceStart && entry.offset < sliceEnd,
			`${entry.id} at ${entry.offset} must sit strictly between ${sliceStart} and ${sliceEnd}, or it would stack on a neighbouring major`,
		);
	}
});

test("Scrubber spreads a major's minors symmetrically through its slice", () => {
	// Dividing by length + 1 is what keeps both ends open: one minor sits
	// halfway, two sit at a third and two thirds.
	const one = buildScrubberEntries([
		{ id: "m", heading: "M", label: "M", children: [{ id: "m1", heading: "M1", label: "M1" }] },
	]);
	assert.deepEqual(one.map((entry) => entry.offset), [0, 0.5]);

	const three = buildScrubberEntries([
		{
			id: "m",
			heading: "M",
			label: "M",
			children: [
				{ id: "m1", heading: "M1", label: "M1" },
				{ id: "m2", heading: "M2", label: "M2" },
				{ id: "m3", heading: "M3", label: "M3" },
			],
		},
	]);
	assert.deepEqual(three.map((entry) => entry.offset), [0, 0.25, 0.5, 0.75]);
});

test("Scrubber returns entries already ascending and inside the rail", () => {
	const entries = buildScrubberEntries(THREE_BY_TWO);

	for (let index = 0; index < entries.length; index += 1) {
		const { offset, id } = entries[index];

		assert.ok(offset >= 0 && offset < 1, `${id} at ${offset} must fall within 0 <= offset < 1`);
		if (index > 0) {
			assert.ok(
				offset > entries[index - 1].offset,
				`${id} must come after ${entries[index - 1].id}; the flat array is consumed unsorted`,
			);
		}
	}
});

test("Scrubber yields an empty rail for no groups", () => {
	assert.deepEqual(buildScrubberEntries([]), []);
});

test("Scrubber hands each minor its parent's filtered state", () => {
	// A dimmed major with bright parts reads as a contradiction, so muting is inherited.
	const entries = buildScrubberEntries([
		{
			id: "hidden",
			heading: "Hidden",
			label: "Hidden",
			muted: true,
			children: [{ id: "hidden-1", heading: "Hidden 1", label: "Hidden 1" }],
		},
	]);

	assert.deepEqual(entries.map((entry) => entry.muted), [true, true]);
});

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

test("Scrubber exits are shorter than the matching entrances", () => {
	assert.ok(
		SCRUBBER_MAGNIFY_OUT.duration < SCRUBBER_MAGNIFY_IN.duration,
		"the user caused the dismissal, so clearing the swell must not make them wait",
	);
});

test("Scrubber zeroes every transition under reduced motion", () => {
	for (const transition of [SCRUBBER_MAGNIFY_IN, SCRUBBER_MAGNIFY_OUT]) {
		assert.equal(
			resolveScrubberTransition(transition, true),
			SCRUBBER_REDUCED,
			"VPK duration tokens keep playing under reduced motion unless a consumer collapses them",
		);
		assert.equal(resolveScrubberTransition(transition, false), transition);
		assert.equal(
			resolveScrubberTransition(transition, null),
			transition,
			"useReducedMotion() returns null before hydration, which must read as 'not reduced'",
		);
	}
});

test("Scrubber reduced-motion transition actually removes the duration", () => {
	assert.equal(SCRUBBER_REDUCED.duration, 0);
});

test("Scrubber mark labels speak the rank, because rule length alone is invisible", () => {
	assert.equal(
		toScrubberMarkLabel({ id: "a", kind: "major", offset: 0, label: "Wallet cut", heading: "Wallet cut" }),
		"Wallet cut, major mark",
	);
	assert.equal(
		toScrubberMarkLabel({ id: "b", kind: "minor", offset: 0.1, label: "Artifacts", heading: "Artifacts" }),
		"Artifacts, minor mark",
	);
});

test("Scrubber mark labels say when a mark is filtered out", () => {
	// Muting is visual-only otherwise, so a screen reader would never learn the mark
	// had been filtered.
	assert.equal(
		toScrubberMarkLabel({ id: "c", kind: "major", offset: 0, label: "Wallet cut", heading: "Wallet cut", muted: true }),
		"Wallet cut, major mark, filtered out",
	);
	assert.equal(
		toScrubberMarkLabel({ id: "d", kind: "major", offset: 0, label: "Wallet cut", heading: "Wallet cut", muted: false }),
		"Wallet cut, major mark",
	);
});


test("continuous dot rails preview hover, seek pointer positions, and keep keyboard entry navigation", async (t) => {
	const { createRequire } = await import("node:module");
	const require = createRequire(import.meta.url);
	const { act } = require("react");
	const { renderComponent } = require("../../../scripts/lib/render-component.js");
	const view = await renderComponent({
		source: `import React, { useState } from "react";
			import { useMotionValue } from "motion/react";
			import { ScrubberRail } from "@/components/blocks/scrubber/components/scrubber-rail";
			const entries = ["a", "b", "c"].map((id, index) => ({id, label:id, heading:id, kind:"minor", offset:index/2}));
			export default function Rail({continuous = true}) {
				const offset = useMotionValue(0.25);
				const [selection, setSelection] = useState("a");
				const [seek, setSeek] = useState("");
				return <><ScrubberRail activeIndex={entries.findIndex((entry) => entry.id === selection)} activeOffset={continuous ? offset : undefined} ariaLabel="Timeline" appearance="dots" entries={entries} onSelect={setSelection} onSeek={continuous ? (value) => {offset.set(value);setSeek(value.toFixed(2));} : undefined} selectionMode="drag" showPill={false} /><output role="status" aria-label="Selected item">{selection}</output><output role="status" aria-label="Seek offset">{seek}</output></>;
			}`,
	});
	const rail = view.getByRole("listbox", { name: "Timeline" });
	t.mock.method(rail, "getBoundingClientRect", () => ({left:10, top:0, width:200, height:14}));
	Object.defineProperty(rail, "setPointerCapture", {configurable:true, value() {}});
	async function pointer(type, buttons) {
		await act(async () => {rail.dispatchEvent(new PointerEvent(type, {bubbles:true, pointerType:"mouse", clientX:150, button:0, buttons, pointerId:7}));await new Promise((resolve) => setTimeout(resolve, 40));});
	}
	await pointer("pointermove", 0);
	assert.equal(rail.querySelector('[data-slot="scrubber-hover"]').style.opacity, "1");
	assert.equal(rail.querySelector('[data-slot="scrubber-hover"]').style.left, "70%");
	assert.equal(view.getByRole("status", {name:"Selected item"}).textContent, "a");
	await pointer("pointerdown", 1);
	assert.equal(view.getByRole("status", {name:"Seek offset"}).textContent, "0.70");
	assert.equal(rail.querySelector('[data-slot="scrubber-playhead"]').style.left, "70%");
	await act(() => view.getAllByRole("option")[1].dispatchEvent(new MouseEvent("click", {bubbles:true, detail:1})));
	assert.equal(view.getByRole("status", {name:"Selected item"}).textContent, "a", "pointer commits must not snap back to a nearby entry");
	await view.press(view.getAllByRole("option")[0], "End");
	assert.equal(view.getByRole("status", {name:"Selected item"}).textContent, "c");
	await view.rerender({continuous:false});
	assert.equal(rail.querySelector('[data-slot="scrubber-playhead"]') === null, true);
	await view.click(view.getAllByRole("option")[1]);
	assert.equal(view.getByRole("status", {name:"Selected item"}).textContent, "b");
});
