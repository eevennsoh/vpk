"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildRovoPreprocessingTraceData,
	createRovoTextOutputController,
	emitRovoToolFirstRouteSummary,
	emitRovoMissingStudioAgentResultFailure,
	finalizeRovoClassifierLeakRepair,
	finalizeRovoDirectOutputs,
	finalizeRovoPlanWidgetPostStream,
	finalizeRovoStudioAgentResult,
	instrumentChatSdkWriter,
	normalizeRovoThinkingEvent,
	normalizeRovoThinkingPhase,
	normalizeRovoThinkingStatus,
	resolveRovoNonStrictPostStreamRouting,
	resolveRovoChatInProgressTimeoutRecovery,
	resolveRovoPortStuckRecovery,
	resolveRovoToolFirstFallbackCause,
	resolveRovoToolFirstRetryPlan,
	sanitizeRovoThinkingActivity,
	sanitizeRovoThinkingEvent,
	sanitizeRovoThinkingLabel,
	sanitizeRovoThinkingSource,
} = require("./rovo-stream");

function createInstrumentedWriter() {
	const parts = [];
	const marks = [];
	const writer = {
		write(part) {
			parts.push(part);
			return `written:${parts.length}`;
		},
	};
	const telemetry = instrumentChatSdkWriter({
		stageTrace: {
			mark: (stage, data) => marks.push({ stage, data }),
		},
		writer,
	});
	return { marks, parts, telemetry, writer };
}

function createTextOutputController(options = {}) {
	const parts = [];
	const controller = createRovoTextOutputController({
		classifierJsonBufferMaxChars: 120,
		isClassifierIntentLeakCandidate: (text) => /^\s*\{/u.test(text),
		parseClassifierIntentPayload: (text) => {
			try {
				const parsed = JSON.parse(text);
				return parsed && typeof parsed.intent === "string" ? parsed : null;
			} catch {
				return null;
			}
		},
		splitDirectMediaTextForStreaming: (text) => ({
			pendingText: "",
			visibleText: text,
		}),
		splitSpecFenceTextForStreaming: (text) => ({
			pendingText: "",
			visibleText: text,
		}),
		textId: "text-test",
		writer: {
			write(part) {
				parts.push(part);
			},
		},
		...options,
	});
	return { controller, parts };
}

test("buildRovoPreprocessingTraceData preserves trace payload shape", () => {
	assert.deepEqual(
		buildRovoPreprocessingTraceData({
			backend: "rovo",
			chatSdkEntryStartedAtMs: 200,
			isStrictToolFirstTurn: true,
			now: () => 275,
			promptProfile: "default",
			smartGenerationActive: true,
		}),
		{
			stageMs: 75,
			backend: "rovo",
			promptProfile: "default",
			smartGenerationActive: true,
			isStrictToolFirstTurn: true,
		},
	);
});

test("instrumentChatSdkWriter marks first SSE event and first text delta once", () => {
	const { marks, parts, telemetry, writer } = createInstrumentedWriter();

	assert.equal(writer.write({ type: "text-start", id: "text-1" }), "written:1");
	assert.equal(writer.write({ type: "text-delta", id: "text-1", delta: "Hello" }), "written:2");
	assert.equal(writer.write({ type: "text-delta", id: "text-1", delta: " again" }), "written:3");

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-1" },
		{ type: "text-delta", id: "text-1", delta: "Hello" },
		{ type: "text-delta", id: "text-1", delta: " again" },
	]);
	assert.deepEqual(marks, [
		{
			stage: "first_chat_sdk_sse_event",
			data: { eventType: "text-start" },
		},
		{
			stage: "first_text_delta_written",
			data: { chars: 5, source: "chat-sdk-writer" },
		},
	]);
	assert.equal(telemetry.getHasEmittedAgentResult(), false);
});

test("instrumentChatSdkWriter marks turn complete once and tracks agent result", () => {
	const { marks, telemetry, writer } = createInstrumentedWriter();

	writer.write({ type: "data-agent-result", data: { name: "Agent" } });
	writer.write({ type: "data-turn-complete", data: { ok: true } });
	writer.write({ type: "data-turn-complete", data: { ok: true } });

	assert.equal(telemetry.getHasEmittedAgentResult(), true);
	assert.deepEqual(marks, [
		{
			stage: "first_chat_sdk_sse_event",
			data: { eventType: "data-agent-result" },
		},
		{
			stage: "turn_complete_written",
			data: undefined,
		},
	]);
});

test("instrumentChatSdkWriter falls back to unknown event type", () => {
	const { marks, writer } = createInstrumentedWriter();

	writer.write({ type: "  " });

	assert.deepEqual(marks, [
		{
			stage: "first_chat_sdk_sse_event",
			data: { eventType: "unknown" },
		},
	]);
});

