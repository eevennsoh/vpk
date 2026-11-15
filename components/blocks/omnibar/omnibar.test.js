import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
	OMNIBAR_COLLAPSE_DELAY_MS,
	OMNIBAR_INITIAL_STATE,
	omnibarReducer,
} from "./omnibar-machine.ts";
import {
	OMNIBAR_BAR_ZOOM,
	OMNIBAR_PANEL_ENTER,
	OMNIBAR_PANEL_EXIT,
	OMNIBAR_PILL_ZOOM,
	OMNIBAR_RAIL_ENTER,
	OMNIBAR_RAIL_EXIT,
	OMNIBAR_REDUCED,
	OMNIBAR_SURFACE_ENTER,
	OMNIBAR_SURFACE_EXIT,
	resolveOmnibarTransition,
	resolveOmnibarZoom,
} from "./omnibar-motion.ts";

const EXPANDED_UNPINNED = { state: "expanded", pinned: false };
const EXPANDED_PINNED = { state: "expanded", pinned: true };

test("Omnibar expands from the pill on pointer enter", () => {
	assert.deepEqual(omnibarReducer(OMNIBAR_INITIAL_STATE, { type: "pointer-enter" }), {
		state: "expanded",
		pinned: false,
	});
});

test("Omnibar collapses on pointer leave while unpinned", () => {
	assert.deepEqual(omnibarReducer(EXPANDED_UNPINNED, { type: "pointer-leave" }), {
		state: "collapsed",
		pinned: false,
	});
});

test("Omnibar keeps a pinned bar open when the pointer leaves", () => {
	// The behavior the bar exists for: clicking in to type must survive the pointer leaving.
	const next = omnibarReducer(EXPANDED_PINNED, { type: "pointer-leave" });

	assert.equal(next, EXPANDED_PINNED, "a pinned bar must not collapse on pointer leave");
});

test("Omnibar pins the bar on pointer down", () => {
	assert.deepEqual(omnibarReducer(EXPANDED_UNPINNED, { type: "pin" }), {
		state: "expanded",
		pinned: true,
	});
	assert.deepEqual(omnibarReducer(OMNIBAR_INITIAL_STATE, { type: "pin" }), {
		state: "expanded",
		pinned: true,
	});
});

test("Omnibar unpins and collapses on an outside click", () => {
	assert.deepEqual(omnibarReducer(EXPANDED_PINNED, { type: "outside-click" }), {
		state: "collapsed",
		pinned: false,
	});
});

test("Omnibar docking clears the pin and closing returns to the pill", () => {
	const docked = omnibarReducer(EXPANDED_PINNED, { type: "open-panel" });
	assert.deepEqual(docked, { state: "docked", pinned: false });

	assert.deepEqual(omnibarReducer(docked, { type: "close-panel" }), {
		state: "collapsed",
		pinned: false,
	});
});

test("Omnibar collapse returns any geometry to the pill", () => {
	// Host-owned panels (Ask Rovo sidebar) collapse instead of docking.
	assert.deepEqual(omnibarReducer(EXPANDED_PINNED, { type: "collapse" }), {
		state: "collapsed",
		pinned: false,
	});
	assert.deepEqual(
		omnibarReducer({ state: "docked", pinned: false }, { type: "collapse" }),
		{ state: "collapsed", pinned: false },
	);
	assert.equal(
		omnibarReducer(OMNIBAR_INITIAL_STATE, { type: "collapse" }),
		OMNIBAR_INITIAL_STATE,
	);
});

test("Omnibar ignores hover events while docked", () => {
	const docked = { state: "docked", pinned: false };

	assert.equal(omnibarReducer(docked, { type: "pointer-enter" }), docked);
	assert.equal(omnibarReducer(docked, { type: "pointer-leave" }), docked);
	assert.equal(omnibarReducer(docked, { type: "pin" }), docked);
});

