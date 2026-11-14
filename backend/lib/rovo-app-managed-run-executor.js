"use strict";

const { getNonEmptyString } = require("./shared-utils");
const {
	createStageTrace: defaultCreateStageTrace,
} = require("./stage-trace");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppManagedRunExecutor requires ${name}`);
	}
	return value;
}

function createRovoAppManagedRunExecutor({
	completeRovoAppManagedRunResponse,
	createStageTrace = defaultCreateStageTrace,
	dispatchRovoAppManagedRunChat,
	handleRovoAppManagedRunArtifactRoute,
	logger = console,
	prepareRovoAppManagedRunRequest,
	resolveRovoAppManagedRunRoute,
} = {}) {
	requireFunction("completeRovoAppManagedRunResponse", completeRovoAppManagedRunResponse);
	requireFunction("createStageTrace", createStageTrace);
	requireFunction("dispatchRovoAppManagedRunChat", dispatchRovoAppManagedRunChat);
	requireFunction("handleRovoAppManagedRunArtifactRoute", handleRovoAppManagedRunArtifactRoute);
	requireFunction("prepareRovoAppManagedRunRequest", prepareRovoAppManagedRunRequest);
	requireFunction("resolveRovoAppManagedRunRoute", resolveRovoAppManagedRunRoute);

	async function executeRovoAppManagedRun(run) {
		const requestBody =
			run.requestBody && typeof run.requestBody === "object"
				? { ...run.requestBody }
				: {};
		const requestOriginHint = getNonEmptyString(requestBody.origin) || "text";
		const stageTrace = createStageTrace({
			scope: "rovo-app-run",
			logger,
			baseMeta: {
				path: "/api/rovo/chat",
				origin: requestOriginHint,
				threadId: run.threadId,
				runId: run.id,
			},
		});
		stageTrace.mark("entry", {
			messageCount: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0,
			hasDelegatedMessageId: Boolean(getNonEmptyString(requestBody.delegatedMessageId)),
			hasActiveArtifact: Boolean(requestBody.activeArtifact?.id),
		});

		const signal = run.abortController.signal;
		const {
			activeArtifact,
			activeDocument,
			artifactSteering,
			effectiveBaseContextDescription,
			latestUserMessage,
			recentHistory,
			requestArtifactCreationRetry,
			requestCreationMode,
			requestIsPlanMode,
			requestMessages,
			requestOrigin,
			requestVoiceMetadata,
			resolvedProvider,
			streamingArtifact,
			threadId,
			workItemReportRequest,
		} = await prepareRovoAppManagedRunRequest({
			requestBody,
			requestOriginHint,
		});

		const {
			autoPlanTriggered,
			routingDecision,
		} = await resolveRovoAppManagedRunRoute({
			activeArtifact,
			latestUserMessage,
			recentHistory,
			requestArtifactCreationRetry,
			requestCreationMode,
			requestIsPlanMode,
			requestOrigin,
			requestVoiceMetadata,
			resolvedProvider,
			signal,
			stageTrace,
			threadId,
			workItemReportRequest,
		});

		const artifactRouteHandled = await handleRovoAppManagedRunArtifactRoute({
			activeArtifact,
			activeDocument,
			artifactSteering,
			autoPlanTriggered,
			effectiveBaseContextDescription,
			requestBody,
			requestIsPlanMode,
			requestMessages,
			requestOrigin,
			routingDecision,
			run,
			signal,
			stageTrace,
			streamingArtifact,
			threadId,
			workItemReportRequest,
		});
		if (artifactRouteHandled) {
			return;
		}

		const response = await dispatchRovoAppManagedRunChat({
			activeArtifact,
			autoPlanTriggered,
			effectiveBaseContextDescription,
			requestBody,
			requestIsPlanMode,
			routingDecision,
			run,
			signal,
			stageTrace,
			threadId,
		});

		await completeRovoAppManagedRunResponse({
			requestMessages,
			response,
			routingDecision,
			run,
			stageTrace,
			threadId,
		});
	}

	return {
		executeRovoAppManagedRun,
	};
}

module.exports = {
	createRovoAppManagedRunExecutor,
};
