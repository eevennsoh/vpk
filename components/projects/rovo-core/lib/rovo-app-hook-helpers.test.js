const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	applyRovoAppVoteToMap,
	buildActiveArtifactMetadata,
	buildArtifactContentFromMessage,
	buildRovoAppClarificationAnswerPayload,
	buildRovoAppClarificationDismissPayload,
	buildRovoAppDeferredClarificationDismissPayload,
	buildRovoAppPlanRetryPayload,
	buildRovoAppChatRequestBody,
	buildRovoAppPromptModeMetadata,
	buildRovoAppPromptSendBody,
	buildRovoAppQueuedDelegationAction,
	buildRovoAppQueuedPromptAction,
	buildRovoAppStreamingArtifactSendPayload,
	buildRecentHistory,
	buildVotesMap,
	createRovoAppPlanningSession,
	deriveThreadTitle,
	getRovoAppArtifactDocumentIdsFromMessages,
	inferArtifactKind,
	markRovoAppPlanningSessionRetrying,
	markRovoAppPlanningSessionStreamStarted,
	meetsStreamingAutoOpenContentThreshold,
	resolveRovoAppClarificationContextDescription,
	resolveRovoAppClarificationPlanMode,
	resolveRovoAppDelegationDispatch,
	resolveRovoAppDispatchQueueDecision,
	resolveRovoAppPromptDispatch,
	resolveRovoAppQueuedActionDispatch,
	restartRovoAppPlanningSession,
	resolveActiveArtifactContext,
	upsertDocumentRecord,
} = loadRovoCoreModule("lib/rovo-app-hook-helpers.ts");

function createTextMessage(id, role, text) {
	return {
		id,
		role,
		parts: [{ type: "text", text }],
	};
}

function createWidgetMessage(id, payload) {
	return {
		id,
		role: "assistant",
		parts: [
			{
				type: "data-widget-data",
				data: payload,
			},
		],
	};
}

function createDocument(id, updatedAt, overrides = {}) {
	return {
		id,
		threadId: "thread-1",
		title: id,
		kind: "text",
		sourceMessageId: null,
		createdAt: updatedAt,
		updatedAt,
		versions: [],
		...overrides,
	};
}

function createQuestionCard(overrides = {}) {
	return {
		type: "question-card",
		sessionId: "clarification-session-1",
		round: 1,
		maxRounds: 2,
		title: "Answer these questions to continue",
		requiredCount: 1,
		toolCallId: "tool-call-1",
		deferredToolCallId: "tool-call-1",
		questions: [
			{
				id: "q-1",
				label: "What should we do?",
				required: true,
				kind: "single-select",
				options: [{ id: "approve", label: "Ship it" }],
			},
		],
		...overrides,
	};
}

test("deriveThreadTitle trims blank lines and caps long titles", () => {
	assert.equal(deriveThreadTitle("\n\n  Build a dashboard  "), "Build a dashboard");
	assert.equal(deriveThreadTitle("x".repeat(100)), "x".repeat(80));
	assert.equal(deriveThreadTitle(" \n "), "New chat");
});

test("planning session helpers centralize plan retry state transitions", () => {
	const initial = createRovoAppPlanningSession({
		requestId: 7,
		baselineAssistantMessageId: "assistant-1",
	});

	assert.deepEqual(initial, {
		requestId: 7,
		phase: "awaiting-plan",
		hasStreamStarted: false,
		retryUsed: false,
		baselineAssistantMessageId: "assistant-1",
	});

	const started = markRovoAppPlanningSessionStreamStarted(initial);
	assert.deepEqual(started, {
		...initial,
		hasStreamStarted: true,
	});
	assert.equal(markRovoAppPlanningSessionStreamStarted(started), started);

	const retrying = markRovoAppPlanningSessionRetrying(started, "assistant-2");
	assert.deepEqual(retrying, {
		...initial,
		phase: "retrying-missing-plan",
		hasStreamStarted: false,
		retryUsed: true,
		baselineAssistantMessageId: "assistant-2",
	});

	assert.deepEqual(restartRovoAppPlanningSession(retrying, {
		requestId: 99,
		baselineAssistantMessageId: "assistant-3",
	}), {
		...retrying,
		phase: "awaiting-plan",
		hasStreamStarted: false,
		baselineAssistantMessageId: "assistant-3",
	});
	assert.deepEqual(restartRovoAppPlanningSession(null, {
		requestId: 8,
		baselineAssistantMessageId: null,
	}), createRovoAppPlanningSession({
		requestId: 8,
		baselineAssistantMessageId: null,
	}));
	assert.equal(markRovoAppPlanningSessionRetrying(null, "assistant-4"), null);
	assert.equal(markRovoAppPlanningSessionStreamStarted(null), null);
});