test("resolveRovoNonStrictPostStreamRouting builds GenUI eligibility inputs and trims text", () => {
	const eligibilityCalls = [];
	const logs = [];
	const result = resolveRovoNonStrictPostStreamRouting({
		assistantText: "  Build the dashboard  ",
		browserBridge: {
			hasAuthoritativeOutput: () => false,
		},
		getReadonlyBlockedWriteToolNames: () => [],
		hasEmittedGenuiWidget: false,
		hasEmittedPlanWidget: false,
		hasEmittedQuestionCard: false,
		hasObservedActionableToolCall: true,
		hasToolObservationEntries: () => true,
		isAborted: false,
		isTaskLikeRequest: true,
		logger: {
			info(label, data) {
				logs.push({ label, data });
			},
		},
		looksLikeClarificationResponse: () => false,
		looksLikeInabilityResponse: () => false,
		looksLikeWriteBlockedTurn: () => false,
		planExecutionActive: false,
		resolvedPlanModeActive: false,
		shouldAttemptPostToolGenui: (options) => {
			eligibilityCalls.push(options);
			return true;
		},
		shouldForceCardFirstGenui: true,
		threadId: "thread-1",
		toolObservationEntries: [{ toolName: "tool" }],
	});

	assert.deepEqual(logs, []);
	assert.deepEqual(eligibilityCalls, [
		{
			assistantText: "Build the dashboard",
			hasAuthoritativeBrowserOutput: false,
			hasEmittedQuestionCard: false,
			hasEmittedPlanWidget: false,
			hasEmittedGenuiWidget: false,
			looksLikeClarification: false,
			looksLikeInability: false,
			resolvedPlanModeActive: false,
			planSessionActive: false,
			isAborted: false,
			isTaskLikeRequest: true,
			shouldForceCardFirstGenui: true,
			hasObservedActionableToolCall: true,
			hasToolObservationData: true,
		},
	]);
	assert.deepEqual(result, {
		hasAuthoritativeBrowserOutput: false,
		hasToolObservationData: true,
		looksLikeClarification: false,
		looksLikeInability: false,
		looksLikeWriteBlockedFailure: false,
		readonlyBlockedWriteToolNames: [],
		shouldAttemptGenui: true,
		shouldEmitCardFirstFallback: true,
		shouldEmitObservationFallback: true,
		trimmedAssistantText: "Build the dashboard",
	});
});

test("resolveRovoNonStrictPostStreamRouting suppresses observation fallback for authoritative browser output", () => {
	const result = resolveRovoNonStrictPostStreamRouting({
		assistantText: "Done",
		browserBridge: {
			hasAuthoritativeOutput: () => true,
		},
		hasToolObservationEntries: () => true,
		shouldAttemptPostToolGenui: (options) => {
			assert.equal(options.hasAuthoritativeBrowserOutput, true);
			assert.equal(options.hasToolObservationData, false);
			return false;
		},
	});

	assert.equal(result.hasAuthoritativeBrowserOutput, true);
	assert.equal(result.hasToolObservationData, false);
	assert.equal(result.shouldEmitObservationFallback, false);
	assert.equal(result.shouldAttemptGenui, false);
});

test("resolveRovoNonStrictPostStreamRouting logs clarification, inability, and write-blocked detections", () => {
	const logs = [];
	const result = resolveRovoNonStrictPostStreamRouting({
		assistantText: "I need more details",
		getReadonlyBlockedWriteToolNames: () => ["jira.update"],
		hasEmittedQuestionCard: false,
		logger: {
			info(label, data) {
				logs.push({ label, data });
			},
		},
		looksLikeClarificationResponse: () => true,
		looksLikeInabilityResponse: () => true,
		looksLikeWriteBlockedTurn: () => true,
		shouldAttemptPostToolGenui: (options) => {
			assert.equal(options.looksLikeClarification, true);
			assert.equal(options.looksLikeInability, true);
			return false;
		},
		threadId: "thread-1",
		toolObservationEntries: [{ toolName: "jira.update" }],
	});

	assert.deepEqual(logs, [
		{
			label: "[OUTPUT-ROUTING] Clarification-like response detected, skipping GenUI",
			data: { textLength: 19 },
		},
		{
			label: "[OUTPUT-ROUTING] Inability response detected, skipping GenUI",
			data: { textLength: 19 },
		},
		{
			label: "[OUTPUT-ROUTING] Write-blocked turn detected, skipping GenUI",
			data: {
				threadId: "thread-1",
				toolNames: ["jira.update"],
				textLength: 19,
			},
		},
	]);
	assert.equal(result.shouldEmitCardFirstFallback, false);
	assert.equal(result.readonlyBlockedWriteToolNames[0], "jira.update");
});

test("createRovoTextOutputController streams ordinary text and closes when started", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta("Hello");
	controller.emitTextDelta(" world");
	controller.writeTextEndIfStarted();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Hello" },
		{ type: "text-delta", id: "text-test", delta: " world" },
		{ type: "text-end", id: "text-test" },
	]);
	assert.equal(controller.getAssistantText(), "Hello world");
	assert.equal(controller.getUnsuppressedAssistantText(), "Hello world");
	assert.equal(controller.getTextStarted(), true);
});

test("createRovoTextOutputController buffers classifier-style JSON until finalization", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta('{"intent":"genui","confidence":0.9}');

	assert.deepEqual(parts, []);
	assert.equal(controller.getAssistantText(), '{"intent":"genui","confidence":0.9}');
	assert.deepEqual(controller.finalizeBufferedAssistantText(), {
		intent: "genui",
		confidence: 0.9,
	});
	assert.deepEqual(parts, []);
});

test("createRovoTextOutputController can replay suppressed card-first text", () => {
	const { controller, parts } = createTextOutputController({
		suppressStreamingTextForCardFirstGenui: true,
	});

	controller.emitTextDelta("Build the card");
	assert.deepEqual(parts, []);

	controller.emitBufferedAssistantTextForTextRoute();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Build the card" },
	]);
});

test("createRovoTextOutputController holds complete and pending spec fences", () => {
	const { controller, parts } = createTextOutputController({
		isClassifierIntentLeakCandidate: () => false,
		splitSpecFenceTextForStreaming: (text) => {
			if (text.includes("```spec")) {
				return { pendingText: text, visibleText: "" };
			}
			return { pendingText: "", visibleText: text };
		},
	});

	controller.emitTextDelta("Before ");
	controller.emitTextDelta("```spec\n{\"type\":\"card\"}\n```");
	controller.emitTextDelta(" After");
	controller.finalizeBufferedAssistantText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Before " },
		{ type: "text-delta", id: "text-test", delta: " After" },
	]);
});

test("createRovoTextOutputController holds direct media fences", () => {
	const { controller, parts } = createTextOutputController({
		isClassifierIntentLeakCandidate: () => false,
		splitDirectMediaTextForStreaming: (text) => {
			if (text.includes("```image") || text.includes("```audio")) {
				return { pendingText: text, visibleText: "" };
			}
			return { pendingText: "", visibleText: text };
		},
	});

	controller.emitTextDelta("Intro ");
	controller.emitTextDelta("```image\nsunset\n```");
	controller.emitTextDelta(" Outro");
	controller.finalizeBufferedAssistantText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Intro " },
		{ type: "text-delta", id: "text-test", delta: " Outro" },
	]);
});

