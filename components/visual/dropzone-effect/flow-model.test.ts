import assert from "node:assert/strict";
import test from "node:test";

import { createFrame, createSeed, edgeDistance, mulberry32, progressOf, radiusFraction, sampleFlow, SWALLOW_SCALE, TUMBLE_TILT_LIMIT, type DropzoneLayout, type StickerFrame, type StickerSeed } from "./flow-model.ts";
import { resolveLayout } from "./tuning.ts";

const DEG = Math.PI / 180;
const LAYOUT: DropzoneLayout = resolveLayout(1440, 900);
const KINDS = 21;

function seedAt(index: number): StickerSeed {
	return createSeed(mulberry32(1000 + index), LAYOUT, 0, KINDS);
}

/** Walks one seed's whole run, yielding a frame at each of `steps` samples. */
function walk(seed: StickerSeed, steps = 240): StickerFrame[] {
	const frames: StickerFrame[] = [];
	for (let i = 0; i <= steps; i += 1) {
		const out = createFrame();
		sampleFlow(seed, LAYOUT, seed.startTime + (i / steps) * seed.duration, out);
		frames.push({ ...out });
	}
	return frames;
}

const orbRadius = (frame: StickerFrame) => Math.hypot(frame.x - LAYOUT.orbX, frame.y - LAYOUT.orbY);

test("radiusFraction runs from 1 to 0 and never increases", () => {
	assert.equal(radiusFraction(0), 1);
	assert.ok(Math.abs(radiusFraction(1)) < 1e-12);
	let previous = Number.POSITIVE_INFINITY;
	for (let i = 0; i <= 200; i += 1) {
		const value = radiusFraction(i / 200);
		assert.ok(value <= previous + 1e-12, `not monotonic at u=${i / 200}`);
		previous = value;
	}
	// Clamped outside [0, 1] rather than extrapolating into negative radii.
	assert.equal(radiusFraction(-1), 1);
	assert.equal(radiusFraction(4), radiusFraction(1));
});

test("the drain accelerates: the last tenth covers more ground than the first", () => {
	const early = radiusFraction(0) - radiusFraction(0.1);
	const late = radiusFraction(0.9) - radiusFraction(1);
	assert.ok(late > early * 2, `expected a jet, got early=${early} late=${late}`);
});

test("edgeDistance reaches the viewport border along a bearing", () => {
	const layout = resolveLayout(1000, 800);
	// Bearing 0 is screen right; the orb sits left of centre, so the right edge
	// is further away than half the width.
	const right = edgeDistance(layout, 0);
	assert.ok(Math.abs(layout.orbX + right - 500) < 1e-9);
	const up = edgeDistance(layout, Math.PI / 2);
	assert.ok(Math.abs(layout.orbY + up - 400) < 1e-9);
	// Every bearing lands on one of the four edges, never inside or at infinity.
	for (let i = 0; i < 64; i += 1) {
		const distance = edgeDistance(layout, (i / 64) * Math.PI * 2);
		assert.ok(Number.isFinite(distance) && distance > 0);
	}
});

test("a sticker starts off screen and finishes at the orb", () => {
	for (let index = 0; index < 40; index += 1) {
		const seed = seedAt(index);
		const frames = walk(seed);
		const start = frames[0];
		const end = frames[frames.length - 1];

		// Spawn is outside the frame once perspective is undone.
		const scale = LAYOUT.cameraDistance / (LAYOUT.cameraDistance - start.z);
		const screenX = (start.x - LAYOUT.orbX) * scale + LAYOUT.orbX;
		const screenY = (start.y - LAYOUT.orbY) * scale + LAYOUT.orbY;
		assert.ok(
			Math.abs(screenX) > LAYOUT.width / 2 || Math.abs(screenY) > LAYOUT.height / 2,
			`seed ${index} spawned on screen at (${screenX}, ${screenY})`,
		);

		// The radius is floored at 1e-4 of the spawn distance so the spiral's
		// `ln(r0 / r)` cannot diverge, which leaves a sub-pixel residue at the
		// drain. At 12 % scale and zero opacity that is invisible; what matters
		// is that it is sub-pixel rather than a visible near-miss.
		assert.ok(orbRadius(end) < 1, `seed ${index} ended ${orbRadius(end)} px from the orb`);
		// The orb defines the focal plane, so depth must resolve to it too.
		assert.ok(Math.abs(end.z) < 1e-6, `seed ${index} ended at z=${end.z}`);
	}
});

