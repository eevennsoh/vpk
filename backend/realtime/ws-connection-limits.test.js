"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { WS_MAX_CONNECTIONS, createConnectionLimiter, resolveConnectionLimits, startHeartbeat, trackHeartbeat } = require("./ws-connection-limits");

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

test("by default the only cap is the total: the 65th socket from one address is refused, the 17th is not", () => {
	const limits = resolveConnectionLimits({}, { warn() {} });
	assert.deepEqual(limits, { maxTotal: 64, maxPerAddress: 64 });
	const limiter = createConnectionLimiter(limits);
	for (let index = 0; index < WS_MAX_CONNECTIONS; index += 1) {
		assert.equal(typeof limiter.tryAcquire("10.0.0.1"), "function", `socket ${index + 1}`);
	}
	assert.equal(limiter.tryAcquire("10.0.0.1"), null, "socket 65");
	assert.equal(limiter.tryAcquire("10.0.0.2"), null, "the total applies to every address");
});

test("both caps are configurable; an unusable value falls back with a log line", () => {
	const warnings = [];
	const logger = { warn: (message) => warnings.push(message) };
	assert.deepEqual(resolveConnectionLimits({ VPK_WS_MAX_CONNECTIONS: "200", VPK_WS_MAX_CONNECTIONS_PER_ADDRESS: "8" }, logger), { maxTotal: 200, maxPerAddress: 8 });
	assert.deepEqual(resolveConnectionLimits({ VPK_WS_MAX_CONNECTIONS: "10", VPK_WS_MAX_CONNECTIONS_PER_ADDRESS: "50" }, logger), { maxTotal: 10, maxPerAddress: 10 }, "never above the total");
	assert.deepEqual(warnings, []);
	for (const value of ["0", "-3", "2.5", "many", "1e3"]) {
		assert.deepEqual(resolveConnectionLimits({ VPK_WS_MAX_CONNECTIONS: value, VPK_WS_MAX_CONNECTIONS_PER_ADDRESS: value }, logger), { maxTotal: 64, maxPerAddress: 64 }, value);
	}
	assert.equal(warnings.length, 10);
	assert.match(warnings[0], /VPK_WS_MAX_CONNECTIONS is not a positive integer/u);

	const limiter = createConnectionLimiter(resolveConnectionLimits({ VPK_WS_MAX_CONNECTIONS_PER_ADDRESS: "2" }, logger));
	limiter.tryAcquire("10.0.0.1");
	limiter.tryAcquire("10.0.0.1");
	assert.equal(limiter.tryAcquire("10.0.0.1"), null, "a configured per-address cap is enforced");
	assert.equal(typeof limiter.tryAcquire("10.0.0.2"), "function");
});