test("createRovoTextOutputController defers and sanitizes tool-first fallback text", () => {
	const { controller, parts } = createTextOutputController({
		shouldDeferToolFirstText: true,
		stripToolFirstFailureNarrative: (text) => ({
			replaced: text.includes("could not use the tool"),
			text: text.replace("could not use the tool", "used the tool"),
		}),
		toolFirstFailureNarrativeEnabled: true,
	});

	controller.emitTextDelta("I could not use the tool.");
	assert.deepEqual(parts, []);

	controller.removeToolFirstFailureNarrative();
	controller.flushDeferredToolFirstText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "I used the tool." },
	]);
	assert.equal(controller.getAssistantText(), "I used the tool.");
});

test("createRovoTextOutputController forced deltas still honor tool-first deferral", () => {
	const { controller, parts } = createTextOutputController({
		shouldDeferToolFirstText: true,
	});

	controller.emitForcedTextDelta("Forced fallback");
	assert.deepEqual(parts, []);

	controller.flushDeferredToolFirstText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Forced fallback" },
	]);
	assert.equal(controller.getAssistantText(), "Forced fallback");
	assert.equal(controller.getUnsuppressedAssistantText(), "Forced fallback");
});

test("createRovoTextOutputController replacement setter leaves raw text unchanged", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta("router json");
	controller.setAssistantText("Repaired response");
	controller.emitTextDeltaRaw("Repaired response");

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "router json" },
		{ type: "text-delta", id: "text-test", delta: "Repaired response" },
	]);
	assert.equal(controller.getAssistantText(), "Repaired response");
	assert.equal(controller.getUnsuppressedAssistantText(), "router json");
});

test("createRovoTextOutputController reset preserves started stream state", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta("First");
	controller.resetAssistantTextForRetryAttempt();
	controller.emitTextDelta("Second");

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "First" },
		{ type: "text-delta", id: "text-test", delta: "Second" },
	]);
	assert.equal(controller.getAssistantText(), "Second");
	assert.equal(controller.getTextStarted(), true);
});

function createDirectOutputOptions(overrides = {}) {
	const parts = [];
	const calls = {
		buildDirectSpecWidgetParts: [],
		extractDirectSpec: [],
		handleDirectRovoMediaFences: [],
		logs: [],
		suppression: [],
	};
	return {
		calls,
		options: {
			abortSignal: new AbortController().signal,
			assistantText: "assistant text",
			buildDirectSpecWidgetParts: (input) => {
				calls.buildDirectSpecWidgetParts.push(input);
				return [
					{ type: "data-widget-loading", id: input.widgetId },
					{ type: "data-widget-data", id: input.widgetId },
				];
			},
			detectEndpointType: () => "gateway",
			extractDirectSpec: (text) => {
				calls.extractDirectSpec.push(text);
				return null;
			},
			genuiHint: null,
			getEnvVars: () => ({}),
			handleDirectRovoMediaFences: async (input) => {
				calls.handleDirectRovoMediaFences.push(input);
				return { assistantText: input.assistantText };
			},
			latestUserMessage: "Build a card",
			logger: {
				info: (message, data) => calls.logs.push({ message, data }),
			},
			rawModel: "model",
			requestOrigin: "text",
			resolveGatewayUrl: () => "https://gateway.test",
			resolveGoogleImageGatewayConfig: () => ({}),
			streamGoogleGatewayManualSse: async () => {},
			stripDirectMediaFences: (text) => text,
			synthesizeSound: async () => null,
			unsuppressedAssistantText: "raw assistant text",
			widgetPayloadWrapper: (_type, payload) => payload,
			widgetTypeAudio: "audio",
			widgetTypeGenui: "genui",
			widgetTypeImage: "image",
			writer: {
				write(part) {
					parts.push(part);
				},
			},
			...overrides,
		},
		parts,
	};
}

test("finalizeRovoDirectOutputs skips when a prior route already emitted", async () => {
	const { calls, options, parts } = createDirectOutputOptions({
		hasEmittedGenuiWidget: true,
	});

	const result = await finalizeRovoDirectOutputs(options);

	assert.deepEqual(result, {
		assistantText: "assistant text",
		emittedGenuiWidget: false,
		skipped: true,
	});
	assert.deepEqual(parts, []);
	assert.deepEqual(calls.extractDirectSpec, []);
	assert.deepEqual(calls.handleDirectRovoMediaFences, []);
});

test("finalizeRovoDirectOutputs emits direct spec widgets and still strips media fences", async () => {
	const { calls, options, parts } = createDirectOutputOptions({
		extractDirectSpec: (text) => {
			calls.extractDirectSpec.push(text);
			return {
				narrative: "Here is a card",
				spec: { elements: { one: { type: "text" } } },
			};
		},
		handleDirectRovoMediaFences: async (input) => {
			calls.handleDirectRovoMediaFences.push(input);
			return { assistantText: "assistant without media" };
		},
	});

	const result = await finalizeRovoDirectOutputs(options);

	assert.equal(result.assistantText, "assistant without media");
	assert.equal(result.emittedGenuiWidget, true);
	assert.equal(result.skipped, false);
	assert.equal(parts.length, 2);
	assert.equal(calls.buildDirectSpecWidgetParts.length, 1);
	assert.equal(calls.buildDirectSpecWidgetParts[0].widgetType, "genui");
	assert.equal(calls.buildDirectSpecWidgetParts[0].narrative, "Here is a card");
	assert.equal(calls.handleDirectRovoMediaFences.length, 1);
	assert.equal(
		calls.handleDirectRovoMediaFences[0].assistantText,
		"assistant text",
	);
});

