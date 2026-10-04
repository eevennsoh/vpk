"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildPostTurnWorkCompleteTraceData,
	buildTurnCompletePart,
	completeRovoPostTurn,
	finalizePlanExecutionArtifactPostStream,
	resolvePlanExecutionCompletion,
} = require("./post-turn");

test("resolvePlanExecutionCompletion skips inactive or missing thread plans", () => {
	assert.deepEqual(
		resolvePlanExecutionCompletion({
			isPlanExecutionPhase: () => true,
			threadId: null,
			toolObservationEntries: [],
		}),
		{
			active: false,
			allTasksDone: false,
			appRoute: null,
			appRoutes: [],
			shouldCreateArtifact: false,
			shouldFinalizePlan: false,
		},
	);
	assert.deepEqual(
		resolvePlanExecutionCompletion({
			isPlanExecutionPhase: () => false,
			threadId: "thread-1",
			toolObservationEntries: [],
		}),
		{
			active: false,
			allTasksDone: false,
			appRoute: null,
			appRoutes: [],
			shouldCreateArtifact: false,
			shouldFinalizePlan: false,
		},
	);
});

test("resolvePlanExecutionCompletion keeps active incomplete plans open", () => {
	const result = resolvePlanExecutionCompletion({
		isPlanExecutionPhase: () => true,
		threadId: "thread-1",
		toolObservationEntries: [
			{
				toolName: "update_todo",
				phase: "result",
				rawOutput: {
					todos: [
						{ content: "Build route", status: "in_progress" },
					],
				},
			},
		],
	});

	assert.equal(result.active, true);
	assert.equal(result.allTasksDone, false);
	assert.equal(result.shouldFinalizePlan, false);
	assert.equal(result.shouldCreateArtifact, false);
});

test("resolvePlanExecutionCompletion returns the first completed app route", () => {
	const result = resolvePlanExecutionCompletion({
		isPlanExecutionPhase: () => true,
		threadId: "thread-1",
		toolObservationEntries: [
			{
				toolName: "update_todo",
				phase: "result",
				rawOutput: {
					todos: [
						{ content: "Build route", status: "completed" },
					],
				},
			},
			{
				toolName: "create_file",
				rawOutput: {
					path: "app/example/page.tsx",
				},
			},
			{
				toolName: "create_file",
				rawOutput: {
					path: "app/other/page.tsx",
				},
			},
		],
	});

	assert.equal(result.active, true);
	assert.equal(result.allTasksDone, true);
	assert.equal(result.shouldFinalizePlan, true);
	assert.equal(result.shouldCreateArtifact, true);
	assert.equal(result.appRoute, "/example");
	assert.deepEqual(result.appRoutes, ["/example", "/other"]);
});

test("resolvePlanExecutionCompletion finalizes completed plans without routes", () => {
	const result = resolvePlanExecutionCompletion({
		isPlanExecutionPhase: () => true,
		threadId: "thread-1",
		toolObservationEntries: [
			{
				toolName: "update_todo",
				phase: "result",
				rawOutput: {
					todos: [
						{ content: "Done", status: "completed" },
					],
				},
			},
		],
	});

	assert.equal(result.allTasksDone, true);
	assert.equal(result.shouldFinalizePlan, true);
	assert.equal(result.shouldCreateArtifact, false);
	assert.equal(result.appRoute, null);
	assert.deepEqual(result.appRoutes, []);
});

test("buildTurnCompletePart and buildPostTurnWorkCompleteTraceData preserve payloads", () => {
	assert.deepEqual(
		buildTurnCompletePart({
			now: () => new Date("2026-07-04T12:00:00.000Z"),
		}),
		{
			type: "data-turn-complete",
			data: { timestamp: "2026-07-04T12:00:00.000Z" },
		},
	);
	assert.deepEqual(
		buildPostTurnWorkCompleteTraceData({ hasQueuedPrompts: true }),
		{
			suggestionsDeferred: true,
			hasQueuedPrompts: true,
		},
	);
});

