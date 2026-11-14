import {
	DEFAULT_DESCRIPTION,
	clipText,
	getNonEmptyString,
} from "@/components/projects/shared/lib/generative-widget-text";
import type { GenerativeWidgetPrimaryActionPayload } from "@/components/projects/shared/lib/generative-widget-types";

export function buildGenerativeWidgetSubmitPrompt(
	payload: GenerativeWidgetPrimaryActionPayload
): string {
	const serializedState = JSON.stringify(payload.formState ?? {}, null, 2);

	return [
		`Please execute "${payload.actionLabel}" for "${payload.title}".`,
		`Context: ${payload.description}`,
		"Use these form values:",
		"```json",
		serializedState,
		"```",
	].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Card description formatting                                               */
/* -------------------------------------------------------------------------- */

const CARD_DESCRIPTION_MAX_LENGTH = 96;
const ASSISTANT_PROCESS_LEAD_PATTERN =
	/^(?:let me|i(?:'ll|’ll| will| am going to| can| need to))\s+(?:now\s+)?(?:(?:go\s+)?(?:fetch|get|look up|retrieve|find|gather|pull|check|load|inspect|analy[sz]e|summari[sz]e|generate|create|build|make)\s+)/i;
const ASSISTANT_PROCESS_FOLLOWUP_PATTERN =
	/\s+and\s+(?:then\s+)?(?:summari[sz]e|show|display|render|present)\b.*$/i;
const ASSISTANT_PROCESS_PURPOSE_PATTERN =
	/\s+(?:to|so i can)\s+(?:get|summari[sz]e|show|display|understand|find|identify|review)\b.*$/i;

function capitalizeFirstCharacter(value: string): string {
	return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function stripAssistantProcessLanguage(value: string): string {
	const compact = value.replace(/\s+/g, " ").trim();
	const withoutLead = compact.replace(ASSISTANT_PROCESS_LEAD_PATTERN, "").trim();
	if (withoutLead === compact || !withoutLead) {
		return compact;
	}

	const withoutFollowup = withoutLead
		.replace(ASSISTANT_PROCESS_FOLLOWUP_PATTERN, "")
		.replace(ASSISTANT_PROCESS_PURPOSE_PATTERN, "")
		.replace(/^(?:the|a|an)\s+/i, "")
		.trim();

	return withoutFollowup
		? capitalizeFirstCharacter(withoutFollowup)
		: compact;
}

export function formatGenerativeWidgetCardDescription(description: string): string {
	const compact = (getNonEmptyString(description) ?? DEFAULT_DESCRIPTION)
		.replace(/\s+/g, " ")
		.trim();
	const displayDescription = stripAssistantProcessLanguage(compact);
	const firstSentence = displayDescription.match(/^(.+?[.!?])(?:\s|$)/u)?.[1]?.trim();
	const sentenceCandidate =
		firstSentence &&
		firstSentence.length >= 24 &&
		firstSentence.length <= CARD_DESCRIPTION_MAX_LENGTH
			? firstSentence
			: displayDescription;

	return clipText(sentenceCandidate, CARD_DESCRIPTION_MAX_LENGTH);
}