test("plan retry payload helper preserves hidden retry metadata and session body", () => {
	assert.deepEqual(buildRovoAppPlanRetryPayload({
		sessionId: "session-1",
		sessionMode: "ephemeral",
		threadId: "thread-1",
	}), {
		body: {
			contextDescription: [
				"[POST-CLARIFICATION — Plan Mode]",
				"Plan mode is enabled. The user has already answered clarification questions for this planning request.",
				"If the answers provide enough detail, proceed directly to plan generation now by calling exit_plan_mode with a concise markdown plan.",
				"If essential details are still missing, you may call ask_user_questions again to gather what you need before planning.",
				"Use the answered clarification details to finish planning, not implementation.",
				"Do not use free-form text, suggestion chips, invoke_subagents, or update_todo as a substitute for the exit_plan_mode handoff.",
				"[End POST-CLARIFICATION]",
			].join(" "),
			id: "thread-1",
			isPlanMode: true,
			sessionId: "session-1",
			sessionMode: "ephemeral",
		},
		metadata: {
			source: "plan-retry",
			visibility: "hidden",
		},
		text: [
			"The previous response did not include a plan widget with tasks.",
			"If you still need essential details, you may ask clarification questions. Otherwise, generate the plan.",
			"Generate the plan now by calling exit_plan_mode with a concise markdown plan.",
			"Do not explore the codebase. Do not use workspace tools.",
			"Your only action: call exit_plan_mode with the plan.",
		].join(" "),
	});
	assert.equal(buildRovoAppPlanRetryPayload({
		sessionId: "session-1",
		threadId: "thread-1",
	}).body.sessionMode, "persistent");
});

test("upsertDocumentRecord replaces existing documents and sorts newest first", () => {
	const older = createDocument("older", "2026-07-01T00:00:00.000Z");
	const existing = createDocument("same", "2026-07-02T00:00:00.000Z");
	const next = createDocument("same", "2026-07-03T00:00:00.000Z", { title: "Updated" });

	assert.deepEqual(
		upsertDocumentRecord([older, existing], next).map((document) => `${document.id}:${document.title}`),
		["same:Updated", "older:older"],
	);
});

test("artifact helpers infer content, kind, active metadata, and document ids", () => {
	const widgetMessage = createWidgetMessage("assistant-1", {
		type: "table",
		payload: { rows: [{ id: 1 }] },
	});
	const artifactMessage = {
		id: "assistant-2",
		role: "assistant",
		parts: [
			{
				type: "data-artifact-result",
				data: {
					documentId: "doc-1",
				},
			},
		],
	};

	assert.equal(buildArtifactContentFromMessage(widgetMessage), JSON.stringify({ rows: [{ id: 1 }] }, null, 2));
	assert.equal(inferArtifactKind(widgetMessage, ""), "sheet");
	assert.deepEqual(getRovoAppArtifactDocumentIdsFromMessages([artifactMessage, artifactMessage]), ["doc-1"]);
	assert.deepEqual(buildActiveArtifactMetadata(createDocument("doc-1", "2026-07-03T00:00:00.000Z")), {
		id: "doc-1",
		kind: "text",
		title: "doc-1",
	});
});

