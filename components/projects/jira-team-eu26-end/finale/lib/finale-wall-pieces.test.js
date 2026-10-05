const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-pieces";
export { buildFinaleWall, wallGeometry, WALL_PERIOD } from "./finale-wall-layout";
export { slotDescent, slotOnScreen, wallOffset, wallRevealAt, wallSlotRevealTime } from "./finale-wall-motion";
export { finaleStageFit } from "./finale-stage-fit";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
export { JIRA_TEAM_EU26_END_PRESENTERS } from "../../data/keynote-presenters";
`;

let piecesModule;
function load() {
	piecesModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-pieces-harness.cjs");
	return piecesModule;
}

const PUBLIC = path.join(process.cwd(), "public");
/** The vendored kit's own catalogue: every piece it draws, with its box. */
const KIT_PIECES = JSON.parse(readFileSync(path.join(PUBLIC, "1p/rovo-stage-kit/pieces.json"), "utf8"));
const kitPiece = (id) => KIT_PIECES.find((piece) => piece.id === id);

const VIEWPORTS = [
	{ width: 1728, height: 1117 },
	{ width: 1920, height: 1080 },
	{ width: 1024, height: 768 },
	{ width: 2560, height: 1440 },
];
const EPSILON = 1e-6;

function wallFor(viewport) {
	const m = load();
	const { scale } = m.finaleStageFit(viewport.width, viewport.height);
	const bento = m.finaleBentoLayout(viewport, scale);
	const geometry = m.wallGeometry(bento, scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, m.FINALE_FEATURES, []);
	const slots = Array.from({ length: m.WALL_PERIOD }, (_, column) => wall.column(column)).flat();
	return { m, geometry, wall, slots };
}

test("every product tile on the wall is a piece the vendored kit draws, and none of the placeholder tiles is left", () => {
	const { m, slots } = wallFor(VIEWPORTS[0]);
	const kinds = new Set(slots.map((slot) => slot.content.kind));
	for (const placeholder of ["terminal", "agent", "composer"]) assert.ok(!kinds.has(placeholder), `no ${placeholder} placeholder`);
	const pieceSlots = slots.filter((slot) => slot.content.kind === "piece");
	assert.ok(pieceSlots.length >= 20, "the products on show are the kit's pieces");
	for (const slot of pieceSlots) {
		assert.ok(slot.content.pieces.length > 0, `${slot.key} shows at least one piece`);
		for (const id of slot.content.pieces) assert.ok(kitPiece(id), `${id} is a piece the kit draws`);
	}
	// What stays is the keynote's own: presenters in the identity's shapes, its stats and strips.
	for (const slot of slots) {
		if (slot.content.kind === "shape") assert.ok(m.JIRA_TEAM_EU26_END_PRESENTERS[slot.content.portrait], `${slot.key} is a presenter's portrait`);
		if (slot.content.kind === "stat") assert.ok(["presenters", "chapters"].includes(slot.content.stat));
		if (slot.content.kind === "strip") assert.ok(["presenters", "flow"].includes(slot.content.strip));
	}
});

test("a tile's pieces fit inside it with room round them, all at one scale, in a centred row, never stretched", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, slots } = wallFor(viewport);
		const inset = 40 * geometry.typeScale;
		for (const slot of slots) {
			if (slot.content.kind !== "piece") continue;
			const pieces = slot.content.pieces.map(kitPiece);
			const boxes = m.fitWallPieces(slot.rect, pieces, geometry.typeScale);
			const label = `${slot.key} at ${viewport.width}×${viewport.height}`;
			assert.equal(boxes.length, pieces.length);
			assert.ok(boxes.every((box) => box.scale > 0 && Math.abs(box.scale - boxes[0].scale) < EPSILON), `${label}: one scale`);
			boxes.forEach((box, index) => {
				assert.ok(Math.abs(box.width - pieces[index].w * box.scale) < EPSILON && Math.abs(box.height - pieces[index].h * box.scale) < EPSILON, `${label}: the kit's own box, times its scale`);
				assert.ok(box.x >= inset - EPSILON && box.y >= inset - EPSILON, `${label}: room left and above`);
				assert.ok(box.x + box.width <= slot.rect.width - inset + EPSILON && box.y + box.height <= slot.rect.height - inset + EPSILON, `${label}: room right and below`);
				if (index > 0) assert.ok(box.x >= boxes[index - 1].x + boxes[index - 1].width - EPSILON, `${label}: side by side, never overlapping`);
			});
			const last = boxes.at(-1);
			assert.ok(Math.abs(boxes[0].x - (slot.rect.width - last.x - last.width)) < EPSILON, `${label}: centred across`);
			// It fills its tile one way or the other: as large as the room allows.
			assert.ok(boxes.some((box) => Math.abs(box.y - inset) < EPSILON) || Math.abs(boxes[0].x - inset) < EPSILON, `${label}: as large as fits`);
		}
	}
});

test("a piece settles when the kit says it does: its style's play, else its own moment", () => {
	const m = load();
	assert.equal(m.pieceStillAfter({ holds: 4 }, undefined), 4, "a piece that holds rests after its moment");
	assert.equal(m.pieceStillAfter({ holds: null }, undefined), null, "a piece that never stops is never still");
	assert.equal(m.pieceStillAfter({ holds: 4 }, { length: 6 }), 6, "the stage's length over its own");
	assert.equal(m.pieceStillAfter({ holds: 4 }, { play: "loop", rest: 1 }), null, "a looping piece always moves on");
	assert.equal(m.pieceStillAfter({ holds: null }, { play: "once", length: 3 }), 3, "played once, it rests after its length");
});

test("a piece on a card already on the wall starts its moment as that card starts to fade up", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, slots } = wallFor(viewport);
		const standing = slots.filter((slot) => slot.content.kind === "piece" && slot.reserved === undefined && !m.slotDescent(slot, wall));
		assert.ok(standing.length > 0, "some product tiles are on the wall as it appears");
		for (const slot of standing) {
			const start = m.wallSlotRevealTime(slot, geometry);
			const shownAt = (time) => {
				const rect = m.slotOnScreen(slot, m.wallOffset(time, geometry), geometry);
				return m.wallRevealAt({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, slot.seed, time, viewport);
			};
			assert.ok(shownAt(start - 0.02) === 0, `${slot.key} is not up yet just before`);
			assert.ok(shownAt(start + 0.05) > 0, `${slot.key} is coming up just after`);
		}
	}
});

test("the kit's frame loads the vendored kit and its stage file, in standards mode, light", () => {
	const m = load();
	const srcdoc = m.rovoStageKitSrcdoc();
	assert.ok(srcdoc.toLowerCase().startsWith("<!doctype html>"), "standards mode, as the kit lays out");
	assert.ok(srcdoc.includes("color-scheme:light"), "one appearance, so the frame stays transparent over the wall");
	const urls = [...srcdoc.matchAll(/"(\/1p\/rovo-stage-kit\/[^"]+)"/gu)].map((match) => match[1]);
	assert.deepEqual(urls.sort(), [`${m.ROVO_STAGE_KIT_ROOT}/dist/rovo-stage.js`, `${m.ROVO_STAGE_KIT_ROOT}/rovo-stage.json`]);
	for (const url of urls) assert.ok(existsSync(path.join(PUBLIC, url)), `${url} is served from public/`);
	const stage = JSON.parse(readFileSync(path.join(PUBLIC, m.ROVO_STAGE_KIT_ROOT, "rovo-stage.json"), "utf8"));
	assert.equal(stage.format, "rovo-stage");
});
