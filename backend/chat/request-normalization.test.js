"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	resolveChatSdkRequestEnvelope,
	resolveChatSdkRequestState,
} = require("./request-normalization");
const { createPlanSessionStore } = require("../lib/plan-session");

function createEnvelopeDependencies() {
	return {
		getLatestUserMessageSource: (messages) =>
			messages?.at(-1)?.metadata?.source || null,
		getLatestVisibleUserMessage: (messages) =>
			messages?.findLast((message) => message?.role === "user") || null,
		normalizeApprovalSubmission: (value) => value || null,
		normalizeClarificationSubmission: (value) => value || null,
		normalizeClientTimeZone: (value) =>
			typeof value === "string" && value.trim() ? value.trim() : "UTC",
	};
}

// Seeds a real plan-session store (injected clock) by replaying events.
function createPlanStore(seed = {}) {
	const store = createPlanSessionStore({ now: () => 1000 });
	for (const [threadId, events] of Object.entries(seed)) {
		for (const event of events) {
			store.dispatchPlanSessionEvent(threadId, event);
		}
	}
	return store;
}

function createStateDependencies({ store = createPlanStore(), pausedIds = [] } = {}) {
	const events = [];
	const clearedPlanSessions = [];
	const clearedDeferredToolCalls = [];
	const logs = [];
	const pausedRovoToolCallStore = new Map(
		pausedIds.map((id) => [id, { toolCallId: id }])
	);

	return {
		clearedDeferredToolCalls,
		clearedPlanSessions,
		dependencies: {
			clearActiveDeferredToolCall: (toolCallId) => {
				clearedDeferredToolCalls.push(toolCallId);
			},
			clearPlanSession: (threadId) => {
				clearedPlanSessions.push(threadId);
				store.clearPlanSession(threadId);
			},
			dispatchPlanSessionEvent: (threadId, event) => {
				events.push({ threadId, type: event.type });
				return store.dispatchPlanSessionEvent(threadId, event);
			},
			getPlanSession: store.getPlanSession,
			getToolCallIdFromApprovalSubmission: (approvalSubmission, rawApproval) =>
				approvalSubmission?.toolCallId || rawApproval?.toolCallId || null,
			getToolCallIdFromClarificationSubmission: (clarificationSubmission) =>
				clarificationSubmission?.toolCallId || null,
			logger: {
				info: (...args) => {
					logs.push(args);
				},
			},
			mapUiMessagesToConversation: (messages) => {
				const latest = messages?.findLast((message) => message.role === "user");
				return {
					message: latest?.content || "",
					conversationHistory: Array.isArray(messages) ? messages : [],
				};
			},
			pausedRovoToolCallStore,
			shouldRestorePlanModeOnResume: store.shouldRestorePlanModeOnResume,
		},
		events,
		logs,
		store,
	};
}

function resolveStateFor(body, { store, pausedIds } = {}) {
	const envelope = resolveChatSdkRequestEnvelope({ body, ...createEnvelopeDependencies() });
	const harness = createStateDependencies({ store, pausedIds });
	const state = resolveChatSdkRequestState({ envelope, ...harness.dependencies });
	return { ...harness, state };
}

test("resolveChatSdkRequestEnvelope normalizes request defaults and trace metadata", () => {
	const envelope = resolveChatSdkRequestEnvelope({
		body: {
			messages: [
				{ role: "assistant", content: "Hello" },
				{
					role: "user",
					content: "Build an agent",
					metadata: { source: "clarification-submit" },
				},
			],
			backendPreference: "unknown",
			clientTimeZone: " Australia/Sydney ",
			provider: "gateway",
			model: "model-a",
			origin: "VOICE",
			chatSdkSource: "rovo",
			id: "thread-from-id",
			sessionId: " session-1 ",
			sessionMode: "ephemeral",
			genuiHint: true,
			hasQueuedPrompts: true,
			resolvedPlanModeActive: true,
		},
		...createEnvelopeDependencies(),
	});

	assert.equal(envelope.backendPreference, "ai-gateway");
	assert.equal(envelope.clientTimeZone, "Australia/Sydney");
	assert.equal(envelope.requestOrigin, "voice");
	assert.equal(envelope.chatSdkSource, "rovo");
	assert.equal(envelope.threadId, "thread-from-id");
	assert.equal(envelope.sessionId, "session-1");
	assert.equal(envelope.sessionMode, "ephemeral");
	assert.equal(envelope.rovoSessionId, null);
	assert.equal(envelope.genuiHint, true);
	assert.equal(envelope.hasQueuedPrompts, true);
	assert.equal(envelope.isPostClarificationTurn, true);
	assert.deepEqual(envelope.stageTraceMeta, {
		path: "/api/chat-sdk",
		origin: "voice",
		source: "rovo",
	});
	assert.deepEqual(envelope.entryTraceData, {
		messageCount: 2,
		backendPreference: "ai-gateway",
		provider: "gateway",
		model: "model-a",
		hasClarification: false,
		hasApproval: false,
		hasDeferredToolResponse: false,
		resolvedPlanModeActive: true,
	});
});

