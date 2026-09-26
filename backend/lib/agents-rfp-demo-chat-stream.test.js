const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildAgentsRfpDemoReportPreviewFields,
	createAgentsRfpDemoChatStreamOwner,
	createAgentsRfpDemoThinkingEventPart,
} = require("./agents-rfp-demo-chat-stream");

function createHarness({
	currentState = { chat: {} },
	currentThread = {
		id: "thread-1",
		hermesContext: {
			selectedSkillIds: ["existing-skill"],
			pendingDraftIds: ["draft-1"],
		},
	},
} = {}) {
	const calls = [];
	const questionMetaStore = new Map();
	const streamState = {};
	const documents = [];
	let state = currentState;

	const owner = createAgentsRfpDemoChatStreamOwner({
		updateAgentsRfpDemoState: async (updater) => {
			state = await updater(state);
			calls.push(["writeState", state]);
			return state;
		},
		agentsRfpDemoStateManager: {
			readState: async () => {
				calls.push(["readState"]);
				return state;
			},
			writeState: async (nextState) => {
				calls.push(["writeState", nextState]);
				state = nextState;
				return nextState;
			},
		},
		buildQuestionMetaFromQuestionCardPayload: (payload) => {
			calls.push(["buildQuestionMeta", payload.sessionId]);
			return payload.questions.map((question) => ({
				id: question.id,
				label: question.label,
			}));
		},
		createUIMessageStream: (options) => {
			streamState.options = options;
			return { kind: "fake-stream" };
		},
		generateTextViaGateway: async (options) => {
			calls.push(["generateTextViaGateway", options]);
			return "gateway text";
		},
		generateWorkItemVpkHtmlReport: async (input) => {
			calls.push(["generateWorkItemVpkHtmlReport", input]);
			if (typeof input.generateText === "function") {
				calls.push(["generatedText", await input.generateText({ provider: "fallback-provider" })]);
			}
			return {
				html: "<main>Report</main>",
				skill: "vpk-html",
			};
		},
		pipeUIMessageStreamToResponse: (input) => {
			calls.push(["pipe", input.response, input.stream]);
		},
		requestUserInputQuestionMetaStore: questionMetaStore,
		rovoAppDocumentManager: {
			createDocument: async (input) => {
				calls.push(["createDocument", input]);
				const document = {
					id: "doc-1",
					threadId: input.threadId,
					title: input.title,
					kind: input.kind,
				};
				documents.push(document);
				return document;
			},
		},
		rovoAppThreadManager: {
			getThread: async (threadId) => {
				calls.push(["getThread", threadId]);
				return currentThread;
			},
			updateThread: async (threadId, patch) => {
				calls.push(["updateThread", threadId, patch]);
				return { ...currentThread, ...patch };
			},
		},
		waitForTraceDelay: async (delayMs) => {
			calls.push(["waitForTraceDelay", delayMs]);
		},
	});

	const writerParts = [];
	const writer = {
		write: (part) => {
			writerParts.push(part);
		},
	};

	async function executeStream() {
		assert.equal(typeof streamState.options?.execute, "function");
		await streamState.options.execute({ writer });
	}

	return {
		calls,
		documents,
		executeStream,
		get state() {
			return state;
		},
		owner,
		questionMetaStore,
		streamState,
		writerParts,
	};
}

test("createAgentsRfpDemoThinkingEventPart preserves start and result payload shapes", () => {
	const step = {
		toolName: "rfp.test",
		toolCallId: "tool-1",
		label: "Testing",
		input: { key: "RFP-1" },
		outputPreview: "Done",
	};

	const start = createAgentsRfpDemoThinkingEventPart(step, "start");
	assert.equal(start.data.eventId, "tool-1-start");
	assert.equal(start.data.phase, "start");
	assert.equal(start.data.toolName, "rfp.test");
	assert.equal(start.data.label, "Testing");
	assert.equal(start.data.toolCallId, "tool-1");
	assert.equal(typeof start.data.timestamp, "string");
	assert.deepEqual(start.data.input, { key: "RFP-1" });
	const result = createAgentsRfpDemoThinkingEventPart(step, "result");
	assert.equal(result.data.output, "Done");
	assert.equal(result.data.outputPreview, "Done");
});

test("generateAgentsRfpDemoReportPreview validates context and uses deterministic preview fields", async () => {
	const harness = createHarness();

	await assert.rejects(
		harness.owner.generateAgentsRfpDemoReportPreview({}),
		/contextDescription is required/u,
	);

	const report = await harness.owner.generateAgentsRfpDemoReportPreview({
		contextDescription: "RFP context",
		variant: "branded",
	});

	assert.deepEqual(report, {
		html: "<main>Report</main>",
		skill: "vpk-html",
		variant: "branded",
	});
	const reportInput = harness.calls.find((call) => call[0] === "generateWorkItemVpkHtmlReport")[1];
	assert.equal(reportInput.contextDescription, "RFP context");
	assert.equal(reportInput.runSkillValidation, false);
	assert.equal(reportInput.runVisualVerify, false);
	const generatedFields = JSON.parse(harness.calls.find((call) => call[0] === "generatedText")[1]);
	assert.equal(generatedFields.includeAtlassianLogo, true);
	assert.match(buildAgentsRfpDemoReportPreviewFields("initial").recommendationText, /Initial recommendation/u);
});