test("finalizeRovoDirectOutputs uses unsuppressed text for direct spec detection", async () => {
	const { calls, options } = createDirectOutputOptions({
		assistantText: "visible text",
		hasSuppressedLargeAssistantJson: true,
		unsuppressedAssistantText: "raw spec text",
	});

	await finalizeRovoDirectOutputs(options);

	assert.deepEqual(calls.extractDirectSpec, ["raw spec text"]);
	assert.equal(calls.handleDirectRovoMediaFences[0].assistantText, "visible text");
});

test("resolveRovoPortStuckRecovery returns retry action after recovered restart", async () => {
	const logs = [];
	const result = await resolveRovoPortStuckRecovery({
		attemptCount: 0,
		maxAttempts: 1,
		recoveryPort: 4301,
		restartOptions: { timeoutMs: 100 },
		restartRovoPort: async (options) => ({
			activePids: [123],
			killedPids: [122],
			options,
			recovered: true,
		}),
		shouldRetryInteractiveStuckPortRecovery: ({ recovered }) => recovered,
		logger: {
			info: (message, data) => logs.push({ message, data }),
			error: () => {},
		},
	});

	assert.equal(result.action, "retry");
	assert.equal(result.nextAttemptCount, 1);
	assert.deepEqual(result.statusParts, [
		{
			type: "data-thinking-status",
			data: {
				label: "Recovered stuck port, retrying",
				content: "Rovo port 4301 restarted successfully.",
				activity: "results",
				source: "backend",
			},
		},
	]);
	assert.equal(result.recoveryResult.options.port, 4301);
	assert.equal(result.recoveryResult.options.timeoutMs, 100);
	assert.equal(logs[0].message, "[CHAT-SDK] Port stuck recovery result");
});

test("resolveRovoPortStuckRecovery returns failure text and status after failed restart", async () => {
	const result = await resolveRovoPortStuckRecovery({
		attemptCount: 1,
		buildInteractiveStuckPortFailureMessage: ({ recoveryError, retriedRecovery }) =>
			`failed:${recoveryError}:${retriedRecovery}`,
		maxAttempts: 1,
		recoveryPort: 4301,
		restartRovoPort: async () => ({
			error: "still stuck",
			recovered: false,
		}),
		shouldRetryInteractiveStuckPortRecovery: () => false,
		logger: {
			info: () => {},
			error: () => {},
		},
	});

	assert.equal(result.action, "fail");
	assert.equal(result.nextAttemptCount, 1);
	assert.equal(result.failureText, "failed:still stuck:false");
	assert.deepEqual(result.statusParts, [
		{
			type: "data-thinking-status",
			data: {
				label: "Port recovery failed",
				content: "still stuck",
				activity: "results",
				source: "backend",
			},
		},
	]);
});

test("resolveRovoChatInProgressTimeoutRecovery returns retry after forced recovery", async () => {
	const result = await resolveRovoChatInProgressTimeoutRecovery({
		attemptCount: 0,
		maxAttempts: 1,
		resolvedRecoveryPort: 4302,
		restartOptions: { timeoutMs: 200 },
		restartRovoPort: async (options) => ({
			options,
			recovered: true,
		}),
		logger: {
			info: () => {},
		},
	});

	assert.equal(result.action, "retry");
	assert.equal(result.nextAttemptCount, 1);
	assert.equal(result.recoveryResult.options.port, 4302);
	assert.deepEqual(result.statusParts, [
		{
			type: "data-thinking-status",
			data: {
				label: "Recovered stuck port, retrying",
				content: "Rovo port 4302 restarted successfully.",
				activity: "results",
				source: "backend",
			},
		},
	]);
});

test("resolveRovoChatInProgressTimeoutRecovery returns timeout status after failed recovery", async () => {
	const result = await resolveRovoChatInProgressTimeoutRecovery({
		attemptCount: 0,
		maxAttempts: 1,
		resolvedRecoveryPort: 4302,
		restartRovoPort: async () => ({
			error: "",
			recovered: false,
		}),
		logger: {
			info: () => {},
		},
	});

	assert.equal(result.action, "timeout");
	assert.equal(result.nextAttemptCount, 1);
	assert.deepEqual(result.statusParts, [
		{
			type: "data-thinking-status",
			data: {
				label: "Port recovery failed",
				content: "Failed to recover Rovo port 4302.",
				activity: "results",
				source: "backend",
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: "Rovo turn wait timed out",
				content:
					"Automatic recovery timed out while waiting for the previous turn to clear.",
				activity: "results",
				source: "backend",
			},
		},
	]);
	assert.equal(
		result.textDelta,
		"Automatic recovery timed out while waiting for the previous turn. Please retry or reset the chat.",
	);
});

test("resolveRovoToolFirstRetryPlan returns a retry prompt and status part", () => {
	const result = resolveRovoToolFirstRetryPlan({
		currentToolFirstAttempt: 1,
		hasToolFirstSuccess: false,
		toolFirstExecutionState: {
			relevantToolStarts: 1,
			relevantToolResults: 0,
			relevantToolErrors: 1,
			lastRelevantErrorCategory: "validation",
		},
		toolFirstPolicy: {
			domainLabels: ["Jira"],
			domains: ["jira"],
			enforcement: {
				retryBackoffMs: [25, 50],
			},
			matched: true,
		},
		toolFirstRelevanceDomains: ["jira"],
		toolFirstSoftRetryEnabled: true,
		totalToolFirstAttempts: 3,
		userMessageText: "Show my Jira issues",
	});

	assert.equal(result.action, "retry");
	assert.equal(result.nextAttempt, 2);
	assert.equal(result.retriesRemaining, 1);
	assert.equal(result.retryDelayMs, 25);
	assert.deepEqual(result.statusPart, {
		type: "data-thinking-status",
		data: {
			label: "Retrying integration tools (2/3)",
			activity: "results",
			source: "backend",
		},
	});
	assert.deepEqual(result.logData, {
		domains: ["jira"],
		relevanceDomains: ["jira"],
		attempt: 2,
		maxAttempts: 3,
		retryDelayMs: 25,
		relevantToolStarts: 1,
		relevantToolResults: 0,
		relevantToolErrors: 1,
	});
	assert.deepEqual(result.activeAttemptMessage.enableDeepPlan, false);
	assert.match(
		result.activeAttemptMessage.message,
		/^Show my Jira issues\n\n\[Tool-first retry directive\]/u,
	);
	assert.match(result.activeAttemptMessage.message, /Retry attempt 2 for Jira\./u);
	assert.match(
		result.activeAttemptMessage.message,
		/Remaining retries after this attempt: 1\./u,
	);
});

