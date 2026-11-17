import type { RoutingDecision, RovoUIMessage } from "@/lib/rovo-ui-messages";

export const ROVO_APP_ARTIFACT_INTENT_LEAK_FALLBACK =
	"I had an internal routing issue while generating that response. Please try again.";

const ROVO_APP_DIRECT_MEDIA_FENCE_OPENER = /```(?:image|audio)\s*\n/giu;
// The closing fence rule of `backend/lib/direct-media-fence.js` for complete text; the display test
// keeps the two equal.
const ROVO_APP_DIRECT_MEDIA_LINE_EDGE_FENCE = /(?<!`)```(?:(?<=(?:^|\n)[ \t]*```)|(?=`*[ \t\r]*(?:\n|$)))/gu;
const ROVO_APP_SPEC_FENCE_PATTERN = /```spec\s*\n[\s\S]*?(?:```|$)/giu;
const ROVO_APP_SPEC_PATCH_LINE_PATTERN =
	/^\s*\{"op"\s*:\s*"(?:add|replace|remove)"\s*,\s*"path"\s*:\s*"\/(?:root|elements|state)\b.*$/gmu;
const ROVO_APP_TOOL_DRIVEN_WIDGET_TYPES = new Set([
	"audio-preview",
	"image-preview",
	"video-preview",
	"plan",
	"question-card",
]);
const ROVO_APP_BROWSER_FALLBACK_TEXT_PATTERN =
	/(?:screenshot image(?: itself)? (?:can'?t|cannot) be rendered|chrome devtools remote debugging is blocked|what would you like to do instead\?|try a local\/internal url|screenshots work fine for localhost)/iu;

export interface RovoAppWidgetDisplayInput {
	additionalToolDrivenWidgetTypes?: ReadonlySet<string>;
	hasBrowserScreenshots?: boolean;
	hasWidget: boolean;
	routeDecision: RoutingDecision | null;
	widgetType: string | null;
}

interface RovoAppMessageDisplayDataPart {
	type: string;
	data?: {
		reason?: unknown;
		type?: unknown;
		questions?: unknown;
	};
}

function getLatestRovoAppMessageDisplayDataPart(
	message: Pick<RovoUIMessage, "parts">,
	partType: string,
): RovoAppMessageDisplayDataPart | null {
	for (let index = message.parts.length - 1; index >= 0; index -= 1) {
		const part = message.parts[index] as RovoAppMessageDisplayDataPart;
		if (part.type === partType) {
			return part;
		}
	}

	return null;
}

export function getVisibleRovoAppMessages(
	messages: ReadonlyArray<RovoUIMessage>,
): RovoUIMessage[] {
	return messages.filter((message) =>
		(message.role === "user" || message.role === "assistant")
		&& message.metadata?.visibility !== "hidden"
	);
}

export function getLatestVisibleRovoAppMessageIdByRole(
	messages: ReadonlyArray<Pick<RovoUIMessage, "id" | "role">>,
	role: "assistant" | "user",
): string | null {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === role) {
			return message.id;
		}
	}

	return null;
}

export function getRovoAppAssistantSuggestionQuestions({
	lastAssistantMessageId,
	message,
	shouldSuppressLatestAssistantSuggestions,
}: Readonly<{
	lastAssistantMessageId: string | null;
	message: RovoUIMessage;
	shouldSuppressLatestAssistantSuggestions: boolean;
}>): string[] {
	if (message.id !== lastAssistantMessageId || shouldSuppressLatestAssistantSuggestions) {
		return [];
	}

	const questions = getLatestRovoAppMessageDisplayDataPart(
		message,
		"data-suggested-questions",
	)?.data?.questions;
	return Array.isArray(questions)
		? questions.filter((question): question is string => typeof question === "string")
		: [];
}

/** Where the JSON object that opens `text` ends (-1 when it does not), skipping strings. */
function rovoAppJsonObjectEnd(text: string): number {
	let depth = 0;
	let inString = false;
	for (let at = text.indexOf("{"); at >= 0 && at < text.length; at += 1) {
		const char = text[at];
		if (inString) {
			if (char === "\\") {
				at += 1;
			} else if (char === '"') {
				inString = false;
			}
		} else if (char === '"') {
			inString = true;
		} else if (char === "{" || char === "[") {
			depth += 1;
		} else if ((char === "}" || char === "]") && --depth === 0) {
			return at + 1;
		}
	}
	return -1;
}

/**
 * Where a media block's closing fence starts in the complete text (-1 while it is open): the first
 * run of three or more backticks that starts or ends its line, or directly follows the JSON object
 * that opens the body; failing that, the first three backticks after the opener.
 */
function findRovoAppDirectMediaFenceClose(text: string, bodyStart: number): number {
	ROVO_APP_DIRECT_MEDIA_LINE_EDGE_FENCE.lastIndex = bodyStart;
	const lineEdge = ROVO_APP_DIRECT_MEDIA_LINE_EDGE_FENCE.exec(text);
	const lineEdgeStart = lineEdge ? lineEdge.index : -1;
	const body = text.slice(bodyStart, lineEdge ? lineEdgeStart : text.length);
	if (/^\s*\{/u.test(body)) {
		const objectEnd = rovoAppJsonObjectEnd(body);
		if (objectEnd >= 0) {
			const at = objectEnd + (/^[ \t\r]*/u.exec(body.slice(objectEnd))?.[0].length ?? 0);
			if (body.startsWith("```", at)) {
				return bodyStart + at;
			}
		}
	}
	return lineEdge ? lineEdgeStart : text.indexOf("```", bodyStart);
}

