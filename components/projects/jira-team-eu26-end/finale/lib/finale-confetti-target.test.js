const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");
// Registers happy-dom's document, which the landing reads like a board.
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

/*
 * Where and when a drop's small puff fires. It used to burst from the
 * viewport's lower corners the instant board state committed, nowhere near the
 * card and before the card was visibly down. It now waits for the cards the
 * drop brought into Done to touch down in their slots and puffs out from under
 * their footprint: one card once its slot reveals it, a bulk drop as its stack
 * lands in the lead's slot. A bulk drop's footprint is where its cards come to
 * rest once the stack has unfolded, so they slide out into the dust ring
 * instead of over it (the confetti canvas sits above the page).
 */

let targetModule;
function load() {
	targetModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: {
			contents: 'export * from "./finale-confetti-target"; export { ISSUE_DROP_REVEAL_PENDING_ATTRIBUTE } from "@/components/blocks/jira-kanban/experimental/lib/issue-solitaire-drop";',
			resolveDir: __dirname,
			loader: "ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		logLevel: "silent",
	}).outputFiles[0].text, "finale-confetti-target-harness.cjs");
	return targetModule;
}

/** The list's scroll viewport inside the Done column: cards outside it are clipped. */
const LIST = { x: 600, y: 120, width: 320, height: 600 };
const box = (rect, radius = 8) => ({ ...rect, radius });

/**
 * A Done column built like the board's: list > slot > [data-issue-key] > card.
 * happy-dom has no layout, so each card's laid-out rect is set by hand, and its
 * slot can be held, or offset by an unfolding FLIP, the way the board does it.
 */
function doneColumn(t, cards) {
	const column = document.createElement("section");
	column.dataset.jiraKanbanColumn = "Done";
	column.getBoundingClientRect = () => DOMRect.fromRect({ x: 600, y: 80, width: 320, height: 680 });
	const list = document.createElement("div");
	list.dataset.jiraKanbanCardList = "";
	list.getBoundingClientRect = () => DOMRect.fromRect(LIST);
	column.append(list);
	const slots = new Map();
	for (const { code, rect } of cards) {
		const slot = document.createElement("div");
		const issue = document.createElement("div");
		issue.dataset.issueKey = code;
		issue.dataset.boardColumnTitle = "Done";
		const card = document.createElement("article");
		card.dataset.slot = "jira-issue-card";
		card.style.borderRadius = "8px";
		const state = { rect, offset: 0 };
		// Like the browser's, the rect carries the slot's running transform.
		card.getBoundingClientRect = () => DOMRect.fromRect({ ...state.rect, y: state.rect.y + state.offset });
		issue.append(card);
		slot.append(issue);
		list.append(slot);
		slots.set(code, { slot, state });
	}
	document.body.append(column);
	t.after(() => column.remove());
	const api = {
		/** The solitaire drop's single-card hold: slot reserved, face hidden until neighbours reflow. */
		hold(code) {
			const { slot } = slots.get(code);
			slot.setAttribute(load().ISSUE_DROP_REVEAL_PENDING_ATTRIBUTE, "");
			slot.inert = true;
		},
		reveal(code) {
			const { slot } = slots.get(code);
			slot.removeAttribute(load().ISSUE_DROP_REVEAL_PENDING_ATTRIBUTE);
			slot.inert = false;
		},
		move(code, rect) { slots.get(code).state.rect = rect; },
		/**
		 * The solitaire unfold: the slot is laid out in place and a transform
		 * animation (delay and backwards fill included) translates it by `offset`
		 * toward the lead; 0 is the animation finished and gone.
		 */
		unfold(code, offset) {
			const { slot, state } = slots.get(code);
			state.offset = offset;
			slot.style.transform = offset ? `matrix(1, 0, 0, 1, 0, ${offset})` : "";
			const flip = { effect: { getKeyframes: () => [{ transform: `translate3d(0, ${offset}px, 0)`, offset: 0 }, { transform: "translate3d(0, 0, 0)", offset: 1 }] } };
			slot.getAnimations = () => offset ? [flip] : [];
		},
	};
	for (const { code, held } of cards) if (held) api.hold(code);
	return api;
}

/** Frames delivered by hand, so the test decides what the board looks like on each. */
function fakeFrames(t) {
	const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
	let queue = [];
	let id = 0;
	globalThis.requestAnimationFrame = (callback) => {
		queue.push({ id: ++id, callback });
		return id;
	};
	globalThis.cancelAnimationFrame = (handle) => { queue = queue.filter((frame) => frame.id !== handle); };
	t.after(() => Object.assign(globalThis, previous));
	return {
		pending: () => queue.length,
		/** Deliver one frame to every callback waiting on it. */
		next() {
			const due = queue;
			queue = [];
			for (const { callback } of due) callback(0);
		},
	};
}

