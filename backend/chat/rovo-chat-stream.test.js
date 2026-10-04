"use strict";

const assert = require("node:assert/strict");
const { before, test } = require("node:test");
const { loadAiSdk } = require("../lib/ai-sdk-runtime");
const { createRovoTurnRunner, createRovoChatRoute } = require("./rovo-chat-stream");
const { createRequestState, createContractDependencies } = require("./chat-sdk-handler.fixture");
const { finalizePlanExecutionArtifactPostStream } = require("./post-turn");

before(async () => { await loadAiSdk(); });

function createTurn(overrides = {}) {
	return {
		...createRequestState({ backendPreference: "rovo" }),
		isStrictToolFirstTurn: false,
		isTaskLikeRequest: false,
		prefersGenuiCardExperience: false,
		smartGenerationActive: false,
		stageTrace: { mark() {} },
		toolFirstPolicy: { domains: [], enforcement: {}, relevanceDomains: [] },
		userMessageText: "Hello",
		...overrides,
	};
}

function createOutput(signal = new AbortController().signal) {
	const parts = [];
	return { parts, context: { signal, emit: (part) => parts.push(part) } };
}

function visibleText(parts) {
	return parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
}

test("runTurn emits text before artifact persistence and turn completion", async () => {
	const outcomes = [];
	const { dependencies } = createContractDependencies({
		finalizePlanExecutionArtifactPostStream,
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			onTextDelta("Finished building");
		},
		syncRovoAppThreadSessionFromCurrentPort: async () => {
			outcomes.push("persist-session");
			return { id: "thread-1", messages: [] };
		},
		resolvePlanExecutionCompletion: () => ({
			shouldFinalizePlan: true,
			shouldCreateArtifact: true,
			appRoute: "/built-app",
			appRoutes: ["/built-app"],
		}),
		rovoAppDocumentManager: {
			async createDocument(document) {
				outcomes.push(document.content);
				return { id: "document-1", ...document };
			},
		},
		rovoAppThreadManager: {
			async updateThread(id, update) { outcomes.push([id, update.activeDocumentId]); },
		},
		generatePlanMetadataViaGateway: async () => ({ shortDescription: "The built app" }),
		clearPlanSession: (id) => outcomes.push(["plan-cleared", id]),
	});
	const { context, parts } = createOutput();
	const result = await createRovoTurnRunner(dependencies)(createTurn(), context);

	assert.equal(result.aborted, false);
	assert.match(visibleText(parts), /Finished building.*Your app is ready/su);
	assert.deepEqual(outcomes, ["persist-session", "persist-session", "/built-app", ["thread-1", "document-1"], ["plan-cleared", "thread-1"]]);
	assert.equal(parts.find((part) => part.type === "data-artifact-result").data.documentId, "document-1");
	assert.equal(parts.at(-1).type, "data-turn-complete");
	assert.equal(dependencies.activeRequests.size, 0);
});

test("runTurn retries in order and discards prior attempt text before completing", async () => {
	const messages = [];
	const { dependencies } = createContractDependencies({
		streamViaRovo: async ({ message, onTextDelta }) => {
			messages.push(message.message);
			onTextDelta(messages.length === 1 ? "Discard this attempt" : "Recovered answer");
		},
		resolveRovoToolFirstRetryPlan: ({ currentToolFirstAttempt }) => currentToolFirstAttempt === 1
			? { action: "retry", activeAttemptMessage: { message: "Try again", enableDeepPlan: false }, nextAttempt: 2, retryDelayMs: 0, statusPart: { type: "data-thinking-status", data: { label: "Retrying" } } }
			: { action: "complete" },
		hasRelevantToolSuccess: () => true,
	});
	const { parts, context } = createOutput();
	await createRovoTurnRunner(dependencies)(createTurn({
		isStrictToolFirstTurn: true,
		toolFirstPolicy: { domains: [], enforcement: { mode: "soft-retry", maxRelevantRetries: 1 } },
	}), context);

	assert.deepEqual(messages, ["Hello", "Try again"]);
	assert.equal(visibleText(parts), "Recovered answer");
	assert.equal(parts.at(-1).type, "data-turn-complete");
});

