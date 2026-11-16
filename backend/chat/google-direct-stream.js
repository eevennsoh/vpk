"use strict";

const { buildTurnCompletePart } = require("./post-turn");

function createGoogleDirectImageStream({
	createUIMessageStream,
	googleImageConfig,
	isUnsupportedModalitiesError,
	logger = console,
	streamGoogleGatewayManualSse,
	userMessageText,
}) {
	return createUIMessageStream({
		execute: async ({ writer }) => {
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

			const streamGoogleTextOrImage = async (withModalities) => {
				await streamGoogleGatewayManualSse({
					gatewayUrl: googleImageConfig.gatewayUrl,
					envVars: googleImageConfig.envVars,
					model: googleImageConfig.model,
					prompt: userMessageText,
					maxOutputTokens: 2000,
					temperature: 1,
					responseModalities: withModalities ? ["image"] : undefined,
					onTextDelta: emitTextDelta,
					onFile: ({ mediaType, base64 }) => {
						if (typeof base64 !== "string" || base64.length === 0) {
							return;
						}

						const resolvedMediaType =
							typeof mediaType === "string" && mediaType.trim()
								? mediaType
								: "image/png";
						writer.write({
							type: "file",
							mediaType: resolvedMediaType,
							url: `data:${resolvedMediaType};base64,${base64}`,
						});
					},
				});
			};

			try {
				await streamGoogleTextOrImage(true);
			} catch (modalitiesError) {
				if (!isUnsupportedModalitiesError(modalitiesError)) {
					throw modalitiesError;
				}
				logger.warn(
					"[CHAT-SDK] Google endpoint rejected modalities payload; retrying without modalities."
				);
				await streamGoogleTextOrImage(false);
			}

			if (textStarted) {
				writer.write({ type: "text-end", id: textId });
			}
			// The client treats a turn that closes without this signal as cut short.
			writer.write(buildTurnCompletePart());
		},
		onError: (error) => {
			if (error instanceof Error) {
				return error.message;
			}
			return "Failed to stream Google AI response";
		},
	});
}

function streamGoogleDirectImageRoute({
	createUIMessageStream,
	detectEndpointType,
	getEnvVars,
	inferPromptIntent,
	isStrictToolFirstTurn,
	isUnsupportedModalitiesError,
	latestUserMessage,
	logger = console,
	pipeUIMessageStreamToResponse,
	provider,
	rawModel,
	res,
	resolveGatewayUrl,
	resolveGoogleImageGatewayConfig,
	streamGoogleGatewayManualSse,
	userMessageText,
}) {
	const directGoogleIntent = inferPromptIntent(latestUserMessage);
	if (
		provider !== "google" ||
		isStrictToolFirstTurn ||
		directGoogleIntent !== "image"
	) {
		return false;
	}

	const googleImageConfig = resolveGoogleImageGatewayConfig({
		envVars: getEnvVars(),
		requestedModel: rawModel,
		resolveGatewayUrl,
		detectEndpointType,
	});
	if (!googleImageConfig.ok) {
		res.status(googleImageConfig.statusCode).json({
			error: googleImageConfig.error,
			details: googleImageConfig.details,
		});
		return true;
	}

	const stream = createGoogleDirectImageStream({
		createUIMessageStream,
		googleImageConfig,
		isUnsupportedModalitiesError,
		logger,
		streamGoogleGatewayManualSse,
		userMessageText,
	});

	pipeUIMessageStreamToResponse({
		response: res,
		stream,
	});
	return true;
}

module.exports = {
	createGoogleDirectImageStream,
	streamGoogleDirectImageRoute,
};