test("createAgentsRfpDemoReportArtifact creates an html document without adding procedural context", async () => {
	const harness = createHarness();

	const document = await harness.owner.createAgentsRfpDemoReportArtifact({
		id: "thread-1",
		contextDescription: "RFP context",
		provider: "model-provider",
	});

	assert.deepEqual(document, {
		id: "doc-1",
		threadId: "thread-1",
		title: "Acmecorp RFP qualification DACI",
		kind: "html",
	});
	const reportInput = harness.calls.find((call) => call[0] === "generateWorkItemVpkHtmlReport")[1];
	assert.equal(reportInput.runSkillValidation, true);
	assert.equal(reportInput.runVisualVerify, false);
	assert.equal(reportInput.provider, "model-provider");
	assert.equal(harness.calls.find((call) => call[0] === "generateTextViaGateway")[1].backendPreference, "ai-gateway");
	const createDocumentInput = harness.calls.find((call) => call[0] === "createDocument")[1];
	assert.equal(createDocumentInput.previewSummary.includes("PDF-ready one-pager"), true);
	const updatePatch = harness.calls.find((call) => call[0] === "updateThread")[2];
	assert.equal(updatePatch.activeDocumentId, "doc-1");
	assert.equal(Object.hasOwn(updatePatch, "hermesContext"), false);
});

test("qualification question stream stores question metadata and preserves creation mode", async () => {
	const harness = createHarness();
	const response = { name: "res" };

	harness.owner.streamAgentsRfpDemoChatTurn(response, "qualification-questions", {
		creationMode: "agent",
	});
	assert.deepEqual(harness.calls.find((call) => call[0] === "pipe"), [
		"pipe",
		response,
		{ kind: "fake-stream" },
	]);

	await harness.executeStream();

	assert.equal(harness.questionMetaStore.has("agents-rfp-demo-rfp-101-qualification"), true);
	const widgetPart = harness.writerParts.find((part) => part.type === "data-widget-data");
	assert.equal(widgetPart.data.payload.creationMode, "agent");
	assert.equal(widgetPart.data.payload.toolCallId, "ai-gateway-ask_user_questions-agents-rfp-demo-rfp-101");
	assert.equal(harness.writerParts.some((part) => part.type === "data-turn-complete"), true);
	assert.equal(harness.calls.some((call) => call[0] === "createDocument"), false);
});

test("qualification answer stream persists selected knowledge and emits an artifact result", async () => {
	const harness = createHarness({
		currentState: { chat: { selectedRfpKnowledge: null } },
	});

	harness.owner.streamAgentsRfpDemoChatTurn({}, "qualification-answer", {
		id: "thread-1",
		contextDescription: "RFP context",
		clarification: {
			answers: {
				"knowledge-source": "product-security-evidence",
			},
		},
	});
	await harness.executeStream();

	assert.equal(harness.state.chat.selectedRfpKnowledge, "Product and security evidence");
	const artifactPart = harness.writerParts.find((part) => part.type === "data-artifact-result");
	assert.deepEqual(artifactPart.data, {
		documentId: "doc-1",
		threadId: "thread-1",
		title: "Acmecorp RFP qualification DACI",
		kind: "html",
		action: "create",
	});
	assert.equal(
		harness.writerParts.find((part) => part.type === "data-route-decision")?.data?.intent,
		"artifact_create",
	);
});

test("agent creation stream emits an agent result instead of an artifact result", async () => {
	const harness = createHarness({
		currentState: {
			chat: {
				selectedRfpKnowledge: "Reusable answer library",
			},
		},
	});

	harness.owner.streamAgentsRfpDemoChatTurn({}, "agent-creation", {});
	await harness.executeStream();

	const agentResult = harness.writerParts.find((part) => part.type === "data-agent-result");
	assert.equal(agentResult.data.name, "RFP Drafter");
	assert.equal(agentResult.data.selectedKnowledge, "Reusable answer library");
	assert.deepEqual(agentResult.data.seedKnowledge, [
		".agents/knowledge/rfp-drafting-agent/reusable-answer-library.md",
	]);
	assert.equal(harness.writerParts.some((part) => part.type === "data-artifact-result"), false);
	assert.equal(harness.calls.some((call) => call[0] === "createDocument"), false);
});
