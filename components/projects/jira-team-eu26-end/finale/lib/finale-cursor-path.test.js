const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-cursor-path";
export { tileFallStart, touchdownTime } from "./finale-card-motion";
export { CUE, FINALE_REST_TIME } from "../data/finale-cues";
export { finaleBentoLayout } from "../data/finale-stories";
export { ROVO_COLOR_SWATCHES } from "@/lib/rovo-colors";
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
	}).outputFiles[0].text, "finale-cursor-path-harness.cjs");
	return loaded;
}

const VIEWPORTS = [
	{ width: 1920, height: 1080 },
	{ width: 1440, height: 900 },
	{ width: 1280, height: 720 },
	{ width: 2560, height: 1080 },
	{ width: 1024, height: 768 },
];
const FRAME = 1 / 60;

function stage(viewport) {
	const { finaleBentoLayout } = load();
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	return { scale, layout: finaleBentoLayout(viewport, scale) };
}

/** Frame-stepped times through [start, end], without float drift past the end. */
function* frames(start, end, step = FRAME) {
	const count = Math.floor((end - start) / step + 1e-9);
	for (let index = 0; index <= count; index += 1) yield start + index * step;
}

/** The cursor's painted box (arrow, pill and shadow) around its tip. */
function box(pose, scale) {
	const { FINALE_CURSOR_BOX } = load();
	const s = scale * pose.scale;
	return {
		x: pose.x - FINALE_CURSOR_BOX.left * s,
		y: pose.y - FINALE_CURSOR_BOX.top * s,
		width: (FINALE_CURSOR_BOX.left + FINALE_CURSOR_BOX.right) * s,
		height: (FINALE_CURSOR_BOX.top + FINALE_CURSOR_BOX.bottom) * s,
	};
}

