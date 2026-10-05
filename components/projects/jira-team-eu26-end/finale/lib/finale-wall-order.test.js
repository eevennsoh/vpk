const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export * from "./finale-wall-order";
export { cameraDistance } from "./finale-card-motion";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
`;

let orderModule;
function load() {
	orderModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-order-harness.cjs");
	return orderModule;
}

const VIEWPORTS = [
	{ width: 1728, height: 1117 },
	{ width: 1920, height: 1080 },
];

function sceneFor(viewport) {
	const m = load();
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = m.finaleBentoLayout(viewport, scale);
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, m.FINALE_FEATURES, []);
	const drops = m.bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	const title = drops.find((drop) => drop.kind === "title");
	return { m, viewport, wall, drops, distance: m.cameraDistance(viewport), touchdown: m.bentoTouchdown(title, drops) };
}

/** Every sheet the GL layer draws at `time`, with the draw order its frame loop gives it. */
function ordered(scene, time) {
	const { m, wall, drops, viewport, distance } = scene;
	return m.wallSheetsAt(time, wall, drops, viewport).map((sheet, index) => {
		const depth = distance - sheet.pose.z;
		const lifted = m.wallSheetLifted(sheet, time, drops);
		return { sheet, depth, lifted, order: m.wallDrawOrder(depth, index, lifted, { sheet: 0, shadow: 0, ink: 0 }) };
	});
}

const frames = (from, to) => Array.from({ length: Math.ceil((to - from) * 60) }, (_, index) => from + index / 60);

test("the title card draws over every other sheet, its shadow and ink with it, from its flip until it touches down", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m } = scene;
		let nearer = 0;
		for (const time of frames(m.bentoTitleFlipTime(), scene.touchdown)) {
			const drawn = ordered(scene, time);
			const title = drawn.find((each) => each.sheet.texture === "title");
			assert.ok(title, `the title is drawn at ${time.toFixed(3)}`);
			assert.equal(title.lifted, true, `lifted at ${time.toFixed(3)}`);
			assert.ok(title.order.ink > title.order.sheet && title.order.sheet > title.order.shadow, "its ink over its plate, its shadow just under it");
			for (const other of drawn) {
				if (other === title) continue;
				assert.equal(other.lifted, false, "only the title is lifted");
				assert.ok(title.order.shadow > other.order.sheet, `${other.sheet.key} draws under the title and its shadow at ${time.toFixed(3)}`);
				if (other.depth < title.depth) nearer += 1;
			}
		}
		// The bug this guards: the thrown cards start nearer the lens than the bowing title, so by depth they would cut it.
		assert.ok(nearer > 0, `${viewport.width}×${viewport.height}: some sheet is nearer the lens than the airborne title`);
	}
});

test("at the throw, every bento tile is nearer the lens than the title, and still draws under it", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const drawn = ordered(scene, scene.m.bentoTossTime());
		const title = drawn.find((each) => each.sheet.texture === "title");
		const tiles = drawn.filter((each) => each.sheet.kind === "bento" && each !== title);
		assert.equal(tiles.length, 6);
		for (const tile of tiles) {
			assert.ok(tile.depth < title.depth, `${tile.sheet.key} starts nearer the lens`);
			assert.ok(tile.order.sheet < title.order.shadow, `${tile.sheet.key} draws under the title`);
		}
	}
});

test("once down, the title sorts by depth with the rest of the wall again", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		for (const time of frames(scene.touchdown, scene.touchdown + 0.8)) {
			for (const [index, each] of ordered(scene, time).entries()) {
				assert.equal(each.lifted, false, `${each.sheet.key} at ${time.toFixed(3)}`);
				assert.deepEqual(each.order, scene.m.wallDrawOrder(each.depth, index, false, { sheet: 0, shadow: 0, ink: 0 }));
			}
		}
	}
});

test("by depth, far to near, each shadow just under its own sheet and over everything farther", () => {
	const { wallDrawOrder } = load();
	const near = wallDrawOrder(900, 3, false, { sheet: 0, shadow: 0, ink: 0 });
	const far = wallDrawOrder(1800, 7, false, { sheet: 0, shadow: 0, ink: 0 });
	assert.ok(near.sheet > near.shadow && near.shadow > far.sheet && far.sheet > far.shadow);
	assert.ok(near.ink > near.sheet);
	const lifted = wallDrawOrder(1800, 0, true, { sheet: 0, shadow: 0, ink: 0 });
	// Nearer than the camera's near plane is never drawn, so nothing sorts past the lifted title.
	const nearest = wallDrawOrder(0, 511, false, { sheet: 0, shadow: 0, ink: 0 });
	assert.ok(lifted.shadow > nearest.sheet && lifted.sheet > lifted.shadow && lifted.ink > lifted.sheet);
});
