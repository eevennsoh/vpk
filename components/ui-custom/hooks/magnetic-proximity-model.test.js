const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveMagneticAxisOffset, resolveMagneticPointerRelation } = require("./magnetic-proximity-model.ts");

const TARGET_RECT = {
	bottom: 140,
	left: 100,
	right: 200,
	top: 100,
};

test("magnetic pointer relation distinguishes the target, its 24px halo, and outside", () => {
	assert.equal(resolveMagneticPointerRelation({ x: 150, y: 120 }, TARGET_RECT, 24), "target");
	assert.equal(resolveMagneticPointerRelation({ x: 90, y: 120 }, TARGET_RECT, 24), "near");
	assert.equal(resolveMagneticPointerRelation({ x: 76, y: 120 }, TARGET_RECT, 24), "near");
	assert.equal(resolveMagneticPointerRelation({ x: 75, y: 120 }, TARGET_RECT, 24), "outside");
	assert.equal(resolveMagneticPointerRelation({ x: 150, y: 165 }, TARGET_RECT, 24), "outside");
});

test("magnetic lean is proportional inside the target and bounded outside it", () => {
	assert.equal(resolveMagneticAxisOffset(0, 32, 10), 0);
	assert.equal(resolveMagneticAxisOffset(16, 32, 10), 5);
	assert.equal(resolveMagneticAxisOffset(-16, 32, 10), -5);
	assert.equal(resolveMagneticAxisOffset(32, 32, 10), 10);
	assert.equal(resolveMagneticAxisOffset(-32, 32, 10), -10);
	// A compact full-column target used to move 90px toward this pointer.
	assert.equal(resolveMagneticAxisOffset(-109, 12, 10), -10);
	assert.equal(resolveMagneticAxisOffset(56, 32, 10), 10);
	assert.equal(resolveMagneticAxisOffset(24, 0, 10), 0);
});
