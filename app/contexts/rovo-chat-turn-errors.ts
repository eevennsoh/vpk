import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import {
	didAssistantCompleteActivePrompt,
	hasTurnCompleteForPrompt,
	type QueuedPromptItem,
} from "@/app/contexts/rovo-chat-helpers";

/**
 * The error a failed turn ended with, shown after the last transcript message
 * that turn produced. It is display-only: it never enters the AI SDK messages,
 * so it is not resent as history or persisted with the thread.
 */
export interface RovoChatTurnError {
	readonly anchorMessageId: string | null;
	readonly message: RovoUIMessage;
}

export function createTurnError(
	message: RovoUIMessage,
	transcript: ReadonlyArray<RovoUIMessage>,
): RovoChatTurnError {
	return { anchorMessageId: transcript.at(-1)?.id ?? null, message };
}

/**
 * Places each turn error right after the message it is anchored to. An error
 * with no anchor (the transcript was empty) leads the transcript; an error
 * whose anchor is gone (the message was deleted or replaced) is dropped.
 */
export function insertTurnErrors(
	messages: RovoUIMessage[],
	turnErrors: ReadonlyArray<RovoChatTurnError>,
): RovoUIMessage[] {
	if (turnErrors.length === 0) {
		return messages;
	}

	const errorsByAnchor = new Map<string | null, RovoUIMessage[]>();
	for (const turnError of turnErrors) {
		const anchored = errorsByAnchor.get(turnError.anchorMessageId) ?? [];
		anchored.push(turnError.message);
		errorsByAnchor.set(turnError.anchorMessageId, anchored);
	}

	const result: RovoUIMessage[] = [...(errorsByAnchor.get(null) ?? [])];
	for (const message of messages) {
		result.push(message);
		const anchored = errorsByAnchor.get(message.id);
		if (anchored) {
			result.push(...anchored);
		}
	}
	return result;
}

/**
 * Drops the errors that belong to `messageId` or any later message, for an
 * edit that resends `messageId` and replaces everything after it.
 */
export function pruneTurnErrorsFrom(
	turnErrors: ReadonlyArray<RovoChatTurnError>,
	messages: ReadonlyArray<RovoUIMessage>,
	messageId: string,
): ReadonlyArray<RovoChatTurnError> {
	const editedIndex = messages.findIndex((message) => message.id === messageId);
	if (editedIndex === -1) {
		return turnErrors;
	}

	const removedIds = new Set(messages.slice(editedIndex).map((message) => message.id));
	return turnErrors.filter(
		(turnError) =>
			turnError.anchorMessageId === null || !removedIds.has(turnError.anchorMessageId)
	);
}

/**
 * Whether the latest assistant message carries the data-turn-complete signal
 * for `prompt`. Only the last assistant message counts, so a stale signal from
 * an earlier turn never completes the current one.
 */
export function hasTurnCompleteForActivePrompt(
	messages: ReadonlyArray<RovoUIMessage>,
	prompt: QueuedPromptItem,
): boolean {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant") {
			continue;
		}

		return (
			hasTurnCompleteForPrompt(message, prompt) &&
			didAssistantCompleteActivePrompt(messages, index, prompt)
		);
	}

	return false;
}

/**
 * Whether a finished request left the active prompt without its
 * data-turn-complete signal. Every backend turn ends with that signal, so a
 * stream that closes cleanly without it was cut short. Aborts belong to the
 * stop, thread-switch, reset and edit paths, and errors to onError.
 */
export function isIncompleteTurnFinish(input: {
	readonly messages: ReadonlyArray<RovoUIMessage>;
	readonly isAbort: boolean;
	readonly isError: boolean;
	readonly activePrompt: QueuedPromptItem | null;
}): boolean {
	if (input.isAbort || input.isError || !input.activePrompt) {
		return false;
	}

	return !hasTurnCompleteForActivePrompt(input.messages, input.activePrompt);
}
