const assert = require("node:assert/strict");
const test = require("node:test");
const { isRetiredRovoThreadId } = require("./rovo-retired-routes");

test("retired control surfaces cannot be interpreted as chat identities", () => {
	for (const id of ["jobs", "memories", "skills", "settings"]) {
		assert.equal(isRetiredRovoThreadId(id), true);
	}
	for (const id of [undefined, "", "thread-1", "skills-discussion", "agents", "tasks"]) {
		assert.equal(isRetiredRovoThreadId(id), false);
	}
});
