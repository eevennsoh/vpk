const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildBrowserContextBlock,
	createRovoAppManagedRunChatDispatcher,
} = require("./rovo-app-managed-run-chat-dispatch");

function createHarness(overrides = {}) {
	const calls = [];
	const marks = [];
	const nowValues = overrides.nowValues ? [...overrides.nowValues] : [10, 25];
	const dependencies = {
		buildRovoAppArtifactContext: (activeArtifact) => {
			calls.push(["buildRovoAppArtifactContext", activeArtifact]);
			return activeArtifact?.id ? `[ARTIFACT]\n${activeArtifact.id}` : null;
		},
		dispatchChatSdkRequestInProcess: async (input) => {
			calls.push(["dispatchChatSdkRequestInProcess", input]);
			return new Response("event: done\n\n", {
				status: 202,
				headers: {
					"content-type": "text/event-stream",
				},
			});
		},
		isRovoAvailable: async () => true,
		now: () => nowValues.shift() ?? 25,
		persistRovoAppRunBackend: async (threadId, backend) => {
			calls.push(["persistRovoAppRunBackend", threadId, backend]);
		},
		resolveRovoAppTurnBackendPreference: async (input) => {
			calls.push(["resolveRovoAppTurnBackendPreference", input]);
			return "rovo";
		},
		...overrides,
	};
	delete dependencies.nowValues;
	const {
		dispatchRovoAppManagedRunChat,
	} = createRovoAppManagedRunChatDispatcher(dependencies);

	return {
		calls,
		dispatchRovoAppManagedRunChat,
		marks,
		stageTrace: {
			getHeaders: () => ({ "x-stage-trace-id": "trace-1" }),
			mark: (name, payload) => marks.push([name, payload]),
		},
	};
}

test("managed run chat dispatch prepares context, persists backend, and marks response headers", async () => {
	const signal = new AbortController().signal;
	const requestBody = {
		chatSdkSource: " ",
	};
	const routingDecision = {
		intent: "genui",
		presentation: "artifact_preview",
		confidence: 0.7,
		reason: "classifier_route",
	};
	const { calls, dispatchRovoAppManagedRunChat, marks, stageTrace } = createHarness();

	const response = await dispatchRovoAppManagedRunChat({
		activeArtifact: { id: "artifact-1" },
		autoPlanTriggered: true,
		effectiveBaseContextDescription: "[BASE CONTEXT]",
		requestBody,
		requestIsPlanMode: false,
		routingDecision,
		signal,
		stageTrace,
		threadId: "thread-1",
	});

	assert.equal(response.status, 202);
	assert.equal(requestBody.genuiHint, true);
	assert.equal(requestBody.backendPreference, "rovo");
	assert.equal(requestBody.resolvedPlanModeActive, true);
	assert.equal(requestBody.chatSdkSource, "rovo");
	assert.equal(requestBody.threadId, "thread-1");
	assert.equal(
		requestBody.contextDescription,
		[
			"[ARTIFACT]\nartifact-1",
			buildBrowserContextBlock("thread-1"),
			"[BASE CONTEXT]",
		].join("\n\n"),
	);
	assert.deepEqual(calls[1], [
		"resolveRovoAppTurnBackendPreference",
		{
			isPlanModeActive: true,
			isRovoAvailable: calls[1][1].isRovoAvailable,
			requestBody,
			routingDecision,
		},
	]);
	assert.deepEqual(calls[2], ["persistRovoAppRunBackend", "thread-1", "rovo"]);
	assert.equal(calls[3][0], "dispatchChatSdkRequestInProcess");
	assert.deepEqual(calls[3][1], {
		body: requestBody,
		headers: { "x-stage-trace-id": "trace-1" },
		signal,
	});
	assert.deepEqual(marks, [
		[
			"chat_sdk_response_headers",
			{
				stageMs: 15,
				status: 202,
				contentType: "text/event-stream",
			},
		],
	]);
});

test("managed run chat dispatch preserves explicit chat SDK source and non-genui turns", async () => {
	const requestBody = {
		chatSdkSource: "sidebar",
	};
	const { dispatchRovoAppManagedRunChat, stageTrace } = createHarness({
		buildRovoAppArtifactContext: () => null,
		resolveRovoAppTurnBackendPreference: async () => "ai-gateway",
	});

	await dispatchRovoAppManagedRunChat({
		activeArtifact: null,
		autoPlanTriggered: false,
		effectiveBaseContextDescription: null,
		requestBody,
		requestIsPlanMode: false,
		routingDecision: {
			intent: "chat",
			presentation: "text",
			confidence: 1,
			reason: "chat",
		},
		signal: null,
		stageTrace,
		threadId: "thread-1",
	});

	assert.equal(requestBody.chatSdkSource, "sidebar");
	assert.equal(requestBody.genuiHint, undefined);
	assert.equal(requestBody.backendPreference, "ai-gateway");
	assert.equal(requestBody.resolvedPlanModeActive, false);
	assert.equal(requestBody.contextDescription.includes("[BROWSER TOOLS]"), true);
	assert.equal(requestBody.contextDescription.includes("[WIKI TOOLS]"), false);
});

test("managed run chat dispatch throws the response body for failed Chat SDK responses", async () => {
	const { dispatchRovoAppManagedRunChat, marks, stageTrace } = createHarness({
		dispatchChatSdkRequestInProcess: async () => {
			return new Response("upstream failed", {
				status: 503,
				headers: {
					"content-type": "text/plain",
				},
			});
		},
	});

	await assert.rejects(
		dispatchRovoAppManagedRunChat({
			activeArtifact: null,
			autoPlanTriggered: false,
			effectiveBaseContextDescription: null,
			requestBody: {},
			requestIsPlanMode: false,
			routingDecision: {
				intent: "chat",
				presentation: "text",
				confidence: 1,
				reason: "chat",
			},
			signal: null,
			stageTrace,
			threadId: "thread-1",
		}),
		/upstream failed/u,
	);
	assert.deepEqual(marks, [
		[
			"chat_sdk_response_headers",
			{
				stageMs: 15,
				status: 503,
				contentType: "text/plain",
			},
		],
	]);
});
