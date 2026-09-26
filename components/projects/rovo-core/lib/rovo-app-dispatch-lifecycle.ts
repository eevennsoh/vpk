import type { ChatStatus, FileUIPart } from "ai";
import {
	resolveRovoAppDelegationDispatch,
	type RovoAppDispatchQueueDecision,
	type RovoAppSendMode,
	resolveRovoAppPromptDispatch,
	buildRovoAppPromptModeMetadata,
} from "@/components/projects/rovo-core/lib/rovo-app-dispatch";
import type { RovoAppDelegationDispatchOptions } from "@/components/projects/rovo-core/lib/rovo-app-delegation-dispatcher";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";
import type {
	RovoAppActiveRun,
	RovoAppCreationMode,
	RovoAppDocument,
	RovoAppPromptMode,
	RovoAppQueuedAction,
	RovoAppRunStatus,
} from "@/lib/rovo-app-types";
import {
	getMessageText,
	type RovoMessageInterruptionSource,
	type RovoMessageMetadata,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import {
	buildRovoAppPromptSendBody,
	buildRovoAppStreamingArtifactSendPayload,
	createRovoAppPlanningSession,
	resolveActiveArtifactContext,
	type RovoAppPlanningSession,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";
import {
	isRovoAppSendSettledTimeoutError,
	waitForChatSendSettled,
} from "@/components/projects/rovo-core/lib/rovo-app-send-guard";
import { getLatestRovoAppAssistantMessageId } from "@/components/projects/rovo-core/lib/rovo-app-planning-session";

interface MutableRef<T> {
	current: T;
}

type SetState<T> = (value: T | ((previousValue: T) => T)) => void;
type QueuedActionMap = Readonly<Record<string, ReadonlyArray<unknown> | undefined>>;

type RovoAppResolvedDelegationDispatchOptions =
	RovoAppDelegationDispatchOptions & {
		prompt: string;
	};

export interface RovoAppImmediateDispatchLifecycle {
	begin: () => void;
	complete: () => void;
	interruptActiveTurn: () => Promise<void>;
}

export interface CreateRovoAppImmediateDispatchLifecycleInput {
	immediateDispatchInProgressRef: MutableRef<boolean>;
	interruptActiveTurnRef: MutableRef<(options?: {
		source: RovoMessageInterruptionSource;
	}) => Promise<void>>;
	queueProcessorRunningRef: MutableRef<boolean>;
}

interface ExecuteRovoAppDispatchDecisionInput {
	dispatchDecision: RovoAppDispatchQueueDecision;
	dispatchNow: () => Promise<void>;
	enqueueDispatch: () => void;
	immediateDispatch?: RovoAppImmediateDispatchLifecycle;
	kickQueue: () => void;
}

export type RovoAppDispatchLifecycleResult =
	| "dispatched"
	| "queued"
	| "skipped";

export function createRovoAppImmediateDispatchLifecycle({
	immediateDispatchInProgressRef,
	interruptActiveTurnRef,
	queueProcessorRunningRef,
}: CreateRovoAppImmediateDispatchLifecycleInput): RovoAppImmediateDispatchLifecycle {
	return {
		begin: () => {
			immediateDispatchInProgressRef.current = true;
			queueProcessorRunningRef.current = false;
		},
		complete: () => {
			immediateDispatchInProgressRef.current = false;
		},
		interruptActiveTurn: () =>
			interruptActiveTurnRef.current({ source: "user-stop" }),
	};
}

export interface RovoAppPromptDispatchLifecyclePayload {
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	files: FileUIPart[];
	messageMetadata?: RovoMessageMetadata;
	mode: RovoAppPromptMode;
	text: string;
}

export interface SubmitRovoAppPromptDispatchInput {
	activeThreadId: string | null;
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	dispatchPromptNow: (payload: RovoAppPromptDispatchLifecyclePayload) => Promise<void>;
	draftThreadId: string;
	enqueuePromptAction: (payload: RovoAppPromptDispatchLifecyclePayload & { threadId: string }) => void;
	files: FileUIPart[];
	getHasBusyTurn: () => boolean;
	immediateDispatch?: RovoAppImmediateDispatchLifecycle;
	isPlanModeActive: boolean;
	isQueueProcessorRunning: boolean;
	kickQueue: () => void;
	queuedActionsByThreadId: QueuedActionMap;
	sendMode?: RovoAppSendMode;
	setInputError: (message: string | null) => void;
	text: string;
}

export interface SubmitRovoAppDelegationDispatchInput {
	activeThreadId: string | null;
	dispatchDelegationNow: (
		messageId: string,
		options: RovoAppResolvedDelegationDispatchOptions,
	) => Promise<void>;
	draftThreadId: string;
	enqueueDelegationAction: (
		messageId: string,
		options: RovoAppResolvedDelegationDispatchOptions & { threadId: string },
	) => void;
	getHasBusyTurn: () => boolean;
	immediateDispatch?: RovoAppImmediateDispatchLifecycle;
	kickQueue: () => void;
	messageId: string;
	messages: ReadonlyArray<RovoUIMessage>;
	options?: RovoAppDelegationDispatchOptions;
	queuedActionsByThreadId: QueuedActionMap;
	queueProcessorRunningRef: MutableRef<boolean>;
	realtimeMessagesRef: MutableRef<RovoUIMessage[]>;
	sendMode?: RovoAppSendMode;
	setInputError: (message: string | null) => void;
}

export interface DispatchQueuedRovoAppActionImmediatelyInput {
	activeThreadId: string | null;
	dispatchQueuedActionNow: (action: RovoAppQueuedAction) => Promise<void>;
	draftThreadId: string;
	getHasBusyTurn: () => boolean;
	id: string;
	immediateDispatch: RovoAppImmediateDispatchLifecycle;
	kickQueue: () => void;
	prependQueuedAction: (action: RovoAppQueuedAction) => void;
	queuedActionsByThreadId: Readonly<Record<string, ReadonlyArray<RovoAppQueuedAction> | undefined>>;
	queueProcessorRunningRef: MutableRef<boolean>;
	removeQueuedAction: (threadId: string, actionId: string) => void;
	setInputError: (message: string | null) => void;
	toUserErrorMessage: (error: unknown) => string;
}

export interface DispatchRovoAppPromptNowInput extends RovoAppPromptDispatchLifecyclePayload {
	activeDocument: RovoAppDocument | null;
	activeDocumentContent: string;
	appendLocalUserMessage: (input: {
		files: ReadonlyArray<FileUIPart>;
		metadata: RovoMessageMetadata;
		text: string;
	}) => {
		message: RovoUIMessage;
		messageId: string;
	};
	artifactDraftContent: string;
	clearDirectDelegationState: () => void;
	clearStreamingArtifactState: () => void;
	delegationAbortControllerRef: MutableRef<AbortController | null>;
	ensureThread: (title: string) => Promise<string>;
	flushQueuedStreamingArtifactDeltaNow: () => void;
	lastUseChatBusyAtRef: MutableRef<number>;
	markLocalThreadRunPending: (threadId: string) => void;
	planModeSyncRequestIdRef: MutableRef<number>;
	releaseCompletedUseChatTurnIfNeeded: () => Promise<void>;
	resetPendingArtifactAssociation: () => void;
	rovoMessagesRef: MutableRef<RovoUIMessage[]>;
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
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	clearPlanExecutionTrackerDismissalsForThread: (threadId: string) => void;
	setInputError: (message: string | null) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	setPlanningSession: SetState<RovoAppPlanningSession | null>;
	setRovoMessages: SetState<RovoUIMessage[]>;
	stopUseChat: () => void | Promise<void>;
	streamingArtifact: RovoAppStreamingArtifact | null;
	streamingArtifactRef: MutableRef<RovoAppStreamingArtifact | null>;
	syncAgentModeForDispatch: (mode: RovoAppPromptMode) => void | Promise<void>;
	toUserErrorMessage: (error: unknown) => string;
	useChatStatus: ChatStatus;
	useChatStatusRef: MutableRef<ChatStatus>;
}

export async function executeRovoAppDispatchDecision({
	dispatchDecision,
	dispatchNow,
	enqueueDispatch,
	immediateDispatch,
	kickQueue,
}: ExecuteRovoAppDispatchDecisionInput): Promise<RovoAppDispatchLifecycleResult> {
	if (dispatchDecision.shouldQueue) {
		enqueueDispatch();
		kickQueue();
		return "queued";
	}

	if (dispatchDecision.shouldDispatchImmediately) {
		if (!immediateDispatch) {
			throw new Error("Immediate Rovo app dispatch requires an immediate dispatch lifecycle.");
		}

		immediateDispatch.begin();
		try {
			if (
				dispatchDecision.wasQueueProcessorRunning
				|| dispatchDecision.hasBusyTurn
			) {
				await immediateDispatch.interruptActiveTurn();
			}
			await dispatchNow();
		} finally {
			immediateDispatch.complete();
			kickQueue();
		}
		return "dispatched";
	}

	await dispatchNow();
	return "dispatched";
}

export async function submitRovoAppPromptDispatch({
	activeThreadId,
	contextDescription,
	creationMode,
	dispatchPromptNow,
	draftThreadId,
	enqueuePromptAction,
	files,
	getHasBusyTurn,
	immediateDispatch,
	isPlanModeActive,
	isQueueProcessorRunning,
	kickQueue,
	queuedActionsByThreadId,
	sendMode,
	setInputError,
	text,
}: SubmitRovoAppPromptDispatchInput): Promise<RovoAppDispatchLifecycleResult> {
	setInputError(null);
	const promptDispatch = resolveRovoAppPromptDispatch({
		activeThreadId,
		creationMode,
		draftThreadId,
		files,
		hasBusyTurn: getHasBusyTurn(),
		isPlanModeActive,
		isQueueProcessorRunning,
		queuedActionsByThreadId,
		sendMode,
		text,
	});

	if (!promptDispatch) {
		return "skipped";
	}

	const payload = {
		text: promptDispatch.text,
		files,
		contextDescription,
		creationMode,
		messageMetadata: promptDispatch.messageMetadata,
		mode: promptDispatch.mode,
	};

	return executeRovoAppDispatchDecision({
		dispatchDecision: promptDispatch.dispatchDecision,
		dispatchNow: () => dispatchPromptNow(payload),
		enqueueDispatch: () => {
			enqueuePromptAction({
				...payload,
				threadId: promptDispatch.resolvedThreadId,
			});
		},
		immediateDispatch,
		kickQueue,
	});
}

export async function dispatchRovoAppPromptNow({
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
}: DispatchRovoAppPromptNowInput): Promise<void> {
	setInputError(null);
	const trimmedText = text.trim();
	if (!trimmedText && files.length === 0) {
		return;
	}

	try {
		const currentStreamingArtifact = streamingArtifactRef.current;
		const isArtifactStreaming =
			currentStreamingArtifact?.status === "streaming" &&
			currentStreamingArtifact.documentId;
		let streamingArtifactPayload:
			| ReturnType<typeof buildRovoAppStreamingArtifactSendPayload>
			| undefined;

		if (isArtifactStreaming) {
			flushQueuedStreamingArtifactDeltaNow();
			const freshSnapshot = streamingArtifactRef.current;
			streamingArtifactPayload = buildRovoAppStreamingArtifactSendPayload({
				currentArtifact: currentStreamingArtifact,
				freshSnapshot,
			});
			clearStreamingArtifactState();
			const hadUseChatTurn =
				useChatStatus === "submitted" || useChatStatus === "streaming";
			if (hadUseChatTurn) {
				await stopUseChat();
			}
			delegationAbortControllerRef.current?.abort();
			delegationAbortControllerRef.current = null;
			clearDirectDelegationState();
		}

		await releaseCompletedUseChatTurnIfNeeded();
		await waitForChatSendSettled({
			statusRef: useChatStatusRef,
			lastBusyAtRef: lastUseChatBusyAtRef,
		});

		const resolvedArtifactContext = resolveActiveArtifactContext(
			activeDocument,
			artifactDraftContent,
			activeDocumentContent,
			streamingArtifact,
		);
		const threadId = await ensureThread(trimmedText || files[0]?.filename || "New chat");
	clearPlanExecutionTrackerDismissalsForThread(threadId);
		await syncAgentModeForDispatch(mode);
		const { message, messageId } = appendLocalUserMessage({
			files,
			metadata: buildRovoAppPromptModeMetadata(messageMetadata, mode, creationMode),
			text: trimmedText,
		});
		markLocalThreadRunPending(threadId);
		resetPendingArtifactAssociation();
		if (mode === "plan") {
			planModeSyncRequestIdRef.current += 1;
			setPlanningSession(createRovoAppPlanningSession({
				requestId: planModeSyncRequestIdRef.current,
				baselineAssistantMessageId:
					getLatestRovoAppAssistantMessageId(rovoMessagesRef.current),
			}));
		} else {
			setPlanningSession(null);
		}
		try {
			await sendMessage({
				text: trimmedText,
				files,
				messageId,
				metadata: message.metadata,
			}, {
				body: buildRovoAppPromptSendBody({
					artifactContext: resolvedArtifactContext,
					contextDescription,
					creationMode,
					isPlanMode: mode === "plan",
					streamingArtifact: streamingArtifactPayload,
					threadId,
				}),
			});
		} catch (sendError) {
			setRovoMessages((previousMessages) =>
				previousMessages.filter((messageItem) => messageItem.id !== messageId),
			);
			setLocalThreadActiveRun(threadId, null);
			setAttachedRunStatus(null);
			throw sendError;
		}
	} catch (error) {
		if (!isRovoAppSendSettledTimeoutError(error)) {
			setInputError(toUserErrorMessage(error));
		}
		throw error;
	}
}

export async function submitRovoAppDelegationDispatch({
	activeThreadId,
	dispatchDelegationNow,
	draftThreadId,
	enqueueDelegationAction,
	getHasBusyTurn,
	immediateDispatch,
	kickQueue,
	messageId,
	messages,
	options,
	queuedActionsByThreadId,
	queueProcessorRunningRef,
	realtimeMessagesRef,
	sendMode,
	setInputError,
}: SubmitRovoAppDelegationDispatchInput): Promise<RovoAppDispatchLifecycleResult> {
	if (!messageId) {
		return "skipped";
	}

	setInputError(null);
	const delegatedMessage =
		realtimeMessagesRef.current.find((message) => message.id === messageId)
		?? messages.find((message) => message.id === messageId)
		?? null;
	const delegationDispatch = resolveRovoAppDelegationDispatch({
		activeThreadId,
		delegatedMessageText: delegatedMessage ? getMessageText(delegatedMessage) : "",
		draftThreadId,
		hasBusyTurn: getHasBusyTurn(),
		isQueueProcessorRunning: queueProcessorRunningRef.current,
		messageId,
		optionPrompt: options?.prompt,
		queuedActionsByThreadId,
		sendMode,
	});

	if (!delegationDispatch) {
		return "skipped";
	}

	const dispatchOptions = {
		...options,
		prompt: delegationDispatch.text,
	};

	return executeRovoAppDispatchDecision({
		dispatchDecision: delegationDispatch.dispatchDecision,
		dispatchNow: () => dispatchDelegationNow(messageId, dispatchOptions),
		enqueueDispatch: () => {
			enqueueDelegationAction(messageId, {
				...dispatchOptions,
				threadId: delegationDispatch.resolvedThreadId,
			});
		},
		immediateDispatch,
		kickQueue,
	});
}

export async function dispatchQueuedRovoAppActionImmediately({
	activeThreadId,
	dispatchQueuedActionNow,
	draftThreadId,
	getHasBusyTurn,
	id,
	immediateDispatch,
	kickQueue,
	prependQueuedAction,
	queuedActionsByThreadId,
	queueProcessorRunningRef,
	removeQueuedAction,
	setInputError,
	toUserErrorMessage,
}: DispatchQueuedRovoAppActionImmediatelyInput): Promise<RovoAppDispatchLifecycleResult> {
	if (!id) {
		return "skipped";
	}

	const threadId = activeThreadId ?? draftThreadId;
	const queue = queuedActionsByThreadId[threadId] ?? [];
	const queuedAction = queue.find((action) => action.id === id);
	if (!queuedAction) {
		return "skipped";
	}

	setInputError(null);
	const wasQueueProcessorRunning = queueProcessorRunningRef.current;
	const hasBusyTurn = getHasBusyTurn();
	let dispatched = false;

	immediateDispatch.begin();
	removeQueuedAction(queuedAction.threadId, queuedAction.id);

	try {
		if (wasQueueProcessorRunning || hasBusyTurn) {
			await immediateDispatch.interruptActiveTurn();
		}
		await dispatchQueuedActionNow(queuedAction);
		dispatched = true;
		return "dispatched";
	} catch (error) {
		prependQueuedAction(queuedAction);
		setInputError(toUserErrorMessage(error));
		return "queued";
	} finally {
		immediateDispatch.complete();
		if (dispatched) {
			kickQueue();
		}
	}
}
