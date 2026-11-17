"use strict";

const { findDirectMediaFenceBody } = require("../lib/direct-media-fence");
const { getNonEmptyString } = require("../lib/shared-utils");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new TypeError(`${name} must be a function`);
	}
}

function buildAudioDataUrl(audioBytes, contentType) {
	const mimeType = getNonEmptyString(contentType) || "audio/mpeg";
	const base64 = Buffer.from(audioBytes).toString("base64");
	return `data:${mimeType};base64,${base64}`;
}

function writeThinkingStatus(writer, { label, activity }) {
	writer.write({
		type: "data-thinking-status",
		data: {
			label,
			activity,
			source: "backend",
		},
	});
}

function writeWidgetLoading(writer, { id, widgetType, loading }) {
	writer.write({
		type: "data-widget-loading",
		id,
		data: { type: widgetType, loading },
	});
}

function writeWidgetError(writer, { id, widgetType, message }) {
	writer.write({
		type: "data-widget-error",
		id,
		data: {
			type: widgetType,
			message,
			canRetry: true,
		},
	});
}

function writeAssistantText(writer, id, text) {
	writer.write({ type: "text-start", id });
	writer.write({
		type: "text-delta",
		id,
		delta: text,
	});
	writer.write({ type: "text-end", id });
}

async function streamAudioWidgetGeneration({
	errorFallbackText = "I couldn't generate audio right now.",
	errorLogLabel = "[MEDIA] Audio generation failed:",
	inputSource,
	logger = console,
	missingInputMessage = "No text available for audio synthesis",
	onBeforeGenerate,
	source,
	stripConversationalFiller,
	synthesizeSound,
	textId,
	voiceInput,
	widgetId,
	widgetPayloadWrapper,
	widgetType,
	writer,
}) {
	requireFunction("stripConversationalFiller", stripConversationalFiller);
	requireFunction("synthesizeSound", synthesizeSound);
	requireFunction("widgetPayloadWrapper", widgetPayloadWrapper);

	writeThinkingStatus(writer, {
		label: "Generating audio",
		activity: "audio",
	});
	writeWidgetLoading(writer, {
		id: widgetId,
		widgetType,
		loading: true,
	});

	try {
		if (onBeforeGenerate) {
			onBeforeGenerate();
		}

		if (!voiceInput) {
			throw new Error(missingInputMessage);
		}

		const synthesisResult = await synthesizeSound({
			input: voiceInput,
			provider: "google",
			model: "tts-latest",
			responseFormat: "mp3",
		});

		writer.write({
			type: "data-widget-data",
			id: widgetId,
			data: {
				type: widgetType,
				payload: widgetPayloadWrapper(widgetType, {
					audioUrl: buildAudioDataUrl(
						synthesisResult.audioBytes,
						synthesisResult.contentType
					),
					mimeType: synthesisResult.contentType,
					transcript: stripConversationalFiller(voiceInput),
					source,
					inputSource: inputSource || undefined,
				}),
			},
		});

		writeAssistantText(writer, textId, voiceInput);
	} catch (audioError) {
		logger.error(errorLogLabel, audioError);
		writeWidgetError(writer, {
			id: widgetId,
			widgetType,
			message: audioError instanceof Error
				? audioError.message
				: "Audio generation failed.",
		});
		writeAssistantText(writer, textId, errorFallbackText);
	} finally {
		writeWidgetLoading(writer, {
			id: widgetId,
			widgetType,
			loading: false,
		});
	}
}

