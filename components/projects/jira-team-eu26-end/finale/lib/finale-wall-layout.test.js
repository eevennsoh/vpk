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

test("every remaining work item has its own print slot instead of a bulk-drag stack", () => {
	for (const viewport of VIEWPORTS) {
		const { m, wall } = sceneFor(viewport);
		const prints = wall.items.filter((slot) => slot.content.kind === "print");
		assert.equal(prints.length, m.FINALE_STORIES.length - m.FINALE_FEATURES.length);
		for (const slot of prints) assert.equal(slot.content.codes.length, 1, `${slot.key} holds one work item`);
	}
});

test("the wall has three varied chapter word tiles separated by product content", () => {
	for (const viewport of VIEWPORTS) {
		const { wall, geometry } = sceneFor(viewport);
		const posters = wall.items.filter((slot) => slot.content.kind === "poster");
		assert.deepEqual(posters.map((slot) => slot.content.word).sort(), ["Collaboration", "Confidence", "Context"]);
		const sizes = { Context: [300, 160], Collaboration: [360, 200], Confidence: [280, 220] };
		const scale = geometry.typeScale / 0.3;
		for (const slot of posters) {
			const [width, height] = sizes[slot.content.word];
			assert.ok(close(slot.rect.width, width * scale));
			assert.ok(close(slot.rect.height, height * scale));
			for (const other of posters.filter((other) => other !== slot)) {
				assert.ok(Math.abs(slot.rect.x + slot.rect.width / 2 - other.rect.x - other.rect.width / 2) >= 900 * scale - 1e-6, "chapter blocks are spread along the wall");
			}
		}
	}
});

test("three 3:4 lanyard tiles hang from the top edge through every period, evenly spaced, never two in frame at once", () => {
	for (const viewport of VIEWPORTS) {
		const { m, wall, geometry } = sceneFor(viewport);
		const lanyards = wall.items.filter((slot) => slot.content.kind === "lanyard").sort((a, b) => a.rect.x - b.rect.x);
		assert.equal(lanyards.length, m.WALL_LANYARDS.count);
		const scale = geometry.typeScale / 0.3;
		// The first hangs just past the opening frame, clear of the keynote gaps, so it glides in.
		assert.ok(lanyards[0].rect.x >= viewport.width, `${viewport.width}: first lanyard at ${lanyards[0].rect.x}`);
		for (const slot of lanyards) {
			// Its top corners sit just above the frame, so the strap's straight cut is the frame's own edge.
			assert.equal(slot.rect.y, -geometry.radius, slot.key);
			assert.ok(close(slot.rect.width, m.WALL_LANYARDS.width * scale), slot.key);
			assert.ok(close(slot.rect.height, m.WALL_LANYARDS.height * scale), slot.key);
			assert.ok(close(slot.rect.width / slot.rect.height, 3 / 4), slot.key);
		}
		// Neighbours (round the seam too) never share the frame, and no stretch of the loop goes much longer than its share without one.
		const centres = lanyards.map((slot) => slot.rect.x + slot.rect.width / 2);
		const spacings = centres.map((centre, index) => (index === 0 ? centre + wall.periodWidth - centres.at(-1) : centre - centres[index - 1]));
		for (const spacing of spacings) {
			assert.ok(spacing >= viewport.width + lanyards[0].rect.width, `${viewport.width}: lanyards ${Math.round(spacing)}px apart`);
			assert.ok(spacing <= (wall.periodWidth / lanyards.length) * 1.2, `${viewport.width}: a ${Math.round(spacing)}px stretch without a lanyard`);
		}
	}
});

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

test("an automatic stage resolves enabled library pieces at the authored density", () => {
	const m = load();
	const stage = { composition: null, board: { cells: { a: { options: { density: "balanced", showApps: true, showMosaic: false, showConfidence: false } } } } };
	const pieces = m.resolveWallStagePieces(stage);
	assert.equal(pieces.length, KIT.filter((piece) => !["mosaic", "confidence"].includes(piece.group)).length);
	assert.equal(pieces.some((piece) => piece.id.startsWith("stamp")), false);
	assert.equal(pieces.some((piece) => piece.id === "agentIdentities"), false);
	assert.ok(close(pieces.find((piece) => piece.id === "codeCard").scale, 1.408));
	assert.equal(new Set(pieces.map((piece) => piece.key)).size, pieces.length);
});

test("automatic stages honor density changes and the kit's app visibility default", () => {
	const stage = (density) => ({ composition: null, board: { cells: { a: { options: { density } } } } });
	assert.equal(load().resolveWallStagePieces(stage("gallery")).find((piece) => piece.id === "codeCard").scale, 1.6);
	assert.ok(close(load().resolveWallStagePieces(stage("dense")).find((piece) => piece.id === "codeCard").scale, 1.216));
	assert.equal(load().resolveWallStagePieces(stage("balanced")).some((piece) => piece.id === "appJira"), false);
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

test("all 91 enabled pieces keep their library dimensions and balanced scale under one camera scale", () => {
	for (const viewport of VIEWPORTS) {
		const { geometry, wall } = sceneFor(viewport);
		const library = wall.items.filter((item) => item.content.kind === "piece");
		assert.equal(library.length, 91);
		assert.equal(library.filter((slot) => slot.content.pieces[0].id.startsWith("stamp")).length, 14);
		assert.ok(close(geometry.gutter, 28 * geometry.typeScale / 0.3));
		assert.equal(geometry.gutterY, geometry.gutter);
		for (const piece of KIT) {
			const slot = library.find((item) => item.content.pieces[0].id === piece.id);
			assert.ok(slot, `${piece.id} is present`);
			assert.ok(close(slot.content.pieces[0].scale, piece.scale * 0.88));
			assert.ok(close(slot.rect.width, (piece.w * piece.scale * 0.88 + 80) * geometry.pieceScale), `${piece.id}: natural width and shadow room`);
			assert.ok(close(slot.rect.height, (piece.h * piece.scale * 0.88 + 80) * geometry.pieceScale), `${piece.id}: natural height and shadow room`);
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
			// A lanyard tile hangs from the top edge (its strap is cut straight there); every other card keeps the margins.
			const top = items[a].content.kind === "lanyard" ? -geometry.radius : geometry.gutter;
			assert.ok(rect.y >= top - 1e-6 && rect.y + rect.height <= viewport.height - geometry.gutter + 1e-6, items[a].key);
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
