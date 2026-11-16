"use strict";

const { getNonEmptyString } = require("../lib/shared-utils");
const {
	buildToolFirstRetryInstruction,
	getToolFirstRetryDelayMs,
} = require("../lib/tool-first-genui-policy");
const {
	shouldRetryToolFirstAttempt,
} = require("../lib/tool-first-retry");
const {
	createRovoRouteWidgetPayloadDecorator,
	resolveRovoRouteToolsDetected,
} = require("./rovo-post-stream-routing-helpers");
const {
	normalizeRovoThinkingEvent,
	normalizeRovoThinkingPhase,
	normalizeRovoThinkingStatus,
	sanitizeRovoThinkingActivity,
	sanitizeRovoThinkingEvent,
	sanitizeRovoThinkingLabel,
	sanitizeRovoThinkingSource,
} = require("./rovo-thinking-normalization");
const {
	finalizeRovoPlanWidgetPostStream,
} = require("./rovo-plan-widget-post-stream");
const {
	resolveRovoChatInProgressTimeoutRecovery,
	resolveRovoPortStuckRecovery,
} = require("./rovo-recovery-decisions");

function buildRovoPreprocessingTraceData({
	backend,
	chatSdkEntryStartedAtMs,
	isStrictToolFirstTurn = false,
	now = Date.now,
	promptProfile,
	smartGenerationActive = false,
} = {}) {
	return {
		stageMs: now() - chatSdkEntryStartedAtMs,
		backend,
		promptProfile,
		smartGenerationActive,
		isStrictToolFirstTurn,
	};
}

function instrumentChatSdkWriter({ stageTrace, writer } = {}) {
	let hasMarkedFirstUiEvent = false;
	let hasMarkedFirstWrittenTextDelta = false;
	let hasMarkedTurnComplete = false;
	let hasEmittedAgentResult = false;
	const writeStreamPart = writer.write.bind(writer);

	writer.write = (part) => {
		const eventType = getNonEmptyString(part?.type) || "unknown";
		if (eventType === "data-agent-result") {
			hasEmittedAgentResult = true;
		}
		if (!hasMarkedFirstUiEvent) {
			hasMarkedFirstUiEvent = true;
			stageTrace.mark("first_chat_sdk_sse_event", {
				eventType,
			});
		}
		if (
			!hasMarkedFirstWrittenTextDelta &&
			eventType === "text-delta" &&
			typeof part?.delta === "string" &&
			part.delta.length > 0
		) {
			hasMarkedFirstWrittenTextDelta = true;
			stageTrace.mark("first_text_delta_written", {
				chars: part.delta.length,
				source: "chat-sdk-writer",
			});
		}
		if (!hasMarkedTurnComplete && eventType === "data-turn-complete") {
			hasMarkedTurnComplete = true;
			stageTrace.mark("turn_complete_written");
		}
		return writeStreamPart(part);
	};

	return {
		getHasEmittedAgentResult: () => hasEmittedAgentResult,
	};
}

