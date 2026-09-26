const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	appendRovoAppRealtimeMessage,
	createRovoAppRealtimeAppendMessage,
	mergeRovoAppMessages,
	mutateRovoAppRealtimeMessageContent,
	normalizeDelegatedRealtimeMessage,
	updateRealtimeTextMessage,
} = loadRovoCoreModule("lib/rovo-app-realtime-message-state.ts");

function createAssistantMessage(parts) {
	return {
		id: "assistant-message",
		role: "assistant",
		metadata: {
			createdAt: "2026-03-13T00:00:00.000Z",
			updatedAt: "2026-03-13T00:00:00.000Z",
			origin: "realtime",
		},
		parts,
	};
}

function createThread(id, overrides = {}) {
	return {
		id,
		title: id,
		messages: [],
		realtimeMessages: [],
		visibility: "private",
		modelId: null,
		provider: null,
		activeDocumentId: null,
		sessionId: null,
		sessionMode: null,
		createdAt: "2026-03-13T00:00:00.000Z",
		updatedAt: "2026-03-13T00:00:00.000Z",
		...overrides,
	};
}

test("appendRovoAppRealtimeMessage updates local realtime state, thread state, and persistence", async () => {
	let realtimeMessages = [];
	let threads = [createThread("thread-1")];
	const persisted = [];
	let nowIndex = 0;
	const timestamps = [
		"2026-03-13T00:00:01.000Z",
		"2026-03-13T00:00:02.000Z",
	];

	const messageId = await appendRovoAppRealtimeMessage({
		content: "",
		createMessageId: () => "realtime-1",
		ensureThread: async (fallbackText) => {
			assert.equal(fallbackText, "assistant message");
			return "thread-1";
		},
		getNow: () => timestamps[nowIndex++] ?? timestamps.at(-1),
		mutateRealtimeMessagesState: (updater) => {
			realtimeMessages = updater(realtimeMessages);
			return realtimeMessages;
		},
		options: {
			parts: [{ type: "data-turn-complete", data: {} }],
			state: "streaming",
		},
		persistRealtimeMessage: async (entry) => {
			persisted.push(entry);
		},
		role: "assistant",
		setThreads: (updater) => {
			threads = updater(threads);
		},
	});

	assert.equal(messageId, "realtime-1");
	assert.equal(realtimeMessages.length, 1);
	assert.equal(realtimeMessages[0].metadata.createdAt, "2026-03-13T00:00:01.000Z");
	assert.equal(realtimeMessages[0].metadata.realtimeMessageId, "realtime-1");
	assert.deepEqual(realtimeMessages[0].parts, [{ type: "data-turn-complete", data: {} }]);
	assert.equal(threads[0].updatedAt, "2026-03-13T00:00:02.000Z");
	assert.deepEqual(threads[0].realtimeMessages, realtimeMessages);
	assert.equal(persisted.length, 1);
	assert.equal(persisted[0].threadId, "thread-1");
	assert.equal(persisted[0].message.id, "realtime-1");
});

test("mutateRovoAppRealtimeMessageContent updates and persists active-thread messages", () => {
	let realtimeMessages = [
		createAssistantMessage([
			{ type: "text", text: "Hello", state: "streaming" },
			{ type: "data-turn-complete", data: {} },
		]),
	];
	const persisted = [];

	mutateRovoAppRealtimeMessageContent({
		activeThreadId: "thread-1",
		content: " world",
		getNow: () => "2026-03-13T00:00:05.000Z",
		messageId: "assistant-message",
		mutateRealtimeMessagesState: (updater) => {
			realtimeMessages = updater(realtimeMessages);
			return realtimeMessages;
		},
		options: { append: true, state: "done" },
		persistRealtimeMessage: async (entry) => {
			persisted.push(entry);
		},
	});

	assert.equal(realtimeMessages[0].parts[0].text, "Hello world");
	assert.equal(realtimeMessages[0].parts[0].state, "done");
	assert.equal(realtimeMessages[0].metadata.updatedAt, "2026-03-13T00:00:05.000Z");
	assert.equal(persisted.length, 1);
	assert.equal(persisted[0].threadId, "thread-1");
	assert.deepEqual(persisted[0].message, realtimeMessages[0]);
});

test("mutateRovoAppRealtimeMessageContent skips empty append deltas", () => {
	let didMutate = false;
	mutateRovoAppRealtimeMessageContent({
		activeThreadId: "thread-1",
		content: "",
		messageId: "assistant-message",
		mutateRealtimeMessagesState: () => {
			didMutate = true;
			return [];
		},
		options: { append: true, state: "streaming" },
		persistRealtimeMessage: async () => {},
	});

	assert.equal(didMutate, false);
});

