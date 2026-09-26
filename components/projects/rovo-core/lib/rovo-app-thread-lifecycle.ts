import type { ChatStatus } from "ai";
import type {
	RovoAppActiveRun,
	RovoAppDocument,
	RovoAppRunStatus,
	RovoAppThread,
	RovoAppVisibility,
	RovoAppVote,
} from "@/lib/rovo-app-types";
import {
	hasTurnCompleteSignal,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import { buildRovoAppActiveThreadTransitionPlan } from "@/components/projects/rovo-core/lib/rovo-app-active-thread-transition";
import {
	filterDeletedRovoAppThreads,
	upsertRovoAppThreadRecord,
} from "@/components/projects/rovo-core/lib/rovo-app-thread-state";
import {
	buildRovoAppThreadPersistKey,
	shouldSkipRovoAppThreadLoad,
} from "@/components/projects/rovo-core/lib/rovo-app-thread-route-sync";
import {
	buildVotesMap,
	deriveThreadTitle,
	getRovoAppArtifactDocumentIdsFromMessages,
	upsertDocumentRecord,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";

export {
	subscribeToRovoAppRunWithLifecycle,
} from "@/components/projects/rovo-core/lib/rovo-app-run-subscription-lifecycle";
export type {
	SubscribeToRovoAppRunLifecycleInput,
} from "@/components/projects/rovo-core/lib/rovo-app-run-subscription-lifecycle";

interface MutableRef<T> {
	current: T;
}

type SetState<T> = (value: T | ((previousValue: T) => T)) => void;
type SetThreads = SetState<RovoAppThread[]>;

export type RovoAppThreadNavigationIdentity = number;

interface RovoAppThreadNavigationCurrentness {
	isNavigationCurrent: (navigationIdentity: RovoAppThreadNavigationIdentity) => boolean;
	navigationIdentity: RovoAppThreadNavigationIdentity;
}

export interface RovoAppRefreshThreadsOptions {
	reportBackendUnavailable?: boolean;
}

export interface RefreshRovoAppThreadsLifecycleInput {
	deletedThreadIdsRef: MutableRef<Set<string>>;
	getBackendUnavailableUserMessage: () => string;
	isBackendUnavailableError: (error: unknown) => boolean;
	listThreads: () => Promise<RovoAppThread[]>;
	options?: RovoAppRefreshThreadsOptions;
	reconcileThreadWithLocalTitle: (thread: RovoAppThread) => RovoAppThread;
	setInputError: SetState<string | null>;
	setThreads: SetThreads;
	setThreadsLoaded: (loaded: boolean) => void;
	warn?: (message: string, error: unknown) => void;
}

export interface HydrateRovoAppThreadStateInput {
	activeThreadIdRef: MutableRef<string | null>;
	beginThreadHydration: () => void;
	clearDirectDelegationState: () => void;
	clearPendingPlanMetadataGeneration: () => void;
	clearStreamingArtifactState: () => void;
	completeThreadHydration: () => void;
	hasHydratedActiveThreadRef: MutableRef<boolean>;
	isNavigationCurrent: RovoAppThreadNavigationCurrentness["isNavigationCurrent"];
	lastPersistedKeyRef: MutableRef<string | null>;
	navigationIdentity: RovoAppThreadNavigationIdentity;
	nextDocuments: RovoAppDocument[];
	nextVotes: RovoAppVote[];
	pendingRouteReadyRef: MutableRef<boolean>;
	pendingRouteThreadIdRef: MutableRef<string | null>;
	pendingThreadCreationRef: MutableRef<Promise<string> | null>;
	queueProcessorRunningRef: MutableRef<boolean>;
	replaceRealtimeMessagesState: (
		messages: RovoUIMessage[],
		options?: { incrementVersion?: boolean },
	) => unknown;
	resetObservedTurnComplete: () => void;
	resetPendingArtifactAssociation: () => void;
	scheduleComplete?: (callback: () => void) => void;
	setActiveDocumentId: (documentId: string | null) => void;
	setActiveThreadId: (threadId: string | null) => void;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setDocuments: SetState<RovoAppDocument[]>;
	setHasActiveDispatch: (hasActiveDispatch: boolean) => void;
	setPanelState: (panelState: "preview" | "closed") => void;
	setRovoMessages: SetState<RovoUIMessage[]>;
	setSelectedVersionId: (versionId: string | null) => void;
	setThreadVisibility: (visibility: RovoAppVisibility) => void;
	setVisibleArtifactDocumentId: (documentId: string | null) => void;
	setVotes: SetState<Record<string, "up" | "down">>;
	thread: RovoAppThread;
}

export interface HydrateRovoAppThreadByIdInput {
	deletedThreadIdsRef: MutableRef<Set<string>>;
	getThread: (threadId: string) => Promise<RovoAppThread | null>;
	hydrateThreadState: (
		thread: RovoAppThread,
		nextDocuments: RovoAppDocument[],
		nextVotes: RovoAppVote[],
		navigationIdentity: RovoAppThreadNavigationIdentity,
	) => void;
	isNavigationCurrent: RovoAppThreadNavigationCurrentness["isNavigationCurrent"];
	listDocuments: (threadId: string) => Promise<RovoAppDocument[]>;
	listVotes: (threadId: string) => Promise<RovoAppVote[]>;
	navigationIdentity: RovoAppThreadNavigationIdentity;
	reconcileThreadWithLocalTitle: (thread: RovoAppThread) => RovoAppThread;
	setThreads: SetThreads;
	threadId: string;
}

export interface HydrateCompletedRovoAppActiveRunInput {
	activeThreadId: string | null;
	attachedRunStatus: RovoAppRunStatus | null;
	currentActiveRun: RovoAppActiveRun | null | undefined;
	hydrateThreadById: (threadId: string) => Promise<unknown>;
	messages: ReadonlyArray<RovoUIMessage>;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	useChatStatus: ChatStatus;
}

export interface ResetRovoAppToBlankThreadStateInput {
	activeThreadIdRef: MutableRef<string | null>;
	beginThreadHydration: () => void;
	clearArtifactState: () => void;
	clearDirectDelegationState: () => void;
	clearPendingPlanMetadataGeneration: () => void;
	clearStreamingArtifactState: () => void;
	completeThreadHydration: () => void;
	hasHydratedActiveThreadRef: MutableRef<boolean>;
	isNavigationCurrent: RovoAppThreadNavigationCurrentness["isNavigationCurrent"];
	lastPersistedKeyRef: MutableRef<string | null>;
	navigationIdentity: RovoAppThreadNavigationIdentity;
	nextDraftId: string;
	pendingRouteReadyRef: MutableRef<boolean>;
	pendingRouteThreadIdRef: MutableRef<string | null>;
	pendingThreadCreationRef: MutableRef<Promise<string> | null>;
	queueProcessorRunningRef: MutableRef<boolean>;
	replaceRealtimeMessagesState: (
		messages: RovoUIMessage[],
		options?: { incrementVersion?: boolean },
	) => unknown;
	resetObservedTurnComplete: () => void;
	resetPendingArtifactAssociation: () => void;
	runSubscriptionAbortControllerRef: MutableRef<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRef<string | null>;
	scheduleComplete?: (callback: () => void) => void;
	setActiveThreadId: (threadId: string | null) => void;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setDocuments: SetState<RovoAppDocument[]>;
	setDraftThreadId: (threadId: string) => void;
	setEditingMessageId: (messageId: string | null) => void;
	setHasActiveDispatch: (hasActiveDispatch: boolean) => void;
	setIsLoadingThread: (isLoading: boolean) => void;
	setRovoMessages: SetState<RovoUIMessage[]>;
	setThreadVisibility: (visibility: RovoAppVisibility) => void;
	setVotes: SetState<Record<string, "up" | "down">>;
}

export interface LeaveRovoAppActiveThreadForBackgroundInput {
	activeDocumentId: string | null;
	activeThreadIdRef: MutableRef<string | null>;
	attachedRunStatus: RovoAppRunStatus | null;
	clearDirectDelegationState: () => void;
	currentActiveRun: RovoAppActiveRun | null | undefined;
	delegationAbortControllerRef: MutableRef<AbortController | null>;
	detachRun: (threadId: string) => Promise<unknown>;
	detachStream: (threadId: string) => Promise<unknown>;
	realtimeMessagesRef: MutableRef<ReadonlyArray<RovoUIMessage>>;
	rovoMessagesRef: MutableRef<ReadonlyArray<RovoUIMessage>>;
	isNavigationCurrent: RovoAppThreadNavigationCurrentness["isNavigationCurrent"];
	navigationIdentity: RovoAppThreadNavigationIdentity;
	runSubscriptionAbortControllerRef: MutableRef<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRef<string | null>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	statusRef: MutableRef<ChatStatus>;
	stopUseChat: () => void | Promise<void>;
	threadVisibility: RovoAppVisibility;
	updateThread: (
		threadId: string,
		input: {
			activeDocumentId: string | null;
			messages: ReadonlyArray<RovoUIMessage>;
			realtimeMessages: ReadonlyArray<RovoUIMessage>;
			visibility: RovoAppVisibility;
		},
	) => Promise<unknown>;
	warn?: (message: string, error: unknown) => void;
}

export interface LoadRovoAppThreadLifecycleInput {
	activeThreadIdRef: MutableRef<string | null>;
	clearRunSubscription: () => void;
	createThreadId: () => string;
	deletedThreadIdsRef: MutableRef<Set<string>>;
	embedded: boolean;
	getDocument: (documentId: string) => Promise<RovoAppDocument | null>;
	getThread: (threadId: string) => Promise<RovoAppThread | null>;
	hasHydratedActiveThreadRef: MutableRef<boolean>;
	hydrateThreadState: (
		thread: RovoAppThread,
		nextDocuments: RovoAppDocument[],
		nextVotes: RovoAppVote[],
		navigationIdentity: RovoAppThreadNavigationIdentity,
	) => void;
	isNavigationCurrent: RovoAppThreadNavigationCurrentness["isNavigationCurrent"];
	leaveActiveThreadForBackground: (navigationIdentity: RovoAppThreadNavigationIdentity) => Promise<unknown>;
	listDocuments: (threadId: string) => Promise<RovoAppDocument[]>;
	listVotes: (threadId: string) => Promise<RovoAppVote[]>;
	navigationIdentity: RovoAppThreadNavigationIdentity;
	reconcileThreadWithLocalTitle: (thread: RovoAppThread) => RovoAppThread;
	replaceRootRoute: () => void;
	resetToBlankChatState: (
		nextDraftId: string,
		navigationIdentity: RovoAppThreadNavigationIdentity,
	) => void;
	setInputError: (message: string | null) => void;
	setIsLoadingThread: (isLoading: boolean) => void;
	setThreads: SetThreads;
	subscribeToRun: (
		threadId: string,
		activeRun: RovoAppActiveRun | null,
		navigationIdentity: RovoAppThreadNavigationIdentity,
	) => Promise<unknown>;
	threadId: string;
	toUserErrorMessage: (error: unknown) => string;
}

export interface ActivateBlankRovoAppThreadStateInput {
	createThreadId: () => string;
	embedded: boolean;
	isNavigationCurrent: RovoAppThreadNavigationCurrentness["isNavigationCurrent"];
	leaveActiveThreadForBackground: (navigationIdentity: RovoAppThreadNavigationIdentity) => Promise<unknown>;
	navigationIdentity: RovoAppThreadNavigationIdentity;
	pushRootPath: () => void;
	resetToBlankChatState: (
		nextDraftId: string,
		navigationIdentity: RovoAppThreadNavigationIdentity,
	) => void;
	syncHistory?: boolean;
}

export interface HandleRovoAppThreadPopStateInput {
	activateBlankChatState: (options: { syncHistory: false }) => void | Promise<void>;
	activeThreadIdRef: MutableRef<string | null>;
	getThreadIdFromPath: (pathname: string) => string | null;
	hasHydratedActiveThreadRef: MutableRef<boolean>;
	loadThread: (threadId: string) => void | Promise<void>;
	pathname: string;
	rootPath: string;
}

export interface EnsureRovoAppThreadLifecycleInput {
	activeDocumentId: string | null;
	activeThreadIdRef: MutableRef<string | null>;
	createThread: (input: {
		activeDocumentId: string | null;
		id: string;
		messages: [];
		realtimeMessages: [];
		title: string;
		visibility: RovoAppVisibility;
	}) => Promise<RovoAppThread>;
	deletedThreadIdsRef: MutableRef<Set<string>>;
	draftThreadId: string;
	embedded: boolean;
	hasHydratedActiveThreadRef: MutableRef<boolean>;
	lastPersistedKeyRef: MutableRef<string | null>;
	pendingRouteReadyRef: MutableRef<boolean>;
	pendingRouteThreadIdRef: MutableRef<string | null>;
	pendingThreadCreationRef: MutableRef<Promise<string> | null>;
	pendingTitleMessageRef: MutableRef<string | null>;
	pendingTitleThreadIdRef: MutableRef<string | null>;
	seedText: string;
	setActiveThreadId: (threadId: string | null) => void;
	setIsGeneratingTitle: (isGenerating: boolean) => void;
	setPendingTitleThreadId: (threadId: string | null) => void;
	setThreads: SetThreads;
	threadVisibility: RovoAppVisibility;
}

function defaultScheduleComplete(callback: () => void): void {
	setTimeout(callback, 0);
}

function isRovoAppChatBusy(status: ChatStatus): boolean {
	return status === "submitted" || status === "streaming";
}

function isRovoAppThreadNavigationCurrent({
	isNavigationCurrent,
	navigationIdentity,
}: RovoAppThreadNavigationCurrentness): boolean {
	if (typeof isNavigationCurrent !== "function") {
		return true;
	}
	return isNavigationCurrent(navigationIdentity);
}

function resetRovoAppRunSubscription({
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	setAttachedRunStatus,
}: {
	runSubscriptionAbortControllerRef: MutableRef<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRef<string | null>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
}): void {
	runSubscriptionAbortControllerRef.current?.abort();
	runSubscriptionAbortControllerRef.current = null;
	runSubscriptionThreadIdRef.current = null;
	setAttachedRunStatus(null);
}

export async function refreshRovoAppThreadsWithLifecycle({
	deletedThreadIdsRef,
	getBackendUnavailableUserMessage,
	isBackendUnavailableError,
	listThreads,
	options = {},
	reconcileThreadWithLocalTitle,
	setInputError,
	setThreads,
	setThreadsLoaded,
	warn = console.error,
}: RefreshRovoAppThreadsLifecycleInput): Promise<void> {
	const reportBackendUnavailable = options.reportBackendUnavailable ?? true;

	try {
		const nextThreads = await listThreads();
		const resolvedThreads = nextThreads.map((thread) =>
			reconcileThreadWithLocalTitle(thread),
		);
		setThreads(
			filterDeletedRovoAppThreads(
				resolvedThreads,
				deletedThreadIdsRef.current,
			),
		);
		setInputError((previousError) =>
			previousError === getBackendUnavailableUserMessage()
				? null
				: previousError,
		);
		setThreadsLoaded(true);
	} catch (error) {
		if (isBackendUnavailableError(error)) {
			setThreads([]);
			if (reportBackendUnavailable) {
				setInputError(getBackendUnavailableUserMessage());
			}
			setThreadsLoaded(true);
			return;
		}

		warn("[RovoApp] Failed to refresh threads:", error);
	}
}

export function hydrateRovoAppThreadStateWithLifecycle({
	activeThreadIdRef,
	beginThreadHydration,
	clearDirectDelegationState,
	clearPendingPlanMetadataGeneration,
	clearStreamingArtifactState,
	completeThreadHydration,
	hasHydratedActiveThreadRef,
	isNavigationCurrent,
	lastPersistedKeyRef,
	navigationIdentity,
	nextDocuments,
	nextVotes,
	pendingRouteReadyRef,
	pendingRouteThreadIdRef,
	pendingThreadCreationRef,
	queueProcessorRunningRef,
	replaceRealtimeMessagesState,
	resetObservedTurnComplete,
	resetPendingArtifactAssociation,
	scheduleComplete = defaultScheduleComplete,
	setActiveDocumentId,
	setActiveThreadId,
	setAttachedRunStatus,
	setDocuments,
	setHasActiveDispatch,
	setPanelState,
	setRovoMessages,
	setSelectedVersionId,
	setThreadVisibility,
	setVisibleArtifactDocumentId,
	setVotes,
	thread,
}: HydrateRovoAppThreadStateInput): void {
	if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
		return;
	}

	beginThreadHydration();
	pendingThreadCreationRef.current = null;
	activeThreadIdRef.current = thread.id;
	hasHydratedActiveThreadRef.current = true;
	setActiveThreadId(thread.id);
	setRovoMessages(thread.messages);
	replaceRealtimeMessagesState(thread.realtimeMessages ?? [], {
		incrementVersion: false,
	});
	clearDirectDelegationState();
	clearStreamingArtifactState();
	resetPendingArtifactAssociation();
	resetObservedTurnComplete();
	queueProcessorRunningRef.current = false;
	setHasActiveDispatch(false);
	setAttachedRunStatus(thread.activeRun?.status ?? null);
	setThreadVisibility(thread.visibility);
	setDocuments(nextDocuments);
	setActiveDocumentId(thread.activeDocumentId);
	setVisibleArtifactDocumentId(thread.activeDocumentId);
	setPanelState(thread.activeDocumentId ? "preview" : "closed");
	setSelectedVersionId(
		thread.activeDocumentId
			? nextDocuments.find((document) => document.id === thread.activeDocumentId)?.versions.at(-1)?.id ?? null
			: null,
	);
	setVotes(buildVotesMap(nextVotes));
	lastPersistedKeyRef.current = buildRovoAppThreadPersistKey({
		messages: thread.messages,
		realtimeMessages: thread.realtimeMessages ?? [],
		visibility: thread.visibility,
		activeDocumentId: thread.activeDocumentId,
		title: thread.title,
	});
	clearPendingPlanMetadataGeneration();
	pendingRouteThreadIdRef.current = null;
	pendingRouteReadyRef.current = false;
	scheduleComplete(() => {
		if (isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
			completeThreadHydration();
		}
	});
}

export async function hydrateRovoAppThreadByIdWithLifecycle({
	deletedThreadIdsRef,
	getThread,
	hydrateThreadState,
	isNavigationCurrent,
	listDocuments,
	listVotes,
	navigationIdentity,
	reconcileThreadWithLocalTitle,
	setThreads,
	threadId,
}: HydrateRovoAppThreadByIdInput): Promise<void> {
	const [thread, nextDocuments, nextVotes] = await Promise.all([
		getThread(threadId),
		listDocuments(threadId),
		listVotes(threadId),
	]);
	if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
		return;
	}
	if (!thread) {
		return;
	}

	const resolvedThread = reconcileThreadWithLocalTitle(thread);
	hydrateThreadState(resolvedThread, nextDocuments, nextVotes, navigationIdentity);
	if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
		return;
	}
	setThreads((previousThreads) =>
		upsertRovoAppThreadRecord(previousThreads, resolvedThread, {
			deletedThreadIds: deletedThreadIdsRef.current,
		}),
	);
}