function resolveRovoNonStrictPostStreamRouting({
	assistantText = "",
	browserBridge = {},
	getReadonlyBlockedWriteToolNames = () => [],
	hasEmittedGenuiWidget = false,
	hasEmittedPlanWidget = false,
	hasEmittedQuestionCard = false,
	hasObservedActionableToolCall = false,
	hasToolObservationEntries = () => false,
	isAborted = false,
	isTaskLikeRequest = false,
	logger = console,
	looksLikeClarificationResponse = () => false,
	looksLikeInabilityResponse = () => false,
	looksLikeWriteBlockedTurn = () => false,
	planExecutionActive = false,
	resolvedPlanModeActive = false,
	shouldAttemptPostToolGenui = () => false,
	shouldForceCardFirstGenui = false,
	threadId,
	toolObservationEntries = [],
} = {}) {
	const trimmedAssistantText =
		typeof assistantText === "string" ? assistantText.trim() : "";
	const hasAuthoritativeBrowserOutput =
		typeof browserBridge?.hasAuthoritativeOutput === "function" &&
		browserBridge.hasAuthoritativeOutput();
	const hasToolObservationData =
		Boolean(hasToolObservationEntries()) && !hasAuthoritativeBrowserOutput;
	const looksLikeClarification =
		Boolean(looksLikeClarificationResponse(trimmedAssistantText));
	const looksLikeInability =
		Boolean(looksLikeInabilityResponse(trimmedAssistantText));
	const readonlyBlockedWriteToolNames =
		getReadonlyBlockedWriteToolNames(toolObservationEntries);
	const looksLikeWriteBlockedFailure = Boolean(looksLikeWriteBlockedTurn({
		assistantText: trimmedAssistantText,
		toolObservationEntries,
	}));

	if (looksLikeClarification && !hasEmittedQuestionCard) {
		logger.info?.("[OUTPUT-ROUTING] Clarification-like response detected, skipping GenUI", {
			textLength: trimmedAssistantText.length,
		});
	}
	if (looksLikeInability) {
		logger.info?.("[OUTPUT-ROUTING] Inability response detected, skipping GenUI", {
			textLength: trimmedAssistantText.length,
		});
	}
	if (looksLikeWriteBlockedFailure) {
		logger.info?.("[OUTPUT-ROUTING] Write-blocked turn detected, skipping GenUI", {
			threadId,
			toolNames: readonlyBlockedWriteToolNames,
			textLength: trimmedAssistantText.length,
		});
	}

	const shouldAttemptGenui = Boolean(shouldAttemptPostToolGenui({
		assistantText: trimmedAssistantText,
		hasAuthoritativeBrowserOutput,
		hasEmittedQuestionCard,
		hasEmittedPlanWidget,
		hasEmittedGenuiWidget,
		looksLikeClarification,
		looksLikeInability: looksLikeInability || looksLikeWriteBlockedFailure,
		resolvedPlanModeActive,
		planSessionActive: planExecutionActive,
		isAborted,
		isTaskLikeRequest,
		shouldForceCardFirstGenui,
		hasObservedActionableToolCall,
		hasToolObservationData,
	}));

	return {
		hasAuthoritativeBrowserOutput,
		hasToolObservationData,
		looksLikeClarification,
		looksLikeInability,
		looksLikeWriteBlockedFailure,
		readonlyBlockedWriteToolNames,
		shouldAttemptGenui,
		shouldEmitCardFirstFallback:
			shouldForceCardFirstGenui &&
			trimmedAssistantText.length > 0 &&
			!looksLikeClarification &&
			!looksLikeInability,
		shouldEmitObservationFallback: hasToolObservationData,
		trimmedAssistantText,
	};
}

/**
 * The break that starts a new paragraph after `text`: none when nothing visible came before it or
 * it already ends a paragraph. A caller that keeps only the end of the text says whether anything
 * visible came before.
 */
function paragraphSeparatorAfter(text, hasVisibleText = text.trim().length > 0) {
	if (!hasVisibleText || text.endsWith("\n\n")) {
		return "";
	}
	return text.endsWith("\n") ? "\n" : "\n\n";
}

/** Whole blank lines at the start of `text`; the first line with text keeps its indentation. */
const LEADING_BLANK_LINES = /^(?:[ \t]*\r?\n)+/u;