test("Omnibar returns the same object when a transition is a no-op", () => {
	// Identity preservation is what lets React bail out of the re-render.
	assert.equal(
		omnibarReducer(OMNIBAR_INITIAL_STATE, { type: "pointer-leave" }),
		OMNIBAR_INITIAL_STATE,
	);
	assert.equal(omnibarReducer(EXPANDED_PINNED, { type: "pin" }), EXPANDED_PINNED);
	assert.equal(
		omnibarReducer(OMNIBAR_INITIAL_STATE, { type: "close-panel" }),
		OMNIBAR_INITIAL_STATE,
	);
});

test("Omnibar collapse delay stays short enough to feel immediate", () => {
	assert.ok(
		OMNIBAR_COLLAPSE_DELAY_MS > 0 && OMNIBAR_COLLAPSE_DELAY_MS <= 250,
		"the grace period must debounce edge grazes without feeling sticky",
	);
});

test("Omnibar exits are shorter than the matching entrances", () => {
	assert.ok(OMNIBAR_SURFACE_EXIT.duration < OMNIBAR_SURFACE_ENTER.duration);
	assert.ok(OMNIBAR_PANEL_EXIT.duration < OMNIBAR_PANEL_ENTER.duration);
	assert.ok(OMNIBAR_RAIL_EXIT.duration < OMNIBAR_RAIL_ENTER.duration);
});

test("Omnibar trades the pill and the bar on one z-axis, not one morphing box", () => {
	// Expanding moves both surfaces toward the viewer — the pill overshoots past 1 as it
	// leaves, the bar arrives from behind it. Collapsing is the same move reversed. If
	// either pair ever scaled the same direction the two would read as a dissolve with no
	// depth, and if the pill entered from below 1 the transition would reverse mid-flight.
	assert.ok(OMNIBAR_PILL_ZOOM.exitTo > 1, "the pill leaves toward the viewer");
	assert.ok(OMNIBAR_BAR_ZOOM.enterFrom < 1, "the bar arrives from behind");
	assert.ok(OMNIBAR_BAR_ZOOM.exitTo < 1, "the bar leaves away from the viewer");
	assert.ok(OMNIBAR_PILL_ZOOM.enterFrom > 1, "the pill arrives from in front");
	// Exits travel further than entrances because they get roughly a third of the time.
	assert.ok(OMNIBAR_PILL_ZOOM.exitTo > OMNIBAR_PILL_ZOOM.enterFrom);
	assert.ok(OMNIBAR_BAR_ZOOM.exitTo < OMNIBAR_BAR_ZOOM.enterFrom);
});

test("Omnibar surfaces use duration-slow in and duration-fast out", () => {
	// A 720px surface needs the long decelerating landing; a tenth of a second out keeps
	// the leaving geometry from reading as a double image over the arriving one.
	assert.deepEqual(OMNIBAR_SURFACE_ENTER, { duration: 0.25, ease: [0, 0.4, 0, 1] });
	assert.deepEqual(OMNIBAR_SURFACE_EXIT, { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] });
});

test("Omnibar edge rail enters on the practical curve, not the bold one", () => {
	// A small, high-frequency surface. The bold `ease-out` belongs to the prominent
	// entrances (the docked panel); using it here would overstate a rail toggle.
	assert.deepEqual(OMNIBAR_RAIL_ENTER.ease, [0.4, 1, 0.6, 1]);
	assert.deepEqual(OMNIBAR_RAIL_EXIT.ease, [0.6, 0, 0.8, 0.6]);
	assert.notDeepEqual(OMNIBAR_RAIL_ENTER.ease, OMNIBAR_PANEL_ENTER.ease);
});

test("Omnibar zeroes every transition under reduced motion", () => {
	for (const transition of [
		OMNIBAR_SURFACE_ENTER,
		OMNIBAR_SURFACE_EXIT,
		OMNIBAR_PANEL_ENTER,
		OMNIBAR_PANEL_EXIT,
		OMNIBAR_RAIL_ENTER,
		OMNIBAR_RAIL_EXIT,
	]) {
		assert.equal(resolveOmnibarTransition(transition, true), OMNIBAR_REDUCED);
		assert.equal(resolveOmnibarTransition(transition, false), transition);
		assert.equal(resolveOmnibarTransition(transition, null), transition);
	}
	assert.equal(OMNIBAR_REDUCED.delay, 0);
	assert.equal(OMNIBAR_REDUCED.duration, 0);
});

