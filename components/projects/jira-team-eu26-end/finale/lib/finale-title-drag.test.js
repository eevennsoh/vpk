const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

/*
 * MCB drags "Team ’26" into the mega bento. The title's gap lies almost
 * straight under its box, so the generic throw it used to share with the
 * tiles only shrank it in place, a plunge seen from above that came to rest
 * staring back: its middle never strayed more than about 5% of the frame's
 * width from its gap. Now MCB's cursor takes it by a corner and carries it.
 */

const ENTRY = `
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export * from "./finale-title-drag";
export { wallCursorsAt } from "./finale-wall-cursors";
export { FINALE_CURSORS, finaleCursorBox } from "./finale-cursor-path";
export { cameraDistance } from "./finale-card-motion";
export { setLandingWave } from "./finale-sheet-gl";
export { FINALE_REST_TIME, WALL_CUE } from "../data/finale-cues";
export { finaleBentoLayout, selectFinaleFeatures } from "../data/finale-stories";
`;

let dragModule;
function load() {
	dragModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		logLevel: "silent",
	}).outputFiles[0].text, "finale-title-drag-harness.cjs");
	return dragModule;
}

const VIEWPORTS = [
	{ width: 1440, height: 900 },
	{ width: 1728, height: 1117 },
	{ width: 1920, height: 1080 },
	{ width: 1024, height: 768 },
];
const STEP = 1 / 120;
const degrees = (radians) => (radians * 180) / Math.PI;

function sceneFor(viewport) {
	const m = load();
	const fit = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = m.finaleBentoLayout(viewport, fit);
	const geometry = m.wallGeometry(bento, fit, viewport);
	const wall = m.buildFinaleWall(geometry, bento, m.selectFinaleFeatures([]), []);
	const drops = m.bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	const title = drops.find((drop) => drop.kind === "title");
	const sheet = (time) => m.wallSheetsAt(time, wall, drops, viewport).find((each) => each.texture === "title") ?? null;
	const cursor = (time) => m.wallCursorsAt(time, wall, drops, viewport).find((each) => each.key === "title") ?? null;
	const gap = (time) => m.slotOnScreen(title.slot, m.wallOffset(time, geometry), geometry);
	return { m, viewport, fit, geometry, wall, drops, title, sheet, cursor, gap, distance: m.cameraDistance(viewport) };
}

/**
 * Where point (`u` across from the left, `v` down from the top) of a posed
 * sheet is seen, worked out independently of the module: three.js turns the
 * mesh by Euler XYZ (rotateX, rotateY, −rotateZ) in world axes with y up, and
 * the resting camera looks down on it from `distance`.
 */
function seenPoint(pose, u, v, viewport, distance) {
	const local = { x: (u - 0.5) * pose.width, y: (0.5 - v) * pose.height, z: 0 };
	const c = -pose.rotateZ;
	const z1 = { x: local.x * Math.cos(c) - local.y * Math.sin(c), y: local.x * Math.sin(c) + local.y * Math.cos(c), z: 0 };
	const b = pose.rotateY;
	const y1 = { x: z1.x * Math.cos(b) + z1.z * Math.sin(b), y: z1.y, z: -z1.x * Math.sin(b) + z1.z * Math.cos(b) };
	const a = pose.rotateX;
	const x1 = { x: y1.x, y: y1.y * Math.cos(a) - y1.z * Math.sin(a), z: y1.y * Math.sin(a) + y1.z * Math.cos(a) };
	const world = { x: pose.x - viewport.width / 2 + x1.x, y: viewport.height / 2 - pose.y + x1.y, z: pose.z + x1.z };
	const scale = distance / (distance - world.z);
	return { x: viewport.width / 2 + world.x * scale, y: viewport.height / 2 - world.y * scale };
}

/** Where MCB holds the card, read off where his tip lies on it once it is down flat in its gap. */
function gripOf(scene) {
	const touchdown = scene.m.titleTouchdownTime();
	const tip = scene.cursor(touchdown);
	const rect = scene.gap(touchdown);
	return { u: (tip.x - rect.x) / rect.width, v: (tip.y - rect.y) / rect.height };
}

/** Its middle on screen, and its size there. */
function seen(scene, pose) {
	const scale = scene.distance / (scene.distance - pose.z);
	const { width, height } = scene.viewport;
	return { x: width / 2 + (pose.x - width / 2) * scale, y: height / 2 + (pose.y - height / 2) * scale, width: pose.width * scale };
}

