"use strict";

const {
	resolveRovoAppTurnBackendPreference: defaultResolveRovoAppTurnBackendPreference,
} = require("../chat/route-decision");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppManagedRunArtifactRouter requires ${name}`);
	}
	return value;
}

function isArtifactRoutingDecision(routingDecision) {
	return routingDecision?.intent === "artifact_create" || routingDecision?.intent === "artifact_update";
}

function createRovoAppManagedRunArtifactRouter({
	consumeRovoAppManagedResponse,
	handleRovoAppArtifactToolRequest,
	isRovoAvailable,
	persistRovoAppRunBackend,
	resolveRovoAppTurnBackendPreference = defaultResolveRovoAppTurnBackendPreference,
} = {}) {
	requireFunction("consumeRovoAppManagedResponse", consumeRovoAppManagedResponse);
	requireFunction("handleRovoAppArtifactToolRequest", handleRovoAppArtifactToolRequest);
	requireFunction("isRovoAvailable", isRovoAvailable);
	requireFunction("persistRovoAppRunBackend", persistRovoAppRunBackend);
	requireFunction("resolveRovoAppTurnBackendPreference", resolveRovoAppTurnBackendPreference);

	async function handleRovoAppManagedRunArtifactRoute({
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
	}) {
		if (!isArtifactRoutingDecision(routingDecision)) {
			return false;
		}

		const artifactBackendPreference =
			workItemReportRequest.artifactBackendPreference ||
			(await resolveRovoAppTurnBackendPreference({
				isPlanModeActive: requestIsPlanMode || autoPlanTriggered,
				isRovoAvailable,
				requestBody,
				routingDecision,
			}));
		await persistRovoAppRunBackend(threadId, artifactBackendPreference, { run });

		const handled = await handleRovoAppArtifactToolRequest({
			activeArtifact,
			activeDocument,
			artifactSteering,
			artifactBackendPreference,
			contextDescription: effectiveBaseContextDescription || null,
			requestOrigin,
			requestBody,
			signal,
			streamingArtifact,
			threadId,
		});
		if (handled?.handled && handled.response) {
			stageTrace.mark("artifact_route_handled", {
				intent: routingDecision.intent,
				threadId,
			});
			await consumeRovoAppManagedResponse({
				initialMessages: requestMessages,
				response: handled.response,
				run,
				stageTrace,
				threadId,
			});
			return true;
		}

		return false;
	}

	return {
		handleRovoAppManagedRunArtifactRoute,
	};
}

module.exports = {
	createRovoAppManagedRunArtifactRouter,
	isArtifactRoutingDecision,
};
