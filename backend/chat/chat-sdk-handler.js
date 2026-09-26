"use strict";

const {
	createExitPlanWidgetEmitter,
} = require("./exit-plan-widget");
const {
	handleLocalModelTurn,
} = require("./local-model-turn");
const {
	createRequestUserInputQuestionCardEmitter,
} = require("./request-user-input-question-card");
const {
	createRovoStreamAttemptErrorHandler,
} = require("./rovo-stream-attempt");
const {
	createRovoStreamAttemptRunner,
} = require("./rovo-stream-attempt-orchestrator");
const {
	buildRovoInitialActiveAttemptMessage,
	resolveRovoToolFirstRetryLimit,
	runRovoStreamRetryLoopWithToolFirstPlanning,
} = require("./rovo-stream-loop");
const {
	createRovoBrowserToolEventRouter,
} = require("./rovo-browser-tool-events");
const {
	createRovoStreamTextDeltaHandler,
} = require("./rovo-stream-text-delta");
const {
	createLazyRovoThinkingStatusEmitter,
} = require("./rovo-thinking-events");
const {
	runRovoPostStreamPipeline,
} = require("./rovo-post-stream-pipeline");
const {
	createToolObservationRecorder,
} = require("./tool-observation-context");
const {
	streamSmartGenerationRoute,
} = require("./smart-generation-stream");
const {
	streamMediaBypassRoute,
} = require("./media-bypass-stream");
const {
	handleMediaContextClarificationRoute,
} = require("./media-context-clarification-route");
const {
	streamGoogleDirectImageRoute,
} = require("./google-direct-stream");
const {
	streamRovoChatRoute,
} = require("./rovo-chat-stream");
const {
	streamAIGatewayChatRoute,
} = require("./gateway-stream");
const {
	handleWorkItemReportRoute,
} = require("./work-item-report-route");

