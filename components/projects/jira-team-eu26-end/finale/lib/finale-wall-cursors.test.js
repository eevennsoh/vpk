const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const React = require("react");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const ENTRY = `
export { WALL_CUE } from "../data/finale-cues";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
export { FINALE_WALL_CURSOR_NAMES } from "../data/finale-wall-cursor-names";
export { FINALE_CURSORS, finaleCursorBox } from "./finale-cursor-path";
export { WALL_SCALE, buildFinaleWall, wallGeometry } from "./finale-wall-layout";
export { wallCardHoldable, wallCursorsAt } from "./finale-wall-cursors";
export { arrivalCardPose, bentoDrops, slotArrivals, slotDescent, slotOnScreen, wallOffset, wallTimeAt } from "./finale-wall-motion";
export { projectLifted } from "./finale-camera";
export { titleCarrierGoneTime, titleReachTime } from "./finale-title-drag";
`;

let loaded;
function load() {
	loaded ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-cursors-harness.cjs");
	return loaded;
}

/** The keynote's presenters, whose cursors belong to the bento, never the wall. */
const PRESENTER = /^(mike|michael|tamar|sherif|taroon)$/i;

/** First names in the human avatar roster, as its files name them (`andrea-wilson.png` → "Andrea"). */
function rosterFirstNames() {
	const files = fs.readdirSync(path.join(process.cwd(), "public/avatar-human")).filter((file) => file.endsWith(".png"));
	return new Set(files.map((file) => {
		const first = file.split("-")[0];
		return first.charAt(0).toUpperCase() + first.slice(1);
	}));
}

function wallFor(viewport) {
	const { bentoDrops, buildFinaleWall, finaleBentoLayout, FINALE_FEATURES, wallGeometry } = load();
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = finaleBentoLayout(viewport, scale);
	const wall = buildFinaleWall(wallGeometry(scale, viewport), bento, FINALE_FEATURES, []);
	return { wall, drops: bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title) };
}

test("the wall's cursors are named from the avatar roster, once each, and never for a presenter", () => {
	const { FINALE_CURSORS, FINALE_WALL_CURSOR_NAMES } = load();
	const roster = rosterFirstNames();
	assert.equal(new Set(FINALE_WALL_CURSOR_NAMES).size, FINALE_WALL_CURSOR_NAMES.length, "one label per name");
	for (const name of FINALE_WALL_CURSOR_NAMES) {
		assert.ok(roster.has(name), `${name} has an avatar in public/avatar-human`);
		assert.ok(!PRESENTER.test(name), `${name} is not a presenter`);
	}
	assert.deepEqual(FINALE_CURSORS.map((cursor) => cursor.label).sort(), ["Mike", "Sherif", "Tamar", "Taroon"], "the bento keeps its presenters");
});

test("human drags recur regularly through the steady wall without long empty stretches", () => {
	const m = load();
	for (const viewport of [{ width: 1920, height: 1080 }, { width: 1728, height: 1117 }, { width: 1024, height: 768 }]) {
		const { wall, drops } = wallFor(viewport);
		const firstSeen = new Map();
		for (let time = 20; time < 120; time += 0.1) {
			for (const cursor of m.wallCursorsAt(time, wall, drops, viewport)) {
				if (cursor.key !== "title" && !firstSeen.has(cursor.key)) firstSeen.set(cursor.key, time);
			}
		}
		const times = [...firstSeen.values()].sort((a, b) => a - b);
		assert.ok(times.length >= 45, `${viewport.width}: at least 27 human drags per minute (${times.length} in 100 seconds)`);
		// Only cards a teammate could hold count: one that comes down still over the frame's edge never can be.
		const arrivals = Array.from({ length: wall.periodBuckets * 2 }, (_, bucket) => wall.bucket(bucket)).flat().filter((slot) => m.wallCardHoldable(slot, wall)).map((slot) => m.slotDescent(slot, wall).start);
		assert.ok(arrivals.length > 0, `${viewport.width}: the wall has holdable cards`);
		for (let index = 1; index < times.length; index += 1) {
			if (times[index] - times[index - 1] <= 8) continue;
			assert.equal(arrivals.some((time) => time > times[index - 1] + 1 && time < times[index] - 1), false, "a longer gap only occurs when no holdable cards arrive between the adjacent drags");
		}
	}
});