test("runTurn propagates cancellation through transport and skips persistence/completion", async () => {
	const controller = new AbortController();
	let observedSignal;
	const { dependencies } = createContractDependencies({
		streamViaRovo: async ({ signal, onPortAcquired, onTextDelta }) => {
			observedSignal = signal;
			onPortAcquired(43123);
			onTextDelta("Partial answer");
			controller.abort("cancelled by viewer");
		},
		syncRovoAppThreadSessionFromCurrentPort: async () => null,
		finalizePlanExecutionArtifactPostStream: async () => { throw new Error("cancelled turn must not finalize"); },
	});
	const { context, parts } = createOutput(controller.signal);
	const result = await createRovoTurnRunner(dependencies)(createTurn(), context);

	assert.equal(result.aborted, true);
	assert.equal(observedSignal.aborted, true);
	assert.equal(observedSignal.reason, "cancelled by viewer");
	assert.equal(parts.some((part) => part.type === "data-turn-complete"), false);
	assert.equal(dependencies.activeRequests.size, 0);
});

test("runTurn does no transport work when already cancelled", async () => {
	const controller = new AbortController();
	controller.abort();
	const { dependencies } = createContractDependencies({ streamViaRovo: async () => { throw new Error("must not start"); } });
	const { parts, context } = createOutput(controller.signal);
	assert.deepEqual(await createRovoTurnRunner(dependencies)(createTurn(), context), { aborted: true });
	assert.deepEqual(parts, []);
});

test("runTurn handles deferred clarification retry before fresh completion", async () => {
	const messages = [];
	const { dependencies } = createContractDependencies({
		streamViaRovo: async ({ message, onTextDelta }) => {
			messages.push(message.message);
			if (messages.length === 1) { throw new Error("pending deferred tool request"); }
			onTextDelta("Resumed with answers");
		},
		synthesiseDeferredToolResponseFromClarification: () => ({ type: "DeferredToolResponse", answers: ["Project A"] }),
	});
	const { parts, context } = createOutput();
	await createRovoTurnRunner(dependencies)(createTurn({ clarificationSubmission: { sessionId: "clarification-1", answers: { project: "Project A" } } }), context);
	assert.deepEqual(messages, ["Hello", { type: "DeferredToolResponse", answers: ["Project A"] }]);
	assert.equal(visibleText(parts), "Resumed with answers");
	assert.equal(parts.at(-1).type, "data-turn-complete");
});

test("runTurn releases its active request and abort subscription when completion fails", async () => {
	const controller = new AbortController();
	let observedSignal;
	const failure = new Error("completion failed");
	const { dependencies } = createContractDependencies({
		streamViaRovo: async ({ signal, onPortAcquired }) => { observedSignal = signal; onPortAcquired(43123); },
		finalizePlanExecutionArtifactPostStream: async () => { throw failure; },
	});
	const { context, parts } = createOutput(controller.signal);
	await assert.rejects(createRovoTurnRunner(dependencies)(createTurn(), context), (error) => error === failure);
	controller.abort();
	assert.equal(observedSignal.aborted, false);
	assert.equal(dependencies.activeRequests.size, 0);
	assert.equal(parts.some((part) => part.type === "data-turn-complete"), false);
});

test("runTurn tolerates persistence failure and still completes", async () => {
	const { dependencies } = createContractDependencies({
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => { onPortAcquired(43123); onTextDelta("Still complete"); },
		syncRovoAppThreadSessionFromCurrentPort: async () => { throw new Error("storage offline"); },
	});
	const { context, parts } = createOutput();
	await createRovoTurnRunner(dependencies)(createTurn(), context);
	assert.equal(visibleText(parts), "Still complete");
	assert.equal(parts.at(-1).type, "data-turn-complete");
});

test("HTTP adapter preserves stream error payload mapping", async () => {
	let stream;
	const { dependencies } = createContractDependencies({
		resolvePreferredBackend: async () => ({ backend: "rovo" }),
		createChatAbortTracking: () => ({ abortController: new AbortController(), cleanupAbortTracking() {} }),
		createUIMessageStream: (options) => options,
		pipeUIMessageStreamToResponse: (options) => { stream = options.stream; },
	});
	await createRovoChatRoute(dependencies)(createTurn(), { req: {}, res: {} });
	assert.equal(stream.onError(new Error("Rovo failed")), "Rovo failed");
	assert.equal(stream.onError("bad"), "Failed to stream AI response");
});