export function hydrateCompletedRovoAppActiveRun({
	activeThreadId,
	attachedRunStatus,
	currentActiveRun,
	hydrateThreadById,
	messages,
	setLocalThreadActiveRun,
	useChatStatus,
}: HydrateCompletedRovoAppActiveRunInput): boolean {
	if (!activeThreadId || !currentActiveRun) {
		return false;
	}

	if (isRovoAppChatBusy(useChatStatus) || attachedRunStatus !== null) {
		return false;
	}

	const latestAssistantMessage = [...messages]
		.reverse()
		.find((message) => message.role === "assistant");
	if (!latestAssistantMessage || !hasTurnCompleteSignal(latestAssistantMessage)) {
		return false;
	}

	setLocalThreadActiveRun(activeThreadId, null);
	void hydrateThreadById(activeThreadId).catch(() => {});
	return true;
}

export function resetRovoAppToBlankThreadState({
	activeThreadIdRef,
	beginThreadHydration,
	clearArtifactState,
	clearDirectDelegationState,
	clearPendingPlanMetadataGeneration,
	clearStreamingArtifactState,
	completeThreadHydration,
	hasHydratedActiveThreadRef,
	isNavigationCurrent,
	lastPersistedKeyRef,
	navigationIdentity,
	nextDraftId,
	pendingRouteReadyRef,
	pendingRouteThreadIdRef,
	pendingThreadCreationRef,
	queueProcessorRunningRef,
	replaceRealtimeMessagesState,
	resetObservedTurnComplete,
	resetPendingArtifactAssociation,
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	scheduleComplete = defaultScheduleComplete,
	setActiveThreadId,
	setAttachedRunStatus,
	setDocuments,
	setDraftThreadId,
	setEditingMessageId,
	setHasActiveDispatch,
	setIsLoadingThread,
	setRovoMessages,
	setThreadVisibility,
	setVotes,
}: ResetRovoAppToBlankThreadStateInput): void {
	if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
		return;
	}

	beginThreadHydration();
	pendingThreadCreationRef.current = null;
	setDraftThreadId(nextDraftId);
	activeThreadIdRef.current = null;
	hasHydratedActiveThreadRef.current = false;
	setActiveThreadId(null);
	setRovoMessages([]);
	replaceRealtimeMessagesState([], {
		incrementVersion: false,
	});
	resetRovoAppRunSubscription({
		runSubscriptionAbortControllerRef,
		runSubscriptionThreadIdRef,
		setAttachedRunStatus,
	});
	resetObservedTurnComplete();
	queueProcessorRunningRef.current = false;
	setHasActiveDispatch(false);
	clearDirectDelegationState();
	clearStreamingArtifactState();
	resetPendingArtifactAssociation();
	setDocuments([]);
	clearArtifactState();
	setVotes({});
	setThreadVisibility("private");
	setEditingMessageId(null);
	clearPendingPlanMetadataGeneration();
	lastPersistedKeyRef.current = buildRovoAppThreadPersistKey({
		messages: [],
		realtimeMessages: [],
		visibility: "private",
		activeDocumentId: null,
		title: "New chat",
	});
	pendingRouteThreadIdRef.current = null;
	pendingRouteReadyRef.current = false;
	setIsLoadingThread?.(false);
	scheduleComplete(() => {
		if (isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
			completeThreadHydration();
		}
	});
}

