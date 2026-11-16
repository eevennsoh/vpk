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
	 * The active prompt's stream closed cleanly without turn-complete, as read
	 * from the request's finish snapshot. The provider shows the cut-short notice
	 * when the turn finalizes. Stop clears it: the user ended the turn, so no
	 * notice follows. Every path that replaces the transcript resets the turn, so
	 * a notice never lands on another thread.
	 */
	readonly cutShort: RovoChatCutShortTurn | null;
	/** A send (first attempt, retry or edit resend) is between dispatch and its request settling. */
	readonly dispatching: boolean;
	/**
	 * Names the current send. Every send start and every reset moves it on, and a
	 * send's settlement carries the value it started with, so a send that a reset
	 * or a later send superseded cannot settle the turn that replaced it.
	 */
	readonly sendAttempt: number;
	readonly retryCount: number;
}

/** What a cut-short request's finish snapshot says about its turn. */
export interface RovoChatCutShortFinish {
	/** The snapshot's last message (the partial reply): the notice shows after it. */
	readonly anchorMessageId: string | null;
	/** A media widget in the turn's reply was still loading when the stream closed. */
	readonly mediaLoading: boolean;
}

export interface RovoChatCutShortTurn {
	readonly anchorMessageId: string | null;
	/**
	 * When (epoch ms) the short cut-short wait for a widget the snapshot left
	 * loading ends, or null when the turn is not waiting. The backend writes every
	 * widget-loading part into the same stream, so its loading:false cannot
	 * arrive once the stream has closed. Kept as a deadline, not a running timer,
	 * so the timer can be armed again for the time left after its effect is
	 * cleaned up (a provider hidden through <Activity>).
	 */
	readonly mediaWaitEndsAt: number | null;
}

/** The cut-short wait the active prompt is in: whose it is and when it ends. */
export interface RovoChatCutShortMediaWait {
	readonly promptId: string;
	readonly endsAt: number;
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
	/** The send started as `attempt` settled. Ignored unless it is still the current send. */
	| { readonly type: "dispatchSettled"; readonly attempt: number; readonly failed: boolean }
	| { readonly type: "turnCompleteSeen" }
	/**
	 * A final error or a cut-short stream. Give-ups after retries also reset the retry count.
	 * Fires with no active prompt too (an edit resend that errors); the flag it sets is
	 * then cleared by the next `dispatchNext`.
	 */
	| { readonly type: "turnFailed"; readonly resetRetries: boolean }
	/**
	 * `promptId`'s stream closed without turn-complete; finalize once the wait ending
	 * at `mediaWaitEndsAt` (null: no wait) is over. Ignored unless that prompt is active.
	 */
	| {
		readonly type: "turnCutShort";
		readonly promptId: string;
		readonly finish: RovoChatCutShortFinish;
		readonly mediaWaitEndsAt: number | null;
	}
	/** The short cut-short wait started for `promptId` ran out. Ignored unless that prompt is still waiting. */
	| { readonly type: "cutShortMediaWaitElapsed"; readonly promptId: string }
	| { readonly type: "stopRequested" }
	| { readonly type: "finalize" }
	| { readonly type: "reset" };

export const ROVO_CHAT_TURN_INITIAL_STATE: RovoChatTurnState = Object.freeze({
	queue: Object.freeze([]) as ReadonlyArray<QueuedPromptItem>,
	activePrompt: null,
	finalizeRequested: false,
	turnCompleteSeen: false,
	cutShort: null,
	dispatching: false,
	sendAttempt: 0,
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
				cutShort: null,
				dispatching: true,
				sendAttempt: state.sendAttempt + 1,
				retryCount: 0,
			};
		}
		case "retryDispatchStarted":
			return {
				...state,
				retryCount: state.retryCount + 1,
				finalizeRequested: false,
				cutShort: null,
				dispatching: true,
				sendAttempt: state.sendAttempt + 1,
			};
		case "editStarted":
			// An edit resend has no active prompt, so nothing finalizes it and a
			// stream that ends without turn-complete is not flagged as cut short.
			return { ...state, queue: [], activePrompt: null, finalizeRequested: false, turnCompleteSeen: false, cutShort: null };
		case "editDispatchStarted":
			return { ...state, dispatching: true, sendAttempt: state.sendAttempt + 1 };
		case "dispatchSettled":
			if (event.attempt !== state.sendAttempt) {
				return state;
			}
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
			// Leaves turnCompleteSeen as is: findCutShortNotice still reads it,
			// though turn-complete cannot arrive once its stream has closed.
			return state.activePrompt?.id === event.promptId
				? {
					...state,
					finalizeRequested: true,
					cutShort: { anchorMessageId: event.finish.anchorMessageId, mediaWaitEndsAt: event.mediaWaitEndsAt },
				}
				: state;
		case "cutShortMediaWaitElapsed":
			if (state.cutShort?.mediaWaitEndsAt == null || state.activePrompt?.id !== event.promptId) {
				return state;
			}
			return { ...state, cutShort: { ...state.cutShort, mediaWaitEndsAt: null } };
		case "stopRequested":
			if (!state.activePrompt || (state.finalizeRequested && state.cutShort === null)) {
				return state;
			}
			// A deliberate Stop ends the turn without the cut-short notice.
			return { ...state, finalizeRequested: true, cutShort: null };
		case "finalize":
			if (!state.activePrompt) {
				return state;
			}
			return { ...state, activePrompt: null, finalizeRequested: false, turnCompleteSeen: false, cutShort: null, retryCount: 0 };
		case "reset":
			// Moves the send on, so a send still settling from before the reset is ignored.
			return { ...ROVO_CHAT_TURN_INITIAL_STATE, queue: [], sendAttempt: state.sendAttempt + 1 };
	}
}