test("resolveChatSdkRequestEnvelope prepends creation mode context", () => {
	const envelope = resolveChatSdkRequestEnvelope({
		body: {
			messages: [{ role: "user", content: "Make a skill" }],
			contextDescription: "Existing context",
			creationMode: "skill",
		},
		...createEnvelopeDependencies(),
	});

	assert.match(envelope.contextDescription, /Existing context$/u);
	assert.notEqual(envelope.contextDescription, "Existing context");
	assert.equal(envelope.creationMode, "skill");
});

test("resolveChatSdkRequestState clears deferred calls and restores plan mode on paused clarification", () => {
	const store = createPlanStore({
		"thread-1": [{ type: "PLAN_EMITTED", deferredToolCallId: "deferred-1" }],
	});
	const envelope = resolveChatSdkRequestEnvelope({
		body: {
			messages: [{ role: "user", content: "Answer clarification" }],
			deferredToolResponse: { tool_call_id: "deferred-1" },
			clarification: { toolCallId: "clarify-1" },
			threadId: "thread-1",
		},
		...createEnvelopeDependencies(),
	});
	const { clearedDeferredToolCalls, dependencies } = createStateDependencies({
		store,
		pausedIds: ["clarify-1"],
	});

	const state = resolveChatSdkRequestState({
		envelope,
		...dependencies,
	});

	assert.deepEqual(clearedDeferredToolCalls, ["deferred-1"]);
	assert.equal(state.hasPausedClarificationToolCall, true);
	assert.equal(state.resolvedPlanModeActive, true);
	assert.equal(state.isPlanFeedbackDeferredResumeTurn, true);
	assert.equal(state.latestUserMessage, "Answer clarification");
	assert.equal(state.latestVisiblePromptText, "Answer clarification");
});

test("resolveChatSdkRequestState transitions approval turns to execution", () => {
	const store = createPlanStore({ "thread-1": [{ type: "ENTER_PLAN_MODE" }] });
	const envelope = resolveChatSdkRequestEnvelope({
		body: {
			messages: [{ role: "user", content: "Build it" }],
			approval: { decision: "auto-accept", toolCallId: "approval-1" },
			threadId: "thread-1",
			resolvedPlanModeActive: true,
		},
		...createEnvelopeDependencies(),
	});
	const { dependencies, events } = createStateDependencies({ store });

	const state = resolveChatSdkRequestState({
		envelope,
		...dependencies,
	});

	assert.equal(state.approvalToolCallId, "approval-1");
	assert.deepEqual(events, [
		{ threadId: "thread-1", type: "ENTER_PLAN_MODE" },
		{ threadId: "thread-1", type: "START_EXECUTION" },
	]);
	assert.equal(store.getPlanSession("thread-1").phase, "execution");
});

test("resolveChatSdkRequestState keeps custom approval submissions in planning", () => {
	const store = createPlanStore({ "thread-1": [{ type: "ENTER_PLAN_MODE" }] });
	const envelope = resolveChatSdkRequestEnvelope({
		body: {
			messages: [{ role: "user", content: "Add rollback steps" }],
			approval: {
				decision: "custom",
				customInstruction: "Add rollback steps",
				toolCallId: "approval-1",
			},
			threadId: "thread-1",
			resolvedPlanModeActive: true,
		},
		...createEnvelopeDependencies(),
	});
	const { dependencies, events } = createStateDependencies({ store });

	const state = resolveChatSdkRequestState({
		envelope,
		...dependencies,
	});

	assert.equal(state.approvalToolCallId, "approval-1");
	assert.deepEqual(events, [{ threadId: "thread-1", type: "ENTER_PLAN_MODE" }]);
	assert.equal(store.getPlanSession("thread-1").phase, "qa");
});

