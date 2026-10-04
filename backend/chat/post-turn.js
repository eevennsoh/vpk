"use strict";

const {
	areAllPlanTasksCompleted,
	extractAppRoutesFromObservations,
} = require("../lib/app-route-resolver");

function resolvePlanExecutionCompletion({
	isPlanExecutionPhase,
	threadId,
	toolObservationEntries,
} = {}) {
	const active = Boolean(threadId && isPlanExecutionPhase(threadId));
	if (!active) {
		return {
			active: false,
			allTasksDone: false,
			appRoute: null,
			appRoutes: [],
			shouldCreateArtifact: false,
			shouldFinalizePlan: false,
		};
	}

	const allTasksDone = areAllPlanTasksCompleted(toolObservationEntries);
	if (!allTasksDone) {
		return {
			active: true,
			allTasksDone: false,
			appRoute: null,
			appRoutes: [],
			shouldCreateArtifact: false,
			shouldFinalizePlan: false,
		};
	}

	const appRoutes = extractAppRoutesFromObservations(toolObservationEntries);
	const appRoute = appRoutes.length > 0 ? appRoutes[0] : null;
	return {
		active: true,
		allTasksDone: true,
		appRoute,
		appRoutes,
		shouldCreateArtifact: Boolean(appRoute),
		shouldFinalizePlan: true,
	};
}

function buildTurnCompletePart({ now = () => new Date() } = {}) {
	return {
		type: "data-turn-complete",
		data: { timestamp: now().toISOString() },
	};
}

function buildPostTurnWorkCompleteTraceData({ hasQueuedPrompts = false } = {}) {
	return {
		suggestionsDeferred: true,
		hasQueuedPrompts,
	};
}

function noop() {}

async function finalizePlanExecutionArtifactPostStream({
	buildArtifactPreviewSummary,
	clearPlanSession,
	createRouteDecisionPart,
	derivePlanExecutionArtifactTitle,
	generatePlanMetadataViaGateway,
	getLatestPlanWidgetMetadata,
	isPlanExecutionPhase,
	logger = console,
	nowMs = Date.now,
	requestOrigin,
	resolvePlanExecutionCompletionFn = resolvePlanExecutionCompletion,
	rovoAppDocumentManager,
	rovoAppThreadManager,
	syncedThread = null,
	threadId,
	toolObservationEntries = [],
	writer,
} = {}) {
	const planExecutionCompletion = resolvePlanExecutionCompletionFn({
		isPlanExecutionPhase,
		threadId,
		toolObservationEntries,
	});
	if (!planExecutionCompletion.shouldFinalizePlan || !threadId) {
		return {
			appRoute: planExecutionCompletion.appRoute ?? null,
			appRoutes: planExecutionCompletion.appRoutes ?? [],
			artifactCreated: false,
			documentId: null,
			finalized: false,
		};
	}

	const {
		appRoute,
		appRoutes,
		shouldCreateArtifact,
	} = planExecutionCompletion;
	logger.info?.("[PLAN-EXECUTION] All tasks completed, generating artifact", {
		threadId,
		appRoute,
		routeCandidates: appRoutes,
	});

	let artifactCreated = false;
	let documentId = null;
	if (shouldCreateArtifact && appRoute) {
		try {
			const currentThread =
				syncedThread ?? await rovoAppThreadManager.getThread(threadId);
			const latestPlanWidget =
				currentThread
					? getLatestPlanWidgetMetadata(currentThread.messages)
					: null;
			const artifactTitle = derivePlanExecutionArtifactTitle({
				appRoute,
				planTitle: latestPlanWidget?.title,
			});
			let artifactPreviewSummary =
				latestPlanWidget?.shortDescription ?? "";

			if (!artifactPreviewSummary) {
				try {
					const enrichedPlanMetadata =
						await generatePlanMetadataViaGateway({
							title: latestPlanWidget?.title ?? artifactTitle,
							description: latestPlanWidget?.description ?? undefined,
							tasks: latestPlanWidget?.tasks ?? [],
						});
					artifactPreviewSummary =
						enrichedPlanMetadata.shortDescription || "";
				} catch (metadataError) {
					logger.warn?.(
						"[PLAN-EXECUTION] Failed to generate artifact preview summary:",
						metadataError,
					);
				}
			}

			if (!artifactPreviewSummary) {
				artifactPreviewSummary = buildArtifactPreviewSummary(artifactTitle);
			}

			const artifactDocument = await rovoAppDocumentManager.createDocument({
				threadId,
				title: artifactTitle,
				kind: "react",
				content: appRoute,
				previewSummary: artifactPreviewSummary,
				changeLabel: "Plan execution complete",
				sourceMessageId: null,
			});
			await rovoAppThreadManager.updateThread(threadId, {
				activeDocumentId: artifactDocument.id,
			});

			writer.write({
				type: "data-artifact-result",
				data: {
					documentId: artifactDocument.id,
					threadId: artifactDocument.threadId,
					title: artifactDocument.title,
					kind: "react",
					action: "create",
				},
			});

			const summaryTextId = `plan-exec-artifact-${nowMs()}`;
			writer.write({ type: "text-start", id: summaryTextId });
			writer.write({
				type: "text-delta",
				id: summaryTextId,
				delta: `Your app is ready — open **${artifactTitle}** to see it live.`,
			});
			writer.write({ type: "text-end", id: summaryTextId });

			writer.write(createRouteDecisionPart({
				intent: "artifact_create",
				origin: requestOrigin,
				reason: "plan_execution_complete",
			}));

			artifactCreated = true;
			documentId = artifactDocument.id;
			logger.info?.("[PLAN-EXECUTION] Artifact created", {
				documentId: artifactDocument.id,
				route: appRoute,
				title: artifactTitle,
			});
		} catch (artifactError) {
			logger.warn?.(
				"[PLAN-EXECUTION] Failed to create artifact document:",
				artifactError,
			);
		}
	}

	clearPlanSession(threadId);
	logger.info?.("[PLAN-EXECUTION] Plan session cleared after execution complete", { threadId });

	return {
		appRoute,
		appRoutes,
		artifactCreated,
		documentId,
		finalized: true,
	};
}

