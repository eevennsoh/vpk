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
		finalizeRovoAppRun: async (threadId, run, messages) => {
			calls.push(["finalizeRovoAppRun", threadId, { ...run }, messages]);
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
	assert.deepEqual(calls.find((call) => call[0] === "finalizeRovoAppRun"), [
		"finalizeRovoAppRun",
		"thread-1",
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
