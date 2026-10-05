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
export { FINALE_CURSORS } from "./finale-cursor-path";
export { WALL_PERIOD, buildFinaleWall, wallGeometry } from "./finale-wall-layout";
export { wallCursorsAt } from "./finale-wall-cursors";
export { wallTimeAt } from "./finale-wall-motion";
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
	const { buildFinaleWall, finaleBentoLayout, FINALE_FEATURES, wallGeometry } = load();
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = finaleBentoLayout(viewport, scale);
	return buildFinaleWall(wallGeometry(bento, scale, viewport), bento, FINALE_FEATURES, []);
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

test("each held card's cursor is the slot's own teammate on every pass, one per lane and nobody twice at once", () => {
	const { FINALE_CURSORS, FINALE_WALL_CURSOR_NAMES, WALL_CUE, WALL_PERIOD, wallCursorsAt, wallTimeAt } = load();
	const pool = new Set(FINALE_WALL_CURSOR_NAMES);
	const presenters = new Set(FINALE_CURSORS.map((cursor) => cursor.label));
	const viewport = { width: 1728, height: 1117 };
	const wall = wallFor(viewport);
	const { geometry } = wall;
	const seedOf = (key) => wall.column(Number(key.split(":")[0])).find((slot) => slot.key === key).seed;
	// Three periods of travel: at least two whole loops past the wall's run-up, so every slot comes round again.
	const end = wallTimeAt(3 * WALL_PERIOD * geometry.pitch, geometry);
	assert.ok(Number.isFinite(end) && end > WALL_CUE.start, "the wall glides");

	const byKey = new Map();
	const bySeed = new Map();
	const keysOfSeed = new Map();
	let held = 0;
	for (let time = WALL_CUE.start; time < end; time += 0.1) {
		const cursors = wallCursorsAt(time, wall, viewport);
		assert.equal(new Set(cursors.map((cursor) => cursor.lane)).size, cursors.length, "one card per lane at a time");
		assert.equal(new Set(cursors.map((cursor) => cursor.name)).size, cursors.length, "nobody in two places at once");
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
	assert.ok([...keysOfSeed.values()].some((keys) => keys.size > 1), "a slot is held again on a later pass");
	const names = new Set([...byKey.values()].map((who) => who.split("@")[0]));
	assert.ok(names.size >= FINALE_CURSORS.length, `many teammates over a loop (${[...names].join(", ")})`);
	assert.equal(new Set([...byKey.values()].map((who) => who.split("@")[1])).size, FINALE_CURSORS.length, "every lane is used");
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