/** `rawText` with each media block, closed or still open, replaced by a paragraph break. */
function replaceRovoAppDirectMediaFences(rawText: string): string {
	let text = "";
	let at = 0;
	ROVO_APP_DIRECT_MEDIA_FENCE_OPENER.lastIndex = 0;
	for (
		let opener = ROVO_APP_DIRECT_MEDIA_FENCE_OPENER.exec(rawText);
		opener;
		opener = ROVO_APP_DIRECT_MEDIA_FENCE_OPENER.exec(rawText)
	) {
		text += `${rawText.slice(at, opener.index)}\n\n`;
		const closeStart = findRovoAppDirectMediaFenceClose(rawText, opener.index + opener[0].length);
		if (closeStart < 0) {
			return text;
		}
		at = closeStart + 3;
		ROVO_APP_DIRECT_MEDIA_FENCE_OPENER.lastIndex = at;
	}
	return `${text}${rawText.slice(at)}`;
}

export function removeRovoAppDirectMediaFences(rawText: string): {
	removed: boolean;
	text: string;
} {
	if (!rawText.includes("```")) {
		return {
			removed: false,
			text: rawText,
		};
	}

	const sanitizedText = replaceRovoAppDirectMediaFences(rawText);
	if (sanitizedText === rawText) {
		return {
			removed: false,
			text: rawText,
		};
	}

	return {
		removed: true,
		text: sanitizedText.replace(/\n{3,}/g, "\n\n").trim(),
	};
}

