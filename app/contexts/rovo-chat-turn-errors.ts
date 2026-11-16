import { findPromptUserMessageIndex, findReplyAfter, hasTurnCompleteSignal, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { QueuedPromptItem } from "@/app/contexts/rovo-chat-helpers";
import { findLatestMediaLoadingState } from "@/app/contexts/rovo-chat-media-state";
import type { RovoChatCutShortFinish } from "@/app/contexts/rovo-chat-turn-machine";

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
	return { anchorMessageId: findTurnErrorAnchor(transcript), message };
}

/** The message a turn error ending `transcript` follows: its last, or null when it is empty. */
function findTurnErrorAnchor(transcript: ReadonlyArray<RovoUIMessage>): string | null {
	return transcript.at(-1)?.id ?? null;
}

/**
 * Places each turn error right after the message it is anchored to. An error
 * with no anchor (the transcript was empty) leads the transcript. An error
 * whose anchor is gone (the message was deleted, or replaced by a sanitize
 * rewrite or a server re-hydrate) is dropped and does not come back: turn
 * errors are display-only, so losing one with its turn is acceptable.
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
	return turnErrors.filter((turnError) =>
		turnError.anchorMessageId === null
			// An unanchored error leads the transcript, so editing the first message replaces it.
			? editedIndex > 0
			: !removedIds.has(turnError.anchorMessageId)
	);
}

/**
 * Whether the reply to `prompt` carries the data-turn-complete signal: the
 * latest assistant message after the user message sent for that prompt (matched
 * by prompt id). Matching by id instead of by timestamp keeps a stale signal
 * from an earlier turn from completing this one, whatever the client clock says.
 */
export function hasTurnCompleteForActivePrompt(
	messages: ReadonlyArray<RovoUIMessage>,
	prompt: QueuedPromptItem,
): boolean {
	const reply = findReplyAfter(messages, findPromptUserMessageIndex(messages, prompt.id));
	return reply !== undefined && hasTurnCompleteSignal(reply);
}

/**
 * What a finished request says about a cut-short active prompt, or null when
 * the turn was not cut short. A turn is cut short when its request finished
 * without its data-turn-complete signal. Every backend chat route must end a
 * successful turn with that signal (each route's stream test asserts it; see
 * backend/chat/chat-sdk-handler.contract.test.js), so a stream that closes
 * cleanly without it was cut short. Aborts belong to the
 * stop, thread-switch, reset and edit paths, and errors to onError.
 *
 * Reads only the finish snapshot (`messages`), never committed React state:
 * the whole response can arrive before React renders any of it.
 */
export function readCutShortFinish(input: {
	readonly messages: ReadonlyArray<RovoUIMessage>;
	readonly isAbort: boolean;
	readonly isError: boolean;
	readonly activePrompt: QueuedPromptItem | null;
}): RovoChatCutShortFinish | null {
	const { messages, activePrompt } = input;
	if (input.isAbort || input.isError || !activePrompt || hasTurnCompleteForActivePrompt(messages, activePrompt)) {
		return null;
	}

	return {
		anchorMessageId: findTurnErrorAnchor(messages),
		mediaLoading: findLatestMediaLoadingState(messages, activePrompt.id) === true,
	};
}