test("updateRealtimeTextMessage preserves artifact data parts when replacing text", () => {
	const messages = [
		createAssistantMessage([
			{ type: "text", text: "Interim voice reply", state: "streaming" },
			{
				type: "data-artifact-result",
				data: {
					action: "create",
					documentId: "doc-1",
					kind: "text",
					title: "Apple Overview",
				},
			},
		]),
	];

	const updatedMessages = updateRealtimeTextMessage(
		messages,
		"assistant-message",
		"Final delegated reply",
		{ append: false, state: "done" },
	);

	assert.deepEqual(updatedMessages[0].parts, [
		{ type: "text", text: "Final delegated reply", state: "done" },
		{
			type: "data-artifact-result",
			data: {
				action: "create",
				documentId: "doc-1",
				kind: "text",
				title: "Apple Overview",
			},
		},
	]);
});

test("createRovoAppRealtimeAppendMessage creates text messages with normalized realtime metadata", () => {
	const message = createRovoAppRealtimeAppendMessage({
		content: "Realtime response",
		createdAt: "2026-03-13T00:00:00.000Z",
		messageId: "realtime-1",
		metadata: {
			source: "voice",
		},
		role: "assistant",
		state: "streaming",
	});

	assert.deepEqual(message, {
		id: "realtime-1",
		role: "assistant",
		metadata: {
			createdAt: "2026-03-13T00:00:00.000Z",
			updatedAt: "2026-03-13T00:00:00.000Z",
			origin: "realtime",
			realtimeMessageId: "realtime-1",
			source: "voice",
		},
		parts: [
			{
				type: "text",
				text: "Realtime response",
				state: "streaming",
			},
		],
	});
});

test("createRovoAppRealtimeAppendMessage preserves custom parts", () => {
	const message = createRovoAppRealtimeAppendMessage({
		content: "",
		createdAt: "2026-03-13T00:00:00.000Z",
		messageId: "realtime-parts",
		metadata: {
			updatedAt: "2026-03-13T00:00:05.000Z",
		},
		parts: [
			{
				type: "data-artifact-result",
				data: {
					action: "create",
					documentId: "doc-1",
					kind: "text",
					title: "Artifact",
				},
			},
		],
		role: "assistant",
	});

	assert.deepEqual(message, {
		id: "realtime-parts",
		role: "assistant",
		metadata: {
			createdAt: "2026-03-13T00:00:00.000Z",
			updatedAt: "2026-03-13T00:00:05.000Z",
			origin: "realtime",
			realtimeMessageId: "realtime-parts",
		},
		parts: [
			{
				type: "data-artifact-result",
				data: {
					action: "create",
					documentId: "doc-1",
					kind: "text",
					title: "Artifact",
				},
			},
		],
	});
});

test("createRovoAppRealtimeAppendMessage preserves explicit metadata origin overrides", () => {
	const message = createRovoAppRealtimeAppendMessage({
		content: "Delegated error",
		createdAt: "2026-03-13T00:00:00.000Z",
		messageId: "realtime-error",
		metadata: {
			delegatedFromId: "source-message",
			origin: "rovo",
		},
		role: "assistant",
	});

	assert.equal(message.metadata.origin, "rovo");
	assert.equal(message.metadata.realtimeMessageId, "realtime-error");
	assert.equal(message.metadata.delegatedFromId, "source-message");
});

test("normalizeDelegatedRealtimeMessage reuses an existing interim bubble identity", () => {
	const normalizedMessage = normalizeDelegatedRealtimeMessage({
		delegatedFromId: "user-message",
		effectiveId: "existing-realtime-message",
		existingMessage: {
			id: "existing-realtime-message",
			role: "assistant",
			metadata: {
				createdAt: "2026-03-13T00:00:00.000Z",
				origin: "realtime",
				realtimeMessageId: "existing-realtime-message",
				updatedAt: "2026-03-13T00:00:00.000Z",
			},
			parts: [{ type: "text", text: "Interim", state: "streaming" }],
		},
		now: "2026-03-13T00:00:05.000Z",
		streamedMessage: {
			id: "streamed-message",
			role: "assistant",
			metadata: {
				createdAt: "2026-03-13T00:00:03.000Z",
				origin: "rovo",
				updatedAt: "2026-03-13T00:00:03.000Z",
			},
			parts: [{ type: "text", text: "Delegated", state: "done" }],
		},
	});

	assert.equal(normalizedMessage.id, "existing-realtime-message");
	assert.equal(normalizedMessage.metadata.createdAt, "2026-03-13T00:00:00.000Z");
	assert.equal(normalizedMessage.metadata.delegatedFromId, "user-message");
	assert.equal(normalizedMessage.metadata.origin, "rovo");
	assert.equal(normalizedMessage.metadata.realtimeMessageId, "existing-realtime-message");
	assert.equal(normalizedMessage.metadata.updatedAt, "2026-03-13T00:00:05.000Z");
});

