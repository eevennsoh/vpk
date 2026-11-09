const test = require("node:test");
const assert = require("node:assert/strict");

const {
	SMART_ROUTE_TARGET_SURFACES,
	isSmartRouteTargetSurface,
} = require("./smart-generation-surface-gate");

test("isSmartRouteTargetSurface includes rovo surfaces", () => {
	assert.equal(isSmartRouteTargetSurface("rovo"), true);
	assert.equal(isSmartRouteTargetSurface("rovo-preview"), true);
});

test("isSmartRouteTargetSurface rejects unsupported surfaces", () => {
	assert.equal(isSmartRouteTargetSurface("sidebar"), true);
	assert.equal(isSmartRouteTargetSurface("unknown-surface"), false);
	assert.equal(isSmartRouteTargetSurface(null), false);
	assert.deepEqual(Array.from(SMART_ROUTE_TARGET_SURFACES), [
		"multiport",
		"sidebar",
		"fullscreen",
		"rovo",
		"rovo-preview",
	]);
});
