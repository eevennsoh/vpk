"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
	createRequireLocalDevRequest,
	isLoopbackRequest,
	resolveBackendListenHost,
} = require("./local-only");

function request({ address = "127.0.0.1", hostname = "localhost", origin } = {}) {
	return { socket: { remoteAddress: address }, hostname, get: (name) => (name === "origin" ? origin : undefined) };
}

function run(middleware, req) {
	const result = { nextCalled: false, status: null, body: null };
	const res = {
		status(code) { result.status = code; return this; },
		json(body) { result.body = body; return this; },
	};
	middleware(req, res, () => { result.nextCalled = true; });
	return result;
}

test("the dev backend binds loopback; production keeps all interfaces", () => {
	assert.equal(resolveBackendListenHost({}), "127.0.0.1");
	assert.equal(resolveBackendListenHost({ NODE_ENV: "development" }), "127.0.0.1");
	assert.equal(resolveBackendListenHost({ NODE_ENV: "production" }), "0.0.0.0");
});

test("isLoopbackRequest accepts the server-side dev proxy and local browser origins only", () => {
	assert.equal(isLoopbackRequest(request()), true, "Next dev proxy: loopback, no Origin");
	assert.equal(isLoopbackRequest(request({ address: "::1" })), true);
	assert.equal(isLoopbackRequest(request({ origin: "https://feature.vpk.localhost" })), true);
	assert.equal(isLoopbackRequest(request({ address: "192.168.1.20" })), false, "LAN peer");
	assert.equal(isLoopbackRequest(request({ hostname: "rebound.example" })), false, "DNS rebinding");
	assert.equal(isLoopbackRequest(request({ origin: "https://evil.example" })), false, "cross-site page");
	assert.equal(isLoopbackRequest(request({ origin: "null" })), false);
	assert.equal(isLoopbackRequest(request(), { requireOrigin: true }), false);
});

test("requireLocalDevRequest is 404 in production and 403 for non-local requests", () => {
	const production = run(createRequireLocalDevRequest({ env: { NODE_ENV: "production" } }), request());
	assert.deepEqual([production.status, production.nextCalled], [404, false]);

	const dev = createRequireLocalDevRequest({ env: {} });
	const remote = run(dev, request({ address: "10.0.0.7" }));
	assert.deepEqual([remote.status, remote.nextCalled], [403, false]);
	assert.deepEqual(remote.body, { error: "Only local requests are allowed" });

	const local = run(dev, request());
	assert.deepEqual([local.status, local.nextCalled], [null, true]);
});