async function streamImageWidgetGeneration({
	errorLogLabel = "[MEDIA] Image generation failed:",
	imageGatewayConfig,
	inputSource,
	isUnsupportedModalitiesError,
	logger = console,
	maxOutputTokens = 1800,
	noImageMessage = "I couldn't generate an image for this request.",
	payloadPrompt,
	prompt,
	source,
	streamGoogleGatewayManualSse,
	system,
	temperature = 1,
	widgetId,
	widgetPayloadWrapper,
	widgetType,
	writer,
}) {
	requireFunction("isUnsupportedModalitiesError", isUnsupportedModalitiesError);
	requireFunction("streamGoogleGatewayManualSse", streamGoogleGatewayManualSse);
	requireFunction("widgetPayloadWrapper", widgetPayloadWrapper);

	const generatedImages = [];
	const resolvedPrompt = getNonEmptyString(prompt);

	writeThinkingStatus(writer, {
		label: "Generating image",
		activity: "image",
	});
	writeWidgetLoading(writer, {
		id: widgetId,
		widgetType,
		loading: true,
	});

	try {
		const streamGoogleImage = async (withModalities) => {
			await streamGoogleGatewayManualSse({
				gatewayUrl: imageGatewayConfig.gatewayUrl,
				envVars: imageGatewayConfig.envVars,
				model: imageGatewayConfig.model,
				system: system || undefined,
				prompt: resolvedPrompt,
				maxOutputTokens,
				temperature,
				responseModalities: withModalities ? ["image"] : undefined,
				onFile: ({ mediaType, base64 }) => {
					if (typeof base64 !== "string" || base64.length === 0) {
						return;
					}
					const resolvedMediaType =
						typeof mediaType === "string" && mediaType.trim()
							? mediaType
							: "image/png";
					if (!resolvedMediaType.startsWith("image/")) {
						return;
					}
					generatedImages.push({
						url: `data:${resolvedMediaType};base64,${base64}`,
						mimeType: resolvedMediaType,
					});
					writer.write({
						type: "data-widget-data",
						id: widgetId,
						data: {
							type: widgetType,
							payload: widgetPayloadWrapper(widgetType, {
								images: [...generatedImages],
								prompt: payloadPrompt,
								source,
								inputSource: inputSource || undefined,
							}),
						},
					});
				},
			});
		};

		try {
			await streamGoogleImage(true);
		} catch (modalitiesError) {
			if (!isUnsupportedModalitiesError(modalitiesError)) {
				throw modalitiesError;
			}
			await streamGoogleImage(false);
		}

		if (generatedImages.length === 0) {
			writeWidgetError(writer, {
				id: widgetId,
				widgetType,
				message: noImageMessage,
			});
		}
	} catch (imageError) {
		logger.error(errorLogLabel, imageError);
		writeWidgetError(writer, {
			id: widgetId,
			widgetType,
			message: imageError instanceof Error
				? imageError.message
				: "Image generation failed.",
		});
	} finally {
		writeWidgetLoading(writer, {
			id: widgetId,
			widgetType,
			loading: false,
		});
	}

	return generatedImages;
}

