"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	runRovoPostStreamFinalizers,
} = require("./rovo-post-stream-finalizers");

function createBaseOptions(overrides = {}) {
	const calls = [];
	let assistantText = "assistant text";
	const options = {
		abortSignal: { aborted: false },
		assistantText,
		buildDirectSpecWidgetParts: () => [],
		buildSmartGenerationGatewayOptions: () => ({}),
		creationMode: "chat",
		detectEndpointType: () => "chat",
		emitPlanWidgetLoading: (loading) => {
			calls.push(["plan-loading", loading]);
		},
		emitTextDeltaRaw: (text) => {
			calls.push(["text-delta-raw", text]);
		},
		emitWidgetError: (error) => {
			calls.push(["widget-error", error]);
		},
		extractDirectSpec: () => null,
		extractStudioAgentResultFromText: () => null,
		finalizeBufferedAssistantText: () => null,
		finalizeRovoClassifierLeakRepair: async (input) => {
			calls.push(["classifier", input.userMessageText]);
			return {
				handled: false,
				leakedClassifierPayload: null,
				repairedResponseText: null,
				usedFallback: false,
			};
		},
		finalizeRovoDirectOutputs: async (input) => {
			calls.push(["direct", input.assistantText]);
			return {
				assistantText: "direct assistant text",
				emittedGenuiWidget: false,
				skipped: false,
			};
		},
		finalizeRovoPlanWidgetPostStream: (input) => {
			calls.push(["plan", {
				hasEmittedPlanLoadingState: input.hasEmittedPlanLoadingState,
				hasEmittedPlanWidget: input.hasEmittedPlanWidget,
				hasExplicitPlanPayload: input.hasExplicitPlanPayload,
				hasSeenPlanWidgetSignal: input.hasSeenPlanWidgetSignal,
			}]);
			return {
				closedLoading: false,
				emittedError: false,
			};
		},
		finalizeRovoStudioAgentResult: (input) => {
			calls.push(["studio", {
				hasDeferredToolRequest: input.hasDeferredToolRequest,
				hasPlanWidget: input.hasPlanWidget,
				hasQuestionCard: input.hasQuestionCard,
			}]);
			return {
				emittedAgentResult: false,
				shouldEmitMissingStudioAgentResultFailure: false,
			};
		},
		generateTextViaGateway: async () => "",
		genuiHint: false,
		getAssistantText: () => assistantText,
		getEnvVars: () => ({}),
		getHasEmittedAgentResult: () => false,
		getHasSuppressedLargeAssistantJson: () => false,
		getUnsuppressedAssistantText: () => "unsuppressed text",
		handleDirectRovoMediaFences: async () => ({ assistantText }),
		hasDeferredToolRequest: false,
		hasEmittedGenuiWidget: false,
		hasEmittedPlanLoadingState: false,
		hasEmittedPlanWidget: false,
		hasEmittedQuestionCard: false,
		hasExplicitPlanPayload: false,
		hasSeenPlanWidgetSignal: false,
		isPlanExecutionActive: false,
		latestUserMessage: "Hello",
		logger: { error: () => {}, info: () => {}, warn: () => {} },
		parseClassifierIntentPayload: () => null,
		provider: "openai",
		rawAgentCreationAssistantText: "",
		rawModel: null,
		requestOrigin: "chat-sdk",
		resolveGatewayUrl: () => "http://gateway.test",
		resolveGoogleImageGatewayConfig: () => ({ ok: false }),
		setAssistantText: (nextAssistantText) => {
			calls.push(["set-assistant", nextAssistantText]);
			assistantText = nextAssistantText;
		},
		shouldSurfaceMissingStudioAgentResultFailure: () => false,
		streamGoogleGatewayManualSse: async () => {},
		stripDirectMediaFences: (text) => ({
			cleanedText: text,
			mediaRequests: [],
		}),
		synthesizeSound: async () => null,
		unsuppressedAssistantText: "unsuppressed text",
		userMessageText: "Hello",
		widgetPayloadWrapper: (_type, payload) => payload,
		widgetTypeAudio: "audio",
		widgetTypeGenui: "generative-ui",
		widgetTypeImage: "image",
		writer: { write: () => {} },
		writeTextEndIfStarted: () => {
			calls.push(["text-end"]);
		},
		...overrides,
	};

	return {
		calls,
		options,
	};
}

