const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoAppManagedResponseConsumer,
} = require("./rovo-app-managed-response-consumer");
const { formatRouteDecisionSSE } = require("./route-decision");

function createStreamResponse({
	chunks = ["data: first\n\n", "data: second\n\n"],
	headers = {},
} = {}) {
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(chunk);
				}
				controller.close();
			},
		}),
		{
			headers: {
				"content-type": "text/event-stream",
				...headers,
			},
		},
	);
}

function createHarness(overrides = {}) {
	const calls = [];
	const marks = [];
	const finalMessages = [
		{
			id: "assistant-1",
			role: "assistant",
			parts: [{ type: "text", text: "Done." }],
		},
	];
	const dependencies = {
		collectUiMessagesFromResponseStream: async (input) => {
			calls.push(["collectUiMessagesFromResponseStream", {
				initialMessages: input.initialMessages,
				routeDecisionToSuppress: input.routeDecisionToSuppress,
			}]);
			input.onMessagesUpdated?.([{ id: "snapshot-1", parts: [] }]);
			return finalMessages;
		},
		createUiMessageChunkSseStream: ({ stream }) => stream,
		settleRovoAppRun: async (run, outcome, { messages }) => {
			calls.push(["settleRovoAppRun", outcome, { ...run }, messages]);
		},
		logger: {
			info: (...args) => calls.push(["info", args]),
			warn: (...args) => calls.push(["warn", args]),
		},
		messagePersistDebounceMs: 1,
		persistRovoAppRunMessagesSnapshot: async (threadId, messages) => {
			calls.push(["persistRovoAppRunMessagesSnapshot", threadId, messages]);
		},
		persistRovoAppRunState: async (threadId, run) => {
			calls.push(["persistRovoAppRunState", threadId, { ...run }]);
		},
		rovoAppRunManager: {
			appendChunk: (threadId, chunk) => {
				calls.push(["appendChunk", threadId, chunk]);
			},
		},
		rovoAppThreadManager: {
			getThread: async (threadId) => {
				calls.push(["getThread", threadId]);
				return {
					id: threadId,
					hermesContext: {
						selectedSkillIds: ["existing-skill"],
					},
				};
			},
			updateThread: async (threadId, patch) => {
				calls.push(["updateThread", threadId, patch]);
				return {
					id: threadId,
					...patch,
				};
			},
		},
		syncRovoAppThreadSession: async (threadId, rovoPort, { thread }) => {
			calls.push(["syncRovoAppThreadSession", threadId, rovoPort, thread]);
			return {
				...thread,
				sessionId: "session-1",
				sessionMode: "persistent",
			};
		},
		...overrides,
	};
	const { consumeRovoAppManagedResponse } = createRovoAppManagedResponseConsumer(dependencies);
	const stageTrace = {
		mark: (name, data) => marks.push([name, data]),
	};

	return {
		calls,
		consumeRovoAppManagedResponse,
		finalMessages,
		marks,
		stageTrace,
	};
}

test("consumeRovoAppManagedResponse persists resolved port, chunks, messages, and finalized run", async () => {
	const { calls, consumeRovoAppManagedResponse, finalMessages, marks, stageTrace } = createHarness();
	const run = {
		id: "run-1",
		rovoPort: 1111,
	};
	const routeDecision = {
		intent: "chat",
		presentation: "text",
		confidence: 0.95,
		reason: "conversational_pattern",
		origin: "text",
	};

	await consumeRovoAppManagedResponse({
		initialMessages: [{ id: "user-1", parts: [] }],
		prependChunk: formatRouteDecisionSSE(routeDecision),
		response: createStreamResponse({
			headers: {
				"x-vpk-rovo-port": "4321",
			},
		}),
		run,
		stageTrace,
		threadId: "thread-1",
	});

	assert.equal(run.rovoPort, 4321);
	assert.equal(run.sessionId, "session-1");
	assert.deepEqual(calls.find((call) => call[0] === "persistRovoAppRunState"), [
		"persistRovoAppRunState",
		"thread-1",
		{
			id: "run-1",
			rovoPort: 4321,
			updatedAt: run.updatedAt,
		},
	]);
	assert.deepEqual(
		calls.filter((call) => call[0] === "appendChunk").map((call) => call.slice(1)),
		[
			["thread-1", formatRouteDecisionSSE(routeDecision)],
			["thread-1", "data: first\n\n"],
			["thread-1", "data: second\n\n"],
		],
	);
	assert.deepEqual(marks, [
		["future_chat_first_chunk", { bytes: Buffer.byteLength("data: first\n\n") }],
	]);
	assert.deepEqual(calls.find((call) => call[0] === "persistRovoAppRunMessagesSnapshot"), [
		"persistRovoAppRunMessagesSnapshot",
		"thread-1",
		finalMessages,
	]);
	assert.deepEqual(calls.find((call) => call[0] === "settleRovoAppRun"), [
		"settleRovoAppRun",
		"completed",
		{
			id: "run-1",
			rovoPort: 4321,
			sessionId: "session-1",
			sessionMode: "persistent",
			updatedAt: run.updatedAt,
		},
		finalMessages,
	]);
});

test("consumeRovoAppManagedResponse rejects non-event-stream responses", async () => {
	const { consumeRovoAppManagedResponse, stageTrace } = createHarness();

	await assert.rejects(
		consumeRovoAppManagedResponse({
			initialMessages: [],
			response: new Response("not a stream", {
				headers: { "content-type": "application/json" },
			}),
			run: { id: "run-1" },
			stageTrace,
			threadId: "thread-1",
		}),
		/Rovo expected an event stream response/u,
	);
});

