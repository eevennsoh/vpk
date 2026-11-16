export function shouldSendExplicitRovoCancel(input: {
	/**
	 * The user pressed Stop. AI SDK `stop()` settles the chat locally the moment
	 * it aborts, so `stopSettledInTime` cannot show whether the backend saw the
	 * disconnect; an explicit user cancel always reaches the backend.
	 */
	explicitUserCancel: boolean;
	hasBackgroundCancelableWork: boolean;
	hasUseChatTurn: boolean;
	stopSettledInTime: boolean;
}): boolean {
	if (input.explicitUserCancel || input.hasBackgroundCancelableWork) {
		return true;
	}

	if (!input.hasUseChatTurn) {
		return true;
	}

	return input.stopSettledInTime !== true;
}

/**
 * How long a Stop waits for the backend cancel before the queue moves on. The
 * run-cancel route awaits Rovo Serve's cancel (10 s client timeout), so an
 * unbounded wait would hold the next queued prompt that long.
 */
export const EXPLICIT_CANCEL_REQUEST_TIMEOUT_MS = 2_000;

/** The backend run a cancel is aimed at, read when the cancel starts. */
export interface RovoCancelTarget {
	readonly threadId: string | null;
	readonly portIndex?: number;
}

/**
 * Debounce key for a backend cancel. A user Stop keys on the turn as well, so a
 * Stop on a new turn in the same thread is never swallowed by the previous one.
 */
export function getRovoCancelDebounceKey(
	target: RovoCancelTarget,
	turnId: string | null,
): string {
	const targetKey =
		target.threadId ??
		(typeof target.portIndex === "number" ? `port:${target.portIndex}` : "default");
	return turnId ? `${targetKey}:turn:${turnId}` : targetKey;
}

/**
 * Asks the backend to cancel the run: the thread's run when there is one,
 * otherwise the chat on the request's Rovo port (the default port when the
 * provider has no `portIndex`, which is also where its turns run).
 */
export async function requestRovoBackendCancel({
	target,
	cancelEndpoint,
	cancelRun,
	fetchImpl,
	signal,
}: {
	target: RovoCancelTarget;
	cancelEndpoint: string;
	cancelRun: (threadId: string, options: { signal: AbortSignal }) => Promise<unknown>;
	fetchImpl: (input: string, init: RequestInit) => Promise<unknown>;
	signal: AbortSignal;
}): Promise<void> {
	if (target.threadId) {
		await cancelRun(target.threadId, { signal });
		return;
	}

	const endpoint =
		typeof target.portIndex === "number"
			? `${cancelEndpoint}?portIndex=${encodeURIComponent(String(target.portIndex))}`
			: cancelEndpoint;
	await fetchImpl(endpoint, { method: "POST", signal });
}

/** Repeat cancels of the same key inside this window are skipped. */
export const BACKEND_CANCEL_DEBOUNCE_MS = 2_000;

/**
 * Debounce gate for backend cancels. The returned function answers whether a
 * cancel with this key (see getRovoCancelDebounceKey) may go out now, and
 * records it when it may: a repeat of the same key inside `debounceMs` is
 * refused, while a different key (a new turn or thread) always passes.
 */
export function createRovoCancelDebounce({
	debounceMs = BACKEND_CANCEL_DEBOUNCE_MS,
	now = Date.now,
}: {
	debounceMs?: number;
	now?: () => number;
} = {}): (key: string) => boolean {
	let lastKey = "";
	let lastAt = 0;
	return (key) => {
		const at = now();
		if (key === lastKey && at - lastAt < debounceMs) {
			return false;
		}

		lastKey = key;
		lastAt = at;
		return true;
	};
}

/**
 * Sends a backend cancel at most once per debounce key (see
 * getRovoCancelDebounceKey) within `debounceMs`, waiting at most `timeoutMs`.
 * The returned function resolves true when a cancel request went out; request
 * errors and timeouts are swallowed because the stream may already have ended.
 */
export function createRovoBackendCanceller({
	cancelEndpoint,
	cancelRun,
	fetchImpl,
	timeoutMs,
	debounceMs = BACKEND_CANCEL_DEBOUNCE_MS,
	now = Date.now,
}: {
	cancelEndpoint: string;
	cancelRun: (threadId: string, options: { signal: AbortSignal }) => Promise<unknown>;
	fetchImpl: (input: string, init: RequestInit) => Promise<unknown>;
	timeoutMs: number;
	debounceMs?: number;
	now?: () => number;
}) {
	const mayCancel = createRovoCancelDebounce({ debounceMs, now });
	return async (target: RovoCancelTarget, turnId: string | null): Promise<boolean> => {
		if (!mayCancel(getRovoCancelDebounceKey(target, turnId))) {
			return false;
		}

		try {
			await requestRovoBackendCancel({
				target,
				cancelEndpoint,
				cancelRun,
				fetchImpl,
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch {}
		return true;
	};
}
