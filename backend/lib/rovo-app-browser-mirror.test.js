"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { closeAllMirrorBrowsers } = require("./rovo-app-browser-mirror");

function deferred() {
	let resolve;
	const promise = new Promise((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

test("closeAllMirrorBrowsers closes every registered mirror, then finds none", async () => {
	const closed = [];
	const registry = new Map([
		["mirror-a", { close: async () => closed.push("mirror-a") }],
		["mirror-b", { close: async () => { closed.push("mirror-b"); throw new Error("already gone"); } }],
	]);

	assert.equal(await closeAllMirrorBrowsers({ registry, closing: new Set() }), 2);
	assert.deepEqual(closed.sort(), ["mirror-a", "mirror-b"]);
	assert.equal(registry.size, 0);
	assert.equal(await closeAllMirrorBrowsers({ registry, closing: new Set() }), 0);
});

test("closeAllMirrorBrowsers waits for a close another caller already started", async () => {
	const gate = deferred();
	let finished = false;
	const inFlight = gate.promise.then(() => {
		finished = true;
	});
	const result = closeAllMirrorBrowsers({ registry: new Map(), closing: new Set([inFlight]) }).then((count) => ({ count, finished }));
	gate.resolve();
	assert.deepEqual(await result, { count: 0, finished: true });
});
