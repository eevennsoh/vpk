import assert from "node:assert/strict";
import test from "node:test";

import {
	END,
	PHASES,
	activePartIndex,
	drawEase,
	invertDrawEase,
	revealEase,
	scheduleParts,
	win,
} from "./timeline.ts";

// The phases are tuned together; these pin the ordering the drawing depends on.

test("the reveal starts once every part has been traced", () => {
	const schedules = scheduleParts(12);
	const lastEnd = Math.max(...schedules.map((s) => s.t1));
	assert.ok(lastEnd <= PHASES.reveal[0] + 1e-9, `parts end at ${lastEnd}, reveal starts at ${PHASES.reveal[0]}`);
});

test("the overlay outlives the reveal, so the real UI is fully in before it is removed", () => {
	assert.ok(END > PHASES.reveal[1]);
	assert.ok(END > PHASES.clean[1]);
});

test("parts are traced in document order and stay inside the parts window", () => {
	const schedules = scheduleParts(8);
	for (let i = 1; i < schedules.length; i++) assert.ok(schedules[i].t0 > schedules[i - 1].t0);
	assert.equal(schedules[0].t0, PHASES.parts[0]);
	assert.ok(schedules.at(-1)!.t1 <= PHASES.parts[1] + 1e-9);
});

test("a single part starts at the top of the parts window", () => {
	assert.deepEqual(scheduleParts(1).map((s) => s.t0), [PHASES.parts[0]]);
	assert.deepEqual(scheduleParts(0), []);
});

test("the reticle sits on the last part that has started", () => {
	const schedules = scheduleParts(4);
	assert.equal(activePartIndex(schedules, 0), -1);
	assert.equal(activePartIndex(schedules, schedules[2].t0), 2);
	assert.equal(activePartIndex(schedules, 1), 3);
});

test("the eases clamp outside 0..1 and are monotonic inside it", () => {
	for (const ease of [drawEase, revealEase]) {
		assert.equal(ease(-1), 0);
		assert.equal(ease(2), 1);
		let previous = 0;
		for (let x = 0.05; x <= 1; x += 0.05) {
			const y = ease(x);
			assert.ok(y >= previous - 1e-9);
			previous = y;
		}
	}
});

test("invertDrawEase inverts drawEase, so flyers land as the outline arrives", () => {
	for (const f of [0.1, 0.4, 0.8]) assert.ok(Math.abs(drawEase(invertDrawEase(f)) - f) < 1e-3);
});

test("win maps a phase to 0..1", () => {
	assert.equal(win(PHASES.reveal, 0), 0);
	assert.equal(win(PHASES.reveal, 2), 1);
	assert.ok(Math.abs(win([0, 0.5], 0.25) - 0.5) < 1e-9);
});