test("context and history helpers preserve route-hook payload shape", () => {
	const activeDocument = createDocument("doc-1", "2026-07-03T00:00:00.000Z", {
		kind: "code",
		title: "App",
	});
	const streamingArtifact = {
		content: "streamed content",
		documentId: "doc-stream",
		kind: "text",
		messageId: "message-1",
		state: "streaming",
		threadId: "thread-1",
		title: "Stream",
		versionId: "version-1",
	};

	assert.deepEqual(resolveActiveArtifactContext(activeDocument, "draft", "persisted", null), {
		content: "draft",
		id: "doc-1",
		kind: "code",
		title: "App",
	});
	assert.deepEqual(resolveActiveArtifactContext(null, "", "", streamingArtifact), {
		content: "streamed content",
		id: "doc-stream",
		kind: "text",
		title: "Stream",
	});
	assert.deepEqual(buildRecentHistory([
		createTextMessage("system-1", "system", "ignore"),
		createTextMessage("user-1", "user", "Hello"),
		createTextMessage("assistant-1", "assistant", "Hi"),
	]), [
		{ role: "user", content: "Hello" },
		{ role: "assistant", content: "Hi" },
	]);
});

test("votes and streaming auto-open thresholds match route hook policy", () => {
	assert.deepEqual(buildVotesMap([
		{ messageId: "a", value: "up" },
		{ messageId: "b", value: "none" },
		{ messageId: "c", value: "down" },
	]), {
		a: "up",
		c: "down",
	});
	const initialVotes = { a: "up", c: "down" };
	assert.deepEqual(applyRovoAppVoteToMap(initialVotes, { messageId: "b", value: "up" }), {
		a: "up",
		b: "up",
		c: "down",
	});
	assert.deepEqual(applyRovoAppVoteToMap(initialVotes, { messageId: "a", value: "down" }), {
		a: "down",
		c: "down",
	});
	assert.deepEqual(applyRovoAppVoteToMap(initialVotes, { messageId: "a", value: null }), {
		c: "down",
	});
	assert.deepEqual(initialVotes, { a: "up", c: "down" });

	assert.equal(meetsStreamingAutoOpenContentThreshold(null), false);
	assert.equal(meetsStreamingAutoOpenContentThreshold({ documentId: "doc", kind: "sheet", content: "x" }), true);
	assert.equal(meetsStreamingAutoOpenContentThreshold({ documentId: "doc", kind: "code", content: "x".repeat(299) }), false);
	assert.equal(meetsStreamingAutoOpenContentThreshold({ documentId: "doc", kind: "code", content: "x".repeat(300) }), true);
	assert.equal(meetsStreamingAutoOpenContentThreshold({ documentId: "doc", kind: "text", content: "x".repeat(399) }), false);
	assert.equal(meetsStreamingAutoOpenContentThreshold({ documentId: "doc", kind: "text", content: "x".repeat(400) }), true);
});

test("prompt metadata helper preserves base metadata and Studio creation mode", () => {
	assert.deepEqual(buildRovoAppPromptModeMetadata({ displayLabel: "Draft" }, "plan"), {
		displayLabel: "Draft",
		submittedMode: "plan",
	});
	assert.deepEqual(buildRovoAppPromptModeMetadata(undefined, "default", "agent"), {
		creationMode: "agent",
		submittedMode: "default",
	});
});

test("clarification mode helpers preserve Rovo plan and Studio creation behavior", () => {
	assert.equal(resolveRovoAppClarificationPlanMode({
		isPlanModeActive: true,
	}), true);
	assert.equal(resolveRovoAppClarificationPlanMode({
		creationMode: "agent",
		isPlanModeActive: true,
	}), false);
	assert.equal(resolveRovoAppClarificationPlanMode({
		hasDeferredToolCall: true,
		includeDeferredToolPlanMode: true,
		isPlanModeActive: false,
	}), true);
	assert.equal(resolveRovoAppClarificationPlanMode({
		hasDeferredToolCall: true,
		includeDeferredToolPlanMode: false,
		isPlanModeActive: false,
	}), false);

	assert.equal(resolveRovoAppClarificationContextDescription({
		contextDescription: "  Custom context  ",
		wasPlanModeActive: true,
	}), "Custom context");
	assert.equal(resolveRovoAppClarificationContextDescription({
		creationMode: "agent",
		wasPlanModeActive: false,
	}).includes("Studio agent creation request"), true);
	assert.equal(resolveRovoAppClarificationContextDescription({
		wasPlanModeActive: true,
	}).includes("POST-CLARIFICATION"), true);
	assert.equal(resolveRovoAppClarificationContextDescription({
		wasPlanModeActive: false,
	}), undefined);
});

