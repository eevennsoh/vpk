const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoAppManagedRunRequestPreparer,
} = require("./rovo-app-managed-run-preparation");
const {
	ACTIVE_WORK_ITEM_CONTEXT_END,
	ACTIVE_WORK_ITEM_CONTEXT_START,
	WORK_ITEM_REPORT_REQUEST_START,
} = require("../../lib/work-item-report-intent");

function createHarness(overrides = {}) {
	const calls = [];
	const dependencies = {
		compressUiConversationHistory: (conversationHistory) => {
			calls.push(["compressUiConversationHistory", conversationHistory]);
			return {
				compressed: false,
				conversationHistory,
				length: conversationHistory.length,
				originalLength: conversationHistory.length,
			};
		},
		logger: {
			info: (...args) => calls.push(["info", args]),
			warn: (...args) => calls.push(["warn", args]),
		},
		mapUiMessagesToConversation: (messages) => {
			calls.push(["mapUiMessagesToConversation", messages]);
			const latest = messages.at(-1);
			return {
				message: latest?.content || latest?.parts?.[0]?.text || "create a report for this work item",
				conversationHistory: messages.map((message) => ({
					type: message.role === "assistant" ? "assistant" : "user",
					content: message.content || message.parts?.[0]?.text || "",
				})),
			};
		},
		rovoAppDocumentManager: {
			getDocument: async (documentId) => {
				calls.push(["getDocument", documentId]);
				return {
					id: documentId,
					title: "Persisted artifact",
					kind: "text",
					versions: [{ content: "Persisted content" }],
				};
			},
		},
		rovoAppThreadManager: {
			getThread: async (threadId) => {
				calls.push(["getThread", threadId]);
				return {
					id: threadId,
					sessionId: "session-1",
					sessionMode: "persistent",
					hermesContext: {
						selectedSkillIds: ["pinned-skill"],
					},
					messages: [
						{ id: "delegated-1", role: "user", parts: [{ type: "text", text: "delegated prompt" }] },
					],
				};
			},
			updateThread: async (threadId, patch) => {
				calls.push(["updateThread", threadId, patch]);
			},
		},
		runRovoBackgroundTask: async () => null,
		...overrides,
	};
	const {
		prepareRovoAppManagedRunRequest,
	} = createRovoAppManagedRunRequestPreparer(dependencies);

	return {
		calls,
		prepareRovoAppManagedRunRequest,
	};
}

test("prepareRovoAppManagedRunRequest resolves delegated prompts and cleans request-only fields", async () => {
	const { calls, prepareRovoAppManagedRunRequest } = createHarness();
	const requestBody = {
		id: "thread-1",
		delegatedMessageId: "delegated-1",
		conversationSummary: "Voice summary",
		messages: [{ id: "request-1", role: "user", content: "current prompt" }],
		origin: "voice",
		voiceMetadata: { locale: "en-US" },
		activeDocumentId: "doc-1",
		artifactContext: { id: "draft-1" },
		artifactSteering: { mode: "update" },
		streamingArtifact: {
			id: "stream-1",
			title: "",
			kind: "",
			content: " partial content ",
		},
		hermesContext: { selectedSkillIds: ["request-skill"] },
		isPlanMode: true,
		creationMode: "agent",
		artifactCreationRetry: true,
		provider: "openai",
	};

	const prepared = await prepareRovoAppManagedRunRequest({
		requestBody,
		requestOriginHint: "voice",
		signal: null,
	});

	assert.equal(prepared.threadId, "thread-1");
	assert.equal(requestBody.sessionId, "session-1");
	assert.equal(requestBody.sessionMode, "persistent");
	assert.equal(
		requestBody.messages.some((message) => message.id === "delegated-1"),
		true,
	);
	assert.deepEqual(prepared.streamingArtifact, {
		id: "stream-1",
		title: "Untitled",
		kind: "text",
		content: "partial content",
	});
	assert.equal(prepared.requestOrigin, "voice");
	assert.deepEqual(prepared.requestVoiceMetadata, { locale: "en-US" });
	assert.deepEqual(prepared.artifactSteering, { mode: "update" });
	assert.equal(prepared.requestIsPlanMode, true);
	assert.equal(prepared.requestCreationMode, "agent");
	assert.equal(prepared.requestArtifactCreationRetry, true);
	assert.equal(prepared.resolvedProvider, "openai");
	for (const removedKey of [
		"activeDocumentId",
		"artifactContext",
		"artifactSteering",
		"delegatedMessageId",
		"conversationSummary",
		"streamingArtifact",
		"origin",
		"voiceMetadata",
		"hermesContext",
		"isPlanMode",
		"artifactCreationRetry",
	]) {
		assert.equal(Object.hasOwn(requestBody, removedKey), false, removedKey);
	}
	assert.equal(calls.some((call) => call[0] === "getDocument"), true);
});

test("prepareRovoAppManagedRunRequest routes Work Item report intents into HTML artifacts", async () => {
	const activeContext = [
		ACTIVE_WORK_ITEM_CONTEXT_START,
		"Key: RFP-101",
		"Title: Qualify Acme RFP",
		ACTIVE_WORK_ITEM_CONTEXT_END,
	].join("\n");
	const { calls, prepareRovoAppManagedRunRequest } = createHarness();
	const requestBody = {
		id: "thread-1",
		messages: [{ id: "request-1", role: "user", content: "create an HTML report for this work item" }],
		contextDescription: activeContext,
	};

	const prepared = await prepareRovoAppManagedRunRequest({
		requestBody,
		requestOriginHint: "text",
		signal: null,
	});

	assert.equal(requestBody.futureArtifactMode, "create");
	assert.equal(requestBody.futureArtifactTitle, "Qualify Acme RFP");
	assert.equal(requestBody.futureArtifactKind, "html");
	assert.equal(prepared.workItemReportRequest.shouldCreateArtifact, true);
	assert.equal(prepared.workItemReportRequest.artifactBackendPreference, "ai-gateway");
	assert.doesNotMatch(prepared.effectiveBaseContextDescription, /Hermes|Wiki Context/u);
	assert.match(prepared.effectiveBaseContextDescription, new RegExp(`\\${WORK_ITEM_REPORT_REQUEST_START}`));
	assert.equal(calls.some((call) => call[0] === "updateThread"), false);

});

test("prepareRovoAppManagedRunRequest throws when delegated message is missing", async () => {
	const { prepareRovoAppManagedRunRequest } = createHarness({
		rovoAppThreadManager: {
			getThread: async (threadId) => ({
				id: threadId,
				messages: [],
			}),
			updateThread: async () => {},
		},
	});

	await assert.rejects(
		prepareRovoAppManagedRunRequest({
			requestBody: {
				id: "thread-1",
				delegatedMessageId: "missing-message",
				messages: [],
			},
			requestOriginHint: "text",
			signal: null,
		}),
		/delegatedMessageId did not resolve/u,
	);
});
