import type { ChatStatus } from "ai";
import {
	EXPLICIT_CANCEL_REQUEST_TIMEOUT_MS,
	getRovoCancelDebounceKey,
	shouldSendExplicitRovoCancel,
} from "@/lib/rovo-cancel-strategy";
import { markLastRovoAppAssistantMessageInterrupted } from "@/lib/rovo-app-interruptions";
import type {
	RovoAppActiveRun,
	RovoAppDocument,
	RovoAppRunStatus,
	RovoAppThread,
} from "@/lib/rovo-app-types";
import type {
	RovoMessageInterruptionSource,
	RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";

interface MutableRef<T> {
	current: T;
}

type Sleep = (ms: number) => Promise<void>;
type SetState<T> = (value: T | ((previousValue: T) => T)) => void;

const DEFAULT_ACTIVE_TURN_STOP_TIMEOUT_MS = 1_200;
const DEFAULT_ACTIVE_TURN_STOP_INTERVAL_MS = 25;

async function defaultSleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function isRovoAppUseChatBusy(status: ChatStatus): boolean {
	return status === "submitted" || status === "streaming";
}

export type RovoAppExplicitCancelResult =
	| "cancel-requested"
	| "debounced"
	| "failed"
	| "run-cancelled";

export interface RequestExplicitRovoAppCancelInput {
	activeThreadIdRef: MutableRef<string | null>;
	attachedRunStatus: RovoAppRunStatus | null;
	cancelRun: (threadId: string, options: { signal: AbortSignal }) => Promise<boolean>;
	cancelUrlForThread: (threadId: string | null) => string;
	currentActiveRun: RovoAppActiveRun | null | undefined;
	fetchCancel: (url: string, options: { signal: AbortSignal }) => Promise<unknown>;
	/** Shared debounce gate (createRovoCancelDebounce); refuses a repeat key. */
	mayCancel: (debounceKey: string) => boolean;
	queueProcessorRunningRef: MutableRef<boolean>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setHasActiveDispatch: (hasActiveDispatch: boolean) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	/** Caps the whole cancel (run cancel plus fallback) so the queue is not held. */
	timeoutMs?: number;
	/** The turn being stopped; a Stop on a new turn is never debounced by the last one. */
	turnId: string | null;
	warn?: (message: string, error: unknown) => void;
}

export interface CancelRovoAppThreadRunLifecycleInput {
	activeThreadIdRef: MutableRef<string | null>;
	cancelRun: (threadId: string) => Promise<boolean>;
	queueProcessorRunningRef: MutableRef<boolean>;
	refreshThreads: () => Promise<unknown>;
	runSubscriptionAbortControllerRef: MutableRef<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRef<string | null>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setHasActiveDispatch: (hasActiveDispatch: boolean) => void;
	setInputError: (message: string | null) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	threadId: string;
	toUserErrorMessage: (error: unknown) => string;
}

export interface InterruptRovoAppActiveTurnInput {
	activeThreadIdRef: MutableRef<string | null>;
	attachedRunStatus: RovoAppRunStatus | null;
	clearDirectDelegationState: () => void;
	currentActiveRun: RovoAppActiveRun | null | undefined;
	delegationAbortControllerRef: MutableRef<AbortController | null>;
	explicitUserCancel?: boolean;
	interruptPromiseRef: MutableRef<Promise<void> | null>;
	mutateRealtimeMessagesState: (
		updater: (currentMessages: RovoUIMessage[]) => RovoUIMessage[],
	) => RovoUIMessage[];
	requestExplicitCancel: () => Promise<unknown>;
	runSubscriptionAbortControllerRef: MutableRef<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRef<string | null>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setInputError: (message: string | null) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	setRovoMessages: SetState<RovoUIMessage[]>;
	sleep?: Sleep;
	source?: RovoMessageInterruptionSource;
	statusRef: MutableRef<ChatStatus>;
	stopUseChat: () => void | Promise<void>;
	toUserErrorMessage: (error: unknown) => string;
	useChatStatus: ChatStatus;
	waitForActiveTurnToStop: () => Promise<boolean>;
	warn?: (message: string) => void;
}

/**
 * Options for interrupting the active Rovo app turn. `source` labels the
 * interruption on the reply; `explicitUserCancel` is set only by a Stop
 * button, so the backend is always told to cancel. Programmatic interrupts
 * (send-now, voice barge-in, artifact submission) leave it unset and escalate
 * to a backend cancel only when stop() does not settle in time, so a late
 * cancel cannot land on the prompt they start next on the same thread.
 */
export interface RovoAppInterruptActiveTurnOptions {
	explicitUserCancel?: boolean;
	source?: RovoMessageInterruptionSource;
}

export type RovoAppInterruptActiveTurn = (
	options?: RovoAppInterruptActiveTurnOptions,
) => Promise<void>;

export function updateRovoAppThreadActiveRun(
	threads: ReadonlyArray<RovoAppThread>,
	{
		activeRun,
		now = new Date().toISOString(),
		threadId,
	}: {
		activeRun: RovoAppActiveRun | null;
		now?: string;
		threadId: string;
	},
): RovoAppThread[] {
	return threads.map((thread) => {
		if (thread.id !== threadId) {
			return thread;
		}

		return {
			...thread,
			activeRun,
			updatedAt: now,
		};
	});
}

export function createRovoAppLocalActiveRun({
	now = new Date().toISOString(),
	status = "streaming",
	threadId,
}: {
	now?: string;
	status?: RovoAppRunStatus;
	threadId: string;
}): RovoAppActiveRun {
	return {
		id: `rovo-app-run-local-${threadId}`,
		backend: "ai-gateway",
		status,
		rovoPort: null,
		startedAt: now,
		updatedAt: now,
	};
}

export function completeRovoAppUseChatTurn({
	activeThreadId,
	kickQueue,
	setAttachedRunStatus,
	setLocalThreadActiveRun,
}: {
	activeThreadId: string | null;
	kickQueue: () => void;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
}): void {
	if (activeThreadId) {
		setLocalThreadActiveRun(activeThreadId, null);
	}
	setAttachedRunStatus(null);
	kickQueue();
}

export async function requestExplicitRovoAppCancel({
	activeThreadIdRef,
	attachedRunStatus,
	cancelRun,
	cancelUrlForThread,
	currentActiveRun,
	fetchCancel,
	mayCancel,
	queueProcessorRunningRef,
	setAttachedRunStatus,
	setHasActiveDispatch,
	setLocalThreadActiveRun,
	timeoutMs = EXPLICIT_CANCEL_REQUEST_TIMEOUT_MS,
	turnId,
	warn = console.warn,
}: RequestExplicitRovoAppCancelInput): Promise<RovoAppExplicitCancelResult> {
	const activeThreadId = activeThreadIdRef.current;
	if (!mayCancel(getRovoCancelDebounceKey({ threadId: activeThreadId }, turnId))) {
		return "debounced";
	}

	const signal = AbortSignal.timeout(timeoutMs);
	try {
		if (activeThreadId && (currentActiveRun || attachedRunStatus !== null)) {
			const cancelled = await cancelRun(activeThreadId, { signal }).catch(() => false);
			if (cancelled) {
				queueProcessorRunningRef.current = false;
				setHasActiveDispatch(false);
				setLocalThreadActiveRun(activeThreadId, null);
				setAttachedRunStatus(null);
				return "run-cancelled";
			}
		}

		await fetchCancel(cancelUrlForThread(activeThreadId), { signal });
		queueProcessorRunningRef.current = false;
		setHasActiveDispatch(false);
		if (activeThreadId) {
			setLocalThreadActiveRun(activeThreadId, null);
		}
		setAttachedRunStatus(null);
		return "cancel-requested";
	} catch (error) {
		warn("[RovoApp] Explicit cancel request failed:", error);
		return "failed";
	}
}

export async function cancelRovoAppThreadRunWithLifecycle({
	activeThreadIdRef,
	cancelRun,
	queueProcessorRunningRef,
	refreshThreads,
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	setAttachedRunStatus,
	setHasActiveDispatch,
	setInputError,
	setLocalThreadActiveRun,
	threadId,
	toUserErrorMessage,
}: CancelRovoAppThreadRunLifecycleInput): Promise<boolean> {
	try {
		const cancelled = await cancelRun(threadId);
		if (!cancelled) {
			await refreshThreads();
			return false;
		}

		setLocalThreadActiveRun(threadId, null);
		if (activeThreadIdRef.current === threadId) {
			queueProcessorRunningRef.current = false;
			setHasActiveDispatch(false);
			runSubscriptionAbortControllerRef.current?.abort();
			runSubscriptionAbortControllerRef.current = null;
			runSubscriptionThreadIdRef.current = null;
			setAttachedRunStatus(null);
		}
		return true;
	} catch (error) {
		setInputError(toUserErrorMessage(error));
		return false;
	}
}

export async function interruptRovoAppActiveTurn({
	activeThreadIdRef,
	attachedRunStatus,
	clearDirectDelegationState,
	currentActiveRun,
	delegationAbortControllerRef,
	explicitUserCancel = false,
	interruptPromiseRef,
	mutateRealtimeMessagesState,
	requestExplicitCancel,
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	setAttachedRunStatus,
	setInputError,
	setLocalThreadActiveRun,
	setRovoMessages,
	sleep = defaultSleep,
	source = "user-stop",
	statusRef,
	stopUseChat,
	toUserErrorMessage,
	useChatStatus,
	waitForActiveTurnToStop,
	warn = console.warn,
}: InterruptRovoAppActiveTurnInput): Promise<void> {
	if (interruptPromiseRef.current) {
		return interruptPromiseRef.current;
	}

	const interruptPromise = (async () => {
		const hadActiveTurn = isRovoAppUseChatBusy(statusRef.current);
		const hasUseChatTurn = isRovoAppUseChatBusy(useChatStatus);
		const hasAttachedRun =
			attachedRunStatus !== null || currentActiveRun !== null;
		const directDelegationAbortController = delegationAbortControllerRef.current;
		const hasBackgroundCancelableWork =
			hasAttachedRun || directDelegationAbortController !== null;
		try {
			let stoppedInTime = true;
			if (hadActiveTurn && hasUseChatTurn) {
				await stopUseChat();
				stoppedInTime = await waitForActiveTurnToStop();
			}

			const shouldRequestExplicitCancel = hadActiveTurn
				? shouldSendExplicitRovoCancel({
						// A Stop button always reaches the backend: stop() settles the
						// chat locally whether or not the backend saw the disconnect.
						explicitUserCancel,
						hasBackgroundCancelableWork,
						hasUseChatTurn,
						stopSettledInTime: stoppedInTime,
					})
				: hasBackgroundCancelableWork;

			if (shouldRequestExplicitCancel) {
				if (hadActiveTurn && hasUseChatTurn && !stoppedInTime) {
					warn("[RovoApp] useChat turn did not stop within grace period; escalating to explicit cancel.");
				}
				await requestExplicitCancel();
				if (hadActiveTurn) {
					stoppedInTime = await waitForActiveTurnToStop();
				}
			}

			if (hadActiveTurn || hasBackgroundCancelableWork) {
				runSubscriptionAbortControllerRef.current?.abort();
				runSubscriptionAbortControllerRef.current = null;
				runSubscriptionThreadIdRef.current = null;
				setAttachedRunStatus(null);
				directDelegationAbortController?.abort();
				clearDirectDelegationState();
				delegationAbortControllerRef.current = null;

				const threadIdForCleanup = activeThreadIdRef.current;
				if (threadIdForCleanup && hasAttachedRun) {
					setLocalThreadActiveRun(threadIdForCleanup, null);
				}
			}

			if (hadActiveTurn && !stoppedInTime) {
				warn("[RovoApp] Proceeding after cancel timeout while interrupting active turn.");
			}

			const interruptedAt = new Date().toISOString();
			let didMarkInterruptedReply = false;
			if (hasUseChatTurn || hasBackgroundCancelableWork) {
				setRovoMessages((previousMessages) => {
					const result = markLastRovoAppAssistantMessageInterrupted(
						previousMessages,
						{
							interruptedAt,
							source,
						},
					);
					didMarkInterruptedReply = result.messageId !== null;
					return didMarkInterruptedReply ? result.messages : previousMessages;
				});
			} else {
				mutateRealtimeMessagesState((previousMessages) => {
					const result = markLastRovoAppAssistantMessageInterrupted(
						previousMessages,
						{
							interruptedAt,
							source,
						},
					);
					didMarkInterruptedReply = result.messageId !== null;
					return didMarkInterruptedReply ? result.messages : previousMessages;
				});
			}

			if (didMarkInterruptedReply) {
				await sleep(0);
			}
		} catch (error) {
			setInputError(toUserErrorMessage(error));
			throw error;
		}
	})().finally(() => {
		interruptPromiseRef.current = null;
	});

	interruptPromiseRef.current = interruptPromise;
	return interruptPromise;
}

export function handleRovoAppUseChatError({
	activeDocumentRef,
	clearArtifactState,
	clearStreamingArtifactState,
	currentTurnIntentRef,
	error,
	pendingArtifactCreationRetryRef,
	resetPendingArtifactAssociation,
	setInputError,
	streamingArtifactRef,
	toUserErrorMessage,
}: {
	activeDocumentRef: MutableRef<RovoAppDocument | null>;
	clearArtifactState: () => void;
	clearStreamingArtifactState: () => void;
	currentTurnIntentRef: MutableRef<string | null>;
	error: unknown;
	pendingArtifactCreationRetryRef: MutableRef<boolean>;
	resetPendingArtifactAssociation: () => void;
	setInputError: (message: string | null) => void;
	streamingArtifactRef: MutableRef<RovoAppStreamingArtifact | null>;
	toUserErrorMessage: (error: unknown) => string;
}): void {
	const streamingDocumentId = streamingArtifactRef.current?.documentId;
	const turnIntent = currentTurnIntentRef.current;
	clearStreamingArtifactState();
	resetPendingArtifactAssociation();
	if (!activeDocumentRef.current && streamingDocumentId) {
		clearArtifactState();
	}
	if (turnIntent === "artifact_create") {
		pendingArtifactCreationRetryRef.current = true;
	}
	currentTurnIntentRef.current = null;
	setInputError(toUserErrorMessage(error));
}

export function handleRovoAppAttachedRunChunk({
	attachedRunStatus,
	chunk,
	dispatchDataPart,
	now = () => new Date().toISOString(),
	runSubscriptionThreadIdRef,
	setAttachedRunStatus,
	setThreads,
}: {
	attachedRunStatus: RovoAppRunStatus | null;
	chunk: { data?: unknown; type?: string };
	dispatchDataPart: (dataPart: { data: unknown; type: string }) => void;
	now?: () => string;
	runSubscriptionThreadIdRef: MutableRef<string | null>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setThreads: SetState<RovoAppThread[]>;
}): void {
	if (!chunk?.type || !chunk.type.startsWith("data-")) {
		return;
	}

	if (attachedRunStatus === "queued") {
		setAttachedRunStatus("streaming");
		const threadId = runSubscriptionThreadIdRef.current;
		if (threadId) {
			setThreads((previousThreads) =>
				previousThreads.map((thread) => {
					if (thread.id !== threadId || !thread.activeRun) {
						return thread;
					}

					return {
						...thread,
						activeRun: {
							...thread.activeRun,
							status: "streaming",
							updatedAt: now(),
						},
					};
				}),
			);
		}
	}

	dispatchDataPart({
		type: chunk.type,
		data: chunk.data,
	});
}

export async function waitForRovoAppActiveTurnToStop({
	now = Date.now,
	sleep = defaultSleep,
	statusRef,
	timeoutMs = DEFAULT_ACTIVE_TURN_STOP_TIMEOUT_MS,
	waitIntervalMs = DEFAULT_ACTIVE_TURN_STOP_INTERVAL_MS,
}: {
	now?: () => number;
	sleep?: Sleep;
	statusRef: MutableRef<ChatStatus>;
	timeoutMs?: number;
	waitIntervalMs?: number;
}): Promise<boolean> {
	const startedAt = now();
	while (isRovoAppUseChatBusy(statusRef.current)) {
		if (now() - startedAt > timeoutMs) {
			return false;
		}
		await sleep(waitIntervalMs);
	}
	return true;
}

export async function releaseCompletedRovoAppUseChatTurn({
	activeThreadIdRef,
	hasObservedTurnCompleteRef,
	now,
	setAttachedRunStatus,
	setLocalThreadActiveRun,
	sleep,
	statusRef,
	stopUseChat,
	timeoutMs,
	useChatStatus,
	waitIntervalMs,
}: {
	activeThreadIdRef: MutableRef<string | null>;
	hasObservedTurnCompleteRef: MutableRef<boolean>;
	now?: () => number;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	sleep?: Sleep;
	statusRef: MutableRef<ChatStatus>;
	stopUseChat: () => void | Promise<void>;
	timeoutMs?: number;
	useChatStatus: ChatStatus;
	waitIntervalMs?: number;
}): Promise<void> {
	if (!isRovoAppUseChatBusy(useChatStatus) || !hasObservedTurnCompleteRef.current) {
		return;
	}

	const threadId = activeThreadIdRef.current;
	if (threadId) {
		setLocalThreadActiveRun(threadId, null);
	}
	setAttachedRunStatus(null);
	await stopUseChat();

	await waitForRovoAppActiveTurnToStop({
		now,
		sleep,
		statusRef,
		timeoutMs,
		waitIntervalMs,
	});
}