function overlaps(a, b) {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function offFrame(rect, viewport) {
	return !overlaps(rect, { x: 0, y: 0, width: viewport.width, height: viewport.height });
}

test("four presenter cursors, one per Rovo colour", () => {
	const { FINALE_CURSORS, ROVO_COLOR_SWATCHES } = load();
	assert.deepEqual(FINALE_CURSORS.map((cursor) => cursor.label).sort(), ["MCB", "Sherif", "Tamar", "Taroon"]);
	assert.deepEqual(FINALE_CURSORS.map((cursor) => cursor.color).sort(), ROVO_COLOR_SWATCHES.map((swatch) => swatch.hex).sort());
	assert.equal(new Set(FINALE_CURSORS.map((cursor) => cursor.entry)).size, 4, "each from its own side or corner");
	assert.equal(new Set(FINALE_CURSORS.map((cursor) => cursor.slot)).size, 4, "each by a different tile");
});

test("the cursors appear while the tiles assemble and are gone by the title and the rest frame", () => {
	const { CUE, FINALE_CURSORS, FINALE_REST_TIME, cursorPose, cursorWindow, tileFallStart } = load();
	const viewport = VIEWPORTS[0];
	const { layout, scale } = stage(viewport);
	FINALE_CURSORS.forEach((_, index) => {
		const { start, end } = cursorWindow(index);
		assert.ok(start >= tileFallStart(1) && end <= CUE.title, `cursor ${index} stays inside the assembly`);
		for (const time of [0, CUE.heroLand - 0.2, start - 0.001, end + 0.001, CUE.title + 0.001, CUE.yearLand, CUE.end, FINALE_REST_TIME]) {
			assert.equal(cursorPose(time, index, layout.slots, viewport, scale), null, `cursor ${index} hidden at ${time}`);
		}
		assert.ok(cursorPose((start + end) / 2, index, layout.slots, viewport, scale));
	});
});

test("they are staggered, not in lockstep", () => {
	const { FINALE_CURSORS, cursorDropTime, cursorWindow } = load();
	for (let index = 1; index < FINALE_CURSORS.length; index += 1) {
		assert.ok(cursorWindow(index).start > cursorWindow(index - 1).start + 0.05, `enter ${index}`);
		assert.ok(cursorWindow(index).end > cursorWindow(index - 1).end + 0.05, `exit ${index}`);
		assert.ok(cursorDropTime(index) > cursorDropTime(index - 1) + 0.05, `drop ${index}`);
	}
});

test("each rests by a tile while that tile swoops in, in landing order", () => {
	const { FINALE_CURSORS, cursorDropTime, cursorWindow, tileFallStart, touchdownTime } = load();
	const { layout } = stage(VIEWPORTS[0]);
	let previousOrder = 0;
	FINALE_CURSORS.forEach((cursor, index) => {
		const order = layout.slots.findIndex((slot) => slot.id === cursor.slot);
		assert.ok(order > previousOrder, `${cursor.label} follows the landing order`);
		previousOrder = order;
		const drop = cursorDropTime(index);
		assert.ok(drop > tileFallStart(order) && drop < touchdownTime(order), `${cursor.label} drops while its tile is coming in`);
		assert.ok(cursorWindow(index).start < touchdownTime(order), "arrives before its tile lands");
	});
});

test("each enters and exits off-frame at its own side and rests by its tile with one drop", () => {
	const { FINALE_CURSORS, cursorDropTime, cursorPose, cursorRestPoint, cursorWindow } = load();
	for (const viewport of VIEWPORTS) {
		const { layout, scale } = stage(viewport);
		FINALE_CURSORS.forEach((cursor, index) => {
			const { start, end } = cursorWindow(index);
			const first = cursorPose(start, index, layout.slots, viewport, scale);
			const last = cursorPose(end, index, layout.slots, viewport, scale);
			assert.ok(offFrame(box(first, scale), viewport), `${cursor.label} enters off-frame (${viewport.width}×${viewport.height})`);
			assert.ok(offFrame(box(last, scale), viewport), `${cursor.label} exits off-frame`);
			const top = cursor.entry.startsWith("top");
			for (const pose of [first, last]) {
				assert.equal(pose.y < 0, top, `${cursor.label} uses its ${cursor.entry} side`);
				if (cursor.entry.endsWith("left")) assert.ok(pose.x < 0, `${cursor.label} uses its ${cursor.entry} corner`);
				if (cursor.entry.endsWith("right")) assert.ok(pose.x > viewport.width, `${cursor.label} uses its ${cursor.entry} corner`);
				if (cursor.entry === "top") assert.ok(pose.x > 0 && pose.x < viewport.width, `${cursor.label} drops in from the top edge`);
			}
			// Resting on its tile at the drop, pressed to 0.9, and released either side.
			const drop = cursorDropTime(index);
			const resting = cursorPose(drop, index, layout.slots, viewport, scale);
			const rest = cursorRestPoint(cursor, layout.slots);
			const slot = layout.slots.find((candidate) => candidate.id === cursor.slot).rect;
			assert.deepEqual({ x: resting.x, y: resting.y }, rest);
			assert.ok(overlaps(box(resting, scale), slot) && rest.x > slot.x && rest.x < slot.x + slot.width && rest.y > slot.y && rest.y < slot.y + slot.height);
			assert.ok(Math.abs(resting.scale - 0.9) < 1e-9, "pressed at the drop");
			let presses = 0;
			let wasPressed = false;
			for (const time of frames(start, end, FRAME / 4)) {
				const pressed = cursorPose(time, index, layout.slots, viewport, scale).scale < 0.95;
				if (pressed && !wasPressed) presses += 1;
				wasPressed = pressed;
			}
			assert.equal(presses, 1, `${cursor.label} drops once`);
		});
	}
});

test("smooth: no frame-to-frame jumps and no seams", () => {
	const { FINALE_CURSORS, cursorPose, cursorWindow } = load();
	for (const viewport of VIEWPORTS) {
		const { layout, scale } = stage(viewport);
		FINALE_CURSORS.forEach((cursor, index) => {
			const { start, end } = cursorWindow(index);
			let previous = null;
			for (const time of frames(start, end, FRAME / 4)) {
				const pose = cursorPose(time, index, layout.slots, viewport, scale);
				if (previous) {
					// At most 5% of the frame width per 60 fps frame.
					const step = Math.hypot(pose.x - previous.x, pose.y - previous.y) * 4;
					assert.ok(step <= viewport.width * 0.05, `${cursor.label}: ${step.toFixed(1)}px/frame at ${time.toFixed(3)}s (${viewport.width}×${viewport.height})`);
				}
				previous = pose;
			}
			for (const time of frames(start, end - 1e-3, 0.005)) {
				const a = cursorPose(time, index, layout.slots, viewport, scale);
				const b = cursorPose(time + 1e-4, index, layout.slots, viewport, scale);
				assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 1, `${cursor.label} continuous at ${time.toFixed(3)}s`);
			}
		});
	}
});

test("no cursor ever covers the title area", () => {
	const { FINALE_CURSORS, cursorPose, cursorWindow } = load();
	for (const viewport of VIEWPORTS) {
		const { layout, scale } = stage(viewport);
		FINALE_CURSORS.forEach((cursor, index) => {
			const { start, end } = cursorWindow(index);
			for (const time of frames(start, end, FRAME / 2)) {
				const pose = cursorPose(time, index, layout.slots, viewport, scale);
				assert.ok(!overlaps(box(pose, scale), layout.title), `${cursor.label} clear of the title at ${time.toFixed(3)}s (${viewport.width}×${viewport.height})`);
			}
		});
	}
});

test("a missing slot or cursor index renders nothing", () => {
	const { cursorPose, cursorWindow } = load();
	const viewport = VIEWPORTS[0];
	const { layout, scale } = stage(viewport);
	const { start, end } = cursorWindow(0);
	const middle = (start + end) / 2;
	assert.equal(cursorPose(middle, 0, layout.slots.filter((slot) => slot.id !== "e"), viewport, scale), null);
	assert.equal(cursorPose(middle, 9, layout.slots, viewport, scale), null);
});