test("each held card's cursor is the slot's own teammate on every pass, one per lane and nobody twice at once, once MCB has carried the title in", () => {
	const { FINALE_CURSORS, FINALE_WALL_CURSOR_NAMES, WALL_CUE, titleCarrierGoneTime, titleReachTime, wallCursorsAt, wallTimeAt } = load();
	const pool = new Set(FINALE_WALL_CURSOR_NAMES);
	const presenters = new Set(FINALE_CURSORS.map((cursor) => cursor.label));
	const mike = FINALE_CURSORS.findIndex((cursor) => cursor.id === "mike");
	const viewport = { width: 1728, height: 1117 };
	const { wall, drops } = wallFor(viewport);
	const { geometry } = wall;
	const seedOf = (key) => wall.bucket(Number(key.split(":")[0])).find((slot) => slot.key === key).seed;
	// Three periods of travel: at least two whole loops past the wall's run-up, so every slot comes round again.
	const end = wallTimeAt(3 * wall.periodWidth, geometry);
	assert.ok(Number.isFinite(end) && end > WALL_CUE.start, "the wall glides");

	const byKey = new Map();
	const bySeed = new Map();
	const keysOfSeed = new Map();
	let held = 0;
	let carried = 0;
	let firstTeammate = Number.POSITIVE_INFINITY;
	for (let time = WALL_CUE.start; time < end; time += 0.1) {
		const all = wallCursorsAt(time, wall, drops, viewport);
		assert.equal(new Set(all.map((cursor) => cursor.lane)).size, all.length, "one card per lane at a time");
		assert.equal(new Set(all.map((cursor) => cursor.name)).size, all.length, "nobody in two places at once");
		// The one presenter on the wall: MCB, in his own colour and name, carrying the title, and only then.
		const title = all.filter((cursor) => cursor.key === "title");
		const during = time >= titleReachTime() && time <= titleCarrierGoneTime();
		assert.equal(title.length, during ? 1 : 0, `MCB's cursor is on the wall only while he carries the title (${time.toFixed(2)}s)`);
		for (const cursor of title) {
			assert.equal(cursor.lane, mike);
			assert.equal(cursor.name, FINALE_CURSORS[mike].label);
			carried += 1;
		}
		const cursors = all.filter((cursor) => cursor.key !== "title");
		if (cursors.length > 0) firstTeammate = Math.min(firstTeammate, time);
		for (const cursor of cursors) {
			assert.ok(Number.isInteger(cursor.lane) && cursor.lane >= 0 && cursor.lane < FINALE_CURSORS.length, `lane ${cursor.lane}`);
			assert.ok(pool.has(cursor.name), `${cursor.name} is from the roster`);
			assert.ok(!presenters.has(cursor.name) && !PRESENTER.test(cursor.name), `${cursor.name} is not a presenter`);
			assert.ok(cursor.opacity >= 0 && cursor.opacity <= 1);
			if (cursor.opacity === 1) held += 1;
			const who = `${cursor.name}@${cursor.lane}`;
			assert.equal(byKey.get(cursor.key) ?? who, who, `slot ${cursor.key} keeps its teammate`);
			byKey.set(cursor.key, who);
			const seed = seedOf(cursor.key);
			assert.equal(bySeed.get(seed) ?? who, who, `seed ${seed} is the same teammate on every pass`);
			bySeed.set(seed, who);
			keysOfSeed.set(seed, (keysOfSeed.get(seed) ?? new Set()).add(cursor.key));
		}
	}
	assert.ok(held > 0, "they do reach in");
	assert.ok(carried > 0, "MCB carries the title in");
	assert.ok(firstTeammate > titleCarrierGoneTime(), "and has left before any teammate reaches in");
	assert.ok([...keysOfSeed.values()].some((keys) => keys.size > 1), "a slot is held again on a later pass");
	const names = new Set([...byKey.values()].map((who) => who.split("@")[0]));
	assert.ok(names.size >= FINALE_CURSORS.length, `many teammates over a loop (${[...names].join(", ")})`);
	assert.equal(new Set([...byKey.values()].map((who) => who.split("@")[1])).size, FINALE_CURSORS.length, "every lane is used");
});

