"use client";

import type { FileUIPart } from "ai";
import type { ChatStatus } from "ai";
import { useChat } from "@ai-sdk/react";
import {
	useRef,
	useState,
} from "react";
import { useLatestRef } from "@/lib/use-latest-ref";
import type { RovoAppQueueContextValue } from "@/components/projects/rovo-core/hooks/use-rovo-app-queue";
import type { RovoAppRouteAdapter } from "@/components/projects/rovo-core/lib/rovo-app-route-adapter";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";
import { useRovoAppChatTransport } from "@/components/projects/rovo-core/hooks/use-rovo-app-chat-transport";
import { useRovoAppStreamingArtifactDeltaBuffer } from "@/components/projects/rovo-core/hooks/use-rovo-app-streaming-artifact-delta-buffer";
import { useRovoAppPlanWidgetMetadataEnrichment } from "@/components/projects/rovo-core/hooks/use-rovo-app-plan-widget-metadata-enrichment";
import { useRovoAppPlanExecutionTracker } from "@/components/projects/rovo-core/hooks/use-rovo-app-plan-execution-tracker";
import { useRovoAppMessageState } from "@/components/projects/rovo-core/hooks/use-rovo-app-message-state";
import { useRovoAppRuntimeState } from "@/components/projects/rovo-core/hooks/use-rovo-app-runtime-state";
import { useRovoAppRealtimeMessageActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-realtime-message-actions";
import { useRovoAppTitleGeneration } from "@/components/projects/rovo-core/hooks/use-rovo-app-title-generation";
import { useRovoAppThreadPersistence } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-persistence";
import { useRovoAppBackgroundRefresh } from "@/components/projects/rovo-core/hooks/use-rovo-app-background-refresh";
import { useRovoAppSuggestedQuestions } from "@/components/projects/rovo-core/hooks/use-rovo-app-suggested-questions";
import { useRovoAppPlanRetry } from "@/components/projects/rovo-core/hooks/use-rovo-app-plan-retry";
import { useRovoAppRuntimeRefs } from "@/components/projects/rovo-core/hooks/use-rovo-app-runtime-refs";
import { useRovoAppCompletedRunHydration } from "@/components/projects/rovo-core/hooks/use-rovo-app-completed-run-hydration";
import { useRovoAppThreadLifecycleActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-lifecycle-actions";
import { useRovoAppThreadRefreshEffects } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-refresh-effects";
import { useRovoAppThreadNavigationEffects } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-navigation-effects";
import { useRovoAppActiveDocumentSync } from "@/components/projects/rovo-core/hooks/use-rovo-app-active-document-sync";
import { useRovoAppPromptActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-prompt-actions";
import { useRovoAppClarificationPlanActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-clarification-plan-actions";
import { useRovoAppDelegationQueueActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-delegation-queue-actions";
import { useRovoAppActiveTurnActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-active-turn-actions";
import { useRovoAppThreadMutationActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-thread-mutation-actions";
import { useRovoAppMessageEditActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-message-edit-actions";
import { useRovoAppPlanWidgetMetadataActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-plan-widget-metadata-actions";
import { useRovoAppTurnLifecycleState } from "@/components/projects/rovo-core/hooks/use-rovo-app-turn-lifecycle-state";
import { useRovoAppLocalRunActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-local-run-actions";
import { useRovoAppRealtimeStateActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-realtime-state-actions";
import { useRovoAppArtifactResetActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-artifact-reset-actions";
import { useRovoAppRouteReplacementActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-route-replacement-actions";
import { useRovoAppDispatchPrepActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-dispatch-prep-actions";
import { useRovoAppUserMessageActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-user-message-actions";
import { useRovoAppDataPartActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-data-part-actions";
import { useRovoAppRunSideEffectActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-run-side-effect-actions";
import { useRovoAppUseChatLifecycleActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-use-chat-lifecycle-actions";
import { useRovoAppModeStateActions } from "@/components/projects/rovo-core/hooks/use-rovo-app-mode-state-actions";
import { useRovoAppDerivedState } from "@/components/projects/rovo-core/hooks/use-rovo-app-derived-state";
import { useRovoAppDispatchRuntime } from "@/components/projects/rovo-core/hooks/use-rovo-app-dispatch-runtime";
import { useRovoAppArtifactPanelEffects } from "@/components/projects/rovo-core/hooks/use-rovo-app-artifact-panel-effects";
import {
	useRovoAppArtifactPanelActions,
	useRovoAppArtifactPanelController,
} from "@/components/projects/rovo-core/hooks/use-rovo-app-artifact-panel-controller";
import type { RovoAppPendingArtifactResult } from "@/components/projects/rovo-core/lib/rovo-app-message-artifacts";
import {
	type RovoAppSmartGenerationLayoutContext,
} from "@/components/projects/rovo-core/lib/rovo-app-smart-generation-layout";
import type { RovoAppRefreshThreadsOptions } from "@/components/projects/rovo-core/lib/rovo-app-thread-lifecycle";
import {
	createRovoAppThread,
	deleteRovoAppDocument,
	fetchRovoAppAITitle,
	fetchRovoAppSuggestedQuestions,
	getRovoAppBackendUnavailableUserMessage,
	getRovoAppDocument,
	isRovoAppBackendUnavailableError,
	listRovoAppBackgroundStreams,
	upsertRovoAppRealtimeMessage,
	listRovoAppThreads,
	saveRovoAppDocument,
	toRovoAppUserErrorMessage,
	updateRovoAppThread,
} from "@/components/projects/rovo-core/lib/api";
import {
	type ArtifactMode,
	type RovoAppDocument,
	type RovoAppQueuedAction,
	type RovoAppCreationMode,
	type RovoAppRunStatus,
	type RovoAppThread,
	type RovoAppVisibility,
	type RovoAppPanelState,
	type VoteValue,
	createRovoAppId,
} from "@/lib/rovo-app-types";
import type {
	ClarificationAnswers,
	ParsedQuestionCardPayload,
} from "@/components/projects/shared/lib/question-card-widget";
import {
	type ParsedPlanWidgetPayload,
} from "@/components/projects/shared/lib/plan-widget";
import {
	type PlanApprovalSelection,
} from "@/components/projects/shared/lib/plan-approval";
import {
	type RovoMessageInterruptionSource,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import type { RovoAppPlanExecutionTrackerViewModel } from "@/components/projects/shared/lib/rovo-app-plan-execution-tracker";
import {
	waitForRovoApp,
	type RovoAppClarificationSubmitOptions,
	type RovoAppSendMode,
	type RovoAppSendModeSetter,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";

export interface RovoAppHookOptions {
	embedded?: boolean;
	initialThreadId?: string | null;
	smartGenerationLayout?: RovoAppSmartGenerationLayoutContext;
}

export interface RovoAppCoreHookOptions extends RovoAppHookOptions {
	clarificationBehavior: {
		dismissUsesPlanMode: boolean;
		includeDeferredToolPlanMode: boolean;
		rollbackFailedSend: boolean;
	};
	queue: RovoAppQueueContextValue;
	routeAdapter: RovoAppRouteAdapter;
	sendMode: RovoAppSendMode;
	setSendMode: RovoAppSendModeSetter;
}

export interface RovoAppHookResult {
	activeDocument: RovoAppDocument | null;
	activeDocumentContent: string;
	activeThreadId: string | null;
	applyVoiceSteer: (payload: {
		text: string;
		contextDescription?: string;
	}) => Promise<void>;
	artifactMode: ArtifactMode;
	artifactDraftContent: string;
	backgroundStreamThreadIds: ReadonlySet<string>;
	deleteAllThreads: () => Promise<void>;
	deleteDocument: (documentId: string) => Promise<void>;
	deleteThread: (threadId: string) => Promise<void>;
	cancelThreadRun: (threadId: string) => Promise<boolean>;
	documents: RovoAppDocument[];
	editMessage: (messageId: string, nextText: string) => Promise<void>;
	editingMessageId: string | null;
	inputError: string | null;
	interruptActiveTurn: (options?: {
		source: RovoMessageInterruptionSource;
	}) => Promise<void>;
	isArtifactOpen: boolean;
	isGeneratingTitle: boolean;
	isLoadingThread: boolean;
	isStreaming: boolean;
	isPlanMode: boolean;
	isVoiceMode: boolean;
	loadThread: (threadId: string) => Promise<void>;
	messages: RovoUIMessage[];
	panelState: RovoAppPanelState;
	pendingPlanMetadataMessageIds: ReadonlySet<string>;
	setPanelState: (state: RovoAppPanelState) => void;
	pendingTitleThreadId: string | null;
	openDocument: (documentId: string) => Promise<void>;
	openPlanAsDocument: (plan: { title: string; markdown: string; sourceMessageId?: string | null }) => void;
	openArtifactFromMessage: (message: RovoUIMessage) => Promise<void>;
	openNewChat: () => Promise<void>;
	regenerateLatest: () => void;
	refreshThreads: (options?: RovoAppRefreshThreadsOptions) => Promise<void>;
	removeQueuedPrompt: (id: string) => void;
	sendMode: RovoAppSendMode;
	sendQueuedPromptNow: (id: string) => Promise<void>;
	runtimeThreadId: string;
	saveArtifactDraft: () => Promise<void>;
	selectedVersionId: string | null;
	setActiveDocumentId: (documentId: string | null) => void;
	setArtifactDraftContent: (value: string) => void;
	setArtifactMode: (mode: ArtifactMode) => void;
	setEditingMessageId: (messageId: string | null) => void;
	setSelectedVersionId: (versionId: string | null) => void;
	setSendMode: RovoAppSendModeSetter;
	setSidebarOpen: (isOpen: boolean) => void;
	setThreadVisibility: (visibility: RovoAppVisibility) => void;
	setVoiceMode: (next: boolean) => void;
	sidebarOpen: boolean;
	backgroundArtifactLabel: string | null;
	backgroundDelegationLabel: string | null;
	composerStatus: ChatStatus;
	hasBackgroundDelegation: boolean;
	planExecutionTracker: RovoAppPlanExecutionTrackerViewModel | null;
	status: ChatStatus;
	stop: () => Promise<void>;
	cancelClarificationQuestionSet: (questionCard: ParsedQuestionCardPayload, options?: RovoAppClarificationSubmitOptions) => Promise<boolean>;
	submitClarification: (questionCard: ParsedQuestionCardPayload, answers: ClarificationAnswers, options?: RovoAppClarificationSubmitOptions) => Promise<void>;
	submitClarificationDismiss: (questionCard: ParsedQuestionCardPayload, options?: RovoAppClarificationSubmitOptions) => Promise<void>;
	acceptPlanReview: (planWidget: ParsedPlanWidgetPayload) => Promise<void>;
	submitPlanApproval: (planWidget: ParsedPlanWidgetPayload, selection: PlanApprovalSelection) => Promise<void>;
	submitPrompt: (payload: {
		text: string;
		files: FileUIPart[];
		contextDescription?: string;
		creationMode?: RovoAppCreationMode;
	}) => Promise<void>;
	suggestedPrompt: (text: string) => Promise<void>;
	togglePlanMode: () => void;
	resetPlanMode: () => void;
	toggleVoiceMode: () => void;
	dismissPlanExecutionTracker: () => void;
	pendingArtifactResult: RovoAppPendingArtifactResult | null;
	queuedPrompts: ReadonlyArray<RovoAppQueuedAction>;
	shouldSuppressLatestAssistantSuggestions: boolean;
	shouldQueueNextSubmission: boolean;
	hideArtifactPane: () => void;
	streamingArtifact: RovoAppStreamingArtifact | null;
	streamingArtifactMessageId: string | null;
	visibleArtifactDocumentId: string | null;
	setVisibleArtifactDocumentId: (documentId: string | null) => void;
	threads: RovoAppThread[];
	threadsLoaded: boolean;
	threadVisibility: RovoAppVisibility;
	votes: Record<string, VoteValue>;
	voteOnMessage: (messageId: string, value: VoteValue | null) => Promise<void>;
	appendRealtimeMessage: (
		role: "user" | "assistant",
		content: string,
		options?: {
			createdAt?: string;
			messageId?: string;
			metadata?: RovoUIMessage["metadata"];
			parts?: RovoUIMessage["parts"];
			state?: "done" | "streaming";
		},
	) => Promise<string>;
	delegateToRovo: (
		messageId: string,
		options?: {
			contextDescription?: string;
			conversationSummary?: string;
			intentType?: string;
			prompt?: string;
			referencedFiles?: string[];
			urgency?: string;
		},
	) => Promise<void>;
	setRealtimeMessageContent: (messageId: string, content: string) => void;
	updateRealtimeMessage: (messageId: string, contentDelta: string) => void;
}

export function useRovoAppCore({
	clarificationBehavior,
	embedded = false,
	initialThreadId = null,
	queue,
	routeAdapter,
	sendMode,
	setSendMode,
	smartGenerationLayout,
}: Readonly<RovoAppCoreHookOptions>): RovoAppHookResult {
	const {
		buildThreadPath: buildRovoAppThreadPath,
		getThreadIdFromPath: getRovoAppThreadIdFromPath,
		rootPath: ROVO_APP_ROOT_PATH,
	} = routeAdapter;
	const includeDeferredToolPlanMode = clarificationBehavior.includeDeferredToolPlanMode;
	const shouldRollbackFailedClarificationSend = clarificationBehavior.rollbackFailedSend;
	const shouldUsePlanModeForClarificationDismiss = clarificationBehavior.dismissUsesPlanMode;
	const [draftThreadId, setDraftThreadId] = useState(() => initialThreadId ?? createRovoAppId());
	const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId);
	const [threads, setThreads] = useState<RovoAppThread[]>([]);
	const threadsRef = useLatestRef(threads);
	const [threadsLoaded, setThreadsLoaded] = useState(false);
	const [documents, setDocuments] = useState<RovoAppDocument[]>([]);
	const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
	const [threadVisibility, setThreadVisibility] = useState<RovoAppVisibility>("private");
	const [sidebarOpen, setSidebarOpen] = useState(() => !embedded);
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const [artifactMode, setArtifactMode] = useState<ArtifactMode>("preview");
	const [artifactDraftContent, setArtifactDraftContent] = useState("");
	const [visibleArtifactDocumentId, setVisibleArtifactDocumentId] = useState<string | null>(null);
	const [panelState, setPanelState] = useState<RovoAppPanelState>("closed");
	const [pendingArtifactResult, setPendingArtifactResult] =
		useState<RovoAppPendingArtifactResult | null>(null);
	const [streamingArtifact, setStreamingArtifact] = useState<RovoAppStreamingArtifact | null>(null);
	const [votes, setVotes] = useState<Record<string, VoteValue>>({});
	const [inputError, setInputError] = useState<string | null>(null);
	const [isLoadingThread, setIsLoadingThread] = useState(() => initialThreadId !== null);
	const [hasActiveDispatch, setHasActiveDispatch] = useState(false);
	const {
		immediateDispatchInProgressRef,
		immediateDispatchLifecycle,
		interruptActiveTurnRef,
		kickQueue,
		processQueueRef,
		queueProcessorRunningRef,
	} = useRovoAppDispatchRuntime();
	const [realtimeMessages, setRealtimeMessages] = useState<RovoUIMessage[]>([]);
	const {
		backgroundDelegationMessageId,
		clearDirectDelegationState,
		delegationTurnStatus,
		directDelegationPhase,
		isPlanMode,
		isPlanModeRef,
		isVoiceMode,
		isVoiceModeRef,
		planModeSyncRequestIdRef,
		planningSession,
		resetPlanMode,
		setBackgroundDelegationMessageId,
		setDelegationTurnStatus,
		setDirectDelegationPhase,
		setPlanningSession,
		setVoiceMode,
		togglePlanMode,
		toggleVoiceMode,
	} = useRovoAppModeStateActions();
	const [attachedRunStatus, setAttachedRunStatus] = useState<RovoAppRunStatus | null>(null);
	const attachedRunStatusRef = useRef<RovoAppRunStatus | null>(null);
	const {
		clearQueuedActionsForThread,
		enqueueQueuedAction,
		peekNextQueuedActionForThread,
		prependQueuedAction,
		queuedActionsByThreadId,
		removeQueuedAction,
		shiftNextQueuedActionForThread,
	} = queue;
	const {
		beginThreadHydration,
		completeThreadHydration,
		hasObservedTurnComplete,
		hasObservedTurnCompleteRef,
		isHydratingThreadRef,
		markObservedTurnComplete,
		resetObservedTurnComplete,
		threadHydrationVersion,
	} = useRovoAppTurnLifecycleState();
	const {
		activeDocument,
		activeDocumentContent,
		backgroundStreamThreadIds,
		currentThread,
		queuedPrompts,
		reconcileThreadWithLocalTitle,
		runtimeThreadId,
		smartGenerationRequest,
	} = useRovoAppDerivedState({
		activeDocumentId,
		activeThreadId,
		documents,
		draftThreadId,
		embedded,
		queuedActionsByThreadId,
		smartGenerationLayout,
		threads,
		threadsRef,
	});
	const lastPersistedKeyRef = useRef<string>("");
	const attemptedPlanMetadataMessageIdsRef = useRef<Set<string>>(new Set());
	const activeThreadIdRef = useRef<string | null>(initialThreadId);
	const activeDocumentRef = useLatestRef(activeDocument);
	const streamingArtifactRef = useLatestRef(streamingArtifact);
	const {
		clearQueuedStreamingArtifactDelta,
		flushQueuedStreamingArtifactDeltaNow,
		queueStreamingArtifactDelta,
	} = useRovoAppStreamingArtifactDeltaBuffer({ setStreamingArtifact });
	const visibleArtifactDocumentIdRef = useLatestRef(visibleArtifactDocumentId);
	const pendingArtifactCreationRetryRef = useRef(false);
	const currentTurnIntentRef = useRef<string | null>(null);
	const rovoMessagesRef = useRef<RovoUIMessage[]>([]);
	const realtimeMessagesRef = useRef<RovoUIMessage[]>([]);
	const realtimeMessagesVersionRef = useRef(0);
	const statusRef = useRef<ChatStatus>("ready");
	const useChatStatusRef = useRef<ChatStatus>("ready");
	const lastUseChatBusyAtRef = useRef(0);
	const delegationAbortControllerRef = useRef<AbortController | null>(null);
	const runSubscriptionAbortControllerRef = useRef<AbortController | null>(null);
	const runSubscriptionThreadIdRef = useRef<string | null>(null);
	const interruptPromiseRef = useRef<Promise<void> | null>(null);
	const lastExplicitCancelAtRef = useRef(0);
	const hasHydratedActiveThreadRef = useRef(false);
	const lastLoadedInitialThreadIdRef = useRef<string | null>(null);
	const pendingRouteThreadIdRef = useRef<string | null>(null);
	const pendingRouteReadyRef = useRef(false);
	const pendingThreadCreationRef = useRef<Promise<string> | null>(null);
	const deletedThreadIdsRef = useRef<Set<string>>(new Set());
	const requestedSuggestionMessageIdsRef = useRef<Set<string>>(new Set());
	const suggestionsAbortControllerRef = useRef<AbortController | null>(null);
	const {
		removeQueuedPrompt,
		syncAgentModeForDispatch,
	} = useRovoAppDispatchPrepActions({
		activeThreadId,
		removeQueuedAction,
		runtimeThreadId,
	});

	const {
		markLocalThreadRunPending,
		setLocalThreadActiveRun,
	} = useRovoAppLocalRunActions({
		resetObservedTurnComplete,
		setAttachedRunStatus,
		setThreads,
	});

	const {
		mutateRealtimeMessagesState,
		replaceRealtimeMessagesState,
	} = useRovoAppRealtimeStateActions({
		realtimeMessagesRef,
		realtimeMessagesVersionRef,
		setRealtimeMessages,
	});

	const transport = useRovoAppChatTransport({
		activeDocument,
		activeDocumentContent,
		activeDocumentId,
		artifactDraftContent,
		isPlanModeRef,
		isVoiceModeRef,
		pendingArtifactCreationRetryRef,
		routeAdapter,
		runtimeThreadId,
		smartGenerationRequest,
		streamingArtifact,
		threadVisibility,
	});

	const {
		clearStreamingArtifactState,
		lastCompletedArtifactDocumentIdRef,
		pendingArtifactAssociationRef,
		resetPendingArtifactAssociation,
		setStreamingArtifactMessageId,
		streamingArtifactMessageId,
		streamingArtifactMessageIdRef,
		suppressedStreamingAutoOpenDocumentIdRef,
	} = useRovoAppArtifactResetActions({
		clearQueuedStreamingArtifactDelta,
		setPendingArtifactResult,
		setStreamingArtifact,
	});

	const {
		clearArtifactState,
		hideArtifactPane,
		hydratePersistedArtifact,
		persistActiveDocumentSelection,
		saveStreamingArtifactCheckpoint,
		selectDocumentForDisplay,
	} = useRovoAppArtifactPanelController({
		activeThreadIdRef,
		deletedThreadIdsRef,
		getBackendUnavailableMessage: getRovoAppBackendUnavailableUserMessage,
		getDocument: getRovoAppDocument,
		isBackendUnavailableError: isRovoAppBackendUnavailableError,
		isHydratingThreadRef,
		reconcileThreadWithLocalTitle,
		saveDocument: saveRovoAppDocument,
		setActiveDocumentId,
		setArtifactDraftContent,
		setArtifactMode,
		setDocuments,
		setInputError,
		setPanelState,
		setSelectedVersionId,
		setThreads,
		setVisibleArtifactDocumentId,
		streamingArtifactRef,
		suppressedStreamingAutoOpenDocumentIdRef,
		toUserErrorMessage: toRovoAppUserErrorMessage,
		updateThread: updateRovoAppThread,
		visibleArtifactDocumentId,
		waitForRetry: waitForRovoApp,
	});

	const { handleRovoAppDataPart } = useRovoAppDataPartActions({
		activeThreadIdRef,
		clearQueuedStreamingArtifactDelta,
		currentTurnIntentRef,
		flushQueuedStreamingArtifactDeltaNow,
		hydratePersistedArtifact,
		kickQueue,
		lastCompletedArtifactDocumentIdRef,
		markObservedTurnComplete,
		pendingArtifactAssociationRef,
		pendingArtifactCreationRetryRef,
		persistActiveDocumentSelection,
		queueStreamingArtifactDelta,
		setActiveDocumentId,
		setArtifactMode,
		setAttachedRunStatus,
		setLocalThreadActiveRun,
		setPendingArtifactResult,
		setSelectedVersionId,
		setStreamingArtifact,
		streamingArtifactRef,
		suppressedStreamingAutoOpenDocumentIdRef,
		visibleArtifactDocumentIdRef,
	});
	const {
		completeUseChatTurn,
		handleUseChatError,
	} = useRovoAppUseChatLifecycleActions({
		activeDocumentRef,
		activeThreadIdRef,
		clearArtifactState,
		clearStreamingArtifactState,
		currentTurnIntentRef,
		kickQueue,
		pendingArtifactCreationRetryRef,
		resetPendingArtifactAssociation,
		setAttachedRunStatus,
		setInputError,
		setLocalThreadActiveRun,
		streamingArtifactRef,
		toUserErrorMessage: toRovoAppUserErrorMessage,
	});

	const {
		messages: rovoMessages,
		setMessages: setRovoMessages,
		sendMessage,
		stop: stopUseChat,
		regenerate,
		status: useChatStatus,
	} = useChat<RovoUIMessage>({
		transport,
		onData: handleRovoAppDataPart,
		onError: handleUseChatError,
		onFinish: completeUseChatTurn,
	});

	const {
		handleAttachedRunChunk,
		releaseCompletedUseChatTurnIfNeeded,
	} = useRovoAppRunSideEffectActions({
		activeThreadIdRef,
		attachedRunStatus,
		handleRovoAppDataPart,
		hasObservedTurnCompleteRef,
		runSubscriptionThreadIdRef,
		setAttachedRunStatus,
		setLocalThreadActiveRun,
		setThreads,
		statusRef,
		stopUseChat,
		useChatStatus,
	});

	const {
		latestSourcedPlanWidget,
		latestThinkingStatusLabel,
		messages,
		normalizedRovoMessages,
	} = useRovoAppMessageState({
		backgroundDelegationMessageId,
		realtimeMessages,
		rovoMessages,
		rovoMessagesRef,
	});
	const {
		clearPendingTitleGeneration,
		isGeneratingTitle,
		pendingTitleMessageRef,
		pendingTitleThreadId,
		pendingTitleThreadIdRef,
		setIsGeneratingTitle,
		setPendingTitleThreadId,
	} = useRovoAppTitleGeneration({
		deletedThreadIdsRef,
		fetchTitle: fetchRovoAppAITitle,
		messages,
		setThreads,
		threadsRef,
		updateThread: updateRovoAppThread,
	});
	const {
		clearPendingPlanMetadataGeneration,
		pendingPlanMetadataMessageIds,
		persistPlanWidgetMetadata,
		setPlanMetadataPendingState,
	} = useRovoAppPlanWidgetMetadataActions({
		activeThreadIdRef,
		beginThreadHydration,
		completeThreadHydration,
		deletedThreadIdsRef,
		lastPersistedKeyRef,
		reconcileThreadWithLocalTitle,
		setMessages: setRovoMessages,
		setThreads,
		threadsRef,
		updateThread: updateRovoAppThread,
	});

	const {
		clearPlanExecutionTrackerDismissalsForThread,
		dismissPlanExecutionTracker,
		planExecutionTracker,
	} = useRovoAppPlanExecutionTracker({
		activeRun: currentThread?.activeRun ?? null,
		activeThreadId,
		messages,
		threadUpdatedAt: currentThread?.updatedAt ?? null,
	});
	const activeRunStatus = currentThread?.activeRun?.status ?? null;
	const isAttachedActiveRun =
		activeThreadId !== null && runSubscriptionThreadIdRef.current === activeThreadId;
	const {
		composerState,
		isStreaming,
		shouldQueueNextSubmission,
		shouldSuppressLatestAssistantSuggestions,
		status,
	} = useRovoAppRuntimeState({
		activeRunStatus,
		attachedRunStatus,
		delegationTurnStatus,
		directDelegationPhase,
		hasActiveDispatch,
		hasObservedTurnComplete,
		isAttachedActiveRun,
		latestThinkingStatusLabel,
		queuedPromptCount: queuedPrompts.length,
		streamingArtifactStatus: streamingArtifact?.status ?? null,
		useChatStatus,
	});
	useRovoAppRuntimeRefs({
		activeThreadId,
		activeThreadIdRef,
		attachedRunStatus,
		attachedRunStatusRef,
		lastUseChatBusyAtRef,
		realtimeMessages,
		realtimeMessagesRef,
		runSubscriptionAbortControllerRef,
		status,
		statusRef,
		streamingArtifactMessageId,
		streamingArtifactMessageIdRef,
		useChatStatus,
		useChatStatusRef,
	});
	const { appendLocalUserMessage } = useRovoAppUserMessageActions({
		setMessages: setRovoMessages,
	});
	const {
		flushPendingRouteReplacement,
		replaceRovoAppRoute,
	} = useRovoAppRouteReplacementActions({
		activeThreadIdRef,
		buildThreadPath: buildRovoAppThreadPath,
		embedded,
		isStreaming,
		isVoiceMode,
		pendingRouteReadyRef,
		pendingRouteThreadIdRef,
	});
	// ── Plan-mode planning session monitor ──
	// Tracks the full plan-mode lifecycle: initial prompt → stream →
	// plan detection → retry.  Modeled after Make's planningSession effect.
	useRovoAppPlanRetry({
		activeThreadIdRef,
		appendLocalUserMessage,
		isStreaming,
		lastUseChatBusyAtRef,
		messages: normalizedRovoMessages,
		planningSession,
		releaseCompletedUseChatTurnIfNeeded,
		rovoMessagesRef,
		sendMessage,
		setPlanningSession,
		syncAgentModeForDispatch,
		threads,
		useChatStatusRef,
	});

	useRovoAppPlanWidgetMetadataEnrichment({
		activeThreadId,
		attemptedPlanMetadataMessageIdsRef,
		clearPendingPlanMetadataGeneration,
		hydrationVersion: threadHydrationVersion,
		isHydratingThreadRef,
		isLoadingThread,
		isStreaming,
		latestSourcedPlanWidget,
		persistPlanWidgetMetadata,
		rovoMessagesRef,
		setPlanMetadataPendingState,
	});

	useRovoAppSuggestedQuestions({
		activeThreadIdRef,
		fetchSuggestedQuestions: fetchRovoAppSuggestedQuestions,
		isBackendUnavailableError: isRovoAppBackendUnavailableError,
		isStreaming,
		messages: normalizedRovoMessages,
		requestedSuggestionMessageIdsRef,
		setRovoMessages,
		shouldSuppressLatestAssistantSuggestions,
		suggestionsAbortControllerRef,
	});

	useRovoAppArtifactPanelEffects({
		documents,
		isHydratingThreadRef,
		isStreaming,
		lastCompletedArtifactDocumentIdRef,
		normalizedRovoMessages,
		panelState,
		pendingArtifactAssociationRef,
		saveDocument: saveRovoAppDocument,
		setDocuments,
		setPanelState,
		setPendingArtifactResult,
		setStreamingArtifactMessageId,
		setVisibleArtifactDocumentId,
		streamingArtifact,
		streamingArtifactMessageId,
		streamingArtifactMessageIdRef,
		streamingArtifactRef,
		suppressedStreamingAutoOpenDocumentIdRef,
		visibleArtifactDocumentId,
	});

	const {
		activateBlankChatState,
		ensureThread,
		hydrateThreadById,
		loadThread,
		openNewChat,
		refreshThreads,
	} = useRovoAppThreadLifecycleActions({
		activeDocumentId,
		activeThreadIdRef,
		attachedRunStatus,
		beginThreadHydration,
		clearArtifactState,
		clearDirectDelegationState,
		clearPendingPlanMetadataGeneration,
		clearStreamingArtifactState,
		completeThreadHydration,
		currentActiveRun: currentThread?.activeRun,
		delegationAbortControllerRef,
		deletedThreadIdsRef,
		draftThreadId,
		embedded,
		handleAttachedRunChunk,
		hasHydratedActiveThreadRef,
		lastPersistedKeyRef,
		pendingRouteReadyRef,
		pendingRouteThreadIdRef,
		pendingThreadCreationRef,
		pendingTitleMessageRef,
		pendingTitleThreadIdRef,
		queueProcessorRunningRef,
		realtimeMessagesRef,
		reconcileThreadWithLocalTitle,
		replaceRealtimeMessagesState,
		replaceRoute: replaceRovoAppRoute,
		resetObservedTurnComplete,
		resetPendingArtifactAssociation,
		rootPath: ROVO_APP_ROOT_PATH,
		rovoMessagesRef,
		runSubscriptionAbortControllerRef,
		runSubscriptionThreadIdRef,
		setActiveDocumentId,
		setActiveThreadId,
		setAttachedRunStatus,
		setDocuments,
		setDraftThreadId,
		setEditingMessageId,
		setHasActiveDispatch,
		setInputError,
		setIsGeneratingTitle,
		setIsLoadingThread,
		setLocalThreadActiveRun,
		setPanelState,
		setPendingTitleThreadId,
		setRovoMessages,
		setSelectedVersionId,
		setThreadVisibility,
		setThreads,
		setThreadsLoaded,
		setVisibleArtifactDocumentId,
		setVotes,
		statusRef,
		stopUseChat,
		threadVisibility,
	});

	useRovoAppCompletedRunHydration({
		activeThreadId,
		attachedRunStatus,
		currentActiveRun: currentThread?.activeRun,
		hydrateThreadById,
		messages,
		setLocalThreadActiveRun,
		useChatStatus,
	});

	useRovoAppThreadRefreshEffects({
		initialThreadId,
		lastLoadedInitialThreadIdRef,
		loadThread,
		refreshThreads,
	});

	useRovoAppActiveDocumentSync({
		activeDocument,
		activeDocumentContent,
		setArtifactDraftContent,
		setSelectedVersionId,
	});

	const {
		dispatchPromptNow,
		submitPrompt,
		suggestedPrompt,
	} = useRovoAppPromptActions({
		activeDocument,
		activeDocumentContent,
		activeRunStatus: currentThread?.activeRun?.status ?? null,
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
		toUserErrorMessage: toRovoAppUserErrorMessage,
		useChatStatus,
		useChatStatusRef,
	});

	const {
		cancelClarificationQuestionSet,
		submitClarification,
		submitClarificationDismiss,
		acceptPlanReview,
		submitPlanApproval,
	} = useRovoAppClarificationPlanActions({
		appendLocalUserMessage,
		clearPlanExecutionTrackerDismissalsForThread,
		ensureThread,
		hasObservedTurnCompleteRef,
		includeDeferredToolPlanMode,
		isPlanModeRef,
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
		shouldRollbackFailedClarificationSend,
		shouldUsePlanModeForClarificationDismiss,
		syncAgentModeForDispatch,
		toUserErrorMessage: toRovoAppUserErrorMessage,
		useChatStatusRef,
	});

	const {
		appendRealtimeMessage,
		setRealtimeMessageContent,
		updateRealtimeMessage,
	} = useRovoAppRealtimeMessageActions({
		activeThreadIdRef,
		ensureThread,
		mutateRealtimeMessagesState,
		persistRealtimeMessage: upsertRovoAppRealtimeMessage,
		setThreads,
	});

	const {
		delegateToRovo,
		sendQueuedPromptNow,
	} = useRovoAppDelegationQueueActions({
		activeDocument,
		activeDocumentContent,
		activeRun: currentThread?.activeRun ?? null,
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
		toUserErrorMessage: toRovoAppUserErrorMessage,
		useChatStatus,
	});



	const {
		applyVoiceSteer,
		cancelThreadRun,
		interruptActiveTurn,
		stop,
	} = useRovoAppActiveTurnActions({
		activeRun: currentThread?.activeRun,
		activeThreadIdRef,
		appendLocalUserMessage,
		attachedRunStatus,
		clearDirectDelegationState,
		delegationAbortControllerRef,
		ensureThread,
		interruptActiveTurnRef,
		interruptPromiseRef,
		lastExplicitCancelAtRef,
		markLocalThreadRunPending,
		mutateRealtimeMessagesState,
		queueProcessorRunningRef,
		refreshThreads,
		releaseCompletedUseChatTurnIfNeeded,
		resetPendingArtifactAssociation,
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
		toUserErrorMessage: toRovoAppUserErrorMessage,
		useChatStatus,
	});

	const {
		deleteAllThreads,
		deleteThread,
		voteOnMessage,
	} = useRovoAppThreadMutationActions({
		activeThreadId,
		activeThreadIdRef,
		clearPendingTitleGeneration,
		clearQueuedActionsForThread,
		deletedThreadIdsRef,
		openNewChat,
		refreshThreads,
		runSubscriptionAbortControllerRef,
		runSubscriptionThreadIdRef,
		setAttachedRunStatus,
		setInputError,
		setThreads,
		setVotes,
		threadsRef,
		toUserErrorMessage: toRovoAppUserErrorMessage,
	});

	const {
		deleteDocument,
		openArtifactFromMessage,
		openDocument,
		openPlanAsDocument,
		saveArtifactDraft,
	} = useRovoAppArtifactPanelActions({
		activeDocument,
		activeDocumentId,
		activeThreadId,
		artifactDraftContent,
		clearArtifactState,
		deleteDocumentApi: deleteRovoAppDocument,
		documents,
		ensureThread,
		hydratePersistedArtifact,
		saveDocument: saveRovoAppDocument,
		selectDocumentForDisplay,
		setActiveDocumentId,
		setArtifactMode,
		setDocuments,
		setInputError,
		setPanelState,
		setSelectedVersionId,
		setVisibleArtifactDocumentId,
		toUserErrorMessage: toRovoAppUserErrorMessage,
	});

	const {
		editMessage,
		regenerateLatest,
	} = useRovoAppMessageEditActions({
		beginThreadHydration,
		completeThreadHydration,
		normalizedMessages: normalizedRovoMessages,
		regenerate,
		resetObservedTurnComplete,
		resetPendingArtifactAssociation,
		setEditingMessageId,
		setMessages: setRovoMessages,
	});

	useRovoAppThreadPersistence({
		activeDocumentId,
		activeThreadId,
		activeThreadIdRef,
		beginThreadHydration,
		completeThreadHydration,
		createThread: createRovoAppThread,
		deletedThreadIdsRef,
		embedded,
		flushPendingRouteReplacement,
		isGeneratingTitle,
		isHydratingThreadRef,
		isLoadingThread,
		isStreaming,
		lastPersistedKeyRef,
		messages,
		normalizedMessages: normalizedRovoMessages,
		pendingRouteReadyRef,
		pendingRouteThreadIdRef,
		pendingTitleThreadId,
		realtimeMessages,
		realtimeMessagesRef,
		realtimeMessagesVersionRef,
		reconcileThreadWithLocalTitle,
		replaceRealtimeMessagesState,
		setInputError,
		setMessages: setRovoMessages,
		setThreads,
		threadVisibility,
		threads,
		toUserErrorMessage: toRovoAppUserErrorMessage,
		updateThread: updateRovoAppThread,
	});

	useRovoAppThreadNavigationEffects({
		activeThreadId,
		activeThreadIdRef,
		activateBlankChatState,
		embedded,
		flushPendingRouteReplacement,
		getThreadIdFromPath: getRovoAppThreadIdFromPath,
		hasHydratedActiveThreadRef,
		loadThread,
		rootPath: ROVO_APP_ROOT_PATH,
	});

	useRovoAppBackgroundRefresh({
		activeThreadId,
		activeThreadIdRef,
		deletedThreadIdsRef,
		hydrateThreadById,
		listBackgroundStreams: listRovoAppBackgroundStreams,
		listThreads: listRovoAppThreads,
		reconcileThread: reconcileThreadWithLocalTitle,
		setThreads,
		statusRef,
		threads,
	});

	return {
		activeDocument,
		activeDocumentContent,
		activeThreadId,
		applyVoiceSteer,
		artifactMode,
		artifactDraftContent,
		backgroundArtifactLabel: composerState.backgroundArtifactLabel,
		backgroundDelegationLabel: composerState.backgroundDelegationLabel,
		backgroundStreamThreadIds,
		composerStatus: composerState.composerStatus,
		deleteAllThreads,
		deleteDocument,
		deleteThread,
		cancelThreadRun,
		documents,
		editMessage,
		editingMessageId,
		hideArtifactPane,
		hasBackgroundDelegation: composerState.hasBackgroundDelegation,
		inputError,
		interruptActiveTurn,
		isArtifactOpen: panelState !== "closed",
		isGeneratingTitle,
		isLoadingThread,
		isPlanMode,
		isStreaming,
		isVoiceMode,
		loadThread,
		messages,
		pendingPlanMetadataMessageIds,
		pendingTitleThreadId,
		openDocument,
		openPlanAsDocument,
		openArtifactFromMessage,
		openNewChat,
		panelState,
		setPanelState,
		queuedPrompts,
		regenerateLatest,
		refreshThreads,
		removeQueuedPrompt,
		sendMode,
		sendQueuedPromptNow,
		runtimeThreadId,
		saveArtifactDraft,
		selectedVersionId,
		planExecutionTracker,
		setActiveDocumentId,
		setArtifactDraftContent,
		setArtifactMode,
		setEditingMessageId,
		setSelectedVersionId,
		setSendMode,
		setSidebarOpen,
		setThreadVisibility,
		setVoiceMode,
		shouldSuppressLatestAssistantSuggestions,
		shouldQueueNextSubmission,
		sidebarOpen,
		status,
		stop,
		cancelClarificationQuestionSet,
		submitClarification,
		submitClarificationDismiss,
		acceptPlanReview,
		submitPlanApproval,
		dismissPlanExecutionTracker,
		submitPrompt,
		suggestedPrompt,
		togglePlanMode,
		toggleVoiceMode,
		resetPlanMode,
		pendingArtifactResult,
		streamingArtifact,
		streamingArtifactMessageId,
		visibleArtifactDocumentId,
		setVisibleArtifactDocumentId,
		threads,
		threadsLoaded,
		threadVisibility,
		votes,
		voteOnMessage,
		appendRealtimeMessage,
		delegateToRovo,
		setRealtimeMessageContent,
		updateRealtimeMessage,
	};
}
