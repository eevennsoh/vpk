"use strict";

// A chat turn may only resume or clear a deferred tool call it owns: /api/chat-sdk and
// /api/rovo/chat take a paused Rovo record (resuming its port and session with the
// request's answer) and clear an active record by the id the request names. These tests
// drive the real chat guard, request normalization, paused-record resolver and
// deferred tool call state in production mode.

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { createDeferredToolCallState } = require("./deferred-tool-state");
const { resolveChatSdkRequestEnvelope, resolveChatSdkRequestState } = require("./request-normalization");
const { resolvePausedRovoToolCallRecord } = require("./rovo-stream-attempt-orchestrator");
const { registerChatThreadOwnershipGuards } = require("../lib/rovo-app-thread-ownership");
const { createPlanSessionStore } = require("../lib/plan-session");
const { createCallerIdentityMiddleware } = require("../middleware/caller-identity");

const QUIET = Object.freeze({ error() {}, info() {}, log() {}, warn() {} });
const HANDLE = Object.freeze({ settleLease() {} });

/**
 * One app for both routes. Each handler runs the steps of a real turn that touch the
 * deferred tool call state: request normalization (clears the active record the request's
 * deferred tool response names) and the paused-record resolver (takes the paused record
 * to resume). `register` routes register records the way a running turn does.
 */
async function withChatApp(env, run) {
	const threads = new Map([
		["thread-alice", { id: "thread-alice", owner: "alice" }],
		["thread-alice-2", { id: "thread-alice-2", owner: "alice" }],
		["thread-bob", { id: "thread-bob", owner: "bob" }],
	]);
	const rovoAppThreadManager = {
		getThread: async (id) => {
			await new Promise((resolve) => setImmediate(resolve));
			return threads.get(id) || null;
		},
		listThreads: async ({ filter } = {}) => [...threads.values()].filter((thread) => !filter || filter(thread)),
	};
	const state = createDeferredToolCallState({ logger: QUIET, ttlMs: 60_000 });
	const planStore = createPlanSessionStore({ now: () => 1000 });
	const app = express();
	app.use(createCallerIdentityMiddleware({ env, logger: QUIET }));
	app.use(express.json());
	registerChatThreadOwnershipGuards(app, { generatedMediaOwnerStore: { claim: () => true }, rovoAppThreadManager });

	function runTurn(threadId, body) {
		const envelope = resolveChatSdkRequestEnvelope({
			body: { ...body, threadId },
			getLatestUserMessageSource: () => null,
			getLatestVisibleUserMessage: (messages) => messages?.findLast((message) => message?.role === "user") || null,
			normalizeApprovalSubmission: (value) => value || null,
			normalizeClarificationSubmission: (value) => value || null,
			normalizeClientTimeZone: () => "UTC",
		});
		const requestState = resolveChatSdkRequestState({
			clearActiveDeferredToolCall: state.clearActiveDeferredToolCall,
			clearPlanSession: planStore.clearPlanSession,
			dispatchPlanSessionEvent: planStore.dispatchPlanSessionEvent,
			envelope,
			getPlanSession: planStore.getPlanSession,
			getToolCallIdFromApprovalSubmission: () => null,
			getToolCallIdFromClarificationSubmission: (submission) => submission?.toolCallId || null,
			logger: QUIET,
			mapUiMessagesToConversation: () => ({ conversationHistory: [], message: "answer" }),
			pausedRovoToolCallStore: state.pausedRovoToolCallStore,
			shouldRestorePlanModeOnResume: planStore.shouldRestorePlanModeOnResume,
		});
		const paused = resolvePausedRovoToolCallRecord({
			logger: QUIET,
			pausedContinuationToolCallId: body.resumeToolCallId ?? null,
			takePausedRovoToolCall: state.takePausedRovoToolCall,
			threadId,
		});
		return {
			hasPausedClarificationToolCall: requestState.hasPausedClarificationToolCall,
			resumedPort: paused?.port ?? null,
		};
	}

	// /api/chat-sdk reads the thread from `threadId`, /api/rovo/chat from `id`.
	app.post("/api/chat-sdk", async (req, res) => {
		await Promise.resolve();
		if (req.body.register) {
			const { kind, port, toolCallId } = req.body.register;
			if (kind === "paused") {
				state.registerPausedRovoToolCall({ handle: HANDLE, port, threadId: req.body.threadId, toolCallId });
			} else {
				state.registerActiveDeferredToolCall({ port, threadId: req.body.threadId, toolCallId });
			}
			return res.json({ registered: true });
		}
		return res.json(runTurn(req.body.threadId, req.body));
	});
	app.post("/api/rovo/chat", async (req, res) => {
		await Promise.resolve();
		return res.json(runTurn(req.body.id, req.body));
	});

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		await run(`http://127.0.0.1:${server.address().port}`, state);
	} finally {
		for (const toolCallId of [...state.activeDeferredToolCallStore.keys()]) state.clearActiveDeferredToolCall(toolCallId);
		for (const toolCallId of [...state.pausedRovoToolCallStore.keys()]) state.detachPausedRovoToolCall(toolCallId);
		await new Promise((resolve) => server.close(resolve));
	}
}

