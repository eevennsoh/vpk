const assert = require("node:assert/strict");
const test = require("node:test");
const { ROVO_GRAPH_DEFAULT_PARAMS } = require("./graph-defaults.ts");

// Listed until the product decision changes the default to 0.5 or the step to 0.01.
test("clamped default graph parameters preserve the declared originY and rayOriginY of 0.52", () => {
	assert.deepEqual({
		originY: ROVO_GRAPH_DEFAULT_PARAMS.originY,
		rayOriginY: ROVO_GRAPH_DEFAULT_PARAMS.rayOriginY,
	}, { originY: 0.52, rayOriginY: 0.52 });
});
