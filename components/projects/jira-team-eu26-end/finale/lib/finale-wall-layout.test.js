const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-layout";
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

const VIEWPORTS = [
	{ width: 1728, height: 1117 },
	{ width: 1920, height: 1080 },
	{ width: 1024, height: 768 },
	{ width: 2560, height: 1440 },
];

/** Rehearsal (nothing dragged), and two keynote runs, one dragging Rovo Artifacts early. */
const DRAG_ORDERS = [[], ["TEU-7", "TEU-4", "TEU-12", "TEU-1", "TEU-9", "TEU-3", "TEU-13"], ["TEU-13", "TEU-11", "TEU-2", "TEU-8", "TEU-5", "TEU-106", "TEU-10"]];

function sceneFor(viewport, dragOrder = []) {
	const m = load();
	const { scale } = m.finaleStageFit(viewport.width, viewport.height);
	const bento = m.finaleBentoLayout(viewport, scale);
	const features = m.FINALE_FEATURES;
	const geometry = m.wallGeometry(bento, scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, features, dragOrder);
	return { m, bento, features, geometry, wall };
}

const EPSILON = 1e-6;
const label = (viewport) => `${viewport.width}×${viewport.height}`;
const onScreen = (rect, geometry) => ({ ...rect, x: rect.x + geometry.originX });
const centre = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const overlaps = (p, q) => p.x < q.x + q.width - EPSILON && q.x < p.x + p.width - EPSILON && p.y < q.y + q.height - EPSILON && q.y < p.y + p.height - EPSILON;

function copyZero(wall, m) {
	return Array.from({ length: m.WALL_PERIOD }, (_, column) => wall.column(column)).flat();
}

test("every band pattern fills exactly one band, and only wide cells cover their neighbour", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry } = sceneFor(viewport);
		for (const height of Object.values(geometry.heights)) assert.ok(height > 0, `a ${label(viewport)} wall has no empty heights`);
		for (const cell of m.wallPeriodCells()) {
			const filled = cell.heights.reduce((sum, height) => sum + geometry.heights[height], 0) + geometry.gutter * (cell.heights.length - 1);
			assert.ok(Math.abs(filled - geometry.bandHeight) < EPSILON, `column ${cell.column} row ${cell.row} fills its band at ${label(viewport)}`);
			assert.equal(cell.kinds.length, cell.heights.length, "one token per height");
		}
	}
	const m = load();
	const cells = new Map(m.wallPeriodCells().map((cell) => [`${cell.column}:${cell.row}`, cell]));
	for (const { column, row, covered } of m.wallPeriodCovers()) {
		const left = cells.get(`${(column + m.WALL_PERIOD - 1) % m.WALL_PERIOD}:${row}`);
		assert.equal(covered, Boolean(left?.wide), `column ${column} row ${row} is covered only by a wide cell on its left`);
	}
});

test("no two slots overlap, and each stays in its column (a wide one in the next as well)", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall } = sceneFor(viewport);
		const slots = Array.from({ length: m.WALL_PERIOD + 4 }, (_, index) => wall.column(index - 2)).flat();
		assert.equal(new Set(slots.map((slot) => slot.key)).size, slots.length, "unique keys");
		for (let a = 0; a < slots.length; a += 1) {
			for (let b = a + 1; b < slots.length; b += 1) assert.ok(!overlaps(slots[a].rect, slots[b].rect), `${slots[a].key} and ${slots[b].key} at ${label(viewport)}`);
		}
		for (const slot of slots) {
			const left = slot.column * geometry.pitch;
			assert.ok(Math.abs(slot.rect.x - left) < EPSILON, `${slot.key} starts at its column`);
			const span = slot.rect.width > geometry.columnWidth + EPSILON ? 2 : 1;
			assert.ok(Math.abs(slot.rect.width - (span * geometry.columnWidth + (span - 1) * geometry.gutter)) < EPSILON, `${slot.key} is one column or two`);
		}
	}
});

test("the wall breathes: wide gutters, three whole bands with a margin above and below, and empty slots", () => {
	for (const viewport of VIEWPORTS) {
		const { geometry, wall } = sceneFor(viewport);
		assert.ok(geometry.gutter >= geometry.columnWidth * 0.15, `gutters at least ~a sixth of a column at ${label(viewport)}`);
		assert.deepEqual(wall.bands, [-1, 0, 1], `three bands at ${label(viewport)}`);
		const top = geometry.bandTop + wall.bands[0] * geometry.bandPitch;
		const bottom = geometry.bandTop + wall.bands.at(-1) * geometry.bandPitch + geometry.bandHeight;
		assert.ok(top >= geometry.gutter / 2 && viewport.height - bottom >= geometry.gutter / 2, `a clear margin above and below at ${label(viewport)}`);
		assert.ok(Math.abs(top - (viewport.height - bottom)) < EPSILON, "centred");
	}
	const m = load();
	const tokens = m.wallPeriodCells().flatMap((cell) => cell.kinds.map((kind, item) => ({ kind, height: cell.heights[item] })));
	const air = tokens.filter((token) => token.kind === "air");
	assert.ok(air.filter((token) => token.height !== "strip").length >= 4, "a few whole slots of air a period");
	// A strip is a sliver at these gutters: it is always air, and the strip tiles sit in title-sized boxes.
	assert.ok(tokens.filter((token) => token.height === "strip").every((token) => token.kind === "air"));
	const { wall } = sceneFor(VIEWPORTS[1]);
	assert.ok(copyZero(wall, m).every((slot) => slot.height !== "strip"));
});