function createRovoTextOutputController({
	classifierJsonBufferMaxChars = 0,
	isClassifierIntentLeakCandidate = () => false,
	parseClassifierIntentPayload = () => null,
	shouldDeferToolFirstText = false,
	splitDirectMediaTextForStreaming = (text) => ({
		pendingText: "",
		visibleText: text,
	}),
	splitSpecFenceTextForStreaming = (text) => ({
		pendingText: "",
		visibleText: text,
	}),
	stripToolFirstFailureNarrative = (text) => ({
		replaced: false,
		text,
	}),
	suppressStreamingTextForCardFirstGenui = false,
	textId,
	toolFirstFailureNarrativeEnabled = false,
	writer,
} = {}) {
	let textStarted = false;
	let assistantText = "";
	let unsuppressedAssistantText = "";
	let bufferedAssistantText = "";
	let deferredToolFirstText = "";
	let hasSuppressedLargeAssistantJson = false;
	// Set after a notice paragraph; the next text starts a new paragraph.
	let paragraphBreakPending = false;
	// Set when a rerun keeps the text already shown; its first shown text starts a new paragraph.
	// The break goes on the wire only: the rerun's own text is what the turn hands on.
	let shownParagraphBreakPending = false;
	// Whether any visible (non-whitespace) text has gone on the wire, and the last two characters
	// written. Together they tell where the next paragraph starts.
	let hasShownVisibleText = false;
	let shownTextEnd = "";
	// The rerun's leading whitespace, held until its first visible text decides the break.
	let heldWhitespace = "";

	const afterPendingParagraphBreak = (delta) => {
		if (!paragraphBreakPending) {
			return delta;
		}
		paragraphBreakPending = false;
		return delta.startsWith("\n") ? delta : `\n\n${delta}`;
	};

	const startTextIfNeeded = () => {
		if (textStarted) {
			return;
		}

		writer.write({ type: "text-start", id: textId });
		textStarted = true;
	};

	const writeShownTextDelta = (nextDelta) => {
		let delta = nextDelta;
		if (shownParagraphBreakPending) {
			if (nextDelta.trim().length === 0) {
				heldWhitespace += nextDelta;
				return;
			}
			// The rerun's leading blank lines are part of the break, not added on top of it.
			shownParagraphBreakPending = false;
			delta = `${paragraphSeparatorAfter(shownTextEnd, hasShownVisibleText)}${`${heldWhitespace}${nextDelta}`.replace(LEADING_BLANK_LINES, "")}`;
			heldWhitespace = "";
		}
		if (delta.trim().length > 0) {
			hasShownVisibleText = true;
		}
		shownTextEnd = `${shownTextEnd}${delta}`.slice(-2);
		startTextIfNeeded();
		writer.write({ type: "text-delta", id: textId, delta });
	};

	const emitTextDeltaRaw = (delta) => {
		if (!delta) {
			return;
		}

		if (shouldDeferToolFirstText) {
			deferredToolFirstText += delta;
			return;
		}
		if (suppressStreamingTextForCardFirstGenui) {
			return;
		}

		writeShownTextDelta(delta);
	};

	/** Held text split into what may be shown and what an open spec or media fence still holds back. */
	const splitHeldAssistantText = (text) => {
		const spec = splitSpecFenceTextForStreaming(text);
		const media = splitDirectMediaTextForStreaming(spec.visibleText);
		return { pendingText: `${media.pendingText}${spec.pendingText}`, visibleText: media.visibleText };
	};

	/** Drops text that was never shown from the end of the text the turn hands on. */
	const dropUnshownTail = (text) => {
		const cut = (value) => (text && value.endsWith(text) ? value.slice(0, -text.length) : value);
		assistantText = cut(assistantText);
		unsuppressedAssistantText = cut(unsuppressedAssistantText);
	};

	/**
	 * Ends the held text before a notice: what the user was meant to see goes out, and what was held
	 * back on purpose (an open fence, a classifier payload, a rerun's leading whitespace) is dropped,
	 * also from the text the turn hands on, so the notice never lands inside it.
	 */
	const releaseHeldTextBeforeNotice = () => {
		const heldText = bufferedAssistantText;
		bufferedAssistantText = "";
		if (heldText && parseClassifierIntentPayload(heldText)) {
			dropUnshownTail(heldText);
		} else if (heldText) {
			emitTextDeltaRaw(splitHeldAssistantText(heldText).visibleText);
		}
		// Streaming drops an open fence from the buffer once the text before it is written; the turn's text still has it.
		dropUnshownTail(splitHeldAssistantText(assistantText).pendingText);
		heldWhitespace = "";
	};

	const flushBufferedAssistantText = ({ force = false } = {}) => {
		if (!bufferedAssistantText) {
			return;
		}

		const { pendingText: pendingAssistantText, visibleText: visibleAssistantText } =
			splitHeldAssistantText(bufferedAssistantText);
		if (!visibleAssistantText) {
			bufferedAssistantText = force ? "" : pendingAssistantText;
			return;
		}

		if (!force && isClassifierIntentLeakCandidate(visibleAssistantText)) {
			if (visibleAssistantText.length <= classifierJsonBufferMaxChars) {
				return;
			}

			const parsedClassifierPayload =
				parseClassifierIntentPayload(visibleAssistantText);
			if (parsedClassifierPayload) {
				return;
			}
		}

		const chunk = visibleAssistantText;
		bufferedAssistantText = force ? "" : pendingAssistantText;
		emitTextDeltaRaw(chunk);
	};

	const finalizeBufferedAssistantText = () => {
		if (!bufferedAssistantText) {
			return null;
		}

		const parsedClassifierPayload =
			parseClassifierIntentPayload(bufferedAssistantText);
		if (parsedClassifierPayload) {
			bufferedAssistantText = "";
			return parsedClassifierPayload;
		}

		flushBufferedAssistantText({ force: true });
		return null;
	};

	const emitTextDelta = (nextDelta) => {
		if (!nextDelta) {
			return;
		}
		const delta = afterPendingParagraphBreak(nextDelta);

		unsuppressedAssistantText += delta;

		if (hasSuppressedLargeAssistantJson) {
			return;
		}

		assistantText += delta;
		bufferedAssistantText += delta;

		if (!isClassifierIntentLeakCandidate(bufferedAssistantText)) {
			flushBufferedAssistantText({ force: true });
			return;
		}

		if (bufferedAssistantText.length <= classifierJsonBufferMaxChars) {
			return;
		}

		const parsedClassifierPayload =
			parseClassifierIntentPayload(bufferedAssistantText);
		if (!parsedClassifierPayload) {
			flushBufferedAssistantText({ force: true });
		}
	};

	const flushDeferredToolFirstText = () => {
		if (!shouldDeferToolFirstText || deferredToolFirstText.length === 0) {
			return;
		}

		writeShownTextDelta(deferredToolFirstText);
		deferredToolFirstText = "";
	};

	const emitForcedTextDelta = (nextDelta) => {
		if (typeof nextDelta !== "string" || nextDelta.length === 0) {
			return;
		}
		const delta = afterPendingParagraphBreak(nextDelta);

		assistantText += delta;
		unsuppressedAssistantText += delta;
		bufferedAssistantText += delta;
		flushBufferedAssistantText({ force: true });
	};

	/** A notice as its own paragraph after the held text ends: a break before it after earlier text, and before any text after it. */
	const emitNoticeParagraph = (notice) => {
		const text = typeof notice === "string" ? notice.trim() : "";
		if (!text) {
			return;
		}
		releaseHeldTextBeforeNotice();
		paragraphBreakPending = false;
		emitForcedTextDelta(`${paragraphSeparatorAfter(assistantText)}${text}`);
		paragraphBreakPending = true;
	};

	const emitBufferedAssistantTextForTextRoute = () => {
		if (
			!suppressStreamingTextForCardFirstGenui ||
			textStarted ||
			assistantText.trim().length === 0
		) {
			return;
		}

		writeShownTextDelta(assistantText);
	};

	const removeToolFirstFailureNarrative = () => {
		if (!toolFirstFailureNarrativeEnabled) {
			return;
		}

		const sanitizedAssistant = stripToolFirstFailureNarrative(assistantText);
		if (sanitizedAssistant.replaced) {
			assistantText = sanitizedAssistant.text;
		}

		if (deferredToolFirstText.length > 0) {
			const sanitizedDeferred =
				stripToolFirstFailureNarrative(deferredToolFirstText);
			if (sanitizedDeferred.replaced) {
				deferredToolFirstText = sanitizedDeferred.text;
			}
		}
	};

	/**
	 * Clears the attempt's text for the next attempt. A rerun that keeps the text already shown
	 * (`continuesShownText`) starts its first shown text as a new paragraph.
	 */
	const resetAssistantTextForRetryAttempt = ({ continuesShownText = false } = {}) => {
		if (continuesShownText && hasShownVisibleText) {
			shownParagraphBreakPending = true;
		}
		// Whitespace an attempt never showed is dropped with it.
		heldWhitespace = "";
		assistantText = "";
		unsuppressedAssistantText = "";
		bufferedAssistantText = "";
		hasSuppressedLargeAssistantJson = false;
		paragraphBreakPending = false;
		if (shouldDeferToolFirstText) {
			deferredToolFirstText = "";
		}
	};

	const writeTextEndIfStarted = () => {
		if (textStarted) {
			writer.write({ type: "text-end", id: textId });
		}
	};

	return {
		emitBufferedAssistantTextForTextRoute,
		emitForcedTextDelta,
		emitNoticeParagraph,
		emitTextDelta,
		emitTextDeltaRaw,
		finalizeBufferedAssistantText,
		flushDeferredToolFirstText,
		getAssistantText: () => assistantText,
		getHasSuppressedLargeAssistantJson: () => hasSuppressedLargeAssistantJson,
		getTextStarted: () => textStarted,
		getUnsuppressedAssistantText: () => unsuppressedAssistantText,
		removeToolFirstFailureNarrative,
		resetAssistantTextForRetryAttempt,
		setAssistantText: (nextAssistantText) => {
			assistantText =
				typeof nextAssistantText === "string" ? nextAssistantText : "";
		},
		writeTextEndIfStarted,
	};
}