test("dispatch queue decision helper centralizes queue versus immediate policy", () => {
	assert.deepEqual(resolveRovoAppDispatchQueueDecision({
		hasBusyTurn: false,
		isQueueProcessorRunning: false,
		queuedActionCount: 0,
	}), {
		hasBusyTurn: false,
		hasQueuedActions: false,
		shouldDefer: false,
		shouldDispatchImmediately: false,
		shouldQueue: false,
		wasQueueProcessorRunning: false,
	});
	assert.deepEqual(resolveRovoAppDispatchQueueDecision({
		hasBusyTurn: true,
		isQueueProcessorRunning: false,
		queuedActionCount: 0,
	}), {
		hasBusyTurn: true,
		hasQueuedActions: false,
		shouldDefer: true,
		shouldDispatchImmediately: false,
		shouldQueue: true,
		wasQueueProcessorRunning: false,
	});
	assert.deepEqual(resolveRovoAppDispatchQueueDecision({
		hasBusyTurn: false,
		isQueueProcessorRunning: true,
		queuedActionCount: 1,
		sendMode: "immediate",
	}), {
		hasBusyTurn: false,
		hasQueuedActions: true,
		shouldDefer: true,
		shouldDispatchImmediately: true,
		shouldQueue: false,
		wasQueueProcessorRunning: true,
	});
});

test("prompt dispatch resolver centralizes prompt mode and queue policy", () => {
	assert.equal(resolveRovoAppPromptDispatch({
		activeThreadId: null,
		draftThreadId: "draft",
		files: [],
		hasBusyTurn: false,
		isPlanModeActive: false,
		isQueueProcessorRunning: false,
		queuedActionsByThreadId: {},
		text: "   ",
	}), null);

	assert.deepEqual(resolveRovoAppPromptDispatch({
		activeThreadId: null,
		draftThreadId: "draft",
		files: [],
		hasBusyTurn: true,
		isPlanModeActive: true,
		isQueueProcessorRunning: false,
		queuedActionsByThreadId: {},
		text: "  Build a plan  ",
	}), {
		dispatchDecision: {
			hasBusyTurn: true,
			hasQueuedActions: false,
			shouldDefer: true,
			shouldDispatchImmediately: false,
			shouldQueue: true,
			wasQueueProcessorRunning: false,
		},
		messageMetadata: {
			submittedMode: "plan",
		},
		mode: "plan",
		resolvedThreadId: "draft",
		text: "Build a plan",
	});

	assert.deepEqual(resolveRovoAppPromptDispatch({
		activeThreadId: "thread-1",
		creationMode: "agent",
		draftThreadId: "draft",
		files: [{ type: "file", mediaType: "text/plain", filename: "notes.txt", url: "file-url" }],
		hasBusyTurn: false,
		isPlanModeActive: false,
		isQueueProcessorRunning: true,
		queuedActionsByThreadId: {
			"thread-1": [{ id: "queued-1" }, { id: "queued-2" }],
		},
		sendMode: "immediate",
		text: "",
	}), {
		dispatchDecision: {
			hasBusyTurn: false,
			hasQueuedActions: true,
			shouldDefer: true,
			shouldDispatchImmediately: true,
			shouldQueue: false,
			wasQueueProcessorRunning: true,
		},
		messageMetadata: {
			creationMode: "agent",
			submittedMode: "default",
		},
		mode: "default",
		resolvedThreadId: "thread-1",
		text: "",
	});
});