test("runTurn plan feedback guard cancels its transport without completing", async () => {
	const cancellations = [];
	let observedSignal;
	const { dependencies } = createContractDependencies({
		getPlanFeedbackToolGuard: () => ({ ignore: false, block: true }),
		rovoCancelChat: async (port) => cancellations.push(port),
		streamViaRovo: async ({ signal, onPortAcquired, onToolCallStart }) => {
			observedSignal = signal;
			onPortAcquired(43123);
			onToolCallStart({ toolCallId: "blocked-write", toolName: "update_todo" });
		},
	});
	const { context, parts } = createOutput();
	const result = await createRovoTurnRunner(dependencies)(createTurn({ isPlanFeedbackDeferredResumeTurn: true }), context);
	assert.equal(result.aborted, true);
	assert.equal(observedSignal.aborted, true);
	assert.deepEqual(cancellations, [43123]);
	assert.equal(parts.some((part) => part.type === "data-turn-complete"), false);
	assert.equal(dependencies.activeRequests.size, 0);
});

test("runTurn cancellation during retry delay prevents the next attempt", async () => {
	const controller = new AbortController();
	const messages = [];
	const { dependencies } = createContractDependencies({
		streamViaRovo: async ({ message }) => messages.push(message.message),
		resolveRovoToolFirstRetryPlan: () => ({
			action: "retry",
			activeAttemptMessage: { message: "Must not start" },
			nextAttempt: 2,
			retryDelayMs: 10_000,
			statusPart: { type: "data-thinking-status", data: { label: "Retry pending" } },
		}),
	});
	const { context, parts } = createOutput(controller.signal);
	context.emit = (part) => {
		parts.push(part);
		if (part.type === "data-thinking-status" && part.data.label === "Retry pending") {
			setImmediate(() => controller.abort());
		}
	};
	const result = await createRovoTurnRunner(dependencies)(createTurn({
		isStrictToolFirstTurn: true,
		toolFirstPolicy: { domains: [], enforcement: { mode: "soft-retry", maxRelevantRetries: 1 } },
	}), context);
	assert.equal(result.aborted, true);
	assert.deepEqual(messages, ["Hello"]);
	assert.equal(parts.some((part) => part.type === "data-turn-complete"), false);
});

test("a composed runner keeps question state local to each turn", async () => {
	let turnIndex = 0;
	const { dependencies } = createContractDependencies({
		streamViaRovo: async ({ onPortAcquired, onDeferredToolRequest, onTextDelta }) => {
			onPortAcquired(43123);
			turnIndex += 1;
			if (turnIndex === 1) {
				await onDeferredToolRequest({ toolCallId: "question-1", toolName: "ask_user_questions", toolInput: { question: "Which project?" } });
			} else {
				onTextDelta("A fresh answer");
			}
		},
	});
	const runTurn = createRovoTurnRunner(dependencies);
	const first = createOutput();
	const second = createOutput();
	await runTurn(createTurn(), first.context);
	await runTurn(createTurn(), second.context);
	assert.equal(first.parts.some((part) => part.type === "data-widget-data"), true);
	assert.equal(second.parts.some((part) => part.type === "data-widget-data"), false);
	assert.equal(visibleText(second.parts), "A fresh answer");
	assert.equal(second.parts.at(-1).type, "data-turn-complete");
});

for (const failsCompletion of [false, true]) {
	test(`runTurn preserves a successor request when ${failsCompletion ? "failed" : "successful"} completion finishes`, async () => {
		const successor = { port: 43124, abortController: new AbortController() };
		const failure = new Error("completion failed after successor acquired thread");
		let syncCount = 0;
		const { dependencies } = createContractDependencies({
			streamViaRovo: async ({ onPortAcquired, onTextDelta }) => { onPortAcquired(43123); onTextDelta("Finished turn"); },
			syncRovoAppThreadSessionFromCurrentPort: async () => {
				syncCount += 1;
				if (syncCount === 2) { dependencies.activeRequests.set("thread-1", successor); }
				return null;
			},
			finalizePlanExecutionArtifactPostStream: async () => { if (failsCompletion) { throw failure; } },
		});
		const { context, parts } = createOutput();
		const completed = createRovoTurnRunner(dependencies)(createTurn(), context);
		if (failsCompletion) {
			await assert.rejects(completed, (error) => error === failure);
		} else {
			await completed;
		}
		assert.equal(dependencies.activeRequests.get("thread-1") === successor, true);
		assert.equal(dependencies.activeRequests.size, 1);
		assert.equal(parts.some((part) => part.type === "data-turn-complete"), !failsCompletion);
	});
}