async function finalizeRovoDirectOutputs({
	abortSignal,
	assistantText = "",
	buildDirectSpecWidgetParts,
	detectEndpointType,
	extractDirectSpec,
	getEnvVars,
	handleDirectRovoMediaFences,
	hasEmittedGenuiWidget = false,
	hasEmittedPlanWidget = false,
	hasEmittedQuestionCard = false,
	hasSuppressedLargeAssistantJson = false,
	isPlanExecutionActive = false,
	latestUserMessage,
	logger = console,
	rawModel,
	requestOrigin,
	resolveGatewayUrl,
	resolveGoogleImageGatewayConfig,
	streamGoogleGatewayManualSse,
	stripDirectMediaFences,
	synthesizeSound,
	unsuppressedAssistantText = "",
	widgetPayloadWrapper,
	widgetTypeAudio,
	widgetTypeGenui,
	widgetTypeImage,
	writer,
} = {}) {
	if (
		hasEmittedGenuiWidget ||
		hasEmittedQuestionCard ||
		hasEmittedPlanWidget ||
		isPlanExecutionActive
	) {
		return {
			assistantText,
			emittedGenuiWidget: false,
			skipped: true,
		};
	}

	let nextAssistantText = assistantText;
	let emittedGenuiWidget = false;
	const rawDirectSpecText = hasSuppressedLargeAssistantJson
		? unsuppressedAssistantText
		: assistantText;
	const directSpecResult =
		typeof extractDirectSpec === "function"
			? extractDirectSpec(rawDirectSpecText)
			: null;

	if (directSpecResult?.spec) {
		const elementCount = Object.keys(
			directSpecResult.spec.elements || {}
		).length;
		const narrativeLength = (directSpecResult.narrative || "").length;

		if (typeof buildDirectSpecWidgetParts === "function") {
			const directSpecWidgetId = `widget-direct-spec-${Date.now()}`;
			for (const part of buildDirectSpecWidgetParts({
				latestUserMessage,
				narrative: directSpecResult.narrative,
				requestOrigin,
				spec: directSpecResult.spec,
				widgetId: directSpecWidgetId,
				widgetType: widgetTypeGenui,
			})) {
				writer.write(part);
			}
			emittedGenuiWidget = true;
			logger.info("[DIRECT-SPEC] Emitted GenUI widget from Rovo spec fence", {
				elementCount,
				narrativeLength,
			});
		}
	}

	if (typeof handleDirectRovoMediaFences === "function") {
		const directMediaResult = await handleDirectRovoMediaFences({
			abortSignal,
			assistantText: nextAssistantText,
			detectEndpointType,
			getEnvVars,
			latestUserMessage,
			rawModel,
			resolveGatewayUrl,
			resolveGoogleImageGatewayConfig,
			streamGoogleGatewayManualSse,
			stripDirectMediaFences,
			synthesizeSound,
			widgetPayloadWrapper,
			widgetTypeAudio,
			widgetTypeImage,
			writer,
		});
		nextAssistantText =
			typeof directMediaResult?.assistantText === "string"
				? directMediaResult.assistantText
				: nextAssistantText;
	}

	return {
		assistantText: nextAssistantText,
		emittedGenuiWidget,
		skipped: false,
	};
}

