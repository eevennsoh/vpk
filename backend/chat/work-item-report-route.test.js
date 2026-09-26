"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	handleWorkItemReportRoute,
} = require("./work-item-report-route");

test("handleWorkItemReportRoute falls through when the prompt is not a Work Item report intent", async () => {
	let listedSkills = false;
	const handled = await handleWorkItemReportRoute({
		handlerDependencies: {
			listHermesSkills: async () => {
				listedSkills = true;
				return [];
			},
			resolveWorkItemReportRequest: () => ({
				isIntent: false,
				shouldCreateArtifact: false,
			}),
		},
		latestUserMessage: "Just chat",
	});

	assert.equal(handled, false);
	assert.equal(listedSkills, false);
});

test("handleWorkItemReportRoute streams the missing-context response", async () => {
	const pipeCalls = [];
	const writtenParts = [];
	let streamConfig;
	let resolveCalls = 0;
	const res = { id: "response" };

	const handled = await handleWorkItemReportRoute({
		handlerDependencies: {
			createRouteDecisionPart: (data) => ({ type: "data-route-decision", data }),
			createUIMessageStream: (config) => {
				streamConfig = config;
				return { id: "stream", config };
			},
			pipeUIMessageStreamToResponse: (input) => {
				pipeCalls.push(input);
			},
			resolveWorkItemReportRequest: () => {
				resolveCalls += 1;
				return {
					hasContext: false,
					isIntent: true,
					shouldCreateArtifact: false,
				};
			},
		},
		latestUserMessage: "Create an HTML report",
		requestOrigin: "text",
		res,
	});

	assert.equal(handled, true);
	assert.equal(resolveCalls, 1);
	assert.deepEqual(pipeCalls, [
		{ response: res, stream: { id: "stream", config: streamConfig } },
	]);

	await streamConfig.execute({
		writer: {
			write(part) {
				writtenParts.push(part);
			},
		},
	});

	assert.equal(writtenParts[0].type, "text-start");
	assert.equal(writtenParts[1].type, "text-delta");
	assert.match(writtenParts[1].delta, /Jira Work Item/u);
	assert.deepEqual(writtenParts[3], {
		type: "data-route-decision",
		data: {
			intent: "chat",
			origin: "text",
			reason: "work_item_report_missing_context",
		},
	});
	assert.equal(writtenParts[4].type, "data-turn-complete");
});

test("handleWorkItemReportRoute dispatches Work Item artifacts through the Rovo app artifact handler", async () => {
	const abortController = new AbortController();
	const artifactCalls = [];
	const cleanupCalls = [];
	const contextCalls = [];

	const pipeCalls = [];
	const stageMarks = [];
	const req = {
		body: {
			existing: true,
		},
	};
	const res = { id: "response" };
	const webResponse = { id: "web-response" };

	const handled = await handleWorkItemReportRoute({
		contextDescription: "Existing context",
		handlerDependencies: {
			WORK_ITEM_REPORT_REQUEST_START: "[Work Item Report Request]",
			buildWorkItemReportRequestContext: (input) => {
				contextCalls.push(input);
				return "Work Item context";
			},
			createAbortControllerFromRequest: (actualReq, actualRes, options) => {
				assert.equal(actualReq, req);
				assert.equal(actualRes, res);
				assert.equal(typeof options.onAbort, "function");
				return {
					abortController,
					cleanup: () => {
						cleanupCalls.push("cleanup");
					},
				};
			},
			createRovoAppThreadId: () => "generated-thread",
			handleRovoAppArtifactToolRequest: async (input) => {
				artifactCalls.push(input);
				return {
					handled: true,
					response: webResponse,
				};
			},
			pipeWebResponseToExpressResponse: async (...args) => {
				pipeCalls.push(args);
			},
			resolveWorkItemReportRequest: () => ({
				artifactBackendPreference: null,
				contextBlock: null,
				hasContext: true,
				isIntent: true,
				shouldCreateArtifact: true,
				shouldLoadSkill: true,
				skillId: "vpk-html",
				title: "Qualification report",
			}),
		},
		latestUserMessage: "Create the report",
		messages: [{ id: "message-1" }],
		provider: "openai",
		rawHermesContext: {
			selectedSkillIds: ["existing-skill"],
		},
		req,
		requestOrigin: "text",
		res,
		stageTrace: {
			mark(stage, data) {
				stageMarks.push([stage, data]);
			},
		},
		threadId: "thread-1",
	});

	assert.equal(handled, true);
	assert.deepEqual(contextCalls, [
		{
			contextDescription: "Existing context",
			promptText: "Create the report",
			skillId: "vpk-html",
		},
	]);
	assert.equal(artifactCalls.length, 1);
	assert.equal(artifactCalls[0].artifactBackendPreference, "ai-gateway");
	assert.equal(
		artifactCalls[0].contextDescription,
		"Existing context\n\nWork Item context",
	);
	assert.equal(artifactCalls[0].requestBody.id, "thread-1");
	assert.equal(artifactCalls[0].requestBody.futureArtifactKind, "html");
	assert.equal(artifactCalls[0].requestBody.futureArtifactMode, "create");
	assert.equal(
		artifactCalls[0].requestBody.futureArtifactTitle,
		"Qualification report",
	);
	assert.equal(artifactCalls[0].signal, abortController.signal);
	assert.deepEqual(stageMarks, [[
		"chat_sdk_report_artifact_route_handled",
		{
			threadId: "thread-1",
			skillId: "vpk-html",
		},
	]]);
	assert.deepEqual(pipeCalls, [[webResponse, res]]);
	assert.deepEqual(cleanupCalls, ["cleanup"]);
});

test("handleWorkItemReportRoute falls through when the artifact handler declines the request", async () => {
	const cleanupCalls = [];
	const pipeCalls = [];
	const handled = await handleWorkItemReportRoute({
		handlerDependencies: {
			WORK_ITEM_REPORT_REQUEST_START: "[Work Item Report Request]",
			buildWorkItemReportRequestContext: () => "Work Item context",
			createAbortControllerFromRequest: () => ({
				abortController: new AbortController(),
				cleanup: () => {
					cleanupCalls.push("cleanup");
				},
			}),
			createRovoAppThreadId: () => "generated-thread",
			handleRovoAppArtifactToolRequest: async () => ({ handled: false }),
			pipeWebResponseToExpressResponse: (...args) => {
				pipeCalls.push(args);
			},
			resolveWorkItemReportRequest: () => ({
				hasContext: true,
				isIntent: true,
				shouldCreateArtifact: true,
				shouldLoadSkill: false,
				skillId: "vpk-html",
				title: "Report",
			}),
		},
		latestUserMessage: "Create report",
		req: { body: {} },
		res: {},
		stageTrace: {
			mark() {},
		},
	});

	assert.equal(handled, false);
	assert.deepEqual(pipeCalls, []);
	assert.deepEqual(cleanupCalls, ["cleanup"]);
});
