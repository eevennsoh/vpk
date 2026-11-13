"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { startBackend } = require("./__fixtures__/start-backend");

// The real backend (development mode, where Express's default error page prints the
// stack) answers a disallowed origin and an unanswered /api request in the shared shape.
test("the real backend answers a disallowed origin with a JSON 403 and no stack", { timeout: 60_000 }, async (t) => {
	const backend = startBackend(t);
	const { host, port } = await backend.listening;
	const baseUrl = `http://${host}:${port}`;

	const rejected = await fetch(`${baseUrl}/api/rovo/threads`, {
		method: "POST",
		headers: { Origin: "http://evil.example", "Content-Type": "application/json" },
		body: "{}",
	});
	const rejectedText = await rejected.text();
	assert.equal(rejected.status, 403, rejectedText);
	assert.equal(rejected.headers.get("content-type"), "application/json; charset=utf-8");
	assert.deepEqual(JSON.parse(rejectedText), { error: "Origin not allowed.", code: "ORIGIN_NOT_ALLOWED" });
	assert.equal(rejectedText.includes(__dirname), false);

	const unanswered = await fetch(`${baseUrl}/api/does-not-exist`, { method: "POST" });
	assert.equal(unanswered.status, 404);
	assert.deepEqual(await unanswered.json(), { error: "API route not found: /api/does-not-exist", code: "NOT_FOUND" });

	// A same-origin request (no Origin header) is unaffected.
	const health = await fetch(`${baseUrl}/healthcheck`);
	assert.deepEqual(await health.json(), { status: "ok" });
});
