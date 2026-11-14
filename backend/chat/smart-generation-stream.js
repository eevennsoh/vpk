"use strict";

function isSmartGenerationAbortError(error) {
	if (!error || typeof error !== "object") {
		return false;
	}
	return error.name === "AbortError" || error.code === "ABORT_ERR";
}

function throwIfSmartGenerationAborted(abortController) {
	if (!abortController.signal.aborted) {
		return;
	}

	const abortError = new Error("Smart generation request aborted");
	abortError.name = "AbortError";
	abortError.code = "ABORT_ERR";
	throw abortError;
}

function sanitizeThinkingLabel(value) {
	if (typeof value !== "string") {
		return "";
	}
	return value.replace(/(?:\s*(?:\.{3}|…))+$/u, "").trim();
}

function createSmartGenerationWriters({
	writer,
	withCanonicalPreviewBody,
}) {
	const textId = `text-${Date.now()}`;
	let textStarted = false;

	const emitTextDelta = (delta) => {
		if (typeof delta !== "string" || delta.length === 0) {
			return;
		}

		if (!textStarted) {
			writer.write({ type: "text-start", id: textId });
			textStarted = true;
		}

		writer.write({ type: "text-delta", id: textId, delta });
	};

	const emitWidgetLoading = (id, type, loading) => {
		writer.write({
			type: "data-widget-loading",
			id,
			data: { type, loading },
		});
	};

	const emitWidgetData = (id, type, payload) => {
		writer.write({
			type: "data-widget-data",
			id,
			data: {
				type,
				payload: withCanonicalPreviewBody(type, payload),
			},
		});
	};

	const emitWidgetError = (id, type, message) => {
		writer.write({
			type: "data-widget-error",
			id,
			data: {
				type,
				message,
				canRetry: true,
			},
		});
	};

	const emitThinkingStatus = (label, content) => {
		const normalizedLabel = sanitizeThinkingLabel(label);
		if (!normalizedLabel) {
			return;
		}

		const rawContent = typeof content === "string" ? content.trim() : "";
		writer.write({
			type: "data-thinking-status",
			data: {
				label: normalizedLabel,
				content: rawContent.length > 0 ? rawContent : undefined,
			},
		});
	};

	return {
		emitTextDelta,
		emitThinkingStatus,
		emitWidgetData,
		emitWidgetError,
		emitWidgetLoading,
		endTextIfStarted() {
			if (textStarted) {
				writer.write({ type: "text-end", id: textId });
			}
		},
		hasTextStarted() {
			return textStarted;
		},
	};
}