test("delegation dispatch resolver centralizes prompt selection and queue policy", () => {
	assert.equal(resolveRovoAppDelegationDispatch({
		activeThreadId: null,
		delegatedMessageText: "   ",
		draftThreadId: "draft",
		hasBusyTurn: false,
		isQueueProcessorRunning: false,
		messageId: "message-1",
		queuedActionsByThreadId: {},
	}), null);
	assert.equal(resolveRovoAppDelegationDispatch({
		activeThreadId: null,
		delegatedMessageText: "Delegate this",
		draftThreadId: "draft",
		hasBusyTurn: false,
		isQueueProcessorRunning: false,
		messageId: "",
		queuedActionsByThreadId: {},
	}), null);

	assert.deepEqual(resolveRovoAppDelegationDispatch({
		activeThreadId: null,
		delegatedMessageText: "  Delegate this turn  ",
		draftThreadId: "draft",
		hasBusyTurn: true,
		isQueueProcessorRunning: false,
		messageId: "message-1",
		queuedActionsByThreadId: {},
	}), {
		dispatchDecision: {
			hasBusyTurn: true,
			hasQueuedActions: false,
			shouldDefer: true,
			shouldDispatchImmediately: false,
			shouldQueue: true,
			wasQueueProcessorRunning: false,
		},
		messageId: "message-1",
		resolvedThreadId: "draft",
		text: "Delegate this turn",
	});

	assert.deepEqual(resolveRovoAppDelegationDispatch({
		activeThreadId: "thread-1",
		delegatedMessageText: "Use message text",
		draftThreadId: "draft",
		hasBusyTurn: false,
		isQueueProcessorRunning: true,
		messageId: "message-2",
		optionPrompt: "  Use explicit prompt  ",
		queuedActionsByThreadId: {
			"thread-1": [{ id: "queued-1" }],
		},
		sendMode: "immediate",
	}), {
		dispatchDecision: {
			hasBusyTurn: false,
			hasQueuedActions: true,
			shouldDefer: true,
			shouldDispatchImmediately: true,
			shouldQueue: false,
			wasQueueProcessorRunning: true,
		},
		messageId: "message-2",
		resolvedThreadId: "thread-1",
		text: "Use explicit prompt",
	});
});

test("queued prompt and prompt send builders preserve route-specific options", () => {
	const files = [{ type: "file", mediaType: "text/plain", filename: "notes.txt", url: "file-url" }];
	const queuedAction = buildRovoAppQueuedPromptAction({
		contextDescription: "Use context",
		creationMode: "agent",
		files,
		messageMetadata: { submittedMode: "default" },
		mode: "default",
		text: "Build an agent",
		threadId: "thread-1",
	});

	assert.equal(queuedAction.kind, "prompt");
	assert.equal(queuedAction.threadId, "thread-1");
	assert.equal(queuedAction.creationMode, "agent");
	assert.deepEqual(queuedAction.files, [{ type: "file", mediaType: "text/plain", filename: "notes.txt", url: "file-url" }]);
	assert.notEqual(queuedAction.files, files);
	assert.equal(typeof queuedAction.id, "string");
	assert.equal(typeof queuedAction.createdAt, "number");

	const streamingArtifact = buildRovoAppStreamingArtifactSendPayload({
		currentArtifact: {
			content: "old content",
			documentId: "doc-old",
			kind: "text",
			messageId: "message-1",
			state: "streaming",
			threadId: "thread-1",
			title: "Old",
			versionId: "version-1",
		},
		freshSnapshot: {
			content: "fresh content",
			documentId: "doc-fresh",
			kind: "code",
			messageId: "message-1",
			state: "streaming",
			threadId: "thread-1",
			title: "Fresh",
			versionId: "version-1",
		},
	});

	assert.deepEqual(streamingArtifact, {
		content: "fresh content",
		id: "doc-fresh",
		kind: "code",
		title: "Fresh",
	});
	assert.deepEqual(buildRovoAppPromptSendBody({
		artifactContext: {
			content: "artifact",
			id: "doc-1",
			kind: "text",
			title: "Artifact",
		},
		contextDescription: "Use context",
		creationMode: "skill",
		isPlanMode: true,
		streamingArtifact,
		threadId: "thread-1",
	}), {
		artifactContext: {
			content: "artifact",
			id: "doc-1",
			kind: "text",
			title: "Artifact",
		},
		contextDescription: "Use context",
		creationMode: "skill",
		id: "thread-1",
		isPlanMode: true,
		streamingArtifact,
	});
});

