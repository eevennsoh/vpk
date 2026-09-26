const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	createRovoAppImmediateDispatchLifecycle,
	dispatchQueuedRovoAppActionImmediately,
	dispatchRovoAppPromptNow,
	submitRovoAppDelegationDispatch,
	submitRovoAppPromptDispatch,
} = loadRovoCoreModule("lib/rovo-app-dispatch-lifecycle.ts");

function createTextMessage(id, text) {
	return {
		id,
		role: "user",
		parts: [{ type: "text", text }],
	};
}

function createQueuedAction(id, overrides = {}) {
	return {
		id,
		threadId: "thread-1",
		text: id,
		createdAt: 1,
		kind: "prompt",
		files: [],
		mode: "default",
		...overrides,
	};
}

test("createRovoAppImmediateDispatchLifecycle toggles dispatch refs and interrupts the active turn", async () => {
	const immediateDispatchInProgressRef = { current: false };
	const queueProcessorRunningRef = { current: true };
	const calls = [];
	const interruptActiveTurnRef = {
		current: async (options) => {
			calls.push(options);
		},
	};
	const lifecycle = createRovoAppImmediateDispatchLifecycle({
		immediateDispatchInProgressRef,
		interruptActiveTurnRef,
		queueProcessorRunningRef,
	});

	lifecycle.begin();
	await lifecycle.interruptActiveTurn();
	lifecycle.complete();

	assert.equal(immediateDispatchInProgressRef.current, false);
	assert.equal(queueProcessorRunningRef.current, false);
	assert.deepEqual(calls, [{ source: "user-stop" }]);
});

function createPromptNowInput(overrides = {}) {
	const calls = [];
	let messages = [
		{
			id: "assistant-baseline",
			role: "assistant",
			parts: [{ type: "text", text: "Previous response" }],
		},
	];
	let dismissedKeys = new Set(["thread-1:plan-a", "thread-2:plan-b"]);
	let planningSession = "unset";
	const input = {
		activeDocument: null,
		activeDocumentContent: "",
		appendLocalUserMessage: ({ metadata, text }) => {
			calls.push(["append", text, metadata]);
			const message = {
				id: "user-1",
				role: "user",
				parts: [{ type: "text", text }],
				metadata,
			};
			messages = [...messages, message];
			return { message, messageId: message.id };
		},
		artifactDraftContent: "",
		clearDirectDelegationState: () => {
			calls.push(["clear-delegation"]);
		},
		clearStreamingArtifactState: () => {
			calls.push(["clear-streaming"]);
		},
		contextDescription: undefined,
		delegationAbortControllerRef: {
			current: {
				abort: () => {
					calls.push(["abort-delegation"]);
				},
			},
		},
		ensureThread: async (title) => {
			calls.push(["ensure-thread", title]);
			return "thread-1";
		},
		files: [],
		flushQueuedStreamingArtifactDeltaNow: () => {
			calls.push(["flush-streaming"]);
		},
		lastUseChatBusyAtRef: { current: 0 },
		markLocalThreadRunPending: (threadId) => {
			calls.push(["mark-run", threadId]);
		},
		messageMetadata: undefined,
		mode: "default",
		planModeSyncRequestIdRef: { current: 0 },
		releaseCompletedUseChatTurnIfNeeded: async () => {
			calls.push(["release-turn"]);
		},
		resetPendingArtifactAssociation: () => {
			calls.push(["reset-artifact-association"]);
		},
		rovoMessagesRef: { current: messages },
		sendMessage: async (message, options) => {
			calls.push(["send", message, options]);
		},
		clearPlanExecutionTrackerDismissalsForThread: (threadId) => {
			dismissedKeys = new Set(
				[...dismissedKeys].filter((key) => !key.startsWith(`${threadId}:`)),
			);
			calls.push(["dismissed-keys", [...dismissedKeys]]);
		},
		setAttachedRunStatus: (status) => {
			calls.push(["attached-run", status]);
		},
		setInputError: (message) => {
			calls.push(["input-error", message]);
		},
		setLocalThreadActiveRun: (threadId, activeRun) => {
			calls.push(["local-run", threadId, activeRun]);
		},
		setPlanningSession: (updater) => {
			planningSession = typeof updater === "function" ? updater(planningSession) : updater;
			calls.push(["planning-session", planningSession]);
		},
		setRovoMessages: (updater) => {
			messages = typeof updater === "function" ? updater(messages) : updater;
			calls.push(["messages", messages]);
		},
		stopUseChat: async () => {
			calls.push(["stop-use-chat"]);
		},
		streamingArtifact: null,
		streamingArtifactRef: { current: null },
		syncAgentModeForDispatch: async (mode) => {
			calls.push(["sync-mode", mode]);
		},
		text: "Build something",
		toUserErrorMessage: (error) => `User error: ${error.message}`,
		useChatStatus: "ready",
		useChatStatusRef: { current: "ready" },
		...overrides,
	};

	return {
		calls,
		getDismissedKeys: () => dismissedKeys,
		getMessages: () => messages,
		getPlanningSession: () => planningSession,
		input,
	};
}

