"use strict";

const {
	assessPromptComplexityForPlanMode: defaultAssessPromptComplexityForPlanMode,
} = require("./plan-mode-complexity-heuristic");
const {
	ROUTING_CLASSIFIER_TIMEOUT_MS,
	resolveRoutingDecision: defaultResolveRoutingDecision,
} = require("./resolve-routing-decision");
const {
	buildRouteDecisionResolvedTraceData: defaultBuildRouteDecisionResolvedTraceData,
	resolveManagedRunDeterministicRouteDecision: defaultResolveManagedRunDeterministicRouteDecision,
} = require("../chat/route-decision");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppManagedRunRouteResolver requires ${name}`);
	}
	return value;
}

function createRovoAppManagedRunRouteResolver({
	assessPromptComplexityForPlanMode = defaultAssessPromptComplexityForPlanMode,
	buildRouteDecisionResolvedTraceData = defaultBuildRouteDecisionResolvedTraceData,
	generateTextViaGateway,
	logger = console,
	now = () => Date.now(),
	resolveManagedRunDeterministicRouteDecision = defaultResolveManagedRunDeterministicRouteDecision,
	resolveRoutingDecision = defaultResolveRoutingDecision,
} = {}) {
	requireFunction("assessPromptComplexityForPlanMode", assessPromptComplexityForPlanMode);
	requireFunction("buildRouteDecisionResolvedTraceData", buildRouteDecisionResolvedTraceData);
	requireFunction("generateTextViaGateway", generateTextViaGateway);
	requireFunction("logger.info", logger?.info);
	requireFunction("now", now);
	requireFunction("resolveManagedRunDeterministicRouteDecision", resolveManagedRunDeterministicRouteDecision);
	requireFunction("resolveRoutingDecision", resolveRoutingDecision);

	async function resolveRovoAppManagedRunRoute({
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
	}) {
		const routeDecisionStartedAtMs = now();
		let autoPlanTriggered = false;
		if (!requestIsPlanMode && latestUserMessage) {
			const complexity = assessPromptComplexityForPlanMode(latestUserMessage);
			if (complexity.shouldPlan) {
				autoPlanTriggered = true;
				logger.info("[FUTURE-CHAT] Auto-plan heuristic triggered", {
					score: complexity.score,
					reasons: complexity.reasons,
				});
				stageTrace.mark("auto_plan_triggered", {
					score: complexity.score,
					reasons: complexity.reasons.join(","),
				});
				logger.info("[FUTURE-CHAT] Auto-plan: enabling local deep-plan request");
			}
		}

		let routingDecision = resolveManagedRunDeterministicRouteDecision({
			activeArtifact,
			autoPlanTriggered,
			requestArtifactCreationRetry,
			requestCreationMode,
			requestIsPlanMode,
			requestOrigin,
			workItemReportRequest,
		});
		if (routingDecision) {
			stageTrace.mark(
				"route_decision_resolved",
				buildRouteDecisionResolvedTraceData({
					routingDecision,
					stageMs: 0,
				})
			);
		} else {
			try {
				routingDecision = await resolveRoutingDecision(
					{
						prompt: latestUserMessage,
						origin: requestOrigin,
						activeArtifact: activeArtifact || undefined,
						creationMode: requestCreationMode,
						voiceMetadata: requestVoiceMetadata,
						recentHistory,
						threadId,
						provider: resolvedProvider,
						signal,
					},
					{
						classify: ({ system, prompt, signal: classifySignal }) =>
							generateTextViaGateway({
								system,
								prompt,
								maxOutputTokens: 220,
								temperature: 0.1,
								provider: resolvedProvider,
								signal: classifySignal,
								backendPreference: "ai-gateway",
							}),
						timeoutMs: ROUTING_CLASSIFIER_TIMEOUT_MS,
					},
				);
			} catch {
				routingDecision = {
					intent: "chat",
					presentation: "text",
					confidence: 0,
					reason: "classifier_error",
					origin: requestOrigin,
				};
			}
			stageTrace.mark(
				"route_decision_resolved",
				buildRouteDecisionResolvedTraceData({
					routingDecision,
					stageMs: now() - routeDecisionStartedAtMs,
				})
			);
		}

		return {
			autoPlanTriggered,
			routingDecision,
		};
	}

	return {
		resolveRovoAppManagedRunRoute,
	};
}

module.exports = {
	createRovoAppManagedRunRouteResolver,
};