test("completeRovoPostTurn runs post-turn side effects in order", async () => {
	const calls = [];
	const parts = [];
	const stageMarks = [];
	const result = await completeRovoPostTurn({
		buildArtifactPreviewSummary: () => "preview",
		buildMissingStudioAgentResultFailureParts: () => [],
		buildPostTurnWorkCompleteTraceData: ({ hasQueuedPrompts }) => ({
			traceHasQueuedPrompts: hasQueuedPrompts,
		}),
		buildRovoTurnRoutingTelemetry: (input) => ({
			...input,
			timestamp: "now",
		}),
		buildTurnCompletePart: () => ({
			type: "data-turn-complete",
			data: { timestamp: "done" },
		}),
		clearPlanSession: () => {},
		closePendingQuestionCardLoading: () => {
			calls.push("close-question-loading");
		},
		createRouteDecisionPart: (data) => ({ type: "data-route-decision", data }),
		derivePlanExecutionArtifactTitle: () => "Artifact",
		emitRovoMissingStudioAgentResultFailure: (input) => {
			calls.push("missing-studio-result");
			assert.equal(input.shouldEmitMissingStudioAgentResultFailure, true);
		},
		finalizePlanExecutionArtifactPostStreamFn: async (input) => {
			calls.push("finalize-plan");
			assert.deepEqual(input.syncedThread, { id: "thread-1", messages: [] });
			assert.equal(input.threadId, "thread-1");
			return { finalized: false };
		},
		flushDeferredToolFirstText: () => {
			calls.push("flush-deferred-text");
		},
		generatePlanMetadataViaGateway: async () => ({}),
		getAssistantText: () => "Assistant response",
		getLatestPlanWidgetMetadata: () => null,
		getRouteToolsDetected: () => true,
		hasEmittedGenuiWidget: true,
		hasEmittedPlanWidget: false,
		hasEmittedQuestionCard: false,
		hasObservedActionableToolCall: true,
		hasObservedToolExecution: true,
		hasQueuedPrompts: true,
		isPlanExecutionPhase: () => false,
		isPostClarificationTurn: true,
		isStrictToolFirstTurn: false,
		logger: {
			info(label, data) {
				calls.push(`info:${label}`);
				assert.equal(data.routeToolsDetected, true);
			},
			warn() {
				throw new Error("sync should not warn");
			},
		},
		requestOrigin: "studio",
		resolvedRovoPort: 43123,
		rovoAppDocumentManager: {},
		rovoAppThreadManager: {},
		sessionMode: "default",
		shouldEmitMissingStudioAgentResultFailure: true,
		stageTrace: {
			mark(stage, data) {
				stageMarks.push({ stage, data });
			},
		},
		syncRovoAppThreadSessionFromCurrentPort: async (threadId, port, options) => {
			calls.push("sync-thread");
			assert.equal(threadId, "thread-1");
			assert.equal(port, 43123);
			assert.deepEqual(options, { sessionMode: "default" });
			return { id: "thread-1", messages: [] };
		},
		threadId: "thread-1",
		toolObservationEntries: [{ toolName: "tool" }],
		writeTextEndIfStarted: () => {
			calls.push("text-end");
		},
		writer: {
			write(part) {
				calls.push(`write:${part.type}`);
				parts.push(part);
			},
		},
	});

	assert.deepEqual(calls, [
		"flush-deferred-text",
		"text-end",
		"missing-studio-result",
		"close-question-loading",
		"sync-thread",
		"info:[OUTPUT-ROUTING] Turn routing summary",
		"finalize-plan",
		"write:data-turn-complete",
	]);
	assert.deepEqual(parts, [
		{
			type: "data-turn-complete",
			data: { timestamp: "done" },
		},
	]);
	assert.deepEqual(stageMarks, [
		{
			stage: "post_turn_work_complete",
			data: { traceHasQueuedPrompts: true },
		},
	]);
	assert.deepEqual(result, {
		planExecutionArtifactResult: { finalized: false },
		routingTelemetry: {
			assistantText: "Assistant response",
			hasEmittedGenuiWidget: true,
			hasEmittedPlanWidget: false,
			hasEmittedQuestionCard: false,
			hasObservedActionableToolCall: true,
			hasObservedToolExecution: true,
			isPostClarificationTurn: true,
			isStrictToolFirstTurn: false,
			routeToolsDetected: true,
			timestamp: "now",
		},
		syncedThread: { id: "thread-1", messages: [] },
	});
});