function resolveRovoToolFirstRetryPlan({
	abortSignal,
	currentToolFirstAttempt = 1,
	hasEmittedQuestionCard = false,
	hasObservedDeferredToolRequest = false,
	hasStructuredContinuation = false,
	hasToolFirstSuccess = false,
	toolFirstExecutionState = {},
	toolFirstPolicy = {},
	toolFirstRelevanceDomains,
	toolFirstSoftRetryEnabled = false,
	totalToolFirstAttempts = 1,
	userMessageText = "",
} = {}) {
	const canRetry = shouldRetryToolFirstAttempt({
		toolFirstSoftRetryEnabled,
		aborted: abortSignal?.aborted === true,
		hasToolFirstSuccess,
		hasEmittedQuestionCard,
		hasObservedDeferredToolRequest,
		currentToolFirstAttempt,
		totalToolFirstAttempts,
		hasStructuredContinuation,
	});
	if (!canRetry) {
		return {
			action: "stop",
		};
	}

	const retryNumber = currentToolFirstAttempt;
	const nextAttempt = currentToolFirstAttempt + 1;
	const retriesRemaining = Math.max(totalToolFirstAttempts - nextAttempt, 0);
	const retryDelayMs = getToolFirstRetryDelayMs({
		policy: toolFirstPolicy,
		retryIndex: retryNumber - 1,
	});
	const retryInstruction = buildToolFirstRetryInstruction({
		policy: toolFirstPolicy,
		attemptNumber: nextAttempt,
		remainingRetries: retriesRemaining,
		execution: toolFirstExecutionState,
	});

	return {
		action: "retry",
		activeAttemptMessage: {
			message: `${typeof userMessageText === "string" ? userMessageText : ""}\n\n${retryInstruction}`,
			enableDeepPlan: false,
		},
		logData: {
			domains: toolFirstPolicy?.domains,
			relevanceDomains: toolFirstRelevanceDomains,
			attempt: nextAttempt,
			maxAttempts: totalToolFirstAttempts,
			retryDelayMs,
			relevantToolStarts: toolFirstExecutionState?.relevantToolStarts,
			relevantToolResults: toolFirstExecutionState?.relevantToolResults,
			relevantToolErrors: toolFirstExecutionState?.relevantToolErrors,
		},
		nextAttempt,
		retriesRemaining,
		retryDelayMs,
		statusPart: {
			type: "data-thinking-status",
			data: {
				label: `Retrying integration tools (${nextAttempt}/${totalToolFirstAttempts})`,
				activity: "results",
				source: "backend",
			},
		},
	};
}

