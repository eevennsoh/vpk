"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { HeadlessMirrorBrowser, closeAllMirrorBrowsers } = require("./rovo-app-browser-mirror");

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

test("attaching a client to a mirror whose first capture fails never becomes an unhandled rejection", async (t) => {
	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);
	t.after(() => process.off("unhandledRejection", onUnhandled));
	const warn = t.mock.method(console, "warn", () => {});

	const mirror = new HeadlessMirrorBrowser({ mirrorId: "mirror-1" });
	mirror._page = {
		screenshot: async () => {
			throw new Error("Target page, context or browser has been closed");
		},
	};
	const ws = { readyState: 1, sent: [], send(payload) { this.sent.push(payload); }, on() {} };
	assert.doesNotThrow(() => mirror.attachClient(ws));
	await new Promise(setImmediate);
	await new Promise(setImmediate);

	assert.deepEqual(unhandled, []);
	assert.equal(mirror.isScreencasting(), false);
	assert.equal(warn.mock.calls.some((call) => String(call.arguments[0]).includes("Screencast start failed")), true);
});

test("two attaches racing on a mirror start one screencast interval", async (t) => {
	const intervals = [];
	t.mock.method(globalThis, "setInterval", (fn) => {
		const timer = { fn, unref() {} };
		intervals.push(timer);
		return timer;
	});
	t.mock.method(globalThis, "clearInterval", () => {});
	let releaseCapture;
	const captured = new Promise((resolve) => {
		releaseCapture = resolve;
	});
	const mirror = new HeadlessMirrorBrowser({ mirrorId: "mirror-race" });
	mirror._page = { screenshot: async () => { await captured; return Buffer.from("jpeg"); } };
	const client = () => ({ readyState: 1, send() {}, on() {} });
	mirror.attachClient(client());
	mirror.attachClient(client());
	releaseCapture();
	await new Promise(setImmediate);
	await new Promise(setImmediate);
	assert.equal(intervals.length, 1);
	assert.equal(mirror.isScreencasting(), true);
});