test("normalizeDelegatedRealtimeMessage falls back to streamed metadata", () => {
	const normalizedMessage = normalizeDelegatedRealtimeMessage({
		delegatedFromId: "user-message",
		effectiveId: "streamed-message",
		now: "2026-03-13T00:00:05.000Z",
		streamedMessage: {
			id: "streamed-message",
			role: "assistant",
			metadata: {
				createdAt: "2026-03-13T00:00:03.000Z",
				origin: "rovo",
				realtimeMessageId: "stream-realtime-id",
				updatedAt: "2026-03-13T00:00:03.000Z",
			},
			parts: [{ type: "text", text: "Delegated", state: "done" }],
		},
	});

	assert.equal(normalizedMessage.metadata.createdAt, "2026-03-13T00:00:03.000Z");
	assert.equal(normalizedMessage.metadata.realtimeMessageId, "stream-realtime-id");
	assert.equal(normalizedMessage.metadata.updatedAt, "2026-03-13T00:00:05.000Z");
});

test("updateRealtimeTextMessage preserves non-text parts when appending text", () => {
	const messages = [
		createAssistantMessage([
			{ type: "text", text: "Hello", state: "streaming" },
			{
				type: "data-suggested-questions",
				data: {
					questions: ["One?", "Two?"],
				},
			},
		]),
	];

	const updatedMessages = updateRealtimeTextMessage(
		messages,
		"assistant-message",
		" world",
		{ append: true, state: "done" },
	);

	assert.deepEqual(updatedMessages[0].parts, [
		{ type: "text", text: "Hello world", state: "done" },
		{
			type: "data-suggested-questions",
			data: {
				questions: ["One?", "Two?"],
			},
		},
	]);
});

test("mergeRovoAppMessages dedupes colliding ids and prefers canonical Rovo messages", () => {
	const createdAt = "2026-03-13T00:00:00.000Z";
	const mergedMessages = mergeRovoAppMessages({
		rovoMessages: [
			{
				id: "shared-message",
				role: "assistant",
				metadata: {
					createdAt,
					origin: "rovo",
					updatedAt: "2026-03-13T00:00:02.000Z",
				},
				parts: [{ type: "text", text: "Canonical response", state: "done" }],
			},
		],
		realtimeMessages: [
			{
				id: "shared-message",
				role: "assistant",
				metadata: {
					createdAt,
					origin: "realtime",
					realtimeMessageId: "realtime-shared-message",
					updatedAt: "2026-03-13T00:00:01.000Z",
				},
				parts: [{ type: "text", text: "Interim response", state: "done" }],
			},
		],
	});

	assert.equal(mergedMessages.length, 1);
	assert.equal(mergedMessages[0]?.id, "shared-message");
	assert.equal(mergedMessages[0]?.metadata?.origin, "rovo");
	assert.equal(mergedMessages[0]?.parts[0]?.text, "Canonical response");
});

test("mergeRovoAppMessages keeps a streaming realtime message until the canonical one is ready", () => {
	const createdAt = "2026-03-13T00:00:00.000Z";
	const mergedMessages = mergeRovoAppMessages({
		rovoMessages: [
			{
				id: "shared-message",
				role: "assistant",
				metadata: {
					createdAt,
					origin: "rovo",
					updatedAt: "2026-03-13T00:00:02.000Z",
				},
				parts: [{ type: "text", text: "Canonical response", state: "done" }],
			},
		],
		realtimeMessages: [
			{
				id: "shared-message",
				role: "assistant",
				metadata: {
					createdAt,
					origin: "realtime",
					realtimeMessageId: "realtime-shared-message",
					updatedAt: "2026-03-13T00:00:03.000Z",
				},
				parts: [{ type: "text", text: "Streaming response", state: "streaming" }],
			},
		],
	});

	assert.equal(mergedMessages.length, 1);
	assert.equal(mergedMessages[0]?.id, "shared-message");
	assert.equal(mergedMessages[0]?.metadata?.origin, "realtime");
	assert.equal(mergedMessages[0]?.parts[0]?.text, "Streaming response");
});

test("mergeRovoAppMessages retains hidden metadata for internal transcript widgets", () => {
	const mergedMessages = mergeRovoAppMessages({
		rovoMessages: [],
		realtimeMessages: [
			{
				id: "internal-thread-1",
				role: "assistant",
				metadata: {
					createdAt: "2026-04-10T00:00:00.000Z",
					updatedAt: "2026-04-10T00:00:00.000Z",
					visibility: "hidden",
				},
				parts: [
					{
						type: "data-route-decision",
						data: {
							intent: "genui",
							presentation: "genui_card",
							confidence: 1,
							reason: "internal_context_widget",
							origin: "text",
						},
					},
					{
						type: "data-widget-data",
						data: {
							type: "context-preview",
							payload: { title: "Context" },
						},
					},
				],
			},
		],
	});

	assert.equal(mergedMessages.length, 1);
	assert.equal(mergedMessages[0]?.metadata?.visibility, "hidden");
});