test("submitRovoAppPromptDispatch queues busy queue-mode prompts and kicks processing", async () => {
	const queued = [];
	const dispatched = [];
	let kickCount = 0;
	const result = await submitRovoAppPromptDispatch({
		activeThreadId: "thread-1",
		dispatchPromptNow: async (payload) => {
			dispatched.push(payload);
		},
		draftThreadId: "draft",
		enqueuePromptAction: (payload) => {
			queued.push(payload);
		},
		files: [],
		getHasBusyTurn: () => true,
		isPlanModeActive: true,
		isQueueProcessorRunning: false,
		kickQueue: () => {
			kickCount += 1;
		},
		queuedActionsByThreadId: {},
		setInputError: () => {},
		text: "  Build a plan  ",
	});

	assert.equal(result, "queued");
	assert.deepEqual(dispatched, []);
	assert.equal(kickCount, 1);
	assert.deepEqual(queued, [
		{
			text: "Build a plan",
			files: [],
			contextDescription: undefined,
			creationMode: undefined,
			messageMetadata: { submittedMode: "plan" },
			mode: "plan",
			threadId: "thread-1",
		},
	]);
});

test("submitRovoAppPromptDispatch interrupts before Studio immediate dispatch and restarts the queue", async () => {
	const events = [];
	const result = await submitRovoAppPromptDispatch({
		activeThreadId: "thread-1",
		creationMode: "agent",
		dispatchPromptNow: async (payload) => {
			events.push(["dispatch", payload.text, payload.creationMode]);
		},
		draftThreadId: "draft",
		enqueuePromptAction: () => {
			throw new Error("prompt should dispatch immediately");
		},
		files: [],
		getHasBusyTurn: () => false,
		immediateDispatch: {
			begin: () => {
				events.push(["begin"]);
			},
			complete: () => {
				events.push(["complete"]);
			},
			interruptActiveTurn: async () => {
				events.push(["interrupt"]);
			},
		},
		isPlanModeActive: false,
		isQueueProcessorRunning: true,
		kickQueue: () => {
			events.push(["kick"]);
		},
		queuedActionsByThreadId: {
			"thread-1": [{ id: "queued-1" }],
		},
		sendMode: "immediate",
		setInputError: () => {},
		text: "  Build an agent  ",
	});

	assert.equal(result, "dispatched");
	assert.deepEqual(events, [
		["begin"],
		["interrupt"],
		["dispatch", "Build an agent", "agent"],
		["complete"],
		["kick"],
	]);
});

test("dispatchRovoAppPromptNow skips empty prompts without creating a thread", async () => {
	const { calls, input } = createPromptNowInput({
		text: "  ",
		files: [],
		ensureThread: async () => {
			throw new Error("empty prompt should not create a thread");
		},
	});

	await dispatchRovoAppPromptNow(input);

	assert.deepEqual(calls, [["input-error", null]]);
});

test("dispatchRovoAppPromptNow sends Studio creation mode through metadata and body", async () => {
	const { calls, getDismissedKeys, getPlanningSession, input } = createPromptNowInput({
		contextDescription: "Use the Studio context",
		creationMode: "agent",
		messageMetadata: { source: "composer" },
		mode: "plan",
		text: "  Build an agent  ",
	});

	await dispatchRovoAppPromptNow(input);

	const sendCall = calls.find((call) => call[0] === "send");
	assert.ok(sendCall);
	assert.deepEqual(sendCall[1], {
		text: "Build an agent",
		files: [],
		messageId: "user-1",
		metadata: {
			source: "composer",
			creationMode: "agent",
			submittedMode: "plan",
		},
	});
	assert.deepEqual(sendCall[2].body, {
		id: "thread-1",
		artifactContext: undefined,
		contextDescription: "Use the Studio context",
		creationMode: "agent",
		isPlanMode: true,
		streamingArtifact: undefined,
	});
	assert.deepEqual([...getDismissedKeys()], ["thread-2:plan-b"]);
	assert.deepEqual(getPlanningSession(), {
		requestId: 1,
		phase: "awaiting-plan",
		hasStreamStarted: false,
		retryUsed: false,
		baselineAssistantMessageId: "assistant-baseline",
	});
});