async function streamSmartRouteImageWidgetGeneration({
	abortSignal,
	emitWidgetData,
	emitWidgetError,
	emitWidgetLoading,
	imageGatewayConfig,
	inputSource,
	isSmartRouteAbortError,
	isUnsupportedModalitiesError,
	latestUserMessage,
	logger = console,
	prompt,
	streamGoogleGatewayManualSse,
	system,
	throwIfAborted,
	toImageWidgetErrorMessage,
	widgetId,
	widgetType,
}) {
	requireFunction("emitWidgetData", emitWidgetData);
	requireFunction("emitWidgetError", emitWidgetError);
	requireFunction("emitWidgetLoading", emitWidgetLoading);
	requireFunction("isSmartRouteAbortError", isSmartRouteAbortError);
	requireFunction("isUnsupportedModalitiesError", isUnsupportedModalitiesError);
	requireFunction("streamGoogleGatewayManualSse", streamGoogleGatewayManualSse);
	requireFunction("throwIfAborted", throwIfAborted);
	requireFunction("toImageWidgetErrorMessage", toImageWidgetErrorMessage);

	const generatedImages = [];
	let attemptedImageGeneration = false;

	emitWidgetLoading(widgetId, widgetType, true);

	try {
		throwIfAborted();
		if (!imageGatewayConfig.ok) {
			emitWidgetError(
				widgetId,
				widgetType,
				toImageWidgetErrorMessage(imageGatewayConfig)
					|| "I couldn't generate an image because Google image routing is not configured."
			);
		} else {
			attemptedImageGeneration = true;
			const streamGoogleImage = async (withModalities) => {
				throwIfAborted();
				await streamGoogleGatewayManualSse({
					gatewayUrl: imageGatewayConfig.gatewayUrl,
					envVars: imageGatewayConfig.envVars,
					model: imageGatewayConfig.model,
					system: system || undefined,
					prompt,
					maxOutputTokens: 1800,
					temperature: 1,
					responseModalities: withModalities ? ["image"] : undefined,
					signal: abortSignal,
					onFile: ({ mediaType, base64 }) => {
						if (abortSignal?.aborted) {
							return;
						}
						if (typeof base64 !== "string" || base64.length === 0) {
							return;
						}
						const resolvedMediaType =
							typeof mediaType === "string" && mediaType.trim()
								? mediaType
								: "image/png";
						if (!resolvedMediaType.startsWith("image/")) {
							return;
						}

						generatedImages.push({
							url: `data:${resolvedMediaType};base64,${base64}`,
							mimeType: resolvedMediaType,
						});
						emitWidgetData(widgetId, widgetType, {
							images: [...generatedImages],
							prompt: latestUserMessage,
							source: "chat-sdk-google-image",
							inputSource: inputSource || undefined,
						});
					},
				});
				throwIfAborted();
			};

			try {
				await streamGoogleImage(true);
			} catch (modalitiesError) {
				if (!isUnsupportedModalitiesError(modalitiesError)) {
					throw modalitiesError;
				}
				logger.warn(
					"[SMART-GENERATION] Google endpoint rejected modalities payload; retrying image request without modalities."
				);
				await streamGoogleImage(false);
			}
		}

		if (
			attemptedImageGeneration &&
			generatedImages.length === 0 &&
			!abortSignal?.aborted
		) {
			emitWidgetError(
				widgetId,
				widgetType,
				"I couldn't generate an image for this request. The model returned no image data."
			);
		}
	} catch (imageError) {
		if (isSmartRouteAbortError(imageError)) {
			return { aborted: true, generatedImages };
		}
		logger.error("[SMART-GENERATION] Image generation failed:", imageError);
		const errorMessage =
			imageError instanceof Error &&
			typeof imageError.message === "string" &&
			imageError.message.trim().length > 0
				? imageError.message.trim()
				: "I couldn't generate an image right now. Check AI_GATEWAY_URL_GOOGLE and GOOGLE_IMAGE_MODEL, then retry.";
		emitWidgetError(
			widgetId,
			widgetType,
			errorMessage
		);
	} finally {
		if (!abortSignal?.aborted) {
			emitWidgetLoading(widgetId, widgetType, false);
		}
	}

	return { aborted: false, generatedImages };
}

async function streamSmartRouteAudioWidgetGeneration({
	abortSignal,
	emitTextDelta,
	emitWidgetData,
	emitWidgetError,
	emitWidgetLoading,
	inputSource,
	isSmartRouteAbortError,
	logger = console,
	shouldEchoVoiceInput = false,
	stripConversationalFiller,
	synthesizeSound,
	throwIfAborted,
	voiceInput,
	widgetId,
	widgetType,
}) {
	requireFunction("emitTextDelta", emitTextDelta);
	requireFunction("emitWidgetData", emitWidgetData);
	requireFunction("emitWidgetError", emitWidgetError);
	requireFunction("emitWidgetLoading", emitWidgetLoading);
	requireFunction("isSmartRouteAbortError", isSmartRouteAbortError);
	requireFunction("stripConversationalFiller", stripConversationalFiller);
	requireFunction("synthesizeSound", synthesizeSound);
	requireFunction("throwIfAborted", throwIfAborted);

	try {
		emitWidgetLoading(widgetId, widgetType, true);
		if (!voiceInput) {
			throw new Error("No text available for audio synthesis");
		}

		const synthesisResult = await synthesizeSound({
			input: voiceInput,
			provider: "google",
			model: "tts-latest",
			responseFormat: "mp3",
			signal: abortSignal,
		});
		throwIfAborted();

		emitWidgetData(widgetId, widgetType, {
			audioUrl: buildAudioDataUrl(
				synthesisResult.audioBytes,
				synthesisResult.contentType
			),
			mimeType: synthesisResult.contentType,
			transcript: stripConversationalFiller(voiceInput),
			source: "sound-generation",
			inputSource: inputSource || undefined,
		});

		if (shouldEchoVoiceInput) {
			emitTextDelta(voiceInput);
		}
	} catch (audioError) {
		if (isSmartRouteAbortError(audioError)) {
			return { aborted: true };
		}
		logger.error("[SMART-GENERATION] Audio generation failed:", audioError);
		emitWidgetError(
			widgetId,
			widgetType,
			"I couldn't generate voice output right now."
		);
		emitTextDelta("I couldn't generate voice output right now.");
	} finally {
		if (!abortSignal?.aborted) {
			emitWidgetLoading(widgetId, widgetType, false);
		}
	}

	return { aborted: false };
}