export async function leaveRovoAppActiveThreadForBackground({
	activeDocumentId,
	activeThreadIdRef,
	attachedRunStatus,
	clearDirectDelegationState,
	currentActiveRun,
	delegationAbortControllerRef,
	detachRun,
	detachStream,
	isNavigationCurrent,
	navigationIdentity,
	realtimeMessagesRef,
	rovoMessagesRef,
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	setAttachedRunStatus,
	setLocalThreadActiveRun,
	statusRef,
	stopUseChat,
	threadVisibility,
	updateThread,
	warn = console.warn,
}: LeaveRovoAppActiveThreadForBackgroundInput): Promise<void> {
	if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
		return;
	}

	const threadId = activeThreadIdRef.current;
	const activeRun = currentActiveRun ?? null;
	const hasActiveTurn =
		isRovoAppChatBusy(statusRef.current)
		|| activeRun !== null
		|| attachedRunStatus !== null;
	if (!hasActiveTurn) {
		return;
	}

	const transitionPlan = buildRovoAppActiveThreadTransitionPlan({
		activeDocumentId,
		isStreaming: hasActiveTurn,
		messages: rovoMessagesRef.current,
		realtimeMessages: realtimeMessagesRef.current,
		threadId,
		visibility: threadVisibility,
	});

	if (transitionPlan.shouldDetachStream && transitionPlan.threadId) {
		const detachThreadId = transitionPlan.threadId;
		await detachRun(detachThreadId)
			.catch(() => detachStream(detachThreadId).catch(() => false));
		if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
			return;
		}
	}

	if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
		return;
	}
	await stopUseChat();
	if (!isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity })) {
		return;
	}
	resetRovoAppRunSubscription({
		runSubscriptionAbortControllerRef,
		runSubscriptionThreadIdRef,
		setAttachedRunStatus,
	});
	delegationAbortControllerRef.current?.abort();
	delegationAbortControllerRef.current = null;
	clearDirectDelegationState();

	if (transitionPlan.persistence) {
		void updateThread(
			transitionPlan.persistence.threadId,
			transitionPlan.persistence.input,
		).catch((error) => {
			warn(
				"[RovoApp] Failed to persist the active thread before switching views:",
				error,
			);
		});
	}

	if (transitionPlan.shouldTrackBackgroundStream && transitionPlan.threadId) {
		const now = new Date().toISOString();
		setLocalThreadActiveRun(
			transitionPlan.threadId,
			activeRun
				? {
						...activeRun,
						status: activeRun.status === "queued" ? "queued" : "background",
						updatedAt: now,
					}
				: {
						id: `rovo-app-run-local-${transitionPlan.threadId}`,
						backend: "ai-gateway",
						status: "background",
						rovoPort: null,
						startedAt: now,
						updatedAt: now,
					},
		);
	}
}

