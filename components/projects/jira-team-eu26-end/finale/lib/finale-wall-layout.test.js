const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-layout";
export { packWallMasonry } from "./finale-wall-masonry";
export { wallPiecesLayout } from "./finale-wall-pieces";
export { slotDescent } from "./finale-wall-motion";
export { finaleStageFit } from "./finale-stage-fit";
export { FINALE_STORIES, finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
`;

let layoutModule;
function load() {
	layoutModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-layout-harness.cjs");
	return layoutModule;
}

const VIEWPORTS = [{ width: 1728, height: 1117 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }, { width: 2560, height: 1440 }];
const close = (a, b) => Math.abs(a - b) < 1e-6;
const overlaps = (a, b, gap = 0) => a.x < b.x + b.width + gap - 1e-6 && a.x + a.width + gap > b.x + 1e-6 && a.y < b.y + b.height + gap - 1e-6 && a.y + a.height + gap > b.y + 1e-6;
function sceneFor(viewport, dragOrder = []) {
	const m = load();
	const { scale } = m.finaleStageFit(viewport.width, viewport.height);
	const bento = m.finaleBentoLayout(viewport, scale);
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, m.FINALE_FEATURES, dragOrder);
	return { m, bento, geometry, wall };
}

test("the mega bento contains no standalone presenter portraits or facepiles", () => {
	const { wall } = sceneFor(VIEWPORTS[1]);
	assert.equal(wall.items.some((slot) => slot.content.kind === "shape"), false);
	assert.equal(wall.items.some((slot) => slot.content.kind === "strip" && slot.content.strip === "presenters"), false);
});

test("masonry packs actual widths and heights on occupied edges, without column snapping", () => {
	assert.deepEqual(load().packWallMasonry([{ key: "a", width: 100, height: 80 }, { key: "b", width: 60, height: 30 }, { key: "c", width: 140, height: 30 }], [], 120, 10), [
		{ x: 10, y: 10, width: 100, height: 80 },
		{ x: 120, y: 10, width: 60, height: 30 },
		{ x: 120, y: 50, width: 140, height: 30 },
	]);
});

test("separated accents pack beyond the current edge while product items fill the space between", () => {
	assert.deepEqual(load().packWallMasonry([{ key: "a", width: 100, height: 30, group: "chapter" }, { key: "b", width: 100, height: 30, group: "chapter" }, { key: "ui", width: 100, height: 30 }], [], 100, 10, 10, 300), [
		{ x: 10, y: 10, width: 100, height: 30 },
		{ x: 310, y: 10, width: 100, height: 30 },
		{ x: 10, y: 50, width: 100, height: 30 },
	]);
});

test("an explicit composition keeps its instance scales and repeated pieces", () => {
	const pieces = [{ key: "first", id: "codeCard", scale: 1.408 }, { key: "second", id: "codeCard", scale: 0.7 }];
	assert.deepEqual(load().resolveWallStagePieces({ composition: { pieces }, board: { cells: { a: { options: { density: "dense" } } } } }), pieces);
});

test("masonry honors horizontal and vertical gaps independently", () => {
	assert.deepEqual(load().packWallMasonry([{ key: "a", width: 100, height: 40 }, { key: "b", width: 100, height: 40 }, { key: "c", width: 50, height: 80 }], [], 140, 10, 20), [
		{ x: 10, y: 20, width: 100, height: 40 },
		{ x: 10, y: 80, width: 100, height: 40 },
		{ x: 120, y: 20, width: 50, height: 80 },
	]);
});

test("every wall container, including custom coloured tiles, has a fixed 20px radius on every viewport", () => {
	for (const viewport of VIEWPORTS) {
		const { m, wall, geometry } = sceneFor(viewport);
		const tiles = wall.items.filter((slot) => slot.content.kind !== "print");
		assert.ok(tiles.length > 0);
		for (const slot of tiles) assert.equal(m.wallSlotRadius(slot, geometry), 20, slot.key);
	}
});

test("no items overlap, including the repeat seam, and the wall retains its vertical margins", () => {
	for (const viewport of VIEWPORTS) {
		const { geometry, wall } = sceneFor(viewport);
		const next = Array.from({ length: wall.periodBuckets }, (_, index) => wall.bucket(index + wall.periodBuckets)).flat();
		const items = [...wall.items, ...next];
		for (let a = 0; a < items.length; a += 1) {
			const rect = items[a].rect;
			// A lanyard tile hangs from the top edge (its strap is cut straight there); every other card keeps the margins.
			const top = items[a].content.kind === "lanyard" ? -geometry.radius : geometry.gutter;
			assert.ok(rect.y >= top - 1e-6 && rect.y + rect.height <= viewport.height - geometry.gutter + 1e-6, items[a].key);
			for (let b = a + 1; b < items.length; b += 1) assert.equal(overlaps(rect, items[b].rect, geometry.gutter), false, `${items[a].key} and ${items[b].key}`);
		}
	}
});

test("seven keynote landing spaces retain their centres and the six story tiles retain their aspects", () => {
	for (const viewport of VIEWPORTS) {
		const { m, bento, wall } = sceneFor(viewport);
		assert.deepEqual(wall.gaps.map((gap) => gap.order), [0, 1, 2, 3, 4, 5, 6]);
		const from = [...bento.slots.map((slot) => slot.rect), bento.title];
		for (const { order, slot } of wall.gaps) {
			if (order !== m.WALL_TITLE_ORDER) assert.ok(close(slot.rect.width / slot.rect.height, from[order].width / from[order].height));
			const carryOffset = order === m.WALL_TITLE_ORDER ? viewport.width * 0.12 : 0;
			assert.ok(close(slot.rect.x + slot.rect.width / 2, from[order].x + from[order].width / 2 - carryOffset));
			assert.ok(close(slot.rect.y + slot.rect.height / 2, from[order].y + from[order].height / 2));
			assert.equal(slot.reserved, order);
		}
		assert.equal(wall.items.filter((slot) => slot.reserved !== undefined).length, 7);
		assert.equal(m.WALL_TITLE_ORDER, 6);
	}
});

test("spatial buckets only index the natural rectangles, and copies repeat exactly but for the lanyards' run", () => {
	const { m, wall } = sceneFor(VIEWPORTS[0]);
	assert.deepEqual(sceneFor(VIEWPORTS[0]).wall.items, wall.items, "deterministic packing");
	assert.ok(wall.items.some((slot) => !close(slot.rect.x, slot.bucket * wall.geometry.bucketWidth)), "buckets never impose a left edge");
	for (let index = -2; index < wall.periodBuckets + 2; index += 1) {
		const items = wall.bucket(index);
		const next = wall.bucket(index + wall.periodBuckets);
		assert.equal(items.length, next.length);
		items.forEach((slot, item) => {
			// A lanyard is the one card each pass deals anew: the next copy carries its run on by a period's worth.
			const content = slot.content.kind === "lanyard" ? { ...slot.content, order: slot.content.order + m.WALL_LANYARDS.count } : slot.content;
			assert.deepEqual(next[item].content, content);
			assert.ok(close(next[item].rect.x - slot.rect.x, wall.periodWidth));
			assert.equal(next[item].rect.y, slot.rect.y);
			assert.equal(next[item].seed, slot.seed);
		});
	}
});