test("runRovoPostStreamFinalizers repairs classifier output before abort handling", async () => {
	const { calls, options } = createBaseOptions({
		abortSignal: { aborted: true },
		finalizeRovoClassifierLeakRepair: async (input) => {
			calls.push(["classifier", input.userMessageText]);
			input.setAssistantText("repair before abort");
			return {
				handled: true,
				leakedClassifierPayload: { intent: "chat" },
				repairedResponseText: "repair before abort",
				usedFallback: false,
			};
		},
	});

	const result = await runRovoPostStreamFinalizers(options);

	assert.deepEqual(calls, [
		["classifier", "Hello"],
		["set-assistant", "repair before abort"],
		["text-end"],
	]);
	assert.deepEqual(result, {
		aborted: true,
		hasEmittedGenuiWidget: false,
		shouldEmitMissingStudioAgentResultFailure: false,
	});
});

test("runRovoPostStreamFinalizers carries finalizer state and assistant text forward", async () => {
	const { calls, options } = createBaseOptions({
		finalizeRovoDirectOutputs: async (input) => {
			calls.push(["direct", {
				assistantText: input.assistantText,
				hasEmittedGenuiWidget: input.hasEmittedGenuiWidget,
				hasSuppressedLargeAssistantJson:
					input.hasSuppressedLargeAssistantJson,
				isPlanExecutionActive: input.isPlanExecutionActive,
				unsuppressedAssistantText: input.unsuppressedAssistantText,
			}]);
			return {
				assistantText: "direct output text",
				emittedGenuiWidget: true,
				skipped: false,
			};
		},
		finalizeRovoPlanWidgetPostStream: (input) => {
			calls.push(["plan", {
				hasEmittedPlanLoadingState: input.hasEmittedPlanLoadingState,
				hasEmittedPlanWidget: input.hasEmittedPlanWidget,
				hasExplicitPlanPayload: input.hasExplicitPlanPayload,
				hasSeenPlanWidgetSignal: input.hasSeenPlanWidgetSignal,
			}]);
			return {
				closedLoading: true,
				emittedError: false,
			};
		},
		finalizeRovoStudioAgentResult: (input) => {
			calls.push(["studio", {
				hasDeferredToolRequest: input.hasDeferredToolRequest,
				hasPlanWidget: input.hasPlanWidget,
				hasQuestionCard: input.hasQuestionCard,
			}]);
			return {
				emittedAgentResult: false,
				shouldEmitMissingStudioAgentResultFailure: true,
			};
		},
		getHasSuppressedLargeAssistantJson: () => true,
		hasDeferredToolRequest: true,
		hasEmittedGenuiWidget: false,
		hasEmittedPlanLoadingState: true,
		hasEmittedPlanWidget: true,
		hasEmittedQuestionCard: true,
		hasExplicitPlanPayload: false,
		hasSeenPlanWidgetSignal: true,
		isPlanExecutionActive: true,
	});

	const result = await runRovoPostStreamFinalizers(options);

	assert.deepEqual(calls, [
		["classifier", "Hello"],
		["studio", {
			hasDeferredToolRequest: true,
			hasPlanWidget: true,
			hasQuestionCard: true,
		}],
		["direct", {
			assistantText: "assistant text",
			hasEmittedGenuiWidget: false,
			hasSuppressedLargeAssistantJson: true,
			isPlanExecutionActive: true,
			unsuppressedAssistantText: "unsuppressed text",
		}],
		["set-assistant", "direct output text"],
		["plan", {
			hasEmittedPlanLoadingState: true,
			hasEmittedPlanWidget: true,
			hasExplicitPlanPayload: false,
			hasSeenPlanWidgetSignal: true,
		}],
	]);
	assert.equal(result.aborted, false);
	assert.equal(result.hasEmittedGenuiWidget, true);
	assert.equal(result.shouldEmitMissingStudioAgentResultFailure, true);
	assert.deepEqual(result.directOutputResult, {
		assistantText: "direct output text",
		emittedGenuiWidget: true,
		skipped: false,
	});
	assert.deepEqual(result.planWidgetResult, {
		closedLoading: true,
		emittedError: false,
	});
	assert.deepEqual(result.studioAgentResult, {
		emittedAgentResult: false,
		shouldEmitMissingStudioAgentResultFailure: true,
	});
});

test("runRovoPostStreamFinalizers preserves an already emitted GenUI widget flag", async () => {
	const { options } = createBaseOptions({
		finalizeRovoDirectOutputs: async () => ({
			assistantText: "same text",
			emittedGenuiWidget: false,
			skipped: true,
		}),
		hasEmittedGenuiWidget: true,
	});

	const result = await runRovoPostStreamFinalizers(options);

	assert.equal(result.hasEmittedGenuiWidget, true);
});