export async function loadRovoAppThreadWithLifecycle({
	activeThreadIdRef,
	clearRunSubscription,
	createThreadId,
	deletedThreadIdsRef,
	embedded,
	getDocument,
	getThread,
	hasHydratedActiveThreadRef,
	hydrateThreadState,
	isNavigationCurrent,
	leaveActiveThreadForBackground,
	listDocuments,
	listVotes,
	navigationIdentity,
	reconcileThreadWithLocalTitle,
	replaceRootRoute,
	resetToBlankChatState,
	setInputError,
	setIsLoadingThread,
	setThreads,
	subscribeToRun,
	threadId,
	toUserErrorMessage,
}: LoadRovoAppThreadLifecycleInput): Promise<void> {
	const isCurrent = () =>
		isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity });

	if (!isCurrent()) {
		return;
	}

	if (
		shouldSkipRovoAppThreadLoad({
			activeThreadId: activeThreadIdRef.current,
			hasHydratedThreadState: hasHydratedActiveThreadRef.current,
			requestedThreadId: threadId,
		})
	) {
		if (isCurrent()) {
			setIsLoadingThread(false);
		}
		return;
	}

	await leaveActiveThreadForBackground(navigationIdentity);
	if (!isCurrent()) {
		return;
	}

	setInputError(null);
	setIsLoadingThread(true);
	try {
		const [thread, nextDocuments, nextVotes] = await Promise.all([
			getThread(threadId),
			listDocuments(threadId),
			listVotes(threadId),
		]);
		if (!isCurrent()) {
			return;
		}
		if (!thread) {
			resetToBlankChatState(createThreadId(), navigationIdentity);
			if (!embedded) {
				replaceRootRoute();
			}
			return;
		}
		if (deletedThreadIdsRef.current.has(thread.id)) {
			return;
		}

		const referencedDocumentIds = getRovoAppArtifactDocumentIdsFromMessages([
			...thread.messages,
			...(thread.realtimeMessages ?? []),
		]);
		const missingDocumentIds = referencedDocumentIds.filter(
			(documentId) => !nextDocuments.some((document) => document.id === documentId),
		);
		const recoveredDocuments = (
			await Promise.all(missingDocumentIds.map((documentId) => getDocument(documentId)))
		).filter((document): document is RovoAppDocument => Boolean(document));
		if (!isCurrent()) {
			return;
		}
		const hydratedDocuments = recoveredDocuments.reduce(
			(previousDocuments, document) => upsertDocumentRecord(previousDocuments, document),
			nextDocuments,
		);

		const resolvedThread = reconcileThreadWithLocalTitle(thread);
		hydrateThreadState(resolvedThread, hydratedDocuments, nextVotes, navigationIdentity);
		if (!isCurrent()) {
			return;
		}
		setThreads((previousThreads) =>
			upsertRovoAppThreadRecord(previousThreads, resolvedThread, {
				deletedThreadIds: deletedThreadIdsRef.current,
			}),
		);
		if (resolvedThread.activeRun) {
			void subscribeToRun(resolvedThread.id, resolvedThread.activeRun, navigationIdentity);
		} else {
			clearRunSubscription();
		}
	} catch (error) {
		if (isCurrent()) {
			setInputError(toUserErrorMessage(error));
		}
	} finally {
		if (isCurrent()) {
			setIsLoadingThread(false);
		}
	}
}