test("resolveRovoToolFirstRetryPlan stops when base retry conditions fail", () => {
	assert.deepEqual(
		resolveRovoToolFirstRetryPlan({
			currentToolFirstAttempt: 1,
			hasToolFirstSuccess: true,
			toolFirstSoftRetryEnabled: true,
			totalToolFirstAttempts: 2,
		}),
		{
			action: "stop",
		},
	);
	assert.deepEqual(
		resolveRovoToolFirstRetryPlan({
			abortSignal: AbortSignal.abort(),
			currentToolFirstAttempt: 1,
			toolFirstSoftRetryEnabled: true,
			totalToolFirstAttempts: 2,
		}),
		{
			action: "stop",
		},
	);
});

test("finalizeRovoClassifierLeakRepair returns no-op when no classifier payload leaked", async () => {
	const calls = {
		emitTextDeltaRaw: [],
		generateTextViaGateway: [],
		setAssistantText: [],
	};
	const result = await finalizeRovoClassifierLeakRepair({
		emitTextDeltaRaw: (text) => calls.emitTextDeltaRaw.push(text),
		finalizeBufferedAssistantText: () => null,
		generateTextViaGateway: async (options) => {
			calls.generateTextViaGateway.push(options);
			return "unused";
		},
		setAssistantText: (text) => calls.setAssistantText.push(text),
	});

	assert.deepEqual(result, {
		handled: false,
		leakedClassifierPayload: null,
		repairedResponseText: null,
		usedFallback: false,
	});
	assert.deepEqual(calls, {
		emitTextDeltaRaw: [],
		generateTextViaGateway: [],
		setAssistantText: [],
	});
});

test("finalizeRovoClassifierLeakRepair emits a non-classifier gateway repair", async () => {
	const calls = {
		emitTextDeltaRaw: [],
		generateTextViaGateway: [],
		logs: [],
		setAssistantText: [],
	};
	const leakedClassifierPayload = {
		intent: "genui",
		confidence: 0.91,
		reason: "router leak",
	};
	const result = await finalizeRovoClassifierLeakRepair({
		buildSmartGenerationGatewayOptions: ({ provider }) => ({
			provider,
			extraOption: true,
		}),
		emitTextDeltaRaw: (text) => calls.emitTextDeltaRaw.push(text),
		finalizeBufferedAssistantText: () => leakedClassifierPayload,
		generateTextViaGateway: async (options) => {
			calls.generateTextViaGateway.push(options);
			return "  Repaired prose response.  ";
		},
		logger: {
			warn: (message, data) => calls.logs.push({ level: "warn", message, data }),
			error: (message, error) => calls.logs.push({ level: "error", message, error }),
		},
		parseClassifierIntentPayload: (text) =>
			text.trim().startsWith("{") ? { intent: "genui" } : null,
		provider: "openai",
		setAssistantText: (text) => calls.setAssistantText.push(text),
		userMessageText: "Build something",
	});

	assert.equal(result.handled, true);
	assert.equal(result.leakedClassifierPayload, leakedClassifierPayload);
	assert.equal(result.repairedResponseText, "Repaired prose response.");
	assert.equal(result.usedFallback, false);
	assert.deepEqual(calls.setAssistantText, ["Repaired prose response."]);
	assert.deepEqual(calls.emitTextDeltaRaw, ["Repaired prose response."]);
	assert.equal(calls.logs[0].message, "[CHAT-SDK] Suppressed classifier-style JSON response");
	assert.deepEqual(calls.logs[0].data, leakedClassifierPayload);
	assert.equal(calls.generateTextViaGateway.length, 1);
	assert.equal(calls.generateTextViaGateway[0].prompt, "Build something");
	assert.equal(calls.generateTextViaGateway[0].provider, "openai");
	assert.equal(calls.generateTextViaGateway[0].extraOption, true);
	assert.equal(calls.generateTextViaGateway[0].maxOutputTokens, 1200);
	assert.equal(calls.generateTextViaGateway[0].temperature, 0.6);
	assert.match(
		calls.generateTextViaGateway[0].system,
		/Never output router JSON metadata/u,
	);
});

test("finalizeRovoClassifierLeakRepair falls back when repair is classifier JSON", async () => {
	const emitted = [];
	const result = await finalizeRovoClassifierLeakRepair({
		emitTextDeltaRaw: (text) => emitted.push(text),
		finalizeBufferedAssistantText: () => ({ intent: "chat" }),
		generateTextViaGateway: async () => '{"intent":"chat"}',
		logger: {
			warn: () => {},
			error: () => {},
		},
		parseClassifierIntentPayload: (text) =>
			text.trim().startsWith("{") ? { intent: "chat" } : null,
		setAssistantText: (text) => emitted.push(`assistant:${text}`),
		userMessageText: "Hello",
	});

	assert.equal(result.handled, true);
	assert.equal(result.usedFallback, true);
	assert.equal(
		result.repairedResponseText,
		"I had an internal routing issue while generating that response. Please try again and I will answer directly.",
	);
	assert.deepEqual(emitted, [
		"assistant:I had an internal routing issue while generating that response. Please try again and I will answer directly.",
		"I had an internal routing issue while generating that response. Please try again and I will answer directly.",
	]);
});