/** Let promise reactions (the wait's resolution, the hook's play) run. */
async function settle() {
	for (let index = 0; index < 4; index++) await Promise.resolve();
}

function track(promise) {
	const result = { done: false, value: undefined };
	void promise.then((value) => Object.assign(result, { done: true, value }));
	return result;
}

test("a drop's footprint is its visible cards' union, trimmed to the list, round the tightest corner", () => {
	const { unionFinaleConfettiBoxes } = load();
	const clip = { left: 600, top: 120, right: 920, bottom: 720 };
	assert.deepEqual(
		unionFinaleConfettiBoxes([box({ x: 608, y: 300, width: 304, height: 120 }), box({ x: 608, y: 428, width: 304, height: 140 }, 6)], clip),
		{ x: 608, y: 300, width: 304, height: 268, radius: 6 },
		"two landed cards puff as one box spanning both",
	);
	assert.deepEqual(
		unionFinaleConfettiBoxes([box({ x: 608, y: 600, width: 304, height: 120 }), box({ x: 608, y: 728, width: 304, height: 120 })], clip),
		{ x: 608, y: 600, width: 304, height: 120, radius: 8 },
		"a card below the list's fold adds nothing",
	);
	assert.deepEqual(
		unionFinaleConfettiBoxes([box({ x: 608, y: 714, width: 304, height: 120 })], clip),
		{ x: 608, y: 714, width: 304, height: 6, radius: 3 },
		"a card cut by the fold puffs from what shows, its corners no rounder than that sliver",
	);
	assert.equal(unionFinaleConfettiBoxes([box({ x: 608, y: 760, width: 304, height: 120 })], clip), null, "nothing visible, nothing to puff around");
	assert.equal(unionFinaleConfettiBoxes([], clip), null);
});

test("an element's confetti box is its bounds, round its own bottom corners as the browser draws them", (t) => {
	const { confettiBoxOf } = load();
	const element = document.createElement("div");
	element.style.borderRadius = "12px";
	element.getBoundingClientRect = () => DOMRect.fromRect({ x: 1090, y: 240, width: 322, height: 640 });
	document.body.append(element);
	t.after(() => element.remove());
	assert.deepEqual(confettiBoxOf(element), { x: 1090, y: 240, width: 322, height: 640, radius: 12 });
	element.style.borderRadius = "25%";
	element.getBoundingClientRect = () => DOMRect.fromRect({ x: 608, y: 296, width: 160, height: 120 });
	assert.equal(confettiBoxOf(element).radius, 30, "a % radius resolves against the box, not as px");
	element.style.borderRadius = "999px";
	assert.equal(confettiBoxOf(element).radius, 60, "and no corner is rounder than half the box");
});

test("one card puffs on the frame its slot reveals it, from exactly its own box", async (t) => {
	const { waitForFinaleDropLanding } = load();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const frames = fakeFrames(t);
	const board = doneColumn(t, [
		{ code: "TEU-9", rect: { x: 608, y: 128, width: 304, height: 160 } },
		{ code: "TEU-1", rect: { x: 608, y: 296, width: 304, height: 148 }, held: true },
	]);
	const landing = track(waitForFinaleDropLanding(["TEU-1"]));
	// The board reserves the slot at once, but its face stays hidden while the neighbours reflow.
	for (let frame = 0; frame < 9; frame++) frames.next();
	await settle();
	assert.equal(landing.done, false, "no dust while the card is not yet there");
	board.reveal("TEU-1");
	frames.next();
	await settle();
	assert.equal(landing.done, true, "the frame the card appears is its touch-down");
	assert.deepEqual(landing.value, { x: 608, y: 296, width: 304, height: 148, radius: 8 }, "the dust starts at the dropped card's edge, not the column's or a neighbour's");
	assert.equal(frames.pending(), 0, "and the frame loop ends with the wait");
});

/** A bulk drop into Done, committed: three cards in their own slots, stacked under the lead. */
function bulkDrop(t) {
	const board = doneColumn(t, [
		{ code: "TEU-9", rect: { x: 608, y: 128, width: 304, height: 160 } },
		{ code: "TEU-2", rect: { x: 608, y: 296, width: 304, height: 120 } },
		{ code: "TEU-3", rect: { x: 608, y: 424, width: 304, height: 140 } },
		{ code: "TEU-4", rect: { x: 608, y: 572, width: 304, height: 120 } },
	]);
	// Every card sits in its slot from the commit; the unfold is a FLIP from the lead's top.
	board.unfold("TEU-3", -128);
	board.unfold("TEU-4", -276);
	return board;
}