async function completeRovoPostTurn({
	buildArtifactPreviewSummary,
	buildMissingStudioAgentResultFailureParts,
	buildPostTurnWorkCompleteTraceData: buildPostTurnTraceData =
		buildPostTurnWorkCompleteTraceData,
	buildRovoTurnRoutingTelemetry,
	buildTurnCompletePart: buildCompletePart = buildTurnCompletePart,
	clearPlanSession,
	closePendingQuestionCardLoading = noop,
	createRouteDecisionPart,
	derivePlanExecutionArtifactTitle,
	emitRovoMissingStudioAgentResultFailure,
	finalizePlanExecutionArtifactPostStreamFn =
		finalizePlanExecutionArtifactPostStream,
	flushDeferredToolFirstText = noop,
	generatePlanMetadataViaGateway,
	getAssistantText,
	getLatestPlanWidgetMetadata,
	getRouteToolsDetected,
	hasEmittedGenuiWidget = false,
	hasEmittedPlanWidget = false,
	hasEmittedQuestionCard = false,
	hasObservedActionableToolCall = false,
	hasObservedToolExecution = false,
	hasQueuedPrompts = false,
	isPlanExecutionPhase,
	isPostClarificationTurn = false,
	isStrictToolFirstTurn = false,
	logger = console,
	requestOrigin,
	resolvePlanExecutionCompletionFn = resolvePlanExecutionCompletion,
	resolvedRovoPort,
	rovoAppDocumentManager,
	rovoAppThreadManager,
	sessionMode,
	shouldEmitMissingStudioAgentResultFailure = false,
	stageTrace,
	syncRovoAppThreadSessionFromCurrentPort,
	threadId,
	toolObservationEntries = [],
	writeTextEndIfStarted = noop,
	writer,
} = {}) {
	flushDeferredToolFirstText();
	writeTextEndIfStarted();

	emitRovoMissingStudioAgentResultFailure({
		buildMissingStudioAgentResultFailureParts,
		shouldEmitMissingStudioAgentResultFailure,
		writer,
	});

	closePendingQuestionCardLoading();

	let syncedThread = null;
	if (threadId && typeof resolvedRovoPort === "number" && resolvedRovoPort > 0) {
		try {
			syncedThread = await syncRovoAppThreadSessionFromCurrentPort(
				threadId,
				resolvedRovoPort,
				{ sessionMode },
			);
		} catch (error) {
			logger.warn?.("[FUTURE-CHAT] Failed to sync thread session at turn completion:", {
				threadId,
				port: resolvedRovoPort,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	const routingTelemetry = buildRovoTurnRoutingTelemetry({
		assistantText: getAssistantText(),
		hasEmittedGenuiWidget,
		hasEmittedPlanWidget,
		hasEmittedQuestionCard,
		hasObservedActionableToolCall,
		hasObservedToolExecution,
		isPostClarificationTurn,
		isStrictToolFirstTurn,
		routeToolsDetected: getRouteToolsDetected(),
	});
	logger.info?.("[OUTPUT-ROUTING] Turn routing summary", routingTelemetry);

	const planExecutionArtifactResult =
		await finalizePlanExecutionArtifactPostStreamFn({
			buildArtifactPreviewSummary,
			clearPlanSession,
			createRouteDecisionPart,
			derivePlanExecutionArtifactTitle,
			generatePlanMetadataViaGateway,
			getLatestPlanWidgetMetadata,
			isPlanExecutionPhase,
			logger,
			requestOrigin,
			resolvePlanExecutionCompletionFn,
			rovoAppDocumentManager,
			rovoAppThreadManager,
			syncedThread,
			threadId,
			toolObservationEntries,
			writer,
		});

	writer.write(buildCompletePart());
	stageTrace.mark(
		"post_turn_work_complete",
		buildPostTurnTraceData({ hasQueuedPrompts }),
	);

	return {
		planExecutionArtifactResult,
		routingTelemetry,
		syncedThread,
	};
}

module.exports = {
	completeRovoPostTurn,
	finalizePlanExecutionArtifactPostStream,
	buildPostTurnWorkCompleteTraceData,
	buildTurnCompletePart,
	resolvePlanExecutionCompletion,
};