export function removeRovoAppSpecFences(rawText: string): {
	removed: boolean;
	text: string;
} {
	const sanitizedText = rawText
		.replace(ROVO_APP_SPEC_FENCE_PATTERN, "\n\n")
		.replace(ROVO_APP_SPEC_PATCH_LINE_PATTERN, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	if (sanitizedText === rawText) {
		return {
			removed: false,
			text: rawText,
		};
	}

	return {
		removed: true,
		text: sanitizedText,
	};
}

export function sanitizeRovoAppAssistantText(rawText: string): string {
	const directMediaResult = removeRovoAppDirectMediaFences(rawText);
	const textAfterDirectMediaRemoval =
		directMediaResult.removed ? directMediaResult.text : rawText;
	const specResult = removeRovoAppSpecFences(textAfterDirectMediaRemoval);
	const text = specResult.removed ? specResult.text : textAfterDirectMediaRemoval;
	const trimmedText = text.trim();
	if (!trimmedText.startsWith("{") || !trimmedText.endsWith("}")) {
		return text;
	}

	try {
		const parsed = JSON.parse(trimmedText) as {
			action?: unknown;
			title?: unknown;
			kind?: unknown;
		};
		const allowedActions = new Set(["chat", "createDocument", "updateDocument"]);
		const isArtifactIntentPayload =
			typeof parsed === "object" &&
			parsed !== null &&
			allowedActions.has(String(parsed.action)) &&
			(parsed.title === null || typeof parsed.title === "string") &&
			(parsed.kind === null ||
				parsed.kind === "text" ||
				parsed.kind === "code" ||
				parsed.kind === "image" ||
				parsed.kind === "sheet");

		return isArtifactIntentPayload
			? ROVO_APP_ARTIFACT_INTENT_LEAK_FALLBACK
			: text;
	} catch {
		return text;
	}
}

export function looksLikeBrowserFallbackAssistantText(rawText: string): boolean {
	if (typeof rawText !== "string" || rawText.trim().length === 0) {
		return false;
	}

	return ROVO_APP_BROWSER_FALLBACK_TEXT_PATTERN.test(rawText);
}

export function shouldRenderRovoAppWidget(input: RovoAppWidgetDisplayInput): boolean {
	if (!input.hasWidget) {
		return false;
	}

	if (input.hasBrowserScreenshots && input.widgetType === "genui-preview") {
		return false;
	}

	if (
		typeof input.widgetType === "string" &&
		(ROVO_APP_TOOL_DRIVEN_WIDGET_TYPES.has(input.widgetType) ||
			Boolean(input.additionalToolDrivenWidgetTypes?.has(input.widgetType)))
	) {
		return true;
	}

	if (!input.routeDecision) {
		return true;
	}

	return input.routeDecision.presentation === "genui_card";
}

export function shouldRenderRovoAppAssistantText(input: {
	hasText: boolean;
	hasTurnComplete: boolean;
	hasToolActivity: boolean;
	hasWidgetSignal: boolean;
	isFallbackRoute: boolean;
	isResponseInFlight: boolean;
	isTextPresentation: boolean;
	shouldRenderPlanWidget: boolean;
}): boolean {
	if (!input.hasText || input.shouldRenderPlanWidget) {
		return false;
	}

	if (!(input.isTextPresentation || input.isFallbackRoute || !input.hasWidgetSignal)) {
		return false;
	}

	const shouldDeferUntilTurnComplete =
		input.isResponseInFlight
		&& !input.hasTurnComplete
		&& input.hasToolActivity;
	if (shouldDeferUntilTurnComplete) {
		return false;
	}

	return true;
}

export function shouldRenderRovoAppAssistantActions(input: {
	hasArtifactCard: boolean;
	hasBrowserScreenshots?: boolean;
	hasAssistantText: boolean;
	hasInterruption: boolean;
	hasSources: boolean;
	hasWidget: boolean;
	hasWidgetError: boolean;
	isLastAssistant: boolean;
	isResponseInFlight: boolean;
}): boolean {
	if (input.isLastAssistant && input.isResponseInFlight) {
		return false;
	}

	return (
		input.hasAssistantText ||
		input.hasWidget ||
		input.hasWidgetError ||
		Boolean(input.hasBrowserScreenshots) ||
		input.hasArtifactCard ||
		input.hasSources ||
		input.hasInterruption
	);
}

export function shouldRenderRovoAppVisibleWidget(input: {
	hasWidget: boolean;
	shouldHideResolvedQuestionCard: boolean;
}): boolean {
	return input.hasWidget && !input.shouldHideResolvedQuestionCard;
}

export function shouldRenderRovoAppAssistantMessage(input: {
	hasArtifactCard: boolean;
	hasBrowserScreenshots?: boolean;
	hasAssistantText: boolean;
	hasInterruption: boolean;
	hasReasoning: boolean;
	hasSources: boolean;
	hasWidget: boolean;
	hasWidgetError: boolean;
}): boolean {
	return (
		input.hasAssistantText ||
		input.hasReasoning ||
		input.hasWidget ||
		input.hasWidgetError ||
		Boolean(input.hasBrowserScreenshots) ||
		input.hasArtifactCard ||
		input.hasSources ||
		input.hasInterruption
	);
}