async function finalizeRovoClassifierLeakRepair({
	buildSmartGenerationGatewayOptions = () => ({}),
	emitTextDeltaRaw,
	finalizeBufferedAssistantText,
	generateTextViaGateway,
	logger = console,
	parseClassifierIntentPayload = () => null,
	provider,
	setAssistantText,
	userMessageText = "",
} = {}) {
	if (typeof finalizeBufferedAssistantText !== "function") {
		return {
			handled: false,
			leakedClassifierPayload: null,
			repairedResponseText: null,
			usedFallback: false,
		};
	}

	const leakedClassifierPayload = finalizeBufferedAssistantText();
	if (!leakedClassifierPayload) {
		return {
			handled: false,
			leakedClassifierPayload: null,
			repairedResponseText: null,
			usedFallback: false,
		};
	}

	logger.warn?.("[CHAT-SDK] Suppressed classifier-style JSON response", {
		intent: leakedClassifierPayload.intent,
		confidence: leakedClassifierPayload.confidence,
		reason: leakedClassifierPayload.reason,
	});
	let repairedResponseText = null;

	try {
		if (typeof generateTextViaGateway === "function") {
			const retryText = await generateTextViaGateway({
				system:
					"You are a helpful assistant. Respond directly to the user request in normal prose. Never output router JSON metadata such as {\"intent\":...}.",
				prompt: userMessageText,
				maxOutputTokens: 1200,
				temperature: 0.6,
				...buildSmartGenerationGatewayOptions({
					provider,
				}),
			});
			const normalizedRetryText = getNonEmptyString(retryText);
			if (
				normalizedRetryText &&
				!parseClassifierIntentPayload(normalizedRetryText)
			) {
				repairedResponseText = normalizedRetryText;
			}
		}
	} catch (retryError) {
		logger.error?.(
			"[CHAT-SDK] Failed to recover from classifier-style JSON leak:",
			retryError
		);
	}

	const usedFallback = !repairedResponseText;
	if (!repairedResponseText) {
		repairedResponseText =
			"I had an internal routing issue while generating that response. Please try again and I will answer directly.";
	}

	if (typeof setAssistantText === "function") {
		setAssistantText(repairedResponseText);
	}
	if (typeof emitTextDeltaRaw === "function") {
		emitTextDeltaRaw(repairedResponseText);
	}

	return {
		handled: true,
		leakedClassifierPayload,
		repairedResponseText,
		usedFallback,
	};
}