async function streamDirectRovoImageFenceWidgetGeneration({
	imageGatewayConfig,
	imagePayload = {},
	latestUserMessage,
	logger = console,
	resolveImageGatewayConfig,
	signal,
	streamGoogleGatewayManualSse,
	widgetId,
	widgetPayloadWrapper,
	widgetType,
	writer,
}) {
	requireFunction("streamGoogleGatewayManualSse", streamGoogleGatewayManualSse);
	requireFunction("widgetPayloadWrapper", widgetPayloadWrapper);

	writeWidgetLoading(writer, {
		id: widgetId,
		widgetType,
		loading: true,
	});
	writeThinkingStatus(writer, {
		label: "Generating image",
		activity: "image",
	});

	const prompt = imagePayload.prompt || latestUserMessage;
	try {
		const resolvedImageGatewayConfig = imageGatewayConfig ||
			resolveImageGatewayConfig?.();
		if (resolvedImageGatewayConfig.ok) {
			const generatedImages = [];
			await streamGoogleGatewayManualSse({
				gatewayUrl: resolvedImageGatewayConfig.gatewayUrl,
				envVars: resolvedImageGatewayConfig.envVars,
				model: resolvedImageGatewayConfig.model,
				prompt,
				maxOutputTokens: 1800,
				temperature: 1,
				responseModalities: ["image"],
				signal,
				onFile: ({ mediaType, base64 }) => {
					if (typeof base64 !== "string" || base64.length === 0) {
						return;
					}
					const resolvedMediaType =
						typeof mediaType === "string" && mediaType.trim()
							? mediaType
							: "image/png";
					generatedImages.push({
						url: `data:${resolvedMediaType};base64,${base64}`,
						mimeType: resolvedMediaType,
					});
					writer.write({
						type: "data-widget-data",
						id: widgetId,
						data: {
							type: widgetType,
							payload: widgetPayloadWrapper(widgetType, {
								images: [...generatedImages],
								prompt,
								source: "direct-rovo-image",
							}),
						},
					});
				},
			});
		}
	} catch (imageError) {
		logger.error(
			"[DIRECT-IMAGE] Image generation failed:",
			imageError?.message || imageError
		);
		writeWidgetError(writer, {
			id: widgetId,
			widgetType,
			message: "Image generation failed.",
		});
	} finally {
		writeWidgetLoading(writer, {
			id: widgetId,
			widgetType,
			loading: false,
		});
	}
}

async function streamDirectRovoAudioFenceWidgetGeneration({
	audioPayload = {},
	logger = console,
	synthesizeSound,
	widgetId,
	widgetPayloadWrapper,
	widgetType,
	writer,
}) {
	requireFunction("synthesizeSound", synthesizeSound);
	requireFunction("widgetPayloadWrapper", widgetPayloadWrapper);

	writeWidgetLoading(writer, {
		id: widgetId,
		widgetType,
		loading: true,
	});
	writeThinkingStatus(writer, {
		label: "Generating audio",
		activity: "audio",
	});

	try {
		const synthesisResult = await synthesizeSound({
			input: audioPayload.text,
			provider: "google",
			model: "tts-latest",
			responseFormat: "mp3",
		});
		writer.write({
			type: "data-widget-data",
			id: widgetId,
			data: {
				type: widgetType,
				payload: widgetPayloadWrapper(widgetType, {
					audioUrl: buildAudioDataUrl(
						synthesisResult.audioBytes,
						synthesisResult.contentType
					),
					mimeType: synthesisResult.contentType,
					transcript: audioPayload.text,
					source: "direct-rovo-audio",
				}),
			},
		});
	} catch (audioError) {
		logger.error(
			"[DIRECT-AUDIO] Audio generation failed:",
			audioError?.message || audioError
		);
		writeWidgetError(writer, {
			id: widgetId,
			widgetType,
			message: "Audio generation failed.",
		});
	} finally {
		writeWidgetLoading(writer, {
			id: widgetId,
			widgetType,
			loading: false,
		});
	}
}

