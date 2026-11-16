const RATE_LIMIT_PATTERN =
	/429|rate[- ]?limit|too many requests|throttl/i;
const CHAT_IN_PROGRESS_PATTERN =
	/ROVO_CHAT_IN_PROGRESS(?:_TIMEOUT)?|chat(?: turn| already)? in progress|chat-turn wait timed out|still finishing (?:the )?(?:previous|another) response/i;

export const RATE_LIMIT_MAX_RETRIES = 2;
export const RATE_LIMIT_RETRY_DELAY_MS = 10_000;
export const CHAT_IN_PROGRESS_MAX_RETRIES = 1;
export const CHAT_IN_PROGRESS_RETRY_DELAY_MS = 10_000;

export function isRateLimitError(rawMessage: string | undefined): boolean {
	if (!rawMessage) {
		return false;
	}

	return RATE_LIMIT_PATTERN.test(rawMessage);
}

export function isChatInProgressError(rawMessage: string | undefined): boolean {
	if (!rawMessage) {
		return false;
	}

	return CHAT_IN_PROGRESS_PATTERN.test(rawMessage);
}

function formatSeconds(seconds: number): string {
	return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function getRateLimitRetryCountdownMessage(
	secondsRemaining: number
): string {
	const safeSeconds = Math.max(1, Math.ceil(secondsRemaining));
	return `I'm experiencing high demand right now. Retrying automatically in ${formatSeconds(safeSeconds)}...`;
}

export function getRateLimitUserMessage(retryAttempt: number): string {
	if (retryAttempt < RATE_LIMIT_MAX_RETRIES) {
		return getRateLimitRetryCountdownMessage(
			Math.ceil(RATE_LIMIT_RETRY_DELAY_MS / 1000)
		);
	}

	return "I'm experiencing high demand right now. Please wait a moment and try again.";
}

export function getChatInProgressRetryCountdownLabel(
	secondsRemaining: number
): string {
	const safeSeconds = Math.max(1, Math.ceil(secondsRemaining));
	return `Retrying in ${formatSeconds(safeSeconds)}`;
}

export function getChatInProgressRetryContent(): string {
	return "Another request is still finishing for this chat session. Attempting automatic recovery.";
}

export function getChatInProgressUserMessage(retryAttempt: number): string {
	if (retryAttempt < CHAT_IN_PROGRESS_MAX_RETRIES) {
		return `Another request is still finishing for this chat session. Attempting automatic recovery. ${getChatInProgressRetryCountdownLabel(
			Math.ceil(CHAT_IN_PROGRESS_RETRY_DELAY_MS / 1000)
		)}.`;
	}

	return "Automatic recovery timed out while waiting for the previous turn. Please retry or reset the chat.";
}

/** Shown when a reply stream closes before the backend signals the turn is complete. */
export function getIncompleteTurnUserMessage(): string {
	return "The response ended before it finished. Please try again.";
}
