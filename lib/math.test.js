const test = require("node:test");
const assert = require("node:assert/strict");

const { clamp, lerp } = require("./math.ts");

test("clamp keeps values in range, lets min win an inverted range, and passes NaN through", () => {
	assert.equal(clamp(5, 0, 10), 5);
	assert.equal(clamp(-1, 0, 10), 0);
	assert.equal(clamp(11, 0, 10), 10);
	assert.equal(clamp(5, 10, 0), 10);
	assert.ok(Number.isNaN(clamp(Number.NaN, 0, 1)));
});

test("lerp reaches its ends at 0 and 1 and extrapolates outside them", () => {
	assert.equal(lerp(2, 10, 0), 2);
	assert.equal(lerp(2, 10, 1), 10);
	assert.equal(lerp(2, 10, 0.25), 4);
	assert.equal(lerp(2, 10, 1.5), 14);
	assert.equal(lerp(10, 2, 0.5), 6);
});