test("MCB reaches in as the black face comes up and takes the card by its lower right corner as its flip lands", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m } = scene;
		const reach = m.titleReachTime();
		const grab = m.titleGrabTime();
		const flip = m.bentoTitleFlipTime();
		assert.equal(scene.cursor(reach - 1e-3), null, "not before he reaches in");
		assert.ok(reach > flip && grab - flip < 0.5, "he reaches in during the flip and takes it as it lands");
		const first = scene.cursor(reach + 0.02);
		assert.ok(first && first.opacity > 0 && first.opacity < 0.2, "fading in as he comes");
		const grip = gripOf(scene);
		assert.ok(grip.u > 0.75 && grip.u < 1 && grip.v > 0.6 && grip.v < 1, `by its lower right corner (${grip.u.toFixed(2)}, ${grip.v.toFixed(2)})`);
		// He glides onto the grip and arrives as he presses, rather than waiting on it.
		const target = seenPoint(scene.sheet(grab).pose, grip.u, grip.v, viewport, scene.distance);
		const away = (time) => Math.hypot(scene.cursor(time).x - target.x, scene.cursor(time).y - target.y);
		assert.ok(away(reach + 0.05) > 0.1 * viewport.height, "from well off the card");
		for (let time = reach + 0.05; time < grab - 0.05; time += 0.05) assert.ok(away(time + 0.05) < away(time), `closing on it (${time.toFixed(2)}s)`);
		assert.ok(away(grab) < 0.5, "on its grip as he takes it");
		assert.ok(away(grab - 0.1) > 1, "still arriving a moment before");
		assert.ok(scene.cursor(grab).scale < scene.cursor(reach + 0.05).scale * 0.92, "pressed");
	}
});

test("from the grab to touchdown his tip never leaves the card's grip: it hangs from where he holds it", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m } = scene;
		const grip = gripOf(scene);
		for (let time = m.titleGrabTime(); time <= m.titleTouchdownTime(); time += STEP) {
			const tip = scene.cursor(time);
			const at = seenPoint(scene.sheet(time).pose, grip.u, grip.v, viewport, scene.distance);
			assert.ok(tip && tip.opacity === 1, `held at ${time.toFixed(3)}s`);
			assert.ok(Math.hypot(tip.x - at.x, tip.y - at.y) < 0.5, `his tip is on the drawn card's grip at ${time.toFixed(3)}s (${Math.hypot(tip.x - at.x, tip.y - at.y).toFixed(2)}px off)`);
		}
	}
});

test("regression: he carries it across the frame, where it used to shrink in place over its gap", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m } = scene;
		const grab = m.titleGrabTime();
		const touchdown = m.titleTouchdownTime();
		const fromGap = (time) => {
			const at = seen(scene, scene.sheet(time).pose);
			const rect = scene.gap(time);
			return Math.hypot(at.x - (rect.x + rect.width / 2), at.y - (rect.y + rect.height / 2));
		};
		let farthest = 0;
		let travelled = 0;
		let last = scene.cursor(grab);
		for (let time = grab; time <= touchdown; time += STEP) {
			farthest = Math.max(farthest, fromGap(time));
			const tip = scene.cursor(time);
			travelled += Math.hypot(tip.x - last.x, tip.y - last.y);
			last = tip;
		}
		// The old throw kept its middle within 3.7–5.2% of the frame's width of its gap on these screens.
		assert.ok(farthest > 0.1 * viewport.width, `${viewport.width}×${viewport.height}: carried ${(farthest / viewport.width * 100).toFixed(1)}% of the frame from its gap`);
		assert.ok(travelled > 0.25 * viewport.width, `his hand travels ${(travelled / viewport.width * 100).toFixed(0)}% of the frame's width`);
		// It gives toward him as he takes it, then he strokes it into its gap: away first, then only closer,
		// bar the last few px as it shrinks onto the corner he holds it by.
		const peak = grab + 0.45;
		const near = 0.015 * viewport.width;
		assert.ok(fromGap(peak) > fromGap(grab) + 0.04 * viewport.width, "it gives toward him");
		let time = peak + 0.1;
		for (; fromGap(time) > near; time += 0.05) assert.ok(fromGap(time + 0.05) <= fromGap(time) + 1, `then closes on its gap (${time.toFixed(2)}s)`);
		assert.ok(time < touchdown - 0.2, "over its gap before he sets it down");
		for (; time <= touchdown; time += STEP) assert.ok(fromGap(time) <= near, `and stays over it (${time.toFixed(3)}s)`);
		assert.ok(fromGap(touchdown) < 1e-6, "lying in it");
	}
});

