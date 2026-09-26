"use strict";

const {
	finalizeRovoClassifierLeakRepair: defaultFinalizeRovoClassifierLeakRepair,
	finalizeRovoDirectOutputs: defaultFinalizeRovoDirectOutputs,
	finalizeRovoPlanWidgetPostStream: defaultFinalizeRovoPlanWidgetPostStream,
	finalizeRovoStudioAgentResult: defaultFinalizeRovoStudioAgentResult,
} = require("./rovo-stream");

async function runRovoPostStreamFinalizers({
	abortSignal,
	assistantText,
	buildDirectSpecWidgetParts,
	buildSmartGenerationGatewayOptions,
	creationMode,
	detectEndpointType,
	emitPlanWidgetLoading,
	emitTextDeltaRaw,
	emitWidgetError,
	extractDirectSpec,
	extractStudioAgentResultFromText,
	finalizeBufferedAssistantText,
	finalizeRovoClassifierLeakRepair = defaultFinalizeRovoClassifierLeakRepair,
	finalizeRovoDirectOutputs = defaultFinalizeRovoDirectOutputs,
	finalizeRovoPlanWidgetPostStream = defaultFinalizeRovoPlanWidgetPostStream,
	finalizeRovoStudioAgentResult = defaultFinalizeRovoStudioAgentResult,
	generateTextViaGateway,
	genuiHint,
	getAssistantText,
	getEnvVars,
	getHasEmittedAgentResult,
	getHasSuppressedLargeAssistantJson,
	getUnsuppressedAssistantText,
	handleDirectRovoMediaFences,
	hasDeferredToolRequest = false,
	hasEmittedGenuiWidget = false,
	hasEmittedPlanLoadingState = false,
	hasEmittedPlanWidget = false,
	hasEmittedQuestionCard = false,
	hasExplicitPlanPayload = false,
	hasSeenPlanWidgetSignal = false,
	isPlanExecutionActive = false,
	latestUserMessage,
	logger = console,
	parseClassifierIntentPayload,
	provider,
	rawAgentCreationAssistantText = "",
	rawModel,
	requestOrigin,
	resolveGatewayUrl,
	resolveGoogleImageGatewayConfig,
	setAssistantText,
	shouldSurfaceMissingStudioAgentResultFailure,
	streamGoogleGatewayManualSse,
	stripDirectMediaFences,
	synthesizeSound,
	unsuppressedAssistantText,
	userMessageText,
	widgetPayloadWrapper,
	widgetTypeAudio,
	widgetTypeGenui,
	widgetTypeImage,
	writer,
	writeTextEndIfStarted,
} = {}) {
	await finalizeRovoClassifierLeakRepair({
		buildSmartGenerationGatewayOptions,
		emitTextDeltaRaw,
		finalizeBufferedAssistantText,
		generateTextViaGateway,
		logger,
		parseClassifierIntentPayload,
		provider,
		setAssistantText,
		userMessageText,
	});

	if (abortSignal?.aborted) {
		writeTextEndIfStarted?.();
		return {
			aborted: true,
			hasEmittedGenuiWidget,
			shouldEmitMissingStudioAgentResultFailure: false,
		};
	}

	const studioAgentResult = finalizeRovoStudioAgentResult({
		creationMode,
		extractStudioAgentResultFromText,
		getAssistantText,
		getHasEmittedAgentResult,
		getUnsuppressedAssistantText,
		hasDeferredToolRequest,
		hasPlanWidget: hasEmittedPlanWidget,
		hasQuestionCard: hasEmittedQuestionCard,
		rawAgentCreationAssistantText,
		shouldSurfaceMissingStudioAgentResultFailure,
		writer,
	});

	const directOutputResult = await finalizeRovoDirectOutputs({
		abortSignal,
		assistantText,
		buildDirectSpecWidgetParts,
		detectEndpointType,
		extractDirectSpec,
		genuiHint,
		getEnvVars,
		handleDirectRovoMediaFences,
		hasEmittedGenuiWidget,
		hasEmittedPlanWidget,
		hasEmittedQuestionCard,
		hasSuppressedLargeAssistantJson: getHasSuppressedLargeAssistantJson(),
		isPlanExecutionActive,
		latestUserMessage,
		logger,
		rawModel,
		requestOrigin,
		resolveGatewayUrl,
		resolveGoogleImageGatewayConfig,
		streamGoogleGatewayManualSse,
		stripDirectMediaFences,
		synthesizeSound,
		unsuppressedAssistantText,
		widgetPayloadWrapper,
		widgetTypeAudio,
		widgetTypeGenui,
		widgetTypeImage,
		writer,
	});
	const nextHasEmittedGenuiWidget =
		hasEmittedGenuiWidget || Boolean(directOutputResult.emittedGenuiWidget);
	setAssistantText(directOutputResult.assistantText);

	const planWidgetResult = finalizeRovoPlanWidgetPostStream({
		emitPlanWidgetLoading,
		emitWidgetError,
		hasEmittedPlanLoadingState,
		hasEmittedPlanWidget,
		hasExplicitPlanPayload,
		hasSeenPlanWidgetSignal,
	});

	return {
		aborted: false,
		directOutputResult,
		hasEmittedGenuiWidget: nextHasEmittedGenuiWidget,
		planWidgetResult,
		shouldEmitMissingStudioAgentResultFailure:
			studioAgentResult.shouldEmitMissingStudioAgentResultFailure,
		studioAgentResult,
	};
}

module.exports = {
	runRovoPostStreamFinalizers,
};