test("consumeRovoAppManagedResponse prefers the current port header over the legacy header", async () => {
	const { consumeRovoAppManagedResponse, stageTrace } = createHarness();
	const run = {
		id: "run-1",
		rovoPort: 1111,
	};

	await consumeRovoAppManagedResponse({
		initialMessages: [],
		response: createStreamResponse({
			headers: {
				"x-vpk-port": "4321",
				"x-vpk-rovo-port": "9876",
			},
		}),
		run,
		stageTrace,
		threadId: "thread-1",
	});

	assert.equal(run.rovoPort, 4321);
});

test("consumeRovoAppManagedResponse falls back when the current port header is invalid", async () => {
	const { consumeRovoAppManagedResponse, stageTrace } = createHarness();
	const run = {
		id: "run-1",
		rovoPort: 1111,
	};

	await consumeRovoAppManagedResponse({
		initialMessages: [],
		response: createStreamResponse({
			headers: {
				"x-vpk-port": "invalid",
				"x-vpk-rovo-port": "9876",
			},
		}),
		run,
		stageTrace,
		threadId: "thread-1",
	});

	assert.equal(run.rovoPort, 9876);
});

// A response whose stream the test feeds: chunks are UI message SSE events.
function createControlledResponse() {
	let controller;
	const stream = new ReadableStream({
		start(streamController) {
			controller = streamController;
		},
	});
	const encoder = new TextEncoder();
	const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
	return {
		close: () => controller.close(),
		fail: (error) => controller.error(error),
		response: new Response(stream, { headers: { "content-type": "text/event-stream" } }),
		send,
	};
}

function createRealConsumer() {
	const { createRovoAppRunManager } = require("./rovo-app-runs");
	const { createRovoAppRunStateService } = require("./rovo-app-run-state");
	const quiet = { error: () => {}, info: () => {}, warn: () => {} };
	const runManager = createRovoAppRunManager({ logger: quiet });
	const threadWrites = [];
	const state = createRovoAppRunStateService({
		activeRequests: new Map(),
		logger: quiet,
		rovoAppRunManager: runManager,
		rovoAppThreadManager: {
			listThreads: async () => [],
			updateThread: async (threadId, patch) => {
				threadWrites.push(patch);
				return { id: threadId, ...patch };
			},
		},
		startNextQueuedRun: () => {},
		synchronizeRovoAppThreadGeneratedFiles: async () => {},
	});
	const { consumeRovoAppManagedResponse } = createRovoAppManagedResponseConsumer({
		logger: quiet,
		messagePersistDebounceMs: 450,
		persistRovoAppRunMessagesSnapshot: state.persistRovoAppRunMessagesSnapshot,
		persistRovoAppRunState: state.persistRovoAppRunState,
		rovoAppRunManager: runManager,
		rovoAppThreadManager: { getThread: async () => null },
		settleRovoAppRun: state.settleRovoAppRun,
		syncRovoAppThreadSession: async () => null,
	});
	return { consumeRovoAppManagedResponse, runManager, state, threadWrites };
}

test.before(async () => {
	await require("./ai-sdk-runtime").loadAiSdk();
});

async function drain() {
	for (let turn = 0; turn < 10; turn += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

test("a replaced run's stream writes nothing into the run that replaced it or into the thread", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.after(() => t.mock.timers.reset());
	const { consumeRovoAppManagedResponse, runManager, state, threadWrites } = createRealConsumer();
	const oldRun = runManager.createRun({ threadId: "thread-1" });
	runManager.markRunStarted("thread-1", { status: "streaming" });
	const upstream = createControlledResponse();
	const consuming = consumeRovoAppManagedResponse({
		initialMessages: [],
		response: upstream.response,
		run: oldRun,
		stageTrace: { mark() {} },
		threadId: "thread-1",
	});
	upstream.send({ type: "text-start", id: "text-1" });
	await drain();

	await state.settleRovoAppRun(oldRun, "cancelled");
	const successor = runManager.createRun({ threadId: "thread-1" });
	runManager.markRunStarted("thread-1", { status: "streaming" });
	threadWrites.length = 0;

	upstream.send({ type: "text-delta", id: "text-1", delta: "old answer" });
	upstream.send({ type: "text-end", id: "text-1" });
	await drain();
	t.mock.timers.tick(1_000);
	upstream.close();
	await consuming;
	await drain();

	assert.deepEqual(successor.bufferedChunks, []);
	assert.equal(runManager.getRun("thread-1"), successor);
	assert.deepEqual(threadWrites, []);
});

test("a stream that fails leaves no snapshot write scheduled and no unhandled rejection", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.after(() => t.mock.timers.reset());
	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);
	t.after(() => process.off("unhandledRejection", onUnhandled));
	const { consumeRovoAppManagedResponse, runManager, threadWrites } = createRealConsumer();
	const run = runManager.createRun({ threadId: "thread-1" });
	runManager.markRunStarted("thread-1", { status: "streaming" });
	const upstream = createControlledResponse();
	const consuming = consumeRovoAppManagedResponse({
		initialMessages: [],
		response: upstream.response,
		run,
		stageTrace: { mark() {} },
		threadId: "thread-1",
	});
	upstream.send({ type: "text-start", id: "text-1" });
	upstream.send({ type: "text-delta", id: "text-1", delta: "partial" });
	await drain();
	upstream.fail(new Error("upstream died"));

	await assert.rejects(consuming, /upstream died/u);
	t.mock.timers.tick(1_000);
	await drain();

	assert.deepEqual(threadWrites, []);
	assert.deepEqual(unhandled, []);
});
