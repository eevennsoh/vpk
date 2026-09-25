"use strict";

const { compressConversation } = require("./conversation-compression");
const {
	buildRovoAppArtifactContext,
} = require("./rovo-app-artifact-generation");
const {
	normalizeArtifactKind,
} = require("./rovo-app-artifact-intent");
const {
	applyAtlassianLogoToHtmlArtifact,
	deriveRovoAppVersionChangeLabel,
} = require("./rovo-app-artifact-updates");
const {
	deriveRovoAppArtifactTitle,
} = require("./rovo-app-artifact-titles");
const { getNonEmptyString } = require("./shared-utils");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`createRovoAppArtifactToolRequestHandler requires ${name}`);
	}
	return value;
}

function createRovoAppArtifactToolRequestHandler({
	compressConversationHistory = compressConversation,
	logger = console,
	mapUiMessagesToConversation,
	resolveRovoAppArtifactDecision,
	resolveRovoAppArtifactKind,
	rovoAppDocumentManager,
	rovoAppThreadManager,
	streamRovoAppArtifactToolResponse,
} = {}) {
	requireFunction("compressConversationHistory", compressConversationHistory);
	requireFunction("logger.info", logger?.info);
	requireFunction("logger.warn", logger?.warn);
	requireFunction("mapUiMessagesToConversation", mapUiMessagesToConversation);
	requireFunction("resolveRovoAppArtifactDecision", resolveRovoAppArtifactDecision);
	requireFunction("resolveRovoAppArtifactKind", resolveRovoAppArtifactKind);
	requireFunction("rovoAppDocumentManager.appendDocumentVersion", rovoAppDocumentManager?.appendDocumentVersion);
	requireFunction("rovoAppDocumentManager.createDocumentShell", rovoAppDocumentManager?.createDocumentShell);
	requireFunction("rovoAppDocumentManager.getDocument", rovoAppDocumentManager?.getDocument);
	requireFunction("rovoAppThreadManager.updateThread", rovoAppThreadManager?.updateThread);
	requireFunction("streamRovoAppArtifactToolResponse", streamRovoAppArtifactToolResponse);

	async function handleRovoAppArtifactToolRequest({
		activeArtifact,
		activeDocument,
		artifactSteering,
		artifactBackendPreference,
		contextDescription,
		requestOrigin,
		requestBody,
		signal,
		streamingArtifact,
		threadId,
	}) {
		const { message: latestUserMessage, conversationHistory: rawConversationHistory } =
			mapUiMessagesToConversation(requestBody.messages);
		if (!latestUserMessage) {
			return false;
		}

		const compressionResult = compressConversationHistory(rawConversationHistory, {
			thresholdChars: 80_000,
			tailCount: 8,
		});
		const conversationHistory = compressionResult.messages;
		if (compressionResult.compressed) {
			logger.info(
				`[CHAT] Compressed conversation history: ${rawConversationHistory.length} -> ${conversationHistory.length} messages`,
			);
		}

		const legacyArtifactMode = getNonEmptyString(requestBody.futureArtifactMode);
		const legacyArtifactTitle = getNonEmptyString(requestBody.futureArtifactTitle);
		const legacyArtifactKind = getNonEmptyString(requestBody.futureArtifactKind);
		const decision =
			legacyArtifactMode && legacyArtifactTitle
				? {
						action: legacyArtifactMode === "update" ? "updateDocument" : "createDocument",
						title: legacyArtifactTitle,
						kind: normalizeArtifactKind(legacyArtifactKind),
						cancelStreaming: null,
					}
					: await resolveRovoAppArtifactDecision({
						activeArtifact,
						artifactSteering,
						conversationHistory,
						latestUserMessage,
						provider: getNonEmptyString(requestBody.provider),
						signal,
						streamingArtifact,
					});

		if (decision.action === "chat") {
			return false;
		}

		let resolvedContextDescription = contextDescription;
		let deterministicArtifactContent = null;

		const artifactTitle = deriveRovoAppArtifactTitle({
			action: decision.action,
			activeArtifact,
			conversationHistory,
			decisionTitle: decision.title,
			latestUserMessage,
		});
		const artifactKind = resolveRovoAppArtifactKind({
			action: decision.action,
			activeArtifact,
			decisionKind: decision.kind,
		});

		let artifactDocument;
		let existingDocument = null;
		const previousActiveDocumentId =
			getNonEmptyString(activeDocument?.id) || getNonEmptyString(activeArtifact?.id);
		let changeLabel = deriveRovoAppVersionChangeLabel({
			artifactAction: decision.action,
			artifactSteering,
			latestUserMessage,
			nextTitle: artifactTitle,
			previousTitle: getNonEmptyString(activeArtifact?.title),
		});
		if (decision.action === "updateDocument") {
			if (!activeArtifact?.id) {
				return false;
			}

			existingDocument =
				activeDocument?.id === activeArtifact.id
					? activeDocument
					: await rovoAppDocumentManager.getDocument(activeArtifact.id);
			if (!existingDocument) {
				return false;
			}

			const existingContent = getNonEmptyString(existingDocument.versions?.at(-1)?.content);
			deterministicArtifactContent = applyAtlassianLogoToHtmlArtifact({
				content: existingContent,
				latestUserMessage,
			});
			if (!deterministicArtifactContent) {
				const artifactContextBlock = buildRovoAppArtifactContext(activeArtifact);
				resolvedContextDescription = artifactContextBlock
					? contextDescription
						? `${artifactContextBlock}\n\n${contextDescription}`
						: artifactContextBlock
					: contextDescription;
			}

			artifactDocument = {
				id: existingDocument.id,
				title: artifactTitle || existingDocument.title,
				kind: artifactKind || existingDocument.kind,
			};
			changeLabel = deriveRovoAppVersionChangeLabel({
				artifactAction: decision.action,
				artifactSteering,
				latestUserMessage,
				nextTitle: artifactDocument.title,
				previousTitle: existingDocument.title,
			});
		} else {
			if (!threadId) {
				return false;
			}

			const documentShell = await rovoAppDocumentManager.createDocumentShell({
				threadId,
				title: artifactTitle,
				kind: artifactKind,
			});
			artifactDocument = {
				id: documentShell.id,
				title: documentShell.title,
				kind: documentShell.kind,
			};
		}

		const artifactThreadId =
			getNonEmptyString(threadId) || getNonEmptyString(existingDocument?.threadId);
		if (artifactThreadId) {
			void rovoAppThreadManager.updateThread(artifactThreadId, {
				activeDocumentId: artifactDocument.id,
			}).catch((error) => {
				logger.warn(
					"[FUTURE-CHAT] Failed to persist active artifact selection:",
					error instanceof Error ? error.message : error,
				);
			});
		}

		if (decision.cancelStreaming === true && streamingArtifact?.id) {
			const partialContent = getNonEmptyString(streamingArtifact.content);
			if (partialContent) {
				try {
					await rovoAppDocumentManager.appendDocumentVersion(streamingArtifact.id, {
						changeLabel: "Partial (replaced)",
						title: streamingArtifact.title,
						kind: streamingArtifact.kind,
						content: partialContent,
					});
				} catch (error) {
					logger.warn(
						"[FUTURE-CHAT] Failed to save partial artifact version:",
						error instanceof Error ? error.message : error,
					);
				}
			}
		}

		const response = streamRovoAppArtifactToolResponse({
			artifactAction: decision.action,
			artifactDocument,
			artifactBackendPreference,
			cancelStreaming: decision.cancelStreaming,
			changeLabel,
			contextDescription: resolvedContextDescription,
			conversationHistory,
			deterministicArtifactContent,
			latestUserMessage,
			requestOrigin,
			provider: getNonEmptyString(requestBody.provider),
			signal,
			artifactThreadId,
			previousActiveDocumentId,
		});
		return {
			handled: true,
			response,
		};
	}

	return {
		handleRovoAppArtifactToolRequest,
	};
}

module.exports = {
	createRovoAppArtifactToolRequestHandler,
};
