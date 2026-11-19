"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { createCallerIdentityMiddleware } = require("../middleware/caller-identity");
const {
	createChatControlRouter,
	registerChatControlRoutes,
} = require("./chat-control");

const PRODUCTION_ENV = Object.freeze({ NODE_ENV: "production" });

async function withServer(overrides, run, { env } = {}) {
	const app = express();
	app.use(express.json());
	if (env) {
		app.use(createCallerIdentityMiddleware({ env, logger: { log() {}, warn() {} } }));
	}
	const threads = new Map();
	const calls = {
		cancelActive: [],
		cancelChat: [],
		cancelPaused: [],
		clearActive: [],
		clearPlanSession: [],
		detachPaused: [],
		waitForReady: [],
	};
	const activeRequests = new Map([
		[
			"thread-active",
			{
				port: 8123,
				abortController: {
					aborted: false,
					abort() {
						this.aborted = true;
					},
				},
			},
		],
	]);
	const activeDeferredRecords = new Map();
	const pausedDeferredRecords = new Map();
	const dependencies = {
		activeRequests,
		cancelActiveDeferredToolCallRecord: async (record, options) => {
			calls.cancelActive.push({ record, options });
		},
		cancelChat: async (...args) => {
			calls.cancelChat.push(args);
		},
		cancelPausedDeferredToolCallRecord: async (record, options) => {
			calls.cancelPaused.push({ record, options });
		},
		clearActiveDeferredToolCall: (toolCallId) => {
			calls.clearActive.push(toolCallId);
			const record = activeDeferredRecords.get(toolCallId) || null;
			activeDeferredRecords.delete(toolCallId);
			return record;
		},
		clearPlanSession: (threadId) => {
			calls.clearPlanSession.push(threadId);
		},
		detachPausedRovoToolCall: (toolCallId) => {
			calls.detachPaused.push(toolCallId);
			const record = pausedDeferredRecords.get(toolCallId) || null;
			pausedDeferredRecords.delete(toolCallId);
			return record;
		},
		logger: {
			error() {},
			log() {},
			warn() {},
		},
		peekDeferredToolCall: (toolCallId) => ({
			active: activeDeferredRecords.get(toolCallId) || null,
			paused: pausedDeferredRecords.get(toolCallId) || null,
		}),
		rovoAppThreadManager: {
			getThread: async (threadId) => threads.get(threadId) || null,
		},
		waitForReady: async (...args) => {
			calls.waitForReady.push(args);
		},
		...overrides,
	};
	registerChatControlRoutes(app, dependencies);

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl, {
			activeDeferredRecords,
			activeRequests,
			calls,
			pausedDeferredRecords,
			threads,
		});
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

async function postJson(baseUrl, path, body, { subject } = {}) {
	const response = await fetch(`${baseUrl}${path}`, {
		body: JSON.stringify(body),
		headers: {
			"content-type": "application/json",
			...(subject ? { "x-slauth-subject": subject } : {}),
		},
		method: "POST",
	});
	return {
		body: await response.json(),
		status: response.status,
	};
}

test("chat control router validates required dependencies", () => {
	assert.throws(() => createChatControlRouter(), /activeRequests/u);
	assert.throws(
		() => createChatControlRouter({ activeRequests: new Map() }),
		/cancelActiveDeferredToolCallRecord/u,
	);
});

test("chat cancel route delegates to the shared cancel helper", async () => {
	await withServer({}, async (baseUrl, { activeRequests, calls }) => {
		const result = await postJson(
			baseUrl,
			"/api/chat-cancel?threadId=thread-active",
			{},
		);

		assert.equal(result.status, 200);
		assert.deepEqual(result.body, {
			cancelled: true,
			threadId: "thread-active",
			port: 8123,
		});
		assert.deepEqual(calls.cancelChat, [[8123]]);
		assert.equal(activeRequests.has("thread-active"), false);
	});
});

test("cancel deferred tool validates missing ids and acknowledges AI Gateway cards", async () => {
	await withServer({}, async (baseUrl) => {
		const missing = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", {});
		assert.equal(missing.status, 400);
		assert.deepEqual(missing.body, { error: "toolCallId is required" });

		const gateway = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", {
			toolCallId: "ai-gateway-clarification-123",
		});
		assert.equal(gateway.status, 200);
		assert.deepEqual(gateway.body, {
			cancelled: true,
			kind: "ai-gateway-clarification",
			toolCallId: "ai-gateway-clarification-123",
		});
	});
});

test("cancel deferred tool cancels active records and clears active plan threads", async () => {
	await withServer({}, async (baseUrl, {
		activeDeferredRecords,
		activeRequests,
		calls,
	}) => {
		activeRequests.set("thread-plan", { port: 8124 });
		activeDeferredRecords.set("tool-plan", {
			kind: "plan-approval",
			port: 8124,
			threadId: "thread-plan",
			toolCallId: "tool-plan",
		});

		const result = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", {
			toolCallId: "tool-plan",
		});

		assert.equal(result.status, 200);
		assert.deepEqual(result.body, {
			cancelled: true,
			kind: "plan-approval",
			port: 8124,
			threadId: "thread-plan",
			toolCallId: "tool-plan",
		});
		assert.equal(calls.cancelActive.length, 1);
		assert.equal(calls.cancelActive[0].record.toolCallId, "tool-plan");
		assert.equal(typeof calls.cancelActive[0].options.cancelChat, "function");
		assert.equal(typeof calls.cancelActive[0].options.waitForReady, "function");
		assert.equal(activeRequests.has("thread-plan"), false);
		assert.deepEqual(calls.clearPlanSession, ["thread-plan"]);
	});
});

