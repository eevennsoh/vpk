"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { registerChatThreadOwnershipGuards } = require("./rovo-app-thread-ownership");
const { createCallerIdentityMiddleware } = require("../middleware/caller-identity");

async function withChatApp(env, run) {
	const threads = new Map([
		["thread-a", { id: "thread-a", owner: "alice" }],
		["thread-legacy", { id: "thread-legacy", owner: null }],
	]);
	const reached = [];
	const app = express();
	app.use(createCallerIdentityMiddleware({ env, logger: { log() {}, warn() {} } }));
	app.use(express.json());
	registerChatThreadOwnershipGuards(app, { rovoAppThreadManager: { getThread: async (id) => threads.get(id) || null } });
	for (const routePath of ["/api/chat-sdk", "/api/rovo/chat", "/api/chat-cancel"]) {
		app.post(routePath, (req, res) => {
			reached.push(routePath);
			res.status(200).json({ ok: true });
		});
	}
	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		await run(`http://127.0.0.1:${server.address().port}`, reached);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

const post = (baseUrl, path, subject, body) => fetch(`${baseUrl}${path}`, {
	method: "POST",
	headers: { "content-type": "application/json", ...(subject ? { "x-slauth-subject": subject } : {}) },
	body: JSON.stringify(body || {}),
});

test("in production a chat request naming another caller's thread gets 404 and never reaches the handler", async () => {
	await withChatApp({ NODE_ENV: "production" }, async (baseUrl, reached) => {
		for (const [path, body] of [
			["/api/chat-sdk", { id: "thread-a" }],
			["/api/rovo/chat", { id: "thread-a" }],
			["/api/chat-cancel?threadId=thread-a", {}],
			["/api/chat-sdk", { id: "thread-legacy" }],
		]) {
			const response = await post(baseUrl, path, "bob", body);
			assert.equal(response.status, 404, `${path} ${JSON.stringify(body)}`);
			assert.deepEqual(await response.json(), { error: "Thread not found" });
		}
		assert.deepEqual(reached, []);

		assert.equal((await post(baseUrl, "/api/chat-sdk", "alice", { id: "thread-a" })).status, 200);
		assert.equal((await post(baseUrl, "/api/chat-cancel?threadId=thread-a", "alice")).status, 200);
		// A new thread (not stored yet) passes, for the handler to create.
		assert.equal((await post(baseUrl, "/api/chat-sdk", "bob", { id: "thread-new" })).status, 200);
		assert.deepEqual(reached, ["/api/chat-sdk", "/api/chat-cancel", "/api/chat-sdk"]);
	});
});

test("outside production the local caller reaches every chat thread, including ones with no owner", async () => {
	await withChatApp({}, async (baseUrl, reached) => {
		assert.equal((await post(baseUrl, "/api/chat-sdk", null, { id: "thread-legacy" })).status, 200);
		assert.equal((await post(baseUrl, "/api/rovo/chat", null, { id: "thread-new" })).status, 200);
		assert.equal(reached.length, 2);
	});
});