test("a held card, not a thrown one: it leans into the drag and shifts its weight, but never spins or flips", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m } = scene;
		let lowest = 0;
		let highest = 0;
		let turned = 0;
		let before = scene.sheet(m.titleHeldTime()).pose;
		for (let time = m.titleHeldTime(); time <= m.titleTouchdownTime(); time += STEP) {
			const { pose } = scene.sheet(time);
			for (const axis of ["rotateX", "rotateY", "rotateZ"]) assert.ok(Math.abs(degrees(pose[axis])) < 12, `${axis} stays a lean (${degrees(pose[axis]).toFixed(1)}° at ${time.toFixed(2)}s)`);
			assert.ok(Math.cos(pose.rotateX) * Math.cos(pose.rotateY) > 0.95, "its black face to the lens");
			lowest = Math.min(lowest, pose.rotateZ);
			highest = Math.max(highest, pose.rotateZ);
			turned += Math.abs(pose.rotateZ - before.rotateZ);
			before = pose;
		}
		assert.ok(degrees(highest) > 0.5 && degrees(lowest) < -4, `it leans the way he drags it, first toward him, then into the stroke (${degrees(highest).toFixed(1)}°, ${degrees(lowest).toFixed(1)}°)`);
		assert.ok(degrees(turned) < 30, `all told it turns a little, never round (${degrees(turned).toFixed(1)}°)`);
	}
});

test("he lowers it from near the lens to the wall: it only comes down and only shrinks, from exactly its box, its cursor shrinking with it", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m, title, distance } = scene;
		const carry = m.titleCarryOf(title, scene.geometry, viewport);
		const grab = m.titleGrabTime();
		const touchdown = m.titleTouchdownTime();
		const held = m.titleHeldPose(carry, grab);
		assert.ok(Math.abs(seen(scene, held).width - title.from.width) < 1e-6, "in his hand it is seen exactly the size of its box");
		assert.ok(held.z > 0.3 * distance, "near the lens");
		let previous = { z: Number.POSITIVE_INFINITY, width: Number.POSITIVE_INFINITY, scale: Number.POSITIVE_INFINITY };
		for (let time = grab; time <= touchdown; time += STEP) {
			const pose = m.titleHeldPose(carry, time);
			const width = seen(scene, pose).width;
			assert.ok(pose.z <= previous.z + 1e-6 && pose.z >= -1e-6, `it only comes down (${time.toFixed(3)}s)`);
			assert.ok(width <= previous.width + 1e-6 && width <= title.from.width + 1e-6, "and is only ever seen shrinking, from its box toward its gap");
			assert.ok(distance - pose.z >= distance * 0.3, "it never reaches the lens's fade");
			previous = { z: pose.z, width, scale: previous.scale };
			// Pressed throughout, so his cursor's size is its perspective alone.
			if (time >= m.titleHeldTime()) {
				const { scale } = scene.cursor(time);
				assert.ok(scale <= previous.scale + 1e-9, "his cursor is lowered with it");
				previous.scale = scale;
			}
		}
		assert.ok(scene.cursor(grab).scale > 1.3, "his cursor is larger up near the lens");
		assert.ok(Math.abs(scene.cursor(touchdown + 0.2).scale - 1) < 1e-9, "and the wall's own size once he lets go");
	}
});

test("he sets it down on its moving gap, lets go as it touches down, and leaves before any teammate reaches in", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m, title, drops } = scene;
		const touchdown = m.titleTouchdownTime();
		const gone = m.titleCarrierGoneTime();
		assert.equal(m.bentoTouchdown(title, drops), touchdown, "his set-down is the title's touchdown");
		const grip = gripOf(scene);
		const down = scene.cursor(touchdown);
		const rect = scene.gap(touchdown);
		assert.ok(Math.abs(down.x - (rect.x + grip.u * rect.width)) < 1e-6 && Math.abs(down.y - (rect.y + grip.v * rect.height)) < 1e-6, "on its grip, flat in its gap");
		assert.ok(Math.abs(scene.cursor(touchdown - 0.02).scale - 0.9) < 0.01, "still pressed as it comes down");
		assert.ok(scene.cursor(touchdown + 0.12).scale > 0.995, "his press lets go as it lands");
		let previous = down;
		for (let time = touchdown + 0.1; time <= gone; time += 0.05) {
			const now = scene.cursor(time);
			if (!now) break;
			assert.ok(now.opacity <= previous.opacity + 1e-9, `fading (${time.toFixed(2)}s)`);
			previous = now;
		}
		const lifting = scene.cursor(touchdown + 0.4);
		const under = scene.gap(touchdown + 0.4);
		assert.ok(lifting.y < under.y + grip.v * under.height - 0.03 * viewport.height, "lifting up and away off the card");
		assert.equal(scene.cursor(gone + 1e-3), null, "gone");
		const mcb = m.FINALE_CURSORS.findIndex((cursor) => cursor.id === "mcb");
		assert.equal(down.lane, mcb, "in his own lane");
		assert.equal(down.name, m.FINALE_CURSORS[mcb].label, "and name, as on the slide");
		for (let time = m.titleReachTime(); time <= gone; time += 0.05) {
			const others = m.wallCursorsAt(time, scene.wall, drops, viewport).filter((cursor) => cursor.key !== "title");
			assert.deepEqual(others, [], `nobody else's cursor while his is in (${time.toFixed(2)}s)`);
		}
	}
});

