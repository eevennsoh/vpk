const { getNonEmptyString } = require("./shared-utils");
const {
	extractRovoAppRequestedTitle,
	isExplicitNewRovoAppArtifactRequest,
	isSameRovoAppArtifactVersionRequest,
} = require("./rovo-app-artifact-updates");
const {
	inferRovoAppArtifactKindFromRequest,
	normalizeRovoAppArtifactKind,
} = require("./rovo-app-artifact-kind");

function normalizeArtifactKind(value) {
	return normalizeRovoAppArtifactKind(value);
}

// Shared regex patterns used by both fallback and fast intent classifiers.
const DOCUMENT_VERB_PATTERN =
	/\b(write|draft|create|build|generate|make|compose|outline|summari[sz]e|plan|design|implement|refactor|turn|convert)\b/;
const DOCUMENT_NOUN_PATTERN =
	/\b(document|doc|plan|brief|proposal|spec|summary|memo|outline|report|email|copy|article|blog|code|component|app|page|ui|table|spreadsheet|sheet|artifact)\b/;
const MODIFICATION_VERB_PATTERN =
	/\b(update|edit|revise|rewrite|shorten|expand|polish|refine|change|format|convert|improve|fix)\b/;
const PRONOUN_REFERENCE_PATTERN = /\b(it|this|that)\b/;

function matchesDocumentRequest(lowerMessage) {
	return DOCUMENT_VERB_PATTERN.test(lowerMessage) && DOCUMENT_NOUN_PATTERN.test(lowerMessage);
}

function matchesModificationRequest(lowerMessage, activeArtifact, streamingArtifact) {
	return (
		Boolean(activeArtifact?.id || streamingArtifact?.id) &&
		MODIFICATION_VERB_PATTERN.test(lowerMessage)
	);
}

function referencesPronoun(lowerMessage) {
	return PRONOUN_REFERENCE_PATTERN.test(lowerMessage);
}

function parseJsonFromText(rawText) {
	try {
		return JSON.parse(rawText);
	} catch {
		const objectMatch = typeof rawText === "string" ? rawText.match(/\{[\s\S]*\}/) : null;
		if (!objectMatch) {
			return null;
		}

		try {
			return JSON.parse(objectMatch[0]);
		} catch {
			return null;
		}
	}
}

function buildRovoAppArtifactIntentPrompt({
	activeArtifact,
	artifactSteering,
	conversationHistory,
	latestUserMessage,
	streamingArtifact,
}) {
	const activeArtifactBlock = activeArtifact
		? [
				"Current open artifact:",
				`- id: ${activeArtifact.id || "unknown"}`,
				`- title: ${activeArtifact.title || "Untitled artifact"}`,
				`- kind: ${activeArtifact.kind || "text"}`,
			].join("\n")
		: "No artifact is currently open.";

	const streamingArtifactBlock = streamingArtifact
		? [
				"An artifact is currently being generated:",
				`- id: ${streamingArtifact.id || "unknown"}`,
				`- title: ${streamingArtifact.title || "Untitled artifact"}`,
				`- kind: ${streamingArtifact.kind || "text"}`,
				"Decide whether to cancel the current generation (cancelStreaming: true) to replace it, or keep it running in the background (cancelStreaming: false) and start a new artifact.",
			].join("\n")
		: null;

	const conversationContext =
		Array.isArray(conversationHistory) && conversationHistory.length > 0
			? conversationHistory
					.map((message) => `${message.type === "assistant" ? "Assistant" : "User"}: ${message.content}`)
					.join("\n")
			: "No previous conversation.";
	const steeringContext =
		artifactSteering?.preferCurrentArtifact && activeArtifact?.id
			? [
					"Voice steering context:",
					"- This request arrived as a live steering update while the current artifact workspace was active.",
					"- If the request is ambiguous, prefer updateDocument over chat or createDocument.",
					"- Only choose createDocument when the user clearly asks for a new/separate artifact.",
				].join("\n")
			: null;

	return `Classify the user's latest request for a chat app with a document workspace.
Return ONLY valid JSON with this shape:
{
  "action": "chat" | "createDocument" | "updateDocument",
  "title": "string | null",
  "kind": "text" | "code" | "html" | "sheet" | "image" | null${streamingArtifact ? ',\n  "cancelStreaming": true | false' : ""}
}

Rules:
- Use "createDocument" when the user is asking to draft, create, generate, write, make, build, or turn something into a durable artifact/document.
- Use "updateDocument" when an artifact is currently open and the user is asking to revise, rewrite, shorten, expand, polish, convert, format, or otherwise modify that current artifact. Pronoun references like "it", "this", or "that" usually indicate updateDocument when an artifact is open.
- When an artifact is currently open, requests to turn it into a report, translate it, compare or add detail to it, or otherwise transform that same artifact should stay in updateDocument and create a new version instead of a new artifact.
- Use "chat" for normal conversational responses, explanations, questions, or analysis that should stay in the transcript.
- Prefer "createDocument" for explicit mentions of "artifact", "document", "memo", "spec", "proposal", "code", "component", "table", or "sheet" unless the user is clearly only asking about them.
- For "updateDocument", preserve the current artifact title unless the user clearly asks to rename it.
- For generic follow-ups like "create an artifact about it", infer a sensible title from the previous conversation instead of echoing that phrase literally.
- Choose kind "html" for self-contained HTML reports, "code" for coding artifacts, "sheet" when a table or spreadsheet is the whole deliverable (a document that contains a table is "text"), otherwise "text" unless image creation is explicitly requested.${streamingArtifact ? '\n- When cancelStreaming is requested: set it to true if the user wants to modify/replace the currently generating artifact (e.g., "make it shorter", "change that", "rewrite it"). Set it to false if the user wants a completely separate new artifact (e.g., "write a doc about Tesla" while an Apple doc is generating).' : ""}

${activeArtifactBlock}

${streamingArtifactBlock ? `${streamingArtifactBlock}\n` : ""}
${steeringContext ? `${steeringContext}\n` : ""}

Conversation context:
${conversationContext}

Latest user request:
${latestUserMessage}`;
}