/** Where each bento card starts: its six tiles in landing order, then its title. */
function bentoCards(m, bento) {
	return [...bento.slots.map((slot) => ({ rect: slot.rect, short: slot.short })), { rect: bento.title, short: true }];
}

test("seven gaps, one per bento card and of its shape, scattered over the opening frame, all on the wall as it appears", () => {
	const m = load();
	assert.equal(m.WALL_TITLE_ORDER, 6, "the title is one past the six tiles");
	const tokens = m.wallPeriodCells().flatMap((cell) => cell.kinds.map((kind, item) => ({ kind, height: cell.heights[item] })));
	const authored = tokens.filter((token) => token.kind === "gap");
	assert.equal(authored.length, 7, "exactly seven gaps a period");
	assert.deepEqual(authored.map((token) => token.height).sort(), ["short", "short", "short", "tall", "tall", "tall", "tall"]);
	for (const viewport of VIEWPORTS) {
		for (const dragOrder of DRAG_ORDERS) {
			const { bento, features, geometry, wall } = sceneFor(viewport, dragOrder);
			const at = label(viewport);
			const cards = bentoCards(m, bento);
			assert.deepEqual(wall.gaps.map((gap) => gap.order), [0, 1, 2, 3, 4, 5, 6], `a gap per card, tiles in landing order then the title, at ${at}`);
			assert.deepEqual(wall.gaps.map((gap) => gap.kind), ["tile", "tile", "tile", "tile", "tile", "tile", "title"]);
			assert.equal(new Set(wall.gaps.map((gap) => gap.slot.key)).size, 7, "distinct gaps");
			const reserved = copyZero(wall, m).filter((slot) => slot.reserved !== undefined);
			assert.deepEqual(reserved.map((slot) => slot.key).sort(), wall.gaps.map((gap) => gap.slot.key).sort(), "only the gaps wait, and only in the first copy");
			for (const gap of wall.gaps) {
				const card = cards[gap.order];
				assert.equal(gap.slot.height, card.short ? "short" : "tall", `card ${gap.order} is thrown into a gap of its own shape`);
				assert.equal(gap.slot.reserved, gap.order);
				const shows = (slot) => (slot.content.kind === "title" ? "title" : slot.content.story.code);
				const expected = gap.kind === "title" ? "title" : features[gap.order].code;
				assert.equal(shows(gap.slot), expected, `gap ${gap.order} holds its card`);
				for (const copy of [-1, 1, 2]) {
					const twin = wall.column(gap.slot.column + copy * m.WALL_PERIOD).find((slot) => slot.band === gap.slot.band && slot.rect.y === gap.slot.rect.y);
					assert.ok(twin && twin.reserved === undefined, "later copies are already filled");
					assert.equal(shows(twin), expected, "with the same card");
				}
				// In the frame as the wall appears (offset 0), clear of every edge by a gutter…
				const rect = onScreen(gap.slot.rect, geometry);
				const margin = geometry.gutter;
				assert.ok(rect.x >= margin && rect.y >= margin && rect.x + rect.width <= viewport.width - margin && rect.y + rect.height <= viewport.height - margin, `gap ${gap.order} is in the frame at ${at}`);
				// …and on the wall already, not one of the leading edge's cards in the air.
				assert.ok(rect.x + rect.width / 2 <= viewport.width - geometry.pitch * 1.2, `gap ${gap.order} is clear of the leading edge at ${at}`);
				assert.equal(m.slotDescent(gap.slot, wall), null, `gap ${gap.order} is not an arrival at ${at}`);
				// Near its card: on its side of the frame and in its part of it, or in the middle with it.
				const from = centre(card.rect);
				const to = centre(rect);
				const near = (axis, size) => {
					if (Math.abs(from[axis] - size / 2) > size / 6) assert.equal(Math.sign(to[axis] - size / 2), Math.sign(from[axis] - size / 2), `gap ${gap.order} on its card's side (${axis}) at ${at}`);
					else assert.ok(Math.abs(to[axis] - size / 2) < size / 4, `gap ${gap.order} near the middle (${axis}) at ${at}`);
				};
				near("x", viewport.width);
				near("y", viewport.height);
			}
			const columns = new Set(wall.gaps.map((gap) => gap.slot.column));
			const bands = new Set(wall.gaps.map((gap) => gap.slot.band));
			assert.ok(columns.size >= 6 && bands.size === 3, `spread out, not a cluster, at ${at}`);
		}
	}
});

