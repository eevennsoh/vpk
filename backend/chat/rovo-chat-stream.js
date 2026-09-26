"use strict";

function createRovoChatStream(options = {}) {
	const {
		CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
		CLARIFICATION_MAX_LABEL_LENGTH,
		CLARIFICATION_MAX_PRESET_OPTIONS,
		CLARIFICATION_WIDGET_TYPE,
		CLASSIFIER_JSON_BUFFER_MAX_CHARS,
		INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_MAX_ATTEMPTS,
		INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_TIMEOUT_MS,
		INTERACTIVE_CHAT_STUCK_PORT_RECOVERY_RETRY_ATTEMPTS,
		SMART_WIDGET_TYPE_AUDIO,
		SMART_WIDGET_TYPE_GENUI,
		SMART_WIDGET_TYPE_IMAGE,
		TOOL_FIRST_ENFORCEMENT_MODE_SOFT_RETRY,
		WAIT_FOR_TURN_TIMEOUT_MS,
		_requestUserInputQuestionMetaStore,
		abortController,
		activeRequests,
		adaptClarificationAnswersForToolContract,
		appendToolObservationEntry,
		approvalSubmission,
		approvalToolCallId,
		buildApprovalResumeDecision,
		buildArtifactPreviewSummary,
		buildClarificationResumeDecision,
		buildClarificationResumeDenyMessage,
		buildDirectSpecWidgetParts,
		buildInteractiveStuckPortFailureMessage,
		buildMissingStudioAgentResultFailureParts,
		buildPostTurnWorkCompleteTraceData,
		buildQuestionCardPayloadFromRequestUserInput,
		buildQuestionMetaFromQuestionCardPayload,
		buildRovoInitialActiveAttemptMessage,
		buildRovoTurnRoutingTelemetry,
		buildSmartGenerationGatewayOptions,
		buildToolContextForGenui,
		buildToolFirstTextFallback,
		buildTurnCompletePart,
		buildWorkSummaryExecutionLog,
		buildZeroToolCallRecoverySpec,
		clarificationSubmission,
		clarificationToolCallId,
		classifyCommand,
		clearPlanSession,
		createClarificationSessionId,
		createExitPlanWidgetEmitter,
		createLazyRovoThinkingStatusEmitter,
		createRequestUserInputQuestionCardEmitter,
		createRouteDecisionPart,
		createRovoBrowserToolEventRouter,
		createRovoMarkerStreamAdapter,
		createRovoRouteWidgetPayloadDecorator,
		createRovoStreamAttemptErrorHandler,
		createRovoStreamAttemptRunner,
		createRovoStreamTextDeltaHandler,
		createRovoTextOutputController,
		createThreadBrowserBridge,
		createToolFirstExecutionState,
		createToolObservationRecorder,
		createUIMessageStream,
		creationMode,
		deferredToolResponseToolCallId,
		derivePlanExecutionArtifactTitle,
		detectEndpointType,
		detectSecrets,
		dispatchBespokeGenuiHandler,
		emitAutomaticGenuiFailure,
		emitCreateIntentDirectGenuiWidget,
		emitPostToolGenuiWidget,
		emitRovoMissingStudioAgentResultFailure,
		emitRovoToolFirstRouteSummary,
		emitToolFirstRelevantGenuiWidget,
		emitWorkSummaryZeroToolRecoveryWidget,
		extractCommandFromArgs,
		extractDirectSpec,
		extractStudioAgentResultFromText,
		finalizePlanExecutionArtifactPostStream,
		finalizeRovoClassifierLeakRepair,
		finalizeRovoDirectOutputs,
		finalizeRovoPlanWidgetPostStream,
		finalizeRovoStudioAgentResult,
		generatePlanMetadataViaGateway,
		generateSmartGenuiResult,
		generateTextViaGateway,
		genuiHint,
		getEnvVars,
		getLatestPlanWidgetMetadata,
		getListeningPidsForPort,
		getNonEmptyString,
		getPlanFeedbackToolGuard,
		getReadonlyBlockedWriteToolNames,
		handleDirectRovoMediaFences,
		handleReplayDeferredToolRequest,
		hasPausedApprovalToolCall,
		hasPausedClarificationToolCall,
		hasQueuedPrompts,
		hasRelevantToolObservation,
		hasRelevantToolSuccess,
		instrumentChatSdkWriter,
		isBashQuestionCardWorkaround,
		isBrowserToolCall,
		isClassifierIntentLeakCandidate,
		isCreateIntentRequestPrompt,
		isExitPlanModeTool,
		isPlainObject,
		isPlanExecutionPhase,
		isPlanFeedbackDeferredResumeTurn,
		isPostClarificationTurn,
		isRequestUserInputTool,
		isStrictToolFirstTurn,
		isTaskLikeRequest,
		isToolNameRelevant,
		isWorkSummary,
		latestUserMessage,
		latestVisibleUserMessage,
		looksLikeClarificationResponse,
		looksLikeInabilityResponse,
		looksLikeWriteBlockedTurn,
		mapUiMessagesToRoleContent,
		messages,
		normalizeRovoThinkingEvent,
		normalizeRovoThinkingStatus,
		parseClassifierIntentPayload,
		pausedContinuationToolCallId,
		persistRovoAppBrowserScreenshotBuffer,
		provider,
		rawDeferredToolResponse,
		rawModel,
		recordPlanWidgetEmission,
		recordToolFirstAttempt,
		recordToolThinkingEvent,
		redactSecrets,
		refreshRovoAvailability,
		registerActiveDeferredToolCall,
		registerPausedRovoToolCall,
		replayViaRovo,
		requestOrigin,
		resolveAutomaticGenuiOutcome,
		resolveGatewayUrl,
		resolveGoogleImageGatewayConfig,
		resolvePlanExecutionCompletion,
		resolveRovoChatInProgressTimeoutRecovery,
		resolveRovoNonStrictPostStreamRouting,
		resolveRovoPortStuckRecovery,
		resolveRovoRouteToolsDetected,
		resolveRovoToolFirstRetryLimit,
		resolveRovoToolFirstRetryPlan,
		resolveToolFirstWidgetContentType,
		resolveToolFirstWidgetSource,
		resolvedPlanModeActive,
		restartRovoPort,
		rovoAppDocumentManager,
		rovoAppThreadManager,
		rovoCancelChat,
		rovoHealthCheck,
		rovoResumeToolCalls,
		rovoSessionId,
		runRovoPostStreamPipeline,
		runRovoStreamRetryLoopWithToolFirstPlanning,
		sessionMode,
		shouldAttemptPostToolGenui,
		shouldForceCardFirstGenui,
		shouldRetryInteractiveStuckPortRecovery,
		shouldSuppressToolFirstIntentStatus,
		shouldSurfaceMissingStudioAgentResultFailure,
		smartLayoutContext,
		splitDirectMediaTextForStreaming,
		splitSpecFenceTextForStreaming,
		stageTrace,
		streamGoogleGatewayManualSse,
		streamViaRovo,
		stripDirectMediaFences,
		stripToolFirstFailureNarrative,
		syncRovoAppThreadSessionFromCurrentPort,
		synthesiseDeferredToolResponseFromClarification,
		synthesizeSound,
		takePausedRovoToolCall,
		threadId,
		toPreview,
		toolFirstPolicy,
		toolFirstRelevanceDomains,
		userMessageText,
		withCanonicalPreviewBody,
		workSummaryStartMs,
		writePostToolGenuiLoading,
	} = options;

	return createUIMessageStream({
				execute: async ({ writer }) => {
					const writerTelemetry = instrumentChatSdkWriter({
						stageTrace,
						writer,
					});
					const textId = `text-${Date.now()}`;
					const widgetId = `widget-${Date.now()}`;
					let resolvedRovoPort = null;
					let hasEmittedQuestionCard = false;
					let hasEmittedPlanWidget = false;
					let hasEmittedGenuiWidget = false;
						let hasSeenPlanWidgetSignal = false;
						let hasEmittedPlanLoadingState = false;
						let hasExplicitPlanPayload = false;
							let hasObservedToolExecution = false;
							/** @type {Set<string>} */
							const bashQuestionCardWorkaroundCallIds = new Set();
						let hasObservedDeferredToolRequest = false;
					// ── Output Routing: Two-step GenUI state ──
					// Track whether non-question-card tool calls were observed during
					// the Rovo stream. When true, post-stream processing triggers
					// the two-step GenUI flow (BE-001).
					let hasObservedActionableToolCall = false;
					let hasObservedRelevantActionableToolCall = false;
						const toolFirstExecutionState = createToolFirstExecutionState(
							toolFirstPolicy
						);
						const toolFirstFullOutputs = [];
						const toolObservationEntries = [];
						const {
							hasToolObservationEntries,
							recordToolObservation,
						} = createToolObservationRecorder({
							appendToolObservationEntry,
							entries: toolObservationEntries,
						});
						const toolFirstSoftRetryEnabled =
							isStrictToolFirstTurn &&
							toolFirstPolicy?.enforcement?.mode ===
							TOOL_FIRST_ENFORCEMENT_MODE_SOFT_RETRY;
					const shouldDeferToolFirstText = toolFirstSoftRetryEnabled;
					const suppressStreamingTextForCardFirstGenui =
						shouldForceCardFirstGenui;

					const textOutput = createRovoTextOutputController({
						classifierJsonBufferMaxChars: CLASSIFIER_JSON_BUFFER_MAX_CHARS,
						isClassifierIntentLeakCandidate,
						parseClassifierIntentPayload,
						shouldDeferToolFirstText,
						splitDirectMediaTextForStreaming,
						splitSpecFenceTextForStreaming,
						stripToolFirstFailureNarrative,
						suppressStreamingTextForCardFirstGenui,
						textId,
						toolFirstFailureNarrativeEnabled: isStrictToolFirstTurn,
						writer,
					});
					const {
						emitBufferedAssistantTextForTextRoute,
						emitForcedTextDelta,
						emitTextDelta,
						emitTextDeltaRaw,
						finalizeBufferedAssistantText,
						flushDeferredToolFirstText,
						getAssistantText,
						getHasSuppressedLargeAssistantJson,
						getUnsuppressedAssistantText,
						removeToolFirstFailureNarrative,
						resetAssistantTextForRetryAttempt:
							resetAssistantTextForRetryAttemptState,
						setAssistantText,
						writeTextEndIfStarted,
						} = textOutput;

						const requestUserInputQuestionCardEmitter =
							createRequestUserInputQuestionCardEmitter({
								buildQuestionCardPayloadFromRequestUserInput,
								buildQuestionMetaFromQuestionCardPayload,
								clarificationCustomOptionPlaceholder:
									CLARIFICATION_CUSTOM_OPTION_PLACEHOLDER,
								clarificationMaxLabelLength:
									CLARIFICATION_MAX_LABEL_LENGTH,
								clarificationMaxPresetOptions:
									CLARIFICATION_MAX_PRESET_OPTIONS,
								clarificationWidgetType: CLARIFICATION_WIDGET_TYPE,
								createClarificationSessionId,
								createRouteDecisionPart,
								creationMode,
								getNonEmptyString,
								isRequestUserInputTool,
								onQuestionCardEmitted: () => {
									hasEmittedQuestionCard = true;
								},
								requestOrigin,
								sharedQuestionMetaStore:
									_requestUserInputQuestionMetaStore,
								writer,
							});
						const emitRequestUserInputQuestionCard =
							requestUserInputQuestionCardEmitter.emit;
						const emitRequestUserInputQuestionCardFromResult =
							requestUserInputQuestionCardEmitter.emitFromResult;

					const rovoMarkerStream = createRovoMarkerStreamAdapter({
						creationMode,
						emitTextDelta,
					getHasEmittedPlanWidget: () => hasEmittedPlanWidget,
					onGenuiWidgetEmitted: () => {
						hasEmittedGenuiWidget = true;
					},
					onPlanWidgetData: () => {
						hasEmittedPlanWidget = true;
						hasSeenPlanWidgetSignal = true;
						hasExplicitPlanPayload = true;
					},
						onPlanWidgetLoading: (loading) => {
							hasSeenPlanWidgetSignal = true;
							hasEmittedPlanLoadingState = loading;
						},
						onQuestionCardEmitted: (questionCardWidgetId) => {
							requestUserInputQuestionCardEmitter.markQuestionCardEmitted(
								questionCardWidgetId
							);
						},
					widgetId,
					writer,
				});

					const lazyThinkingStatusEmitter =
						createLazyRovoThinkingStatusEmitter({
							creationMode,
							writer,
						});
					const emitLazyThinkingStatus =
						lazyThinkingStatusEmitter.emit;
					const {
						getRawAgentCreationAssistantText,
						handleStreamTextDelta,
					} = createRovoStreamTextDeltaHandler({
						creationMode,
						emitLazyThinkingStatus,
						rovoMarkerStream,
						stageTrace,
					});

					const resetAssistantTextForRetryAttempt = () => {
						rovoMarkerStream.reset();
						resetAssistantTextForRetryAttemptState();
					};

						const exitPlanWidgetEmitter = createExitPlanWidgetEmitter({
							getIsPlanWidgetLoading: () => hasEmittedPlanLoadingState,
							logger: console,
							onExplicitPlanPayload: () => {
								hasExplicitPlanPayload = true;
							},
							onPlanWidgetData: () => {
								hasEmittedPlanWidget = true;
								hasSeenPlanWidgetSignal = true;
							},
							onPlanWidgetLoading: (loading) => {
								hasSeenPlanWidgetSignal = true;
								hasEmittedPlanLoadingState = loading;
							},
							recordPlanWidgetEmission,
							threadId,
							widgetId,
							writer,
						});
						const emitPlanWidgetLoading = exitPlanWidgetEmitter.emitLoading;
						const maybeEmitExitPlanWidget =
							exitPlanWidgetEmitter.emitFromToolInput;

							const emitWidgetError = ({
								type,
								message,
								canRetry = true,
							id = widgetId,
						}) => {
							if (typeof type !== "string" || !type.trim()) {
								return;
							}
							if (typeof message !== "string" || !message.trim()) {
								return;
							}

							writer.write({
								type: "data-widget-error",
								id,
								data: {
									type,
									message: message.trim(),
									canRetry: Boolean(canRetry),
								},
							});
						};

					// Rovo Serve: route through the local agent loop
					console.log("[CHAT-SDK] Routing through Rovo Serve");
					stageTrace.mark("rovo_stream_start", {
						conflictPolicy: "wait-for-turn",
					});
					const toolFirstRetryLimit = resolveRovoToolFirstRetryLimit({
						isStrictToolFirstTurn,
						softRetryMode: TOOL_FIRST_ENFORCEMENT_MODE_SOFT_RETRY,
						toolFirstPolicy,
					});
						const totalToolFirstAttempts = toolFirstRetryLimit + 1;

						const initialActiveAttemptMessage =
							buildRovoInitialActiveAttemptMessage({
								rawDeferredToolResponse,
								userMessageText,
							});
						let pausedToolCallHandled = false;
						let hasBlockedPlanFeedbackExecutionTool = false;

					const browserBridge = createThreadBrowserBridge({
						screenshotStore: {
							async persistScreenshot({
								buffer,
								contentType,
								threadId: screenshotThreadId,
							}) {
								return persistRovoAppBrowserScreenshotBuffer({
									buffer,
									contentType,
									threadId: screenshotThreadId,
								});
							},
						},
						writer,
						threadId,
					});
						const browserToolEventRouter = createRovoBrowserToolEventRouter({
							browserBridge,
							isBrowserToolCall,
						});
						const runRovoStreamAttempt = createRovoStreamAttemptRunner({
							abortController,
							activeRequests,
							adaptClarificationAnswersForToolContract,
							approvalSubmission,
							approvalToolCallId,
							bashQuestionCardWorkaroundCallIds,
							browserToolEventRouter,
							buildApprovalResumeDecision,
							buildClarificationResumeDecision,
							buildClarificationResumeDenyMessage,
							clarificationSubmission,
							classifyCommand,
							detectSecrets,
							emitExitPlanWidget: maybeEmitExitPlanWidget,
							emitRequestUserInputQuestionCard,
							emitRequestUserInputQuestionCardFromResult,
							extractCommandFromArgs,
							getHasBlockedPlanFeedbackExecutionTool: () =>
								hasBlockedPlanFeedbackExecutionTool,
							getPausedToolCallHandled: () => pausedToolCallHandled,
							getPlanFeedbackToolGuard,
							getResolvedRovoPort: () => resolvedRovoPort,
							handleReplayDeferredToolRequest,
							hasPausedApprovalToolCall,
							hasPausedClarificationToolCall,
							isBashQuestionCardWorkaround,
							isExitPlanModeTool,
							isPlanFeedbackDeferredResumeTurn,
							isRequestUserInputTool,
							isStrictToolFirstTurn,
							isToolNameRelevant,
							logger: console,
							normalizeRovoThinkingEvent,
							normalizeRovoThinkingStatus,
							onBlockedPlanFeedbackExecutionTool: () => {
								hasBlockedPlanFeedbackExecutionTool = true;
							},
							onEmittedThinkingStatus:
								lazyThinkingStatusEmitter.markEmitted,
							onObservedActionableToolCall: () => {
								hasObservedActionableToolCall = true;
							},
							onObservedDeferredToolRequest: () => {
								hasObservedDeferredToolRequest = true;
							},
							onObservedRelevantActionableToolCall: () => {
								hasObservedRelevantActionableToolCall = true;
							},
							onObservedToolExecution: () => {
								hasObservedToolExecution = true;
							},
							onPausedToolCallHandled: () => {
								pausedToolCallHandled = true;
							},
							onResolvedRovoPort: (port) => {
								resolvedRovoPort = port;
							},
							onTextDelta: handleStreamTextDelta,
							pausedContinuationToolCallId,
							recordToolObservation,
							recordToolThinkingEvent,
							redactSecrets,
							registerActiveDeferredToolCall,
							registerPausedToolCall: registerPausedRovoToolCall,
							replayViaRovo,
							resumedToolCallId: deferredToolResponseToolCallId,
							rovoCancelChat,
							rovoResumeToolCalls,
							rovoSessionId,
							sessionMode,
							shouldSuppressToolFirstIntentStatus,
							stageTrace,
							streamViaRovo,
							syncRovoAppThreadSessionFromCurrentPort,
							takePausedRovoToolCall,
							threadId,
							toPreview,
							toolFirstExecutionState,
							toolFirstFullOutputs,
							toolFirstPolicy,
							toolFirstRelevanceDomains,
							waitForTurnTimeoutMs: WAIT_FOR_TURN_TIMEOUT_MS,
							writer,
						});
						const handleRovoStreamAttemptErrorForLoop =
							createRovoStreamAttemptErrorHandler({
								abortSignal: abortController.signal,
								adaptClarificationAnswersForToolContract,
								buildInteractiveStuckPortFailureMessage,
								clarificationSubmission,
								clarificationToolCallId,
								emitForcedTextDelta,
								getListeningPidsForPort,
								getResolvedRovoPort: () => resolvedRovoPort,
								handleStreamTextDelta,
								hasPausedClarificationToolCall,
								interactiveChatForcePortRecoveryMaxAttempts:
									INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_MAX_ATTEMPTS,
								interactiveChatForcePortRecoveryTimeoutMs:
									INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_TIMEOUT_MS,
								interactiveChatStuckPortRecoveryRetryAttempts:
									INTERACTIVE_CHAT_STUCK_PORT_RECOVERY_RETRY_ATTEMPTS,
								logger: console,
								refreshRovoAvailability,
								restartRovoPort,
								resolveRovoChatInProgressTimeoutRecovery,
								resolveRovoPortStuckRecovery,
								rovoCancelChat,
								rovoHealthCheck,
								shouldRetryInteractiveStuckPortRecovery,
								synthesiseDeferredToolResponseFromClarification,
								threadId,
								writer,
							});

							await runRovoStreamRetryLoopWithToolFirstPlanning({
								abortSignal: abortController.signal,
								getHasEmittedQuestionCard: () => hasEmittedQuestionCard,
								getHasObservedDeferredToolRequest: () =>
									hasObservedDeferredToolRequest,
								handleAttemptError:
									handleRovoStreamAttemptErrorForLoop,
								hasRelevantToolSuccess,
								initialActiveAttemptMessage,
								logger: console,
								recordToolFirstAttempt,
								resetAssistantTextForRetryAttempt,
								resolveRovoToolFirstRetryPlan,
								runStreamAttempt: runRovoStreamAttempt,
								toolFirstExecutionState,
								toolFirstPolicy,
								toolFirstRelevanceDomains,
								toolFirstSoftRetryEnabled,
								totalToolFirstAttempts,
								userMessageText,
								writer,
							});
							const postStreamPipelineResult =
								await runRovoPostStreamPipeline({
									abortSignal: abortController.signal,
									activeRequests,
									browserBridge,
									buildArtifactPreviewSummary,
									buildDirectSpecWidgetParts,
									buildMissingStudioAgentResultFailureParts,
									buildPostTurnWorkCompleteTraceData,
									buildRovoTurnRoutingTelemetry,
									buildSmartGenerationGatewayOptions,
									buildToolContextForGenui,
									buildToolFirstTextFallback,
									buildTurnCompletePart,
									buildWorkSummaryExecutionLog,
									buildZeroToolCallRecoverySpec,
									clearPlanSession,
									createRouteDecisionPart,
									createRovoRouteWidgetPayloadDecorator,
									creationMode,
									derivePlanExecutionArtifactTitle,
									detectEndpointType,
									dispatchBespokeGenuiHandler,
									emitAutomaticGenuiFailure,
									emitBufferedAssistantTextForTextRoute,
									emitCreateIntentDirectGenuiWidget,
									emitForcedTextDelta,
									emitPlanWidgetLoading,
									emitPostToolGenuiWidget,
									emitRovoMissingStudioAgentResultFailure,
									emitRovoToolFirstRouteSummary,
									emitTextDeltaRaw,
									emitToolFirstRelevantGenuiWidget,
									emitWidgetError,
									emitWorkSummaryZeroToolRecoveryWidget,
									extractDirectSpec,
									extractStudioAgentResultFromText,
									finalizeBufferedAssistantText,
									finalizePlanExecutionArtifactPostStream,
									finalizeRovoClassifierLeakRepair,
									finalizeRovoDirectOutputs,
									finalizeRovoPlanWidgetPostStream,
									finalizeRovoStudioAgentResult,
									flushDeferredToolFirstText,
									flushRovoMarkerStream: () => {
										rovoMarkerStream.flush();
									},
									generatePlanMetadataViaGateway,
									generateSmartGenuiResult,
									generateTextViaGateway,
									genuiHint,
									getAssistantText,
									getEnvVars,
									getHasEmittedAgentResult:
										writerTelemetry.getHasEmittedAgentResult,
									getHasSuppressedLargeAssistantJson,
									getLatestPlanWidgetMetadata,
									getNonEmptyString,
									getRawAgentCreationAssistantText,
									getReadonlyBlockedWriteToolNames,
									getUnsuppressedAssistantText,
									handleDirectRovoMediaFences,
									hasEmittedGenuiWidget,
									hasEmittedPlanLoadingState,
									hasEmittedPlanWidget,
									hasEmittedQuestionCard,
									hasExplicitPlanPayload,
									hasObservedActionableToolCall,
									hasObservedDeferredToolRequest,
									hasObservedRelevantActionableToolCall,
									hasObservedToolExecution,
									hasQueuedPrompts,
									hasRelevantToolObservation,
									hasRelevantToolSuccess,
									hasSeenPlanWidgetSignal,
									hasToolObservationEntries,
									isCreateIntentRequestPrompt,
									isPlainObject,
									isPlanExecutionPhase,
									isPostClarificationTurn,
									isStrictToolFirstTurn,
									isTaskLikeRequest,
									isToolNameRelevant,
									isWorkSummary,
									latestPromptText: latestVisibleUserMessage?.text,
									latestUserMessage,
									layoutContext: smartLayoutContext,
									logger: console,
									looksLikeClarificationResponse,
									looksLikeInabilityResponse,
									looksLikeWriteBlockedTurn,
									mapUiMessagesToRoleContent,
									messages,
									onHasEmittedGenuiWidget: (value) => {
										hasEmittedGenuiWidget = value;
									},
									parseClassifierIntentPayload,
									provider,
									rawModel,
									removeToolFirstFailureNarrative,
									requestOrigin,
									requestUserInputQuestionCardEmitter,
									resolveAutomaticGenuiOutcome,
									resolveGatewayUrl,
									resolveGoogleImageGatewayConfig,
									resolvePlanExecutionCompletionFn:
										resolvePlanExecutionCompletion,
									resolveRovoNonStrictPostStreamRouting,
									resolvedPlanModeActive,
									resolvedRovoPort,
									resolveRovoRouteToolsDetected,
									resolveToolFirstWidgetContentType,
									resolveToolFirstWidgetSource,
									rovoAppDocumentManager,
									rovoAppThreadManager,
									sessionMode,
									setAssistantText,
									shouldAttemptPostToolGenui,
									shouldForceCardFirstGenui,
									shouldSurfaceMissingStudioAgentResultFailure,
									stageTrace,
									streamGoogleGatewayManualSse,
									stripDirectMediaFences,
									syncRovoAppThreadSessionFromCurrentPort,
									synthesizeSound,
									threadId,
									toolFirstExecutionState,
									toolFirstFullOutputs,
									toolFirstPolicy,
									toolFirstRelevanceDomains,
									toolObservationEntries,
									userMessageText,
									widgetPayloadWrapper: withCanonicalPreviewBody,
									widgetType: SMART_WIDGET_TYPE_GENUI,
									widgetTypeAudio: SMART_WIDGET_TYPE_AUDIO,
									widgetTypeGenui: SMART_WIDGET_TYPE_GENUI,
									widgetTypeImage: SMART_WIDGET_TYPE_IMAGE,
									workSummaryStartMs,
									writePostToolGenuiLoading,
									writer,
									writeTextEndIfStarted,
								});
							if (postStreamPipelineResult.aborted) {
								return;
							}
				},
				onError: (error) => {
					if (error instanceof Error) {
						return error.message;
				}
				return "Failed to stream AI response";
			},
	});
}

