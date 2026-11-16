import { createAssistantTextMessage, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import {
	CHAT_IN_PROGRESS_MAX_RETRIES,
	CHAT_IN_PROGRESS_RETRY_DELAY_MS,
	RATE_LIMIT_MAX_RETRIES,
	RATE_LIMIT_RETRY_DELAY_MS,
	getChatInProgressRetryContent,
	getChatInProgressRetryCountdownLabel,
	getChatInProgressUserMessage,
	getRateLimitRetryCountdownMessage,
	getRateLimitUserMessage,
	isChatInProgressError,
	isRateLimitError,
} from "@/lib/chat-error-utils";
import {
	createAssistantThinkingStatusMessage,
	getPayloadTooLargeUserMessage,
	isPayloadTooLargeError,
	toUserFacingChatErrorMessage,
	type QueuedPromptItem,
} from "@/app/contexts/rovo-chat-helpers";

/**
 * The chat turn lifecycle that RovoChatProvider drives: the prompt queue, the
 * prompt in flight, and the flags that decide when that prompt is finished and
 * the next one may go out. Pure: the provider owns the side effects (requests,
 * retry timers, cancels) and dispatches events here as they happen.
 */
export interface RovoChatTurnState {
	readonly queue: ReadonlyArray<QueuedPromptItem>;
	readonly activePrompt: QueuedPromptItem | null;
	/** The turn ended by error, cut-short stream or Stop; finalize once the stream and media settle. */
	readonly finalizeRequested: boolean;
	/** The backend's data-turn-complete arrived for the active prompt; finalize once the stream settles. */
	readonly turnCompleteSeen: boolean;
	/**
	 * The active prompt's stream closed cleanly without turn-complete. The
	 * provider shows the cut-short notice when the turn finalizes, which waits
	 * for media generation to settle. The backend writes every widget-loading
	 * part into the same stream, so a widget still loading when the stream closed
	 * settles only through the short cut-short media wait. Stop clears the flag: the user
	 * ended the turn, so no notice follows.
	 */
	readonly cutShort: boolean;
	/** A send (first attempt, retry or edit resend) is between dispatch and its request settling. */
	readonly dispatching: boolean;
	readonly retryCount: number;
}

/** State the provider owns outside the reducer, read when a guard runs. */
export interface RovoChatTurnEnvironment {
	readonly isStreaming: boolean;
	readonly isMediaGenerating: boolean;
	readonly isCancelling: boolean;
	readonly retryScheduled: boolean;
}

export type RovoChatTurnEvent =
	| { readonly type: "enqueue"; readonly prompt: QueuedPromptItem }
	| { readonly type: "removeQueued"; readonly id: string }
	| { readonly type: "clearQueue" }
	/** Moves the head of the queue into flight. Guard with {@link canDispatchNextPrompt}. */
	| { readonly type: "dispatchNext" }
	| { readonly type: "retryDispatchStarted" }
	| { readonly type: "editStarted" }
	| { readonly type: "editDispatchStarted" }
	| { readonly type: "dispatchSettled"; readonly failed: boolean }
	| { readonly type: "turnCompleteSeen" }
	/**
	 * A final error or a cut-short stream. Give-ups after retries also reset the retry count.
	 * Fires with no active prompt too (an edit resend that errors); the flag it sets is
	 * then cleared by the next `dispatchNext`.
	 */
	| { readonly type: "turnFailed"; readonly resetRetries: boolean }
	/** The active prompt's stream closed without turn-complete; finalize once the stream and media settle. */
	| { readonly type: "turnCutShort" }
	| { readonly type: "stopRequested" }
	| { readonly type: "finalize" }
	| { readonly type: "reset" };

export const ROVO_CHAT_TURN_INITIAL_STATE: RovoChatTurnState = Object.freeze({
	queue: Object.freeze([]) as ReadonlyArray<QueuedPromptItem>,
	activePrompt: null,
	finalizeRequested: false,
	turnCompleteSeen: false,
	cutShort: false,
	dispatching: false,
	retryCount: 0,
});

// Queue writes always produce a new array, as the provider's queue state did
// before this reducer existed: consumers key effects on the queue's identity.
export function rovoChatTurnReducer(state: RovoChatTurnState, event: RovoChatTurnEvent): RovoChatTurnState {
	switch (event.type) {
		case "enqueue":
			return { ...state, queue: [...state.queue, event.prompt] };
		case "removeQueued":
			return { ...state, queue: state.queue.filter((prompt) => prompt.id !== event.id) };
		case "clearQueue":
			return { ...state, queue: [] };
		case "dispatchNext": {
			const [nextPrompt, ...rest] = state.queue;
			if (!nextPrompt) {
				return state;
			}
			return {
				...state,
				queue: rest,
				activePrompt: nextPrompt,
				finalizeRequested: false,
				turnCompleteSeen: false,
				cutShort: false,
				dispatching: true,
				retryCount: 0,
			};
		}
		case "retryDispatchStarted":
			return { ...state, retryCount: state.retryCount + 1, finalizeRequested: false, cutShort: false, dispatching: true };
		case "editStarted":
			// An edit resend has no active prompt, so nothing finalizes it and a
			// stream that ends without turn-complete is not flagged as cut short.
			return { ...state, queue: [], activePrompt: null, finalizeRequested: false, turnCompleteSeen: false, cutShort: false };
		case "editDispatchStarted":
			return state.dispatching ? state : { ...state, dispatching: true };
		case "dispatchSettled":
			return {
				...state,
				dispatching: false,
				finalizeRequested: event.failed ? true : state.finalizeRequested,
			};
		case "turnCompleteSeen":
			return state.turnCompleteSeen ? state : { ...state, turnCompleteSeen: true };
		case "turnFailed":
			return {
				...state,
				finalizeRequested: true,
				retryCount: event.resetRetries ? 0 : state.retryCount,
			};
		case "turnCutShort":
			// Leaves turnCompleteSeen as is: shouldNoticeCutShortTurn still reads it,
			// though turn-complete cannot arrive once its stream has closed.
			return state.activePrompt ? { ...state, finalizeRequested: true, cutShort: true } : state;
		case "stopRequested":
			if (!state.activePrompt || (state.finalizeRequested && !state.cutShort)) {
				return state;
			}
			// A deliberate Stop ends the turn without the cut-short notice.
			return { ...state, finalizeRequested: true, cutShort: false };
		case "finalize":
			if (!state.activePrompt) {
				return state;
			}
			return { ...state, activePrompt: null, finalizeRequested: false, turnCompleteSeen: false, cutShort: false, retryCount: 0 };
		case "reset":
			return { ...ROVO_CHAT_TURN_INITIAL_STATE, queue: [] };
	}
}

/**
 * Whether the active prompt is finished: turn-complete arrived and the stream
 * closed, or the turn failed and both the stream and media generation settled,
 * with no retry, send or cancel still in progress.
 */
export function canFinalizeActivePrompt(state: RovoChatTurnState, env: RovoChatTurnEnvironment): boolean {
	if (!state.activePrompt || state.dispatching || env.retryScheduled || env.isCancelling) {
		return false;
	}

	const completedByStream = state.turnCompleteSeen && !env.isStreaming;
	const endedByFailure = state.finalizeRequested && !env.isStreaming && !env.isMediaGenerating;
	return completedByStream || endedByFailure;
}

/**
 * Whether finalizing the active prompt now should show the cut-short notice:
 * its stream closed without turn-complete and the user did not press Stop
 * while the turn waited for media generation to settle.
 */
export function shouldNoticeCutShortTurn(state: RovoChatTurnState): boolean {
	return state.activePrompt !== null && state.cutShort && !state.turnCompleteSeen;
}

/** Whether the next queued prompt may go out now. */
export function canDispatchNextPrompt(state: RovoChatTurnState, env: RovoChatTurnEnvironment): boolean {
	return (
		state.queue.length > 0 &&
		!hasTurnInFlight(state, env) &&
		!env.isMediaGenerating
	);
}

/** Whether a new submit should show the pending affordance (nothing is in flight yet). */
export function shouldStartSubmitPending(state: RovoChatTurnState, env: RovoChatTurnEnvironment): boolean {
	return !hasTurnInFlight(state, env);
}

/** Whether all turn work is idle, so a lingering pending affordance can clear. */
export function isTurnWorkIdle(state: RovoChatTurnState, env: RovoChatTurnEnvironment): boolean {
	return state.queue.length === 0 && !hasTurnInFlight(state, env);
}

function hasTurnInFlight(state: RovoChatTurnState, env: RovoChatTurnEnvironment): boolean {
	return (
		state.activePrompt !== null ||
		state.dispatching ||
		env.isStreaming ||
		env.isCancelling ||
		env.retryScheduled
	);
}

export type RovoChatRetryReason = "rate-limit" | "chat-in-progress";

export type RovoChatTurnErrorClassification =
	| { readonly kind: "retry"; readonly reason: RovoChatRetryReason; readonly delayMs: number; readonly prompt: QueuedPromptItem }
	| {
		readonly kind: "fail";
		readonly userMessage: string;
		/** Give-ups after retries start the next turn's retry budget from zero. */
		readonly resetRetries: boolean;
		/** Payload too large: strip oversized history so the next request fits. */
		readonly sanitizeTranscript: boolean;
	};

/** Decides what a failed chat request does next: retry after a delay, or end the turn with an error. */
export function classifyTurnError(input: {
	readonly errorMessage: string;
	readonly retryCount: number;
	/** The prompt a retry resends; without one the turn cannot retry. */
	readonly activePrompt: QueuedPromptItem | null;
}): RovoChatTurnErrorClassification {
	const userFacingMessage = toUserFacingChatErrorMessage(input.errorMessage);
	const { activePrompt: prompt } = input;

	if (isRateLimitError(input.errorMessage)) {
		return input.retryCount < RATE_LIMIT_MAX_RETRIES && prompt
			? { kind: "retry", reason: "rate-limit", delayMs: RATE_LIMIT_RETRY_DELAY_MS, prompt }
			: { kind: "fail", userMessage: getRateLimitUserMessage(RATE_LIMIT_MAX_RETRIES), resetRetries: true, sanitizeTranscript: false };
	}

	if (isChatInProgressError(input.errorMessage) || isChatInProgressError(userFacingMessage)) {
		return input.retryCount < CHAT_IN_PROGRESS_MAX_RETRIES && prompt
			? { kind: "retry", reason: "chat-in-progress", delayMs: CHAT_IN_PROGRESS_RETRY_DELAY_MS, prompt }
			: { kind: "fail", userMessage: getChatInProgressUserMessage(CHAT_IN_PROGRESS_MAX_RETRIES), resetRetries: true, sanitizeTranscript: false };
	}

	if (isPayloadTooLargeError(input.errorMessage) || isPayloadTooLargeError(userFacingMessage)) {
		return { kind: "fail", userMessage: getPayloadTooLargeUserMessage(), resetRetries: false, sanitizeTranscript: true };
	}

	return { kind: "fail", userMessage: userFacingMessage, resetRetries: false, sanitizeTranscript: false };
}

/** The transient status shown while a retry waits, with `secondsRemaining` left. */
export function createRetryCountdownMessage(
	reason: RovoChatRetryReason,
	messageId: string,
	secondsRemaining: number,
): RovoUIMessage {
	return reason === "rate-limit"
		? createAssistantTextMessage(messageId, getRateLimitRetryCountdownMessage(secondsRemaining))
		: createAssistantThinkingStatusMessage(
			messageId,
			getChatInProgressRetryCountdownLabel(secondsRemaining),
			getChatInProgressRetryContent(),
		);
}