test("dispatchRovoAppPromptNow checkpoints streaming artifacts before clearing active state", async () => {
	const streamingArtifact = {
		documentId: "doc-1",
		title: "Draft",
		kind: "markdown",
		content: "stale",
		status: "streaming",
	};
	const streamingArtifactRef = { current: streamingArtifact };
	const { calls, input } = createPromptNowInput({
		clearStreamingArtifactState: () => {
			calls.push(["clear-streaming"]);
			streamingArtifactRef.current = null;
		},
		flushQueuedStreamingArtifactDeltaNow: () => {
			calls.push(["flush-streaming"]);
			streamingArtifactRef.current = {
				...streamingArtifactRef.current,
				content: "fresh checkpoint",
			};
		},
		streamingArtifact,
		streamingArtifactRef,
		useChatStatus: "streaming",
	});

	await dispatchRovoAppPromptNow(input);

	const sendCall = calls.find((call) => call[0] === "send");
	assert.ok(sendCall);
	assert.deepEqual(
		calls
			.filter((call) =>
				["flush-streaming", "clear-streaming", "stop-use-chat", "abort-delegation", "clear-delegation"].includes(call[0]),
			)
			.map((call) => call[0]),
		[
			"flush-streaming",
			"clear-streaming",
			"stop-use-chat",
			"abort-delegation",
			"clear-delegation",
		],
	);
	assert.deepEqual(sendCall[2].body.streamingArtifact, {
		id: "doc-1",
		title: "Draft",
		kind: "markdown",
		content: "fresh checkpoint",
	});
});

test("dispatchRovoAppPromptNow rolls back optimistic state on pre-stream send failure", async () => {
	const { calls, getMessages, input } = createPromptNowInput({
		sendMessage: async () => {
			throw new Error("send failed");
		},
	});

	await assert.rejects(
		() => dispatchRovoAppPromptNow(input),
		/send failed/u,
	);

	assert.deepEqual(getMessages().map((message) => message.id), ["assistant-baseline"]);
	assert.ok(
		calls.some((call) =>
			call[0] === "local-run" &&
			call[1] === "thread-1" &&
			call[2] === null,
		),
	);
	assert.ok(
		calls.some((call) => call[0] === "attached-run" && call[1] === null),
	);
	assert.ok(
		calls.some((call) => call[0] === "input-error" && call[1] === "User error: send failed"),
	);
});

test("dispatchRovoAppPromptNow suppresses user errors for send-settle timeouts", async () => {
	const timeoutError = new Error("Timed out waiting for previous turn to settle before sending.");
	timeoutError.name = "RovoAppSendSettledTimeoutError";
	const { calls, input } = createPromptNowInput({
		releaseCompletedUseChatTurnIfNeeded: async () => {
			throw timeoutError;
		},
	});

	await assert.rejects(
		() => dispatchRovoAppPromptNow(input),
		/RovoAppSendSettledTimeoutError/u,
	);

	assert.deepEqual(
		calls.filter((call) => call[0] === "input-error"),
		[["input-error", null]],
	);
});

test("submitRovoAppDelegationDispatch queues resolved delegation prompts with route options", async () => {
	const queued = [];
	const result = await submitRovoAppDelegationDispatch({
		activeThreadId: null,
		dispatchDelegationNow: async () => {
			throw new Error("delegation should queue");
		},
		draftThreadId: "draft",
		enqueueDelegationAction: (messageId, options) => {
			queued.push({ messageId, options });
		},
		getHasBusyTurn: () => true,
		kickQueue: () => {},
		messageId: "message-1",
		messages: [createTextMessage("message-1", " Delegate this message ")],
		options: {
			contextDescription: "Use context",
			urgency: "high",
		},
		queuedActionsByThreadId: {},
		queueProcessorRunningRef: { current: false },
		realtimeMessagesRef: { current: [] },
		setInputError: () => {},
	});

	assert.equal(result, "queued");
	assert.deepEqual(queued, [
		{
			messageId: "message-1",
			options: {
				contextDescription: "Use context",
				urgency: "high",
				prompt: "Delegate this message",
				threadId: "draft",
			},
		},
	]);
});