test("finalizeRovoClassifierLeakRepair falls back after gateway repair failure", async () => {
	const errors = [];
	const result = await finalizeRovoClassifierLeakRepair({
		emitTextDeltaRaw: () => {},
		finalizeBufferedAssistantText: () => ({ intent: "chat" }),
		generateTextViaGateway: async () => {
			throw new Error("gateway down");
		},
		logger: {
			warn: () => {},
			error: (message, error) => errors.push({ message, error }),
		},
		setAssistantText: () => {},
	});

	assert.equal(result.handled, true);
	assert.equal(result.usedFallback, true);
	assert.equal(errors.length, 1);
	assert.equal(
		errors[0].message,
		"[CHAT-SDK] Failed to recover from classifier-style JSON leak:",
	);
	assert.equal(errors[0].error.message, "gateway down");
});

test("finalizeRovoStudioAgentResult returns no-op when missing result should not surface", () => {
	const parts = [];
	const result = finalizeRovoStudioAgentResult({
		creationMode: "agent",
		extractStudioAgentResultFromText: () => {
			throw new Error("should not extract");
		},
		getHasEmittedAgentResult: () => true,
		shouldSurfaceMissingStudioAgentResultFailure: ({ hasAgentResult }) =>
			!hasAgentResult,
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(result, {
		emittedAgentResult: false,
		shouldEmitMissingStudioAgentResultFailure: false,
	});
	assert.deepEqual(parts, []);
});

test("finalizeRovoStudioAgentResult writes extracted agent result payload", () => {
	const parts = [];
	const calls = [];
	const result = finalizeRovoStudioAgentResult({
		creationMode: "agent",
		extractStudioAgentResultFromText: (text) => {
			calls.push(text);
			return {
				payload: {
					name: "Research Agent",
				},
			};
		},
		getAssistantText: () => "assistant text",
		getHasEmittedAgentResult: () => false,
		getUnsuppressedAssistantText: () => "unsuppressed text",
		now: () => 12345,
		shouldSurfaceMissingStudioAgentResultFailure: (input) => {
			assert.deepEqual(input, {
				creationMode: "agent",
				hasAgentResult: false,
				hasDeferredToolRequest: false,
				hasPlanWidget: false,
				hasQuestionCard: false,
			});
			return true;
		},
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(calls, ["unsuppressed text"]);
	assert.deepEqual(parts, [
		{
			type: "data-agent-result",
			id: "studio-agent-result-12345",
			data: {
				name: "Research Agent",
			},
		},
	]);
	assert.deepEqual(result, {
		emittedAgentResult: true,
		shouldEmitMissingStudioAgentResultFailure: false,
	});
});

test("finalizeRovoStudioAgentResult prefers raw agent creation text", () => {
	const calls = [];
	const result = finalizeRovoStudioAgentResult({
		extractStudioAgentResultFromText: (text) => {
			calls.push(text);
			return null;
		},
		getAssistantText: () => "assistant text",
		getHasEmittedAgentResult: () => false,
		getUnsuppressedAssistantText: () => "unsuppressed text",
		rawAgentCreationAssistantText: "raw agent text",
		shouldSurfaceMissingStudioAgentResultFailure: () => true,
		writer: {
			write() {},
		},
	});

	assert.deepEqual(calls, ["raw agent text"]);
	assert.deepEqual(result, {
		emittedAgentResult: false,
		shouldEmitMissingStudioAgentResultFailure: true,
	});
});

test("finalizeRovoStudioAgentResult returns delayed failure flag when extraction fails", () => {
	const parts = [];
	const result = finalizeRovoStudioAgentResult({
		extractStudioAgentResultFromText: () => null,
		getHasEmittedAgentResult: () => false,
		shouldSurfaceMissingStudioAgentResultFailure: () => true,
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(parts, []);
	assert.deepEqual(result, {
		emittedAgentResult: false,
		shouldEmitMissingStudioAgentResultFailure: true,
	});
});

test("emitRovoMissingStudioAgentResultFailure returns no-op when disabled", () => {
	const parts = [];
	const result = emitRovoMissingStudioAgentResultFailure({
		buildMissingStudioAgentResultFailureParts: () => {
			throw new Error("should not build failure parts");
		},
		shouldEmitMissingStudioAgentResultFailure: false,
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(result, {
		emitted: false,
		partCount: 0,
	});
	assert.deepEqual(parts, []);
});

test("emitRovoMissingStudioAgentResultFailure writes delayed failure parts", () => {
	const parts = [];
	const result = emitRovoMissingStudioAgentResultFailure({
		buildMissingStudioAgentResultFailureParts: () => [
			{ type: "data-agent-result", id: "missing-result" },
			{ type: "data-turn-complete", data: { timestamp: "now" } },
		],
		shouldEmitMissingStudioAgentResultFailure: true,
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(parts, [
		{ type: "data-agent-result", id: "missing-result" },
		{ type: "data-turn-complete", data: { timestamp: "now" } },
	]);
	assert.deepEqual(result, {
		emitted: true,
		partCount: 2,
	});
});

test("finalizeRovoPlanWidgetPostStream closes loading and emits error for incomplete plan signal", () => {
	const events = [];
	const result = finalizeRovoPlanWidgetPostStream({
		emitPlanWidgetLoading: (loading) =>
			events.push({ type: "loading", loading }),
		emitWidgetError: (error) => events.push({ type: "error", error }),
		hasEmittedPlanLoadingState: true,
		hasEmittedPlanWidget: false,
		hasSeenPlanWidgetSignal: true,
	});

	assert.deepEqual(events, [
		{ type: "loading", loading: false },
		{
			type: "error",
			error: {
				type: "plan",
				message:
					"I couldn't finish building the plan card. Retry and I'll regenerate it.",
				canRetry: true,
			},
		},
	]);
	assert.deepEqual(result, {
		closedLoading: true,
		emittedError: true,
	});
});

test("finalizeRovoPlanWidgetPostStream closes stale loading after implicit plan payload", () => {
	const events = [];
	const result = finalizeRovoPlanWidgetPostStream({
		emitPlanWidgetLoading: (loading) =>
			events.push({ type: "loading", loading }),
		emitWidgetError: (error) => events.push({ type: "error", error }),
		hasEmittedPlanLoadingState: true,
		hasEmittedPlanWidget: true,
		hasExplicitPlanPayload: false,
		hasSeenPlanWidgetSignal: true,
	});

	assert.deepEqual(events, [{ type: "loading", loading: false }]);
	assert.deepEqual(result, {
		closedLoading: true,
		emittedError: false,
	});
});

test("finalizeRovoPlanWidgetPostStream is a no-op for completed explicit plan payloads", () => {
	const events = [];
	const result = finalizeRovoPlanWidgetPostStream({
		emitPlanWidgetLoading: (loading) =>
			events.push({ type: "loading", loading }),
		emitWidgetError: (error) => events.push({ type: "error", error }),
		hasEmittedPlanLoadingState: true,
		hasEmittedPlanWidget: true,
		hasExplicitPlanPayload: true,
		hasSeenPlanWidgetSignal: true,
	});

	assert.deepEqual(events, []);
	assert.deepEqual(result, {
		closedLoading: false,
		emittedError: false,
	});
});

test("resolveRovoToolFirstFallbackCause preserves normalized causes outside Teamwork Graph time-window fallback", () => {
	assert.equal(
		resolveRovoToolFirstFallbackCause({
			fallbackCause: " no_relevant_tool_success ",
			routeExperience: "generative_ui",
			teamworkGraphTimeWindowEnabled: false,
		}),
		" no_relevant_tool_success ",
	);
	assert.equal(
		resolveRovoToolFirstFallbackCause({
			fallbackCause: "",
			routeExperience: "generative_ui",
			teamworkGraphTimeWindowEnabled: false,
		}),
		null,
	);
});

test("resolveRovoToolFirstFallbackCause resolves Teamwork Graph fallback causes for generated UI without relevant tool success", () => {
	assert.equal(
		resolveRovoToolFirstFallbackCause({
			fallbackCause: null,
			lastRelevantErrorCategory: "validation",
			routeExperience: "generative_ui",
			teamworkGraphTimeWindowEnabled: true,
		}),
		"twg_datetime_validation_to_jira_cql_fallback",
	);
	assert.equal(
		resolveRovoToolFirstFallbackCause({
			fallbackCause: "tool_observation_sparse_result",
			routeExperience: "generative_ui",
			teamworkGraphTimeWindowEnabled: true,
		}),
		"twg_to_jira_cql_tool_observation_fallback",
	);
	assert.equal(
		resolveRovoToolFirstFallbackCause({
			fallbackCause: null,
			routeExperience: "generative_ui",
			teamworkGraphTimeWindowEnabled: true,
		}),
		"twg_to_jira_cql_fallback",
	);
});

test("resolveRovoToolFirstFallbackCause does not rewrite text routes or successful tool-first routes", () => {
	assert.equal(
		resolveRovoToolFirstFallbackCause({
			fallbackCause: "no_relevant_tool_success",
			routeExperience: "text",
			teamworkGraphTimeWindowEnabled: true,
		}),
		"no_relevant_tool_success",
	);
	assert.equal(
		resolveRovoToolFirstFallbackCause({
			fallbackCause: "tool_observation_sparse_result",
			hasRelevantToolSuccessResult: true,
			routeExperience: "generative_ui",
			teamworkGraphTimeWindowEnabled: true,
		}),
		"tool_observation_sparse_result",
	);
});

test("emitRovoToolFirstRouteSummary writes route decision and execution summary", () => {
	const parts = [];
	const logs = [];
	const result = emitRovoToolFirstRouteSummary({
		buildWorkSummaryExecutionLog: () => null,
		createRouteDecisionPart: (data) => ({
			type: "data-route-decision",
			data,
		}),
		hasRelevantToolSuccessResult: false,
		logger: {
			info(label, data) {
				logs.push({ label, data });
			},
		},
		requestOrigin: "studio",
		toolFirstExecutionState: {
			attempts: 2,
			retriesUsed: 1,
			relevantToolStarts: 1,
			relevantToolResults: 0,
			relevantToolErrors: 1,
			hadRelevantToolStart: true,
			lastRelevantToolName: "jira.search",
			lastRelevantErrorCategory: "validation",
		},
		toolFirstFallbackCause: null,
		toolFirstPolicy: {
			domains: ["teamwork-graph"],
			relevanceDomains: ["jira"],
			domainLabels: ["Teamwork Graph"],
			teamworkGraphTimeWindow: { enabled: true },
		},
		toolFirstRelevanceDomains: ["jira"],
		toolFirstRouteExperience: "generative_ui",
		toolFirstRouteReason: "intent_task_toolable",
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(parts, [
		{
			type: "data-route-decision",
			data: {
				intent: "genui",
				origin: "studio",
				reason: "intent_task_toolable",
			},
		},
	]);
	assert.deepEqual(logs, [
		{
			label: "[TOOL-FIRST] Execution summary",
			data: {
				domains: ["teamwork-graph"],
				relevanceDomains: ["jira"],
				domainLabels: ["Teamwork Graph"],
				attempts: 2,
				retriesUsed: 1,
				relevantToolStarts: 1,
				relevantToolResults: 0,
				relevantToolErrors: 1,
				hadRelevantToolStart: true,
				lastRelevantToolName: "jira.search",
				lastRelevantErrorCategory: "validation",
				fallbackUsed: true,
				fallbackCause: "twg_datetime_validation_to_jira_cql_fallback",
			},
		},
	]);
	assert.deepEqual(result, {
		fallbackCause: "twg_datetime_validation_to_jira_cql_fallback",
		routeIntent: "genui",
		workSummaryLog: null,
	});
});

test("emitRovoToolFirstRouteSummary logs work-summary execution details when present", () => {
	const logs = [];
	const workSummaryInput = [];
	const result = emitRovoToolFirstRouteSummary({
		buildWorkSummaryExecutionLog: (execution, options) => {
			workSummaryInput.push({ execution, options });
			return { completed: true, durationMs: options.durationMs };
		},
		createRouteDecisionPart: (data) => ({
			type: "data-route-decision",
			data,
		}),
		hasRelevantToolSuccessResult: true,
		isWorkSummary: true,
		logger: {
			info(label, data) {
				logs.push({ label, data });
			},
		},
		nowMs: () => 1500,
		requestOrigin: "rovo",
		resolvedRovoPort: 8123,
		toolFirstExecutionState: {
			attempts: 1,
			lastRelevantToolName: "teamwork.summary",
		},
		toolFirstFallbackCause: "tool_observation_success",
		toolFirstPolicy: {
			domains: ["teamwork-graph"],
		},
		toolFirstRelevanceDomains: ["teamwork-graph"],
		toolFirstRouteExperience: "text",
		toolFirstRouteReason: "tool_first_success_text",
		workSummaryStartMs: 1000,
		writer: { write() {} },
	});

	assert.deepEqual(workSummaryInput, [
		{
			execution: {
				attempts: 1,
				lastRelevantToolName: "teamwork.summary",
			},
			options: {
				policy: {
					domains: ["teamwork-graph"],
				},
				resolvedPort: 8123,
				durationMs: 500,
			},
		},
	]);
	assert.equal(logs[1].label, "[work-summary] Execution log");
	assert.deepEqual(logs[1].data, { completed: true, durationMs: 500 });
	assert.deepEqual(result, {
		fallbackCause: "tool_observation_success",
		routeIntent: "chat",
		workSummaryLog: { completed: true, durationMs: 500 },
	});
});

test("Rovo thinking status sanitizers preserve supported values", () => {
	assert.equal(sanitizeRovoThinkingLabel("Working..."), "Working");
	assert.equal(sanitizeRovoThinkingLabel("Working…"), "Working");
	assert.equal(sanitizeRovoThinkingLabel(1), "");
	assert.equal(sanitizeRovoThinkingActivity("data"), "data");
	assert.equal(sanitizeRovoThinkingActivity("unknown"), undefined);
	assert.equal(sanitizeRovoThinkingSource("backend"), "backend");
	assert.equal(sanitizeRovoThinkingSource("client"), undefined);
	assert.equal(normalizeRovoThinkingPhase("start"), "start");
	assert.equal(normalizeRovoThinkingPhase("done"), null);
	assert.deepEqual(
		normalizeRovoThinkingStatus({
			label: "Working...",
			content: "  Checking tools  ",
			activity: "results",
			source: "backend",
		}),
		{
			label: "Working",
			content: "Checking tools",
			activity: "results",
			source: "backend",
		},
	);
	assert.deepEqual(
		normalizeRovoThinkingStatus({
			label: "Working",
			content: "  ",
			activity: "invalid",
			source: "client",
		}),
		{
			label: "Working",
			content: undefined,
			activity: undefined,
			source: undefined,
		},
	);
	assert.equal(normalizeRovoThinkingStatus({ label: "  " }), null);
	assert.equal(normalizeRovoThinkingStatus(null), null);
});

test("sanitizeRovoThinkingEvent preserves start and result payloads", () => {
	const startPayload = normalizeRovoThinkingEvent(
		{
			phase: "start",
			toolName: "bash",
			toolCallId: "call-1",
			input: { command: "echo hello" },
		},
		{
			nowIso: () => "2026-07-05T00:00:00.000Z",
			nowMs: () => 123,
			randomId: () => "abcdef",
		},
	);
	assert.deepEqual(startPayload, {
		eventId: "thinking-event-123-abcdef",
		phase: "start",
		toolName: "bash",
		timestamp: "2026-07-05T00:00:00.000Z",
		toolCallId: "call-1",
		input: '{\n  "command": "echo hello"\n}',
	});

	const resultPayload = sanitizeRovoThinkingEvent(
		{
			eventId: "event-result",
			phase: "result",
			toolName: "bash",
			toolCallId: "call-2",
			timestamp: "2026-07-05T00:00:01.000Z",
			output: "full output",
			outputPreview: "preview",
			outputBytes: 123,
			outputTruncated: true,
			suppressedRawOutput: true,
			subagentName: "Worker",
			subagentToolCallId: "subagent-call",
		},
	);
	assert.deepEqual(resultPayload, {
		eventId: "event-result",
		phase: "result",
		toolName: "bash",
		timestamp: "2026-07-05T00:00:01.000Z",
		toolCallId: "call-2",
		subagentName: "Worker",
		subagentToolCallId: "subagent-call",
		output: "full output",
		outputPreview: "preview",
		outputTruncated: true,
		outputBytes: 123,
		suppressedRawOutput: true,
	});
});

test("sanitizeRovoThinkingEvent rewrites bash workaround calls and normalizes errors", () => {
	const payload = normalizeRovoThinkingEvent(
		{
			eventId: "event-error",
			phase: "error",
			toolName: "bash",
			toolCallId: "call-question",
			timestamp: "2026-07-05T00:00:02.000Z",
			errorText: "failed",
			output: "raw failure",
			outputPreview: "preview failure",
			outputTruncated: true,
		},
		{
			bashQuestionCardWorkaroundCallIds: new Set(["call-question"]),
		},
	);

	assert.deepEqual(payload, {
		eventId: "event-error",
		phase: "error",
		toolName: "ask_user_questions",
		timestamp: "2026-07-05T00:00:02.000Z",
		toolCallId: "call-question",
		errorText: "failed",
		output: "raw failure",
		outputPreview: "preview failure",
		outputTruncated: true,
		outputBytes: 15,
	});
	assert.equal(sanitizeRovoThinkingEvent(null), null);
	assert.equal(sanitizeRovoThinkingEvent({ phase: "done" }), null);
});
