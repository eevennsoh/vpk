"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createConnectionLimiter, startHeartbeat, trackHeartbeat } = require("./ws-connection-limits");

test("the connection limiter caps sockets in total and per address, and release frees a slot once", () => {
	const limiter = createConnectionLimiter({ maxTotal: 3, maxPerAddress: 2 });
	const a1 = limiter.tryAcquire("10.0.0.1");
	const a2 = limiter.tryAcquire("10.0.0.1");
	assert.equal(limiter.tryAcquire("10.0.0.1"), null, "per-address cap");
	const b1 = limiter.tryAcquire("10.0.0.2");
	assert.equal(limiter.tryAcquire("10.0.0.3"), null, "total cap");
	assert.equal(limiter.size, 3);
	a1();
	a1();
	assert.equal(limiter.size, 2, "a second release does nothing");
	assert.equal(typeof limiter.tryAcquire("10.0.0.1"), "function");
	a2();
	b1();
	assert.equal(typeof limiter.tryAcquire(undefined), "function", "no address shares one key");
});

test("the heartbeat pings live sockets and terminates one that missed the previous ping", () => {
	let tick;
	let cleared = null;
	const stop = startHeartbeat([{ clients: [] }], {
		intervalMs: 1,
		setIntervalImpl: (fn) => {
			tick = fn;
			return { unref() {} };
		},
		clearIntervalImpl: (timer) => {
			cleared = timer;
		},
	});
	const makeSocket = () => {
		const listeners = new Map();
		const socket = { pings: 0, terminated: false, on: (event, fn) => listeners.set(event, fn), ping() { this.pings += 1; }, terminate() { this.terminated = true; }, pong: () => listeners.get("pong")() };
		trackHeartbeat(socket);
		return socket;
	};
	const answering = makeSocket();
	const silent = makeSocket();
	const servers = [{ clients: [answering] }, { clients: [silent] }];
	const stopBoth = startHeartbeat(servers, { setIntervalImpl: (fn) => { tick = fn; return { unref() {} }; }, clearIntervalImpl() {} });
	tick();
	answering.pong();
	tick();
	assert.equal(answering.terminated, false);
	assert.equal(answering.pings, 2);
	assert.equal(silent.terminated, true, "no pong since the first ping");
	stopBoth();
	stop();
	assert.notEqual(cleared, null);
});