function createSmartGenerationStream({
	CLARIFICATION_WIDGET_TYPE,
	GENUI_FALLBACK_ERROR_TEXT,
	SMART_IMAGE_PROMPT_MAX_CHARS,
	SMART_VOICE_INPUT_MAX_CHARS,
	SMART_WIDGET_TYPE_AUDIO,
	SMART_WIDGET_TYPE_GENUI,
	SMART_WIDGET_TYPE_IMAGE,
	abortController,
	backendPreference,
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
	logger = console,
	messages,
	normalizeExcalidrawArtifactOutput,
	provider,
	rawModel,
	requestOrigin,
	resolveGatewayUrl,
	resolveGoogleImageGatewayConfig,
	resolveSmartAudioVoiceInput,
	resolveSmartImagePrompt,
	roleMessages,
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
}) {
	return createUIMessageStream({
		execute: async ({ writer }) => {
			const imageWidgetId = `widget-image-${Date.now()}`;
			const genuiWidgetId = `widget-genui-${Date.now()}`;
			const audioWidgetId = `widget-audio-${Date.now()}`;
			let generatedNarrative = null;
			let emittedAudioClarificationCard = false;
			let emittedImageClarificationCard = false;
			const {
				emitTextDelta,
				emitThinkingStatus,
				emitWidgetData,
				emitWidgetError,
				emitWidgetLoading,
				endTextIfStarted,
				hasTextStarted,
			} = createSmartGenerationWriters({
				writer,
				withCanonicalPreviewBody,
			});
			const throwIfAborted = () => throwIfSmartGenerationAborted(abortController);

			throwIfAborted();
			emitThinkingStatus(
				"Classifying request",
				`Detected intent: ${smartIntentResult.intent}`
			);
			emitThinkingStatus("Preparing generation");

			if (smartIntentResult.intent === "image") {
				const {
					imagePrompt: smartImagePrompt,
					systemInstruction: smartImageSystem,
					source: smartImageSource,
					resolutionType: smartImageResolutionType,
					needsClarification: needsImageClarification,
					clarificationPayload: imageClarificationPayload,
					confidence: smartImageConfidence,
					candidateCount: smartImageCandidateCount,
				} = resolveSmartImagePrompt({
					latestUserMessage,
					latestVisibleUserMessage: latestVisibleUserMessage?.text || latestUserMessage,
					messages,
					maxChars: SMART_IMAGE_PROMPT_MAX_CHARS,
				});

				logger.info("[SMART-GENERATION] Selected image input source", {
					intent: smartIntentResult.intent,
					source: smartImageSource || null,
					resolutionType: smartImageResolutionType || null,
					confidence:
						typeof smartImageConfidence === "number"
							? smartImageConfidence
							: null,
					candidateCount:
						typeof smartImageCandidateCount === "number"
							? smartImageCandidateCount
							: null,
					hasSystemInstruction: Boolean(smartImageSystem),
				});

				if (needsImageClarification) {
					if (imageClarificationPayload) {
						const clarificationWidgetId = `widget-image-clarification-${Date.now()}`;
						emitThinkingStatus("Need clarification");
						emitWidgetLoading(clarificationWidgetId, CLARIFICATION_WIDGET_TYPE, true);
						emitWidgetData(
							clarificationWidgetId,
							CLARIFICATION_WIDGET_TYPE,
							imageClarificationPayload
						);
						emitWidgetLoading(clarificationWidgetId, CLARIFICATION_WIDGET_TYPE, false);
						writer.write(createRouteDecisionPart({
							intent: "chat",
							origin: requestOrigin,
							reason: "intent_clarification",
						}));
						emittedImageClarificationCard = true;
						emitTextDelta("I need one quick detail before generating the image.");
					} else {
						emitTextDelta("I need a bit more detail about what to illustrate.");
					}
				} else {
					emitThinkingStatus("Generating image");
					const imageGatewayConfig = resolveGoogleImageGatewayConfig({
						envVars: getEnvVars(),
						requestedModel: rawModel,
						resolveGatewayUrl,
						detectEndpointType,
					});
					const imageGenerationResult =
						await streamSmartRouteImageWidgetGeneration({
							abortSignal: abortController.signal,
							emitWidgetData,
							emitWidgetError,
							emitWidgetLoading,
							imageGatewayConfig,
							inputSource: smartImageSource,
							isSmartRouteAbortError: isSmartGenerationAbortError,
							isUnsupportedModalitiesError,
							latestUserMessage,
							prompt: smartImagePrompt || userMessageText,
							streamGoogleGatewayManualSse,
							system: smartImageSystem,
							throwIfAborted,
							toImageWidgetErrorMessage,
							widgetId: imageWidgetId,
							widgetType: SMART_WIDGET_TYPE_IMAGE,
						});
					if (imageGenerationResult.aborted) {
						return;
					}
				}
			}

			if (
				smartIntentResult.intent === "genui" ||
				smartIntentResult.intent === "both"
			) {
				const shouldGenerateExcalidrawDiagram = isExcalidrawDiagramRequest(latestUserMessage);
				emitThinkingStatus(
					shouldGenerateExcalidrawDiagram ? "Generating diagram" : "Generating results",
				);
				emitWidgetLoading(genuiWidgetId, SMART_WIDGET_TYPE_GENUI, true);
				try {
					throwIfAborted();
					if (shouldGenerateExcalidrawDiagram) {
						const excalidrawTitle = deriveExcalidrawTitle(latestUserMessage);
						const rawSceneText = await generateTextViaGateway({
							system: buildExcalidrawWidgetSystemPrompt({ title: excalidrawTitle }),
							prompt: [
								"User request:",
								latestUserMessage,
								conversationHistory.length > 0
									? `\nConversation context:\n${conversationHistory
										.map((message) => `${message.type === "assistant" ? "Assistant" : "User"}: ${message.content}`)
										.join("\n")}`
									: null,
							].filter(Boolean).join("\n"),
							maxOutputTokens: 3200,
							temperature: 0.2,
							provider,
							signal: abortController.signal,
							backendPreference,
						});
						throwIfAborted();
						const normalizedScene = normalizeExcalidrawArtifactOutput(rawSceneText);
						if (!normalizedScene) {
							emitTextDelta(GENUI_FALLBACK_ERROR_TEXT);
						} else {
							emitWidgetData(
								genuiWidgetId,
								SMART_WIDGET_TYPE_GENUI,
								buildExcalidrawWidgetPayload({
									prompt: latestUserMessage,
									normalizedSceneJson: normalizedScene,
								}),
							);
							generatedNarrative = latestUserMessage;
						}
					} else {
						const genuiResult = await generateSmartGenuiResult({
							roleMessages,
							layoutContext: smartLayoutContext,
							signal: abortController.signal,
							backendPreference,
						});
						throwIfAborted();
						const summaryText = getNonEmptyString(genuiResult.narrative);
						if (summaryText) {
							generatedNarrative = summaryText;
						}

						const fallbackSpec = summaryText
							? buildFallbackGenuiSpecFromText({
									text: summaryText,
									prompt: latestUserMessage,
								})
							: null;
						const resolvedSpec = genuiResult.spec || fallbackSpec;

						if (resolvedSpec) {
							const hasGeneratedSpec = Boolean(genuiResult.spec);
							emitWidgetData(genuiWidgetId, SMART_WIDGET_TYPE_GENUI, {
								spec: resolvedSpec,
								summary:
									summaryText && summaryText.length > 280
										? `${summaryText.slice(0, 279)}...`
										: summaryText || "Generated interactive preview",
								source: hasGeneratedSpec
									? "genui-chat"
									: "genui-chat-fallback",
							});
						} else {
							emitTextDelta(GENUI_FALLBACK_ERROR_TEXT);
						}
					}
				} catch (genuiError) {
					if (isSmartGenerationAbortError(genuiError)) {
						return;
					}
					logger.error("[SMART-GENERATION] UI generation failed:", genuiError);
					emitTextDelta(GENUI_FALLBACK_ERROR_TEXT);
				} finally {
					if (!abortController.signal.aborted) {
						emitWidgetLoading(genuiWidgetId, SMART_WIDGET_TYPE_GENUI, false);
					}
				}
			}

			if (
				smartIntentResult.intent === "audio" ||
				smartIntentResult.intent === "both"
			) {
				let handledSmartAudioGeneration = false;
				try {
					throwIfAborted();
					const {
						voiceInput,
						source: voiceInputSource,
						extractionMode: voiceInputExtractionMode,
						resolutionType: voiceInputResolutionType,
						needsClarification: needsAudioClarification,
						clarificationPayload: audioClarificationPayload,
						confidence: voiceInputConfidence,
						candidateCount: voiceInputCandidateCount,
					} =
						resolveSmartAudioVoiceInput({
							intent: smartIntentResult.intent,
							latestUserMessage,
							latestVisibleUserMessage: latestVisibleUserMessage?.text || latestUserMessage,
							messages,
							generatedNarrative,
							maxChars: SMART_VOICE_INPUT_MAX_CHARS,
						});
					logger.info("[SMART-GENERATION] Selected audio input source", {
						intent: smartIntentResult.intent,
						source: voiceInputSource,
						extractionMode: voiceInputExtractionMode || null,
						resolutionType: voiceInputResolutionType || null,
						confidence:
							typeof voiceInputConfidence === "number"
								? voiceInputConfidence
								: null,
						candidateCount:
							typeof voiceInputCandidateCount === "number"
								? voiceInputCandidateCount
								: null,
						forcedAudioRoute: forceSmartAudioRoute,
						hasInput: Boolean(voiceInput),
						payloadLength: typeof voiceInput === "string" ? voiceInput.length : 0,
					});

					if (needsAudioClarification) {
						if (audioClarificationPayload) {
							const clarificationWidgetId = `widget-audio-clarification-${Date.now()}`;
							emitThinkingStatus("Need clarification");
							emitWidgetLoading(clarificationWidgetId, CLARIFICATION_WIDGET_TYPE, true);
							emitWidgetData(
								clarificationWidgetId,
								CLARIFICATION_WIDGET_TYPE,
								audioClarificationPayload
							);
							emitWidgetLoading(clarificationWidgetId, CLARIFICATION_WIDGET_TYPE, false);
							emittedAudioClarificationCard = true;
							writer.write(createRouteDecisionPart({
								intent: "chat",
								origin: requestOrigin,
								reason: "intent_clarification",
							}));
							if (smartIntentResult.intent === "audio") {
								emitTextDelta("I need one quick detail before generating the audio clip.");
							}
						} else {
							emitTextDelta("I need a bit more detail about which text to read aloud.");
						}
					} else {
						emitThinkingStatus("Generating audio");
						handledSmartAudioGeneration = true;
						const audioGenerationResult =
							await streamSmartRouteAudioWidgetGeneration({
								abortSignal: abortController.signal,
								emitTextDelta,
								emitWidgetData,
								emitWidgetError,
								emitWidgetLoading,
								inputSource: voiceInputSource,
								isSmartRouteAbortError: isSmartGenerationAbortError,
								shouldEchoVoiceInput: smartIntentResult.intent === "audio",
								stripConversationalFiller,
								synthesizeSound,
								throwIfAborted,
								voiceInput,
								widgetId: audioWidgetId,
								widgetType: SMART_WIDGET_TYPE_AUDIO,
							});
						if (audioGenerationResult.aborted) {
							return;
						}
					}
				} catch (audioError) {
					if (isSmartGenerationAbortError(audioError)) {
						return;
					}
					logger.error("[SMART-GENERATION] Audio generation failed:", audioError);
					emitWidgetError(
						audioWidgetId,
						SMART_WIDGET_TYPE_AUDIO,
						"I couldn't generate voice output right now."
					);
					emitTextDelta("I couldn't generate voice output right now.");
				} finally {
					if (
						!abortController.signal.aborted &&
						!emittedAudioClarificationCard &&
						!handledSmartAudioGeneration
					) {
						emitWidgetLoading(audioWidgetId, SMART_WIDGET_TYPE_AUDIO, false);
					}
				}
			}

			throwIfAborted();
			emitThinkingStatus("Finalizing response");
			const shouldEmitDefaultNarrative =
				smartIntentResult.intent !== "image" &&
				smartIntentResult.intent !== "genui" &&
				smartIntentResult.intent !== "both" &&
				!emittedAudioClarificationCard &&
				!emittedImageClarificationCard;
			if (shouldEmitDefaultNarrative && !hasTextStarted()) {
				emitTextDelta("Completed smart generation request.");
			}

			endTextIfStarted();

			writer.write({
				type: "data-turn-complete",
				data: { timestamp: new Date().toISOString() },
			});
		},
		onError: (error) => {
			if (isSmartGenerationAbortError(error)) {
				return "Smart generation request aborted";
			}
			if (error instanceof Error) {
				return error.message;
			}
			return "Failed to stream smart generation response";
		},
	});
}

function streamSmartGenerationRoute({
	req,
	res,
	logger = console,
	mapUiMessagesToRoleContent,
	messages,
	pipeUIMessageStreamToResponse,
	smartGeneration,
	smartIntentResult,
	...streamOptions
}) {
	logger.info("[SMART-GENERATION] Executing smart route", {
		intent: smartIntentResult.intent,
		forcedAudioRoute: streamOptions.forceSmartAudioRoute,
		surface: smartGeneration.surface,
	});

	const roleMessages = mapUiMessagesToRoleContent(messages);
	const abortController = new AbortController();
	req.on("close", () => {
		if (!abortController.signal.aborted) {
			logger.log("[SMART-GENERATION] Client disconnected, aborting smart route");
			abortController.abort();
		}
	});

	const stream = createSmartGenerationStream({
		...streamOptions,
		abortController,
		logger,
		messages,
		roleMessages,
		smartIntentResult,
	});
	pipeUIMessageStreamToResponse({
		response: res,
		stream,
	});
}

module.exports = {
	createSmartGenerationStream,
	createSmartGenerationWriters,
	isSmartGenerationAbortError,
	streamSmartGenerationRoute,
	throwIfSmartGenerationAborted,
};
