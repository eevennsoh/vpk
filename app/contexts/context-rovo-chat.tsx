"use client";

import { useLazyRef } from "@/lib/use-lazy-ref";
import { createRovoChatTranscript, type RovoSessionSnapshot, type RovoLocalTurn } from "@/app/contexts/rovo-chat-transcript";
import { type RovoChatTransitionKind } from "@/app/contexts/rovo-chat-transition-coordinator";
import { useLatestRef } from "@/lib/use-latest-ref";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type SetStateAction,
} from "react";
import { useChat } from "@ai-sdk/react";
import { API_ENDPOINTS } from "@/lib/api-config";
import {
	createAssistantTextMessage,
	type RovoDataParts,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import { shouldSendExplicitRovoCancel } from "@/lib/rovo-cancel-strategy";
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
	buildSendMessageBody, clearSkillInvocationForEdit,
	createAssistantThinkingStatusMessage,
	createQueueItemId,
	deriveCompactThreadTitle,
	didAssistantCompleteActivePrompt,
	getPayloadTooLargeUserMessage,
	hasRichCompactMessageState,
	hasRichCompactThreadState,
	hasTurnCompleteForPrompt,
	isClarificationResolutionPrompt,
	isInvalidPartStateError,
	isPayloadTooLargeError,
	markPendingClarificationResolvedInMessages,
	mergeSelectedAgentPromptOptions,
	mergeSendPromptOptions,
	resolveWorkItemReportPromptOptions,
	sanitizeMessagesForTransport,
	sanitizeRovoUiMessages,
	sanitizeValueForTransport,
	toUserFacingChatErrorMessage,
	trimMessagesForRequestSize,
	type QueuedPromptItem,
	type SendPromptOptions,
} from "@/app/contexts/rovo-chat-helpers";
import {
	type RovoChatTransitionToken,
} from "@/app/contexts/rovo-chat-transition-coordinator";
import { RovoChatControlsProvider } from "@/app/contexts/context-rovo-chat-controls";
import { useRovoChatTransitionCoordinator } from "@/app/contexts/use-rovo-chat-transition-coordinator";
import {
	isRateLimitError,
	isChatInProgressError,
	getRateLimitRetryCountdownMessage,
	getRateLimitUserMessage,
	RATE_LIMIT_MAX_RETRIES,
	RATE_LIMIT_RETRY_DELAY_MS,
	CHAT_IN_PROGRESS_MAX_RETRIES,
	CHAT_IN_PROGRESS_RETRY_DELAY_MS,
	getChatInProgressRetryCountdownLabel,
	getChatInProgressRetryContent,
	getChatInProgressUserMessage,
} from "@/lib/chat-error-utils";
import { DefaultChatTransport, type FileUIPart } from "ai";

export type {
	StudioAgentPublishStatus,
	StudioAgentVersionRecord,
	StudioSessionAgentEntry,
} from "@/components/projects/rovo-core/lib/agent-records/types";
export type { StudioSessionAgentSaveStatus } from "@/components/projects/rovo-core/lib/agent-records/session-agent-registry";
export type { QueuedPromptItem, SendPromptOptions } from "@/app/contexts/rovo-chat-helpers";

