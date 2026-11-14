const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoPortLease, createUnpooledPortHandle } = require("./rovo-port-lease");

function createHandle() {
	const calls = [];
	return {
		calls,
		handle: {
			port: 9001,
			reserve: (reason) => calls.push(["reserve", reason]),
			settleLease: (disposition, options) => {
				calls.push(["settleLease", disposition, options]);
				return true;
			},
		},
	};
}

test("a held lease settles once", () => {
	const { calls, handle } = createHandle();
	const warnings = [];
	const lease = createRovoPortLease(handle, { logPrefix: "test", logger: { warn: (message) => warnings.push(message) } });

	assert.equal(lease.isHeld(), true);
	assert.equal(lease.settle("unhealthy", " stuck "), true);
	assert.equal(lease.settle("release"), false);
	assert.equal(lease.state, "settled");
	assert.deepEqual(calls, [["settleLease", "unhealthy", { reason: "stuck" }]]);
	assert.deepEqual(warnings, ["[test] Marking port 9001 unhealthy: stuck"]);
});

test("a handed-off lease is reserved for the paused tool call and never settled by its caller", () => {
	const { calls, handle } = createHandle();
	const lease = createRovoPortLease(handle, { logger: { warn: () => {} } });

	assert.equal(lease.handOff(), handle);
	assert.equal(lease.isHeld(), false);
	// Asked again while handed off: the same handle, reserved once.
	assert.equal(lease.handOff(), handle);
	assert.equal(lease.settle("release"), false);
	assert.equal(lease.settle("unhealthy", "late"), false);
	assert.deepEqual(calls, [["reserve", "paused tool call"]]);
});

test("the unpooled handle ends once, like a pooled lease", () => {
	const handle = createUnpooledPortHandle(8000);
	assert.equal(handle.port, 8000);
	assert.equal(handle.settleLease("unhealthy"), true);
	assert.equal(handle.settleLease("release"), false);
});

test("a settled lease hands off nothing, and the unhealthy warning can be turned off", () => {
	const { calls, handle } = createHandle();
	const warnings = [];
	const lease = createRovoPortLease(handle, { logUnhealthy: false, logger: { warn: (message) => warnings.push(message) } });

	lease.settle("unhealthy", "stuck");
	assert.equal(lease.handOff(), null);
	assert.deepEqual(warnings, []);
	assert.deepEqual(calls, [["settleLease", "unhealthy", { reason: "stuck" }]]);
});