test("completeRovoPostTurn warns on sync failure and still completes the turn", async () => {
	const warnings = [];
	const parts = [];
	const result = await completeRovoPostTurn({
		buildArtifactPreviewSummary: () => "",
		buildMissingStudioAgentResultFailureParts: () => [],
		buildRovoTurnRoutingTelemetry: (input) => input,
		clearPlanSession: () => {},
		createRouteDecisionPart: (data) => ({ type: "data-route-decision", data }),
		derivePlanExecutionArtifactTitle: () => "",
		emitRovoMissingStudioAgentResultFailure: () => {},
		finalizePlanExecutionArtifactPostStreamFn: async (input) => {
			assert.equal(input.syncedThread, null);
			return { finalized: false };
		},
		generatePlanMetadataViaGateway: async () => ({}),
		getAssistantText: () => "",
		getLatestPlanWidgetMetadata: () => null,
		getRouteToolsDetected: () => false,
		isPlanExecutionPhase: () => false,
		logger: {
			info() {},
			warn(...args) {
				warnings.push(args);
			},
		},
		requestOrigin: "studio",
		resolvedRovoPort: 43123,
		rovoAppDocumentManager: {},
		rovoAppThreadManager: {},
		stageTrace: { mark() {} },
		syncRovoAppThreadSessionFromCurrentPort: async () => {
			throw new Error("sync failed");
		},
		threadId: "thread-1",
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.equal(warnings.length, 1);
	assert.equal(
		warnings[0][0],
		"[FUTURE-CHAT] Failed to sync thread session at turn completion:",
	);
	assert.deepEqual(warnings[0][1], {
		threadId: "thread-1",
		port: 43123,
		error: "sync failed",
	});
	assert.equal(parts.at(-1).type, "data-turn-complete");
	assert.equal(result.syncedThread, null);
});

test("finalizePlanExecutionArtifactPostStream creates artifact, emits stream parts, and clears session", async () => {
	const parts = [];
	const clearedThreads = [];
	const createdDocuments = [];
	const threadUpdates = [];
	const result = await finalizePlanExecutionArtifactPostStream({
		buildArtifactPreviewSummary: () => {
			throw new Error("fallback summary should not be used");
		},
		clearPlanSession: (threadId) => clearedThreads.push(threadId),
		createRouteDecisionPart: (data) => ({
			type: "data-route-decision",
			data,
		}),
		derivePlanExecutionArtifactTitle: ({ appRoute, planTitle }) =>
			`${planTitle} at ${appRoute}`,
		generatePlanMetadataViaGateway: async () => {
			throw new Error("metadata generation should not be used");
		},
		getLatestPlanWidgetMetadata: (messages) => {
			assert.deepEqual(messages, [{ id: "msg-1" }]);
			return {
				title: "Launch Plan",
				shortDescription: "Preview from plan card",
				description: "Build the app",
				tasks: [{ title: "Ship" }],
			};
		},
		isPlanExecutionPhase: () => true,
		logger: { info() {}, warn() {} },
		nowMs: () => 123,
		requestOrigin: "studio",
		resolvePlanExecutionCompletionFn: () => ({
			appRoute: "/example",
			appRoutes: ["/example"],
			shouldCreateArtifact: true,
			shouldFinalizePlan: true,
		}),
		rovoAppDocumentManager: {
			async createDocument(document) {
				createdDocuments.push(document);
				return {
					id: "doc-1",
					threadId: document.threadId,
					title: document.title,
				};
			},
		},
		rovoAppThreadManager: {
			async getThread() {
				throw new Error("synced thread should be used");
			},
			async updateThread(threadId, patch) {
				threadUpdates.push({ threadId, patch });
			},
		},
		syncedThread: {
			messages: [{ id: "msg-1" }],
		},
		threadId: "thread-1",
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(createdDocuments, [
		{
			threadId: "thread-1",
			title: "Launch Plan at /example",
			kind: "react",
			content: "/example",
			previewSummary: "Preview from plan card",
			changeLabel: "Plan execution complete",
			sourceMessageId: null,
		},
	]);
	assert.deepEqual(threadUpdates, [
		{
			threadId: "thread-1",
			patch: { activeDocumentId: "doc-1" },
		},
	]);
	assert.deepEqual(parts, [
		{
			type: "data-artifact-result",
			data: {
				documentId: "doc-1",
				threadId: "thread-1",
				title: "Launch Plan at /example",
				kind: "react",
				action: "create",
			},
		},
		{ type: "text-start", id: "plan-exec-artifact-123" },
		{
			type: "text-delta",
			id: "plan-exec-artifact-123",
			delta: "Your app is ready — open **Launch Plan at /example** to see it live.",
		},
		{ type: "text-end", id: "plan-exec-artifact-123" },
		{
			type: "data-route-decision",
			data: {
				intent: "artifact_create",
				origin: "studio",
				reason: "plan_execution_complete",
			},
		},
	]);
	assert.deepEqual(clearedThreads, ["thread-1"]);
	assert.deepEqual(result, {
		appRoute: "/example",
		appRoutes: ["/example"],
		artifactCreated: true,
		documentId: "doc-1",
		finalized: true,
	});
});

test("finalizePlanExecutionArtifactPostStream clears completed plan without route and emits no artifact", async () => {
	const parts = [];
	const clearedThreads = [];
	const result = await finalizePlanExecutionArtifactPostStream({
		clearPlanSession: (threadId) => clearedThreads.push(threadId),
		isPlanExecutionPhase: () => true,
		logger: { info() {}, warn() {} },
		resolvePlanExecutionCompletionFn: () => ({
			appRoute: null,
			appRoutes: [],
			shouldCreateArtifact: false,
			shouldFinalizePlan: true,
		}),
		rovoAppDocumentManager: {
			async createDocument() {
				throw new Error("artifact should not be created");
			},
		},
		rovoAppThreadManager: {
			async updateThread() {
				throw new Error("thread should not be updated");
			},
		},
		threadId: "thread-1",
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	});

	assert.deepEqual(parts, []);
	assert.deepEqual(clearedThreads, ["thread-1"]);
	assert.deepEqual(result, {
		appRoute: null,
		appRoutes: [],
		artifactCreated: false,
		documentId: null,
		finalized: true,
	});
});

test("finalizePlanExecutionArtifactPostStream uses generated preview summary when plan metadata has none", async () => {
	const createdDocuments = [];
	await finalizePlanExecutionArtifactPostStream({
		buildArtifactPreviewSummary: () => {
			throw new Error("fallback summary should not be used");
		},
		clearPlanSession: () => {},
		createRouteDecisionPart: (data) => ({ type: "data-route-decision", data }),
		derivePlanExecutionArtifactTitle: () => "Generated App",
		generatePlanMetadataViaGateway: async (metadata) => {
			assert.deepEqual(metadata, {
				title: "Plan Title",
				description: "Plan description",
				tasks: [{ title: "Task" }],
			});
			return { shortDescription: "Generated preview summary" };
		},
		getLatestPlanWidgetMetadata: () => ({
			title: "Plan Title",
			description: "Plan description",
			tasks: [{ title: "Task" }],
		}),
		isPlanExecutionPhase: () => true,
		logger: { info() {}, warn() {} },
		requestOrigin: "studio",
		resolvePlanExecutionCompletionFn: () => ({
			appRoute: "/generated",
			appRoutes: ["/generated"],
			shouldCreateArtifact: true,
			shouldFinalizePlan: true,
		}),
		rovoAppDocumentManager: {
			async createDocument(document) {
				createdDocuments.push(document);
				return {
					id: "doc-1",
					threadId: document.threadId,
					title: document.title,
				};
			},
		},
		rovoAppThreadManager: {
			async getThread() {
				return { messages: [] };
			},
			async updateThread() {},
		},
		threadId: "thread-1",
		writer: { write() {} },
	});

	assert.equal(createdDocuments[0].previewSummary, "Generated preview summary");
});

test("finalizePlanExecutionArtifactPostStream falls back to buildArtifactPreviewSummary when metadata generation fails", async () => {
	const warnings = [];
	const createdDocuments = [];
	await finalizePlanExecutionArtifactPostStream({
		buildArtifactPreviewSummary: (title) => `Fallback for ${title}`,
		clearPlanSession: () => {},
		createRouteDecisionPart: (data) => ({ type: "data-route-decision", data }),
		derivePlanExecutionArtifactTitle: () => "Fallback App",
		generatePlanMetadataViaGateway: async () => {
			throw new Error("metadata unavailable");
		},
		getLatestPlanWidgetMetadata: () => ({
			title: "Plan Title",
			description: "Plan description",
			tasks: [],
		}),
		isPlanExecutionPhase: () => true,
		logger: {
			info() {},
			warn(...args) {
				warnings.push(args);
			},
		},
		requestOrigin: "studio",
		resolvePlanExecutionCompletionFn: () => ({
			appRoute: "/fallback",
			appRoutes: ["/fallback"],
			shouldCreateArtifact: true,
			shouldFinalizePlan: true,
		}),
		rovoAppDocumentManager: {
			async createDocument(document) {
				createdDocuments.push(document);
				return {
					id: "doc-1",
					threadId: document.threadId,
					title: document.title,
				};
			},
		},
		rovoAppThreadManager: {
			async getThread() {
				return { messages: [] };
			},
			async updateThread() {},
		},
		threadId: "thread-1",
		writer: { write() {} },
	});

	assert.equal(createdDocuments[0].previewSummary, "Fallback for Fallback App");
	assert.equal(
		warnings[0][0],
		"[PLAN-EXECUTION] Failed to generate artifact preview summary:",
	);
});