export async function activateBlankRovoAppThreadState({
	createThreadId,
	embedded,
	isNavigationCurrent,
	leaveActiveThreadForBackground,
	navigationIdentity,
	pushRootPath,
	resetToBlankChatState,
	syncHistory = true,
}: ActivateBlankRovoAppThreadStateInput): Promise<void> {
	const isCurrent = () =>
		isRovoAppThreadNavigationCurrent({ isNavigationCurrent, navigationIdentity });

	if (!isCurrent()) {
		return;
	}

	await leaveActiveThreadForBackground(navigationIdentity);
	if (!isCurrent()) {
		return;
	}

	resetToBlankChatState(createThreadId(), navigationIdentity);
	if (!embedded && syncHistory) {
		pushRootPath();
	}
}

export function handleRovoAppThreadPopState({
	activateBlankChatState,
	activeThreadIdRef,
	getThreadIdFromPath,
	hasHydratedActiveThreadRef,
	loadThread,
	pathname,
	rootPath,
}: HandleRovoAppThreadPopStateInput): boolean {
	const threadId = getThreadIdFromPath(pathname);
	if (threadId) {
		void loadThread(threadId);
		return true;
	}

	if (pathname !== rootPath && pathname !== `${rootPath}/`) {
		return false;
	}

	if (activeThreadIdRef.current === null && !hasHydratedActiveThreadRef.current) {
		return false;
	}

	void activateBlankChatState({ syncHistory: false });
	return true;
}