/**
 * Whether a send is in flight by the turn's own account: a prompt is active or a
 * send is dispatching. Unlike the committed streaming flag, this already holds
 * while a request has started but React has not rendered its status yet.
 */
export function hasSendInFlight(state: RovoChatTurnState): boolean {
	return state.activePrompt !== null || state.dispatching;
}

/**
 * Whether the current send's request is live: it has started and none of the
 * request's own callbacks has finished it yet. Its onFinish or onError records
 * the finish synchronously (cut short or failed sets finalizeRequested, a retry
 * schedules its timer), turn-complete marks a reply that completed, Stop sets
 * finalizeRequested, and the send settles once onFinish has run. The committed
 * streaming flag is ignored: it stays true for a moment after the request ends.
 */
export function hasLiveRequest(state: RovoChatTurnState, env: RovoChatTurnEnvironment): boolean {
	return state.dispatching && !state.finalizeRequested && !state.turnCompleteSeen && !env.retryScheduled;
}

/** The cut-short wait the active prompt is in, or null when it is not waiting. */
export function findCutShortMediaWait(state: RovoChatTurnState): RovoChatCutShortMediaWait | null {
	const endsAt = state.cutShort?.mediaWaitEndsAt ?? null;
	return state.activePrompt && endsAt !== null ? { promptId: state.activePrompt.id, endsAt } : null;
}

/**
 * Whether the active prompt is finished: turn-complete arrived and the stream
 * closed, or the turn failed and both the stream and media generation settled,
 * with no retry, send or cancel still in progress. A cut-short turn's media
 * comes from its finish snapshot, not the media flag, which follows committed
 * messages and can lag a response that arrived before React rendered it.
 */
export function canFinalizeActivePrompt(state: RovoChatTurnState, env: RovoChatTurnEnvironment): boolean {
	if (!state.activePrompt || state.dispatching || env.retryScheduled || env.isCancelling) {
		return false;
	}

	const mediaSettled = state.cutShort ? state.cutShort.mediaWaitEndsAt === null : !env.isMediaGenerating;
	const completedByStream = state.turnCompleteSeen && !env.isStreaming;
	const endedByFailure = state.finalizeRequested && !env.isStreaming && mediaSettled;
	return completedByStream || endedByFailure;
}

/**
 * The cut-short notice finalizing the active prompt now should show, with the
 * message it follows, or null: there is one when its stream closed without
 * turn-complete and the user did not press Stop while the turn waited.
 */
export function findCutShortNotice(state: RovoChatTurnState): RovoChatCutShortTurn | null {
	return state.activePrompt !== null && !state.turnCompleteSeen ? state.cutShort : null;
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
