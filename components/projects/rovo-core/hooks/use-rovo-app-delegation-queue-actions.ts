"use client";

import type { ChatStatus } from "ai";
import {
	useCallback,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import {
	dispatchRovoAppDelegationNow,
	type RovoAppDelegationDispatchOptions,
} from "@/components/projects/rovo-core/lib/rovo-app-delegation-dispatcher";
import {
	dispatchQueuedRovoAppActionImmediately,
	submitRovoAppDelegationDispatch,
	type RovoAppImmediateDispatchLifecycle,
	type RovoAppPromptDispatchLifecyclePayload,
} from "@/components/projects/rovo-core/lib/rovo-app-dispatch-lifecycle";
import { isRovoAppThreadBusy } from "@/components/projects/rovo-core/lib/rovo-app-queue-gate";
import { processRovoAppQueuedActions } from "@/components/projects/rovo-core/lib/rovo-app-queue-state";
import type { RovoAppDirectDelegationPhase } from "@/components/projects/shared/lib/rovo-app-composer-submit-state";
import { getLatestQuestionCardPayload } from "@/components/projects/shared/lib/question-card-widget";
import { getLatestPendingPlanWidget } from "@/components/projects/shared/lib/plan-widget";
import {
	buildRovoAppQueuedDelegationAction,
	resolveRovoAppQueuedActionDispatch,
	waitForRovoApp,
	type RovoAppSendMode,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";
import type {
	RovoAppActiveRun,
	RovoAppDocument,
	RovoAppQueuedAction,
	RovoAppRunStatus,
	RovoAppVisibility,
} from "@/lib/rovo-app-types";
import type {
	RovoMessageMetadata,
	RovoUIMessage,
} from "@/lib/rovo-ui-messages";

type RealtimeMessagesStateUpdater = (currentMessages: RovoUIMessage[]) => RovoUIMessage[];

interface RealtimeMessagesStateOptions {
	incrementVersion?: boolean;
}

type MutateRealtimeMessagesState = (
	updater: RealtimeMessagesStateUpdater,
	options?: RealtimeMessagesStateOptions,
) => RovoUIMessage[];

interface DelegateToRovoOptions {
	contextDescription?: string;
	conversationSummary?: string;
	existingRealtimeMessageId?: string | null;
	intentType?: string;
	prompt?: string;
	referencedFiles?: string[];
	urgency?: string;
}

interface QueueDelegationActionOptions extends DelegateToRovoOptions {
	prompt: string;
	threadId: string;
}

interface UseRovoAppDelegationQueueActionsOptions {
	activeDocument: RovoAppDocument | null;
	activeDocumentContent: string;
	activeRun: RovoAppActiveRun | null;
	activeThreadIdRef: MutableRefObject<string | null>;
	appendRealtimeMessage: (
		role: "user" | "assistant",
		content: string,
		options?: {
			createdAt?: string;
			messageId?: string;
			metadata?: RovoMessageMetadata;
			parts?: RovoUIMessage["parts"];
			state?: "done" | "streaming";
		},
	) => Promise<string>;
	artifactDraftContent: string;
	attachedRunStatus: RovoAppRunStatus | null;
	attachedRunStatusRef: MutableRefObject<RovoAppRunStatus | null>;
	clearDirectDelegationState: () => void;
	delegationAbortControllerRef: MutableRefObject<AbortController | null>;
	dispatchPromptNow: (payload: RovoAppPromptDispatchLifecyclePayload) => Promise<void>;
	draftThreadId: string;
	enqueueQueuedAction: (action: RovoAppQueuedAction) => void;
	ensureThread: (seedText: string) => Promise<string>;
	immediateDispatchInProgressRef: MutableRefObject<boolean>;
	immediateDispatchLifecycle: RovoAppImmediateDispatchLifecycle;
	kickQueue: () => void;
	messages: RovoUIMessage[];
	mutateRealtimeMessagesState: MutateRealtimeMessagesState;
	peekNextQueuedActionForThread: (threadId: string) => RovoAppQueuedAction | null;
	prependQueuedAction: (action: RovoAppQueuedAction) => void;
	processQueueRef: MutableRefObject<() => Promise<void>>;
	queueProcessorRunningRef: MutableRefObject<boolean>;
	queuedActionsByThreadId: Readonly<Record<string, ReadonlyArray<RovoAppQueuedAction> | undefined>>;
	realtimeMessagesRef: MutableRefObject<RovoUIMessage[]>;
	removeQueuedAction: (threadId: string, actionId: string) => void;
	resetPendingArtifactAssociation: () => void;
	rovoMessagesRef: MutableRefObject<RovoUIMessage[]>;
	runSubscriptionAbortControllerRef: MutableRefObject<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRefObject<string | null>;
	saveStreamingArtifactCheckpoint: () => Promise<RovoAppDocument | null>;
	sendMode: RovoAppSendMode;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setBackgroundDelegationMessageId: Dispatch<SetStateAction<string | null>>;
	setDelegationTurnStatus: Dispatch<SetStateAction<ChatStatus>>;
	setDirectDelegationPhase: Dispatch<SetStateAction<RovoAppDirectDelegationPhase>>;
	setHasActiveDispatch: (hasActiveDispatch: boolean) => void;
	setInputError: Dispatch<SetStateAction<string | null>>;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	shiftNextQueuedActionForThread: (threadId: string) => RovoAppQueuedAction | null;
	smartGenerationRequest: unknown;
	statusRef: MutableRefObject<ChatStatus>;
	stopUseChat: () => Promise<unknown>;
	streamingArtifact: RovoAppStreamingArtifact | null;
	threadVisibility: RovoAppVisibility;
	toUserErrorMessage: (error: unknown) => string;
	useChatStatus: ChatStatus;
}

interface UseRovoAppDelegationQueueActionsResult {
	delegateToRovo: (
		messageId: string,
		options?: DelegateToRovoOptions,
	) => Promise<void>;
	sendQueuedPromptNow: (id: string) => Promise<void>;
}

export function useRovoAppDelegationQueueActions({
	activeDocument,
	activeDocumentContent,
	activeRun,
	activeThreadIdRef,
	appendRealtimeMessage,
	artifactDraftContent,
	attachedRunStatus,
	attachedRunStatusRef,
	clearDirectDelegationState,
	delegationAbortControllerRef,
	dispatchPromptNow,
	draftThreadId,
	enqueueQueuedAction,
	ensureThread,
	immediateDispatchInProgressRef,
	immediateDispatchLifecycle,
	kickQueue,
	messages,
	mutateRealtimeMessagesState,
	peekNextQueuedActionForThread,
	prependQueuedAction,
	processQueueRef,
	queueProcessorRunningRef,
	queuedActionsByThreadId,
	realtimeMessagesRef,
	removeQueuedAction,
	resetPendingArtifactAssociation,
	rovoMessagesRef,
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	saveStreamingArtifactCheckpoint,
	sendMode,
	setAttachedRunStatus,
	setBackgroundDelegationMessageId,
	setDelegationTurnStatus,
	setDirectDelegationPhase,
	setHasActiveDispatch,
	setInputError,
	setLocalThreadActiveRun,
	shiftNextQueuedActionForThread,
	smartGenerationRequest,
	statusRef,
	stopUseChat,
	streamingArtifact,
	threadVisibility,
	toUserErrorMessage,
	useChatStatus,
}: UseRovoAppDelegationQueueActionsOptions): UseRovoAppDelegationQueueActionsResult {
	const dispatchDelegationNow = useCallback(
		async (
			messageId: string,
			options?: RovoAppDelegationDispatchOptions,
		) => {
			await dispatchRovoAppDelegationNow({
				activeDocument,
				activeDocumentContent,
				activeThreadIdRef,
				appendRealtimeMessage,
				artifactDraftContent,
				attachedRunStatus,
				clearDirectDelegationState,
				currentActiveRun: activeRun,
				delegationAbortControllerRef,
				ensureThread,
				messageId,
				messages,
				mutateRealtimeMessagesState,
				options,
				realtimeMessagesRef,
				resetPendingArtifactAssociation,
				rovoMessagesRef,
				runSubscriptionAbortControllerRef,
				runSubscriptionThreadIdRef,
				saveStreamingArtifactCheckpoint,
				setAttachedRunStatus,
				setBackgroundDelegationMessageId,
				setDelegationTurnStatus,
				setDirectDelegationPhase,
				setInputError,
				setLocalThreadActiveRun,
				smartGenerationRequest,
				statusRef,
				stopUseChat,
				streamingArtifact,
				threadVisibility,
				useChatStatus,
			});
		},
		[
			activeDocument,
			activeDocumentContent,
			activeRun,
			activeThreadIdRef,
			appendRealtimeMessage,
			artifactDraftContent,
			attachedRunStatus,
			clearDirectDelegationState,
			delegationAbortControllerRef,
			ensureThread,
			messages,
			mutateRealtimeMessagesState,
			realtimeMessagesRef,
			resetPendingArtifactAssociation,
			rovoMessagesRef,
			runSubscriptionAbortControllerRef,
			runSubscriptionThreadIdRef,
			saveStreamingArtifactCheckpoint,
			setAttachedRunStatus,
			setBackgroundDelegationMessageId,
			setDelegationTurnStatus,
			setDirectDelegationPhase,
			setInputError,
			setLocalThreadActiveRun,
			smartGenerationRequest,
			statusRef,
			stopUseChat,
			streamingArtifact,
			threadVisibility,
			useChatStatus,
		],
	);

	const enqueueDelegationAction = useCallback(
		(
			delegatedMessageId: string,
			options: QueueDelegationActionOptions,
		) => {
			const queuedAction = buildRovoAppQueuedDelegationAction({
				contextDescription: options.contextDescription,
				conversationSummary: options.conversationSummary,
				delegatedMessageId,
				existingRealtimeMessageId: options.existingRealtimeMessageId,
				intentType: options.intentType,
				prompt: options.prompt,
				referencedFiles: options.referencedFiles,
				threadId: options.threadId,
				urgency: options.urgency,
			});
			enqueueQueuedAction(queuedAction);
		},
		[enqueueQueuedAction],
	);

	const dispatchQueuedActionNow = useCallback(
		async (action: RovoAppQueuedAction) => {
			const queuedDispatch = resolveRovoAppQueuedActionDispatch(action);
			if (queuedDispatch.kind === "delegation") {
				await dispatchDelegationNow(
					queuedDispatch.delegatedMessageId,
					queuedDispatch.options,
				);
				return;
			}

			await dispatchPromptNow(queuedDispatch.payload);
		},
		[dispatchDelegationNow, dispatchPromptNow],
	);

	const processQueue = useCallback(async () => {
		await processRovoAppQueuedActions({
			activeThreadIdRef,
			attachedRunStatusRef,
			dispatchQueuedActionNow,
			getHasPendingClarification: () =>
				getLatestQuestionCardPayload(rovoMessagesRef.current) !== null,
			getHasPendingPlanApproval: () =>
				getLatestPendingPlanWidget(rovoMessagesRef.current) !== null,
			peekNextQueuedActionForThread,
			prependQueuedAction,
			processQueueRef,
			queueProcessorRunningRef,
			scheduleRetry: (callback, delayMs) => {
				window.setTimeout(callback, delayMs);
			},
			setHasActiveDispatch,
			setInputError,
			shiftNextQueuedActionForThread,
			shouldPauseProcessing: () => immediateDispatchInProgressRef.current,
			statusRef,
			toUserErrorMessage,
			waitForRovoApp,
		});
	}, [
		activeThreadIdRef,
		attachedRunStatusRef,
		dispatchQueuedActionNow,
		immediateDispatchInProgressRef,
		peekNextQueuedActionForThread,
		prependQueuedAction,
		processQueueRef,
		queueProcessorRunningRef,
		rovoMessagesRef,
		setHasActiveDispatch,
		setInputError,
		shiftNextQueuedActionForThread,
		statusRef,
		toUserErrorMessage,
	]);

	processQueueRef.current = processQueue;

	const delegateToRovo = useCallback(
		async (
			messageId: string,
			options?: DelegateToRovoOptions,
		) => {
			await submitRovoAppDelegationDispatch({
				activeThreadId: activeThreadIdRef.current,
				dispatchDelegationNow,
				draftThreadId,
				enqueueDelegationAction,
				getHasBusyTurn: () =>
					isRovoAppThreadBusy({
						activeRunStatus: activeRun?.status ?? null,
						attachedRunStatus,
						status: statusRef.current,
					}),
				immediateDispatch: immediateDispatchLifecycle,
				kickQueue,
				messageId,
				messages,
				options,
				queuedActionsByThreadId,
				queueProcessorRunningRef,
				realtimeMessagesRef,
				sendMode,
				setInputError,
			});
		},
		[
			activeRun?.status,
			activeThreadIdRef,
			attachedRunStatus,
			dispatchDelegationNow,
			draftThreadId,
			enqueueDelegationAction,
			immediateDispatchLifecycle,
			kickQueue,
			messages,
			queueProcessorRunningRef,
			queuedActionsByThreadId,
			realtimeMessagesRef,
			sendMode,
			setInputError,
			statusRef,
		],
	);

	const sendQueuedPromptNow = useCallback(
		async (id: string) => {
			await dispatchQueuedRovoAppActionImmediately({
				activeThreadId: activeThreadIdRef.current,
				dispatchQueuedActionNow,
				draftThreadId,
				getHasBusyTurn: () =>
					isRovoAppThreadBusy({
						activeRunStatus: activeRun?.status ?? null,
						attachedRunStatus,
						status: statusRef.current,
					}),
				id,
				immediateDispatch: immediateDispatchLifecycle,
				kickQueue,
				prependQueuedAction,
				queuedActionsByThreadId,
				queueProcessorRunningRef,
				removeQueuedAction,
				setInputError,
				toUserErrorMessage,
			});
		},
		[
			activeRun?.status,
			activeThreadIdRef,
			attachedRunStatus,
			dispatchQueuedActionNow,
			draftThreadId,
			immediateDispatchLifecycle,
			kickQueue,
			prependQueuedAction,
			queueProcessorRunningRef,
			queuedActionsByThreadId,
			removeQueuedAction,
			setInputError,
			statusRef,
			toUserErrorMessage,
		],
	);

	return {
		delegateToRovo,
		sendQueuedPromptNow,
	};
}