const EXPLICIT_CANCEL_DEBOUNCE_MS = 2_000;
const EXPLICIT_CANCEL_GRACE_MS = 1_200;
const MEDIA_GENERATION_TIMEOUT_MS = 120_000;
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
	const [submissionErrorMessage, setSubmissionErrorMessage] =
		useState<RovoUIMessage | null>(null);
	const [queuedPrompts, setQueuedPrompts] = useState<QueuedPromptItem[]>([]);
	const [activePrompt, setActivePrompt] = useState<QueuedPromptItem | null>(null);
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const [threads, setThreads] = useState<RovoAppThread[]>([]);
	const [threadsLoaded, setThreadsLoaded] = useState(false);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [sessionAgentEntries, setSessionAgentEntries] = useState<SessionAgentEntry[]>([]);
	const [sessionAgentSaveStatus, setSessionAgentSaveStatus] = useState<StudioSessionAgentSaveStatus>("idle");
	const [sessionAgentSavedAt, setSessionAgentSavedAt] = useState<number | null>(null);
	const hasRehydratedPublishedAgentsRef = useRef(false);
	const lastSeenSessionAgentEntriesRef = useRef<SessionAgentEntry[] | null>(null);

	const errorCounterRef = useRef(0);
	const queueIdRef = useRef(0);
	const queuedPromptsRef = useRef<QueuedPromptItem[]>([]);
	const activePromptRef = useRef<QueuedPromptItem | null>(null);
	const activeThreadIdRef = useRef<string | null>(null);
	const pendingThreadCreationRef = useRef<Promise<string> | null>(null);
	const lastPersistedThreadKeyRef = useRef("");
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null
	);
	const retryCountRef = useRef(0);
	const lastPromptRef = useRef<{
		files: FileUIPart[];
		text: string;
		options?: SendPromptOptions;
	} | null>(null);
	const isStreamingRef = useRef(false);
	const wasStreamingRef = useRef(false);
	const isDispatchingPromptRef = useRef(false);
	const isCancellingRef = useRef(false);
	const cancelStreamPromiseRef = useRef<Promise<void> | null>(null);
	const autoSelectedAgentIdRef = useRef<string | null>(null);
	const lastExplicitCancelAtRef = useRef(0);
	const lastExplicitCancelKeyRef = useRef("");
	const isSubmitPendingRef = useRef(false);
	const shouldFinalizeActivePromptRef = useRef(false);
	const hasTurnCompleteSignalRef = useRef(false);
	const isMediaGeneratingRef = useRef(false);
	const mediaGenerationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const suggestionsAbortControllerRef = useRef<AbortController | null>(null);
	const sessionAgentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// When set, the next session-agent persist runs silently (no "Saving…/Saved"
	// indicator). Used for creating a brand-new blank agent, where there is no
	// meaningful content to save yet, so the save progression would be noise.
	const suppressNextSessionAgentSaveStatusRef = useRef(false);
	const sessionAgentEntriesRef = useRef<SessionAgentEntry[]>([]);
	const {
		beginTransition: beginProviderTransition,
		finishTransition,
		hasCancellationOwner,
		isCurrentTransition,
		syncTransitionCancellation,
	} = useRovoChatTransitionCoordinator({ isCancellingRef });
	const transcriptAbortRef = useRef<AbortController | null>(null);
	const beginTransition = useCallback((kind: RovoChatTransitionKind) => {
		transcriptAbortRef.current?.abort();
		pendingThreadCreationRef.current = null;
		return beginProviderTransition(kind);
	}, [beginProviderTransition]);
	useEffect(() => () => {
		transcriptAbortRef.current?.abort();
		pendingThreadCreationRef.current = null;
		const token = beginProviderTransition("destroy");
		finishTransition(token);
	}, [beginProviderTransition, finishTransition]);
	const applySessionAgentMutation = useCallback((
		result: SessionAgentEntryMutationResult,
		options?: { silentSave?: boolean }
	): SessionAgentEntry | null => {
		if (!result.changed) {
			return result.entry;
		}

		sessionAgentEntriesRef.current = result.entries;
		if (options?.silentSave) {
			suppressNextSessionAgentSaveStatusRef.current = true;
		} else {
			setSessionAgentSaveStatus("saving");
		}
		setSessionAgentEntries(result.entries);
		return result.entry;
	}, []);
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
	const [isMediaGenerating, setIsMediaGenerating] = useState(false);
	const maybeFinalizeAndProcessRef = useRef<() => void>(() => {});
	const processNextPromptRef = useRef<() => Promise<void>>(async () => {});
	const sendChatMessageRef = useRef<(promptItem: QueuedPromptItem) => Promise<void>>(async () => {});

	useEffect(() => {
		sessionAgentEntriesRef.current = normalizedSessionAgentEntries;

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

		if (sessionAgentSaveTimerRef.current) {
			clearTimeout(sessionAgentSaveTimerRef.current);
		}

		// A silent persist (e.g. creating a blank agent with nothing to save yet)
		// still writes to storage but skips the "Saving…/Saved" indicator.
		const silentPersist = suppressNextSessionAgentSaveStatusRef.current;
		suppressNextSessionAgentSaveStatusRef.current = false;

		const saveTimer = setTimeout(() => {
			sessionAgentSaveTimerRef.current = null;
			const didPersist = persistSessionAgentEntries(sessionAgentEntriesRef.current.map(normalizeSessionAgentEntry));
			if (silentPersist) {
				return;
			}
			if (didPersist) {
				setSessionAgentSaveStatus("saved");
				setSessionAgentSavedAt(Date.now());
			} else {
				setSessionAgentSaveStatus("error");
			}
		}, STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS);
		sessionAgentSaveTimerRef.current = saveTimer;

		return () => {
			if (sessionAgentSaveTimerRef.current === saveTimer) {
				clearTimeout(saveTimer);
				sessionAgentSaveTimerRef.current = null;
			}
		};
	}, [normalizedSessionAgentEntries]);

	// oxlint-disable react-doctor/exhaustive-deps -- Unmount cleanup intentionally flushes whichever debounced session-agent save is still active.
	useEffect(() => {
		return () => {
			if (sessionAgentSaveTimerRef.current) {
				clearTimeout(sessionAgentSaveTimerRef.current);
				sessionAgentSaveTimerRef.current = null;
				persistSessionAgentEntries(sessionAgentEntriesRef.current.map(normalizeSessionAgentEntry));
			}
		};
	}, []);
	// oxlint-enable react-doctor/exhaustive-deps

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
			sessionAgentEntriesRef.current = mergeResult.entries;
			// Rehydration writes the persisted agents back to storage unchanged;
			// run that persist silently so a plain reload (no user edits) never
			// flashes the "Saving…/Saved just now" indicator. Only set here, in
			// the branch that actually changes the entries and re-triggers the
			// debounced save effect, so the flag can't linger and swallow the
			// user's next real save.
			suppressNextSessionAgentSaveStatusRef.current = true;
			setSessionAgentEntries(mergeResult.entries);
		}
	}, []);
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

	const clearRetryCountdownInterval = useCallback(() => {
		if (retryCountdownIntervalRef.current !== null) {
			clearInterval(retryCountdownIntervalRef.current);
			retryCountdownIntervalRef.current = null;
		}
	}, []);

	const cancelRetryTimer = useCallback(() => {
		if (retryTimerRef.current !== null) {
			clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}
		clearRetryCountdownInterval();
	}, [clearRetryCountdownInterval]);

	const clearMediaGenerating = useCallback(() => {
		if (mediaGenerationTimeoutRef.current !== null) {
			clearTimeout(mediaGenerationTimeoutRef.current);
			mediaGenerationTimeoutRef.current = null;
		}
		if (isMediaGeneratingRef.current) {
			isMediaGeneratingRef.current = false;
			setIsMediaGenerating(false);
		}
	}, []);

	const startRetryCountdown = useCallback(
		(errorMessageId: string) => {
			clearRetryCountdownInterval();
			let secondsRemaining = Math.ceil(RATE_LIMIT_RETRY_DELAY_MS / 1000);

			setSubmissionErrorMessage(
				createAssistantTextMessage(
					errorMessageId,
					getRateLimitRetryCountdownMessage(secondsRemaining)
				)
			);

			retryCountdownIntervalRef.current = setInterval(() => {
				secondsRemaining -= 1;
				if (secondsRemaining <= 0) {
					clearRetryCountdownInterval();
					return;
				}

				setSubmissionErrorMessage(
					createAssistantTextMessage(
						errorMessageId,
						getRateLimitRetryCountdownMessage(secondsRemaining)
					)
				);
			}, 1000);
		},
		[clearRetryCountdownInterval]
	);

	const startChatInProgressRetryCountdown = useCallback(
		(errorMessageId: string) => {
			clearRetryCountdownInterval();
			let secondsRemaining = Math.ceil(CHAT_IN_PROGRESS_RETRY_DELAY_MS / 1000);

			setSubmissionErrorMessage(
				createAssistantThinkingStatusMessage(
					errorMessageId,
					getChatInProgressRetryCountdownLabel(secondsRemaining),
					getChatInProgressRetryContent()
				)
			);

			retryCountdownIntervalRef.current = setInterval(() => {
				secondsRemaining -= 1;
				if (secondsRemaining <= 0) {
					clearRetryCountdownInterval();
					return;
				}

				setSubmissionErrorMessage(
					createAssistantThinkingStatusMessage(
						errorMessageId,
						getChatInProgressRetryCountdownLabel(secondsRemaining),
						getChatInProgressRetryContent()
					)
				);
			}, 1000);
		},
		[clearRetryCountdownInterval]
	);

	useEffect(() => cancelRetryTimer, [cancelRetryTimer]);
	useEffect(() => clearMediaGenerating, [clearMediaGenerating]);

	const queueTick = useCallback(() => {
		Promise.resolve().then(() => {
			maybeFinalizeAndProcessRef.current();
		});
	}, []);

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
			const userFacingErrorMessage = toUserFacingChatErrorMessage(error.message);
			const hasChatInProgressError =
				isChatInProgressError(error.message) ||
				isChatInProgressError(userFacingErrorMessage);
			const activeQueuedPrompt = activePromptRef.current;

			const removeLatestUserMessage = () => {
				setMessages((prev) => {
					const lastUserIndex = prev.findLastIndex((m) => m.role === "user");
					if (lastUserIndex === -1) {
						return prev;
					}
					return prev.filter((_, i) => i !== lastUserIndex);
				});
			};

			const resendSavedPrompt = async (saved: {
				files: FileUIPart[];
				text: string;
				options?: SendPromptOptions;
			}) => {
				if (isStreamingRef.current) {
					await stop();
				}

				const messagePayload = {
					files: saved.files,
					text: saved.text,
					metadata: saved.options?.messageMetadata,
				};
				const bodyPayload = {
					body: buildSendMessageBody(
						saved.options,
						queuedPromptsRef.current.length > 0
					),
				};

				try {
					await sendMessage(messagePayload, bodyPayload);
				} catch (sendError) {
					if (!isInvalidPartStateError(sendError)) {
						throw sendError;
					}

					setMessages((prev) => sanitizeRovoUiMessages(prev));
					await Promise.resolve();
					await sendMessage(messagePayload, bodyPayload);
				}
			};

			const scheduleRetry = (params: {
				delayMs: number;
				startCountdown: (messageId: string) => void;
				saved: { files: FileUIPart[]; text: string; options?: SendPromptOptions };
			}) => {
				params.startCountdown(errorMessageId);
				retryTimerRef.current = setTimeout(async () => {
					retryTimerRef.current = null;
					clearRetryCountdownInterval();
					setSubmissionErrorMessage(null);
					removeLatestUserMessage();
					retryCountRef.current += 1;
					shouldFinalizeActivePromptRef.current = false;
					isDispatchingPromptRef.current = true;

					try {
						await resendSavedPrompt(params.saved);
					} catch (retryError) {
						shouldFinalizeActivePromptRef.current = true;
						console.error("[RovoChatProvider] Retry send failed:", retryError);
					} finally {
						isDispatchingPromptRef.current = false;
						queueTick();
					}
				}, params.delayMs);
			};

			if (isRateLimitError(error.message)) {
				if (
					retryCountRef.current < RATE_LIMIT_MAX_RETRIES &&
					activeQueuedPrompt
				) {
					const saved = {
						files: activeQueuedPrompt.files,
						text: activeQueuedPrompt.text,
						options: activeQueuedPrompt.options,
					};
					lastPromptRef.current = saved;
					scheduleRetry({
						delayMs: RATE_LIMIT_RETRY_DELAY_MS,
						startCountdown: startRetryCountdown,
						saved,
					});
					return;
				}

				retryCountRef.current = 0;
				clearRetryCountdownInterval();
				setSubmissionErrorMessage(
					createAssistantTextMessage(
						errorMessageId,
						getRateLimitUserMessage(RATE_LIMIT_MAX_RETRIES)
					)
				);
				shouldFinalizeActivePromptRef.current = true;
				queueTick();
				return;
			}

			if (hasChatInProgressError) {
				if (
					retryCountRef.current < CHAT_IN_PROGRESS_MAX_RETRIES &&
					activeQueuedPrompt
				) {
					startSubmitPending(Date.now());
					const saved = {
						files: activeQueuedPrompt.files,
						text: activeQueuedPrompt.text,
						options: activeQueuedPrompt.options,
					};
					lastPromptRef.current = saved;
					scheduleRetry({
						delayMs: CHAT_IN_PROGRESS_RETRY_DELAY_MS,
						startCountdown: startChatInProgressRetryCountdown,
						saved,
					});
					return;
				}

				retryCountRef.current = 0;
				clearRetryCountdownInterval();
				setSubmissionErrorMessage(
					createAssistantTextMessage(
						errorMessageId,
						getChatInProgressUserMessage(CHAT_IN_PROGRESS_MAX_RETRIES)
					)
				);
				shouldFinalizeActivePromptRef.current = true;
				queueTick();
				return;
			}

			clearRetryCountdownInterval();
			if (
				isPayloadTooLargeError(error.message) ||
				isPayloadTooLargeError(userFacingErrorMessage)
			) {
				setMessages((prev) =>
					sanitizeMessagesForTransport(sanitizeRovoUiMessages(prev))
				);
				setSubmissionErrorMessage(
					createAssistantTextMessage(
						errorMessageId,
						getPayloadTooLargeUserMessage()
					)
				);
				shouldFinalizeActivePromptRef.current = true;
				queueTick();
				return;
			}

			setSubmissionErrorMessage(
				createAssistantTextMessage(errorMessageId, userFacingErrorMessage)
			);
			shouldFinalizeActivePromptRef.current = true;
			queueTick();
		},
	});

	const isStreaming = status === "submitted" || status === "streaming";

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- AI SDK status changes are external stream state that clear the local pending affordance.
	useEffect(() => {
		if (
			status !== "submitted" &&
			status !== "streaming" &&
			status !== "error"
		) {
			return;
		}

		if (retryTimerRef.current !== null) {
			return;
		}

		clearSubmitPending();
	}, [clearSubmitPending, status]);
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
		const activePrompt = activePromptRef.current;
		if (!activePrompt || hasTurnCompleteSignalRef.current) {
			return;
		}

		for (let i = rawUiMessages.length - 1; i >= 0; i--) {
			const msg = rawUiMessages[i];
			if (msg.role !== "assistant") {
				continue;
			}

			if (!hasTurnCompleteForPrompt(msg, activePrompt)) {
				break;
			}

			if (didAssistantCompleteActivePrompt(rawUiMessages, i, activePrompt)) {
				hasTurnCompleteSignalRef.current = true;
				queueTick();
			}
			break;
		}
	}, [rawUiMessages, queueTick]);

	// Watch for data-widget-loading parts on the last assistant message to track
	// media generation (image/audio) independently from the SSE stream. If the
	// stream drops before the backend emits loading:false, this ref keeps the
	// queue blocked so the next message is not sent prematurely.
	const scheduleMediaGenerationTimeout = useCallback(() => {
		if (mediaGenerationTimeoutRef.current !== null) {
			clearTimeout(mediaGenerationTimeoutRef.current);
		}
		mediaGenerationTimeoutRef.current = setTimeout(() => {
			mediaGenerationTimeoutRef.current = null;
			if (isMediaGeneratingRef.current) {
				isMediaGeneratingRef.current = false;
				setIsMediaGenerating(false);
				queueTick();
			}
		}, MEDIA_GENERATION_TIMEOUT_MS);
	}, [queueTick]);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Media generation is driven by streamed backend data parts and timeout cleanup, not render-only derivation.
	// oxlint-disable react-doctor/no-derived-state -- The timeout fallback needs local media state after the latest loading part stops changing.
	useEffect(() => {
		for (let i = rawUiMessages.length - 1; i >= 0; i--) {
			const msg = rawUiMessages[i];
			if (msg.role !== "assistant") {
				continue;
			}

			let latestMediaLoadingPart: { loading: boolean } | null = null;
			for (const part of msg.parts) {
				if (part.type !== "data-widget-loading") {
					continue;
				}
				const partData = part as { data?: { type?: string; loading?: boolean } };
				const widgetType = partData.data?.type;
				if (
					widgetType === "image-preview" ||
					widgetType === "audio-preview" ||
					widgetType === "video-preview"
				) {
					latestMediaLoadingPart = { loading: !!partData.data?.loading };
				}
			}

			if (!latestMediaLoadingPart) {
				break;
			}

			if (latestMediaLoadingPart.loading && !isMediaGeneratingRef.current) {
				isMediaGeneratingRef.current = true;
				setIsMediaGenerating(true);
				scheduleMediaGenerationTimeout();
			} else if (!latestMediaLoadingPart.loading && isMediaGeneratingRef.current) {
				clearMediaGenerating();
				queueTick();
			}
			break;
		}
	}, [rawUiMessages, queueTick, clearMediaGenerating, scheduleMediaGenerationTimeout]);
	// oxlint-enable react-doctor/no-derived-state
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	const uiMessages = useMemo(() => {
		if (!submissionErrorMessage) {
			return rawUiMessages;
		}

		const hasErrorMessage = rawUiMessages.some(
			(message) => message.id === submissionErrorMessage.id
		);
		if (hasErrorMessage) {
			return rawUiMessages;
		}

		return [...rawUiMessages, submissionErrorMessage];
	}, [rawUiMessages, submissionErrorMessage]);

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
			lastPromptRef.current = {
				files: promptItem.files,
				text: promptItem.text,
				options: promptItem.options,
			};
			retryCountRef.current = 0;
			setSubmissionErrorMessage(null);

			if (isStreamingRef.current) {
				await stop();
			}

			await ensureCompactThread(promptItem.text || promptItem.files[0]?.filename || "New chat");
			void refreshThreads();

			const messagePayload = {
				files: promptItem.files,
				text: promptItem.text,
				metadata: promptItem.options?.messageMetadata,
			};
			const bodyPayload = {
				body: buildSendMessageBody(
					promptItem.options,
					queuedPromptsRef.current.length > 0
				),
			};

			try {
				await sendMessage(messagePayload, bodyPayload);
			} catch (error) {
				if (!isInvalidPartStateError(error)) {
					throw error;
				}

				setMessages((prev) => sanitizeRovoUiMessages(prev));
				await Promise.resolve();
				await sendMessage(messagePayload, bodyPayload);
			} finally {
				void refreshThreads();
			}
		},
		[ensureCompactThread, refreshThreads, sendMessage, setMessages, stop]
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
		if (!activePromptRef.current) {
			return;
		}

		activePromptRef.current = null;
		setActivePrompt(null);
		shouldFinalizeActivePromptRef.current = false;
		hasTurnCompleteSignalRef.current = false;
		retryCountRef.current = 0;
		lastPromptRef.current = null;
		clearMediaGenerating();
	}, [clearMediaGenerating]);

	const maybeFinalizeAndProcess = useCallback(() => {
		const hasActivePrompt = activePromptRef.current !== null;

		if (hasActivePrompt) {
			const canFinalizeFromStreamEnd =
				hasTurnCompleteSignalRef.current && !isStreamingRef.current;
			const canFinalizeFromError =
				shouldFinalizeActivePromptRef.current &&
				!isStreamingRef.current &&
				!isMediaGeneratingRef.current;

			if (
				(canFinalizeFromStreamEnd || canFinalizeFromError) &&
				retryTimerRef.current === null &&
				!isDispatchingPromptRef.current &&
				!isCancellingRef.current
			) {
				finalizeActivePrompt();
			}
		}

		if (!activePromptRef.current && !isCancellingRef.current) {
			void processNextPromptRef.current();
		}
	}, [finalizeActivePrompt]);

	useEffect(() => {
		maybeFinalizeAndProcessRef.current = maybeFinalizeAndProcess;
	}, [maybeFinalizeAndProcess]);

	const processNextPrompt = useCallback(async () => {
		if (
			activePromptRef.current ||
			isDispatchingPromptRef.current ||
			isCancellingRef.current ||
			isStreamingRef.current ||
			isMediaGeneratingRef.current ||
			retryTimerRef.current !== null
		) {
			return;
		}

		const nextPrompt = queuedPromptsRef.current[0];
		if (!nextPrompt) {
			return;
		}

		queuedPromptsRef.current = queuedPromptsRef.current.slice(1);
		setQueuedPrompts((prev) => prev.slice(1));
		activePromptRef.current = nextPrompt;
		setActivePrompt(nextPrompt);
		shouldFinalizeActivePromptRef.current = false;
		hasTurnCompleteSignalRef.current = false;

		isDispatchingPromptRef.current = true;
		try {
			await sendChatMessageRef.current(nextPrompt);
		} catch (error) {
			shouldFinalizeActivePromptRef.current = true;
			console.error("[RovoChatProvider] Failed to send queued prompt:", error);
		} finally {
			isDispatchingPromptRef.current = false;
			if (!isStreamingRef.current && retryTimerRef.current === null) {
				queueTick();
			}
		}
	}, [queueTick]);

	useEffect(() => {
		processNextPromptRef.current = processNextPrompt;
	}, [processNextPrompt]);

	useEffect(() => {
		queuedPromptsRef.current = queuedPrompts;
		queueTick();
	}, [queuedPrompts, queueTick]);

	useEffect(() => {
		if (!isSubmitPendingRef.current) {
			return;
		}

		if (
			queuedPrompts.length > 0 ||
			activePromptRef.current !== null ||
			isDispatchingPromptRef.current ||
			isStreamingRef.current ||
			isCancellingRef.current ||
			retryTimerRef.current !== null
		) {
			return;
		}

		// oxlint-disable-next-line react-doctor/no-chain-state-updates -- Pending-submit state is split for existing context consumers and cleared atomically here once all async work is idle.
		clearSubmitPending();
	}, [clearSubmitPending, queuedPrompts]);

	useEffect(() => {
		activePromptRef.current = activePrompt;
	}, [activePrompt]);

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

			const shouldStartSubmitPending =
				!isSubmitPendingRef.current &&
				!isStreamingRef.current &&
				activePromptRef.current === null &&
				!isDispatchingPromptRef.current &&
				!isCancellingRef.current &&
				retryTimerRef.current === null;
			if (shouldStartSubmitPending) {
				startSubmitPending(Date.now());
			}

			const id = createQueueItemId(queueIdRef.current);
			queueIdRef.current += 1;

			setQueuedPrompts((prev) => [
				...prev,
				{
					id,
					files: promptFiles,
					text: trimmedPrompt,
					options: resolvedOptions,
					createdAt: Date.now(),
				},
			]);
		},
		[defaultPromptOptions, selectedAgent, setMessages, startSubmitPending]
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
		setQueuedPrompts((prev) => prev.filter((prompt) => prompt.id !== id));
	}, []);

	const clearQueuedPrompts = useCallback(() => {
		setQueuedPrompts([]);
	}, []);

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
			setQueuedPrompts([]);
			queuedPromptsRef.current = [];
			activePromptRef.current = null;
			setActivePrompt(null);
			shouldFinalizeActivePromptRef.current = false;
			hasTurnCompleteSignalRef.current = false;
			const files = message.parts.filter(
				(part): part is FileUIPart => part.type === "file"
			);
			lastPromptRef.current = {
				files,
				text: trimmedText,
				options: resolvedOptions,
			};

			if (!isSubmitPendingRef.current && !isStreamingRef.current) {
				startSubmitPending(Date.now());
			}

			if (isStreamingRef.current) {
				await stop();
				await waitForStreamStop();
			}

			await ensureCompactThread(trimmedText || files[0]?.filename || "New chat");
			void refreshThreads();

			const messagePayload = {
				files,
				text: trimmedText,
				metadata: clearSkillInvocationForEdit(message.metadata),
				messageId,
			};
			const bodyPayload = {
				body: buildSendMessageBody(resolvedOptions, false),
			};

			isDispatchingPromptRef.current = true;
			try {
				await sendMessage(messagePayload, bodyPayload);
			} catch (error) {
				if (!isInvalidPartStateError(error)) {
					throw error;
				}

				setMessages((prev) => sanitizeRovoUiMessages(prev));
				await Promise.resolve();
				await sendMessage(messagePayload, bodyPayload);
			} finally {
				isDispatchingPromptRef.current = false;
				void refreshThreads();
				queueTick();
			}
		},
		[
			cancelRetryTimer,
			clearMediaGenerating,
			clearSubmitPending,
			defaultPromptOptions,
			ensureCompactThread,
			queueTick,
			rawUiMessages,
			refreshThreads,
			sendMessage,
			selectedAgent,
			setMessages,
			startSubmitPending,
			stop,
			waitForStreamStop,
		]
	);

	const cancelCurrentStream = useCallback(async () => {
		if (cancelStreamPromiseRef.current) {
			await cancelStreamPromiseRef.current;
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

			// Belt-and-suspenders: explicitly tell the backend to cancel the Rovo
			// stream only if the primary req.on("close") → AbortSignal path did
			// not settle the turn within a short grace period.
			if (
				!shouldSendExplicitRovoCancel({
					hasBackgroundCancelableWork: false,
					hasUseChatTurn: true,
					stopSettledInTime: stoppedInTime,
				})
			) {
				return;
			}

			try {
				const compactThreadId = activeThreadIdRef.current;
				const cancelKey =
					compactThreadId ??
					(typeof portIndex === "number" ? `port:${portIndex}` : "default");
				const now = Date.now();
				const recentlyCancelledSameTarget =
					lastExplicitCancelKeyRef.current === cancelKey &&
					now - lastExplicitCancelAtRef.current < EXPLICIT_CANCEL_DEBOUNCE_MS;

				if (!recentlyCancelledSameTarget) {
					lastExplicitCancelKeyRef.current = cancelKey;
					lastExplicitCancelAtRef.current = now;
					if (compactThreadId) {
						await cancelRovoAppRun(compactThreadId);
					} else {
						const cancelEndpoint =
							typeof portIndex === "number"
								? `${API_ENDPOINTS.CHAT_CANCEL}?portIndex=${encodeURIComponent(String(portIndex))}`
								: API_ENDPOINTS.CHAT_CANCEL;
						await fetch(cancelEndpoint, { method: "POST" });
					}
				}
			} catch {
				// Ignore cancel endpoint errors — the stream may have already ended.
			}
		})();

		cancelStreamPromiseRef.current = cancelPromise;
		try {
			await cancelPromise;
		} finally {
			cancelStreamPromiseRef.current = null;
		}
	}, [portIndex, stop, waitForStreamStop]);

	const stopStreaming = useCallback(async () => {
		const transitionToken = beginTransition("stop-streaming");
		if (activePromptRef.current) {
			shouldFinalizeActivePromptRef.current = true;
		}

		clearMediaGenerating();
		clearSubmitPending();
		isCancellingRef.current = true;
		try {
			await cancelCurrentStream();
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
		clearMediaGenerating,
		clearSubmitPending,
		queueTick,
		refreshThreads,
		hasCancellationOwner,
		syncTransitionCancellation,
	]);

	const detachCurrentThreadForSwitch = useCallback(async () => {
		const threadId = activeThreadIdRef.current;
		if (isStreamingRef.current) {
			try {
				await stop();
			} catch (error) {
				console.warn("[RovoChatProvider] Failed to detach compact stream:", error);
			}
			await waitForStreamStop();
		}

		if (threadId) {
			await detachRovoAppRun(threadId).catch(() => {});
		}
	}, [stop, waitForStreamStop]);

	const selectThread = useCallback(
		async (threadId: string) => {
			const transitionToken = beginTransition("select-thread");
			try {
				await detachCurrentThreadForSwitch();
				if (!isCurrentTransition(transitionToken)) {
					return;
				}

				const thread = await getRovoAppThread(threadId);
				if (!isCurrentTransition(transitionToken)) {
					return;
				}
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
				setSubmissionErrorMessage(null);
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
			detachCurrentThreadForSwitch,
			finishTransition,
			isCurrentTransition,
			queueTick,
			refreshThreads,
			setMessages,
		]
	);

	const deleteThread = useCallback(
		async (threadId: string) => {
			const transitionToken = beginTransition("delete-thread");
			try {
				if (threadId === activeThreadIdRef.current) {
					await detachCurrentThreadForSwitch();
					if (isCurrentTransition(transitionToken)) {
						activeThreadIdRef.current = null;
						setActiveThreadId(null);
						setMessages([]);
						setSubmissionErrorMessage(null);
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
		[
			beginTransition,
			detachCurrentThreadForSwitch,
			finishTransition,
			isCurrentTransition,
			queueTick,
			refreshThreads,
			setMessages,
		]
	);

	const deleteAllThreads = useCallback(async () => {
		const transitionToken = beginTransition("delete-all-threads");
		cancelRetryTimer();
		clearMediaGenerating();
		clearSubmitPending();
		retryCountRef.current = 0;
		lastPromptRef.current = null;
		queuedPromptsRef.current = [];
		activePromptRef.current = null;
		shouldFinalizeActivePromptRef.current = false;
		hasTurnCompleteSignalRef.current = false;
		isDispatchingPromptRef.current = false;
		setQueuedPrompts([]);
		setActivePrompt(null);
		setMessages([]);
		setSubmissionErrorMessage(null);

		try {
			await detachCurrentThreadForSwitch();
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
	}, [
		beginTransition,
		cancelRetryTimer,
		clearMediaGenerating,
		clearSubmitPending,
		detachCurrentThreadForSwitch,
		finishTransition,
		isCurrentTransition,
		queueTick,
		refreshThreads,
		setMessages,
	]);

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

	const resetTranscriptPending = useCallback(() => {
		cancelRetryTimer();
		clearMediaGenerating();
		clearSubmitPending();
		retryCountRef.current = 0;
		lastPromptRef.current = null;
		queuedPromptsRef.current = [];
		activePromptRef.current = null;
		shouldFinalizeActivePromptRef.current = false;
		hasTurnCompleteSignalRef.current = false;
		isDispatchingPromptRef.current = false;
		setQueuedPrompts([]);
		setActivePrompt(null);
		setSubmissionErrorMessage(null);
	}, [cancelRetryTimer, clearMediaGenerating, clearSubmitPending]);

	const resetChat = useCallback(() => {
		const transitionToken = beginTransition("reset-chat");
		resetTranscriptPending();
		setMessages([]);
		setSubmissionErrorMessage(null);

		void detachCurrentThreadForSwitch().finally(() => {
			if (!finishTransition(transitionToken)) {
				return;
			}
			// Old stream chunks can still arrive briefly while cancellation settles.
			// Clear message state one more time so the next session starts clean.
			activeThreadIdRef.current = null;
			setActiveThreadId(null);
			lastPersistedThreadKeyRef.current = "";
			setMessages([]);
			setSubmissionErrorMessage(null);
			void refreshThreads(transitionToken);
			queueTick();
		});
	}, [
		resetTranscriptPending,
		beginTransition,
		detachCurrentThreadForSwitch,
		finishTransition,
		queueTick,
		refreshThreads,
		setMessages,
	]);

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

		sessionAgentEntriesRef.current = result.entries;
		setSessionAgentSaveStatus("saving");
		setSessionAgentEntries(result.entries);

		// Deleting the agent that is currently driving the chat would otherwise
		// leave the surface pointed at a profile that no longer exists, so fall
		// back to the default Rovo agent (which also clears the thread).
		if (selectedAgentIdRef.current === profileId) {
			setSelectedAgentIdState(ROVO_AGENT_ID);
			resetChat();
		}
	}, [resetChat, setSelectedAgentIdState]);

	const rawUiMessagesRef = useLatestRef(rawUiMessages);
	const [transcript] = useState(() => createRovoChatTranscript());
	useEffect(() => transcript.configure({
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
		stop: cancelCurrentStream,
		ensureThread: ensureThreadForLocalTurn,
		readMessages: () => rawUiMessagesRef.current,
		resetPending: resetTranscriptPending,
		writeMessages: (messages) => {
			const sanitized = sanitizeRovoUiMessages([...messages]);
			rawUiMessagesRef.current = sanitized;
			setMessages(sanitized);
		},
		writeSnapshot: ({ messages, threadId, markPersisted = true }) => {
			const sanitized = sanitizeRovoUiMessages([...messages]);
			rawUiMessagesRef.current = sanitized;
			activeThreadIdRef.current = threadId;
			setActiveThreadId(threadId);
			lastPersistedThreadKeyRef.current = markPersisted && threadId ? buildCompactThreadPersistKey(threadId, sanitized) : "";
			setMessages(sanitized);
		},
		selectAgent: (agentId) => selectAgent(agentId, { preserveCurrentThread: true }),
	}), [beginTransition, isCurrentTransition, finishTransition, queueTick, cancelCurrentStream, ensureThreadForLocalTurn, rawUiMessagesRef, resetTranscriptPending, setMessages, selectAgent, transcript]);
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