test("queued delegation builder preserves route-hook payload shape", () => {
	const queuedAction = buildRovoAppQueuedDelegationAction({
		contextDescription: "Use context",
		conversationSummary: "Previous answer",
		delegatedMessageId: "message-1",
		existingRealtimeMessageId: "realtime-1",
		intentType: "handoff",
		prompt: "Delegate this",
		referencedFiles: ["file-a.ts"],
		threadId: "thread-1",
		urgency: "high",
	});

	assert.equal(queuedAction.kind, "delegation");
	assert.equal(queuedAction.threadId, "thread-1");
	assert.equal(queuedAction.text, "Delegate this");
	assert.equal(queuedAction.delegatedMessageId, "message-1");
	assert.equal(queuedAction.existingRealtimeMessageId, "realtime-1");
	assert.equal(queuedAction.intentType, "handoff");
	assert.deepEqual(queuedAction.referencedFiles, ["file-a.ts"]);
	assert.equal(queuedAction.urgency, "high");
	assert.equal(queuedAction.conversationSummary, "Previous answer");
	assert.equal(typeof queuedAction.id, "string");
	assert.equal(typeof queuedAction.createdAt, "number");
});

test("queued action dispatch resolver maps prompt actions into route dispatch payloads", () => {
	const files = [{ type: "file", mediaType: "text/plain", filename: "notes.txt", url: "file-url" }];
	const dispatch = resolveRovoAppQueuedActionDispatch({
		id: "queue-1",
		threadId: "thread-1",
		text: "Continue the plan",
		createdAt: 123,
		kind: "prompt",
		files,
		contextDescription: "Use context",
		creationMode: "skill",
		messageMetadata: { displayLabel: "Plan continuation" },
		mode: "plan",
	});

	assert.deepEqual(dispatch, {
		kind: "prompt",
		payload: {
			text: "Continue the plan",
			files,
			contextDescription: "Use context",
			creationMode: "skill",
			messageMetadata: { displayLabel: "Plan continuation" },
			mode: "plan",
		},
	});
	assert.notEqual(dispatch.payload.files, files);
});

test("queued action dispatch resolver maps delegation actions into route dispatch options", () => {
	const dispatch = resolveRovoAppQueuedActionDispatch({
		id: "queue-1",
		threadId: "thread-1",
		text: "Delegate this",
		createdAt: 123,
		kind: "delegation",
		contextDescription: "Use context",
		conversationSummary: "Previous answer",
		delegatedMessageId: "message-1",
		existingRealtimeMessageId: null,
		intentType: "handoff",
		referencedFiles: ["file-a.ts"],
		urgency: "high",
	});

	assert.deepEqual(dispatch, {
		delegatedMessageId: "message-1",
		kind: "delegation",
		options: {
			contextDescription: "Use context",
			conversationSummary: "Previous answer",
			existingRealtimeMessageId: undefined,
			intentType: "handoff",
			prompt: "Delegate this",
			referencedFiles: ["file-a.ts"],
			urgency: "high",
		},
	});
});

test("clarification payload builders preserve answer, dismiss, and deferred resume shapes", () => {
	const questionCard = createQuestionCard();
	const answered = buildRovoAppClarificationAnswerPayload({
		answers: { "q-1": "approve" },
		contextDescription: "Agent creation context",
		creationMode: "agent",
		questionCard,
		threadId: "thread-1",
		wasPlanModeActive: false,
	});

	assert.equal(answered.text.includes("Here are my clarification answers"), true);
	assert.equal(answered.metadata.creationMode, "agent");
	assert.equal(answered.metadata.clarificationStatus, "answered");
	assert.deepEqual(answered.body, {
		id: "thread-1",
		isPlanMode: undefined,
		contextDescription: "Agent creation context",
		creationMode: "agent",
		clarification: {
			sessionId: "clarification-session-1",
			round: 1,
			answers: { "q-1": "approve" },
			completed: true,
			toolCallId: "tool-call-1",
			deferredToolCallId: "tool-call-1",
			status: "answered",
		},
		deferredToolResponse: {
			tool_call_id: "tool-call-1",
			result: {
				"What should we do?": ["Ship it"],
			},
		},
	});

	const dismissed = buildRovoAppClarificationDismissPayload({
		questionCard,
		threadId: "thread-1",
		wasPlanModeActive: true,
	});

	assert.equal(dismissed.metadata.clarificationStatus, "dismissed");
	assert.deepEqual(dismissed.body, {
		id: "thread-1",
		isPlanMode: true,
		contextDescription: undefined,
	});

	const deferredDismiss = buildRovoAppDeferredClarificationDismissPayload({
		contextDescription: "Plan context",
		questionCard,
		threadId: "thread-1",
		wasPlanModeActive: true,
	});

	assert.deepEqual(deferredDismiss.body, {
		id: "thread-1",
		isPlanMode: true,
		contextDescription: "Plan context",
		clarification: {
			sessionId: "clarification-session-1",
			round: 1,
			answers: {},
			completed: false,
			toolCallId: "tool-call-1",
			deferredToolCallId: "tool-call-1",
			status: "dismissed",
		},
		deferredToolResponse: {
			tool_call_id: "tool-call-1",
			result: deferredDismiss.text,
		},
	});
});

