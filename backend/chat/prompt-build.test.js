"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildChatSdkPrompt,
	joinContextBlocks,
	resolveChatSdkPromptBuildInputs,
	resolvePausedContinuationToolCallId,
} = require("./prompt-build");

function createDependencies() {
	return {
		buildGoogleCalendarDateContext: (timeZone) => `Calendar date for ${timeZone}`,
		isSmartGenerationEnabled: (value) => value.enabled === true,
		normalizeSmartGenerationOptions: (value = {}) => ({
			enabled: value.enabled === true,
			surface: value.surface || null,
			containerWidthPx: value.containerWidthPx || null,
			viewportWidthPx: value.viewportWidthPx || null,
			widthClass: value.widthClass || null,
		}),
	};
}

test("joinContextBlocks filters blank values and joins with paragraph spacing", () => {
	assert.equal(
		joinContextBlocks(["First", "", "  ", null, "Second"]),
		"First\n\nSecond"
	);
});

test("resolvePausedContinuationToolCallId prefers clarification over approval", () => {
	assert.equal(
		resolvePausedContinuationToolCallId({
			approvalToolCallId: "approval-1",
			clarificationToolCallId: "clarify-1",
			hasPausedApprovalToolCall: true,
			hasPausedClarificationToolCall: true,
		}),
		"clarify-1"
	);
	assert.equal(
		resolvePausedContinuationToolCallId({
			approvalToolCallId: "approval-1",
			hasPausedApprovalToolCall: true,
		}),
		"approval-1"
	);
	assert.equal(resolvePausedContinuationToolCallId(), null);
});

test("tool-first prompt context appends instruction and calendar date context", () => {
	const result = resolveChatSdkPromptBuildInputs({
		...createDependencies(),
		clientTimeZone: "Australia/Sydney",
		enrichedContextDescription: "Existing context",
		isStrictToolFirstTurn: true,
		toolFirstClarificationInstruction: "Ask only if required.",
		toolFirstPolicy: {
			domains: ["google-calendar"],
			instruction: "Use calendar tools first.",
		},
	});

	assert.equal(
		result.toolFirstPromptInstruction,
		[
			"Use calendar tools first.",
			"",
			"Ask only if required.",
			"",
			"Calendar date for Australia/Sydney",
		].join("\n")
	);
	assert.equal(
		result.effectiveContextDescription,
		[
			"Existing context",
			"",
			"Use calendar tools first.",
			"",
			"Ask only if required.",
			"",
			"Calendar date for Australia/Sydney",
		].join("\n")
	);
});

test("non-tool-first turns keep enriched context without tool instructions", () => {
	const result = resolveChatSdkPromptBuildInputs({
		...createDependencies(),
		enrichedContextDescription: "Existing context",
		isStrictToolFirstTurn: false,
		toolFirstPolicy: {
			domains: ["google-calendar"],
			instruction: "Use calendar tools first.",
		},
	});

	assert.equal(result.toolFirstPromptInstruction, null);
	assert.equal(result.effectiveContextWithPortBinding, "Existing context");
});

test("plain chat profile applies only to conversational non-smart turns", () => {
	const result = resolveChatSdkPromptBuildInputs({
		...createDependencies(),
		promptIntent: { isConversational: true },
		rawSmartGeneration: { enabled: false },
	});

	assert.equal(result.promptProfile, "plain-chat");

	const smartResult = resolveChatSdkPromptBuildInputs({
		...createDependencies(),
		promptIntent: { isConversational: true },
		rawSmartGeneration: { enabled: true },
	});

	assert.equal(smartResult.promptProfile, "default");
});

test("smart layout context preserves normalized smart generation fields", () => {
	const result = resolveChatSdkPromptBuildInputs({
		...createDependencies(),
		rawSmartGeneration: {
			enabled: true,
			surface: "studio",
			containerWidthPx: 720,
			viewportWidthPx: 1280,
			widthClass: "wide",
		},
	});

	assert.deepEqual(result.smartLayoutContext, {
		surface: "studio",
		containerWidthPx: 720,
		viewportWidthPx: 1280,
		widthClass: "wide",
	});
	assert.equal(result.smartGenerationActive, true);
});

test("buildChatSdkPrompt compresses history, builds the prompt, and marks trace data", () => {
	const logs = [];
	const marks = [];
	const result = buildChatSdkPrompt({
		buildUserMessage: (latestUserMessage, history, context, options) => {
			assert.equal(latestUserMessage, "Build an agent");
			assert.deepEqual(history, [
				{ type: "assistant", content: "Previous answer" },
			]);
			assert.equal(context, "Runtime context");
			assert.deepEqual(options, { profile: "default" });
			return "Prompt with snowman ☃";
		},
		compressConversationHistory: (history, options) => {
			assert.deepEqual(history, [
				{ type: "user", content: "Previous ask" },
			]);
			assert.deepEqual(options, {
				thresholdChars: 80_000,
				tailCount: 8,
			});
			return {
				compressed: true,
				conversationHistory: [
					{ type: "assistant", content: "Previous answer" },
				],
				length: 1,
				originalLength: 3,
			};
		},
		conversationHistory: [
			{ type: "user", content: "Previous ask" },
		],
		effectiveContextWithPortBinding: "Runtime context",
		latestUserMessage: "Build an agent",
		logger: { info: (message) => logs.push(message) },
		now: (() => {
			const values = [100, 107];
			return () => values.shift();
		})(),
		promptProfile: "default",
	});

	assert.equal(result.userMessageText, "Prompt with snowman ☃");
	assert.deepEqual(result.compressedPromptHistory, {
		compressed: true,
		conversationHistory: [
			{ type: "assistant", content: "Previous answer" },
		],
		length: 1,
		originalLength: 3,
	});
	assert.deepEqual(logs, [
		"[CHAT] Compressed prompt conversation history: 3 → 1 messages",
	]);
	assert.deepEqual(marks, []);
	assert.deepEqual(result.promptBuiltTraceData, {
		stageMs: 7,
		promptProfile: "default",
		promptChars: "Prompt with snowman ☃".length,
		promptBytes: Buffer.byteLength("Prompt with snowman ☃", "utf8"),
		conversationHistoryCount: 1,
		contextChars: "Runtime context".length,
	});
});

test("buildChatSdkPrompt reports zero context chars and skips compression log when unchanged", () => {
	const logs = [];
	const result = buildChatSdkPrompt({
		buildUserMessage: (latestUserMessage, history, context, options) => {
			assert.equal(latestUserMessage, "Hello");
			assert.deepEqual(history, []);
			assert.equal(context, null);
			assert.deepEqual(options, { profile: "plain-chat" });
			return "Hello back";
		},
		compressConversationHistory: (history, options) => {
			assert.deepEqual(history, []);
			assert.deepEqual(options, {
				thresholdChars: 80_000,
				tailCount: 8,
			});
			return {
				compressed: false,
				conversationHistory: [],
				length: 0,
				originalLength: 0,
			};
		},
		conversationHistory: [],
		effectiveContextWithPortBinding: null,
		latestUserMessage: "Hello",
		logger: { info: (message) => logs.push(message) },
		now: () => 5,
		promptProfile: "plain-chat",
	});

	assert.equal(result.userMessageText, "Hello back");
	assert.deepEqual(logs, []);
	assert.equal(result.promptBuiltTraceData.contextChars, 0);
	assert.equal(result.promptBuiltTraceData.conversationHistoryCount, 0);
});
