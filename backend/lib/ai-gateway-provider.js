const {
	getEnvVars,
	getAuthToken,
	detectEndpointType,
	getGatewayHeaders,
	getModelId,
	resolveGatewayUrl,
	describeGatewayCloudIdError,
	streamBedrockGatewayManualSse,
	streamGoogleGatewayManualSse,
} = require("./ai-gateway-helpers");
const { getNonEmptyString } = require("./shared-utils");

function normalizeMessages(messages) {
	if (!Array.isArray(messages)) {
		return [];
	}

	return messages
		.map((message) => {
			if (!message || typeof message !== "object") {
				return null;
			}

			const role = message.role === "assistant" ? "assistant" : "user";
			const content = getNonEmptyString(message.content);
			if (!content) {
				return null;
			}

			return {
				role,
				content,
			};
		})
		.filter(Boolean);
}

function toBedrockMessages(messages) {
	return normalizeMessages(messages).map((message) => ({
		role: message.role,
		content: [{ type: "text", text: message.content }],
	}));
}

function toOpenAiMessages({ system, prompt, messages }) {
	const normalizedMessages = normalizeMessages(messages);
	const nextMessages = [];

	const normalizedSystem = getNonEmptyString(system);
	if (normalizedSystem) {
		nextMessages.push({
			role: "system",
			content: normalizedSystem,
		});
	}

	nextMessages.push(
		...normalizedMessages.map((message) => ({
			role: message.role,
			content: message.content,
		}))
	);

	const normalizedPrompt = getNonEmptyString(prompt);
	if (normalizedPrompt) {
		nextMessages.push({
			role: "user",
			content: normalizedPrompt,
		});
	}

	return nextMessages;
}

function extractTextFromOpenAiChoice(choice) {
	const messageContent = choice?.message?.content;
	if (typeof messageContent === "string" && messageContent.trim()) {
		return messageContent.trim();
	}

	if (Array.isArray(messageContent)) {
		const joinedText = messageContent
			.map((item) => {
				if (typeof item === "string") {
					return item;
				}

				if (!item || typeof item !== "object") {
					return "";
				}

				const textValue =
					typeof item.text === "string"
						? item.text
						: typeof item.content === "string"
							? item.content
							: "";
				return textValue;
			})
			.join("")
			.trim();
		if (joinedText) {
			return joinedText;
		}
	}

	return "";
}

function extractTextFromOpenAiResponse(payload) {
	if (!payload || typeof payload !== "object") {
		return "";
	}

	const directText = getNonEmptyString(payload.output_text);
	if (directText) {
		return directText;
	}

	if (Array.isArray(payload.choices) && payload.choices.length > 0) {
		for (const choice of payload.choices) {
			const choiceText = extractTextFromOpenAiChoice(choice);
			if (choiceText) {
				return choiceText;
			}
		}
	}

	return "";
}

function resolveGatewayUrlForProvider(envVars, preferredProvider, providedGatewayUrl) {
	if (getNonEmptyString(providedGatewayUrl)) {
		return providedGatewayUrl;
	}

	if (preferredProvider === "google") {
		return envVars.AI_GATEWAY_URL_GOOGLE || envVars.AI_GATEWAY_URL;
	}

	return envVars.AI_GATEWAY_URL || envVars.AI_GATEWAY_URL_GOOGLE;
}

function createAbortError(message = "AI Gateway request aborted") {
	const error = new Error(message);
	error.name = "AbortError";
	error.code = "ABORT_ERR";
	return error;
}

function throwIfAborted(signal, message) {
	if (!signal?.aborted) {
		return;
	}
	throw createAbortError(message);
}

