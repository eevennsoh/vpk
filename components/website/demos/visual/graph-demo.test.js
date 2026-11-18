const assert = require("node:assert/strict");
const test = require("node:test");
const { ROVO_GRAPH_DECLARED_DEFAULT_PARAMS } = require("./graph-defaults.ts");
const { clampNeuralGraphParams } = require("@/components/arts/personal-graph/lib/neural-graph/params.ts");

test("every numeric graph demo default survives clamping unchanged", () => {
	const clamped = clampNeuralGraphParams(ROVO_GRAPH_DECLARED_DEFAULT_PARAMS);
	const mismatches = Object.entries(ROVO_GRAPH_DECLARED_DEFAULT_PARAMS)
		.filter(([key, declared]) => typeof declared === "number" && declared !== clamped[key])
		.map(([key, declared]) => ({ key, declared, clamped: clamped[key] }));

	assert.deepEqual(mismatches, []);
});