async function streamRovoChatRoute({
	approvalSubmission,
	approvalToolCallId,
	chatSdkEntryStartedAtMs,
	clarificationSubmission,
	clarificationToolCallId,
	createRovoChatStreamFn = createRovoChatStream,
	deferredToolResponseToolCallId,
	genuiHint,
	handlerDependencies = {},
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
	logger = console,
	messages,
	onCleanupAbortTracking = () => {},
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
} = {}) {
	const {
		buildRovoPreprocessingTraceData,
		createChatAbortTracking,
		createRovoUnavailableError,
		pipeUIMessageStreamToResponse,
		resolvePreferredBackend,
		sendGatewayErrorResponse,
	} = handlerDependencies;

	const backendSelection = await resolvePreferredBackend();

	if (backendSelection.backend !== "rovo") {
		sendGatewayErrorResponse(
			res,
			createRovoUnavailableError(),
			"Failed to stream chat response"
		);
		return true;
	}

	const { abortController, cleanupAbortTracking } = createChatAbortTracking({
		onAbort: () => {
			logger.log("[CHAT-SDK] Client disconnected, aborting Rovo stream");
		},
		req,
		res,
	});
	onCleanupAbortTracking(cleanupAbortTracking);
	const shouldForceCardFirstGenui =
		smartGenerationActive &&
		prefersGenuiCardExperience &&
		!isStrictToolFirstTurn;
	stageTrace.mark("preprocessing_complete", buildRovoPreprocessingTraceData({
		backend: backendSelection.backend,
		chatSdkEntryStartedAtMs,
		promptProfile,
		smartGenerationActive,
		isStrictToolFirstTurn,
	}));

	const stream = createRovoChatStreamFn({
		...handlerDependencies,
		abortController,
		approvalSubmission,
		approvalToolCallId,
		clarificationSubmission,
		clarificationToolCallId,
		deferredToolResponseToolCallId,
		genuiHint,
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
		messages,
		pausedContinuationToolCallId,
		provider,
		rawDeferredToolResponse,
		rawModel,
		requestOrigin,
		resolvedPlanModeActive,
		rovoSessionId,
		sessionMode,
		shouldForceCardFirstGenui,
		smartLayoutContext,
		stageTrace,
		threadId,
		toolFirstPolicy,
		toolFirstRelevanceDomains,
		userMessageText,
		workSummaryStartMs,
	});

	pipeUIMessageStreamToResponse({
		response: res,
		stream,
	});
	return true;
}

module.exports = {
	createRovoChatStream,
	streamRovoChatRoute,
};
