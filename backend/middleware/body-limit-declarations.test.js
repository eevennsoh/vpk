"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { collectRouteManifest } = require("../routes/route-manifest");
const { BODY_LIMIT_DECLARATIONS } = require("./body-limit-declarations");
const { resolveJsonBodyLimit } = require("./body-limits");

// Mounted on the app before the body parsers (backend/app.js), so no JSON limit applies.
const MOUNTED_BEFORE_PARSERS = new Set(["/api/local-folder"]);

const bodyRoutes = collectRouteManifest().backendRoutes
	.filter((route) => route.method !== "GET" && route.method !== "HEAD")
	.map((route) => `${route.method} ${route.path}`);

test("every route that can take a body declares its largest legitimate body and its limit", () => {
	const undeclared = bodyRoutes.filter((key) => !(key in BODY_LIMIT_DECLARATIONS));
	assert.deepEqual(
		undeclared,
		[],
		"Declare each new route in backend/middleware/body-limit-declarations.js with the largest body the frontend sends; if it is over 1 MB, give its path an explicit limit in body-limits.js.",
	);
	const stale = Object.keys(BODY_LIMIT_DECLARATIONS).filter((key) => !bodyRoutes.includes(key));
	assert.deepEqual(stale, [], "Remove declarations for routes that no longer exist.");
});

test("each declared limit is the limit body-limits.js applies to that path", () => {
	for (const [key, { limit, body }] of Object.entries(BODY_LIMIT_DECLARATIONS)) {
		const routePath = key.slice(key.indexOf(" ") + 1);
		const applied = MOUNTED_BEFORE_PARSERS.has(routePath) ? "none" : resolveJsonBodyLimit(routePath);
		assert.equal(limit, applied, `${key}: declared ${limit}, applied ${applied}`);
		assert.equal(typeof body, "string", key);
		assert.ok(body.length > 0, key);
	}
});

test("resolveJsonBodyLimit matches whole segments, case-insensitively, first entry first", () => {
	assert.equal(resolveJsonBodyLimit("/api/rovo/threads/:threadId"), "50mb");
	assert.equal(resolveJsonBodyLimit("/API/ROVO/THREADS"), "50mb");
	assert.equal(resolveJsonBodyLimit("/api/rovo/threadsx"), "1mb");
	assert.equal(resolveJsonBodyLimit("/api/chat-sdk/skip-question"), "8mb");
	assert.equal(resolveJsonBodyLimit("/api/agent-mode"), "1mb");
});
