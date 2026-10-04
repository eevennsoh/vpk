"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	runRovoPostStreamPipeline,
} = require("./rovo-post-stream-pipeline");

function createBaseOptions(overrides = {}) {
	const events = [];
	const toolFirstExecutionState = {
		attempts: 1,
	};
	const routingResult = {
		getRouteToolsDetected: () => true,
		hasEmittedGenuiWidget: true,
	};

	return {
		events,
		options: {
			abortSignal: { aborted: false },
			activeRequests: new Map(),
			flushRovoMarkerStream: () => {
				events.push(["flush"]);
			},
			getAssistantText: () => "assistant text",
			getRawAgentCreationAssistantText: () => "raw agent text",
			getUnsuppressedAssistantText: () => "unsuppressed text",
			hasEmittedGenuiWidget: false,
			hasObservedDeferredToolRequest: true,
			hasRelevantToolSuccess: (state) => {
				events.push(["has-success", state]);
				return true;
			},
			hasToolObservationEntries: () => true,
			isPlanExecutionPhase: (threadId) => {
				events.push(["plan-phase", threadId]);
				return false;
			},
			logger: console,
			onHasEmittedGenuiWidget: (value) => {
				events.push(["set-genui", value]);
			},
			onShouldEmitMissingStudioAgentResultFailure: (value) => {
				events.push(["set-missing-agent", value]);
			},
			requestUserInputQuestionCardEmitter: {
				closePendingLoading() {},
			},
			resolvePlanExecutionCompletionFn: () => null,
			runRovoPostStreamFinalizers: async (finalizerOptions) => {
				events.push([
					"finalizers",
					finalizerOptions.assistantText,
					finalizerOptions.hasDeferredToolRequest,
					finalizerOptions.rawAgentCreationAssistantText,
					finalizerOptions.isPlanExecutionActive,
				]);
				return {
					aborted: false,
					hasEmittedGenuiWidget: true,
					shouldEmitMissingStudioAgentResultFailure: true,
				};
			},
			runRovoPostStreamRouting: async (routingOptions) => {
				events.push([
					"routing",
					routingOptions.hasEmittedGenuiWidget,
					routingOptions.hasRelevantToolSuccess(),
					routingOptions.hasToolObservationEntries(),
				]);
				return routingResult;
			},
			completeRovoPostTurn: async (completionOptions) => {
				events.push([
					"completion",
					completionOptions.getRouteToolsDetected(),
					completionOptions.shouldEmitMissingStudioAgentResultFailure,
				]);
			},
			threadId: "thread-1",
			toolFirstExecutionState,
			writer: { write() {} },
			...overrides,
		},
		routingResult,
		toolFirstExecutionState,
	};
}

test("runRovoPostStreamPipeline preserves flush, finalizer, routing, completion order", async () => {
	const { events, options, routingResult, toolFirstExecutionState } =
		createBaseOptions();

	const result = await runRovoPostStreamPipeline(options);

	assert.deepEqual(result, {
		aborted: false,
		postStreamFinalizerResult: {
			aborted: false,
			hasEmittedGenuiWidget: true,
			shouldEmitMissingStudioAgentResultFailure: true,
		},
		postStreamRoutingResult: routingResult,
	});
	assert.deepEqual(events, [
		["flush"],
		["plan-phase", "thread-1"],
		["finalizers", "assistant text", true, "raw agent text", false],
		["set-genui", true],
		["set-missing-agent", true],
		["has-success", toolFirstExecutionState],
		["routing", true, true, true],
		["completion", true, true],
	]);
});

test("runRovoPostStreamPipeline skips routing and completion when finalizers abort", async () => {
	const { events, options } = createBaseOptions({
		runRovoPostStreamFinalizers: async () => {
			events.push(["finalizers"]);
			return {
				aborted: true,
				hasEmittedGenuiWidget: false,
				shouldEmitMissingStudioAgentResultFailure: false,
			};
		},
		runRovoPostStreamRouting: async () => {
			throw new Error("routing should not run");
		},
		completeRovoPostTurn: async () => {
			throw new Error("completion should not run");
		},
	});

	const result = await runRovoPostStreamPipeline(options);

	assert.deepEqual(result, {
		aborted: true,
		postStreamFinalizerResult: {
			aborted: true,
			hasEmittedGenuiWidget: false,
			shouldEmitMissingStudioAgentResultFailure: false,
		},
	});
	assert.deepEqual(events, [
		["flush"],
		["plan-phase", "thread-1"],
		["finalizers"],
	]);
});
