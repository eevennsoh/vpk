"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveClientAddress, resolveTrustedProxyHops } = require("./client-address");

test("trusted proxy hops: 1 in production, 0 elsewhere, overridable, bad values fall back with a warning", () => {
	const warnings = [];
	const logger = { warn: (message) => warnings.push(message) };
	assert.equal(resolveTrustedProxyHops({ NODE_ENV: "production" }, logger), 1);
	assert.equal(resolveTrustedProxyHops({ NODE_ENV: "development" }, logger), 0);
	assert.equal(resolveTrustedProxyHops({}, logger), 0);
	assert.equal(resolveTrustedProxyHops({ NODE_ENV: "production", VPK_TRUSTED_PROXY_HOPS: "0" }, logger), 0);
	assert.equal(resolveTrustedProxyHops({ NODE_ENV: "production", VPK_TRUSTED_PROXY_HOPS: "2" }, logger), 2);
	assert.deepEqual(warnings, []);
	for (const value of ["-1", "1.5", "two", "9"]) {
		assert.equal(resolveTrustedProxyHops({ NODE_ENV: "production", VPK_TRUSTED_PROXY_HOPS: value }, logger), 1, value);
	}
	assert.equal(warnings.length, 4);
});

test("the client address is the entry the trusted proxies appended, never one the client chose", () => {
	const request = (forwardedFor) => ({ headers: forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor }, socket: { remoteAddress: "10.0.0.1" } });
	assert.equal(resolveClientAddress(request("192.0.2.1, 203.0.113.5"), 0), "10.0.0.1", "no trusted hop: the socket");
	assert.equal(resolveClientAddress(request("192.0.2.1, 203.0.113.5"), 1), "203.0.113.5");
	assert.equal(resolveClientAddress(request("192.0.2.1, 198.51.100.2, 203.0.113.5"), 2), "198.51.100.2");
	assert.equal(resolveClientAddress(request(["192.0.2.1", "203.0.113.5"]), 1), "203.0.113.5", "repeated headers");
	assert.equal(resolveClientAddress(request("203.0.113.5"), 3), "203.0.113.5", "a shorter chain: its leftmost entry");
	assert.equal(resolveClientAddress(request(undefined), 1), "10.0.0.1", "no header: the socket");
	assert.equal(resolveClientAddress(request(" , "), 1), "10.0.0.1");
	assert.equal(resolveClientAddress({}, 1), "unknown");
});
