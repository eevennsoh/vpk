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

const { readFileSync } = require("node:fs");
const KIT = JSON.parse(readFileSync("public/1p/rovo-stage-kit/pieces.json", "utf8"));
const STAGE = JSON.parse(readFileSync("public/1p/rovo-stage-kit/rovo-stage.json", "utf8"));
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

test("masonry packs actual widths and heights on occupied edges, without column snapping", () => {
	assert.deepEqual(load().packWallMasonry([{ key: "a", width: 100, height: 80 }, { key: "b", width: 60, height: 30 }, { key: "c", width: 140, height: 30 }], [], 120, 10), [
		{ x: 10, y: 10, width: 100, height: 80 },
		{ x: 120, y: 10, width: 60, height: 30 },
		{ x: 120, y: 50, width: 140, height: 30 },
	]);
});

test("every grey container has a fixed 20px radius on every viewport", () => {
	for (const viewport of VIEWPORTS) {
		const { m, wall, geometry } = sceneFor(viewport);
		const grey = wall.items.filter((slot) => ["story", "piece", "shape", "stat", "strip"].includes(slot.content.kind));
		assert.ok(grey.length > 0);
		for (const slot of grey) assert.equal(m.wallSlotRadius(slot, geometry), 20, slot.key);
	}
});

test("every exported instance keeps its library dimensions and JSON scale under one camera scale", () => {
	for (const viewport of VIEWPORTS) {
		const { geometry, wall } = sceneFor(viewport);
		for (const placed of STAGE.composition.pieces) {
			const slot = wall.items.find((item) => item.key.endsWith(`:${placed.key}`));
			const piece = KIT.find((item) => item.id === placed.id);
			assert.ok(slot, `${placed.key} is present`);
			assert.equal(slot.content.pieces[0].scale, placed.scale);
			assert.ok(close(slot.rect.width, (piece.w * placed.scale + 80) * geometry.pieceScale), `${placed.key}: natural width and shadow room`);
			assert.ok(close(slot.rect.height, (piece.h * placed.scale + 80) * geometry.pieceScale), `${placed.key}: natural height and shadow room`);
		}
		const widths = new Set(wall.items.filter((item) => item.content.kind === "piece").map((item) => item.rect.width.toFixed(3)));
		assert.ok(widths.size > 25, "pieces have many distinct widths, rather than one-column and two-column sizes");
	}
});

test("no items overlap, including the repeat seam, and the wall retains its vertical margins", () => {
	for (const viewport of VIEWPORTS) {
		const { geometry, wall } = sceneFor(viewport);
		const next = Array.from({ length: wall.periodBuckets }, (_, index) => wall.bucket(index + wall.periodBuckets)).flat();
		const items = [...wall.items, ...next];
		for (let a = 0; a < items.length; a += 1) {
			const rect = items[a].rect;
			assert.ok(rect.y >= geometry.gutter - 1e-6 && rect.y + rect.height <= viewport.height - geometry.gutter + 1e-6);
			for (let b = a + 1; b < items.length; b += 1) assert.equal(overlaps(rect, items[b].rect, geometry.gutter), false, `${items[a].key} and ${items[b].key}`);
		}
	}
});

test("seven keynote landing spaces retain each card's aspect and centre before the wall moves", () => {
	for (const viewport of VIEWPORTS) {
		const { m, bento, wall } = sceneFor(viewport);
		assert.deepEqual(wall.gaps.map((gap) => gap.order), [0, 1, 2, 3, 4, 5, 6]);
		const from = [...bento.slots.map((slot) => slot.rect), bento.title];
		for (const { order, slot } of wall.gaps) {
			assert.ok(close(slot.rect.width / slot.rect.height, from[order].width / from[order].height));
			const carryOffset = order === m.WALL_TITLE_ORDER ? viewport.width * 0.12 : 0;
			assert.ok(close(slot.rect.x + slot.rect.width / 2, from[order].x + from[order].width / 2 - carryOffset));
			assert.ok(close(slot.rect.y + slot.rect.height / 2, from[order].y + from[order].height / 2));
			assert.equal(slot.reserved, order);
		}
		assert.equal(wall.items.filter((slot) => slot.reserved !== undefined).length, 7);
		assert.equal(m.WALL_TITLE_ORDER, 6);
	}
});

test("every story is dealt once, as a featured tile or a print, and drag order survives", () => {
	const dragged = ["TEU-7", "TEU-4", "TEU-12", "TEU-1", "TEU-9", "TEU-3", "TEU-13"];
	const { m, wall } = sceneFor(VIEWPORTS[1], dragged);
	const featured = new Set(m.FINALE_FEATURES.map((story) => story.code));
	const codes = wall.items.flatMap((slot) => slot.content.kind === "print" ? slot.content.codes : slot.content.kind === "story" ? [slot.content.story.code] : []);
	assert.deepEqual(codes.sort(), m.FINALE_STORIES.map((story) => story.code).sort());
	assert.equal(wall.items.filter((slot) => slot.content.kind === "title").length, 1);
	const printed = wall.items.filter((slot) => slot.content.kind === "print").sort((a, b) => Number(a.key.split("print-")[1]) - Number(b.key.split("print-")[1])).flatMap((slot) => slot.content.codes);
	const expected = dragged.filter((code) => !featured.has(code));
	assert.deepEqual(printed.slice(0, expected.length), expected);
});

test("spatial buckets only index the natural rectangles, and copies repeat exactly", () => {
	const { wall } = sceneFor(VIEWPORTS[0]);
	assert.deepEqual(sceneFor(VIEWPORTS[0]).wall.items, wall.items, "deterministic packing");
	assert.ok(wall.items.some((slot) => !close(slot.rect.x, slot.bucket * wall.geometry.bucketWidth)), "buckets never impose a left edge");
	for (let index = -2; index < wall.periodBuckets + 2; index += 1) {
		const items = wall.bucket(index);
		const next = wall.bucket(index + wall.periodBuckets);
		assert.equal(items.length, next.length);
		items.forEach((slot, item) => {
			assert.deepEqual(next[item].content, slot.content);
			assert.ok(close(next[item].rect.x - slot.rect.x, wall.periodWidth));
			assert.equal(next[item].rect.y, slot.rect.y);
			assert.equal(next[item].seed, slot.seed);
		});
	}
});
