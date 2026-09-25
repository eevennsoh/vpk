"use strict";

const {
	generateTextViaRovo: defaultGenerateTextViaRovo,
	streamViaRovo: defaultStreamViaRovo,
	WAIT_FOR_TURN_TIMEOUT_MS,
} = require("./rovo-gateway");
const {
	compressConversation: defaultCompressConversation,
} = require("./conversation-compression");
const { getGenuiSystemPrompt: defaultGetGenuiSystemPrompt } = require("./genui-system-prompt");
const {
	analyzeGeneratedText: defaultAnalyzeGeneratedText,
	pickBestSpec: defaultPickBestSpec,
} = require("./genui-spec-utils");
const {
	assessToolFirstGenuiQuality: defaultAssessToolFirstGenuiQuality,
} = require("./tool-first-genui-quality");
const {
	extractTextFromUiParts: defaultExtractTextFromUiParts,
	getNonEmptyString: defaultGetNonEmptyString,
} = require("./shared-utils");
const {
	createRovoUnavailableError: defaultCreateRovoUnavailableError,
	normalizeAIGatewayError: defaultNormalizeAIGatewayError,
} = require("../chat/error-response");

const GENUI_META_PREFIX = "[genui-meta]";

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createGatewayTextGenerationService requires ${name}`);
	}
	return value;
}

function buildRovoTextGenerationMessage({ system, prompt }) {
	let fullMessage = "";
	if (system) {
		fullMessage += `[System Instructions]\n${system}\n[End System Instructions]\n\n`;
	}
	fullMessage += prompt;
	return fullMessage;
}

function parseGenuiMetaAndBody(rawText) {
	if (typeof rawText !== "string" || rawText.length === 0) {
		return { meta: null, body: "" };
	}

	const lines = rawText.split("\n");
	const firstLine = lines[0]?.trim() ?? "";
	if (!firstLine.startsWith(GENUI_META_PREFIX)) {
		return { meta: null, body: rawText };
	}

	const maybeJson = firstLine.slice(GENUI_META_PREFIX.length).trim();
	try {
		return {
			meta: JSON.parse(maybeJson),
			body: lines.slice(1).join("\n").trimStart(),
		};
	} catch {
		return { meta: null, body: rawText };
	}
}

function stripSpecBlocks(value) {
	if (typeof value !== "string" || value.length === 0) {
		return "";
	}

	return value
		.replace(/```spec[\s\S]*?```/gi, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function createGatewayTextGenerationService({
	aiGatewayProvider,
	analyzeGeneratedText = defaultAnalyzeGeneratedText,
	assessToolFirstGenuiQuality = defaultAssessToolFirstGenuiQuality,
	compressConversation = defaultCompressConversation,
	createRovoUnavailableError = defaultCreateRovoUnavailableError,
	debugLog = () => {},
	extractTextFromUiParts = defaultExtractTextFromUiParts,
	generateTextViaRovo = defaultGenerateTextViaRovo,
	getGenuiSystemPrompt = defaultGetGenuiSystemPrompt,
	getNonEmptyString = defaultGetNonEmptyString,
	normalizeAIGatewayError = defaultNormalizeAIGatewayError,
	pickBestSpec = defaultPickBestSpec,
	resolvePreferredBackend,
	streamViaRovo = defaultStreamViaRovo,
	waitForTurnTimeoutMs = WAIT_FOR_TURN_TIMEOUT_MS,
} = {}) {
	requireFunction("aiGatewayProvider.generateText", aiGatewayProvider?.generateText);
	requireFunction("aiGatewayProvider.streamText", aiGatewayProvider?.streamText);
	requireFunction("analyzeGeneratedText", analyzeGeneratedText);
	requireFunction("assessToolFirstGenuiQuality", assessToolFirstGenuiQuality);
	requireFunction("compressConversation", compressConversation);
	requireFunction("createRovoUnavailableError", createRovoUnavailableError);
	requireFunction("debugLog", debugLog);
	requireFunction("extractTextFromUiParts", extractTextFromUiParts);
	requireFunction("generateTextViaRovo", generateTextViaRovo);
	requireFunction("getGenuiSystemPrompt", getGenuiSystemPrompt);
	requireFunction("getNonEmptyString", getNonEmptyString);
	requireFunction("normalizeAIGatewayError", normalizeAIGatewayError);
	requireFunction("pickBestSpec", pickBestSpec);
	requireFunction("resolvePreferredBackend", resolvePreferredBackend);
	requireFunction("streamViaRovo", streamViaRovo);

	async function generateTextViaGateway({
		system,
		prompt,
		messages,
		maxOutputTokens = 2000,
		temperature = 0.4,
		provider,
		gatewayUrl,
		signal,
		backendPreference = "rovo",
	}) {
		const backendSelection = await resolvePreferredBackend({ backendPreference });
		if (backendSelection.backend === "rovo") {
			debugLog("GENERATE", "Routing through Rovo Serve");
			return await generateTextViaRovo({
				system,
				prompt,
				conflictPolicy: "wait-for-turn",
				timeoutMs: waitForTurnTimeoutMs,
				signal,
			});
		}

		if (backendSelection.backend !== "ai-gateway") {
			throw createRovoUnavailableError();
		}

		debugLog("GENERATE", "Routing through AI Gateway");
		try {
			return await aiGatewayProvider.generateText({
				system,
				prompt,
				messages,
				maxOutputTokens,
				temperature,
				provider,
				gatewayUrl,
				signal,
			});
		} catch (error) {
			throw normalizeAIGatewayError(error);
		}
	}

	async function streamTextViaGateway({
		system,
		prompt,
		messages,
		maxOutputTokens = 2000,
		temperature = 0.4,
		provider,
		gatewayUrl,
		signal,
		backendPreference = "rovo",
		onTextDelta,
	}) {
		const backendSelection = await resolvePreferredBackend({ backendPreference });
		let bufferedText = "";
		const handleTextDelta = (delta) => {
			if (typeof delta !== "string" || delta.length === 0) {
				return;
			}

			bufferedText += delta;
			if (typeof onTextDelta === "function") {
				onTextDelta(delta);
			}
		};

		if (backendSelection.backend === "rovo") {
			debugLog("STREAM_GENERATE", "Routing through Rovo Serve");
			await streamViaRovo({
				message: buildRovoTextGenerationMessage({ system, prompt }),
				onTextDelta: handleTextDelta,
				conflictPolicy: "wait-for-turn",
				timeoutMs: waitForTurnTimeoutMs,
				signal,
			});
			return bufferedText.trim();
		}

		if (backendSelection.backend !== "ai-gateway") {
			throw createRovoUnavailableError();
		}

		debugLog("STREAM_GENERATE", "Routing through AI Gateway");
		try {
			return await aiGatewayProvider.streamText({
				system,
				prompt,
				messages,
				maxOutputTokens,
				temperature,
				provider,
				gatewayUrl,
				signal,
				onTextDelta: handleTextDelta,
			});
		} catch (error) {
			throw normalizeAIGatewayError(error);
		}
	}

	function mapUiMessagesToConversation(messages) {
		if (!Array.isArray(messages)) {
			return { message: "", conversationHistory: [] };
		}

		const conversation = messages
			.map((message) => {
				if (!message || (message.role !== "user" && message.role !== "assistant")) {
					return null;
				}

				const content = extractTextFromUiParts(message.parts);
				if (!content) {
					return null;
				}

				return {
					type: message.role,
					content,
				};
			})
			.filter(Boolean);

		let currentUserMessageIndex = -1;
		for (let index = conversation.length - 1; index >= 0; index--) {
			if (conversation[index].type === "user") {
				currentUserMessageIndex = index;
				break;
			}
		}

		if (currentUserMessageIndex === -1) {
			return { message: "", conversationHistory: conversation };
		}

		return {
			message: conversation[currentUserMessageIndex].content,
			conversationHistory: conversation.slice(0, currentUserMessageIndex),
		};
	}

	function compressUiConversationHistory(conversationHistory, options) {
		const normalizedConversation = Array.isArray(conversationHistory)
			? conversationHistory
				.flatMap((message) => {
					if (!message || typeof message !== "object") {
						return [];
					}

					const type = message.type === "user" ? "user" : "assistant";
					const content = getNonEmptyString(message.content);
					return content ? [{ type, content }] : [];
				})
			: [];
		const compressionResult = compressConversation(
			normalizedConversation.map((message) => ({
				role: message.type === "user" ? "user" : "assistant",
				content: message.content,
			})),
			options,
		);

		return {
			compressed: compressionResult.compressed,
			conversationHistory: compressionResult.messages
				.flatMap((message) => {
					const content = getNonEmptyString(message?.content);
					if (!content) {
						return [];
					}

					return [{
						type: message.role === "user" ? "user" : "assistant",
						content,
					}];
				}),
			length: compressionResult.length,
			originalLength: normalizedConversation.length,
		};
	}

	async function generateSmartGenuiResult({
		roleMessages,
		layoutContext,
		signal,
	}) {
		const systemPrompt = getGenuiSystemPrompt({
			strict: true,
			layoutContext,
		});
		const conversationPrompt = roleMessages
			.map((message) => `[${message.role === "assistant" ? "Assistant" : "User"}]\n${message.content}`)
			.join("\n\n");

		const rawText = await generateTextViaGateway({
			system: systemPrompt,
			prompt: conversationPrompt,
			maxOutputTokens: 3500,
			temperature: 0.3,
			signal,
		});

		const { meta, body } = parseGenuiMetaAndBody(rawText);
		const analysis = analyzeGeneratedText(body);
		const bestSpec = pickBestSpec(analysis);
		const qualityAssessment = assessToolFirstGenuiQuality({
			analysis,
			spec: bestSpec,
			prompt: conversationPrompt,
		});
		return {
			rawText,
			meta,
			spec: bestSpec,
			narrative: stripSpecBlocks(body),
			quality: qualityAssessment.quality,
			analysisSummary: {
				synthesizedChildCount: qualityAssessment.synthesizedChildCount,
				missingChildKeyCount: qualityAssessment.missingChildKeyCount,
				usedSynthesizedSpec: qualityAssessment.usedSynthesizedSpec,
				hasRecoveredPlaceholderSection:
					qualityAssessment.hasRecoveredPlaceholderSection,
				reasons: qualityAssessment.reasons,
			},
		};
	}

	return {
		compressUiConversationHistory,
		generateSmartGenuiResult,
		generateTextViaGateway,
		mapUiMessagesToConversation,
		streamTextViaGateway,
	};
}

module.exports = {
	GENUI_META_PREFIX,
	buildRovoTextGenerationMessage,
	createGatewayTextGenerationService,
	parseGenuiMetaAndBody,
	stripSpecBlocks,
};
