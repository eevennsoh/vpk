"use client";

import { useLazyRef } from "@/lib/use-lazy-ref";
import { createRovoChatTranscript, type RovoChatTranscriptOwner, type RovoSessionSnapshot, type RovoLocalTurn } from "@/app/contexts/rovo-chat-transcript";
import { type RovoChatTransitionKind } from "@/app/contexts/rovo-chat-transition-coordinator";
import { useLatestRef } from "@/lib/use-latest-ref";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
	type ReactNode,
	type SetStateAction,
} from "react";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import { API_ENDPOINTS } from "@/lib/api-config";
import {
	createAssistantTextMessage,
	type RovoDataParts,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import {
	createRovoBackendCanceller,
	EXPLICIT_CANCEL_REQUEST_TIMEOUT_MS,
	shouldSendExplicitRovoCancel,
	type RovoCancelTarget,
} from "@/lib/rovo-cancel-strategy";
import {
	createRovoAppId,
	type RovoAppThread,
} from "@/lib/rovo-app-types";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import {
	normalizeSessionAgentEntry,
} from "@/components/projects/rovo-core/lib/agent-records/session-agent-entry";
import {
	STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS,
	commitSessionAgentPublishReadyEntry,
	getSessionAgentEntryByProfileId,
	mergeRehydratedSessionAgentEntries,
	persistSessionAgentEntries,
	publishSessionAgentEntry,
	registerSessionAgentFromResult,
	rehydrateSessionAgentEntriesFromStorage,
	removeSessionAgentEntry,
	restoreSessionAgentVersionEntry,
	updateSessionAgentDraftEntry,
	type SessionAgentEntry,
	type SessionAgentEntryMutationResult,
	type StudioSessionAgentSaveStatus,
} from "@/components/projects/rovo-core/lib/agent-records/session-agent-registry";
import { createDebouncedWriter } from "@/components/projects/rovo-core/lib/agent-records/debounced-writer";
import {
	SESSION_AGENT_SAVE_INITIAL_STATE,
	selectSessionAgentSavedAt,
	selectSessionAgentSaveStatus,
	sessionAgentSaveReducer,
} from "@/components/projects/rovo-core/lib/agent-records/session-agent-save-machine";
import type { StudioSessionAgentEntry } from "@/components/projects/rovo-core/lib/agent-records/types";
import {
	getRovoAgentProfile,
	isRovoAgentProfile,
	ROVO_AGENT_PROFILES,
	ROVO_AGENT_ID,
	ROVO_AGENT_SELECTOR_AGENTS,
	type RovoAgentProfile,
} from "@/app/data/directory/agents";
import {
	cancelRovoAppRun,
	createRovoAppThread,
	deleteAllRovoAppThreads,
	deleteRovoAppThread,
	detachRovoAppRun,
	fetchRovoAppAITitle,
	fetchRovoAppSuggestedQuestions,
	getRovoAppThread,
	listRovoAppThreads,
	updateRovoAppThread,
} from "@/components/projects/rovo-core/lib/api";
import {
	appendSuggestedQuestionsToAssistantMessage,
	buildNextSuggestedQuestionsRequest,
} from "@/components/projects/rovo-core/lib/rovo-app-suggestions";
import {
	buildExitPlanModeDeferredToolResponse,
	type ParsedPlanWidgetPayload,
} from "@/components/projects/shared/lib/plan-widget";
import {
	buildPlanApprovalPrompt,
	createPlanApprovalSubmission,
	getPlanApprovalKeyFromPlanWidget,
	type PlanApprovalSelection,
} from "@/components/projects/shared/lib/plan-approval";
import {
	buildSelectableAgents,
	buildCompactThreadPersistKey,
	buildSendMessageBody,
	createQueueItemId,
	deriveCompactThreadTitle,
	getEditResendMetadata,
	getPromptMessageMetadata,
	hasRichCompactMessageState,
	hasRichCompactThreadState,
	isClarificationResolutionPrompt,
	isInvalidPartStateError,
	markPendingClarificationResolvedInMessages,
	mergeSelectedAgentPromptOptions,
	mergeSendPromptOptions,
	resolveWorkItemReportPromptOptions,
	sanitizeMessagesForTransport,
	sanitizeRovoUiMessages,
	sanitizeValueForTransport,
	trimMessagesForRequestSize,
	type QueuedPromptItem,
	type SendPromptOptions,
} from "@/app/contexts/rovo-chat-helpers";
import {
	type RovoChatTransitionToken,
} from "@/app/contexts/rovo-chat-transition-coordinator";
import { RovoChatControlsProvider } from "@/app/contexts/context-rovo-chat-controls";
import { useRovoChatTransitionCoordinator } from "@/app/contexts/use-rovo-chat-transition-coordinator";
import { getIncompleteTurnUserMessage } from "@/lib/chat-error-utils";
import {
	canDispatchNextPrompt,
	canFinalizeActivePrompt,
	classifyTurnError,
	findCutShortNotice,
	hasLiveRequest, hasSendInFlight,
	isTurnWorkIdle,
	shouldStartSubmitPending as shouldStartSubmitPendingForTurn,
	type RovoChatRetryWait,
	type RovoChatTurnEnvironment,
} from "@/app/contexts/rovo-chat-turn-machine";
import { useRovoChatTurnMachine } from "@/app/contexts/use-rovo-chat-turn-machine";
import { useRovoChatMediaGeneration } from "@/app/contexts/use-rovo-chat-media-generation";
import { useRovoChatCutShortTurn } from "@/app/contexts/use-rovo-chat-cut-short-turn";
import { stopDepartingRequest } from "@/app/contexts/rovo-chat-departing-turn";
import { sendForTranscript } from "@/app/contexts/rovo-chat-request-lifecycle";
import { useRovoChatRetry } from "@/app/contexts/use-rovo-chat-retry";
import {
	createTurnError,
	hasTurnCompleteForActivePrompt,
	insertTurnErrors,
	pruneTurnErrorsFrom,
	type RovoChatTurnError,
} from "@/app/contexts/rovo-chat-turn-errors";
import { DefaultChatTransport, type FileUIPart } from "ai";

export type {
	StudioAgentPublishStatus,
	StudioAgentVersionRecord,
	StudioSessionAgentEntry,
} from "@/components/projects/rovo-core/lib/agent-records/types";
export type { StudioSessionAgentSaveStatus } from "@/components/projects/rovo-core/lib/agent-records/session-agent-registry";
export type { QueuedPromptItem, SendPromptOptions } from "@/app/contexts/rovo-chat-helpers";

type SendMessageArgs = Parameters<UseChatHelpers<RovoUIMessage>["sendMessage"]>;
const EXPLICIT_CANCEL_GRACE_MS = 1_200;
const COMPACT_HISTORY_LIMIT = 40;
const COMPACT_THREAD_PERSIST_DEBOUNCE_MS = 450;

export type ChatSurface = "floating" | "sidebar";

export interface SelectAgentOptions {
	preserveCurrentThread?: boolean;
}

export interface RegisterCreatedAgentOptions extends SelectAgentOptions {
	select?: boolean;
	sourceKey?: string;
	// Persist the new entry without surfacing the "Saving…/Saved" indicator.
	// Used for creating a brand-new blank agent, which has nothing to save yet.
	silentSave?: boolean;
}

interface RovoChatContextType {
	selectedAgentId: string;
	selectedAgent: RovoAgentProfile;
	selectableAgents: readonly AgentSelectorAgent[];
	isCustomAgentSelected: boolean;
	selectAgent: (agentId: string, options?: SelectAgentOptions) => void;
	registerCreatedAgentFromResult: (
		agentResult: RovoDataParts["agent-result"],
		options?: RegisterCreatedAgentOptions
	) => RovoAgentProfile | null;
	sessionAgentEntries: readonly StudioSessionAgentEntry[];
	getSessionAgentEntry: (profileId: string) => StudioSessionAgentEntry | null;
	updateSessionAgentDraft: (
		profileId: string,
		patch: Partial<RovoDataParts["agent-result"]>
	) => StudioSessionAgentEntry | null;
	commitSessionAgentPublishReady: (profileId: string) => StudioSessionAgentEntry | null;
	publishSessionAgent: (profileId: string) => StudioSessionAgentEntry | null;
	restoreSessionAgentVersion: (profileId: string, versionId: string) => StudioSessionAgentEntry | null;
	removeSessionAgent: (profileId: string) => void;
	sessionAgentSaveStatus: StudioSessionAgentSaveStatus;
	sessionAgentSavedAt: number | null;
	resetAgentToRovo: (options?: { preserveCurrentThread?: boolean }) => void;
	chatSurface: ChatSurface | null;
	openChat: (surface: ChatSurface) => void;
	switchSurface: (surface: ChatSurface) => void;
	isOpen: boolean;
	toggleChat: () => void;
	closeChat: () => void;
	/**
	 * Whether at least one caller has pinned the floating surface. When pinned,
	 * the floating chat stays mounted across message activity (i.e., the
	 * auto-promote-to-sidebar effect in RovoFloatingChat is disabled). Multiple
	 * callers can pin with different reasons; the floating surface unpins only
	 * after all reasons release.
	 */
	isFloatingPinned: boolean;
	/**
	 * Pin the floating surface for the given reason. If the chat is currently
	 * on the sidebar surface, switches to floating and remembers the prior
	 * surface so it can be restored when the pin releases.
	 */
	pinFloating: (reason: string) => void;
	/**
	 * Release a previously requested floating pin. When the last pin is
	 * released, restores any surface that was active before the first pin.
	 */
	unpinFloating: (reason: string) => void;
	uiMessages: RovoUIMessage[];
	sendPrompt: (prompt: string, options?: SendPromptOptions, files?: ReadonlyArray<FileUIPart>) => Promise<void>;
	acceptPlanReview: (planWidget: ParsedPlanWidgetPayload) => Promise<void>;
	submitPlanApproval: (planWidget: ParsedPlanWidgetPayload, selection: PlanApprovalSelection) => Promise<void>;
	editMessage: (messageId: string, nextText: string, options?: SendPromptOptions) => Promise<void>;
	editingMessageId: string | null;
	setEditingMessageId: (messageId: string | null) => void;
	stopStreaming: () => Promise<void>;
	clearSuggestedQuestions: () => void;
	resetChat: () => void;
	activeThreadId: string | null;
	currentThread: RovoAppThread | null;
	threads: ReadonlyArray<RovoAppThread>;
	threadsLoaded: boolean;
	isHistoryOpen: boolean;
	openHistory: () => void;
	closeHistory: () => void;
	toggleHistory: () => void;
	refreshThreads: () => Promise<void>;
	selectThread: (threadId: string) => Promise<void>;
	deleteThread: (threadId: string) => Promise<void>;
	deleteAllThreads: () => Promise<void>;
	cancelThreadRun: (threadId: string) => Promise<void>;
	openCurrentThreadFullscreen: () => void;
	currentThreadHasRichState: boolean;
	applyLocalTurn: (turn: RovoLocalTurn) => Promise<boolean>;
	activateSession: (snapshot: RovoSessionSnapshot) => Promise<boolean>;
	isStreaming: boolean;
	isMediaGenerating: boolean;
	hasInFlightTurn: boolean;
	isSubmitPending: boolean;
	pendingSubmitStartedAt: number | null;
	pendingPrompt: string | null;
	setPendingPrompt: (prompt: string | null) => void;
	queuedPrompts: ReadonlyArray<QueuedPromptItem>;
	activePrompt: QueuedPromptItem | null;
	removeQueuedPrompt: (id: string) => void;
	clearQueuedPrompts: () => void;
	queueCount: number;
}

const RovoChatContext = createContext<RovoChatContextType | undefined>(undefined);

interface RovoChatProviderProps {
	agentProfiles?: readonly RovoAgentProfile[];
	autoSelectAgentId?: string;
	children: ReactNode;
	defaultPromptOptions?: SendPromptOptions;
	portIndex?: number;
}

function useRovoChatTranscript(owner: RovoChatTranscriptOwner) {
	const [transcript] = useState(() => createRovoChatTranscript(owner));
	useLayoutEffect(() => transcript.configure(owner), [transcript, owner]);
	return transcript;
}

export function RovoChatProvider({
	agentProfiles,
	autoSelectAgentId,
	children,
	defaultPromptOptions,
	portIndex,
}: Readonly<RovoChatProviderProps>) {
	const [selectedAgentId, setSelectedAgentId] = useState(ROVO_AGENT_ID);
	const selectedAgentIdRef = useRef(ROVO_AGENT_ID);
	const setSelectedAgentIdState = useCallback((nextAgentId: string) => {
		selectedAgentIdRef.current = nextAgentId;
		setSelectedAgentId(nextAgentId);
	}, []);
	const [chatSurface, setChatSurface] = useState<ChatSurface | null>(null);
	const chatSurfaceRef = useLatestRef(chatSurface);
	const updateChatSurface = useCallback((updater: SetStateAction<ChatSurface | null>) => {
		const nextSurface = typeof updater === "function"
			? updater(chatSurfaceRef.current)
			: updater;
		chatSurfaceRef.current = nextSurface;
		setChatSurface(nextSurface);
	}, [chatSurfaceRef]);
	const isOpen = chatSurface !== null;
	const [isSubmitPending, setIsSubmitPending] = useState(false);
	const [pendingSubmitStartedAt, setPendingSubmitStartedAt] = useState<number | null>(
		null
	);
	const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
	// Transient status for the live request (retry countdowns).
	const [submissionErrorMessage, setSubmissionErrorMessage] =
		useState<RovoUIMessage | null>(null);
	// Final errors stay on the failed turn until the transcript is replaced or that turn is edited.
	const [turnErrors, setTurnErrors] = useState<ReadonlyArray<RovoChatTurnError>>([]);
	// The turn lifecycle (queue, active prompt, finalize flags) is a pure reducer; see rovo-chat-turn-machine.ts.
	const { turnRef, dispatchTurn, queuedPrompts, activePrompt, cutShortMediaWait, retry, waitForTurn } = useRovoChatTurnMachine();
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const [threads, setThreads] = useState<RovoAppThread[]>([]);
	const [threadsLoaded, setThreadsLoaded] = useState(false);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [sessionAgentEntries, setSessionAgentEntries] = useState<SessionAgentEntry[]>([]);
	const [sessionAgentSaveState, dispatchSessionAgentSave] = useReducer(
		sessionAgentSaveReducer,
		SESSION_AGENT_SAVE_INITIAL_STATE,
	);
	const sessionAgentSaveStatus = selectSessionAgentSaveStatus(sessionAgentSaveState);
	const sessionAgentSavedAt = selectSessionAgentSavedAt(sessionAgentSaveState);
	const hasRehydratedPublishedAgentsRef = useRef(false);
	const lastSeenSessionAgentEntriesRef = useRef<SessionAgentEntry[] | null>(null);

	const errorCounterRef = useRef(0);
	const pendingTurnErrorRef = useRef<RovoUIMessage | null>(null);
	const queueIdRef = useRef(0);
	const activeThreadIdRef = useRef<string | null>(null);
	const pendingThreadCreationRef = useRef<Promise<string> | null>(null);
	const lastPersistedThreadKeyRef = useRef("");
	const isStreamingRef = useRef(false);
	const wasStreamingRef = useRef(false);
	const isCancellingRef = useRef(false);
	const cancelStreamPromiseRef = useRef<Promise<boolean> | null>(null);
	const autoSelectedAgentIdRef = useRef<string | null>(null);
	// One canceller per provider: it owns the backend-cancel debounce.
	const [sendBackendCancel] = useState(() => createRovoBackendCanceller({
		cancelEndpoint: API_ENDPOINTS.CHAT_CANCEL,
		cancelRun: cancelRovoAppRun,
		fetchImpl: (input, init) => fetch(input, init),
		timeoutMs: EXPLICIT_CANCEL_REQUEST_TIMEOUT_MS,
	}));
	const isSubmitPendingRef = useRef(false);
	const suggestionsAbortControllerRef = useRef<AbortController | null>(null);
	const sessionAgentEntriesRef = useRef<SessionAgentEntry[]>([]);
	// The one owner of the debounced session-agent write and its flush. A silent write still
	// lands in storage; the save machine leaves the indicator alone for it.
	const sessionAgentWriter = useLazyRef(() => createDebouncedWriter(() => {
		const didPersist = persistSessionAgentEntries(sessionAgentEntriesRef.current.map(normalizeSessionAgentEntry));
		dispatchSessionAgentSave({ type: "persisted", ok: didPersist, at: Date.now() });
	}, STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS));
	const {
		beginTransition: beginProviderTransition,
		finishTransition: finishProviderTransition,
		hasCancellationOwner,
		isCurrentTransition,
		syncTransitionCancellation,
	} = useRovoChatTransitionCoordinator({ isCancellingRef });
	const transcriptAbortRef = useRef<AbortController | null>(null);
	const beginTransition = useCallback((kind: RovoChatTransitionKind) => {
		transcriptAbortRef.current?.abort();
		pendingThreadCreationRef.current = null;
		const token = beginProviderTransition(kind);
		dispatchTurn({ type: "transitionStarted", id: token.id });
		return token;
	}, [beginProviderTransition, dispatchTurn]);
	const finishTransition = useCallback((token: RovoChatTransitionToken) => {
		const current = finishProviderTransition(token);
		dispatchTurn({ type: "transitionFinished", id: token.id });
		return current;
	}, [dispatchTurn, finishProviderTransition]);
	useEffect(() => {
		dispatchTurn({ type: "providerResumed" });
		return () => {
			dispatchTurn({ type: "providerSuspended" });
			transcriptAbortRef.current?.abort();
			pendingThreadCreationRef.current = null;
			const token = beginProviderTransition("destroy");
			finishTransition(token);
		};
	}, [beginProviderTransition, dispatchTurn, finishTransition]);
	// The one writer of the session-agent working copy: the ref that mutations read
	// synchronously and the state that renders move together, normalized once here.
	// Nothing copies state back into the ref, so a mutation made by a child's mount
	// effect is never overwritten by the provider's first (still empty) state.
	const commitSessionAgentEntries = useCallback((entries: readonly SessionAgentEntry[]) => {
		const normalizedEntries = entries.map(normalizeSessionAgentEntry);
		sessionAgentEntriesRef.current = normalizedEntries;
		setSessionAgentEntries(normalizedEntries);
	}, []);
	const applySessionAgentMutation = useCallback((
		result: SessionAgentEntryMutationResult,
		options?: { silentSave?: boolean }
	): SessionAgentEntry | null => {
		if (!result.changed) {
			return result.entry;
		}

		// A silent save (a brand-new blank agent, with nothing worth saving yet) writes
		// without the "Saving…/Saved" progression.
		dispatchSessionAgentSave({ type: "changed", silent: options?.silentSave === true });
		commitSessionAgentEntries(result.entries);
		return result.entry;
	}, [commitSessionAgentEntries]);
	// oxlint-disable react-doctor/no-event-handler -- Agent profile props and session-agent storage are external inputs that reconcile selected-agent state after render.
	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Removed or auto-selected agent profiles must fall back after the owning profile set changes.
	// oxlint-disable react-doctor/no-chain-state-updates -- Selection reconciliation intentionally updates the selected-agent state/ref pair together.
	const staticAgentProfiles = useMemo(
		() => agentProfiles ?? ROVO_AGENT_PROFILES,
		[agentProfiles]
	);
	const normalizedSessionAgentEntries = useMemo(
		() => sessionAgentEntries.map(normalizeSessionAgentEntry),
		[sessionAgentEntries],
	);
	const agentProfileById = useMemo(() => {
		const profiles = [
			...staticAgentProfiles,
			...normalizedSessionAgentEntries.map((entry) => entry.profile),
		];
		return new Map(profiles.map((agent) => [agent.id, agent]));
	}, [normalizedSessionAgentEntries, staticAgentProfiles]);
	const selectableAgents = useMemo(
		() => buildSelectableAgents(
			agentProfiles ?? ROVO_AGENT_SELECTOR_AGENTS,
			normalizedSessionAgentEntries,
		),
		[agentProfiles, normalizedSessionAgentEntries],
	);
	const selectedAgent = useMemo(
		() => agentProfileById.get(selectedAgentId) ?? getRovoAgentProfile(selectedAgentId),
		[agentProfileById, selectedAgentId],
	);
	const isCustomAgentSelected = !isRovoAgentProfile(selectedAgent);

	// oxlint-disable react-doctor/no-event-handler -- Agent profile props and session-agent storage can remove the selected profile outside a user selection event.
	useEffect(() => {
		if (
			!agentProfiles ||
			selectedAgentId === ROVO_AGENT_ID ||
			agentProfileById.has(selectedAgentId)
		) {
			return;
		}

		setSelectedAgentIdState(ROVO_AGENT_ID);
	}, [agentProfileById, agentProfiles, selectedAgentId, setSelectedAgentIdState]);
	// oxlint-enable react-doctor/no-chain-state-updates
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change
	// oxlint-enable react-doctor/no-event-handler

	const requestedSuggestionMessageIdsRef = useLazyRef<Set<string>>(() => new Set());
	const requestedSuggestionMessageIds = requestedSuggestionMessageIdsRef.current;
	const maybeFinalizeAndProcessRef = useRef<() => void>(() => {});
	const processNextPromptRef = useRef<() => Promise<void>>(async () => {});
	const sendChatMessageRef = useRef<(promptItem: QueuedPromptItem) => Promise<void>>(async () => {});
	const retryActivePromptRef = useRef<(retry: RovoChatRetryWait) => Promise<void>>(async () => {});
	const scheduleRetry = useRovoChatRetry(retry, setSubmissionErrorMessage, retryActivePromptRef, dispatchTurn);

	useEffect(() => {
		// Skip the initial rehydration and React 19 StrictMode's dev-only mount
		// double-invoke, which re-runs this effect with the *same* entries
		// reference. Persisting on either would fire a spurious debounced save
		// plus a "Saving…/Saved" flash for data the user never touched. A boolean
		// "has initialized" flag does NOT survive the double-invoke: the first
		// pass flips it and registers no cleanup, so the second pass sees it
		// already set and falls through to a real save. Gating on the last-seen
		// reference is resilient because both mount invocations carry the
		// identical value, while genuine edits always produce a new array.
		const previousSessionAgentEntries = lastSeenSessionAgentEntriesRef.current;
		lastSeenSessionAgentEntriesRef.current = normalizedSessionAgentEntries;
		if (
			previousSessionAgentEntries === null ||
			previousSessionAgentEntries === normalizedSessionAgentEntries
		) {
			return;
		}

		sessionAgentWriter.current.schedule();
	}, [normalizedSessionAgentEntries, sessionAgentWriter]);

	// A write still waiting when the provider unmounts (a route change) or the page goes
	// away (reload, tab close, navigation) lands at once instead of being dropped.
	useEffect(() => {
		const writer = sessionAgentWriter.current;
		const flush = () => writer.flush();
		window.addEventListener("pagehide", flush);
		return () => {
			window.removeEventListener("pagehide", flush);
			writer.flush();
		};
	}, [sessionAgentWriter]);

	// oxlint-disable react-doctor/no-initialize-state -- Session agents are rehydrated from browser storage after mount because localStorage is unavailable during server render.
	useEffect(() => {
		if (hasRehydratedPublishedAgentsRef.current) {
			return;
		}
		hasRehydratedPublishedAgentsRef.current = true;
		const rehydrated = rehydrateSessionAgentEntriesFromStorage();
		if (rehydrated.length === 0) {
			return;
		}

		const mergeResult = mergeRehydratedSessionAgentEntries(
			sessionAgentEntriesRef.current,
			rehydrated,
		);
		if (mergeResult.changed) {
			// Rehydration writes the persisted agents back to storage unchanged;
			// run that persist silently so a plain reload (no user edits) never
			// flashes the "Saving…/Saved just now" indicator. Only set here, in
			// the branch that actually changes the entries and re-triggers the
			// debounced save effect, so the flag can't linger and swallow the
			// user's next real save.
			dispatchSessionAgentSave({ type: "changed", silent: true });
			commitSessionAgentEntries(mergeResult.entries);
		}
	}, [commitSessionAgentEntries]);
	// oxlint-enable react-doctor/no-initialize-state

	// oxlint-disable react-doctor/no-derived-state -- The selected agent also changes from explicit user actions, so it cannot be purely derived from the auto-select prop.
	// oxlint-disable react-doctor/no-event-handler -- Auto-selection is driven by route/provider props, not by a local user event handler.
	useEffect(() => {
		if (!autoSelectAgentId) {
			autoSelectedAgentIdRef.current = null;
			return;
		}
		if (autoSelectedAgentIdRef.current === autoSelectAgentId) {
			return;
		}

		const nextAgent = agentProfileById.get(autoSelectAgentId);
		if (!nextAgent) {
			return;
		}

		autoSelectedAgentIdRef.current = autoSelectAgentId;
		if (selectedAgentId !== nextAgent.id) {
			setSelectedAgentIdState(nextAgent.id);
		}
	}, [agentProfileById, autoSelectAgentId, selectedAgentId, setSelectedAgentIdState]);
	// oxlint-enable react-doctor/no-event-handler
	// oxlint-enable react-doctor/no-derived-state

	const startSubmitPending = useCallback((startedAt: number) => {
		if (isSubmitPendingRef.current) {
			return;
		}

		isSubmitPendingRef.current = true;
		setIsSubmitPending(true);
		setPendingSubmitStartedAt(startedAt);
	}, []);

	const clearSubmitPending = useCallback(() => {
		if (!isSubmitPendingRef.current) {
			return;
		}

		isSubmitPendingRef.current = false;
		setIsSubmitPending(false);
		setPendingSubmitStartedAt(null);
	}, []);

	const cancelRetryTimer = useCallback(() => {
		dispatchTurn({ type: "retryCancelled" });
	}, [dispatchTurn]);

	const recordTurnError = useCallback((turnError: RovoChatTurnError) => {
		setTurnErrors((previous) => [...previous, turnError]);
	}, []);

	const clearChatErrors = useCallback(() => {
		pendingTurnErrorRef.current = null;
		setSubmissionErrorMessage(null);
		setTurnErrors([]);
	}, []);

	const queueTick = useCallback(() => {
		Promise.resolve().then(() => {
			maybeFinalizeAndProcessRef.current();
		});
	}, []);
	const handleCutShortFinish = useRovoChatCutShortTurn(dispatchTurn, queueTick, cutShortMediaWait);

	// oxlint-disable react-doctor/no-event-handler -- The transport callback is invoked by the AI SDK request pipeline and must close over the current port index.
	const transport = useMemo(
		() =>
			new DefaultChatTransport<RovoUIMessage>({
				api: API_ENDPOINTS.ROVO_APP_CHAT,
				prepareSendMessagesRequest: ({ messages, body }) => {
					const normalizedMessages = sanitizeRovoUiMessages(messages);
					const sanitizedMessages = sanitizeMessagesForTransport(normalizedMessages);
					const sanitizedBody = sanitizeValueForTransport(
						(body ?? {}) as Record<string, unknown>
					) as Record<string, unknown>;
					const { messages: trimmedMessages, trimmed } = trimMessagesForRequestSize(
						sanitizedMessages,
						sanitizedBody
					);

					return {
						body: {
							...sanitizedBody,
							id: activeThreadIdRef.current,
							messages: trimmedMessages,
							payloadTrimmed: trimmed,
							...(portIndex !== undefined ? { portIndex } : {}),
						},
					};
				},
			}),
		[portIndex]
	);
	// oxlint-enable react-doctor/no-event-handler

	const {
		messages: rawUiMessages,
		sendMessage,
		setMessages,
		stop,
		status,
	} = useChat<RovoUIMessage>({
		transport,
		onError: (error) => {
			clearSubmitPending();
			errorCounterRef.current += 1;
			const errorMessageId = `error-${errorCounterRef.current}`;
			const classification = classifyTurnError({
				errorMessage: error.message,
				retryCount: turnRef.current.retryCount,
				activePrompt: turnRef.current.activePrompt,
			});

			if (classification.kind === "retry") {
				const startedAt = scheduleRetry({
					promptId: classification.prompt.id, reason: classification.reason,
					messageId: errorMessageId, delayMs: classification.delayMs,
				});
				if (classification.reason === "chat-in-progress") {
					startSubmitPending(startedAt);
				}
				return;
			}

			cancelRetryTimer();
			if (classification.sanitizeTranscript) {
				setMessages((prev) =>
					sanitizeMessagesForTransport(sanitizeRovoUiMessages(prev))
				);
			}
			pendingTurnErrorRef.current = createAssistantTextMessage(errorMessageId, classification.userMessage);
			dispatchTurn({ type: "turnFailed", resetRetries: classification.resetRetries });
			queueTick();
		},
		// Runs once per request, after onError when it failed, so a final error anchors to the transcript as the request left it.
		onFinish: ({ messages, isAbort, isError }) => {
			dispatchTurn({ type: "requestFinished" }); // With or without an active prompt, so the request no longer counts as live.
			const pendingTurnError = pendingTurnErrorRef.current;
			pendingTurnErrorRef.current = null;
			if (pendingTurnError) {
				recordTurnError(createTurnError(pendingTurnError, messages));
			} else {
				// Cut short: keep the partial reply and finalize with the notice, read from this snapshot.
				handleCutShortFinish({ messages, isAbort, isError, activePrompt: turnRef.current.activePrompt });
			}
		},
	});

	const isStreaming = status === "submitted" || status === "streaming";
	const rawUiMessagesRef = useLatestRef(rawUiMessages);

	// One send path for every dispatch: a send that trips over an invalid part
	// state sanitizes the transcript and is sent once more.
	const sendWithPartStateRecovery = useCallback(async (message: SendMessageArgs[0], options: SendMessageArgs[1]) => {
		try {
			await sendMessage(message, options);
		} catch (error) {
			if (!isInvalidPartStateError(error)) {
				throw error;
			}

			setMessages((prev) => sanitizeRovoUiMessages(prev));
			await Promise.resolve();
			await sendMessage(message, options);
		}
	}, [sendMessage, setMessages]);

	// Resends the active prompt once its retry delay (rate limit or chat in progress) ends.
	const retryActivePrompt = useCallback(async (wait: RovoChatRetryWait) => {
		const promptItem = turnRef.current.activePrompt;
		if (!promptItem || promptItem.id !== wait.promptId) return;
		await sendForTranscript({ turnRef, waitForTurn }, (state) => state.retry === wait,
			[() => waitForTurn((state) => !state.dispatching || state.retry !== wait)], async () => {
				setSubmissionErrorMessage(null);
				setMessages((prev) => {
					const lastUserIndex = prev.findLastIndex((m) => m.role === "user");
					return lastUserIndex === -1 ? prev : prev.filter((_, i) => i !== lastUserIndex);
				});
				dispatchTurn({ type: "retryDispatchStarted" });
				const attempt = turnRef.current.sendAttempt;
				let failed = false;
				try {
					await sendWithPartStateRecovery(
						{ files: promptItem.files, text: promptItem.text, metadata: getPromptMessageMetadata(promptItem) },
						{ body: buildSendMessageBody(promptItem.options, turnRef.current.queue.length > 0) },
					);
				} catch (error) {
					failed = true;
					console.error("[RovoChatProvider] Retry send failed:", error);
				} finally {
					dispatchTurn({ type: "dispatchSettled", attempt, failed });
					queueTick();
				}
			});
	}, [dispatchTurn, queueTick, sendWithPartStateRecovery, setMessages, turnRef, waitForTurn]);

	useEffect(() => {
		retryActivePromptRef.current = retryActivePrompt;
	}, [retryActivePrompt]);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- AI SDK status changes are external stream state that clear the local pending affordance.
	useEffect(() => {
		if (
			status !== "submitted" &&
			status !== "streaming" &&
			status !== "error"
		) {
			return;
		}

		if (turnRef.current.retry !== null) {
			return;
		}

		clearSubmitPending();
	}, [clearSubmitPending, status, turnRef]);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	useEffect(() => {
		isStreamingRef.current = isStreaming;
		if (!isStreaming) {
			queueTick();
		}
	}, [isStreaming, queueTick]);

	// Watch for the data-turn-complete sentinel on the last assistant message.
	// This fires when the backend has finished all post-stream work (suggestions,
	// orchestrator log, etc.) and signals it is safe to advance the queue.
	// Only accept a sentinel that belongs to the active prompt to avoid picking
	// up a stale signal from a previous turn.
	useEffect(() => {
		const { activePrompt: turnPrompt, turnCompleteSeen } = turnRef.current;
		if (!turnPrompt || turnCompleteSeen) {
			return;
		}

		if (hasTurnCompleteForActivePrompt(rawUiMessages, turnPrompt)) {
			dispatchTurn({ type: "turnCompleteSeen" });
			queueTick();
		}
	}, [dispatchTurn, rawUiMessages, queueTick, turnRef]);

	const { isMediaGenerating, isMediaGeneratingRef, clearMediaGenerating } = useRovoChatMediaGeneration(rawUiMessages, activePrompt?.id ?? null, queueTick);

	// The provider-owned facts the turn machine's guards read alongside its own state.
	const readTurnEnvironment = useCallback((): RovoChatTurnEnvironment => ({
		isStreaming: isStreamingRef.current,
		isMediaGenerating: isMediaGeneratingRef.current,
		isCancelling: isCancellingRef.current,
		retryScheduled: turnRef.current.retry !== null,
	}), [isMediaGeneratingRef, turnRef]);

	const uiMessages = useMemo(() => {
		const messagesWithTurnErrors = insertTurnErrors(rawUiMessages, turnErrors);
		if (!submissionErrorMessage) {
			return messagesWithTurnErrors;
		}

		const hasErrorMessage = messagesWithTurnErrors.some(
			(message) => message.id === submissionErrorMessage.id
		);
		if (hasErrorMessage) {
			return messagesWithTurnErrors;
		}

		return [...messagesWithTurnErrors, submissionErrorMessage];
	}, [rawUiMessages, submissionErrorMessage, turnErrors]);

	useEffect(() => {
		suggestionsAbortControllerRef.current?.abort();
		suggestionsAbortControllerRef.current = null;
		requestedSuggestionMessageIds.clear();
	}, [activeThreadId, requestedSuggestionMessageIds]);

	// oxlint-disable react-doctor/exhaustive-deps -- Unmount cleanup intentionally aborts whichever suggestion request is currently active.
	useEffect(() => {
		return () => {
			suggestionsAbortControllerRef.current?.abort();
			suggestionsAbortControllerRef.current = null;
		};
	}, []);
	// oxlint-enable react-doctor/exhaustive-deps

	// oxlint-disable react-doctor/no-event-handler -- Suggested questions are an async bridge from completed chat state to a backend fetch, not a user event.
	useEffect(() => {
		const shouldSuppressSuggestionFetch =
			isStreaming ||
			isSubmitPending ||
			isMediaGenerating ||
			activePrompt !== null ||
			queuedPrompts.length > 0;

		if (shouldSuppressSuggestionFetch) {
			suggestionsAbortControllerRef.current?.abort();
			suggestionsAbortControllerRef.current = null;
			return;
		}

		const suggestionRequest = buildNextSuggestedQuestionsRequest(
			rawUiMessages,
			requestedSuggestionMessageIds
		);
		if (!suggestionRequest) {
			return;
		}

		suggestionsAbortControllerRef.current?.abort();
		const abortController = new AbortController();
		suggestionsAbortControllerRef.current = abortController;
		requestedSuggestionMessageIds.add(suggestionRequest.assistantMessageId);
		const threadIdAtRequest = activeThreadIdRef.current;

		void fetchRovoAppSuggestedQuestions({
			...suggestionRequest,
			signal: abortController.signal,
		})
			.then((questions) => {
				if (questions.length === 0) {
					return;
				}

				if (activeThreadIdRef.current !== threadIdAtRequest) {
					return;
				}

				setMessages((currentMessages) =>
					appendSuggestedQuestionsToAssistantMessage(
						sanitizeRovoUiMessages(currentMessages),
						suggestionRequest.assistantMessageId,
						questions
					)
				);
			})
			.catch((error) => {
				requestedSuggestionMessageIds.delete(suggestionRequest.assistantMessageId);
				if (abortController.signal.aborted) {
					return;
				}
				console.warn("[RovoChatProvider] Failed to fetch suggested questions:", error);
			})
			.finally(() => {
				if (suggestionsAbortControllerRef.current === abortController) {
					suggestionsAbortControllerRef.current = null;
				}
			});
	}, [
		activePrompt,
		activeThreadId,
		isMediaGenerating,
		isStreaming,
		isSubmitPending,
		queuedPrompts.length,
		rawUiMessages,
		requestedSuggestionMessageIds,
		setMessages,
	]);
	// oxlint-enable react-doctor/no-event-handler

	const toggleChat = useCallback(
		() => updateChatSurface((previous) => (previous === "sidebar" ? null : "sidebar")),
		[updateChatSurface]
	);
	const closeChat = useCallback(() => updateChatSurface(null), [updateChatSurface]);
	const openChat = useCallback((surface: ChatSurface) => updateChatSurface(surface), [updateChatSurface]);
	const switchSurface = useCallback(
		(surface: ChatSurface) => updateChatSurface(surface),
		[updateChatSurface]
	);

	const [floatingPinReasons, setFloatingPinReasons] = useState<ReadonlySet<string>>(
		() => new Set()
	);
	const floatingPinReasonsRef = useLatestRef(floatingPinReasons);
	const isFloatingPinned = floatingPinReasons.size > 0;
	// Surface to restore once the last pin releases. Captured on first pin only.
	const surfaceBeforePinRef = useRef<ChatSurface | null>(null);

	const pinFloating = useCallback((reason: string) => {
		const previous = floatingPinReasonsRef.current;
		if (previous.has(reason)) return;
		if (previous.size === 0) {
			const currentSurface = chatSurfaceRef.current;
			surfaceBeforePinRef.current = currentSurface;
			if (currentSurface === "sidebar") updateChatSurface("floating");
		}
		const next = new Set(previous);
		next.add(reason);
		floatingPinReasonsRef.current = next;
		setFloatingPinReasons(next);
	}, [chatSurfaceRef, floatingPinReasonsRef, updateChatSurface]);

	const unpinFloating = useCallback((reason: string) => {
		const previous = floatingPinReasonsRef.current;
		if (!previous.has(reason)) return;
		const next = new Set(previous);
		next.delete(reason);
		floatingPinReasonsRef.current = next;
		setFloatingPinReasons(next);
		if (next.size === 0) {
			const restored = surfaceBeforePinRef.current;
			surfaceBeforePinRef.current = null;
			if (chatSurfaceRef.current !== null && restored === "sidebar") {
				updateChatSurface("sidebar");
			}
		}
	}, [chatSurfaceRef, floatingPinReasonsRef, updateChatSurface]);

	const clearSuggestedQuestions = useCallback(() => {
		setMessages((prev) =>
			sanitizeRovoUiMessages(prev).map((message) => {
				if (message.role !== "assistant") {
					return message;
				}

				return {
					...message,
					parts: message.parts.filter(
						(part) => part.type !== "data-suggested-questions"
					),
				};
			})
		);
	}, [setMessages]);

	useEffect(() => {
		activeThreadIdRef.current = activeThreadId;
	}, [activeThreadId]);

	const currentThread = useMemo(
		() => threads.find((thread) => thread.id === activeThreadId) ?? null,
		[activeThreadId, threads]
	);
	const currentThreadHasRichState = useMemo(
		() =>
			hasRichCompactThreadState(currentThread) ||
			hasRichCompactMessageState(rawUiMessages),
		[currentThread, rawUiMessages]
	);

	const refreshThreads = useCallback(async (transitionToken?: RovoChatTransitionToken) => {
		try {
			const nextThreads = await listRovoAppThreads(COMPACT_HISTORY_LIMIT);
			if (transitionToken && !isCurrentTransition(transitionToken)) {
				return;
			}
			setThreads(nextThreads);
			setThreadsLoaded(true);
		} catch (error) {
			if (transitionToken && !isCurrentTransition(transitionToken)) {
				return;
			}
			console.warn("[RovoChatProvider] Failed to refresh Rovo thread history:", error);
			setThreadsLoaded(true);
		}
	}, [isCurrentTransition]);

	useEffect(() => {
		const wasStreaming = wasStreamingRef.current;
		wasStreamingRef.current = isStreaming;

		if (!activeThreadIdRef.current || wasStreaming === isStreaming) {
			return;
		}

		void refreshThreads();
	}, [isStreaming, refreshThreads]);

	const openHistory = useCallback(() => {
		setIsHistoryOpen(true);
	}, []);

	const closeHistory = useCallback(() => setIsHistoryOpen(false), []);

	const toggleHistory = useCallback(() => {
		setIsHistoryOpen((previousOpen) => !previousOpen);
	}, []);

	useEffect(() => {
		if (isHistoryOpen) {
			void refreshThreads();
		}
	}, [isHistoryOpen, refreshThreads]);

	useEffect(() => {
		const handleFocus = () => {
			if (isHistoryOpen) {
				void refreshThreads();
			}
		};

		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, [isHistoryOpen, refreshThreads]);

	const persistGeneratedThreadTitle = useCallback(
		async (threadId: string, prompt: string) => {
			const generatedTitle = await fetchRovoAppAITitle(prompt);
			if (!generatedTitle || activeThreadIdRef.current !== threadId) {
				return;
			}

			const updatedThread = await updateRovoAppThread(threadId, {
				title: generatedTitle,
			});
			setThreads((previousThreads) => {
				const existingIndex = previousThreads.findIndex((thread) => thread.id === updatedThread.id);
				if (existingIndex === -1) {
					return [updatedThread, ...previousThreads];
				}

				const nextThreads = [...previousThreads];
				nextThreads[existingIndex] = updatedThread;
				return nextThreads;
			});
		},
		[]
	);

	const ensureCompactThread = useCallback(
		async (seedPrompt: string, signal?: AbortSignal) => {
			signal?.throwIfAborted();
			if (activeThreadIdRef.current) {
				return activeThreadIdRef.current;
			}

			if (pendingThreadCreationRef.current) {
				return pendingThreadCreationRef.current;
			}

			const threadId = createRovoAppId();
			const clearPendingCreation = () => {
				if (pendingThreadCreationRef.current === threadCreationPromise) pendingThreadCreationRef.current = null;
			};
			const threadCreationPromise = createRovoAppThread({
				id: threadId,
				title: deriveCompactThreadTitle(seedPrompt),
				messages: [],
				realtimeMessages: [],
				visibility: "private",
				activeDocumentId: null,
				signal,
			})
				.then((thread) => {
					if (signal?.aborted || pendingThreadCreationRef.current !== threadCreationPromise) {
						throw new DOMException("Thread creation superseded", "AbortError");
					}
					activeThreadIdRef.current = thread.id;
					setActiveThreadId(thread.id);
					setThreads((previousThreads) => [thread, ...previousThreads.filter((item) => item.id !== thread.id)]);
					lastPersistedThreadKeyRef.current = buildCompactThreadPersistKey(thread.id, thread.messages);
					void persistGeneratedThreadTitle(thread.id, seedPrompt).catch((error) => {
						console.warn("[RovoChatProvider] Failed to generate compact chat title:", error);
					});
					return thread.id;
				})
				.finally(() => {
					signal?.removeEventListener("abort", clearPendingCreation);
					clearPendingCreation();
				});

			pendingThreadCreationRef.current = threadCreationPromise;
			signal?.addEventListener("abort", clearPendingCreation, { once: true });
			if (signal?.aborted) clearPendingCreation();
			return threadCreationPromise;
		},
		[persistGeneratedThreadTitle]
	);

	useEffect(() => {
		if (!activeThreadId || rawUiMessages.length === 0) {
			return;
		}

		const sanitizedMessages = sanitizeRovoUiMessages(rawUiMessages);
		const persistKey = buildCompactThreadPersistKey(activeThreadId, sanitizedMessages);
		if (persistKey === lastPersistedThreadKeyRef.current) {
			return;
		}

		const timeout = window.setTimeout(() => {
			void updateRovoAppThread(activeThreadId, {
				messages: sanitizedMessages,
			})
				.then((updatedThread) => {
					lastPersistedThreadKeyRef.current = buildCompactThreadPersistKey(
						updatedThread.id,
						updatedThread.messages
					);
					setThreads((previousThreads) => {
						const nextThreads = previousThreads.filter((thread) => thread.id !== updatedThread.id);
						return [updatedThread, ...nextThreads];
					});
				})
				.catch((error) => {
					console.warn("[RovoChatProvider] Failed to persist compact chat messages:", error);
				});
		}, COMPACT_THREAD_PERSIST_DEBOUNCE_MS);

		return () => window.clearTimeout(timeout);
	}, [activeThreadId, rawUiMessages]);

	const sendChatMessage = useCallback(
		async (promptItem: QueuedPromptItem) => {
			const attempt = turnRef.current.sendAttempt;
			await sendForTranscript({ turnRef, waitForTurn },
				(state) => state.sendAttempt === attempt && state.activePrompt?.id === promptItem.id,
				[() => ensureCompactThread(promptItem.text || promptItem.files[0]?.filename || "New chat")], async () => {
					setSubmissionErrorMessage(null);
					dispatchTurn({ type: "requestStarted" });
					void refreshThreads();
					try {
						await sendWithPartStateRecovery(
							{ files: promptItem.files, text: promptItem.text, metadata: getPromptMessageMetadata(promptItem) },
							{ body: buildSendMessageBody(promptItem.options, turnRef.current.queue.length > 0) },
						);
					} finally {
						void refreshThreads();
					}
				});
		},
		[dispatchTurn, ensureCompactThread, refreshThreads, sendWithPartStateRecovery, turnRef, waitForTurn]
	);

	const ensureThreadForLocalTurn = useCallback(
		async (seedPrompt: string, signal?: AbortSignal) => {
			const threadId = await ensureCompactThread(seedPrompt, signal);
			void refreshThreads();
			return threadId;
		},
		[ensureCompactThread, refreshThreads]
	);

	useEffect(() => {
		sendChatMessageRef.current = sendChatMessage;
	}, [sendChatMessage]);

	const finalizeActivePrompt = useCallback(() => {
		if (!turnRef.current.activePrompt) {
			return;
		}

		const cutShortNotice = findCutShortNotice(turnRef.current);
		if (cutShortNotice) {
			errorCounterRef.current += 1;
			recordTurnError({
				anchorMessageId: cutShortNotice.anchorMessageId,
				message: createAssistantTextMessage(`error-${errorCounterRef.current}`, getIncompleteTurnUserMessage()),
			});
		}
		dispatchTurn({ type: "finalize" });
		clearMediaGenerating();
	}, [clearMediaGenerating, dispatchTurn, recordTurnError, turnRef]);

	const maybeFinalizeAndProcess = useCallback(() => {
		if (canFinalizeActivePrompt(turnRef.current, readTurnEnvironment())) {
			finalizeActivePrompt();
		}

		if (!turnRef.current.activePrompt && !isCancellingRef.current) {
			void processNextPromptRef.current();
		}
	}, [finalizeActivePrompt, readTurnEnvironment, turnRef]);

	useEffect(() => {
		maybeFinalizeAndProcessRef.current = maybeFinalizeAndProcess;
	}, [maybeFinalizeAndProcess]);

	const processNextPrompt = useCallback(async () => {
		if (!canDispatchNextPrompt(turnRef.current, readTurnEnvironment())) {
			return;
		}

		const nextPrompt = turnRef.current.queue[0];
		dispatchTurn({ type: "dispatchNext" });
		const attempt = turnRef.current.sendAttempt;
		let failed = false;
		try {
			await sendChatMessageRef.current(nextPrompt);
		} catch (error) {
			failed = true;
			console.error("[RovoChatProvider] Failed to send queued prompt:", error);
		} finally {
			dispatchTurn({ type: "dispatchSettled", attempt, failed });
			if (!isStreamingRef.current && turnRef.current.retry === null) {
				queueTick();
			}
		}
	}, [dispatchTurn, queueTick, readTurnEnvironment, turnRef]);

	useEffect(() => {
		processNextPromptRef.current = processNextPrompt;
	}, [processNextPrompt]);

	// A queue change (submit, dispatch, remove, clear) may let the next prompt go out.
	useEffect(() => {
		queueTick();
	}, [queuedPrompts, queueTick]);

	useEffect(() => {
		if (!isSubmitPendingRef.current || !isTurnWorkIdle(turnRef.current, readTurnEnvironment())) {
			return;
		}

		// oxlint-disable-next-line react-doctor/no-chain-state-updates -- Pending-submit state is split for existing context consumers and cleared atomically here once all async work is idle.
		clearSubmitPending();
	}, [clearSubmitPending, queuedPrompts, readTurnEnvironment, turnRef]);

	const sendPrompt = useCallback(
		async (prompt: string, options?: SendPromptOptions, files: ReadonlyArray<FileUIPart> = []) => {
			const trimmedPrompt = prompt.trim();
			const promptFiles = [...files];
			if (!trimmedPrompt && promptFiles.length === 0) {
				return;
			}
			if (transcriptAbortRef.current) {
				transcriptAbortRef.current.abort();
				pendingThreadCreationRef.current = null;
			}
			const resolvedOptions = resolveWorkItemReportPromptOptions(
				trimmedPrompt,
				mergeSendPromptOptions(
					defaultPromptOptions,
					mergeSelectedAgentPromptOptions(options, selectedAgent)
				)
			);
			if (isClarificationResolutionPrompt(resolvedOptions)) {
				setMessages((prev) =>
					markPendingClarificationResolvedInMessages(prev, resolvedOptions)
				);
			}

			if (!isSubmitPendingRef.current && shouldStartSubmitPendingForTurn(turnRef.current, readTurnEnvironment())) {
				startSubmitPending(Date.now());
			}

			const id = createQueueItemId(queueIdRef.current);
			queueIdRef.current += 1;
			dispatchTurn({
				type: "enqueue",
				prompt: {
					id,
					files: promptFiles,
					text: trimmedPrompt,
					options: resolvedOptions,
					createdAt: Date.now(),
				},
			});
		},
		[defaultPromptOptions, dispatchTurn, readTurnEnvironment, selectedAgent, setMessages, startSubmitPending, turnRef]
	);

	const acceptPlanReview = useCallback(
		async (planWidget: ParsedPlanWidgetPayload) => {
			const deferredToolResponse = buildExitPlanModeDeferredToolResponse(
				planWidget,
				"Accept.",
			);
			if (!deferredToolResponse) {
				throw new Error("The pending plan review is missing a deferred tool call.");
			}

			await sendPrompt("Accepted the plan.", {
				messageMetadata: {
					source: "plan-approval-submit",
					planApprovalDecision: "auto-accept",
					planApprovalPlanKey: getPlanApprovalKeyFromPlanWidget(planWidget) ?? undefined,
				},
				deferredToolResponse,
			});
		},
		[sendPrompt],
	);

	const submitPlanApproval = useCallback(
		async (planWidget: ParsedPlanWidgetPayload, selection: PlanApprovalSelection) => {
			if (selection.decision === "auto-accept") {
				await acceptPlanReview(planWidget);
				return;
			}

			const approvalSubmission = createPlanApprovalSubmission(selection, planWidget);
			await sendPrompt(buildPlanApprovalPrompt(approvalSubmission), {
				messageMetadata: {
					source: "plan-approval-submit",
					planApprovalDecision: selection.decision,
					planApprovalPlanKey: getPlanApprovalKeyFromPlanWidget(planWidget) ?? undefined,
				},
				approval: approvalSubmission,
			});
		},
		[acceptPlanReview, sendPrompt],
	);

	const removeQueuedPrompt = useCallback((id: string) => {
		dispatchTurn({ type: "removeQueued", id });
	}, [dispatchTurn]);

	const clearQueuedPrompts = useCallback(() => {
		dispatchTurn({ type: "clearQueue" });
	}, [dispatchTurn]);

	const waitForStreamStop = useCallback(async () => {
		const startedAt = Date.now();
		while (isStreamingRef.current) {
			if (Date.now() - startedAt > EXPLICIT_CANCEL_GRACE_MS) {
				return false;
			}
			await new Promise<void>((resolve) => {
				window.setTimeout(resolve, 25);
			});
		}
		return true;
	}, []);

	const editMessage = useCallback(
		async (messageId: string, nextText: string, options?: SendPromptOptions) => {
			const trimmedText = nextText.trim();
			if (!trimmedText) {
				return;
			}

			const message = rawUiMessages.find((item) => item.id === messageId);
			if (!message || message.role !== "user") {
				return;
			}

			if (transcriptAbortRef.current) {
				transcriptAbortRef.current.abort();
				pendingThreadCreationRef.current = null;
			}
			const resolvedOptions = resolveWorkItemReportPromptOptions(
				trimmedText,
				mergeSendPromptOptions(
					defaultPromptOptions,
					mergeSelectedAgentPromptOptions(options, selectedAgent)
				)
			);

			setEditingMessageId(null);
			cancelRetryTimer();
			clearMediaGenerating();
			clearSubmitPending();
			setSubmissionErrorMessage(null);
			pendingTurnErrorRef.current = null;
			setTurnErrors((previous) => pruneTurnErrorsFrom(previous, rawUiMessages, messageId));
			dispatchTurn({ type: "editStarted" });
			const editId = turnRef.current.editId;
			const files = message.parts.filter(
				(part): part is FileUIPart => part.type === "file"
			);

			if (!isSubmitPendingRef.current && !isStreamingRef.current) {
				startSubmitPending(Date.now());
			}

			await sendForTranscript({ turnRef, waitForTurn }, (state) => state.editId === editId, [
				async () => {
					if (turnRef.current.dispatching || isStreamingRef.current) await stop();
				},
				waitForStreamStop,
				() => waitForTurn((state) => !state.dispatching || state.editId !== editId),
				() => ensureCompactThread(trimmedText || files[0]?.filename || "New chat"),
			], async () => {
				void refreshThreads();
				dispatchTurn({ type: "editDispatchStarted" });
				const attempt = turnRef.current.sendAttempt;
				try {
					await sendWithPartStateRecovery(
						{ files, text: trimmedText, metadata: getEditResendMetadata(message.metadata), messageId },
						{ body: buildSendMessageBody(resolvedOptions, false) },
					);
				} finally {
					dispatchTurn({ type: "dispatchSettled", attempt, failed: false }); // An edit has no active prompt, so even a thrown send never fails it.
					void refreshThreads();
					queueTick();
				}
			}).finally(() => {
				if (turnRef.current.editId === editId && turnRef.current.editPending) clearSubmitPending();
				dispatchTurn({ type: "editSettled", id: editId });
				queueTick();
			});
		},
		[
			cancelRetryTimer,
			clearMediaGenerating,
			clearSubmitPending,
			defaultPromptOptions,
			dispatchTurn,
			ensureCompactThread,
			queueTick,
			rawUiMessages,
			refreshThreads,
			selectedAgent,
			sendWithPartStateRecovery,
			startSubmitPending,
			stop,
			turnRef,
			waitForStreamStop,
			waitForTurn,
		]
	);

	// `explicitUserCancel` is the user's Stop, which always cancels the backend run
	// (see shouldSendExplicitRovoCancel); other callers escalate only when stop() is slow.
	const cancelCurrentStream = useCallback(async ({ explicitUserCancel = false }: { explicitUserCancel?: boolean } = {}) => {
		// Read before stopping: the run to cancel is the one streaming now, even if
		// a thread switch replaces the active thread while the stop settles.
		const target: RovoCancelTarget = { threadId: activeThreadIdRef.current, portIndex };
		const turnId = explicitUserCancel ? turnRef.current.activePrompt?.id ?? null : null;

		const inFlightCancel = cancelStreamPromiseRef.current;
		if (inFlightCancel) {
			const sentBackendCancel = await inFlightCancel;
			// A Stop that lands during an ordinary cancel (which skipped the backend
			// because stop() settled in time) still has to reach the backend.
			if (explicitUserCancel && !sentBackendCancel) {
				await sendBackendCancel(target, turnId);
			}
			return;
		}

		// Skip cancel if no stream is active — avoids sending HTTP requests to
		// Rovo Serve during startup before the instances are ready.
		if (!isStreamingRef.current) {
			try {
				await stop();
			} catch {}
			return;
		}

		const cancelPromise = (async () => {
			try {
				await stop();
			} catch (error) {
				console.error("[RovoChatProvider] Failed to stop chat stream:", error);
			}

			const stoppedInTime = await waitForStreamStop();

			// Belt-and-suspenders unless the user pressed Stop: cancel only if the
			// req.on("close") → AbortSignal path did not settle within the grace period.
			if (
				!shouldSendExplicitRovoCancel({
					explicitUserCancel,
					hasBackgroundCancelableWork: false,
					hasUseChatTurn: true,
					stopSettledInTime: stoppedInTime,
				})
			) {
				return false;
			}

			return sendBackendCancel(target, turnId);
		})();

		cancelStreamPromiseRef.current = cancelPromise;
		try {
			await cancelPromise;
		} finally {
			cancelStreamPromiseRef.current = null;
		}
	}, [portIndex, sendBackendCancel, stop, turnRef, waitForStreamStop]);

	// Ends the turn of a request being stopped: by the user, or by a thread change that may be superseded.
	const endStoppedTurn = useCallback(() => {
		dispatchTurn({ type: "stopRequested" });
		setSubmissionErrorMessage(null);
		clearMediaGenerating();
		clearSubmitPending();
	}, [clearMediaGenerating, clearSubmitPending, dispatchTurn]);

	const stopStreaming = useCallback(async () => {
		const transitionToken = beginTransition("stop-streaming");
		endStoppedTurn();
		isCancellingRef.current = true;
		try {
			await cancelCurrentStream({ explicitUserCancel: true });
		} finally {
			if (!finishTransition(transitionToken)) return;
			if (hasCancellationOwner()) {
				syncTransitionCancellation();
				return;
			}
			isCancellingRef.current = false;
			void refreshThreads();
			queueTick();
		}
	}, [
		beginTransition,
		finishTransition,
		cancelCurrentStream,
		endStoppedTurn,
		queueTick,
		refreshThreads,
		hasCancellationOwner,
		syncTransitionCancellation,
	]);

	// Ends the departing transcript's turn work (active turn and its cut-short wait, queue, retry,
	// media hold, errors) at a thread change's commit point, as the transcript is replaced or dropped.
	const resetTranscriptPending = useCallback(() => {
		cancelRetryTimer();
		clearMediaGenerating();
		clearSubmitPending();
		dispatchTurn({ type: "reset" });
		clearChatErrors();
	}, [cancelRetryTimer, clearChatErrors, clearMediaGenerating, clearSubmitPending, dispatchTurn]);

	// The stop phase of a thread change; it never resets the turn. See stopDepartingRequest.
	const stopRequestForThreadChange = useCallback(() => stopDepartingRequest({
		threadId: activeThreadIdRef.current,
		isSendInFlight: () => isStreamingRef.current || hasSendInFlight(turnRef.current),
		isRequestLive: () => hasLiveRequest(turnRef.current, readTurnEnvironment()),
		endStoppedTurn,
		stopRequest: stop,
		waitForStreamStop,
		detachRun: detachRovoAppRun,
	}), [endStoppedTurn, readTurnEnvironment, stop, turnRef, waitForStreamStop]);

	const selectThread = useCallback(
		async (threadId: string) => {
			const transitionToken = beginTransition("select-thread");
			try {
				// The thread already shown keeps its turn; the transition only supersedes a pending selection.
				if (threadId === activeThreadIdRef.current) {
					setIsHistoryOpen(false);
					return;
				}
				// Fetch before ending anything: a selection that fails or is superseded keeps the current turn.
				const thread = await getRovoAppThread(threadId);
				if (!isCurrentTransition(transitionToken)) {
					return;
				}
				await stopRequestForThreadChange();
				// Commit point: no await from this check to the new transcript, so every later prompt belongs to it.
				if (!isCurrentTransition(transitionToken)) {
					return;
				}
				resetTranscriptPending();
				if (!thread) {
					activeThreadIdRef.current = null;
					setActiveThreadId(null);
					setMessages([]);
					await refreshThreads(transitionToken);
					return;
				}

				activeThreadIdRef.current = thread.id;
				setActiveThreadId(thread.id);
				lastPersistedThreadKeyRef.current = buildCompactThreadPersistKey(thread.id, thread.messages);
				setThreads((previousThreads) => [thread, ...previousThreads.filter((item) => item.id !== thread.id)]);
				setMessages(sanitizeRovoUiMessages(thread.messages));
				setIsHistoryOpen(false);
			} finally {
				if (finishTransition(transitionToken)) {
					queueTick();
				}
			}
		},
		[
			beginTransition,
			finishTransition,
			isCurrentTransition,
			queueTick,
			refreshThreads,
			resetTranscriptPending,
			setMessages,
			stopRequestForThreadChange,
		]
	);

	const deleteThread = useCallback(
		async (threadId: string) => {
			const transitionToken = beginTransition("delete-thread");
			try {
				if (threadId === activeThreadIdRef.current) {
					await stopRequestForThreadChange();
					// Commit point, as in selectThread.
					if (isCurrentTransition(transitionToken)) {
						resetTranscriptPending();
						activeThreadIdRef.current = null;
						setActiveThreadId(null);
						setMessages([]);
						lastPersistedThreadKeyRef.current = "";
					}
				}

				await deleteRovoAppThread(threadId);
				if (!isCurrentTransition(transitionToken)) {
					return;
				}
				setThreads((previousThreads) => previousThreads.filter((thread) => thread.id !== threadId));
				await refreshThreads(transitionToken);
			} finally {
				if (finishTransition(transitionToken)) {
					queueTick();
				}
			}
		},
		[beginTransition, finishTransition, isCurrentTransition, queueTick, refreshThreads, resetTranscriptPending, setMessages, stopRequestForThreadChange]
	);

	const deleteAllThreads = useCallback(async () => {
		const transitionToken = beginTransition("delete-all-threads");
		// Reads what is in flight before the reset below clears it, so that request is still stopped.
		const departed = stopRequestForThreadChange();
		resetTranscriptPending();
		setMessages([]);

		try {
			await departed;
			if (isCurrentTransition(transitionToken)) {
				activeThreadIdRef.current = null;
				setActiveThreadId(null);
				lastPersistedThreadKeyRef.current = "";
				setThreads([]);
				setThreadsLoaded(true);
			}
			await deleteAllRovoAppThreads();
			if (isCurrentTransition(transitionToken)) {
				await refreshThreads(transitionToken);
			}
		} finally {
			if (finishTransition(transitionToken)) {
				queueTick();
			}
		}
	}, [beginTransition, finishTransition, isCurrentTransition, queueTick, refreshThreads, resetTranscriptPending, setMessages, stopRequestForThreadChange]);

	const cancelThreadRun = useCallback(
		async (threadId: string) => {
			await cancelRovoAppRun(threadId).catch(() => {});
			if (threadId === activeThreadIdRef.current) {
				try {
					await stop();
				} catch {}
			}
			await refreshThreads();
		},
		[refreshThreads, stop]
	);

	const openCurrentThreadFullscreen = useCallback(() => {
		const threadId = activeThreadIdRef.current;
		if (!threadId || typeof window === "undefined") {
			return;
		}

		window.location.assign(`/rovo/${encodeURIComponent(threadId)}`);
	}, []);

	const resetChat = useCallback(() => {
		const transitionToken = beginTransition("reset-chat");
		const departed = stopRequestForThreadChange(); // Before the reset, as in deleteAllThreads.
		resetTranscriptPending();
		setMessages([]);

		void departed.finally(() => {
			if (!finishTransition(transitionToken)) {
				return;
			}
			// Old stream chunks can still arrive briefly while cancellation settles.
			// Clear message state one more time so the next session starts clean.
			activeThreadIdRef.current = null;
			setActiveThreadId(null);
			lastPersistedThreadKeyRef.current = "";
			setMessages([]);
			clearChatErrors();
			void refreshThreads(transitionToken);
			queueTick();
		});
	}, [beginTransition, clearChatErrors, finishTransition, queueTick, refreshThreads, resetTranscriptPending, setMessages, stopRequestForThreadChange]);

	const selectAgent = useCallback((agentId: string, options?: SelectAgentOptions) => {
		const nextAgent = agentProfileById.get(agentId) ?? getRovoAgentProfile(agentId);
		// Selecting an agent must not reorder the recent-agents nav list. That list
		// is sorted by `lastTouchedAt` desc, so bumping the timestamp here would pin
		// the clicked agent to the top. Leave `lastTouchedAt` untouched on select —
		// only create/edit/test/publish bump it. The selected row is reflected via
		// `selectedAgentId` (its highlighted state), independent of list order.
		if (nextAgent.id === selectedAgentIdRef.current) {
			return;
		}

		setSelectedAgentIdState(nextAgent.id);
		if (!options?.preserveCurrentThread) {
			resetChat();
		}
	}, [agentProfileById, resetChat, setSelectedAgentIdState]);

	const registerCreatedAgentFromResult = useCallback(
		(
			agentResult: RovoDataParts["agent-result"],
			options?: RegisterCreatedAgentOptions
		) => {
			const result = registerSessionAgentFromResult({
				agentResult,
				entries: sessionAgentEntriesRef.current,
				sourceKey: options?.sourceKey,
				staticAgentProfiles,
			});
			const entry = applySessionAgentMutation(result, {
				silentSave: result.created && options?.silentSave,
			});
			if (!entry) {
				return null;
			}

			if (options?.select && entry.profile.id !== selectedAgentIdRef.current) {
				setSelectedAgentIdState(entry.profile.id);
				if (!options.preserveCurrentThread) {
					resetChat();
				}
			}

			return entry.profile;
		},
		[applySessionAgentMutation, resetChat, setSelectedAgentIdState, staticAgentProfiles]
	);

	const getSessionAgentEntry = useCallback((profileId: string): SessionAgentEntry | null => {
		return getSessionAgentEntryByProfileId(sessionAgentEntriesRef.current, profileId);
	}, []);

	const updateSessionAgentDraft = useCallback(
		(profileId: string, patch: Partial<RovoDataParts["agent-result"]>): SessionAgentEntry | null => {
			return applySessionAgentMutation(updateSessionAgentDraftEntry({
				entries: sessionAgentEntriesRef.current,
				patch,
				profileId,
			}));
		},
		[applySessionAgentMutation]
	);

	const commitSessionAgentPublishReady = useCallback(
		(profileId: string): SessionAgentEntry | null => {
			return applySessionAgentMutation(commitSessionAgentPublishReadyEntry(
				sessionAgentEntriesRef.current,
				profileId,
			));
		},
		[applySessionAgentMutation]
	);

	const publishSessionAgent = useCallback(
		(profileId: string): SessionAgentEntry | null => {
			return applySessionAgentMutation(publishSessionAgentEntry({
				entries: sessionAgentEntriesRef.current,
				profileId,
			}));
		},
		[applySessionAgentMutation]
	);

	const restoreSessionAgentVersion = useCallback(
		(profileId: string, versionId: string): SessionAgentEntry | null => {
			return applySessionAgentMutation(restoreSessionAgentVersionEntry({
				entries: sessionAgentEntriesRef.current,
				profileId,
				versionId,
			}));
		},
		[applySessionAgentMutation]
	);

	const resetAgentToRovo = useCallback((options?: { preserveCurrentThread?: boolean }) => {
		if (selectedAgentIdRef.current === ROVO_AGENT_ID) {
			return;
		}

		setSelectedAgentIdState(ROVO_AGENT_ID);
		// Callers that want Ask Rovo to keep talking to the default Rovo agent
		// WITHOUT discarding the current transcript (e.g. the studio
		// agent-creation flow, which leaves the generation conversation visible
		// in the Ask Rovo panel) pass preserveCurrentThread.
		if (!options?.preserveCurrentThread) {
			resetChat();
		}
	}, [resetChat, setSelectedAgentIdState]);

	const removeSessionAgent = useCallback((profileId: string) => {
		const result = removeSessionAgentEntry(sessionAgentEntriesRef.current, profileId);
		if (!result.changed) {
			return;
		}

		dispatchSessionAgentSave({ type: "changed", silent: false });
		commitSessionAgentEntries(result.entries);

		// Deleting the agent that is currently driving the chat would otherwise
		// leave the surface pointed at a profile that no longer exists, so fall
		// back to the default Rovo agent (which also clears the thread).
		if (selectedAgentIdRef.current === profileId) {
			setSelectedAgentIdState(ROVO_AGENT_ID);
			resetChat();
		}
	}, [commitSessionAgentEntries, resetChat, setSelectedAgentIdState]);

	const transcriptOwner = useMemo<RovoChatTranscriptOwner>(() => ({
		begin: (kind) => {
			const token = beginTransition(kind);
			const controller = new AbortController();
			transcriptAbortRef.current = controller;
			return { token, signal: controller.signal };
		},
		isCurrent: isCurrentTransition,
		finish: (token) => {
			if (finishTransition(token)) {
				transcriptAbortRef.current = null;
				queueTick();
			}
		},
		stop: () => cancelCurrentStream(),
		ensureThread: ensureThreadForLocalTurn,
		readMessages: () => rawUiMessagesRef.current,
		resetPending: resetTranscriptPending,
		writeMessages: (messages) => {
			const sanitized = sanitizeRovoUiMessages([...messages]);
			rawUiMessagesRef.current = sanitized;
			setMessages(sanitized);
		},
		writeSnapshot: ({ messages, threadId, markPersisted = true }) => {
			// A snapshot replaces the transcript, so errors from the old one go too.
			clearChatErrors();
			const sanitized = sanitizeRovoUiMessages([...messages]);
			rawUiMessagesRef.current = sanitized;
			activeThreadIdRef.current = threadId;
			setActiveThreadId(threadId);
			lastPersistedThreadKeyRef.current = markPersisted && threadId ? buildCompactThreadPersistKey(threadId, sanitized) : "";
			setMessages(sanitized);
		},
		selectAgent: (agentId) => selectAgent(agentId, { preserveCurrentThread: true }),
	}), [beginTransition, clearChatErrors, isCurrentTransition, finishTransition, queueTick, cancelCurrentStream, ensureThreadForLocalTurn, rawUiMessagesRef, resetTranscriptPending, setMessages, selectAgent]);
	const transcript = useRovoChatTranscript(transcriptOwner);
	const { activateSession, applyLocalTurn } = transcript;

	const queueCount = queuedPrompts.length;
	const hasInFlightTurn =
		isSubmitPending ||
		isStreaming ||
		isMediaGenerating ||
		activePrompt !== null;

	const contextValue = useMemo(
		() => ({
			selectedAgentId,
			selectedAgent,
			selectableAgents,
			isCustomAgentSelected,
			selectAgent,
			registerCreatedAgentFromResult,
			sessionAgentEntries: normalizedSessionAgentEntries,
			getSessionAgentEntry,
			updateSessionAgentDraft,
			commitSessionAgentPublishReady,
			publishSessionAgent,
			restoreSessionAgentVersion,
			removeSessionAgent,
			sessionAgentSaveStatus,
			sessionAgentSavedAt,
			resetAgentToRovo,
			chatSurface,
			openChat,
			switchSurface,
			isOpen,
			toggleChat,
			closeChat,
			isFloatingPinned,
			pinFloating,
			unpinFloating,
			uiMessages,
			sendPrompt,
			acceptPlanReview,
			submitPlanApproval,
			editMessage,
			editingMessageId,
			setEditingMessageId,
			stopStreaming,
			clearSuggestedQuestions,
			resetChat,
			activeThreadId,
			currentThread,
			threads,
			threadsLoaded,
			isHistoryOpen,
			openHistory,
			closeHistory,
			toggleHistory,
			refreshThreads,
			selectThread,
			deleteThread,
			deleteAllThreads,
			cancelThreadRun,
			openCurrentThreadFullscreen,
			currentThreadHasRichState,
			activateSession,
			applyLocalTurn,
			isStreaming,
			isMediaGenerating,
			hasInFlightTurn,
			isSubmitPending,
			pendingSubmitStartedAt,
			pendingPrompt,
			setPendingPrompt,
			queuedPrompts,
			activePrompt,
			removeQueuedPrompt,
			clearQueuedPrompts,
			queueCount,
		}),
		[
			selectedAgentId,
			selectedAgent,
			selectableAgents,
			isCustomAgentSelected,
			selectAgent,
			registerCreatedAgentFromResult,
			normalizedSessionAgentEntries,
			getSessionAgentEntry,
			updateSessionAgentDraft,
			commitSessionAgentPublishReady,
			publishSessionAgent,
			restoreSessionAgentVersion,
			removeSessionAgent,
			sessionAgentSaveStatus,
			sessionAgentSavedAt,
			resetAgentToRovo,
			chatSurface,
			openChat,
			switchSurface,
			isOpen,
			toggleChat,
			closeChat,
			isFloatingPinned,
			pinFloating,
			unpinFloating,
			uiMessages,
			sendPrompt,
			acceptPlanReview,
			submitPlanApproval,
			editMessage,
			editingMessageId,
			stopStreaming,
			clearSuggestedQuestions,
			resetChat,
			activeThreadId,
			currentThread,
			threads,
			threadsLoaded,
			isHistoryOpen,
			openHistory,
			closeHistory,
			toggleHistory,
			refreshThreads,
			selectThread,
			deleteThread,
			deleteAllThreads,
			cancelThreadRun,
			openCurrentThreadFullscreen,
			currentThreadHasRichState,
			activateSession,
			applyLocalTurn,
			isStreaming,
			isMediaGenerating,
			hasInFlightTurn,
			isSubmitPending,
			pendingSubmitStartedAt,
			pendingPrompt,
			queuedPrompts,
			activePrompt,
			removeQueuedPrompt,
			clearQueuedPrompts,
			queueCount,
		],
	);

	return (
		<RovoChatControlsProvider value={contextValue}>
			<RovoChatContext value={contextValue}>
				{children}
			</RovoChatContext>
		</RovoChatControlsProvider>
	);
}

export function useRovoChat() {
	const context = use(RovoChatContext);
	if (context === undefined) {
		throw new Error("useRovoChat must be used within a RovoChatProvider");
	}
	return context;
}

/**
 * The chat context when there is one, `null` otherwise. For shared components
 * that only reach for chat on one branch of their API — a list whose composer
 * variant sends a prompt — and are otherwise renderable on a route that never
 * mounts a provider. Anything that genuinely needs chat uses {@link useRovoChat}.
 */
export function useOptionalRovoChat() {
	return use(RovoChatContext) ?? null;
}

export { useRovoSelectedAgent } from "@/app/contexts/use-rovo-selected-agent";