test("chat request body builder keeps plain chat light and rich chat contextual", () => {
	const activeDocument = createDocument("doc-1", "2026-07-03T00:00:00.000Z", {
		title: "Artifact",
	});
	const smartGenerationRequest = {
		enabled: true,
		surface: "rovo",
	};

	const plainBody = buildRovoAppChatRequestBody({
		activeDocument: null,
		activeDocumentContent: "",
		activeDocumentId: null,
		artifactDraftContent: "",
		body: {},
		isPlanModeActive: false,
		isVoiceModeActive: false,
		messages: [createTextMessage("user-1", "user", "hello")],
		pendingArtifactCreationRetry: false,
		runtimeThreadId: "thread-1",
		smartGenerationRequest,
		streamingArtifact: null,
		threadVisibility: "private",
	});

	assert.equal(plainBody.smartGeneration, undefined);
	assert.equal(plainBody.activeDocumentId, null);
	assert.equal(plainBody.origin, "text");
	assert.equal(plainBody.isPlanMode, false);
	assert.equal(
		buildRovoAppChatRequestBody({
			activeDocument: null,
			activeDocumentContent: "",
			activeDocumentId: null,
			artifactDraftContent: "",
			body: { creationMode: "agent" },
			isPlanModeActive: false,
			isVoiceModeActive: false,
			messages: [createTextMessage("user-1", "user", "hello")],
			pendingArtifactCreationRetry: false,
			runtimeThreadId: "thread-1",
			streamingArtifact: null,
			threadVisibility: "private",
		}).creationMode,
		undefined,
	);
	assert.equal(
		buildRovoAppChatRequestBody({
			activeDocument: null,
			activeDocumentContent: "",
			activeDocumentId: null,
			artifactDraftContent: "",
			body: { creationMode: "project" },
			includeCreationMode: true,
			isPlanModeActive: false,
			isVoiceModeActive: false,
			messages: [createTextMessage("user-1", "user", "hello")],
			pendingArtifactCreationRetry: false,
			runtimeThreadId: "thread-1",
			streamingArtifact: null,
			threadVisibility: "private",
		}).creationMode,
		undefined,
	);

	const richBody = buildRovoAppChatRequestBody({
		activeDocument,
		activeDocumentContent: "persisted artifact",
		activeDocumentId: "doc-1",
		artifactDraftContent: "draft artifact",
		body: {
			creationMode: "agent",
			id: "explicit-thread",
			isPlanMode: true,
			origin: "voice",
		},
		chatSdkSource: "studio",
		includeCreationMode: true,
		isPlanModeActive: false,
		isVoiceModeActive: false,
		messages: [createTextMessage("user-1", "user", "Build a dashboard")],
		pendingArtifactCreationRetry: true,
		runtimeThreadId: "thread-1",
		smartGenerationRequest,
		streamingArtifact: null,
		threadVisibility: "public",
	});

	assert.equal(richBody.activeDocumentId, "doc-1");
	assert.deepEqual(richBody.artifactContext, {
		content: "draft artifact",
		id: "doc-1",
		kind: "text",
		title: "Artifact",
	});
	assert.equal(richBody.artifactCreationRetry, true);
	assert.equal(richBody.chatSdkSource, "studio");
	assert.equal(richBody.contextDescription.includes("Plan mode is enabled."), true);
	assert.equal(richBody.creationMode, "agent");
	assert.equal(richBody.id, "explicit-thread");
	assert.equal(richBody.isPlanMode, true);
	assert.equal(richBody.origin, "voice");
	assert.equal(richBody.smartGeneration, smartGenerationRequest);
	assert.equal(richBody.visibility, "public");
});