/** Where the cohort rests once unfolded: the union of its own slots, nothing of TEU-9's. */
const BULK_SETTLED = { x: 608, y: 296, width: 304, height: 396, radius: 8 };

test("a bulk drop puffs as its stack lands, round the slots it is about to unfold into", async (t) => {
	const { waitForFinaleDropLanding } = load();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const frames = fakeFrames(t);
	const board = bulkDrop(t);
	const landing = track(waitForFinaleDropLanding(["TEU-2", "TEU-3", "TEU-4"]));
	// The cards beneath the lead begin to slide out to their own slots.
	board.unfold("TEU-3", -100);
	board.unfold("TEU-4", -230);
	frames.next();
	await settle();
	assert.equal(landing.done, true, "the stack is down on the commit; its unfolding is not a fall, and is not waited out");
	assert.deepEqual(landing.value, BULK_SETTLED, "the cards slide out into the dust ring, never through it");
	assert.equal(frames.pending(), 0);
});

test("read mid-unfold, or as the unfold ends, a bulk drop's footprint is still its settled slots", async (t) => {
	const { readFinaleDropLanding, waitForFinaleDropLanding } = load();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const frames = fakeFrames(t);
	const board = bulkDrop(t);
	const cohort = ["TEU-2", "TEU-3", "TEU-4"];
	assert.deepEqual(readFinaleDropLanding(cohort).box, BULK_SETTLED, "stacked under the lead");
	board.unfold("TEU-3", -40);
	board.unfold("TEU-4", -90);
	assert.deepEqual(readFinaleDropLanding(cohort).box, BULK_SETTLED, "halfway out");
	const landing = track(waitForFinaleDropLanding(cohort));
	board.unfold("TEU-3", 0);
	board.unfold("TEU-4", 0);
	frames.next();
	await settle();
	assert.deepEqual(landing.value, BULK_SETTLED, "and once the unfold is over, the same box holds");
});

test("only a pure translation is taken back out of a card's rect", () => {
	const { finaleTransformTranslation } = load();
	assert.deepEqual(finaleTransformTranslation("none"), { x: 0, y: 0 });
	assert.deepEqual(finaleTransformTranslation("matrix(1, 0, 0, 1, 0, -128)"), { x: 0, y: -128 });
	assert.deepEqual(finaleTransformTranslation("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, -40, 0, 1)"), { x: 12, y: -40 });
	assert.equal(finaleTransformTranslation("matrix(0.9, 0, 0, 0.9, 0, -20)"), null, "a scale says nothing about where the box rests");
	assert.equal(finaleTransformTranslation("matrix(0.98, 0.17, -0.17, 0.98, 0, 0)"), null);
});

test("a footprint still travelling (a column scrolling it into view) puffs only once it holds still", async (t) => {
	const { waitForFinaleDropLanding } = load();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const frames = fakeFrames(t);
	const board = doneColumn(t, [{ code: "TEU-5", rect: { x: 608, y: 520, width: 304, height: 148 } }]);
	const landing = track(waitForFinaleDropLanding(["TEU-5"]));
	board.move("TEU-5", { x: 608, y: 470, width: 304, height: 148 });
	frames.next();
	await settle();
	assert.equal(landing.done, false, "dust thrown mid-scroll would stay behind on the page");
	frames.next();
	await settle();
	assert.deepEqual(landing.value, { x: 608, y: 470, width: 304, height: 148, radius: 8 });
});

test("a move with no drop motion puffs a frame after its cards are simply there and still", async (t) => {
	const { waitForFinaleDropLanding } = load();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const frames = fakeFrames(t);
	doneColumn(t, [{ code: "TEU-6", rect: { x: 608, y: 128, width: 304, height: 148 } }]);
	const landing = track(waitForFinaleDropLanding(["TEU-6"]));
	await settle();
	assert.equal(landing.done, false, "one reading cannot tell a card at rest from one passing through");
	frames.next();
	await settle();
	assert.deepEqual(landing.value, { x: 608, y: 128, width: 304, height: 148, radius: 8 });
});

