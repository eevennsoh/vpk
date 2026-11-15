"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { createCallerIdentityMiddleware, getRequestCaller } = require("./caller-identity");
const { resolveCallerIdentityMode, readSlauthSubject, isOwnedByCaller } = require("../lib/caller-identity");

const silent = { log: () => {}, warn: () => {} };

async function withApp(env, run) {
	const app = express();
	app.use(createCallerIdentityMiddleware({ env, logger: silent }));
	app.get("/healthcheck", (_req, res) => res.json({ ok: true }));
	app.get("/api/whoami", (req, res) => res.json({ caller: getRequestCaller(req) }));
	app.get("/index.html", (_req, res) => res.type("html").send("<p>page</p>"));
	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		await run(`http://127.0.0.1:${server.address().port}`);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

test("in production a request without X-Slauth-Subject gets 401, pages and API alike", async () => {
	await withApp({ NODE_ENV: "production" }, async (baseUrl) => {
		for (const route of ["/api/whoami", "/index.html"]) {
			const response = await fetch(`${baseUrl}${route}`);
			assert.equal(response.status, 401, route);
			assert.deepEqual(await response.json(), { error: "Authentication required", code: "CALLER_IDENTITY_REQUIRED" });
		}
		const blank = await fetch(`${baseUrl}/api/whoami`, { headers: { "x-slauth-subject": "   " } });
		assert.equal(blank.status, 401);
	});
});

test("in production the caller is the X-Slauth-Subject the sidecar set", async () => {
	await withApp({ NODE_ENV: "production" }, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/whoami`, { headers: { "x-slauth-subject": "alice" } });
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { caller: { owner: "alice", local: false } });
	});
});

test("/healthcheck stays open in production on every spelling Express routes to it", async () => {
	await withApp({ NODE_ENV: "production" }, async (baseUrl) => {
		for (const route of ["/healthcheck", "/healthcheck/", "/HealthCheck"]) {
			const response = await fetch(`${baseUrl}${route}`);
			assert.equal(response.status, 200, route);
		}
	});
});

test("outside production every caller is the fixed owner local, whatever headers they send", async () => {
	await withApp({}, async (baseUrl) => {
		for (const headers of [{}, { "x-slauth-subject": "alice" }]) {
			const response = await fetch(`${baseUrl}/api/whoami`, { headers });
			assert.deepEqual(await response.json(), { caller: { owner: "local", local: true } });
		}
	});
});

test("VPK_CALLER_IDENTITY picks the mode explicitly, and an unknown value fails closed in production", () => {
	assert.equal(resolveCallerIdentityMode({ NODE_ENV: "production" }, silent), "slauth");
	assert.equal(resolveCallerIdentityMode({}, silent), "local");
	assert.equal(resolveCallerIdentityMode({ NODE_ENV: "production", VPK_CALLER_IDENTITY: "local" }, silent), "local");
	assert.equal(resolveCallerIdentityMode({ VPK_CALLER_IDENTITY: "slauth" }, silent), "slauth");
	assert.equal(resolveCallerIdentityMode({ NODE_ENV: "production", VPK_CALLER_IDENTITY: "off" }, silent), "slauth");
});

test("a subject with control characters, or one too long, is not a subject", () => {
	assert.equal(readSlauthSubject({ "x-slauth-subject": "alice" }), "alice");
	assert.equal(readSlauthSubject({ "x-slauth-subject": ["alice", "bob"] }), "alice");
	assert.equal(readSlauthSubject({ "x-slauth-subject": "ali\u0000ce" }), null);
	assert.equal(readSlauthSubject({ "x-slauth-subject": "x".repeat(257) }), null);
	assert.equal(readSlauthSubject({}), null);
});

test("a record without an owner belongs only to a local caller", () => {
	assert.equal(isOwnedByCaller(null, { owner: "local", local: true }), true);
	assert.equal(isOwnedByCaller(null, { owner: "alice", local: false }), false);
	assert.equal(isOwnedByCaller("alice", { owner: "alice", local: false }), true);
	assert.equal(isOwnedByCaller("alice", { owner: "bob", local: false }), false);
	assert.equal(isOwnedByCaller("alice", null), false);
});