function finalizeRovoStudioAgentResult({
	creationMode,
	extractStudioAgentResultFromText = () => null,
	getAssistantText = () => "",
	getHasEmittedAgentResult = () => false,
	getUnsuppressedAssistantText = () => "",
	hasDeferredToolRequest = false,
	hasPlanWidget = false,
	hasQuestionCard = false,
	now = Date.now,
	rawAgentCreationAssistantText = "",
	shouldSurfaceMissingStudioAgentResultFailure = () => false,
	writer,
} = {}) {
	const shouldSurfaceMissingResult = shouldSurfaceMissingStudioAgentResultFailure({
		creationMode,
		hasAgentResult: getHasEmittedAgentResult(),
		hasDeferredToolRequest,
		hasPlanWidget,
		hasQuestionCard,
	});
	if (!shouldSurfaceMissingResult) {
		return {
			emittedAgentResult: false,
			shouldEmitMissingStudioAgentResultFailure: false,
		};
	}

	const sourceText =
		rawAgentCreationAssistantText ||
		getUnsuppressedAssistantText() ||
		getAssistantText();
	const agentResultExtraction =
		extractStudioAgentResultFromText(sourceText);
	if (agentResultExtraction?.payload) {
		writer.write({
			type: "data-agent-result",
			id: `studio-agent-result-${now()}`,
			data: agentResultExtraction.payload,
		});
		return {
			emittedAgentResult: true,
			shouldEmitMissingStudioAgentResultFailure: false,
		};
	}

	return {
		emittedAgentResult: false,
		shouldEmitMissingStudioAgentResultFailure: true,
	};
}

function emitRovoMissingStudioAgentResultFailure({
	buildMissingStudioAgentResultFailureParts = () => [],
	shouldEmitMissingStudioAgentResultFailure = false,
	writer,
} = {}) {
	if (!shouldEmitMissingStudioAgentResultFailure) {
		return {
			emitted: false,
			partCount: 0,
		};
	}

	let partCount = 0;
	for (const part of buildMissingStudioAgentResultFailureParts()) {
		writer.write(part);
		partCount += 1;
	}

	return {
		emitted: partCount > 0,
		partCount,
	};
}

function resolveRovoToolFirstFallbackCause({
	fallbackCause,
	hasRelevantToolSuccessResult = false,
	lastRelevantErrorCategory,
	routeExperience,
	teamworkGraphTimeWindowEnabled = false,
} = {}) {
	const normalizedFallbackCause =
		typeof fallbackCause === "string" && fallbackCause.trim().length > 0
			? fallbackCause
			: null;

	if (!teamworkGraphTimeWindowEnabled) {
		return normalizedFallbackCause;
	}

	if (routeExperience !== "generative_ui") {
		return normalizedFallbackCause;
	}

	if (hasRelevantToolSuccessResult) {
		return normalizedFallbackCause;
	}

	if (lastRelevantErrorCategory === "validation") {
		return "twg_datetime_validation_to_jira_cql_fallback";
	}

	if (
		normalizedFallbackCause &&
		normalizedFallbackCause.startsWith("tool_observation")
	) {
		return "twg_to_jira_cql_tool_observation_fallback";
	}

	return normalizedFallbackCause || "twg_to_jira_cql_fallback";
}