test("resolveChatSdkRequestState preserves missing user message response shape", () => {
	const envelope = resolveChatSdkRequestEnvelope({
		body: {
			messages: [{ role: "assistant", content: "Hello" }],
		},
		...createEnvelopeDependencies(),
	});
	const { dependencies } = createStateDependencies();

	const state = resolveChatSdkRequestState({
		envelope,
		...dependencies,
	});

	assert.deepEqual(state.missingUserMessageResponse, {
		status: 400,
		body: { error: "A user message is required" },
	});
});

test("resolveChatSdkRequestState: an auto-accept approval with no session starts execution", () => {
	const { state, store, logs } = resolveStateFor({
		messages: [{ role: "user", content: "Build it" }],
		approval: { decision: "auto-accept", toolCallId: "approval-1" },
		threadId: "thread-1",
	});
	assert.equal(state.resolvedPlanModeActive, false);
	assert.equal(store.getPlanSession("thread-1").phase, "execution");
	assert.equal(logs.at(-1)[0], "[PLAN-SESSION] Created execution-phase session for auto-accept approval");
});

test("resolveChatSdkRequestState: a deferred tool response accepts a plan into execution", () => {
	const store = createPlanStore({ "thread-1": [{ type: "PLAN_EMITTED", deferredToolCallId: "deferred-1" }] });
	resolveStateFor({
		messages: [{ role: "user", content: "Build" }],
		deferredToolResponse: { tool_call_id: "deferred-1" },
		threadId: "thread-1",
	}, { store });
	assert.equal(store.getPlanSession("thread-1").phase, "execution");
});

test("resolveChatSdkRequestState: a plain visible message ends a qa or plan session", () => {
	for (const seed of [[{ type: "ENTER_PLAN_MODE" }], [{ type: "PLAN_EMITTED", planCardId: "card-1" }]]) {
		const store = createPlanStore({ "thread-1": seed });
		const { clearedPlanSessions } = resolveStateFor({
			messages: [{ role: "user", content: "Something else" }],
			threadId: "thread-1",
		}, { store });
		assert.deepEqual(clearedPlanSessions, ["thread-1"]);
		assert.equal(store.getPlanSession("thread-1").phase, "none");
	}
});

// Deliberate since 3b55aaac7 (2026-03-30): a "continue" prompt resumes a build, so a
// plain message does not end execution. The plan-session TTL bounds an abandoned one.
test("resolveChatSdkRequestState: a plain visible message keeps an execution session", () => {
	const store = createPlanStore({ "thread-1": [{ type: "START_EXECUTION" }] });
	const { clearedPlanSessions, state } = resolveStateFor({
		messages: [{ role: "user", content: "continue" }],
		threadId: "thread-1",
	}, { store });
	assert.deepEqual(clearedPlanSessions, []);
	assert.equal(state.currentPlanSession.phase, "execution");
});

// What the 6 h TTL does to a plan approved late: Build sends a deferred tool response
// outside plan mode; the expired session reads as none, so execution does not start.
test("resolveChatSdkRequestState: Build on a plan older than the TTL does not start execution", () => {
	const clock = { now: 0 };
	const store = createPlanSessionStore({ now: () => clock.now, ttlMs: 1000 });
	store.dispatchPlanSessionEvent("thread-1", { type: "PLAN_EMITTED", deferredToolCallId: "deferred-1" });
	clock.now = 1001;
	const { state, logs } = resolveStateFor({
		messages: [{ role: "user", content: "Build" }],
		deferredToolResponse: { tool_call_id: "deferred-1" },
		threadId: "thread-1",
	}, { store });
	assert.equal(store.getPlanSession("thread-1").phase, "none");
	assert.equal(state.currentPlanSession.phase, "none");
	assert.equal(state.deferredToolResponseToolCallId, "deferred-1", "the deferred tool response still reaches Rovo");
	assert.equal(logs.some(([message]) => String(message).includes("Transitioned to execution phase")), false);
});