/** Where a cursor paints on screen around its tip, name pill and all (turned over: its name above). */
function paintedBox(m, cursor, fit) {
	const upright = m.finaleCursorBox(cursor.name);
	const box = cursor.pillAbove ? { ...upright, top: upright.bottom, bottom: upright.top } : upright;
	const scale = fit * cursor.scale;
	return { left: cursor.x - box.left * scale, top: cursor.y - box.top * scale, right: cursor.x + box.right * scale, bottom: cursor.y + box.bottom * scale };
}

const whollyOff = (box, viewport) => box.right <= 0 || box.left >= viewport.width || box.bottom <= 0 || box.top >= viewport.height;
const whollyIn = (box, viewport) => box.left >= 0 && box.top >= 0 && box.right <= viewport.width && box.bottom <= viewport.height;

test("a teammate's cursor glides onto its card, then gradually fades during a brief return toward its entry edge", () => {
	const m = load();
	for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1130, height: 2296 }]) {
		const { wall, drops } = wallFor(viewport);
		const { geometry } = wall;
		const fit = geometry.typeScale / m.WALL_SCALE;
		const at = (time, key) => m.wallCursorsAt(time, wall, drops, viewport).find((cursor) => cursor.key === key) ?? null;
		const slotOf = (key) => wall.bucket(Number(key.split(":")[0])).find((slot) => slot.key === key);
		// The tip of a hand resting on its card: the card's middle as it comes down, then as the wall carries it on.
		const cardMiddle = (slot, time) => {
			const [card] = m.slotArrivals(slot, wall);
			const pose = m.arrivalCardPose(slot, card, m.slotOnScreen(slot, m.wallOffset(time, geometry), geometry), Math.min(time, card.descent.touchdown), viewport);
			return m.projectLifted(pose, viewport);
		};
		const offCard = (cursor, slot, time) => {
			const middle = cardMiddle(slot, time);
			return Math.hypot(cursor.x - middle.x, cursor.y - middle.y);
		};
		// The moment a cursor appears or is gone: the step between a time without it and one with it.
		const edge = (key, without, within) => {
			for (let step = 0; step < 40; step += 1) {
				const mid = (without + within) / 2;
				if (at(mid, key)) within = mid;
				else without = mid;
			}
			return within;
		};

		// One loop's teammates, each first seen on a coarse pass that runs on until the last of them is gone.
		const end = m.wallTimeAt(wall.periodWidth, geometry) + 30;
		const seen = new Map();
		for (let time = m.WALL_CUE.start; time < end + 3; time += 0.1) {
			for (const cursor of m.wallCursorsAt(time, wall, drops, viewport)) {
				if (cursor.key === "title" || (time >= end && !seen.has(cursor.key))) continue;
				const span = seen.get(cursor.key) ?? { first: time, last: time };
				span.last = time;
				seen.set(cursor.key, span);
			}
		}
		assert.ok(seen.size >= 10, `teammates reach in (${seen.size} at ${viewport.width}×${viewport.height})`);

		for (const [key, span] of seen) {
			const slot = slotOf(key);
			const { touchdown } = m.slotDescent(slot, wall);
			const who = `${key} at ${viewport.width}×${viewport.height}`;

			// Coming in: it sets off wholly off the frame, opaque, and only glides closer onto its card.
			const from = edge(key, span.first - 0.1, span.first);
			const first = at(from, key);
			assert.ok(whollyOff(paintedBox(m, first, fit), viewport), `${who} sets off wholly off the frame`);
			let previous = { cursor: first, off: offCard(first, slot, from) };
			const own = paintedBox(m, first, fit);
			assert.ok(previous.off >= own.right - own.left, `${who} travels at least its own length onto its card`);
			const entryOrigin = cardMiddle(slot, from);
			const entryDirection = { x: first.x - entryOrigin.x, y: first.y - entryOrigin.y };
			const midwayIn = at(from + 0.3, key);
			const midwayOrigin = cardMiddle(slot, from + 0.3);
			const midwayOffset = { x: midwayIn.x - midwayOrigin.x, y: midwayIn.y - midwayOrigin.y };
			const approachBow = Math.abs(entryDirection.x * midwayOffset.y - entryDirection.y * midwayOffset.x) / Math.hypot(entryDirection.x, entryDirection.y);
			assert.ok(approachBow < previous.off * 0.09, `${who} keeps the original subtle approach instead of the stronger exit arc`);
			for (let time = from + 1 / 60; time <= touchdown - 0.05; time += 1 / 60) {
				const cursor = at(time, key);
				const off = offCard(cursor, slot, time);
				assert.equal(cursor.opacity, 1, `${who} comes in opaque, never fading in on its card (${time.toFixed(3)}s)`);
				assert.ok(off <= previous.off + 1e-6, `${who} only ever closes in on its card (${time.toFixed(3)}s)`);
				assert.ok(Math.hypot(cursor.x - previous.cursor.x, cursor.y - previous.cursor.y) < 0.06 * Math.max(viewport.width, viewport.height), `${who} glides, never jumps (${time.toFixed(3)}s)`);
				previous = { cursor, off };
			}

			// Holding: on its card's middle, opaque and wholly in the frame, from a beat before it lands until it lands.
			for (const time of [touchdown - 0.05, touchdown]) {
				const cursor = at(time, key);
				assert.ok(offCard(cursor, slot, time) < 0.5, `${who} rests on its card's middle (${time.toFixed(3)}s)`);
				assert.equal(cursor.opacity, 1);
				assert.ok(whollyIn(paintedBox(m, cursor, fit), viewport), `${who} holds its card wholly in the frame`);
			}

			// Leaving: return toward the entry edge, with a brief visible retreat and a gradual fade.
			const gone = edge(key, span.last + 0.1, span.last);
			const last = at(gone, key);
			const away = offCard(last, slot, gone);
			assert.ok(whollyOff(paintedBox(m, last, fit), viewport) && last.opacity < 0.01, `${who} fades out as it leaves the frame`);
			previous = { cursor: at(touchdown, key), off: 0 };
			let halfFaded = null;
			for (let time = touchdown + 1 / 60; time < gone; time += 1 / 60) {
				const cursor = at(time, key);
				const off = offCard(cursor, slot, time);
				assert.ok(off >= previous.off - 1e-6 && cursor.opacity <= previous.cursor.opacity + 1e-9, `${who} only ever heads away, fading (${time.toFixed(3)}s)`);
				if (halfFaded === null && cursor.opacity <= 0.5) halfFaded = off;
				previous = { cursor, off };
			}
			assert.ok(halfFaded !== null && halfFaded > 0 && halfFaded < 0.3 * away, `${who} fades during a brief retreat`);
			const earlyFade = at(touchdown + 0.05, key);
			const middleFade = at(touchdown + 0.1, key);
			const lateFade = at(touchdown + 0.15, key);
			assert.ok(earlyFade.opacity > 0.7 && earlyFade.opacity < 1, `${who} remains clearly visible while starting back`);
			assert.ok(middleFade.opacity > 0.25 && middleFade.opacity < 0.75, `${who} fades through a visible middle state`);
			assert.ok(lateFade.opacity > 0 && lateFade.opacity < middleFade.opacity, `${who} fades smoothly toward transparent`);
			const entryMiddle = cardMiddle(slot, from);
			const exitMiddle = cardMiddle(slot, gone);
			const entry = { x: first.x - entryMiddle.x, y: first.y - entryMiddle.y };
			const returning = { x: last.x - exitMiddle.x, y: last.y - exitMiddle.y };
			const alignment = (entry.x * returning.x + entry.y * returning.y) / (Math.hypot(entry.x, entry.y) * Math.hypot(returning.x, returning.y));
			assert.ok(alignment > 0.99, `${who} returns toward the edge it came from`);
			const earlyMiddle = cardMiddle(slot, touchdown + 0.05);
			const visibleRetreat = { x: earlyFade.x - earlyMiddle.x, y: earlyFade.y - earlyMiddle.y };
			assert.ok(Math.hypot(visibleRetreat.x, visibleRetreat.y) > 0.5 * fit, `${who} visibly starts back before fading away`);
			const visibleAlignment = (entry.x * visibleRetreat.x + entry.y * visibleRetreat.y) / (Math.hypot(entry.x, entry.y) * Math.hypot(visibleRetreat.x, visibleRetreat.y));
			assert.ok(visibleAlignment > 0.7, `${who} retreats toward its entry side while still visible`);
			const lateMiddle = cardMiddle(slot, touchdown + 0.15);
			const lateRetreat = { x: lateFade.x - lateMiddle.x, y: lateFade.y - lateMiddle.y };
			const returnBow = Math.abs(entry.x * lateRetreat.y - entry.y * lateRetreat.x) / Math.hypot(entry.x, entry.y);
			assert.ok(returnBow > away * 0.02, `${who} follows a visible arc back while fading`);
			const fadeEnd = touchdown + 0.2 + 1e-6;
			const faded = at(fadeEnd, key);
			assert.equal(faded.opacity, 0, `${who} is invisible within 200ms of release`);
			assert.ok(offCard(faded, slot, fadeEnd) > 0 && offCard(faded, slot, fadeEnd) < 0.4 * away, `${who} only moves a short distance while visible`);
		}
	}
});