function parseRovoAppArtifactIntent(rawText, { activeArtifact, streamingArtifact } = {}) {
	const parsed = parseJsonFromText(rawText);
	if (!parsed || typeof parsed !== "object") {
		return null;
	}

	const rawAction = getNonEmptyString(parsed.action)?.toLowerCase();
	const action =
		rawAction === "createdocument"
			? "createDocument"
			: rawAction === "updatedocument"
				? "updateDocument"
				: rawAction === "chat"
					? "chat"
					: null;
	if (!action) {
		return null;
	}

	const title = getNonEmptyString(parsed.title);
	const kind = parsed.kind == null ? null : normalizeArtifactKind(parsed.kind);
	const cancelStreaming =
		streamingArtifact && typeof parsed.cancelStreaming === "boolean"
			? parsed.cancelStreaming
			: null;

	if (action === "updateDocument" && !activeArtifact?.id && !streamingArtifact?.id) {
		return {
			action: "chat",
			title: null,
			kind: null,
			cancelStreaming: null,
		};
	}

	return {
		action,
		title: title || (action === "updateDocument" ? getNonEmptyString(activeArtifact?.title) ?? getNonEmptyString(streamingArtifact?.title) : null),
		kind,
		cancelStreaming,
	};
}

function fallbackRovoAppArtifactIntent({
	activeArtifact,
	artifactSteering,
	latestUserMessage,
	streamingArtifact,
}) {
	const normalizedMessage = getNonEmptyString(latestUserMessage) || "";
	const lowerMessage = normalizedMessage.toLowerCase();
	const prefersCurrentArtifact =
		Boolean(activeArtifact?.id) && artifactSteering?.preferCurrentArtifact === true;
	const sameArtifactVersionRequest = isSameRovoAppArtifactVersionRequest({
		activeArtifact,
		latestUserMessage,
	});
	const hasArtifactWord = /\bartifact\b/.test(lowerMessage);
	const asksForDocument = matchesDocumentRequest(lowerMessage);
	const asksToModifyCurrentArtifact = matchesModificationRequest(lowerMessage, activeArtifact, streamingArtifact);
	const requestedTitle = extractRovoAppRequestedTitle({
		latestUserMessage,
	});
	const explicitlyRequestsNewArtifact = isExplicitNewRovoAppArtifactRequest({
		latestUserMessage,
	});
	const hasReferencesPronoun = referencesPronoun(lowerMessage);

	// Determine cancelStreaming when a streaming artifact is active
	const resolveCancelStreaming = (action) => {
		if (!streamingArtifact?.id) {
			return null;
		}

		if (action === "updateDocument") {
			return true;
		}

		if (action === "createDocument") {
			return false;
		}

		return null;
	};

	if (asksToModifyCurrentArtifact || sameArtifactVersionRequest) {
		const action = "updateDocument";
		return {
			action,
			title: requestedTitle || getNonEmptyString(activeArtifact?.title) || getNonEmptyString(streamingArtifact?.title),
			kind: normalizeArtifactKind(activeArtifact?.kind || streamingArtifact?.kind),
			cancelStreaming: resolveCancelStreaming(action),
		};
	}

	if (hasArtifactWord || asksForDocument) {
		const action =
			(activeArtifact?.id || streamingArtifact?.id) && hasArtifactWord && hasReferencesPronoun
				? "updateDocument"
				: "createDocument";
		return {
			action,
			title:
				action === "updateDocument"
					? requestedTitle || getNonEmptyString(activeArtifact?.title) || getNonEmptyString(streamingArtifact?.title)
					: null,
			kind: inferRovoAppArtifactKindFromRequest(latestUserMessage),
			cancelStreaming: resolveCancelStreaming(action),
			};
	}

	if (
		prefersCurrentArtifact &&
		!explicitlyRequestsNewArtifact &&
		normalizedMessage &&
		!/[?]\s*$/u.test(normalizedMessage)
	) {
		const action = "updateDocument";
		return {
			action,
			title: requestedTitle || getNonEmptyString(activeArtifact?.title),
			kind: normalizeArtifactKind(activeArtifact?.kind),
			cancelStreaming: resolveCancelStreaming(action),
		};
	}

	return {
		action: "chat",
		title: null,
		kind: null,
		cancelStreaming: null,
	};
}

function resolveFastRovoAppArtifactIntent() {
	return null;
}

module.exports = {
	buildRovoAppArtifactIntentPrompt,
	fallbackRovoAppArtifactIntent,
	normalizeArtifactKind,
	parseRovoAppArtifactIntent,
	resolveFastRovoAppArtifactIntent,
};