test("its landing wave runs from the corner he set it down by, where every other card's runs from Peel's grab point", () => {
	const impulseOf = (m, pose, from) => {
		const uniforms = { uLit: { value: 0 }, uImpulse: { value: { set: (...values) => (uniforms.sent = values) } } };
		m.setLandingWave(uniforms, pose, from);
		return uniforms.sent;
	};
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m, wall, drops } = scene;
		const touchdown = m.titleTouchdownTime();
		const grip = gripOf(scene);
		const sheet = scene.sheet(touchdown + 0.05);
		// Regression: the ripple ran from the sheet's top left, the far corner from his hand.
		assert.ok(Math.abs(sheet.waveFrom.x - grip.u) < 1e-6 && Math.abs(sheet.waveFrom.y - (1 - grip.v)) < 1e-6, "from his grip, in the sheet's own uv (v up)");
		const [u, v, age, energy] = impulseOf(m, sheet.pose, sheet.waveFrom);
		assert.ok(u === sheet.waveFrom.x && v === sheet.waveFrom.y && age > 0 && energy > 0, "and the shader's ripple starts there");
		const others = m.wallSheetsAt(touchdown + 0.05, wall, drops, viewport).filter((each) => each.texture !== "title");
		assert.ok(others.length > 0 && others.every((each) => each.waveFrom === null), "the rest keep Peel's grab point");
		const [peelU, peelV] = impulseOf(m, sheet.pose, null);
		assert.ok(Math.abs(peelU - 0.25) < 1e-9 && Math.abs(peelV - 0.9) < 1e-9, "which is the default");
	}
});

test("his cursor, name pill and all, stays well inside the frame on every screen, and never shows on the rest frame", () => {
	for (const viewport of [...VIEWPORTS, { width: 2560, height: 1080 }, { width: 1080, height: 1350 }]) {
		const scene = sceneFor(viewport);
		const { m, fit } = scene;
		const box = m.finaleCursorBox(m.FINALE_CURSORS.find((cursor) => cursor.id === "mcb").label);
		const margin = 24 * fit;
		for (let time = m.titleReachTime(); time <= m.titleCarrierGoneTime(); time += 1 / 60) {
			const cursor = scene.cursor(time);
			if (!cursor || cursor.opacity <= 0) continue;
			const scale = fit * cursor.scale;
			const edges = { left: cursor.x - box.left * scale, top: cursor.y - box.top * scale, right: cursor.x + box.right * scale, bottom: cursor.y + box.bottom * scale };
			assert.ok(edges.left >= margin && edges.top >= margin && edges.right <= viewport.width - margin && edges.bottom <= viewport.height - margin, `${viewport.width}×${viewport.height} at ${time.toFixed(2)}s: ${JSON.stringify(edges)}`);
		}
		assert.deepEqual(m.wallCursorsAt(m.FINALE_REST_TIME, scene.wall, scene.drops, viewport), [], "reduced motion holds the bento's last frame: no wall, no cursor");
	}
});

test("its cloth feels the drag without a jolt, from his hand to its landing", () => {
	for (const viewport of VIEWPORTS) {
		const scene = sceneFor(viewport);
		const { m } = scene;
		let previous = scene.sheet(m.titleGrabTime()).velocity;
		let fastest = 0;
		for (let time = m.titleGrabTime() + STEP; time <= m.titleTouchdownTime() + 0.3; time += STEP) {
			const { velocity } = scene.sheet(time);
			assert.ok(Math.hypot(velocity.x - previous.x, velocity.y - previous.y, velocity.z - previous.z) < 600, `no jolt at ${time.toFixed(3)}s`);
			fastest = Math.max(fastest, Math.hypot(velocity.x, velocity.y, velocity.z));
			previous = velocity;
		}
		assert.ok(fastest > 300, "it feels the air as he carries it");
		// A drag preview's shadow under it from when he takes it, and the field's smear only while it is up.
		const held = scene.sheet(m.titleHeldTime());
		assert.ok(held.shadow && held.shadow.start === m.titleGrabTime() && held.shadow.settled === m.titleTouchdownTime(), "its shadow from his grab to its touchdown");
		assert.ok(held.chroma > 0 && held.chroma < 0.6, "softly smeared up near the lens");
		assert.equal(scene.sheet(m.titleTouchdownTime()).chroma, 0, "crisp as it lands");
	}
});