async function post(baseUrl, path, subject, body) {
	const response = await fetch(`${baseUrl}${path}`, {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json", ...(subject ? { "x-slauth-subject": subject } : {}) },
		method: "POST",
	});
	return { body: await response.json(), status: response.status };
}

const register = (baseUrl, subject, threadId, kind, toolCallId, port) =>
	post(baseUrl, "/api/chat-sdk", subject, { register: { kind, port, toolCallId }, threadId });

test("in production records a turn registers carry its caller", async () => {
	await withChatApp({ NODE_ENV: "production" }, async (baseUrl, state) => {
		await register(baseUrl, "alice", "thread-alice", "paused", "tool-paused", 9001);
		await register(baseUrl, "alice", "thread-alice", "active", "tool-active", 9002);
		assert.equal(state.pausedRovoToolCallStore.get("tool-paused").owner, "alice");
		assert.equal(state.activeDeferredToolCallStore.get("tool-active").owner, "alice");
	});
});

test("in production another caller's chat turn neither resumes alice's paused record nor clears her active one", async () => {
	await withChatApp({ NODE_ENV: "production" }, async (baseUrl, state) => {
		await register(baseUrl, "alice", "thread-alice", "paused", "tool-paused", 9001);
		await register(baseUrl, "alice", "thread-alice", "active", "tool-active", 9002);

		for (const [path, threadField] of [["/api/chat-sdk", "threadId"], ["/api/rovo/chat", "id"]]) {
			const attempt = await post(baseUrl, path, "bob", {
				clarification: { toolCallId: "tool-paused" },
				deferredToolResponse: { tool_call_id: "tool-active" },
				[threadField]: "thread-bob",
				resumeToolCallId: "tool-paused",
			});
			assert.equal(attempt.status, 200, path);
			assert.deepEqual(attempt.body, { hasPausedClarificationToolCall: false, resumedPort: null }, path);
		}
		assert.equal(state.pausedRovoToolCallStore.has("tool-paused"), true);
		assert.equal(state.activeDeferredToolCallStore.has("tool-active"), true);

		// Alice's turn on another of her threads may not use them either.
		const otherThread = await post(baseUrl, "/api/chat-sdk", "alice", {
			deferredToolResponse: { tool_call_id: "tool-active" },
			resumeToolCallId: "tool-paused",
			threadId: "thread-alice-2",
		});
		assert.equal(otherThread.body.resumedPort, null);
		assert.equal(state.pausedRovoToolCallStore.has("tool-paused"), true);
		assert.equal(state.activeDeferredToolCallStore.has("tool-active"), true);

		// Alice's turn on the record's own thread resumes and clears them.
		const own = await post(baseUrl, "/api/rovo/chat", "alice", {
			clarification: { toolCallId: "tool-paused" },
			deferredToolResponse: { tool_call_id: "tool-active" },
			id: "thread-alice",
			resumeToolCallId: "tool-paused",
		});
		assert.deepEqual(own.body, { hasPausedClarificationToolCall: true, resumedPort: 9001 });
		assert.equal(state.pausedRovoToolCallStore.has("tool-paused"), false);
		assert.equal(state.activeDeferredToolCallStore.has("tool-active"), false);
	});
});

test("in production a signed-in turn does not resume a record no caller registered", async () => {
	await withChatApp({ NODE_ENV: "production" }, async (baseUrl, state) => {
		state.registerPausedRovoToolCall({ handle: HANDLE, port: 9003, threadId: "thread-bob", toolCallId: "tool-ownerless" });
		const attempt = await post(baseUrl, "/api/chat-sdk", "bob", { resumeToolCallId: "tool-ownerless", threadId: "thread-bob" });
		assert.equal(attempt.body.resumedPort, null);
		assert.equal(state.pausedRovoToolCallStore.has("tool-ownerless"), true);
	});
});

test("in local development a turn resumes and clears records as before", async () => {
	await withChatApp({}, async (baseUrl, state) => {
		await register(baseUrl, null, "thread-local", "paused", "tool-paused", 9004);
		state.registerActiveDeferredToolCall({ port: 9005, toolCallId: "tool-active" });
		assert.equal(state.pausedRovoToolCallStore.get("tool-paused").owner, null);

		const turn = await post(baseUrl, "/api/chat-sdk", null, {
			deferredToolResponse: { tool_call_id: "tool-active" },
			resumeToolCallId: "tool-paused",
			threadId: "another-thread",
		});
		assert.equal(turn.body.resumedPort, 9004);
		assert.equal(state.activeDeferredToolCallStore.has("tool-active"), false);
	});
});
