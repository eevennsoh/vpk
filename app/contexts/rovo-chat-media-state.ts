import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import { findPromptUserMessageIndex } from "@/app/contexts/rovo-chat-helpers";

const MEDIA_WIDGET_TYPES = new Set(["image-preview", "audio-preview", "video-preview"]);

/**
 * The loading state of the latest media widget (image, audio or video) in the
 * current turn's latest assistant message, or null when it has none.
 *
 * The current turn is the active prompt's: the messages after the user message
 * sent for `activePromptId`. With no active prompt, it is an edit resend's (or
 * a legacy message's) turn: the messages after the latest user message, but
 * only when that message carries no prompt id. A user message with a prompt id
 * that is not active belongs to a turn that already finalized, so a widget it
 * left loading never holds up the next turn.
 */
export function findLatestMediaLoadingState(
	messages: ReadonlyArray<RovoUIMessage>,
	activePromptId: string | null,
): boolean | null {
	const turnStartIndex = findTurnUserMessageIndex(messages, activePromptId);
	if (turnStartIndex === -1) {
		return null;
	}

	const reply = messages.findLast((message, index) => index > turnStartIndex && message.role === "assistant");
	if (!reply) {
		return null;
	}

	let loading: boolean | null = null;
	for (const part of reply.parts) {
		if (part.type !== "data-widget-loading") {
			continue;
		}
		const data = (part as { data?: { type?: string; loading?: boolean } }).data;
		if (data?.type && MEDIA_WIDGET_TYPES.has(data.type)) {
			loading = !!data.loading;
		}
	}
	return loading;
}

function findTurnUserMessageIndex(messages: ReadonlyArray<RovoUIMessage>, activePromptId: string | null): number {
	if (activePromptId !== null) {
		return findPromptUserMessageIndex(messages, activePromptId);
	}

	const latestUserIndex = messages.findLastIndex((message) => message.role === "user");
	return latestUserIndex !== -1 && !messages[latestUserIndex].metadata?.promptId ? latestUserIndex : -1;
}
