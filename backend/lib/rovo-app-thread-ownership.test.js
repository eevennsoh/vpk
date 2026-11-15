"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { registerChatThreadOwnershipGuards } = require("./rovo-app-thread-ownership");
const { createCallerIdentityMiddleware } = require("../middleware/caller-identity");

async function withChatApp(env, run) {
	const threads = new Map([
		["thread-a", { id: "thread-a", owner: "alice", sessionId: "session-a" }],
		["thread-run", { id: "thread-run", owner: "alice", sessionId: null, activeRun: { sessionId: "session-run" } }],
		["thread-legacy", { id: "thread-legacy", owner: null, sessionId: "session-legacy" }],
	]);
	const rovoAppThreadManager = {
		getThread: async (id) => threads.get(id) || null,
		listThreads: async ({ filter, limit } = {}) => [...threads.values()].filter((thread) => !filter || filter(thread)).slice(0, limit),
	};
	const reached = [];
	const app = express();
	app.use(createCallerIdentityMiddleware({ env, logger: { log() {}, warn() {} } }));
	app.use(express.json());
	registerChatThreadOwnershipGuards(app, { rovoAppThreadManager });
	for (const routePath of ["/api/chat-sdk", "/api/rovo/chat", "/api/chat-cancel", "/api/chat-sdk/skip-question"]) {
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

test("in production skip-question only restores a Rovo session that one of the caller's threads stores", async () => {
	await withChatApp({ NODE_ENV: "production" }, async (baseUrl, reached) => {
		for (const sessionId of ["session-a", "session-run", "session-legacy", "session-unbound"]) {
			const response = await post(baseUrl, "/api/chat-sdk/skip-question", "bob", { sessionId });
			assert.equal(response.status, 404, sessionId);
			assert.deepEqual(await response.json(), { error: "Session not found" });
		}
		assert.deepEqual(reached, []);

		for (const sessionId of ["session-a", "session-run"]) {
			assert.equal((await post(baseUrl, "/api/chat-sdk/skip-question", "alice", { sessionId })).status, 200, sessionId);
		}
		// A skip without a session restores nothing, so it needs no thread.
		assert.equal((await post(baseUrl, "/api/chat-sdk/skip-question", "bob", {})).status, 200);
		assert.equal((await post(baseUrl, "/api/chat-sdk/skip-question", null, { sessionId: "session-a" })).status, 401);
		assert.equal(reached.length, 3);
	});
});

test("outside production skip-question restores any session for the local caller", async () => {
	await withChatApp({}, async (baseUrl, reached) => {
		for (const sessionId of ["session-a", "session-unbound"]) {
			assert.equal((await post(baseUrl, "/api/chat-sdk/skip-question", "bob", { sessionId })).status, 200, sessionId);
		}
		assert.equal(reached.length, 2);
	});
});

test("registerChatThreadOwnershipGuards needs a thread manager that can list threads", () => {
	assert.throws(
		() => registerChatThreadOwnershipGuards(express(), { rovoAppThreadManager: { getThread: async () => null } }),
		/rovoAppThreadManager\.listThreads/u,
	);
});