test("distance to the orb falls the whole way in, wander included", () => {
	for (let index = 0; index < 40; index += 1) {
		const frames = walk(seedAt(index), 60);
		for (let i = 1; i < frames.length; i += 1) {
			assert.ok(
				orbRadius(frames[i]) <= orbRadius(frames[i - 1]) + 1e-9,
				`seed ${index} moved away from the orb at step ${i}`,
			);
		}
	}
});

test("the whole river winds the same way, so it reads as one stream", () => {
	for (let index = 0; index < 40; index += 1) {
		const seed = seedAt(index);
		assert.ok(seed.winding > 0, `seed ${index} winds the wrong way`);
	}
});

test("stickers shrink into the drain and fade out rather than popping", () => {
	for (let index = 0; index < 20; index += 1) {
		const frames = walk(seedAt(index));
		const end = frames[frames.length - 1];
		// Tolerance, not exactness: the same sub-pixel radius floor that keeps
		// `ln(r0 / r)` finite also leaves the shrink a hair short of its target.
		assert.ok(
			Math.abs(end.scale - SWALLOW_SCALE) < 1e-4,
			`seed ${index} ended at scale ${end.scale}`,
		);
		assert.ok(end.opacity < 0.02, `seed ${index} was still visible at ${end.opacity}`);
		assert.ok(frames[0].scale > 0.99, `seed ${index} spawned already shrunk`);
		assert.ok(frames[0].opacity > 0.99, `seed ${index} spawned already faded`);
	}
});

test("orb light is inverse-square: negligible at spawn, saturated at the drain", () => {
	for (let index = 0; index < 20; index += 1) {
		const frames = walk(seedAt(index));
		assert.ok(frames[0].orbLight < 0.02, `seed ${index} lit up at spawn`);
		assert.ok(
			frames[frames.length - 1].orbLight > 0.99,
			`seed ${index} never caught the light`,
		);
		// And it only ever rises — a flicker would read as a strobe.
		for (let i = 1; i < frames.length; i += 1) {
			assert.ok(frames[i].orbLight >= frames[i - 1].orbLight - 1e-9);
		}
	}
});

test("motion smear only engages at speed, and never inverts the sticker", () => {
	let everSmeared = false;
	for (let index = 0; index < 20; index += 1) {
		for (const frame of walk(seedAt(index))) {
			assert.ok(frame.smearAlong >= 1 && frame.smearAlong <= 1.9 + 1e-9);
			assert.ok(frame.smearAcross <= 1 && frame.smearAcross >= 0.58 - 1e-9);
			if (frame.smearAlong > 1.05) {
				everSmeared = true;
				assert.ok(frame.speed > 450, "smeared below the speed threshold");
			}
		}
	}
	assert.ok(everSmeared, "nothing ever reached smear speed — the jet is not landing");
});

test("tumble never turns a flat die-cut edge-on to the camera", () => {
	const limit = TUMBLE_TILT_LIMIT * DEG;
	for (let index = 0; index < 40; index += 1) {
		for (const frame of walk(seedAt(index), 90)) {
			assert.ok(
				Math.hypot(frame.tiltX, frame.tiltY) <= limit,
				`seed ${index} tilted past the limit`,
			);
		}
	}
});

test("every value stays finite across the whole run", () => {
	for (let index = 0; index < 40; index += 1) {
		for (const frame of walk(seedAt(index), 120)) {
			for (const [key, value] of Object.entries(frame)) {
				assert.ok(Number.isFinite(value), `seed ${index} produced ${key}=${value}`);
			}
		}
	}
});

test("the same seed replays identically", () => {
	const a = createSeed(mulberry32(7), LAYOUT, 0, KINDS);
	const b = createSeed(mulberry32(7), LAYOUT, 0, KINDS);
	assert.deepEqual(a, b);
	const frameA = sampleFlow(a, LAYOUT, 2.5, createFrame());
	const frameB = sampleFlow(b, LAYOUT, 2.5, createFrame());
	assert.deepEqual({ ...frameA }, { ...frameB });
});

test("progressOf is the clock the field respawns on", () => {
	const seed = createSeed(mulberry32(11), LAYOUT, 3, KINDS);
	assert.equal(progressOf(seed, 3), 0);
	assert.equal(progressOf(seed, 3 + seed.duration), 1);
	assert.ok(progressOf(seed, 3 + seed.duration * 2) > 1);
});
