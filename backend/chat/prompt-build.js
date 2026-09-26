"use strict";

const DEFAULT_PROMPT_HISTORY_COMPRESSION_OPTIONS = {
	thresholdChars: 80_000,
	tailCount: 8,
};

function joinContextBlocks(blocks) {
	return blocks
		.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
		.join("\n\n");
}

function getUtf8ByteLength(value) {
	return typeof value === "string" && value.length > 0
		? Buffer.byteLength(value, "utf8")
		: 0;
}

function resolvePausedContinuationToolCallId({
	approvalToolCallId,
	clarificationToolCallId,
	hasPausedApprovalToolCall = false,
	hasPausedClarificationToolCall = false,
} = {}) {
	if (hasPausedClarificationToolCall) {
		return clarificationToolCallId;
	}

	if (hasPausedApprovalToolCall) {
		return approvalToolCallId;
	}

	return null;
}

function resolveChatSdkPromptBuildInputs({
	approvalSubmission,
	approvalToolCallId,
	buildGoogleCalendarDateContext,
	clarificationSubmission,
	clarificationToolCallId,
	clientTimeZone,
	enrichedContextDescription,
	hasPausedApprovalToolCall = false,
	hasPausedClarificationToolCall = false,
	isSmartGenerationEnabled,
	isStrictToolFirstTurn = false,
	normalizeSmartGenerationOptions,
	promptIntent = {},
	rawSmartGeneration,
	toolFirstClarificationInstruction,
	toolFirstPolicy = {},
} = {}) {
	const pausedContinuationToolCallId = resolvePausedContinuationToolCallId({
		approvalToolCallId,
		clarificationToolCallId,
		hasPausedApprovalToolCall,
		hasPausedClarificationToolCall,
	});

	const googleCalendarDateContext =
		isStrictToolFirstTurn &&
		Array.isArray(toolFirstPolicy.domains) &&
		toolFirstPolicy.domains.includes("google-calendar")
			? buildGoogleCalendarDateContext(clientTimeZone)
			: null;
	const toolFirstPromptInstruction = isStrictToolFirstTurn
		? joinContextBlocks([
				toolFirstPolicy.instruction,
				toolFirstClarificationInstruction,
				googleCalendarDateContext,
			]) || null
		: null;
	const effectiveContextDescription = isStrictToolFirstTurn
		? enrichedContextDescription
			? joinContextBlocks([
					enrichedContextDescription,
					toolFirstPromptInstruction,
				])
			: toolFirstPromptInstruction
		: enrichedContextDescription;
	const effectiveContextWithPortBinding = effectiveContextDescription;
	const smartGeneration = normalizeSmartGenerationOptions(rawSmartGeneration);
	const smartLayoutContext = {
		surface: smartGeneration.surface,
		containerWidthPx: smartGeneration.containerWidthPx,
		viewportWidthPx: smartGeneration.viewportWidthPx,
		widthClass: smartGeneration.widthClass,
	};
	const smartGenerationActive = isSmartGenerationEnabled(smartGeneration);
	const promptProfile =
		promptIntent.isConversational &&
		!isStrictToolFirstTurn &&
		!smartGenerationActive &&
		!clarificationSubmission &&
		!approvalSubmission
			? "plain-chat"
			: "default";

	return {
		effectiveContextDescription,
		effectiveContextWithPortBinding,
		googleCalendarDateContext,
		pausedContinuationToolCallId,
		promptProfile,
		smartGeneration,
		smartGenerationActive,
		smartLayoutContext,
		toolFirstPromptInstruction,
	};
}

function buildChatSdkPrompt({
	buildUserMessage,
	compressionOptions = DEFAULT_PROMPT_HISTORY_COMPRESSION_OPTIONS,
	compressConversationHistory,
	conversationHistory,
	effectiveContextWithPortBinding,
	latestUserMessage,
	logger = console,
	now = Date.now,
	promptProfile,
} = {}) {
	const compressedPromptHistory = compressConversationHistory(
		conversationHistory,
		compressionOptions,
	);
	if (compressedPromptHistory.compressed) {
		logger.info(
			`[CHAT] Compressed prompt conversation history: ${compressedPromptHistory.originalLength} → ${compressedPromptHistory.length} messages`,
		);
	}

	const promptBuildStartedAtMs = now();
	const userMessageText = buildUserMessage(
		latestUserMessage,
		compressedPromptHistory.conversationHistory,
		effectiveContextWithPortBinding,
		{
			profile: promptProfile,
		},
	);
	const promptBuiltTraceData = {
		stageMs: now() - promptBuildStartedAtMs,
		promptProfile,
		promptChars: userMessageText.length,
		promptBytes: getUtf8ByteLength(userMessageText),
		conversationHistoryCount: compressedPromptHistory.conversationHistory.length,
		contextChars: effectiveContextWithPortBinding?.length ?? 0,
	};

	return {
		compressedPromptHistory,
		promptBuiltTraceData,
		userMessageText,
	};
}

module.exports = {
	buildChatSdkPrompt,
	joinContextBlocks,
	resolveChatSdkPromptBuildInputs,
	resolvePausedContinuationToolCallId,
};
