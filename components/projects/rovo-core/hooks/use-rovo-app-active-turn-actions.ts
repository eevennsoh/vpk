"use client";

import type { ChatStatus } from "ai";
import {
	useCallback,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import { cancelRovoAppRun } from "@/components/projects/rovo-core/lib/api";
import {
	cancelRovoAppThreadRunWithLifecycle,
	interruptRovoAppActiveTurn,
	requestExplicitRovoAppCancel,
	waitForRovoAppActiveTurnToStop,
	type RovoAppInterruptActiveTurnOptions,
	type RovoAppInterruptActiveTurn,
} from "@/components/projects/rovo-core/lib/rovo-app-run-lifecycle";
import {
	dispatchRovoAppVoiceSteer,
	type RovoAppVoiceSteerPayload,
} from "@/components/projects/rovo-core/lib/rovo-app-voice-steer-dispatcher";
import { buildRovoAppCancelUrl } from "@/components/projects/rovo-core/lib/rovo-app-agent-mode";
import {
	waitForRovoApp,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";
import { createRovoCancelDebounce } from "@/lib/rovo-cancel-strategy";
import type {
	RovoAppActiveRun,
	RovoAppDocument,
	RovoAppRunStatus,
} from "@/lib/rovo-app-types";
import {
	getLatestUserMessageId,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";

const ACTIVE_TURN_STOP_TIMEOUT_MS = 1_200;

type RealtimeMessagesStateUpdater = (currentMessages: RovoUIMessage[]) => RovoUIMessage[];

type MutateRealtimeMessagesState = (
	updater: RealtimeMessagesStateUpdater,
) => RovoUIMessage[];

interface UseRovoAppActiveTurnActionsOptions {
	activeRun: RovoAppActiveRun | null | undefined;
	activeThreadIdRef: MutableRefObject<string | null>;
	appendLocalUserMessage: (payload: {
		files: [];
		text: string;
	}) => {
		message: Pick<RovoUIMessage, "metadata">;
		messageId: string;
	};
	attachedRunStatus: RovoAppRunStatus | null;
	clearDirectDelegationState: () => void;
	delegationAbortControllerRef: MutableRefObject<AbortController | null>;
	ensureThread: (seedText: string) => Promise<string>;
	interruptActiveTurnRef: MutableRefObject<RovoAppInterruptActiveTurn>;
	interruptPromiseRef: MutableRefObject<Promise<void> | null>;
	markLocalThreadRunPending: (threadId: string) => void;
	mutateRealtimeMessagesState: MutateRealtimeMessagesState;
	queueProcessorRunningRef: MutableRefObject<boolean>;
	refreshThreads: () => Promise<unknown>;
	releaseCompletedUseChatTurnIfNeeded: () => Promise<unknown>;
	resetPendingArtifactAssociation: () => void;
	rovoMessagesRef: MutableRefObject<RovoUIMessage[]>;
	runSubscriptionAbortControllerRef: MutableRefObject<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRefObject<string | null>;
	saveStreamingArtifactCheckpoint: () => Promise<RovoAppDocument | null>;
	sendMessage: (
		message: {
			files: [];
			messageId: string;
			metadata?: RovoUIMessage["metadata"];
			text: string;
		},
		options: {
			body: Record<string, unknown>;
		},
	) => Promise<unknown>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setHasActiveDispatch: (hasActiveDispatch: boolean) => void;
	setInputError: Dispatch<SetStateAction<string | null>>;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	setRovoMessages: Dispatch<SetStateAction<RovoUIMessage[]>>;
	statusRef: MutableRefObject<ChatStatus>;
	stopUseChat: () => void | Promise<void>;
	toUserErrorMessage: (error: unknown) => string;
	useChatStatus: ChatStatus;
}

interface UseRovoAppActiveTurnActionsResult {
	applyVoiceSteer: (payload: RovoAppVoiceSteerPayload) => Promise<void>;
	cancelThreadRun: (threadId: string) => Promise<boolean>;
	interruptActiveTurn: RovoAppInterruptActiveTurn;
	stop: () => Promise<void>;
}

export function useRovoAppActiveTurnActions({
	activeRun,
	activeThreadIdRef,
	appendLocalUserMessage,
	attachedRunStatus,
	clearDirectDelegationState,
	delegationAbortControllerRef,
	ensureThread,
	interruptActiveTurnRef,
	interruptPromiseRef,
	markLocalThreadRunPending,
	mutateRealtimeMessagesState,
	queueProcessorRunningRef,
	refreshThreads,
	releaseCompletedUseChatTurnIfNeeded,
	resetPendingArtifactAssociation,
	rovoMessagesRef,
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	saveStreamingArtifactCheckpoint,
	sendMessage,
	setAttachedRunStatus,
	setHasActiveDispatch,
	setInputError,
	setLocalThreadActiveRun,
	setRovoMessages,
	statusRef,
	stopUseChat,
	toUserErrorMessage,
	useChatStatus,
}: UseRovoAppActiveTurnActionsOptions): UseRovoAppActiveTurnActionsResult {
	// One debounce gate per hook: it owns the backend-cancel debounce per turn.
	const [mayCancel] = useState(() => createRovoCancelDebounce());
	const requestExplicitCancel = useCallback(async (turnId: string | null) => {
		await requestExplicitRovoAppCancel({
			activeThreadIdRef,
			attachedRunStatus,
			cancelRun: cancelRovoAppRun,
			cancelUrlForThread: buildRovoAppCancelUrl,
			currentActiveRun: activeRun,
			fetchCancel: (url, { signal }) => fetch(url, { method: "POST", signal }),
			mayCancel,
			queueProcessorRunningRef,
			setAttachedRunStatus,
			setHasActiveDispatch,
			setLocalThreadActiveRun,
			turnId,
		});
	}, [
		activeRun,
		activeThreadIdRef,
		attachedRunStatus,
		mayCancel,
		queueProcessorRunningRef,
		setAttachedRunStatus,
		setHasActiveDispatch,
		setLocalThreadActiveRun,
	]);

	const cancelThreadRun = useCallback(
		async (threadId: string) => {
			return cancelRovoAppThreadRunWithLifecycle({
				activeThreadIdRef,
				cancelRun: cancelRovoAppRun,
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
			});
		},
		[
			activeThreadIdRef,
			queueProcessorRunningRef,
			refreshThreads,
			runSubscriptionAbortControllerRef,
			runSubscriptionThreadIdRef,
			setAttachedRunStatus,
			setHasActiveDispatch,
			setInputError,
			setLocalThreadActiveRun,
			toUserErrorMessage,
		],
	);

	const interruptActiveTurn = useCallback(
		async ({
			explicitUserCancel = false,
			source = "user-stop",
		}: RovoAppInterruptActiveTurnOptions = {}) => {
			// Read before stopping: the turn to cancel is the one running now.
			const turnId = getLatestUserMessageId(rovoMessagesRef.current);
			return interruptRovoAppActiveTurn({
				activeThreadIdRef,
				attachedRunStatus,
				clearDirectDelegationState,
				currentActiveRun: activeRun,
				delegationAbortControllerRef,
				explicitUserCancel,
				interruptPromiseRef,
				mutateRealtimeMessagesState,
				requestExplicitCancel: () => requestExplicitCancel(turnId),
				runSubscriptionAbortControllerRef,
				runSubscriptionThreadIdRef,
				setAttachedRunStatus,
				setInputError,
				setLocalThreadActiveRun,
				setRovoMessages,
				sleep: waitForRovoApp,
				source,
				statusRef,
				stopUseChat,
				toUserErrorMessage,
				useChatStatus,
				waitForActiveTurnToStop: () =>
					waitForRovoAppActiveTurnToStop({
						sleep: waitForRovoApp,
						statusRef,
						timeoutMs: ACTIVE_TURN_STOP_TIMEOUT_MS,
					}),
			});
		},
		[
			activeRun,
			activeThreadIdRef,
			attachedRunStatus,
			clearDirectDelegationState,
			delegationAbortControllerRef,
			interruptPromiseRef,
			mutateRealtimeMessagesState,
			requestExplicitCancel,
			rovoMessagesRef,
			runSubscriptionAbortControllerRef,
			runSubscriptionThreadIdRef,
			setAttachedRunStatus,
			setInputError,
			setLocalThreadActiveRun,
			setRovoMessages,
			statusRef,
			stopUseChat,
			toUserErrorMessage,
			useChatStatus,
		],
	);
	interruptActiveTurnRef.current = interruptActiveTurn;

	const stop = useCallback(async () => {
		await interruptActiveTurn({ explicitUserCancel: true, source: "user-stop" });
	}, [interruptActiveTurn]);

	const applyVoiceSteer = useCallback(
		async (payload: RovoAppVoiceSteerPayload) => {
			await dispatchRovoAppVoiceSteer({
				...payload,
				appendLocalUserMessage,
				ensureThread,
				interruptActiveTurn,
				markLocalThreadRunPending,
				releaseCompletedUseChatTurnIfNeeded,
				resetPendingArtifactAssociation,
				saveStreamingArtifactCheckpoint,
				sendMessage,
				setInputError,
				statusRef,
				toUserErrorMessage,
			});
		},
		[
			appendLocalUserMessage,
			ensureThread,
			interruptActiveTurn,
			markLocalThreadRunPending,
			releaseCompletedUseChatTurnIfNeeded,
			resetPendingArtifactAssociation,
			saveStreamingArtifactCheckpoint,
			sendMessage,
			setInputError,
			statusRef,
			toUserErrorMessage,
		],
	);

	return {
		applyVoiceSteer,
		cancelThreadRun,
		interruptActiveTurn,
		stop,
	};
}