test("the cards take the gaps that, together, mean the least travel", () => {
	for (const viewport of VIEWPORTS) {
		const { m, bento, geometry, wall } = sceneFor(viewport);
		const cards = bentoCards(m, bento);
		const travel = (order, gap) => {
			const from = centre(cards[order].rect);
			const to = centre(onScreen(gap.slot.rect, geometry));
			return Math.hypot(to.x - from.x, to.y - from.y);
		};
		const total = wall.gaps.reduce((sum, gap) => sum + travel(gap.order, gap), 0);
		// Swapping any two same-shape cards' gaps only adds travel.
		for (const a of wall.gaps) {
			for (const b of wall.gaps) {
				if (a.order >= b.order || a.slot.height !== b.slot.height) continue;
				const swapped = total - travel(a.order, a) - travel(b.order, b) + travel(a.order, b) + travel(b.order, a);
				assert.ok(swapped >= total - EPSILON, `cards ${a.order} and ${b.order} at ${label(viewport)}`);
			}
		}
	}
});

test("the wall appears with the period's first column at the left edge and the next cards waiting at the right", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall } = sceneFor(viewport);
		const at = label(viewport);
		assert.ok(Math.abs(geometry.originX) < geometry.columnWidth, `column 0 within a column of the left edge at ${at}`);
		for (let column = -2; column < m.WALL_FRAME_COLUMNS - 1; column += 1) {
			for (const slot of wall.column(column)) assert.equal(m.slotDescent(slot, wall), null, `${slot.key} is on the wall as it appears at ${at}`);
		}
		const leading = wall.column(m.WALL_FRAME_COLUMNS);
		const lead = onScreen(leading[0].rect, geometry).x;
		assert.ok(lead > viewport.width - geometry.columnWidth && lead < viewport.width, `the leading column just reaches into the frame at ${at}`);
		for (const slot of leading) assert.ok(m.slotDescent(slot, wall), `${slot.key} waits in the air at ${at}`);
	}
});

test("each story shows once a period and in one form, the title too, and a benefit sits well away from its story's tile", () => {
	for (const viewport of VIEWPORTS) {
		for (const dragOrder of DRAG_ORDERS) {
			const { m, features, wall } = sceneFor(viewport, dragOrder);
			const slots = copyZero(wall, m);
			const featured = new Set(features.map((story) => story.code));
			const count = (kind) => {
				const seen = new Map();
				for (const slot of slots) {
					const codes = slot.content.kind === kind ? (kind === "print" ? slot.content.codes : [slot.content.story.code]) : [];
					for (const code of codes) seen.set(code, (seen.get(code) ?? 0) + 1);
				}
				return seen;
			};
			assert.equal(slots.filter((slot) => slot.content.kind === "title").length, 1, "the title once a period");
			const stories = count("story");
			const benefits = count("benefit");
			const prints = count("print");
			for (const story of m.FINALE_STORIES) {
				const code = story.code;
				if (featured.has(code)) {
					assert.equal(stories.get(code), 1, `${code}'s tile once`);
					assert.equal(benefits.get(code), 1, `${code}'s benefit once`);
					assert.equal(prints.get(code), undefined, `${code} is never a print`);
				} else {
					assert.equal(prints.get(code), 1, `${code} printed once at ${label(viewport)}`);
					assert.equal(stories.get(code) ?? benefits.get(code), undefined, `${code} only as its print`);
				}
			}
			const gapColumn = new Map(wall.gaps.filter((gap) => gap.kind === "tile").map((gap) => [features[gap.order].code, gap.slot.column]));
			for (const slot of slots) {
				if (slot.content.kind !== "benefit") continue;
				const apart = Math.abs(slot.column - gapColumn.get(slot.content.story.code));
				assert.ok(Math.min(apart, m.WALL_PERIOD - apart) >= 3, `${slot.content.story.code}'s benefit is well away from its tile`);
			}
			// Prints follow the order the cards reached Done.
			const dealt = slots.filter((slot) => slot.content.kind === "print").sort((a, b) => a.column - b.column || a.band - b.band || a.rect.y - b.rect.y).flatMap((slot) => slot.content.codes);
			const expected = dragOrder.filter((code) => !featured.has(code));
			assert.deepEqual(dealt.slice(0, expected.length), expected, "dragged cards first, in their order");
		}
	}
});

test("the wall loops: every copy holds the same cards at the same heights, and the same wall builds every time", () => {
	const viewport = VIEWPORTS[0];
	const { m, wall } = sceneFor(viewport);
	const again = sceneFor(viewport).wall;
	const shift = wall.geometry.pitch * m.WALL_PERIOD;
	for (let column = -3; column < m.WALL_PERIOD + 3; column += 1) {
		const slots = wall.column(column);
		const next = wall.column(column + m.WALL_PERIOD);
		assert.equal(next.length, slots.length);
		slots.forEach((slot, index) => {
			assert.deepEqual(next[index].content, slot.content, "the same card");
			assert.equal(next[index].seed, slot.seed, "moving alike");
			assert.ok(Math.abs(next[index].rect.x - slot.rect.x - shift) < EPSILON && next[index].rect.y === slot.rect.y, "one period on");
		});
		assert.deepEqual(again.column(column), slots, "deterministic");
	}
	assert.deepEqual(again.gaps.map((gap) => gap.slot.key), wall.gaps.map((gap) => gap.slot.key));
});