test("cards out of sight are no footprint: a drop below the fold is skipped at the bound, never thrown at the column", async (t) => {
	const { FINALE_DROP_LANDING_TIMEOUT_MS, waitForFinaleDropLanding } = load();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const frames = fakeFrames(t);
	doneColumn(t, [
		{ code: "TEU-7", rect: { x: 608, y: 560, width: 304, height: 148 } },
		{ code: "TEU-8", rect: { x: 608, y: 760, width: 304, height: 148 } },
		{ code: "TEU-10", rect: { x: 608, y: 916, width: 304, height: 148 } },
	]);
	const partly = track(waitForFinaleDropLanding(["TEU-7", "TEU-8"]));
	frames.next();
	await settle();
	assert.deepEqual(partly.value, { x: 608, y: 560, width: 304, height: 148, radius: 8 }, "only the card the list shows is under the dust");
	const hidden = track(waitForFinaleDropLanding(["TEU-10"]));
	for (let frame = 0; frame < 30; frame++) frames.next();
	await settle();
	assert.equal(hidden.done, false, "it may yet scroll into view");
	t.mock.timers.tick(FINALE_DROP_LANDING_TIMEOUT_MS);
	await settle();
	assert.deepEqual(hidden, { done: true, value: null }, "then the puff is skipped");
	assert.equal(frames.pending(), 0, "and nothing keeps polling");
});

test("an abort, a pre-aborted wait or a missing Done column resolve at once with no puff", async (t) => {
	const { waitForFinaleDropLanding } = load();
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const frames = fakeFrames(t);
	const absent = track(waitForFinaleDropLanding(["TEU-1"]));
	await settle();
	assert.deepEqual(absent, { done: true, value: null }, "no Done column on the page");
	doneColumn(t, [{ code: "TEU-1", rect: { x: 608, y: 296, width: 304, height: 148 }, held: true }]);
	const controller = new AbortController();
	const aborted = track(waitForFinaleDropLanding(["TEU-1"], controller.signal));
	frames.next();
	controller.abort();
	await settle();
	assert.deepEqual(aborted, { done: true, value: null });
	assert.equal(frames.pending(), 0, "an aborted wait stops reading the board");
	const late = track(waitForFinaleDropLanding(["TEU-1"], controller.signal));
	await settle();
	assert.deepEqual(late, { done: true, value: null });
	assert.equal(frames.pending(), 0);
});

test("two quick drops each puff at their own cards, and unmounting abandons a puff still waiting", async (t) => {
	const frames = fakeFrames(t);
	const board = doneColumn(t, [
		{ code: "TEU-1", rect: { x: 608, y: 128, width: 304, height: 148 }, held: true },
		{ code: "TEU-2", rect: { x: 608, y: 284, width: 304, height: 160 } },
		{ code: "TEU-3", rect: { x: 608, y: 452, width: 304, height: 148 }, held: true },
	]);
	const plays = [];
	const confetti = {
		prewarm: () => {},
		play: (target) => {
			plays.push(target);
			return { gathered: Promise.resolve(), raise: () => {}, release: () => {}, cancel: () => {} };
		},
		hold: () => {},
		dispose: () => {},
	};
	let puff = null;
	const view = await renderComponent({
		source: `
import { useEffect } from "react";
import { useFinaleDropPuff } from "@/components/projects/jira-team-eu26-end/finale/hooks/use-finale-drop-puff";
export function DropPuffHarness({ confetti, expose }) {
	const puff = useFinaleDropPuff(confetti);
	useEffect(() => expose(puff), [expose, puff]);
	return null;
}
`,
		exportName: "DropPuffHarness",
		props: { confetti, expose: (next) => { puff = next; } },
	});
	assert.equal(typeof puff, "function");
	// The first drop's card is still held back as the second, already at rest, lands.
	puff(["TEU-1"]);
	puff(["TEU-2"]);
	frames.next();
	await settle();
	assert.deepEqual(plays.map(({ size, landing }) => [size, landing.y]), [["small", 284]], "the second drop's wait neither waits on nor cancels the first");
	board.reveal("TEU-1");
	frames.next();
	await settle();
	assert.deepEqual(plays.map(({ landing }) => landing.y), [284, 128], "the first then puffs at its own card");
	assert.deepEqual(plays[1], { size: "small", landing: { x: 608, y: 128, width: 304, height: 148, radius: 8 } });
	puff(["TEU-3"]);
	await view.unmount();
	board.reveal("TEU-3");
	frames.next();
	frames.next();
	await settle();
	assert.equal(plays.length, 2, "an unmounted board throws no dust");
	assert.equal(frames.pending(), 0, "and leaves no frame loop behind");
});
