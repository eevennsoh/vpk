"use strict";

const { getAiSdk } = require("../lib/ai-sdk-runtime");
const {
	DEFAULT_RECOVERY_TIMEOUT_MS: DEFAULT_ROVO_PORT_RECOVERY_TIMEOUT_MS,
} = require("../lib/rovo-port-recovery");
const {
	createClarificationResponseHelpers: defaultCreateClarificationResponseHelpers,
} = require("./clarification-response");
const {
	createServerChatSdkHandler: defaultCreateServerChatSdkHandler,
} = require("./chat-sdk-handler-composition");

const CHAT_SDK_SERVER_DEFAULTS = {
	CLARIFICATION_WIDGET_TYPE: "question-card",
	CLARIFICATION_MAX_ROUNDS: 3,
	CLARIFICATION_MAX_PRESET_OPTIONS: 8,
	CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER: "Tell Rovo what to do...",
	TOOL_FIRST_GATE_SKIP_SOURCES: new Set([
		"clarification-submit",
	]),
	INTERACTIVE_CHAT_STUCK_PORT_RECOVERY_RETRY_ATTEMPTS: 1,
	INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_MAX_ATTEMPTS: 2,
	INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_TIMEOUT_MS: DEFAULT_ROVO_PORT_RECOVERY_TIMEOUT_MS,
	SMART_WIDGET_TYPE_GENUI: "genui-preview",
	SMART_WIDGET_TYPE_AUDIO: "audio-preview",
	SMART_WIDGET_TYPE_IMAGE: "image-preview",
	SMART_VOICE_INPUT_MAX_CHARS: 4000,
	SMART_IMAGE_PROMPT_MAX_CHARS: 4000,
	CLASSIFIER_JSON_BUFFER_MAX_CHARS: 320,
	GENUI_FALLBACK_ERROR_TEXT:
		"I couldn't generate an interactive card right now. Please try again later.",
};
const CHAT_SDK_HANDLER_DEPENDENCY_GROUPS = Object.freeze({
	core: Object.freeze([
		"activeRequests",
		"buildUserMessage",
		"compressUiConversationHistory",
		"createAbortControllerFromRequest",
		"resolvePreferredBackend",
		"resolveStageTraceFromRequest",
		"sendGatewayErrorResponse",
	]),
	gateway: Object.freeze([
		"buildAIGatewaySystemPrompt",
		"generatePlanMetadataViaGateway",
		"generateSmartGenuiResult",
		"generateTextViaGateway",
		"streamTextViaGateway",
	]),
	rovo: Object.freeze([
		"_pausedRovoToolCallStore",
		"createRovoUnavailableError",
		"getListeningPidsForPort",
		"refreshRovoAvailability",
		"replayViaRovo",
		"rovoCancelChat",
		"rovoHealthCheck",
		"rovoResumeToolCalls",
		"streamViaRovo",
		"syncRovoAppThreadSessionFromCurrentPort",
	]),
	deferredTools: Object.freeze([
		"clearActiveDeferredToolCall",
		"registerActiveDeferredToolCall",
		"registerPausedRovoToolCall",
		"takePausedRovoToolCall",
	]),
	rovoApp: Object.freeze([
		"buildArtifactPreviewSummary",
		"handleRovoAppArtifactToolRequest",
		"persistRovoAppBrowserScreenshotBuffer",
		"rovoAppDocumentManager",
		"rovoAppThreadManager",
		"withStudioAgentGatewayFallbackTimeout",
	]),
	conversation: Object.freeze([
		"mapUiMessagesToConversation",
	]),
});

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createChatSdkServerComposition requires ${name}`);
	}
	return value;
}

function requireNumber(name, value) {
	if (!Number.isFinite(value)) {
		throw new Error(`createChatSdkServerComposition requires ${name}`);
	}
	return value;
}

function getMissingChatSdkHandlerDependencies(dependencies = {}) {
	return Object.values(CHAT_SDK_HANDLER_DEPENDENCY_GROUPS)
		.flat()
		.filter((name) => dependencies[name] == null);
}

function validateChatSdkHandlerDependencies(dependencies = {}) {
	const missing = getMissingChatSdkHandlerDependencies(dependencies);
	if (missing.length > 0) {
		throw new Error(
			`createChatSdkHandler requires live dependencies: ${missing.join(", ")}`
		);
	}
}

function createChatSdkServerComposition({
	constants = {},
	createClarificationResponseHelpers = defaultCreateClarificationResponseHelpers,
	createServerChatSdkHandler = defaultCreateServerChatSdkHandler,
	createUIMessageStream,
	pipeUIMessageStreamToResponse,
	waitForTurnTimeoutMs,
} = {}) {
	requireNumber("waitForTurnTimeoutMs", waitForTurnTimeoutMs);

	if (!createUIMessageStream || !pipeUIMessageStreamToResponse) {
		const aiSdk = getAiSdk();
		createUIMessageStream ||= aiSdk.createUIMessageStream;
		pipeUIMessageStreamToResponse ||= aiSdk.pipeUIMessageStreamToResponse;
	}

	requireFunction("createClarificationResponseHelpers", createClarificationResponseHelpers);
	requireFunction("createServerChatSdkHandler", createServerChatSdkHandler);
	requireFunction("createUIMessageStream", createUIMessageStream);
	requireFunction("pipeUIMessageStreamToResponse", pipeUIMessageStreamToResponse);

	const resolvedConstants = {
		...CHAT_SDK_SERVER_DEFAULTS,
		...constants,
		WAIT_FOR_TURN_TIMEOUT_MS: waitForTurnTimeoutMs,
	};
	const requestUserInputQuestionMetaStore = new Map();
	const clarificationHelpers = createClarificationResponseHelpers({
		clarificationWidgetType: resolvedConstants.CLARIFICATION_WIDGET_TYPE,
		createUIMessageStream,
		pipeUIMessageStreamToResponse,
		requestUserInputQuestionMetaStore,
	});

	function createChatSdkHandler(dependencies = {}) {
		validateChatSdkHandlerDependencies(dependencies);
		return createServerChatSdkHandler({
			...resolvedConstants,
			_requestUserInputQuestionMetaStore: requestUserInputQuestionMetaStore,
			adaptClarificationAnswersForToolContract:
				clarificationHelpers.adaptClarificationAnswersForToolContract,
			getToolCallIdFromClarificationSubmission:
				clarificationHelpers.getToolCallIdFromClarificationSubmission,
			normalizeClarificationSubmission:
				clarificationHelpers.normalizeClarificationSubmission,
			streamExpiredClarificationResponse:
				clarificationHelpers.streamExpiredClarificationResponse,
			streamQuestionCardWidget:
				clarificationHelpers.streamQuestionCardWidget,
			...dependencies,
		});
	}

	return {
		constants: resolvedConstants,
		createChatSdkHandler,
		interactiveChatForcePortRecoveryMaxAttempts:
			resolvedConstants.INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_MAX_ATTEMPTS,
		interactiveChatForcePortRecoveryTimeoutMs:
			resolvedConstants.INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_TIMEOUT_MS,
		requestUserInputQuestionMetaStore,
	};
}

module.exports = {
	CHAT_SDK_HANDLER_DEPENDENCY_GROUPS,
	CHAT_SDK_SERVER_DEFAULTS,
	createChatSdkServerComposition,
	getMissingChatSdkHandlerDependencies,
	validateChatSdkHandlerDependencies,
};
