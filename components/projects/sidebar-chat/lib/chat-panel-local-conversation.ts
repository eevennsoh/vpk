import type { ChatPanelLocalConversationSubmitResult } from "./chat-panel-types";

const LOCAL_CONVERSATION_VOICE_SUPPRESSION_MIN_MS = 2200;
const LOCAL_CONVERSATION_VOICE_SUPPRESSION_MAX_MS = 12000;
const LOCAL_CONVERSATION_VOICE_SUPPRESSION_PER_WORD_MS = 280;
const LOCAL_CONVERSATION_VOICE_SUPPRESSION_BUFFER_MS = 900;

export function isLocalConversationSubmitHandled(result: ChatPanelLocalConversationSubmitResult): boolean {
	return result !== false && (
		typeof result !== "object" ||
		result === null ||
		result.handled !== false
	);
}

export function getLocalConversationVoiceText(result: ChatPanelLocalConversationSubmitResult): string {
	if (typeof result !== "object" || result === null || typeof result.voiceText !== "string") {
		return "";
	}

	return result.voiceText.trim();
}

export function getLocalConversationVoiceSuppressionMs(text: string): number {
	const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;
	const estimatedDuration = wordCount * LOCAL_CONVERSATION_VOICE_SUPPRESSION_PER_WORD_MS + LOCAL_CONVERSATION_VOICE_SUPPRESSION_BUFFER_MS;
	return Math.min(
		Math.max(estimatedDuration, LOCAL_CONVERSATION_VOICE_SUPPRESSION_MIN_MS),
		LOCAL_CONVERSATION_VOICE_SUPPRESSION_MAX_MS,
	);
}