/** The wall's cursors under a frame registry the test drives, as the overlay's clock does. */
const CURSORS_HARNESS = `
import { useMemo } from "react";
import { FinaleWallCursors } from "@/components/projects/jira-team-eu26-end/finale/components/finale-cursor";
import { FinaleFrameContext, createFinaleFrameRegistry } from "@/components/projects/jira-team-eu26-end/finale/hooks/use-finale-frame";

export default function Harness({ cursorsAt }) {
	const registry = useMemo(() => createFinaleFrameRegistry(), []);
	globalThis.__emitWallCursorsFrame = registry.emit;
	return <FinaleFrameContext value={registry}><FinaleWallCursors cursorsAt={cursorsAt} scale={1} /></FinaleFrameContext>;
}
`;

test("a lane that takes a card from someone else shows the new name at once, on a held clock too", async () => {
	const { FINALE_CURSORS } = load();
	const at = (lane, name) => ({ key: `${lane}:${name}`, lane, name, x: 400, y: 300, scale: 1, opacity: 1 });
	const script = new Map([
		[1, [at(0, "Andrea"), at(2, "Brian")]],
		[2, [at(0, "Charles")]],
		[3, []],
	]);
	const view = await renderComponent({ source: CURSORS_HARNESS, props: { cursorsAt: (time) => script.get(time) ?? [] } });
	const emit = (time) => React.act(async () => {
		globalThis.__emitWallCursorsFrame(time);
	});
	const lanes = () => [...view.container.querySelectorAll("[data-finale-cursor]")];
	const shown = () => lanes().filter((element) => element.style.visibility === "visible").map((element) => ({
		name: element.getAttribute("data-finale-cursor"),
		text: element.textContent,
		fill: element.querySelector("path").getAttribute("fill"),
	}));

	assert.equal(lanes().length, FINALE_CURSORS.length, "one cursor per lane");
	assert.deepEqual(shown(), [], "none before the first frame");
	await emit(1);
	assert.deepEqual(shown(), [
		{ name: "Andrea", text: "Andrea", fill: FINALE_CURSORS[0].color },
		{ name: "Brian", text: "Brian", fill: FINALE_CURSORS[2].color },
	]);
	await emit(2);
	assert.deepEqual(shown(), [{ name: "Charles", text: "Charles", fill: FINALE_CURSORS[0].color }], "lane 0 changes hands; lane 2 lets go");
	await emit(3);
	assert.deepEqual(shown(), [], "idle lanes hide");
	await emit(1);
	assert.deepEqual(shown().map((cursor) => cursor.name), ["Andrea", "Brian"], "scrubbing back brings the earlier holders back");
});
