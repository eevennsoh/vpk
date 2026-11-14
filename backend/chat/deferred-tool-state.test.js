"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createAIGatewayDeferredToolCallId,
	createClarificationSessionId,
	createDeferredToolCallState,
	isAIGatewayDeferredToolCallId,
} = require("./deferred-tool-state");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createSilentLogger() {
	return {
		info() {},
		warn() {},
	};
}

test("creates clarification session and AI Gateway deferred tool IDs", () => {
	assert.match(
		createClarificationSessionId(),
		/^clarification-\d+-[a-z0-9]+$/u,
	);

	const toolCallId = createAIGatewayDeferredToolCallId("Ask User Questions!");
	assert.match(toolCallId, /^ai-gateway-ask_user_questions_-\d+-[a-z0-9]+$/u);
	assert.equal(isAIGatewayDeferredToolCallId(toolCallId), true);
	assert.equal(isAIGatewayDeferredToolCallId(" request-user-input-123 "), false);
});

test("registers and clears active deferred tool calls", () => {
	const state = createDeferredToolCallState({
		logger: createSilentLogger(),
		ttlMs: 1_000,
	});

	const record = state.registerActiveDeferredToolCall({
		toolCallId: " tool-1 ",
		port: 8123,
		threadId: " thread-1 ",
		kind: "plan-approval",
	});

	assert.equal(record.toolCallId, "tool-1");
	assert.equal(record.port, 8123);
	assert.equal(record.threadId, "thread-1");
	assert.equal(record.kind, "plan-approval");
	assert.equal(state.activeDeferredToolCallStore.has("tool-1"), true);

	const cleared = state.clearActiveDeferredToolCall("tool-1");
	assert.equal(cleared, record);
	assert.equal(cleared.expiryTimer, null);
	assert.equal(state.activeDeferredToolCallStore.size, 0);
});

test("expires active deferred tool calls after the configured TTL", async () => {
	const state = createDeferredToolCallState({
		logger: createSilentLogger(),
		ttlMs: 10,
	});

	state.registerActiveDeferredToolCall({
		toolCallId: "tool-ttl",
		port: 8123,
	});

	assert.equal(state.activeDeferredToolCallStore.has("tool-ttl"), true);
	await wait(30);
	assert.equal(state.activeDeferredToolCallStore.has("tool-ttl"), false);
});

test("registers and takes paused Rovo tool calls", () => {
	const state = createDeferredToolCallState({
		logger: createSilentLogger(),
		ttlMs: 1_000,
	});
	const handle = {
		settleLease: () => true,
	};

	const record = state.registerPausedRovoToolCall({
		toolCallId: " paused-1 ",
		port: 8124,
		handle,
		threadId: " thread-1 ",
		sessionId: " session-1 ",
		sessionMode: "ephemeral",
	});

	assert.equal(record.toolCallId, "paused-1");
	assert.equal(record.kind, "clarification");
	assert.equal(record.sessionMode, "ephemeral");
	assert.equal(record.handle, handle);
	assert.equal(state.pausedRovoToolCallStore.has("paused-1"), true);

	const taken = state.takePausedRovoToolCall("paused-1");
	assert.equal(taken, record);
	assert.equal(taken.expiryTimer, null);
	assert.equal(state.pausedRovoToolCallStore.size, 0);
});

test("releases a paused Rovo tool handle when clearing without cancel", () => {
	const releases = [];
	const state = createDeferredToolCallState({
		logger: createSilentLogger(),
		ttlMs: 1_000,
	});

	state.registerPausedRovoToolCall({
		toolCallId: "paused-release",
		port: 8125,
		handle: {
			settleLease(disposition) {
				releases.push(disposition);
				return true;
			},
		},
	});

	const cleared = state.clearPausedRovoToolCall("paused-release");
	assert.equal(cleared.toolCallId, "paused-release");
	assert.deepEqual(releases, ["release"]);
	assert.equal(state.pausedRovoToolCallStore.size, 0);
});

test("cancels an existing paused Rovo tool call before replacing it", async () => {
	const cancelled = [];
	const state = createDeferredToolCallState({
		cancelChat: async () => {},
		cancelPausedToolCallRecord: async (record, options) => {
			cancelled.push({ record, options });
		},
		logger: createSilentLogger(),
		ttlMs: 1_000,
		waitForReady: async () => {},
	});
	const firstHandle = { settleLease: () => true };
	const secondHandle = { settleLease: () => true };

	const first = state.registerPausedRovoToolCall({
		toolCallId: "paused-replace",
		port: 8126,
		handle: firstHandle,
		kind: "plan-approval",
	});
	const second = state.registerPausedRovoToolCall({
		toolCallId: "paused-replace",
		port: 8127,
		handle: secondHandle,
	});

	await wait(0);

	assert.equal(cancelled.length, 1);
	assert.equal(cancelled[0].record, first);
	assert.equal(typeof cancelled[0].options.cancelChat, "function");
	assert.equal(typeof cancelled[0].options.waitForReady, "function");
	assert.equal(state.pausedRovoToolCallStore.get("paused-replace"), second);

	state.clearPausedRovoToolCall("paused-replace");
});

test("expires paused Rovo tool calls through the cancellation path", async () => {
	const cancelled = [];
	const state = createDeferredToolCallState({
		cancelChat: async () => {},
		cancelPausedToolCallRecord: async (record) => {
			cancelled.push(record);
		},
		logger: createSilentLogger(),
		ttlMs: 10,
		waitForReady: async () => {},
	});

	state.registerPausedRovoToolCall({
		toolCallId: "paused-ttl",
		port: 8128,
		handle: { settleLease: () => true },
	});

	assert.equal(state.pausedRovoToolCallStore.has("paused-ttl"), true);
	await wait(30);
	assert.equal(state.pausedRovoToolCallStore.has("paused-ttl"), false);
	assert.equal(cancelled.length, 1);
	assert.equal(cancelled[0].toolCallId, "paused-ttl");
});

test("rejects invalid deferred tool records", () => {
	const state = createDeferredToolCallState({ logger: createSilentLogger() });

	assert.equal(
		state.registerActiveDeferredToolCall({ toolCallId: "", port: 8123 }),
		null,
	);
	assert.equal(
		state.registerActiveDeferredToolCall({ toolCallId: "tool", port: 0 }),
		null,
	);
	assert.equal(
		state.registerPausedRovoToolCall({
			toolCallId: "tool",
			port: 8123,
			handle: null,
		}),
		null,
	);
});