test("cancel deferred tool cancels paused records and preserves non-plan sessions", async () => {
	await withServer({}, async (baseUrl, { calls, pausedDeferredRecords }) => {
		pausedDeferredRecords.set("tool-paused", {
			kind: "clarification",
			port: 8125,
			threadId: "thread-qa",
			toolCallId: "tool-paused",
		});

		const result = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", {
			toolCallId: "tool-paused",
		});

		assert.equal(result.status, 200);
		assert.deepEqual(result.body, {
			cancelled: true,
			kind: "clarification",
			port: 8125,
			threadId: "thread-qa",
			toolCallId: "tool-paused",
		});
		assert.deepEqual(calls.clearActive, ["tool-paused"]);
		assert.deepEqual(calls.detachPaused, ["tool-paused"]);
		assert.equal(calls.cancelPaused.length, 1);
		assert.equal(calls.cancelPaused[0].record.toolCallId, "tool-paused");
		assert.equal(typeof calls.cancelPaused[0].options.onReleaseError, "function");
		assert.deepEqual(calls.clearPlanSession, []);
	});
});

test("cancel deferred tool reports missing records", async () => {
	await withServer({}, async (baseUrl) => {
		const result = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", {
			toolCallId: "unknown-tool",
		});

		assert.equal(result.status, 404);
		assert.deepEqual(result.body, { error: "Deferred tool call not found" });
	});
});

test("in production another caller's deferred tool call answers like a missing one and stays in place", async () => {
	await withServer({}, async (baseUrl, {
		activeDeferredRecords,
		calls,
		pausedDeferredRecords,
		threads,
	}) => {
		threads.set("thread-alice", { id: "thread-alice", owner: "alice" });
		activeDeferredRecords.set("tool-active", {
			kind: "plan-approval",
			port: 8124,
			threadId: "thread-alice",
			toolCallId: "tool-active",
		});
		pausedDeferredRecords.set("tool-paused", {
			kind: "clarification",
			port: 8125,
			threadId: "thread-alice",
			toolCallId: "tool-paused",
		});
		pausedDeferredRecords.set("tool-ownerless", {
			kind: "clarification",
			port: 8126,
			threadId: null,
			toolCallId: "tool-ownerless",
		});

		for (const toolCallId of ["tool-active", "tool-paused", "tool-ownerless"]) {
			const refused = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", { toolCallId }, { subject: "bob" });
			assert.equal(refused.status, 404, toolCallId);
			assert.deepEqual(refused.body, { error: "Deferred tool call not found" });
		}
		// Nothing was cleared, detached or cancelled for the refused requests.
		assert.deepEqual(calls.clearActive, []);
		assert.deepEqual(calls.detachPaused, []);
		assert.deepEqual(calls.cancelActive, []);
		assert.deepEqual(calls.cancelPaused, []);
		assert.deepEqual(calls.clearPlanSession, []);
		assert.equal(activeDeferredRecords.has("tool-active"), true);
		assert.equal(pausedDeferredRecords.has("tool-paused"), true);

		const unauthenticated = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", { toolCallId: "tool-active" });
		assert.equal(unauthenticated.status, 401);
		assert.equal(activeDeferredRecords.has("tool-active"), true);

		const ownActive = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", { toolCallId: "tool-active" }, { subject: "alice" });
		assert.equal(ownActive.status, 200);
		assert.equal(ownActive.body.threadId, "thread-alice");
		assert.deepEqual(calls.clearPlanSession, ["thread-alice"]);

		const ownPaused = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", { toolCallId: "tool-paused" }, { subject: "alice" });
		assert.equal(ownPaused.status, 200);
		assert.equal(calls.cancelPaused.length, 1);
		assert.equal(calls.cancelPaused[0].record.toolCallId, "tool-paused");
	}, { env: PRODUCTION_ENV });
});

test("in production a deferred tool call on a thread that is not stored stays cancellable by a signed-in caller", async () => {
	await withServer({}, async (baseUrl, { calls, pausedDeferredRecords }) => {
		pausedDeferredRecords.set("tool-demo", {
			kind: "clarification",
			port: 8127,
			threadId: "chat-sdk-demo-thread",
			toolCallId: "tool-demo",
		});
		const result = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", { toolCallId: "tool-demo" }, { subject: "bob" });
		assert.equal(result.status, 200);
		assert.equal(calls.cancelPaused.length, 1);
	}, { env: PRODUCTION_ENV });
});

test("a local caller still cancels ownerless and legacy-thread deferred tool calls", async () => {
	await withServer({}, async (baseUrl, { calls, pausedDeferredRecords, threads }) => {
		threads.set("thread-legacy", { id: "thread-legacy" });
		pausedDeferredRecords.set("tool-ownerless", {
			kind: "clarification",
			port: 8126,
			threadId: null,
			toolCallId: "tool-ownerless",
		});
		pausedDeferredRecords.set("tool-legacy", {
			kind: "clarification",
			port: 8128,
			threadId: "thread-legacy",
			toolCallId: "tool-legacy",
		});
		for (const toolCallId of ["tool-ownerless", "tool-legacy"]) {
			const result = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", { toolCallId });
			assert.equal(result.status, 200, toolCallId);
		}
		assert.equal(calls.cancelPaused.length, 2);
	});
});
