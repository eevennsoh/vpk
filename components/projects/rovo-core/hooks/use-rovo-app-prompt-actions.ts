"use client";

import type { ChatStatus, FileUIPart } from "ai";
import {
	useCallback,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import {
	dispatchRovoAppPromptNow,
	submitRovoAppPromptDispatch,
	type RovoAppImmediateDispatchLifecycle,
	type RovoAppPromptDispatchLifecyclePayload,
} from "@/components/projects/rovo-core/lib/rovo-app-dispatch-lifecycle";
import { isRovoAppThreadBusy } from "@/components/projects/rovo-core/lib/rovo-app-queue-gate";
import {
	buildRovoAppQueuedPromptAction,
	type RovoAppPlanningSession,
	type RovoAppSendMode,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";
import type {
	RovoAppActiveRun,
	RovoAppCreationMode,
	RovoAppDocument,
	RovoAppPromptMode,
	RovoAppQueuedAction,
	RovoAppRunStatus,
} from "@/lib/rovo-app-types";
import type {
	RovoMessageMetadata,
	RovoUIMessage,
} from "@/lib/rovo-ui-messages";

interface SubmitRovoAppPromptInput {
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	files: FileUIPart[];
	text: string;
}

interface UseRovoAppPromptActionsOptions {
	activeDocument: RovoAppDocument | null;
	activeDocumentContent: string;
	activeRunStatus: RovoAppActiveRun["status"] | null;
	activeThreadIdRef: MutableRefObject<string | null>;
	appendLocalUserMessage: (input: {
		files: ReadonlyArray<FileUIPart>;
		metadata?: RovoMessageMetadata;
		text: string;
	}) => {
		message: RovoUIMessage;
		messageId: string;
	};
	artifactDraftContent: string;
	attachedRunStatus: RovoAppRunStatus | null;
	clearDirectDelegationState: () => void;
	clearPlanExecutionTrackerDismissalsForThread: (threadId: string) => void;
	clearStreamingArtifactState: () => void;
	delegationAbortControllerRef: MutableRefObject<AbortController | null>;
	draftThreadId: string;
	enqueueQueuedAction: (action: RovoAppQueuedAction) => void;
	ensureThread: (seedText: string) => Promise<string>;
	flushQueuedStreamingArtifactDeltaNow: () => void;
	immediateDispatchLifecycle: RovoAppImmediateDispatchLifecycle;
	isPlanModeRef: MutableRefObject<boolean>;
	kickQueue: () => void;
	lastUseChatBusyAtRef: MutableRefObject<number>;
	markLocalThreadRunPending: (threadId: string) => void;
	planModeSyncRequestIdRef: MutableRefObject<number>;
	queueProcessorRunningRef: MutableRefObject<boolean>;
	queuedActionsByThreadId: Readonly<Record<string, ReadonlyArray<RovoAppQueuedAction> | undefined>>;
	releaseCompletedUseChatTurnIfNeeded: () => Promise<void>;
	resetPendingArtifactAssociation: () => void;
	rovoMessagesRef: MutableRefObject<RovoUIMessage[]>;
	sendMessage: (
		message: {
			files: FileUIPart[];
			messageId: string;
			metadata?: RovoMessageMetadata;
			text: string;
		},
		options: {
			body: Record<string, unknown>;
		},
	) => Promise<void>;
	sendMode: RovoAppSendMode;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setInputError: Dispatch<SetStateAction<string | null>>;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	setPlanningSession: Dispatch<SetStateAction<RovoAppPlanningSession | null>>;
	setRovoMessages: Dispatch<SetStateAction<RovoUIMessage[]>>;
	statusRef: MutableRefObject<ChatStatus>;
	stopUseChat: () => void | Promise<void>;
	streamingArtifact: RovoAppStreamingArtifact | null;
	streamingArtifactRef: MutableRefObject<RovoAppStreamingArtifact | null>;
	syncAgentModeForDispatch: (mode: RovoAppPromptMode) => void | Promise<void>;
	toUserErrorMessage: (error: unknown) => string;
	useChatStatus: ChatStatus;
	useChatStatusRef: MutableRefObject<ChatStatus>;
}

interface UseRovoAppPromptActionsResult {
	dispatchPromptNow: (payload: RovoAppPromptDispatchLifecyclePayload) => Promise<void>;
	submitPrompt: (payload: SubmitRovoAppPromptInput) => Promise<void>;
	suggestedPrompt: (text: string) => Promise<void>;
}

export function useRovoAppPromptActions({
	activeDocument,
	activeDocumentContent,
	activeRunStatus,
	activeThreadIdRef,
	appendLocalUserMessage,
	artifactDraftContent,
	attachedRunStatus,
	clearDirectDelegationState,
	clearPlanExecutionTrackerDismissalsForThread,
	clearStreamingArtifactState,
	delegationAbortControllerRef,
	draftThreadId,
	enqueueQueuedAction,
	ensureThread,
	flushQueuedStreamingArtifactDeltaNow,
	immediateDispatchLifecycle,
	isPlanModeRef,
	kickQueue,
	lastUseChatBusyAtRef,
	markLocalThreadRunPending,
	planModeSyncRequestIdRef,
	queueProcessorRunningRef,
	queuedActionsByThreadId,
	releaseCompletedUseChatTurnIfNeeded,
	resetPendingArtifactAssociation,
	rovoMessagesRef,
	sendMessage,
	sendMode,
	setAttachedRunStatus,
	setInputError,
	setLocalThreadActiveRun,
	setPlanningSession,
	setRovoMessages,
	statusRef,
	stopUseChat,
	streamingArtifact,
	streamingArtifactRef,
	syncAgentModeForDispatch,
	toUserErrorMessage,
	useChatStatus,
	useChatStatusRef,
}: UseRovoAppPromptActionsOptions): UseRovoAppPromptActionsResult {
	const dispatchPromptNow = useCallback(
		async ({
			text,
			files,
			contextDescription,
			creationMode,
			messageMetadata,
			mode,
		}: RovoAppPromptDispatchLifecyclePayload) => {
			await dispatchRovoAppPromptNow({
				activeDocument,
				activeDocumentContent,
				appendLocalUserMessage,
				artifactDraftContent,
				clearDirectDelegationState,
				clearStreamingArtifactState,
				contextDescription,
				creationMode,
				delegationAbortControllerRef,
				ensureThread,
				files,
				flushQueuedStreamingArtifactDeltaNow,
				lastUseChatBusyAtRef,
				markLocalThreadRunPending,
				messageMetadata,
				mode,
				planModeSyncRequestIdRef,
				releaseCompletedUseChatTurnIfNeeded,
				resetPendingArtifactAssociation,
				rovoMessagesRef,
				sendMessage,
				setAttachedRunStatus,
				clearPlanExecutionTrackerDismissalsForThread,
				setInputError,
				setLocalThreadActiveRun,
				setPlanningSession,
				setRovoMessages,
				stopUseChat,
				streamingArtifact,
				streamingArtifactRef,
				syncAgentModeForDispatch,
				text,
				toUserErrorMessage,
				useChatStatus,
				useChatStatusRef,
			});
		},
		[
			activeDocument,
			activeDocumentContent,
			appendLocalUserMessage,
			artifactDraftContent,
			clearDirectDelegationState,
			clearPlanExecutionTrackerDismissalsForThread,
			clearStreamingArtifactState,
			delegationAbortControllerRef,
			ensureThread,
			flushQueuedStreamingArtifactDeltaNow,
			lastUseChatBusyAtRef,
			markLocalThreadRunPending,
			planModeSyncRequestIdRef,
			releaseCompletedUseChatTurnIfNeeded,
			resetPendingArtifactAssociation,
			rovoMessagesRef,
			sendMessage,
			setAttachedRunStatus,
			setInputError,
			setLocalThreadActiveRun,
			setPlanningSession,
			setRovoMessages,
			stopUseChat,
			streamingArtifact,
			streamingArtifactRef,
			syncAgentModeForDispatch,
			toUserErrorMessage,
			useChatStatus,
			useChatStatusRef,
		],
	);

	const enqueuePromptAction = useCallback(
		({
			contextDescription,
			creationMode,
			files,
			messageMetadata,
			mode,
			text,
			threadId,
		}: RovoAppPromptDispatchLifecyclePayload & { threadId: string }) => {
			const queuedAction = buildRovoAppQueuedPromptAction({
				contextDescription,
				creationMode,
				files,
				messageMetadata,
				mode,
				text,
				threadId,
			});
			enqueueQueuedAction(queuedAction);
		},
		[enqueueQueuedAction],
	);

	const submitPrompt = useCallback(
		async ({
			text,
			files,
			contextDescription,
			creationMode,
		}: SubmitRovoAppPromptInput) => {
			await submitRovoAppPromptDispatch({
				activeThreadId: activeThreadIdRef.current,
				creationMode,
				contextDescription,
				dispatchPromptNow,
				draftThreadId,
				enqueuePromptAction,
				files,
				getHasBusyTurn: () =>
					useChatStatus === "submitted" ||
					useChatStatus === "streaming" ||
					isRovoAppThreadBusy({
						activeRunStatus,
						attachedRunStatus,
						status: statusRef.current,
					}),
				immediateDispatch: immediateDispatchLifecycle,
				isPlanModeActive: isPlanModeRef.current,
				isQueueProcessorRunning: queueProcessorRunningRef.current,
				kickQueue,
				queuedActionsByThreadId,
				sendMode,
				setInputError,
				text,
			});
		},
		[
			activeRunStatus,
			activeThreadIdRef,
			attachedRunStatus,
			dispatchPromptNow,
			draftThreadId,
			enqueuePromptAction,
			immediateDispatchLifecycle,
			isPlanModeRef,
			kickQueue,
			queueProcessorRunningRef,
			queuedActionsByThreadId,
			sendMode,
			setInputError,
			statusRef,
			useChatStatus,
		],
	);

	const suggestedPrompt = useCallback(
		async (text: string) => {
			try {
				await submitPrompt({ text, files: [] });
			} catch {
				// submitPrompt already sets a user-visible error state.
			}
		},
		[submitPrompt],
	);

	return {
		dispatchPromptNow,
		submitPrompt,
		suggestedPrompt,
	};
}