async function handleDirectRovoMediaFences({
	abortSignal,
	assistantText,
	detectEndpointType,
	getEnvVars,
	latestUserMessage,
	logger = console,
	now = Date.now,
	rawModel,
	resolveGatewayUrl,
	resolveGoogleImageGatewayConfig,
	streamDirectAudioFenceWidgetGeneration =
		streamDirectRovoAudioFenceWidgetGeneration,
	streamDirectImageFenceWidgetGeneration =
		streamDirectRovoImageFenceWidgetGeneration,
	streamGoogleGatewayManualSse,
	stripDirectMediaFences,
	synthesizeSound,
	widgetPayloadWrapper,
	widgetTypeAudio,
	widgetTypeImage,
	writer,
}) {
	requireFunction("resolveGoogleImageGatewayConfig", resolveGoogleImageGatewayConfig);
	requireFunction("streamDirectAudioFenceWidgetGeneration", streamDirectAudioFenceWidgetGeneration);
	requireFunction("streamDirectImageFenceWidgetGeneration", streamDirectImageFenceWidgetGeneration);
	requireFunction("stripDirectMediaFences", stripDirectMediaFences);

	// The body of the first closed block of each kind, read by the rule every media fence reader uses.
	const imageFenceBody = findDirectMediaFenceBody(assistantText, "image");
	const audioFenceBody = findDirectMediaFenceBody(assistantText, "audio");
	const hasMediaFence = imageFenceBody !== null || audioFenceBody !== null;

	if (imageFenceBody !== null) {
		try {
			const imagePayload = JSON.parse(imageFenceBody.trim());
			const imageWidgetId = `widget-direct-image-${now()}`;
			await streamDirectImageFenceWidgetGeneration({
				imagePayload,
				latestUserMessage,
				resolveImageGatewayConfig: () =>
					resolveGoogleImageGatewayConfig({
						envVars: getEnvVars(),
						requestedModel: rawModel,
						resolveGatewayUrl,
						detectEndpointType,
					}),
				signal: abortSignal,
				streamGoogleGatewayManualSse,
				widgetId: imageWidgetId,
				widgetPayloadWrapper,
				widgetType: widgetTypeImage,
				writer,
			});
			logger.info("[DIRECT-IMAGE] Processed image fence from Rovo", {
				prompt: (imagePayload.prompt || "").slice(0, 80),
			});
		} catch (parseError) {
			logger.warn(
				"[DIRECT-IMAGE] Failed to parse image fence JSON:",
				parseError?.message
			);
		}
	}

	if (audioFenceBody !== null) {
		try {
			const audioPayload = JSON.parse(audioFenceBody.trim());
			const audioWidgetId = `widget-direct-audio-${now()}`;
			await streamDirectAudioFenceWidgetGeneration({
				audioPayload,
				synthesizeSound,
				widgetId: audioWidgetId,
				widgetPayloadWrapper,
				widgetType: widgetTypeAudio,
				writer,
			});
			logger.info("[DIRECT-AUDIO] Processed audio fence from Rovo", {
				textLength: (audioPayload.text || "").length,
			});
		} catch (parseError) {
			logger.warn(
				"[DIRECT-AUDIO] Failed to parse audio fence JSON:",
				parseError?.message
			);
		}
	}

	return {
		assistantText: hasMediaFence
			? stripDirectMediaFences(assistantText)
			: assistantText,
		hasMediaFence,
	};
}

module.exports = {
	buildAudioDataUrl,
	handleDirectRovoMediaFences,
	streamAudioWidgetGeneration,
	streamDirectRovoAudioFenceWidgetGeneration,
	streamDirectRovoImageFenceWidgetGeneration,
	streamImageWidgetGeneration,
	streamSmartRouteAudioWidgetGeneration,
	streamSmartRouteImageWidgetGeneration,
	writeAssistantText,
	writeWidgetError,
	writeWidgetLoading,
};