export function ensureRovoAppThreadWithLifecycle({
	activeDocumentId,
	activeThreadIdRef,
	createThread,
	deletedThreadIdsRef,
	draftThreadId,
	embedded,
	hasHydratedActiveThreadRef,
	lastPersistedKeyRef,
	pendingRouteReadyRef,
	pendingRouteThreadIdRef,
	pendingThreadCreationRef,
	pendingTitleMessageRef,
	pendingTitleThreadIdRef,
	seedText,
	setActiveThreadId,
	setIsGeneratingTitle,
	setPendingTitleThreadId,
	setThreads,
	threadVisibility,
}: EnsureRovoAppThreadLifecycleInput): Promise<string> {
	if (activeThreadIdRef.current) {
		return Promise.resolve(activeThreadIdRef.current);
	}

	if (pendingThreadCreationRef.current) {
		return pendingThreadCreationRef.current;
	}

	const threadCreationPromise = createThread({
		id: draftThreadId,
		title: deriveThreadTitle(seedText),
		messages: [],
		realtimeMessages: [],
		visibility: threadVisibility,
		activeDocumentId,
	})
		.then((nextThread) => {
			activeThreadIdRef.current = nextThread.id;
			hasHydratedActiveThreadRef.current = true;
			setActiveThreadId(nextThread.id);
			setThreads((previousThreads) =>
				upsertRovoAppThreadRecord(previousThreads, nextThread, {
					deletedThreadIds: deletedThreadIdsRef.current,
				}),
			);
			lastPersistedKeyRef.current = buildRovoAppThreadPersistKey({
				messages: nextThread.messages,
				realtimeMessages: nextThread.realtimeMessages ?? [],
				visibility: nextThread.visibility,
				activeDocumentId: nextThread.activeDocumentId,
				title: nextThread.title,
			});
			if (!embedded) {
				pendingRouteThreadIdRef.current = nextThread.id;
				pendingRouteReadyRef.current = false;
			}
			setIsGeneratingTitle(true);
			setPendingTitleThreadId(nextThread.id);
			pendingTitleThreadIdRef.current = nextThread.id;
			pendingTitleMessageRef.current = seedText;
			return nextThread.id;
		})
		.finally(() => {
			if (pendingThreadCreationRef.current === threadCreationPromise) {
				pendingThreadCreationRef.current = null;
			}
		});

	pendingThreadCreationRef.current = threadCreationPromise;
	return threadCreationPromise;
}
