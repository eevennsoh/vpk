const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoAppManagedRunRouteResolver,
} = require("./rovo-app-managed-run-routing");
const { VOICE_ROUTING_CLASSIFIER_TIMEOUT_MS } = require("./resolve-routing-decision");

function createHarness(overrides = {}) {
	const calls = [];
	const marks = [];
	const dependencies = {
		assessPromptComplexityForPlanMode: (prompt) => {
			calls.push(["assessPromptComplexityForPlanMode", prompt]);
			return {
				shouldPlan: false,
				score: 0,
				reasons: [],
			};
		},
		generateTextViaGateway: async (input) => {
			calls.push(["generateTextViaGateway", input]);
			return "classified";
		},
		logger: {
			info: (...args) => calls.push(["info", args]),
		},
		now: () => {
			calls.push(["now"]);
			return 100;
		},
		resolveRoutingDecision: async (input) => {
			calls.push(["resolveRoutingDecision", input]);
			return {
				intent: "chat",
				presentation: "text",
				confidence: 0.4,
				reason: "classifier_default",
				origin: input.origin,
			};
		},
		...overrides,
	};
	const {
		resolveRovoAppManagedRunRoute,
	} = createRovoAppManagedRunRouteResolver(dependencies);

	return {
		calls,
		marks,
		resolveRovoAppManagedRunRoute,
		stageTrace: {
			mark: (name, payload) => marks.push([name, payload]),
		},
	};
}

test("resolveRovoAppManagedRunRoute auto-plan triggers deterministic plan routing", async () => {
	const { calls, marks, resolveRovoAppManagedRunRoute, stageTrace } = createHarness({
		assessPromptComplexityForPlanMode: (prompt) => {
			calls.push(["assessPromptComplexityForPlanMode", prompt]);
			return {
				shouldPlan: true,
				score: 7,
				reasons: ["planning_keywords", "long_prompt"],
			};
		},
		resolveRoutingDecision: async () => {
			throw new Error("classifier should not run for deterministic auto-plan route");
		},
	});

	const result = await resolveRovoAppManagedRunRoute({
		activeArtifact: null,
		latestUserMessage: "build a multi-step rollout plan",
		recentHistory: [],
		requestArtifactCreationRetry: false,
		requestCreationMode: null,
		requestIsPlanMode: false,
		requestOrigin: "text",
		requestVoiceMetadata: null,
		resolvedProvider: "openai",
		signal: null,
		stageTrace,
		threadId: "thread-1",
		workItemReportRequest: {},
	});

	assert.equal(result.autoPlanTriggered, true);
	assert.equal(result.routingDecision.intent, "chat");
	assert.equal(result.routingDecision.reason, "plan_mode_active");
	assert.deepEqual(marks, [
		[
			"auto_plan_triggered",
			{ score: 7, reasons: "planning_keywords,long_prompt" },
		],
		[
			"route_decision_resolved",
			{
				stageMs: 0,
				intent: "chat",
				confidence: 1,
				reason: "plan_mode_active",
			},
		],
	]);
	assert.deepEqual(
		calls.filter(([name]) => name === "info").map(([, args]) => args[0]),
		[
			"[FUTURE-CHAT] Auto-plan heuristic triggered",
			"[FUTURE-CHAT] Auto-plan: enabling local deep-plan request",
		],
	);
});

test("resolveRovoAppManagedRunRoute skips auto-plan when plan mode is already active", async () => {
	const { calls, marks, resolveRovoAppManagedRunRoute, stageTrace } = createHarness({
		assessPromptComplexityForPlanMode: () => {
			throw new Error("auto-plan should not run when request plan mode is active");
		},
		resolveRoutingDecision: async () => {
			throw new Error("classifier should not run for deterministic plan route");
		},
	});

	const result = await resolveRovoAppManagedRunRoute({
		activeArtifact: null,
		latestUserMessage: "build a plan",
		recentHistory: [],
		requestArtifactCreationRetry: false,
		requestCreationMode: null,
		requestIsPlanMode: true,
		requestOrigin: "text",
		requestVoiceMetadata: null,
		resolvedProvider: "openai",
		signal: null,
		stageTrace,
		threadId: "thread-1",
		workItemReportRequest: {},
	});

	assert.equal(result.autoPlanTriggered, false);
	assert.equal(result.routingDecision.reason, "plan_mode_active");
	assert.deepEqual(
		calls.filter(([name]) => name === "assessPromptComplexityForPlanMode"),
		[],
	);
	assert.deepEqual(marks, [
		[
			"route_decision_resolved",
			{
				stageMs: 0,
				intent: "chat",
				confidence: 1,
				reason: "plan_mode_active",
			},
		],
	]);
});

