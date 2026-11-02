import assert from "node:assert/strict";
import { test } from "node:test";

import { DOT_RADIUS, getRestPositions, REST_PATTERN, VIEWBOX_SIZE } from "./utils.ts";

test("the resting teamwork graph is a square of rings with one diagonal", () => {
	const positions = getRestPositions();
	assert.equal(positions.length, 4);
	const [topLeft, topRight, bottomRight, bottomLeft] = positions;
	assert.ok(topLeft && topRight && bottomRight && bottomLeft);
	assert.ok(topLeft.x < topRight.x);
	assert.ok(topLeft.y < bottomLeft.y);
	assert.equal(topLeft.y, topRight.y);
	assert.equal(bottomLeft.y, bottomRight.y);
	assert.equal(topLeft.x, bottomLeft.x);
	assert.equal(topRight.x, bottomRight.x);
	for (const position of positions) {
		assert.ok(position.x > DOT_RADIUS && position.x < VIEWBOX_SIZE - DOT_RADIUS);
		assert.ok(position.y > DOT_RADIUS && position.y < VIEWBOX_SIZE - DOT_RADIUS);
	}
	const [segment] = REST_PATTERN;
	assert.deepEqual(segment, [0, 2]);
	const span = Math.hypot(bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
	assert.ok(span > DOT_RADIUS * 2);
});