test("Omnibar flattens the zoom under reduced motion, not just the duration", () => {
	// A zero-duration transition still paints one frame at `initial`, which on a 720px
	// surface is a visible pop rather than the absence of motion the user asked for.
	for (const scale of [OMNIBAR_PILL_ZOOM.enterFrom, OMNIBAR_PILL_ZOOM.exitTo, OMNIBAR_BAR_ZOOM.enterFrom, OMNIBAR_BAR_ZOOM.exitTo]) {
		assert.equal(resolveOmnibarZoom(scale, true), 1);
		assert.equal(resolveOmnibarZoom(scale, false), scale);
		assert.equal(resolveOmnibarZoom(scale, null), scale);
	}
});

test("Omnibar pill uses the brand-color Rovo sparkle, not the inverse glyph", () => {
	const source = readFileSync(new URL("./components/omnibar-pill.tsx", import.meta.url), "utf8");
	assert.match(source, /<RovoSparkleMark active selected=\{false\} size="default" \/>/u);
	assert.doesNotMatch(source, /active=\{false\}/u);
});

test("Omnibar surfaces paint their own chrome so neither inherits a resizing fill", () => {
	// A fill on a shared ancestor would have to animate between the two geometries, which
	// is the morph the cross-fade replaces. The pill keeps the floating Rovo button's
	// chrome and the inverse bar keeps the black composer chrome, each on its own box.
	const source = readFileSync(new URL("./components/omnibar.tsx", import.meta.url), "utf8");
	const bar = readFileSync(new URL("./components/omnibar-bar.tsx", import.meta.url), "utf8");
	const pill = readFileSync(new URL("./components/omnibar-pill.tsx", import.meta.url), "utf8");

	assert.match(pill, /h-7 w-24[^"]*rounded-full bg-bg-neutral-bold/u);
	assert.match(pill, /token\("elevation.shadow.overlay"\)/u);
	assert.match(bar, /bg-bg-neutral-bold p-3 shadow-2xl/u);
	assert.doesNotMatch(bar, /bg-transparent p-3 shadow-none/u);
	// Nothing between the rail and the two surfaces may carry a fill or a clip.
	assert.doesNotMatch(source, /bg-bg-neutral-bold|shadow-2xl|overflow-hidden/u);
	assert.doesNotMatch(source, /bg-surface-raised/u);
});

test("Omnibar stacks both geometries in one grid cell instead of hoisting the Timeline chip", () => {
	// Overlapping in a single cell is what lets the outgoing surface stay centred over the
	// incoming one. It also retires the compact-tone hoist: with no layout animation left,
	// there is nothing for a held composer or a staggered chip to protect against.
	const source = readFileSync(new URL("./components/omnibar.tsx", import.meta.url), "utf8");
	const bar = readFileSync(new URL("./components/omnibar-bar.tsx", import.meta.url), "utf8");
	const pill = readFileSync(new URL("./components/omnibar-pill.tsx", import.meta.url), "utf8");

	assert.match(source, /grid grid-cols-\[minmax\(0,auto\)\]/u);
	assert.match(source, /w-fit max-w-\[calc\(100%-32px\)\] items-end justify-items-center/u);
	assert.match(bar, /col-start-1 row-start-1/u);
	assert.match(pill, /col-start-1 row-start-1/u);
	assert.doesNotMatch(source, /holdComposer|hoistContextPill|OmnibarContextPill/u);
	assert.doesNotMatch(bar, /hideContextPill|OmnibarContextPill/u);
});

test("Omnibar gates the timeline behind entries rather than always rendering it", () => {
	const source = readFileSync(new URL("./components/omnibar.tsx", import.meta.url), "utf8");
	const bar = readFileSync(new URL("./components/omnibar-bar.tsx", import.meta.url), "utf8");

	// No entries means no toggle, so every existing consumer keeps today's bar.
	assert.match(source, /const timeline = timelineEntries\s*\?/u);
	assert.match(bar, /\{timeline \? \(/u);
	assert.match(bar, /<OmnibarTimelinePill/u);
	assert.match(bar, /<ContextBarPill/u);
	assert.doesNotMatch(bar, /Customize|CustomizeIcon/u);
	// Only the horizontal axis takes the editor cell; `y` docks a sibling rail.
	assert.match(bar, /timeline\?\.isTimeline === true && timeline\.axis === "x"/u);
	assert.match(source, /timelineAxis === "y"/u);
});

test("Omnibar defaults to the light PromptInput chrome, with inverse as the opt-in", () => {
	const source = readFileSync(new URL("./components/omnibar.tsx", import.meta.url), "utf8");
	const bar = readFileSync(new URL("./components/omnibar-bar.tsx", import.meta.url), "utf8");
	const hook = readFileSync(new URL("./hooks/use-omnibar-state.ts", import.meta.url), "utf8");

	// The expanded bar is the same white `PromptInput variant="floating"` form every other
	// composer in the repo renders; the black re-skin has to be asked for.
	assert.match(source, /tone = "default"/u);
	assert.match(bar, /const isInverse = tone === "inverse"/u);
	assert.match(bar, /isInverse \? OMNIBAR_BAR_SKIN : null/u);
	assert.match(hook, /if \(onOpenPanelRef\.current\) \{/u);
	assert.match(hook, /dispatch\(\{ type: "collapse" \}\)/u);
});

test("Omnibar send control stays disabled when the host wires no onSubmit", () => {
	// `RovoComposerActionButton` resolves `disabled` as `submitDisabled || !canSubmit`.
	// Without forwarding `submitDisabled`, the button enables on the first keystroke
	// and then does nothing — `handleSubmit` returns early with no consumer.
	const source = readFileSync(new URL("./components/omnibar.tsx", import.meta.url), "utf8");
	const bar = readFileSync(new URL("./components/omnibar-bar.tsx", import.meta.url), "utf8");

	assert.match(source, /<OmnibarBar[\s\S]*submitDisabled=\{onSubmit === undefined\}/u);
	assert.match(
		bar,
		/<RovoComposerActionButton[\s\S]*submitDisabled=\{submitDisabled\}/u,
		"the bar must forward submitDisabled, not just accept it",
	);
	// The runtime guard stays too: Enter reaches requestSubmit() without touching the button.
	assert.match(source, /if \(!prompt \|\| onSubmit === undefined\) \{/u);
});

test("Omnibar animates only opacity and scale, never layout", () => {
	// The defect this replaces: animating `width` from 96px to 720px stretched one box
	// across the screen, and Motion `layout` projects size with transform:scale, which
	// enlarges placeholder and button type mid-flight. Both surfaces now transform in
	// place instead, so nothing reflows and nothing gets scaled by a parent.
	const source = readFileSync(new URL("./components/omnibar.tsx", import.meta.url), "utf8");
	const bar = readFileSync(new URL("./components/omnibar-bar.tsx", import.meta.url), "utf8");
	const pill = readFileSync(new URL("./components/omnibar-pill.tsx", import.meta.url), "utf8");

	for (const [name, contents] of [["omnibar.tsx", source], ["omnibar-bar.tsx", bar], ["omnibar-pill.tsx", pill]]) {
		assert.doesNotMatch(contents, /layout="position"|layoutId/u, `${name} must not use Motion layout`);
		assert.doesNotMatch(contents, /^\s+layout\s*$/mu, `${name} must not use Motion layout`);
	}
	// The stack itself animates nothing — it only holds the two surfaces.
	assert.doesNotMatch(source, /animate=\{\{/u);
	// The bar owns its width as a static class, so the stack never animates one.
	assert.match(bar, /w-\[720px\] max-w-full/u);
	for (const contents of [bar, pill]) {
		assert.match(contents, /animate=\{\{ opacity: 1, scale: 1 \}\}/u);
		assert.match(contents, /scale: resolveOmnibarZoom\(/u);
		assert.match(contents, /pointerEvents: "none"/u);
	}
});