async function fetchOpenAiCompatibleCompletion({
	gatewayUrl,
	envVars,
	system,
	prompt,
	messages,
	maxOutputTokens,
	temperature,
	signal,
}) {
	throwIfAborted(signal, "AI Gateway request aborted");
	const token = await getAuthToken();
	const resolvedMessages = toOpenAiMessages({
		system,
		prompt,
		messages,
	});

	if (resolvedMessages.length === 0) {
		throw new Error("AI Gateway request requires at least one message.");
	}

	const payload = {
		model: getModelId(gatewayUrl),
		messages: resolvedMessages,
		stream: false,
	};

	if (typeof maxOutputTokens === "number") {
		payload.max_completion_tokens = maxOutputTokens;
	}

	if (typeof temperature === "number") {
		payload.temperature = temperature;
	}

	const response = await fetch(gatewayUrl, {
		method: "POST",
		headers: getGatewayHeaders(envVars, token, false),
		body: JSON.stringify(payload),
		signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`AI Gateway OpenAI-compatible request failed (${response.status}): ${describeGatewayCloudIdError(errorText).slice(0, 500)}`
		);
	}

	const responsePayload = await response.json();
	const responseText = extractTextFromOpenAiResponse(responsePayload);
	if (!responseText) {
		throw new Error("AI Gateway OpenAI-compatible response did not include text.");
	}

	return responseText;
}

function createAIGatewayProvider(options = {}) {
	const logger = options.logger || console;

	async function streamText({
		system,
		prompt,
		messages,
		maxOutputTokens = 2000,
		temperature = 0.4,
		provider,
		gatewayUrl,
		onTextDelta,
		onFile,
		signal,
	} = {}) {
		throwIfAborted(signal, "AI Gateway request aborted");
		const envVars = getEnvVars();
		const rawGatewayUrl = resolveGatewayUrlForProvider(
			envVars,
			getNonEmptyString(provider),
			gatewayUrl
		);
		if (!rawGatewayUrl) {
			throw new Error("AI Gateway URL is not configured.");
		}

		const resolvedGatewayUrl = resolveGatewayUrl(rawGatewayUrl) || rawGatewayUrl;
		const endpointType = detectEndpointType(resolvedGatewayUrl);

		if (endpointType === "bedrock") {
			throwIfAborted(signal, "AI Gateway request aborted");
			const result = await streamBedrockGatewayManualSse({
				gatewayUrl: resolvedGatewayUrl,
				envVars,
				system: getNonEmptyString(system) || undefined,
				prompt: getNonEmptyString(prompt) || undefined,
				messages: toBedrockMessages(messages),
				maxOutputTokens,
				onTextDelta,
				signal,
			});
			return (result.text || "").trim();
		}

		if (endpointType === "google") {
			throwIfAborted(signal, "AI Gateway request aborted");
			const result = await streamGoogleGatewayManualSse({
				gatewayUrl: resolvedGatewayUrl,
				envVars,
				model: getModelId(resolvedGatewayUrl),
				system: getNonEmptyString(system) || undefined,
				prompt: getNonEmptyString(prompt) || undefined,
				messages: normalizeMessages(messages),
				maxOutputTokens,
				temperature,
				signal,
				onTextDelta,
				onFile,
			});
			return (result.text || "").trim();
		}

		try {
			const resultText = (
				await fetchOpenAiCompatibleCompletion({
					gatewayUrl: resolvedGatewayUrl,
					envVars,
					system,
					prompt,
					messages,
					maxOutputTokens,
					temperature,
					signal,
				})
			).trim();
			if (resultText && typeof onTextDelta === "function") {
				onTextDelta(resultText);
			}
			return resultText;
		} catch (error) {
			logger.warn?.(
				"[AI_GATEWAY_PROVIDER] OpenAI-compatible call failed, retrying with Google stream parser if possible.",
				error
			);

			const fallbackResult = await streamGoogleGatewayManualSse({
				gatewayUrl: resolvedGatewayUrl,
				envVars,
				model: getModelId(resolvedGatewayUrl),
				system: getNonEmptyString(system) || undefined,
				prompt: getNonEmptyString(prompt) || undefined,
				messages: normalizeMessages(messages),
				maxOutputTokens,
				temperature,
				signal,
				onTextDelta,
				onFile,
			});
			return (fallbackResult.text || "").trim();
		}
	}

	async function generateText({
		system,
		prompt,
		messages,
		maxOutputTokens = 2000,
		temperature = 0.4,
		provider,
		gatewayUrl,
		signal,
	} = {}) {
		return streamText({
			system,
			prompt,
			messages,
			maxOutputTokens,
			temperature,
			provider,
			gatewayUrl,
			signal,
		});
	}

	return {
		streamText,
		generateText,
	};
}

module.exports = {
	createAIGatewayProvider,
};
