"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { createDeferredToolCallState } = require("../chat/deferred-tool-state");
const { runWithGeneratedMediaScope } = require("../lib/generated-media-owners");
const { createCallerIdentityMiddleware } = require("../middleware/caller-identity");
const {
	createChatControlRouter,
	registerChatControlRoutes,
} = require("./chat-control");

const PRODUCTION_ENV = Object.freeze({ NODE_ENV: "production" });
const QUIET = Object.freeze({ error() {}, info() {}, log() {}, warn() {} });
const HANDLE = Object.freeze({ settleLease() {} });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Registers records as the turn of `owner` would (null: a local turn, no owner). */
function asTurnOf(owner, register) {
	const scope = owner ? { owner, store: { claim: () => true } } : null;
	return runWithGeneratedMediaScope(scope, register);
}

/**
 * A chat control router over the real deferred tool call state. `onGetThread` runs at the
 * start of every (async) thread lookup, and `getThreadDelayMs` keeps it pending, so a
 * test can change the store while the route awaits ownership.
 */
async function withServer(run, { env, getThreadDelayMs = 0, onGetThread } = {}) {
	const app = express();
	app.use(express.json());
	if (env) {
		app.use(createCallerIdentityMiddleware({ env, logger: QUIET }));
	}
	const state = createDeferredToolCallState({ logger: QUIET, ttlMs: 60_000 });
	const threads = new Map();
	const calls = {
		cancelActive: [],
		cancelChat: [],
		cancelPaused: [],
		clearPlanSession: [],
		getThread: [],
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
	registerChatControlRoutes(app, {
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
		clearActiveDeferredToolCall: state.clearActiveDeferredToolCall,
		clearPlanSession: (threadId) => {
			calls.clearPlanSession.push(threadId);
		},
		detachPausedRovoToolCall: state.detachPausedRovoToolCall,
		logger: QUIET,
		peekDeferredToolCall: state.peekDeferredToolCall,
		rovoAppThreadManager: {
			getThread: async (threadId) => {
				calls.getThread.push(threadId);
				onGetThread?.(threadId, state);
				if (getThreadDelayMs) await wait(getThreadDelayMs);
				return threads.get(threadId) || null;
			},
		},
		waitForReady: async () => {},
	});

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const baseUrl = `http://127.0.0.1:${server.address().port}`;
	try {
		await run(baseUrl, { activeRequests, calls, state, threads });
	} finally {
		for (const toolCallId of [...state.activeDeferredToolCallStore.keys()]) state.clearActiveDeferredToolCall(toolCallId);
		for (const toolCallId of [...state.pausedRovoToolCallStore.keys()]) state.detachPausedRovoToolCall(toolCallId);
		await new Promise((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
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

const cancel = (baseUrl, toolCallId, options) => postJson(baseUrl, "/api/rovo/cancel-deferred-tool", { toolCallId }, options);

test("chat control router validates required dependencies", () => {
	assert.throws(() => createChatControlRouter(), /activeRequests/u);
	assert.throws(
		() => createChatControlRouter({ activeRequests: new Map() }),
		/cancelActiveDeferredToolCallRecord/u,
	);
});

test("chat cancel route delegates to the shared cancel helper", async () => {
	await withServer(async (baseUrl, { activeRequests, calls }) => {
		const result = await postJson(baseUrl, "/api/chat-cancel?threadId=thread-active", {});

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
	await withServer(async (baseUrl) => {
		const missing = await postJson(baseUrl, "/api/rovo/cancel-deferred-tool", {});
		assert.equal(missing.status, 400);
		assert.deepEqual(missing.body, { error: "toolCallId is required" });

		const gateway = await cancel(baseUrl, "ai-gateway-clarification-123");
		assert.equal(gateway.status, 200);
		assert.deepEqual(gateway.body, {
			cancelled: true,
			kind: "ai-gateway-clarification",
			toolCallId: "ai-gateway-clarification-123",
		});
	});
});

test("cancel deferred tool cancels active records, clears active plan threads, and answers without port or thread", async () => {
	await withServer(async (baseUrl, { activeRequests, calls, state }) => {
		activeRequests.set("thread-plan", { port: 8124 });
		state.registerActiveDeferredToolCall({ kind: "plan-approval", port: 8124, threadId: "thread-plan", toolCallId: "tool-plan" });

		const result = await cancel(baseUrl, "tool-plan");

		assert.equal(result.status, 200);
		assert.deepEqual(result.body, { cancelled: true, kind: "plan-approval", toolCallId: "tool-plan" });
		assert.equal(calls.cancelActive.length, 1);
		assert.equal(calls.cancelActive[0].record.toolCallId, "tool-plan");
		assert.equal(typeof calls.cancelActive[0].options.cancelChat, "function");
		assert.equal(typeof calls.cancelActive[0].options.waitForReady, "function");
		assert.equal(activeRequests.has("thread-plan"), false);
		assert.deepEqual(calls.clearPlanSession, ["thread-plan"]);
		assert.equal(state.activeDeferredToolCallStore.has("tool-plan"), false);
	});
});

test("cancel deferred tool cancels paused records and preserves non-plan sessions", async () => {
	await withServer(async (baseUrl, { calls, state }) => {
		state.registerPausedRovoToolCall({ handle: HANDLE, kind: "clarification", port: 8125, threadId: "thread-qa", toolCallId: "tool-paused" });

		const result = await cancel(baseUrl, "tool-paused");

		assert.equal(result.status, 200);
		assert.deepEqual(result.body, { cancelled: true, kind: "clarification", toolCallId: "tool-paused" });
		assert.equal(calls.cancelPaused.length, 1);
		assert.equal(calls.cancelPaused[0].record.toolCallId, "tool-paused");
		assert.equal(typeof calls.cancelPaused[0].options.onReleaseError, "function");
		assert.deepEqual(calls.clearPlanSession, []);
		assert.equal(state.pausedRovoToolCallStore.has("tool-paused"), false);
	});
});

test("cancel deferred tool reports missing records", async () => {
	await withServer(async (baseUrl) => {
		const result = await cancel(baseUrl, "unknown-tool");

		assert.equal(result.status, 404);
		assert.deepEqual(result.body, { error: "Deferred tool call not found" });
	});
});

test("in production another caller's deferred tool call answers like a missing one and stays in place", async () => {
	await withServer(async (baseUrl, { calls, state, threads }) => {
		threads.set("thread-alice", { id: "thread-alice", owner: "alice" });
		state.registerActiveDeferredToolCall({ kind: "plan-approval", port: 8124, threadId: "thread-alice", toolCallId: "tool-active" });
		state.registerPausedRovoToolCall({ handle: HANDLE, kind: "clarification", port: 8125, threadId: "thread-alice", toolCallId: "tool-paused" });
		state.registerPausedRovoToolCall({ handle: HANDLE, kind: "clarification", port: 8126, toolCallId: "tool-threadless" });
		// Registered by alice's turn on a thread that is not stored: the stamped owner decides.
		asTurnOf("alice", () => state.registerActiveDeferredToolCall({ port: 8127, threadId: "thread-unstored", toolCallId: "tool-stamped" }));

		const missing = await cancel(baseUrl, "unknown-tool", { subject: "bob" });
		for (const toolCallId of ["tool-active", "tool-paused", "tool-threadless", "tool-stamped"]) {
			const refused = await cancel(baseUrl, toolCallId, { subject: "bob" });
			assert.equal(refused.status, 404, toolCallId);
			assert.deepEqual(refused.body, missing.body, toolCallId);
		}
		// Nothing was cleared, detached or cancelled for the refused requests.
		assert.deepEqual(calls.cancelActive, []);
		assert.deepEqual(calls.cancelPaused, []);
		assert.deepEqual(calls.clearPlanSession, []);
		assert.equal(state.activeDeferredToolCallStore.has("tool-active"), true);
		assert.equal(state.activeDeferredToolCallStore.has("tool-stamped"), true);
		assert.equal(state.pausedRovoToolCallStore.has("tool-paused"), true);
		assert.equal(state.pausedRovoToolCallStore.has("tool-threadless"), true);

		const unauthenticated = await cancel(baseUrl, "tool-active");
		assert.equal(unauthenticated.status, 401);
		assert.equal(state.activeDeferredToolCallStore.has("tool-active"), true);

		const ownActive = await cancel(baseUrl, "tool-active", { subject: "alice" });
		assert.equal(ownActive.status, 200);
		assert.deepEqual(ownActive.body, { cancelled: true, kind: "plan-approval", toolCallId: "tool-active" });
		assert.deepEqual(calls.clearPlanSession, ["thread-alice"]);

		const ownPaused = await cancel(baseUrl, "tool-paused", { subject: "alice" });
		assert.equal(ownPaused.status, 200);
		assert.equal(calls.cancelPaused.length, 1);
		assert.equal(calls.cancelPaused[0].record.toolCallId, "tool-paused");

		const ownStamped = await cancel(baseUrl, "tool-stamped", { subject: "alice" });
		assert.equal(ownStamped.status, 200);
	}, { env: PRODUCTION_ENV });
});

test("in production a missing and a foreign tool call id cost the same single thread lookup", async () => {
	await withServer(async (baseUrl, { calls, state, threads }) => {
		threads.set("thread-alice", { id: "thread-alice", owner: "alice" });
		state.registerActiveDeferredToolCall({ port: 8124, threadId: "thread-alice", toolCallId: "tool-foreign" });

		calls.getThread.length = 0;
		await cancel(baseUrl, "unknown-tool", { subject: "bob" });
		const missingLookups = calls.getThread.length;
		calls.getThread.length = 0;
		await cancel(baseUrl, "tool-foreign", { subject: "bob" });
		assert.equal(missingLookups, 1);
		assert.equal(calls.getThread.length, 1);
	}, { env: PRODUCTION_ENV });
});

test("in production a record replaced during the ownership lookup is refused and left in place", async () => {
	let swap = null;
	await withServer(async (baseUrl, { calls, state, threads }) => {
		threads.set("thread-bob", { id: "thread-bob", owner: "bob" });
		threads.set("thread-alice", { id: "thread-alice", owner: "alice" });

		// Bob owns the active record when it is checked; alice's record replaces it meanwhile.
		state.registerActiveDeferredToolCall({ port: 9100, threadId: "thread-bob", toolCallId: "tool-swapped" });
		swap = (store) => {
			swap = null;
			store.registerActiveDeferredToolCall({ port: 9101, threadId: "thread-alice", toolCallId: "tool-swapped" });
		};
		const replaced = await cancel(baseUrl, "tool-swapped", { subject: "bob" });
		assert.equal(replaced.status, 404);
		assert.equal(state.activeDeferredToolCallStore.get("tool-swapped")?.threadId, "thread-alice");

		// A paused record of alice's appears under bob's checked id meanwhile.
		state.registerActiveDeferredToolCall({ port: 9200, threadId: "thread-bob", toolCallId: "tool-appeared" });
		swap = (store) => {
			swap = null;
			store.registerPausedRovoToolCall({ handle: HANDLE, port: 9201, threadId: "thread-alice", toolCallId: "tool-appeared" });
		};
		const appeared = await cancel(baseUrl, "tool-appeared", { subject: "bob" });
		assert.equal(appeared.status, 404);
		assert.equal(state.activeDeferredToolCallStore.has("tool-appeared"), true);
		assert.equal(state.pausedRovoToolCallStore.has("tool-appeared"), true);

		assert.deepEqual(calls.cancelActive, []);
		assert.deepEqual(calls.cancelPaused, []);
	}, {
		env: PRODUCTION_ENV,
		getThreadDelayMs: 10,
		onGetThread: (_threadId, store) => swap?.(store),
	});
});

test("concurrent cancels of the same record cancel it once", async () => {
	await withServer(async (baseUrl, { calls, state, threads }) => {
		threads.set("thread-alice", { id: "thread-alice", owner: "alice" });
		state.registerPausedRovoToolCall({ handle: HANDLE, port: 9300, threadId: "thread-alice", toolCallId: "tool-twice" });

		const results = await Promise.all([
			cancel(baseUrl, "tool-twice", { subject: "alice" }),
			cancel(baseUrl, "tool-twice", { subject: "alice" }),
		]);
		assert.deepEqual(results.map((result) => result.status).sort(), [200, 404]);
		assert.equal(calls.cancelPaused.length, 1);
	}, { env: PRODUCTION_ENV, getThreadDelayMs: 10 });
});

test("in production a deferred tool call on a thread that is not stored stays cancellable by a signed-in caller", async () => {
	await withServer(async (baseUrl, { calls, state }) => {
		state.registerPausedRovoToolCall({ handle: HANDLE, kind: "clarification", port: 8127, threadId: "chat-sdk-demo-thread", toolCallId: "tool-demo" });
		const result = await cancel(baseUrl, "tool-demo", { subject: "bob" });
		assert.equal(result.status, 200);
		assert.equal(calls.cancelPaused.length, 1);
	}, { env: PRODUCTION_ENV });
});

test("a local caller still cancels ownerless and legacy-thread deferred tool calls", async () => {
	await withServer(async (baseUrl, { calls, state, threads }) => {
		threads.set("thread-legacy", { id: "thread-legacy" });
		state.registerPausedRovoToolCall({ handle: HANDLE, port: 8126, toolCallId: "tool-ownerless" });
		state.registerPausedRovoToolCall({ handle: HANDLE, port: 8128, threadId: "thread-legacy", toolCallId: "tool-legacy" });
		for (const toolCallId of ["tool-ownerless", "tool-legacy"]) {
			const result = await cancel(baseUrl, toolCallId);
			assert.equal(result.status, 200, toolCallId);
		}
		assert.equal(calls.cancelPaused.length, 2);
	});
});