test("resolveRovoAppManagedRunRoute passes classifier context and gateway options", async () => {
	const nowValues = [100, 145];
	const signal = new AbortController().signal;
	const { calls, marks, resolveRovoAppManagedRunRoute, stageTrace } = createHarness({
		now: () => nowValues.shift() ?? 145,
		resolveRoutingDecision: async (input, options) => {
			calls.push(["resolveRoutingDecision", input, options]);
			const classified = await options.classify({
				system: "system prompt",
				prompt: "classification prompt",
				signal: "classify-signal",
			});
			assert.equal(classified, "classified");
			return {
				intent: "genui",
				presentation: "artifact_preview",
				confidence: 0.7,
				reason: "classifier_route",
				origin: input.origin,
			};
		},
	});
	const recentHistory = [{ role: "user", content: "previous" }];
	const voiceMetadata = { locale: "en-US" };
	const activeArtifact = { id: "artifact-1" };

	const result = await resolveRovoAppManagedRunRoute({
		activeArtifact,
		latestUserMessage: "make something visual",
		recentHistory,
		requestArtifactCreationRetry: false,
		requestCreationMode: "canvas",
		requestIsPlanMode: false,
		requestOrigin: "voice",
		requestVoiceMetadata: voiceMetadata,
		resolvedProvider: "openai",
		signal,
		stageTrace,
		threadId: "thread-1",
		workItemReportRequest: {},
	});

	assert.equal(result.autoPlanTriggered, false);
	assert.equal(result.routingDecision.reason, "classifier_route");
	assert.deepEqual(calls[1], [
		"resolveRoutingDecision",
		{
			prompt: "make something visual",
			origin: "voice",
			activeArtifact,
			creationMode: "canvas",
			voiceMetadata,
			recentHistory,
			threadId: "thread-1",
			provider: "openai",
			signal,
		},
		{ classify: calls[1][2].classify, timeoutMs: VOICE_ROUTING_CLASSIFIER_TIMEOUT_MS },
	]);
	assert.deepEqual(
		calls.find(([name]) => name === "generateTextViaGateway"),
		[
			"generateTextViaGateway",
			{
				system: "system prompt",
				prompt: "classification prompt",
				maxOutputTokens: 220,
				temperature: 0.1,
				provider: "openai",
				signal: "classify-signal",
				backendPreference: "ai-gateway",
			},
		],
	);
	assert.deepEqual(marks, [
		[
			"route_decision_resolved",
			{
				stageMs: 45,
				intent: "genui",
				confidence: 0.7,
				reason: "classifier_route",
			},
		],
	]);
});

test("resolveRovoAppManagedRunRoute falls back to chat when classifier throws", async () => {
	const nowValues = [10, 25];
	const { marks, resolveRovoAppManagedRunRoute, stageTrace } = createHarness({
		now: () => nowValues.shift() ?? 25,
		resolveRoutingDecision: async () => {
			throw new Error("classifier unavailable");
		},
	});

	const result = await resolveRovoAppManagedRunRoute({
		activeArtifact: null,
		latestUserMessage: "hello",
		recentHistory: [],
		requestArtifactCreationRetry: false,
		requestCreationMode: null,
		requestIsPlanMode: false,
		requestOrigin: "text",
		requestVoiceMetadata: null,
		resolvedProvider: "openai",
		signal: null,
		stageTrace,
		threadId: "thread-1",
		workItemReportRequest: {},
	});

	assert.deepEqual(result, {
		autoPlanTriggered: false,
		routingDecision: {
			intent: "chat",
			presentation: "text",
			confidence: 0,
			reason: "classifier_error",
			origin: "text",
		},
	});
	assert.deepEqual(marks, [
		[
			"route_decision_resolved",
			{
				stageMs: 15,
				intent: "chat",
				confidence: 0,
				reason: "classifier_error",
			},
		],
	]);
});

test("resolveRovoAppManagedRunRoute keeps Work Item artifact routing deterministic", async () => {
	const { marks, resolveRovoAppManagedRunRoute, stageTrace } = createHarness({
		resolveRoutingDecision: async () => {
			throw new Error("classifier should not run for Work Item report artifact route");
		},
	});

	const result = await resolveRovoAppManagedRunRoute({
		activeArtifact: null,
		latestUserMessage: "write a report",
		recentHistory: [],
		requestArtifactCreationRetry: false,
		requestCreationMode: null,
		requestIsPlanMode: false,
		requestOrigin: "text",
		requestVoiceMetadata: null,
		resolvedProvider: "openai",
		signal: null,
		stageTrace,
		threadId: "thread-1",
		workItemReportRequest: {
			shouldCreateArtifact: true,
		},
	});

	assert.equal(result.autoPlanTriggered, false);
	assert.equal(result.routingDecision.intent, "artifact_create");
	assert.equal(result.routingDecision.reason, "work_item_report_intent");
	assert.deepEqual(marks, [
		[
			"route_decision_resolved",
			{
				stageMs: 0,
				intent: "artifact_create",
				confidence: 1,
				reason: "work_item_report_intent",
			},
		],
	]);
});