test("submitRovoAppDelegationDispatch prefers explicit prompt for immediate dispatch", async () => {
	const events = [];
	const result = await submitRovoAppDelegationDispatch({
		activeThreadId: "thread-1",
		dispatchDelegationNow: async (messageId, options) => {
			events.push(["dispatch", messageId, options.prompt]);
		},
		draftThreadId: "draft",
		enqueueDelegationAction: () => {
			throw new Error("delegation should dispatch immediately");
		},
		getHasBusyTurn: () => true,
		immediateDispatch: {
			begin: () => {
				events.push(["begin"]);
			},
			complete: () => {
				events.push(["complete"]);
			},
			interruptActiveTurn: async () => {
				events.push(["interrupt"]);
			},
		},
		kickQueue: () => {
			events.push(["kick"]);
		},
		messageId: "message-1",
		messages: [createTextMessage("message-1", "Use message text")],
		options: {
			prompt: "  Use explicit prompt  ",
		},
		queuedActionsByThreadId: {},
		queueProcessorRunningRef: { current: false },
		realtimeMessagesRef: { current: [] },
		sendMode: "immediate",
		setInputError: () => {},
	});

	assert.equal(result, "dispatched");
	assert.deepEqual(events, [
		["begin"],
		["interrupt"],
		["dispatch", "message-1", "Use explicit prompt"],
		["complete"],
		["kick"],
	]);
});

test("dispatchQueuedRovoAppActionImmediately removes, interrupts, dispatches, and restarts the queue", async () => {
	const queuedAction = createQueuedAction("queued-1");
	const events = [];
	const queueProcessorRunningRef = { current: true };
	const result = await dispatchQueuedRovoAppActionImmediately({
		activeThreadId: "thread-1",
		dispatchQueuedActionNow: async (action) => {
			events.push(["dispatch", action.id]);
		},
		draftThreadId: "draft",
		getHasBusyTurn: () => false,
		id: "queued-1",
		immediateDispatch: {
			begin: () => {
				queueProcessorRunningRef.current = false;
				events.push(["begin"]);
			},
			complete: () => {
				events.push(["complete"]);
			},
			interruptActiveTurn: async () => {
				events.push(["interrupt"]);
			},
		},
		kickQueue: () => {
			events.push(["kick"]);
		},
		prependQueuedAction: () => {
			throw new Error("successful dispatch should not restore the action");
		},
		queuedActionsByThreadId: {
			"thread-1": [queuedAction],
		},
		queueProcessorRunningRef,
		removeQueuedAction: (threadId, actionId) => {
			events.push(["remove", threadId, actionId]);
		},
		setInputError: () => {},
		toUserErrorMessage: (error) => String(error),
	});

	assert.equal(result, "dispatched");
	assert.deepEqual(events, [
		["begin"],
		["remove", "thread-1", "queued-1"],
		["interrupt"],
		["dispatch", "queued-1"],
		["complete"],
		["kick"],
	]);
	assert.equal(queueProcessorRunningRef.current, false);
});

test("dispatchQueuedRovoAppActionImmediately restores failed queued actions without kicking the queue", async () => {
	const queuedAction = createQueuedAction("queued-1");
	const restored = [];
	const errors = [];
	const events = [];
	const result = await dispatchQueuedRovoAppActionImmediately({
		activeThreadId: "thread-1",
		dispatchQueuedActionNow: async () => {
			events.push(["dispatch"]);
			throw new Error("dispatch failed");
		},
		draftThreadId: "draft",
		getHasBusyTurn: () => false,
		id: "queued-1",
		immediateDispatch: {
			begin: () => {
				events.push(["begin"]);
			},
			complete: () => {
				events.push(["complete"]);
			},
			interruptActiveTurn: async () => {
				events.push(["interrupt"]);
			},
		},
		kickQueue: () => {
			throw new Error("failed dispatch should not restart the queue");
		},
		prependQueuedAction: (action) => {
			restored.push(action);
		},
		queuedActionsByThreadId: {
			"thread-1": [queuedAction],
		},
		queueProcessorRunningRef: { current: false },
		removeQueuedAction: (threadId, actionId) => {
			events.push(["remove", threadId, actionId]);
		},
		setInputError: (message) => {
			errors.push(message);
		},
		toUserErrorMessage: (error) => error.message,
	});

	assert.equal(result, "queued");
	assert.deepEqual(events, [
		["begin"],
		["remove", "thread-1", "queued-1"],
		["dispatch"],
		["complete"],
	]);
	assert.deepEqual(restored, [queuedAction]);
	assert.deepEqual(errors, [null, "dispatch failed"]);
});