function emitRovoToolFirstRouteSummary({
	buildWorkSummaryExecutionLog,
	createRouteDecisionPart,
	hasRelevantToolSuccessResult = false,
	isWorkSummary = false,
	logger = console,
	nowMs = Date.now,
	requestOrigin,
	resolvedRovoPort,
	toolFirstExecutionState = {},
	toolFirstFallbackCause = null,
	toolFirstPolicy = {},
	toolFirstRelevanceDomains = [],
	toolFirstRouteExperience = "text",
	toolFirstRouteReason = "tool_first_no_relevant_result",
	workSummaryStartMs = null,
	writer,
} = {}) {
	const resolvedToolFirstFallbackCause =
		resolveRovoToolFirstFallbackCause({
			fallbackCause: toolFirstFallbackCause,
			hasRelevantToolSuccessResult,
			lastRelevantErrorCategory:
				toolFirstExecutionState.lastRelevantErrorCategory,
			routeExperience: toolFirstRouteExperience,
			teamworkGraphTimeWindowEnabled:
				toolFirstPolicy?.teamworkGraphTimeWindow?.enabled === true,
		});
	const routeIntent =
		toolFirstRouteExperience === "generative_ui"
			? "genui"
			: "chat";

	writer.write(createRouteDecisionPart({
		intent: routeIntent,
		origin: requestOrigin,
		reason: toolFirstRouteReason,
	}));

	logger.info?.("[TOOL-FIRST] Execution summary", {
		domains: toolFirstPolicy.domains,
		relevanceDomains: toolFirstRelevanceDomains,
		domainLabels: toolFirstPolicy.domainLabels,
		attempts: toolFirstExecutionState.attempts,
		retriesUsed: toolFirstExecutionState.retriesUsed,
		relevantToolStarts: toolFirstExecutionState.relevantToolStarts,
		relevantToolResults: toolFirstExecutionState.relevantToolResults,
		relevantToolErrors: toolFirstExecutionState.relevantToolErrors,
		hadRelevantToolStart: toolFirstExecutionState.hadRelevantToolStart,
		lastRelevantToolName: toolFirstExecutionState.lastRelevantToolName,
		lastRelevantErrorCategory:
			toolFirstExecutionState.lastRelevantErrorCategory,
		fallbackUsed: !hasRelevantToolSuccessResult,
		fallbackCause: resolvedToolFirstFallbackCause,
	});

	let workSummaryLog = null;
	if (isWorkSummary) {
		const workSummaryDurationMs =
			workSummaryStartMs != null ? nowMs() - workSummaryStartMs : null;
		workSummaryLog = buildWorkSummaryExecutionLog(
			toolFirstExecutionState,
			{
				policy: toolFirstPolicy,
				resolvedPort: typeof resolvedRovoPort === "number"
					? resolvedRovoPort
					: null,
				durationMs: workSummaryDurationMs,
			}
		);
		if (workSummaryLog) {
			logger.info?.("[work-summary] Execution log", workSummaryLog);
		}
	}

	return {
		fallbackCause: resolvedToolFirstFallbackCause,
		routeIntent,
		workSummaryLog,
	};
}

module.exports = {
	buildRovoPreprocessingTraceData,
	createRovoRouteWidgetPayloadDecorator,
	createRovoTextOutputController,
	emitRovoToolFirstRouteSummary,
	emitRovoMissingStudioAgentResultFailure,
	finalizeRovoPlanWidgetPostStream,
	finalizeRovoClassifierLeakRepair,
	finalizeRovoDirectOutputs,
	finalizeRovoStudioAgentResult,
	instrumentChatSdkWriter,
	normalizeRovoThinkingPhase,
	normalizeRovoThinkingEvent,
	normalizeRovoThinkingStatus,
	resolveRovoNonStrictPostStreamRouting,
	resolveRovoRouteToolsDetected,
	resolveRovoChatInProgressTimeoutRecovery,
	resolveRovoPortStuckRecovery,
	resolveRovoToolFirstFallbackCause,
	resolveRovoToolFirstRetryPlan,
	sanitizeRovoThinkingActivity,
	sanitizeRovoThinkingEvent,
	sanitizeRovoThinkingLabel,
	sanitizeRovoThinkingSource,
};
