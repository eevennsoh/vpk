import assert from "node:assert/strict";
import { test } from "node:test";

import {
	cubicBezierEase,
	DOT_RADIUS,
	getDotPositions,
	getRestPattern,
	INITIAL_REST_ROTATION,
	nextForwardAngle,
	planForwardTurn,
	REST_RADIUS,
	REST_ROTATION_PERIOD,
	REST_ROTATION_PHASE,
	ROTATION_AMOUNT_RAD,
	turnRotationAt,
	VIEWBOX_CENTER,
	VIEWBOX_SIZE,
} from "./utils.ts";

const easeInOut = cubicBezierEase([0.4, 0, 0, 1]);
const DEG = Math.PI / 180;

function restCorners(rotation: number) {
	const positions = getDotPositions(REST_RADIUS, rotation);
	const corner = (x: number, y: number) => positions.findIndex((position) => Math.sign(Math.round((position.x - VIEWBOX_CENTER) * 1e6)) === x && Math.sign(Math.round((position.y - VIEWBOX_CENTER) * 1e6)) === y);
	return { positions, topLeft: corner(-1, -1), topRight: corner(1, -1), bottomRight: corner(1, 1), bottomLeft: corner(-1, 1) };
}

test("every rest angle parks the rings in a square with one top-left to bottom-right diagonal", () => {
	for (let quarter = -2; quarter <= 5; quarter += 1) {
		const rotation = REST_ROTATION_PHASE + quarter * REST_ROTATION_PERIOD;
		const { positions, topLeft, topRight, bottomRight, bottomLeft } = restCorners(rotation);
		assert.deepEqual([topLeft, topRight, bottomRight, bottomLeft].every((index) => index >= 0), true, `quarter ${quarter} fills all four corners`);
		for (const position of positions) {
			assert.ok(position.x > DOT_RADIUS && position.x < VIEWBOX_SIZE - DOT_RADIUS);
			assert.ok(position.y > DOT_RADIUS && position.y < VIEWBOX_SIZE - DOT_RADIUS);
		}
		const [segment] = getRestPattern(rotation);
		assert.deepEqual([...(segment ?? [])].sort(), [topLeft, bottomRight].sort(), `quarter ${quarter} draws the top-left to bottom-right diagonal`);
	}
	assert.equal(restCorners(INITIAL_REST_ROTATION).topLeft, 0, "an idle mount puts ring 0 top-left");
	assert.deepEqual(getRestPattern(INITIAL_REST_ROTATION), [[0, 2]]);
});

test("rest and loop targets are always the next angle forward, never behind", () => {
	for (let degrees = -180; degrees <= 360; degrees += 7.5) {
		const from = degrees * DEG;
		const rest = nextForwardAngle(from, ROTATION_AMOUNT_RAD / 2, REST_ROTATION_PERIOD, REST_ROTATION_PHASE);
		assert.equal(rest - from >= ROTATION_AMOUNT_RAD / 2 - 1e-9, true, `rest from ${degrees}°`);
		assert.equal(rest - from < ROTATION_AMOUNT_RAD / 2 + REST_ROTATION_PERIOD, true, `rest from ${degrees}° is the nearest one`);
		assert.equal(Math.abs(Math.sin(2 * (rest - REST_ROTATION_PHASE))) < 1e-9, true);
	}
});

test("planned turns only move clockwise, including when they inherit a fast spin", () => {
	for (const velocity of [-3, 0, 1, 4, 12, 30]) {
		for (let degrees = 0; degrees < 90; degrees += 5) {
			const turn = planForwardTurn({
				from: degrees * DEG,
				velocity,
				duration: 0.4,
				period: REST_ROTATION_PERIOD,
				phase: REST_ROTATION_PHASE,
				minTravel: ROTATION_AMOUNT_RAD / 2,
			});
			let previous = turn.from;
			for (let i = 1; i <= 200; i += 1) {
				const next = turnRotationAt(turn, i / 200, easeInOut);
				assert.equal(next >= previous - 1e-9, true, `velocity ${velocity} from ${degrees}° steps back at ${i}`);
				previous = next;
			}
			assert.equal(Math.abs(turnRotationAt(turn, 1, easeInOut) - turn.to) < 1e-9, true, "the turn lands exactly on its target");
		}
	}
});