function createChatSdkHandler(dependencies = {}) {
	const {
		CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
		CLARIFICATION_MAX_LABEL_LENGTH,
		CLARIFICATION_MAX_PRESET_OPTIONS,
		CLARIFICATION_MAX_ROUNDS,
		CLARIFICATION_WIDGET_TYPE,
		FALLBACK_AGENT_CREATION_QUESTION_INPUT,
		GENUI_FALLBACK_ERROR_TEXT,
		SMART_IMAGE_PROMPT_MAX_CHARS,
		SMART_ROUTE_TARGET_SURFACES,
		SMART_VOICE_INPUT_MAX_CHARS,
		SMART_WIDGET_TYPE_AUDIO,
		SMART_WIDGET_TYPE_GENUI,
		SMART_WIDGET_TYPE_IMAGE,
		STAGE_TRACE_ID_HEADER,
		STUDIO_AGENT_GATEWAY_FALLBACK_TIMEOUT_MS,
		TOOL_FIRST_GATE_SKIP_SOURCES,
		WAIT_FOR_TURN_TIMEOUT_MS,
		_pausedRovoToolCallStore,
		_requestUserInputQuestionMetaStore,
		activeRequests,
		adaptClarificationAnswersForToolContract,
		buildAIGatewayDeferredToolResultBlock,
		buildAIGatewayPlanApprovalResult,
		buildAIGatewaySystemPrompt,
		buildChatSdkPrompt,
		buildClarificationResumeDenyMessage,
		buildEnrichedImagePrompt,
		buildExcalidrawWidgetPayload,
		buildExcalidrawWidgetSystemPrompt,
		buildFallbackGenuiSpecFromText,
		buildGoogleCalendarDateContext,
		buildMissingStudioAgentResultFailureParts,
		buildQuestionMetaFromQuestionCardPayload,
		buildStudioAgentCreationTrace,
		buildToolFirstClarificationInstruction,
		buildUserMessage,
		classifyPromptIntent,
		clearActiveDeferredToolCall,
		clearPlanSession,
		compressUiConversationHistory,
		createAIGatewayDeferredToolCallId,
		createAIGatewayChatStream,
		createChatAbortTracking,
		createClarificationSessionId,
		createRouteDecisionPart,
		createUIMessageStream,
		deriveExcalidrawTitle,
		detectEndpointType,
		executeAIGatewayBufferedStream,
		findOriginalAgentBrief,
		generateSmartGenuiResult,
		generateTextViaGateway,
		getEnvVars,
		getLatestUserMessageSource,
		getLatestVisibleUserMessage,
		getNonEmptyString,
		getPlanSession,
		getToolCallIdFromApprovalSubmission,
		getToolCallIdFromClarificationSubmission,
		handleStudioAutomationDiscoveryChatTurn,
		handleTranslationTurn,
		inferPromptIntent,
		isAIGatewayDeferredToolCallId,
		isAudioContextClarificationSession,
		isExcalidrawDiagramRequest,
		isImageContextClarificationSession,
		isLocalModelRequest,
		isSmartGenerationEnabled,
		isUnsupportedModalitiesError,
		isWorkSummaryTurn,
		mapUiMessagesToConversation,
		mapUiMessagesToRoleContent,
		normalizeApprovalSubmission,
		normalizeClarificationSubmission,
		normalizeClientTimeZone,
		normalizeExcalidrawArtifactOutput,
		normalizeSmartGenerationOptions,
		pipeUIMessageStreamToResponse,
		recordPlanWidgetEmission,
		resolveAudioContextVoiceInputFromClarification,
		resolveChatSdkPreprocessingContext,
		resolveChatSdkPromptBuildInputs,
		resolveChatSdkRequestEnvelope,
		resolveChatSdkRequestState,
		resolveGatewayUrl,
		resolveGoogleImageGatewayConfig,
		resolveImageContextFromClarification,
		resolveSmartAudioVoiceInput,
		resolveSmartImagePrompt,
		resolveSmartRouteGate,
		resolveStageTraceFromRequest,
		resolveToolFirstPolicy,
		resolveToolFirstRoutingFlags,
		rovoCancelChat,
		sanitizeQuestionCardPayload,
		sendGatewayErrorResponse,
		shouldBoundStudioAgentGatewayCall,
		shouldGateToolFirstQuestionCard,
		shouldRejectExpiredDeferredClarification,
		shouldRestorePlanModeOnResume,
		shouldSurfaceMissingStudioAgentResultFailure,
		streamAudioWidgetGeneration,
		streamExpiredClarificationResponse,
		streamGoogleGatewayManualSse,
		streamImageWidgetGeneration,
		streamLocalModel,
		streamQuestionCardWidget,
		streamSmartRouteAudioWidgetGeneration,
		streamSmartRouteImageWidgetGeneration,
		streamTextViaGateway,
		streamViaRovo,
		stripConversationalFiller,
		synthesizeSound,
		toImageWidgetErrorMessage,
		updatePlanSession,
		withCanonicalPreviewBody,
		withStudioAgentGatewayFallbackTimeout,
		writeAIGatewayFinalOutputStream,
		writeGenericThinkingTraceSteps,
	} = dependencies;

	return async function handleChatSdkRequest(req, res) {
	let stageTrace = null;
	let cleanupChatSdkAbortTracking = null;
	try {
			const requestEnvelope = resolveChatSdkRequestEnvelope({
				body: req.body || {},
				getLatestUserMessageSource,
				getLatestVisibleUserMessage,
				normalizeApprovalSubmission,
				normalizeClarificationSubmission,
				normalizeClientTimeZone,
			});
			stageTrace = resolveStageTraceFromRequest(
				req,
				"chat-sdk",
				requestEnvelope.stageTraceMeta
			);
			res.setHeader(STAGE_TRACE_ID_HEADER, stageTrace.requestId);
			const chatSdkEntryStartedAtMs = Date.now();
			stageTrace.mark("entry", requestEnvelope.entryTraceData);
			const requestState = resolveChatSdkRequestState({
				envelope: requestEnvelope,
				clearActiveDeferredToolCall,
				clearPlanSession,
				getPlanSession,
				getToolCallIdFromApprovalSubmission,
				getToolCallIdFromClarificationSubmission,
				logger: console,
				mapUiMessagesToConversation,
				pausedRovoToolCallStore: _pausedRovoToolCallStore,
				shouldRestorePlanModeOnResume,
				updatePlanSession,
			});
			const {
				messages,
				provider,
				rawModel,
				rawUserName,
				rawApproval,
				rawDeferredToolResponse,
				creationMode,
				rawSmartGeneration,
				backendPreference,
				clientTimeZone,
				genuiHint,
				resolvedPlanModeActive,
				chatSdkSource,
				threadId,
				sessionMode,
				rovoSessionId,
				requestOrigin,
				hasQueuedPrompts,
				contextDescription,
				latestVisibleUserMessage,
				latestUserMessageSource,
				isPostClarificationTurn,
				clarificationSubmission,
				approvalSubmission,
				deferredToolResponseToolCallId,
				clarificationToolCallId,
				approvalToolCallId,
				hasPausedClarificationToolCall,
				hasPausedApprovalToolCall,
				isPlanFeedbackDeferredResumeTurn,
				latestUserMessage,
				conversationHistory,
				latestVisiblePromptText,
				missingUserMessageResponse,
			} = requestState;

			if (missingUserMessageResponse) {
				return res
					.status(missingUserMessageResponse.status)
					.json(missingUserMessageResponse.body);
			}
			const didHandleWorkItemReportRoute = await handleWorkItemReportRoute({
				contextDescription,
				handlerDependencies: dependencies,
				latestUserMessage,
				messages,
				provider,
				req,
				requestOrigin,
				res,
				stageTrace,
				threadId,
			});
			if (didHandleWorkItemReportRoute) {
				return;
			}

		// AI Gateway-minted clarification toolCallIds have no paused-tool-call
		// counterpart by design (the gateway path doesn't pause-and-resume;
		// answers are injected as context for the next turn). Skip the
		// Rovo-shaped expired gate for these so legitimate submissions
		// aren't rejected as "expired".
		const isAIGatewayClarificationToolCallId =
			isAIGatewayDeferredToolCallId(clarificationToolCallId);
		const shouldRejectExpiredClarification =
			!isAIGatewayClarificationToolCallId &&
			shouldRejectExpiredDeferredClarification({
				hasClarificationContinuation:
					isPostClarificationTurn &&
					Boolean(clarificationSubmission) &&
					!rawDeferredToolResponse,
				hasPausedClarificationToolCall,
				toolCallId: clarificationToolCallId,
			});
		if (shouldRejectExpiredClarification) {
			console.info("[CHAT-SDK] Rejected expired clarification continuation", {
				toolCallId: clarificationToolCallId,
				threadId,
				sessionId: clarificationSubmission?.sessionId ?? null,
			});

			const activeRequestPort =
				threadId && activeRequests.has(threadId)
					? activeRequests.get(threadId)?.port
					: null;
			if (typeof activeRequestPort === "number" && activeRequestPort > 0) {
				await rovoCancelChat(activeRequestPort, { timeoutMs: 3_000 }).catch(() => {});
				activeRequests.delete(threadId);
			}

			streamExpiredClarificationResponse(res, clarificationToolCallId);
			return;
		}

		const didHandleStudioAutomationDiscovery =
			handleStudioAutomationDiscoveryChatTurn({
				chatSdkSource,
				clarificationSubmission,
				clarificationToolCallId,
				createDeferredToolCallId: createAIGatewayDeferredToolCallId,
				latestUserMessageSource,
				latestVisiblePromptText,
				questionCardOptions: {
					widgetType: CLARIFICATION_WIDGET_TYPE,
					maxPresetOptions: CLARIFICATION_MAX_PRESET_OPTIONS,
					customOptionPlaceholder: CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
					maxLabelLength: CLARIFICATION_MAX_LABEL_LENGTH,
				},
				recordQuestionMeta: (sessionId, questionMeta) => {
					_requestUserInputQuestionMetaStore.set(sessionId, questionMeta);
				},
				requestOrigin,
				res,
				stageTrace,
			});
		if (didHandleStudioAutomationDiscovery) {
			return;
		}

		const didHandleLocalModelTurn = handleLocalModelTurn({
			conversationHistory,
			createUIMessageStream,
			isLocalModelRequest,
			latestUserMessage,
			pipeUIMessageStreamToResponse,
			provider,
			rawModel,
			res,
			streamLocalModel,
		});
		if (didHandleLocalModelTurn) {
			return;
		}

		const didHandleTranslationTurn = await handleTranslationTurn({
			clarificationSubmission,
			createRouteDecisionPart,
			createUIMessageStream,
			latestUserMessageSource,
			latestVisiblePromptText,
			pipeUIMessageStreamToResponse,
			questionCardOptions: {
				widgetType: CLARIFICATION_WIDGET_TYPE,
				maxRounds: CLARIFICATION_MAX_ROUNDS,
				maxPresetOptions: CLARIFICATION_MAX_PRESET_OPTIONS,
				customOptionPlaceholder: CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
				maxLabelLength: CLARIFICATION_MAX_LABEL_LENGTH,
			},
			requestOrigin,
			res,
			sanitizeQuestionCardPayload,
			smartWidgetTypeGenui: SMART_WIDGET_TYPE_GENUI,
			stageTrace,
			streamQuestionCardWidget,
			streamViaRovo,
			timeoutMs: WAIT_FOR_TURN_TIMEOUT_MS,
			widgetPayloadWrapper: withCanonicalPreviewBody,
		});
		if (didHandleTranslationTurn) {
			return;
		}

		const didHandleMediaContextClarification =
			await handleMediaContextClarificationRoute({
				SMART_IMAGE_PROMPT_MAX_CHARS,
				SMART_VOICE_INPUT_MAX_CHARS,
				SMART_WIDGET_TYPE_AUDIO,
				SMART_WIDGET_TYPE_IMAGE,
				buildEnrichedImagePrompt,
				clarificationSubmission,
				createRouteDecisionPart,
				createUIMessageStream,
				detectEndpointType,
				getEnvVars,
				getNonEmptyString,
				isAudioContextClarificationSession,
				isImageContextClarificationSession,
				isUnsupportedModalitiesError,
				latestUserMessage,
				latestVisibleUserMessage,
				messages,
				pipeUIMessageStreamToResponse,
				rawModel,
				requestOrigin,
				resolveAudioContextVoiceInputFromClarification,
				resolveGatewayUrl,
				resolveGoogleImageGatewayConfig,
				resolveImageContextFromClarification,
				resolveSmartAudioVoiceInput,
				res,
				streamAudioWidgetGeneration,
				streamGoogleGatewayManualSse,
				streamImageWidgetGeneration,
				streamQuestionCardWidget,
				stripConversationalFiller,
				synthesizeSound,
				withCanonicalPreviewBody,
			});
		if (didHandleMediaContextClarification) {
			return;
		}

		const toolFirstPolicy = resolveToolFirstPolicy({
			prompt: latestUserMessage,
		});
		const toolFirstRelevanceDomains =
			Array.isArray(toolFirstPolicy.relevanceDomains) &&
			toolFirstPolicy.relevanceDomains.length > 0
				? toolFirstPolicy.relevanceDomains
				: toolFirstPolicy.domains;
		if (toolFirstPolicy.matched) {
			console.info("[TOOL-FIRST] Matched tool-first domains", {
				domains: toolFirstPolicy.domains,
				relevanceDomains: toolFirstRelevanceDomains,
				domainLabels: toolFirstPolicy.domainLabels,
			});
		}
		const isWorkSummary = isWorkSummaryTurn(toolFirstPolicy);
		const workSummaryStartMs = isWorkSummary ? Date.now() : null;
		const promptIntent = classifyPromptIntent(latestUserMessage);
		const inferredPromptIntent = promptIntent.inferredIntent;
		const mediaPreClassification = promptIntent.mediaPreClassification;
		const { isStrictToolFirstTurn: baseStrictToolFirstTurn } = resolveToolFirstRoutingFlags({
			toolFirstMatched: toolFirstPolicy.matched,
			inferredPromptIntent,
			preClassifiedIntent: mediaPreClassification.intent,
		});
		const isStrictToolFirstTurn =
			baseStrictToolFirstTurn && !resolvedPlanModeActive;

		let toolFirstClarificationInstruction = null;
		if (isStrictToolFirstTurn && !clarificationSubmission) {
			const { shouldGate, unsatisfiedHints } = shouldGateToolFirstQuestionCard({
				prompt: latestUserMessage,
				toolFirstPolicy,
				latestUserMessageSource,
				gateSkipSources: TOOL_FIRST_GATE_SKIP_SOURCES,
			});
			if (shouldGate) {
				toolFirstClarificationInstruction =
					buildToolFirstClarificationInstruction({
						unsatisfiedHints,
						domainLabels: toolFirstPolicy.domainLabels,
					});
			}
		}

			const enrichedContextDescription = resolveChatSdkPreprocessingContext({
				adaptClarificationAnswersForToolContract,
				approvalSubmission,
				backendPreference,
				buildAIGatewayDeferredToolResultBlock,
				buildAIGatewayPlanApprovalResult,
				buildClarificationResumeDenyMessage,
				clarificationSubmission,
				clarificationToolCallId,
				contextDescription,
				hasPausedApprovalToolCall,
				hasPausedClarificationToolCall,
				isAIGatewayDeferredToolCallId,
				logger: console,
				rawApproval,
				rawDeferredToolResponse,
			});

			const {
				effectiveContextWithPortBinding,
				pausedContinuationToolCallId,
				promptProfile,
				smartGeneration,
				smartGenerationActive,
				smartLayoutContext,
			} = resolveChatSdkPromptBuildInputs({
				approvalSubmission,
				approvalToolCallId,
				buildGoogleCalendarDateContext,
				clarificationSubmission,
				clarificationToolCallId,
				clientTimeZone,
				enrichedContextDescription,
				hasPausedApprovalToolCall,
				hasPausedClarificationToolCall,
				isSmartGenerationEnabled,
				isStrictToolFirstTurn,
				normalizeSmartGenerationOptions,
				promptIntent,
				rawSmartGeneration,
				toolFirstClarificationInstruction,
				toolFirstPolicy,
			});

			const {
				compressedPromptHistory,
				promptBuiltTraceData,
				userMessageText,
			} = buildChatSdkPrompt({
				buildUserMessage,
				compressConversationHistory: compressUiConversationHistory,
				conversationHistory,
				effectiveContextWithPortBinding,
				latestUserMessage,
				logger: console,
				promptProfile,
			});
			stageTrace.mark("prompt_built", promptBuiltTraceData);
			const {
				forceSmartAudioRoute,
				isCreateIntentRequestPrompt,
				isTaskLikeRequest,
				prefersGenuiCardExperience,
				smartIntentResult,
				smartRoutingActive,
			} = resolveSmartRouteGate({
				allowedSurfaces: SMART_ROUTE_TARGET_SURFACES,
				genuiHint,
				inferredPromptIntent,
				isStrictToolFirstTurn,
				logger: console,
				promptIntent,
				smartGeneration,
				smartGenerationActive,
			});

			if (
				smartRoutingActive &&
				!isStrictToolFirstTurn &&
				smartIntentResult &&
				smartIntentResult.intent !== "normal"
			) {
				streamSmartGenerationRoute({
					CLARIFICATION_WIDGET_TYPE,
					GENUI_FALLBACK_ERROR_TEXT,
					SMART_IMAGE_PROMPT_MAX_CHARS,
					SMART_VOICE_INPUT_MAX_CHARS,
					SMART_WIDGET_TYPE_AUDIO,
					SMART_WIDGET_TYPE_GENUI,
					SMART_WIDGET_TYPE_IMAGE,
					buildExcalidrawWidgetPayload,
					buildExcalidrawWidgetSystemPrompt,
					buildFallbackGenuiSpecFromText,
					conversationHistory,
					createRouteDecisionPart,
					createUIMessageStream,
					deriveExcalidrawTitle,
					detectEndpointType,
					forceSmartAudioRoute,
					generateSmartGenuiResult,
					generateTextViaGateway,
					getEnvVars,
					getNonEmptyString,
					isExcalidrawDiagramRequest,
					isUnsupportedModalitiesError,
					latestUserMessage,
					latestVisibleUserMessage,
					logger: console,
					mapUiMessagesToRoleContent,
					messages,
					normalizeExcalidrawArtifactOutput,
					pipeUIMessageStreamToResponse,
					provider,
					rawModel,
					req,
					requestOrigin,
					res,
					resolveGatewayUrl,
					resolveGoogleImageGatewayConfig,
					resolveSmartAudioVoiceInput,
					resolveSmartImagePrompt,
					smartGeneration,
					smartIntentResult,
					smartLayoutContext,
					streamGoogleGatewayManualSse,
					streamSmartRouteAudioWidgetGeneration,
					streamSmartRouteImageWidgetGeneration,
					stripConversationalFiller,
					synthesizeSound,
					toImageWidgetErrorMessage,
					userMessageText,
					withCanonicalPreviewBody,
				});
				return;
			}

		// ── Output Routing: Media bypass pre-classification (BE-002, BE-003) ──
		// Use lightweight regex pre-classification to detect obvious media
		// generation intents BEFORE sending to Rovo. This avoids the
		// Rovo round-trip for clear-cut image/audio requests.
		if (
			mediaPreClassification.intent &&
			!isStrictToolFirstTurn &&
			streamMediaBypassRoute({
				SMART_IMAGE_PROMPT_MAX_CHARS,
				SMART_VOICE_INPUT_MAX_CHARS,
				SMART_WIDGET_TYPE_AUDIO,
				SMART_WIDGET_TYPE_IMAGE,
				createRouteDecisionPart,
				createUIMessageStream,
				detectEndpointType,
				getEnvVars,
				isUnsupportedModalitiesError,
				latestUserMessage,
				latestVisibleUserMessage,
				logger: console,
				mediaPreClassification,
				messages,
				pipeUIMessageStreamToResponse,
				rawModel,
				requestOrigin,
				res,
				resolveGatewayUrl,
				resolveGoogleImageGatewayConfig,
				resolveSmartAudioVoiceInput,
				resolveSmartImagePrompt,
				streamAudioWidgetGeneration,
				streamGoogleGatewayManualSse,
				streamImageWidgetGeneration,
				streamQuestionCardWidget,
				stripConversationalFiller,
				synthesizeSound,
				userMessageText,
				withCanonicalPreviewBody,
			})
		) {
			return;
		}

		if (
			streamGoogleDirectImageRoute({
				createUIMessageStream,
				detectEndpointType,
				getEnvVars,
				inferPromptIntent,
				isStrictToolFirstTurn,
				isUnsupportedModalitiesError,
				latestUserMessage,
				logger: console,
				pipeUIMessageStreamToResponse,
				provider,
				rawModel,
				res,
				resolveGatewayUrl,
				resolveGoogleImageGatewayConfig,
				streamGoogleGatewayManualSse,
				userMessageText,
			})
		) {
			return;
		}

		if (backendPreference === "ai-gateway") {
			streamAIGatewayChatRoute({
				adaptClarificationAnswersForToolContract,
				buildAIGatewaySystemPrompt,
				buildMissingStudioAgentResultFailureParts,
				buildQuestionMetaFromQuestionCardPayload,
				buildStudioAgentCreationTrace,
				chatSdkEntryStartedAtMs,
				clarificationCustomOptionPlaceholder:
					CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
				clarificationMaxLabelLength: CLARIFICATION_MAX_LABEL_LENGTH,
				clarificationMaxPresetOptions: CLARIFICATION_MAX_PRESET_OPTIONS,
				clarificationSubmission,
				clientTimeZone,
				compressedPromptHistory,
				createAIGatewayChatStreamFn: createAIGatewayChatStream,
				createAIGatewayDeferredToolCallId,
				createChatAbortTracking,
				createClarificationSessionId,
				createRouteDecisionPart,
				createUIMessageStream,
				creationMode,
				effectiveContextWithPortBinding,
				executeAIGatewayBufferedStream,
				fallbackAgentCreationQuestionInput:
					FALLBACK_AGENT_CREATION_QUESTION_INPUT,
				findOriginalAgentBrief,
				isPostClarificationTurn,
				isStrictToolFirstTurn,
				latestUserMessage,
				messages,
				onCleanupAbortTracking: (cleanupAbortTracking) => {
					cleanupChatSdkAbortTracking = cleanupAbortTracking;
				},
				pipeUIMessageStreamToResponse,
				promptProfile,
				provider,
				rawUserName,
				recordPlanWidgetEmission,
				req,
				requestOrigin,
				res,
				setQuestionMeta: (sessionId, questionMeta) => {
					_requestUserInputQuestionMetaStore.set(sessionId, questionMeta);
				},
				shouldBoundStudioAgentGatewayCall,
				shouldSurfaceMissingStudioAgentResultFailure,
				smartGenerationActive,
				stageTrace,
				streamTextViaGateway,
				studioAgentGatewayFallbackTimeoutMs:
					STUDIO_AGENT_GATEWAY_FALLBACK_TIMEOUT_MS,
				threadId,
				withStudioAgentGatewayFallbackTimeout,
				writeAIGatewayFinalOutputStream,
				writeGenericThinkingTraceSteps,
			});
			return;
		}

		await streamRovoChatRoute({
			approvalSubmission,
			approvalToolCallId,
			chatSdkEntryStartedAtMs,
			clarificationSubmission,
			clarificationToolCallId,
			deferredToolResponseToolCallId,
			genuiHint,
			handlerDependencies: {
				...dependencies,
				buildRovoInitialActiveAttemptMessage,
				createExitPlanWidgetEmitter,
				createLazyRovoThinkingStatusEmitter,
				createRequestUserInputQuestionCardEmitter,
				createRovoBrowserToolEventRouter,
				createRovoStreamAttemptErrorHandler,
				createRovoStreamAttemptRunner,
				createRovoStreamTextDeltaHandler,
				createToolObservationRecorder,
				resolveRovoToolFirstRetryLimit,
				runRovoPostStreamPipeline,
				runRovoStreamRetryLoopWithToolFirstPlanning,
			},
			hasPausedApprovalToolCall,
			hasPausedClarificationToolCall,
			hasQueuedPrompts,
			isCreateIntentRequestPrompt,
			isPlanFeedbackDeferredResumeTurn,
			isPostClarificationTurn,
			isStrictToolFirstTurn,
			isTaskLikeRequest,
			latestUserMessage,
			latestVisibleUserMessage,
			logger: console,
			messages,
			onCleanupAbortTracking: (cleanupAbortTracking) => {
				cleanupChatSdkAbortTracking = cleanupAbortTracking;
			},
			pausedContinuationToolCallId,
			prefersGenuiCardExperience,
			promptProfile,
			provider,
			rawDeferredToolResponse,
			rawModel,
			req,
			requestOrigin,
			res,
			resolvedPlanModeActive,
			rovoSessionId,
			sessionMode,
			smartGenerationActive,
			smartLayoutContext,
			stageTrace,
			threadId,
			toolFirstPolicy,
			toolFirstRelevanceDomains,
			userMessageText,
			workSummaryStartMs,
		});
		} catch (error) {
			cleanupChatSdkAbortTracking?.();
			stageTrace?.mark("chat_sdk_error", {
				error: error instanceof Error ? error.message : String(error),
			});
			console.error("Chat SDK API error:", error);
			return sendGatewayErrorResponse(res, error, "Failed to process chat request");
		}
}
}

module.exports = {
	createChatSdkHandler,
};
