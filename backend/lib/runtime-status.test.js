const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRuntimeStatusSnapshot } = require("./runtime-status");

test("runtime status reports only Rovo availability", () => {
	for (const [health, available, expected] of [["ok", true, "ok"], ["degraded", true, "degraded"], ["down", false, "down"]]) {
		const snapshot = buildRuntimeStatusSnapshot({ rovo: { available, health }, removedSurface: { available: false } });
		assert.equal(snapshot.status, expected);
		assert.deepEqual(Object.keys(snapshot.surfaces), ["rovo"]);
		assert.deepEqual(snapshot.degradedSurfaces, health === "ok" ? [] : ["rovo"]);
	}
});
