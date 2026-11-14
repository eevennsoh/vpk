"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
	createRovoAppFailureSseChunks,
	createRovoAppRunFailure,
	createSseDataChunk,
	getRovoAppRunFailurePayload,
	isAbortLikeRunFailure,
	isRovoAppRunFailure,
} = require("./rovo-app-run-failure");

test("createRovoAppRunFailure creates a typed retryable error by default", () => {
	const error = createRovoAppRunFailure({
		code: "custom_code",
		message: "Something failed",
		details: "extra details",
	});

	assert.equal(isRovoAppRunFailure(error), true);
	assert.equal(error.code, "custom_code");
	assert.equal(error.message, "Something failed");
	assert.equal(error.details, "extra details");
	assert.equal(error.canRetry, true);
});

test("getRovoAppRunFailurePayload falls back for generic errors", () => {
	const payload = getRovoAppRunFailurePayload(
		new Error("plain error"),
		"Fallback failure",
	);

	assert.deepEqual(payload, {
		code: "future_chat_run_failed",
		message: "Fallback failure",
		details: undefined,
		canRetry: true,
	});
});

test("createSseDataChunk serializes SSE data payloads", () => {
	assert.equal(
		createSseDataChunk({ type: "text-delta", delta: "hello" }),
		"data: {\"type\":\"text-delta\",\"delta\":\"hello\"}\n\n",
	);
});

test("createRovoAppFailureSseChunks emits text, widget error, and completion chunks", () => {
	let tick = 100;
	const chunks = createRovoAppFailureSseChunks("Failed loudly", {
		now: () => tick++,
		nowDate: () => new Date("2026-01-02T03:04:05.000Z"),
	});

	assert.deepEqual(chunks.map((chunk) => JSON.parse(chunk.slice("data: ".length))), [
		{ type: "text-start", id: "rovo-app-error-100" },
		{ type: "text-delta", id: "rovo-app-error-100", delta: "Failed loudly" },
		{ type: "text-end", id: "rovo-app-error-100" },
		{
			type: "data-widget-error",
			id: "rovo-app-error-widget-101",
			data: {
				type: "question-card",
				code: "future_chat_run_failed",
				message: "Failed loudly",
				canRetry: true,
			},
		},
		{
			type: "data-turn-complete",
			data: { timestamp: "2026-01-02T03:04:05.000Z" },
		},
	]);
});

test("isAbortLikeRunFailure recognizes aborts by name or by a typed failure's message", () => {
	assert.equal(isAbortLikeRunFailure(Object.assign(new Error("x"), { name: "AbortError" })), true);
	assert.equal(isAbortLikeRunFailure(createRovoAppRunFailure({ message: "Request aborted" })), true);
	// An untyped error's message is not shown, so it does not decide.
	assert.equal(isAbortLikeRunFailure(new Error("aborted")), false);
	assert.equal(isAbortLikeRunFailure(new Error("boom")), false);
	assert.equal(isAbortLikeRunFailure(null), false);
});
