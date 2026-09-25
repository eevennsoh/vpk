"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.
// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- These effects synchronize external chat, animation, media, or controlled workflow state and are intentionally guarded by refs/keys.
// oxlint-disable react-doctor/no-chain-state-updates -- Related state fields are updated together to preserve atomic UI transitions and avoid partial interaction states.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.
// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.
// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props or external runtime state before user edits take ownership.
// oxlint-disable react-doctor/no-pass-data-to-parent -- Callbacks in this file intentionally report measured, generated, or selected data to an owning parent component.
// oxlint-disable react-doctor/no-pass-live-state-to-parent -- Callbacks in this file intentionally stream live interaction state to the parent owner.
// oxlint-disable react-doctor/prefer-module-scope-static-value -- These values are intentionally colocated with the component/demo contract for readability and token context.

import type { FileUIPart } from "ai";
import { motion, useReducedMotion } from "motion/react";
import { type CSSProperties, startTransition, useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { ArtifactPanel } from "@/components/blocks/artifact";
import { ChatTimelineNavigator } from "@/components/blocks/chat-timeline/chat-timeline-navigator";
import { CreateButton } from "@/components/blocks/top-navigation/components/create-button";
import { RovoAppHeaderCore as RovoAppHeader } from "@/components/projects/rovo-core/components/rovo-app-header";
import { RovoAppBrowserArtifact } from "@/components/projects/rovo-core/components/rovo-app-browser-artifact";
import { RovoAppComposer } from "@/components/projects/rovo/components/rovo-app-composer";
import { RovoAppMessages } from "@/components/projects/rovo/components/rovo-app-messages";
import { RovoAppShellPaneLayoutCore as RovoAppShellPaneLayout } from "@/components/projects/rovo-core/components/rovo-app-shell-pane-layout";
import { RovoAppSidebar } from "@/components/projects/rovo/components/rovo-app-sidebar";
import { useArtifactAnnotations } from "@/components/ui-custom/hooks/use-artifact-annotations";
import { formatAnnotationsForVoiceContext } from "@/components/ui-custom/lib/artifact-annotations";
import type { ArtifactAnnotation } from "@/components/ui-custom/lib/artifact-annotations";
import { useRovoApp } from "@/components/projects/rovo/hooks/use-rovo-app";
import { useHmrReloadSuppression } from "@/components/projects/rovo-core/hooks/use-hmr-reload-suppression";
import { getRovoAppArtifactKindLabel, getRovoAppArtifactTypeLabel, sortRovoAppArtifacts } from "@/components/projects/rovo-core/lib/rovo-app-artifacts";
import { useLazyRef } from "@/lib/use-lazy-ref";
import {
	buildRovoAppBrowserArtifactKey,
	shouldAutoOpenRovoAppBrowserArtifact,
	shouldShowReopenRovoAppBrowserArtifactControl,
} from "@/components/projects/rovo-core/lib/rovo-app-browser-preview";
import { resolveRovoAppComposerPlaceholder } from "@/components/projects/shared/lib/rovo-app-composer-placeholder";
import { appendDictationTranscript, resolveComposerDictationState } from "@/lib/composer-dictation";
import { ROVO_APP_MAX_CHAT_PANE_WIDTH, ROVO_APP_MIN_ARTIFACT_PANE_WIDTH, ROVO_APP_MIN_CHAT_PANE_WIDTH, getRovoAppShellLayout } from "@/components/projects/rovo-core/lib/rovo-app-shell-layout";
import { getRovoAppSmartGenerationLayoutContext } from "@/components/projects/rovo-core/lib/rovo-app-smart-generation-layout";
import { deriveRovoAppTimelineItems } from "@/components/projects/rovo-core/lib/rovo-app-timeline";
import { buildRovoAppThreadPath } from "@/components/projects/rovo/lib/rovo-app-thread-route-sync";
import { createRovoAppUserMessage } from "@/components/projects/rovo-core/lib/rovo-app-user-message";
import { type DelegationRequest, useRealtimeVoice } from "@/components/projects/rovo/hooks/use-realtime-voice";
import { type RovoRealtimeShellAdapter, useRovoRealtimeShellBridge } from "@/components/projects/rovo-core/hooks/use-rovo-realtime-shell-bridge";
import type { ConversationFollowMode } from "@/components/ui-custom/conversation";
import { RichTextMentionVisualMark, type ComposerDirectoryAutocompleteController } from "@/components/ui-custom/rich-text-editor";
import { useSidebar as useGlobalSidebar } from "@/app/contexts/context-sidebar";
import PromptGallery from "@/components/blocks/prompt-gallery/page";
import { DEFAULT_PROMPT_GALLERY_SUGGESTIONS } from "@/components/blocks/prompt-gallery/data/suggestions";
import { GreetingPromptRow } from "@/components/projects/shared/components/greeting-prompt-row";
import { LeftNavigation } from "@/components/blocks/top-navigation/components/left-navigation";
import { RightNavigation } from "@/components/blocks/top-navigation/components/right-navigation";
import SearchSuggestionsPanel from "@/components/blocks/top-navigation/components/search-suggestions-panel";
import { useTopNavigation } from "@/components/blocks/top-navigation/hooks/use-top-navigation";
import {
	ROVO_APP_SEPARATOR_LINE_OFFSET_PX,
	TOP_NAV_COLLAPSED_HEADER_PADDING_PX,
	TOP_NAV_COLLAPSED_LEFT_SECTION_WIDTH_PX,
	TOP_NAV_HEADER_HEIGHT_PX,
	TOP_NAV_PADDING_PX,
	TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX,
	TOP_NAV_SEARCH_MAX_WIDTH_PX,
	TOP_NAV_SEARCH_MIN_WIDTH_PX,
} from "@/components/blocks/top-navigation/layout-constants";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import SearchIcon from "@atlaskit/icon/core/search";
import { SidebarProvider, SidebarResizeHandle } from "@/components/ui/sidebar";
import { Footer } from "@/components/ui-custom/footer";
import { useClicky } from "@/components/projects/rovo-core/hooks/use-clicky";
import { useClickyVoice } from "@/components/projects/rovo/hooks/use-clicky-voice";
import { ClickyOverlay } from "@/components/projects/rovo-core/components/clicky/clicky-overlay";
import { ScreenAssistantRegionOverlay } from "@/components/screen-assistant/screen-assistant-region-overlay";
import {
	activateStudioScreenAssistantTarget,
	createStudioScreenAssistantSnapshot,
	getStudioScreenAssistantVisibleTargets,
	groundStudioScreenAssistantTarget,
	type StudioScreenAssistantRegion,
	type StudioScreenAssistantTarget,
} from "@/components/projects/rovo-core/lib/screen-assistant";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import { clamp, cn, createId } from "@/lib/utils";
import { token } from "@/lib/tokens";
import { getLatestDataPart, getLatestUserMessageId, getMessageArtifactResult, getMessageText } from "@/lib/rovo-ui-messages";
import { ApprovalCard } from "@/components/blocks/approval-card/page";
import { ClarificationQuestionCard } from "@/components/projects/shared/components/clarification-question-card";
import { QuestionCardShortcutsFooter } from "@/components/projects/shared/components/question-card-shortcuts-footer";
import { getLatestQuestionCardPayload, type ClarificationAnswers } from "@/components/projects/shared/lib/question-card-widget";
import type { PlanApprovalSelection } from "@/components/projects/shared/lib/plan-approval";
import { getLatestPendingPlanWidget, type ParsedPlanWidgetPayload } from "@/components/projects/shared/lib/plan-widget";
import { useDismissibleCards } from "@/components/projects/shared/hooks/use-dismissible-cards";
import { useRovoSelectedAgent } from "@/app/contexts";
import { getRovoAgentPromptContext, isRovoAgentProfile } from "@/app/data/directory/agents";
import type { DirectoryAutocompleteState } from "@/lib/directory-autocomplete";

interface RovoAppShellProps {
	embedded?: boolean;
	initialThreadId?: string | null;
}

const ROVO_APP_SIDEBAR_MOTION_DURATION = "--duration-medium";
const ROVO_APP_SIDEBAR_MOTION_FALLBACK_MS = 200;
const ROVO_APP_SIDEBAR_MIN_WIDTH = 240;
const ROVO_APP_SIDEBAR_MAX_WIDTH = 480;

const HOME_SUGGESTIONS = DEFAULT_PROMPT_GALLERY_SUGGESTIONS.slice(0, 3);
const DEFAULT_COMPOSER_PLACEHOLDER = "Describe what it should do";
// Fullscreen Rovo renders directory matches as a two-column grid; 8 keeps it at
// four rows per column while other prompt surfaces can show the default 9.
const ROVO_APP_DIRECTORY_AUTOCOMPLETE_LIMIT = 8;
const REALTIME_THREAD_SUMMARY_MAX_MESSAGES = 10;
const REALTIME_RESULT_SUMMARY_MAX_CHARS = 500;
const ROVO_APP_SPLIT_CHAT_PANEL_ID = "rovo-app-chat-pane";
const ROVO_APP_SPLIT_ARTIFACT_PANEL_ID = "rovo-app-artifact-pane";

function parseCssDurationMs(value: string): number | null {
	const trimmedValue = value.trim();

	if (!trimmedValue) {
		return null;
	}

	if (trimmedValue.endsWith("ms")) {
		const durationMs = Number.parseFloat(trimmedValue.slice(0, -2));
		return Number.isFinite(durationMs) ? durationMs : null;
	}

	if (trimmedValue.endsWith("s")) {
		const durationSeconds = Number.parseFloat(trimmedValue.slice(0, -1));
		return Number.isFinite(durationSeconds) ? durationSeconds * 1000 : null;
	}

	const numericDuration = Number.parseFloat(trimmedValue);
	return Number.isFinite(numericDuration) ? numericDuration : null;
}

function getCssDurationTokenMs(tokenName: string, fallbackMs: number): number {
	if (typeof window === "undefined") {
		return fallbackMs;
	}

	const tokenValue = window.getComputedStyle(document.documentElement).getPropertyValue(tokenName);

	return parseCssDurationMs(tokenValue) ?? fallbackMs;
}

function mergeContextDescriptions(...parts: Array<string | null | undefined>): string | undefined {
	const mergedParts = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));

	return mergedParts.length > 0 ? mergedParts.join("\n\n") : undefined;
}

type RealtimeInjectContextPayload = {
	type: string;
	content?: string;
	role?: string;
	summary?: string;
	[key: string]: unknown;
};

type RovoAppRealtimeShellAdapter = RovoRealtimeShellAdapter<ReturnType<typeof useRovoApp>> & {
	delegateToRovo?: (messageId: string, options?: Record<string, unknown>) => Promise<void>;
	submitRealtimeText?: (payload: { contextDescription?: string; files: FileUIPart[]; text: string }) => Promise<void>;
};

type ExtendedDelegationRequest = DelegationRequest & {
	delegatedMessageId?: string;
	messageId?: string;
	realtimeMessageId?: string;
};

type RealtimeSpeechTranscriptPayload =
	| string
	| {
			delta?: string;
			messageId?: string;
			text?: string;
			transcript?: string;
	  };

type RealtimeAssistantTextPayload =
	| string
	| {
			delta?: string;
			displayOnly?: boolean;
			messageId?: string;
			replace?: boolean;
			source?: "text" | "audio_transcript";
			text?: string;
	  };

type RealtimeAssistantTextCompletedPayload =
	| string
	| {
			messageId?: string;
			text?: string;
	  };

type RealtimeVoiceShellOptions = Parameters<typeof useRealtimeVoice>[0] & {
	onAssistantTextCompleted?: (payload: string | { messageId?: string; text?: string }) => void;
	onAssistantTextDelta?: (payload: string | { delta?: string; displayOnly?: boolean; messageId?: string; replace?: boolean; source?: "text" | "audio_transcript"; text?: string }) => void;
	onSpeechTranscriptCompleted?: (payload: string | { messageId?: string; transcript?: string; text?: string }) => void;
	onSpeechTranscriptDelta?: (payload: string | { delta?: string; messageId?: string; text?: string }) => void;
	onTextResponseStart?: (payload?: { messageId?: string }) => void;
};

type RealtimeVoiceShellResult = ReturnType<typeof useRealtimeVoice> & {
	connectionState?: string;
	connectionStatus?: string;
	currentAssistantMessageId?: string | null;
	currentUserMessageId?: string | null;
	isReconnecting?: boolean;
	sendTextInput?: (payload: { contextDescription?: string; messageId?: string; text: string }) => Promise<void>;
	sessionId?: string;
	sessionKey?: string;
	statusMessage?: string | null;
};

type RovoScreenAssistantToolCall = {
	args: Record<string, unknown>;
	callId: string;
	name: string;
};

type RovoScreenAssistantToolResponder = (output: unknown, createResponse?: boolean) => void;

type TypedScrollAnchorSource = "none" | "standard" | "realtime";

type ScrollActiveTimelineSelection = {
	latestTimelineMessageId: string | null;
	messageId: string;
	runtimeThreadId: string | null;
};

function buildRealtimeThreadSummary(messages: ReadonlyArray<ReturnType<typeof useRovoApp>["messages"][number]>): string {
	const summary = messages
		.filter((message) => message.role === "user" || message.role === "assistant")
		.slice(-REALTIME_THREAD_SUMMARY_MAX_MESSAGES)
		.map((message) => {
			const text = getMessageText(message).trim();
			const artifact = getMessageArtifactResult(message);
			const fragments = [text || null, artifact ? `${artifact.action === "update" ? "Updated" : "Created"} artifact "${artifact.title}".` : null].filter((fragment): fragment is string =>
				Boolean(fragment),
			);

			if (fragments.length === 0) {
				return null;
			}

			return `${message.role}: ${fragments.join(" ")}`.trim();
		})
		.filter((line): line is string => Boolean(line))
		.join("\n");

	return summary.slice(0, 2_000);
}

function buildRealtimeArtifactContextSummary(input: {
	annotationContext: string | null;
	document: {
		id: string;
		kind: string;
		title: string;
	} | null;
}): string | null {
	if (!input.document) {
		return null;
	}

	return [`Artifact open: ${input.document.title}`, `Document ID: ${input.document.id}`, `Kind: ${input.document.kind}`, input.annotationContext ? input.annotationContext : null]
		.filter((part): part is string => Boolean(part))
		.join("\n");
}

function resolveRealtimeStatusMessage(realtime: RealtimeVoiceShellResult): string | null {
	const directStatus = typeof realtime.statusMessage === "string" && realtime.statusMessage.trim() ? realtime.statusMessage.trim() : null;
	if (directStatus) {
		return directStatus;
	}

	const connectionState =
		typeof realtime.connectionState === "string" && realtime.connectionState.trim()
			? realtime.connectionState.trim().toLowerCase()
			: typeof realtime.connectionStatus === "string" && realtime.connectionStatus.trim()
				? realtime.connectionStatus.trim().toLowerCase()
				: null;

	if (connectionState === "reconnecting" || realtime.isReconnecting) {
		return "Reconnecting voice...";
	}

	if (connectionState === "disconnected") {
		return "Voice disconnected";
	}

	return null;
}

function resolveRealtimeSessionIdentity(realtime: RealtimeVoiceShellResult, activeThreadId: string | null, runtimeThreadId: string): string | null {
	const candidates = [realtime.sessionId, realtime.sessionKey, realtime.connectionState, realtime.connectionStatus];

	const explicitIdentity = candidates.find((candidate) => {
		return typeof candidate === "string" && candidate.trim().length > 0;
	});

	if (explicitIdentity) {
		return explicitIdentity;
	}

	return realtime.voiceState !== "idle" ? `${activeThreadId ?? runtimeThreadId}:${realtime.voiceState}` : null;
}

function getViewportPointFromScreenAssistantTarget(
	target: StudioScreenAssistantTarget | null | undefined,
): { x: number; y: number; label: string; coordinateSpace: "viewport" } | null {
	if (!target?.rect) {
		return null;
	}

	return {
		x: target.rect.x + target.rect.width / 2,
		y: target.rect.y + target.rect.height / 2,
		label: target.label ?? target.fieldId ?? target.id ?? "Target",
		coordinateSpace: "viewport",
	};
}

function RovoAppDirectoryAutocompleteShortcut({
	index,
}: Readonly<{
	index: number;
}>) {
	return (
		<Kbd className="h-5 min-w-7 rounded-sm bg-bg-neutral px-1.5 text-[11px] text-text-subtle">
			⌘{index + 1}
		</Kbd>
	);
}

function RovoAppDirectoryAutocompleteRows({
	className,
	shouldReduceMotion,
	state,
	useWideLayout,
	onSelect,
}: Readonly<{
	className?: string;
	shouldReduceMotion: boolean;
	state: DirectoryAutocompleteState;
	useWideLayout: boolean;
	onSelect?: (index: number) => void;
}>) {
	if (state.matches.length === 0) {
		return null;
	}

	return (
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className={cn("w-full", className)}
			initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
			transition={{ duration: 0.18, ease: [0, 0.4, 0, 1] }}
			style={{ willChange: "transform, opacity" }}
		>
			<div className={cn("grid gap-1", useWideLayout ? "grid-cols-2 gap-x-6" : "grid-cols-1")}>
				{state.matches.map((match, index) => (
					<GreetingPromptRow
						description={match.mention.description}
						key={match.mention.id}
						label={match.mention.label}
						onClick={() => onSelect?.(index)}
						shortcut={<RovoAppDirectoryAutocompleteShortcut index={index} />}
						visual={
							match.mention.visual ? (
								<RichTextMentionVisualMark
									category={match.mention.category}
									label={match.mention.label}
									size="menu"
									visual={match.mention.visual}
								/>
							) : undefined
						}
					/>
				))}
			</div>
		</motion.div>
	);
}

export function RovoAppShell({ embedded = false, initialThreadId = null }: Readonly<RovoAppShellProps>) {
	const nav = useTopNavigation();
	const { selectedAgent } = useRovoSelectedAgent();
	const selectedAgentContextDescription = getRovoAgentPromptContext(selectedAgent);
	const isCustomAgentSelected = !isRovoAgentProfile(selectedAgent);
	const [viewportWidthPx, setViewportWidthPx] = useState<number | null>(null);
	const [shellSize, setShellSize] = useState({ width: 0, height: 0 });
	const smartGenerationLayout = useMemo(() => {
		return getRovoAppSmartGenerationLayoutContext({
			shellWidth: shellSize.width,
			viewportWidth: viewportWidthPx,
		});
	}, [shellSize.width, viewportWidthPx]);
	const chat = useRovoApp({
		embedded,
		initialThreadId,
		smartGenerationLayout,
	});
	useHmrReloadSuppression(chat.isStreaming);
	const chatRef = useRef(chat);
	useEffect(() => {
		chatRef.current = chat;
	}, [chat]);
	const [directoryAutocompleteState, setDirectoryAutocompleteState] = useState<DirectoryAutocompleteState | null>(null);
	const [directoryAutocompleteController, setDirectoryAutocompleteController] = useState<ComposerDirectoryAutocompleteController | null>(null);

	const buildPromptOptions = useCallback(
		(contextDescription?: string) => {

			const resolvedContextDescription = mergeContextDescriptions(
				contextDescription,
				selectedAgentContextDescription,
			);
			return {
				contextDescription: resolvedContextDescription,
			};
		},
		[selectedAgentContextDescription],
	);

	// Bridge the global sidebar context (TopNavigation toggle) with the local
	// shadcn SidebarProvider so the nav bar button controls the thread sidebar.
	const globalSidebar = useGlobalSidebar();
	const globalSidebarVisibleRef = useRef(globalSidebar.isVisible);

	useEffect(() => {
		if (globalSidebar.isVisible !== globalSidebarVisibleRef.current) {
			globalSidebarVisibleRef.current = globalSidebar.isVisible;
			chat.setSidebarOpen(globalSidebar.isVisible);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only react to global sidebar changes
	}, [globalSidebar.isVisible]);

	useEffect(() => {
		if (chat.sidebarOpen !== globalSidebarVisibleRef.current) {
			globalSidebarVisibleRef.current = chat.sidebarOpen;
			globalSidebar.setSidebarVisible(chat.sidebarOpen);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only react to local sidebar changes
	}, [chat.sidebarOpen]);

	// Hover-reveal: show sidebar temporarily when hovering the toggle button.
	// Uses a debounced timer so the sidebar stays visible while the mouse
	// transitions from the toggle button to the sidebar content area.
	const [hoverRevealActive, setHoverRevealActive] = useState(false);
	const hoverLeaveTimerRef = useRef<number | null>(null);

	const clearHoverTimer = useCallback(() => {
		if (hoverLeaveTimerRef.current) {
			window.clearTimeout(hoverLeaveTimerRef.current);
			hoverLeaveTimerRef.current = null;
		}
	}, []);

	const scheduleSidebarHoverClose = useCallback(() => {
		clearHoverTimer();
		hoverLeaveTimerRef.current = window.setTimeout(
			() => {
				setHoverRevealActive(false);
			},
			getCssDurationTokenMs(ROVO_APP_SIDEBAR_MOTION_DURATION, ROVO_APP_SIDEBAR_MOTION_FALLBACK_MS),
		);
	}, [clearHoverTimer]);

	const handleSidebarHoverEnter = useCallback(() => {
		clearHoverTimer();
		setHoverRevealActive(true);
	}, [clearHoverTimer]);

	const handleSidebarHoverLeave = useCallback(() => {
		scheduleSidebarHoverClose();
	}, [scheduleSidebarHoverClose]);

	const handleSidebarContentMouseEnter = useCallback(() => {
		clearHoverTimer();
	}, [clearHoverTimer]);

	const handleSidebarContentMouseLeave = useCallback(() => {
		scheduleSidebarHoverClose();
	}, [scheduleSidebarHoverClose]);

	useEffect(() => {
		return () => clearHoverTimer();
	}, [clearHoverTimer]);

	// ⌘⇧O — create a new chat
	useEffect(() => {
		const handleNewChatShortcut = (e: KeyboardEvent) => {
			if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "o") {
				e.preventDefault();
				chatRef.current.openNewChat();
			}
		};

		document.addEventListener("keydown", handleNewChatShortcut);
		return () => document.removeEventListener("keydown", handleNewChatShortcut);
	}, []);

	const isHoverOpen = hoverRevealActive && !chat.sidebarOpen;

	const artifactContentRef = useRef<HTMLDivElement | null>(null);
	const annotationContextRef = useRef<string | null>(null);
	const realtimeInjectContextRef = useRef<((payload: RealtimeInjectContextPayload) => void) | null>(null);
	const composerTextRef = useRef("");
	const screenAssistantPointerRef = useRef<{ x: number; y: number } | null>(null);
	const screenAssistantComposerRef = useRef<{
		hasPrefill?: boolean;
		placeholder?: string;
	}>({
		placeholder: DEFAULT_COMPOSER_PLACEHOLDER,
	});
	const sendFunctionCallOutputRef = useRef<
		((payload: { callId: string; output: unknown; createResponse?: boolean }) => void) | null
	>(null);
	const handleComposerSubmitRef = useRef<
		((payload: { files: FileUIPart[]; text: string }) => void | Promise<void>) | null
	>(null);
	const dictationBaselineRef = useRef<string | null>(null);
	const dictationCommittedTextRef = useRef<string | null>(null);
	const isDictationActiveRef = useRef(false);
	const sidebarResize = useSidebarResize({
		defaultWidth: ROVO_APP_SEPARATOR_LINE_OFFSET_PX,
		minWidth: ROVO_APP_SIDEBAR_MIN_WIDTH,
		maxWidth: ROVO_APP_SIDEBAR_MAX_WIDTH,
		onCollapse: useCallback(() => {
			chat.setSidebarOpen(false);
		}, [chat]),
	});
	const rovoAppSidebarStyle = {
		"--sidebar-width": `${sidebarResize.sidebarWidth}px`,
	} as CSSProperties;
	const headerHeightStyle: CSSProperties = {
		height: `${TOP_NAV_HEADER_HEIGHT_PX}px`,
	};
	const [cursorMode, setCursorMode] = useState(false);
	const [galleryExpanded, setGalleryExpanded] = useState(false);
	const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
	const [prefillText, setPrefillText] = useState<string | null>(null);
	const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
	const [isDictationActive, setIsDictationActive] = useState(false);
	const [dictationTranscriptPreview, setDictationTranscriptPreview] = useState<string | null>(null);
	const [composerFocusRequestKey, setComposerFocusRequestKey] = useState(0);
	const [scrollActiveTimelineSelection, setScrollActiveTimelineSelection] = useState<ScrollActiveTimelineSelection | null>(null);
	const [scrollAnchorMessageId, setScrollAnchorMessageId] = useState<string | null>(null);
	const [scrollFollowMode, setScrollFollowMode] = useState<ConversationFollowMode>("bottom");
	const [optimisticUserMessage, setOptimisticUserMessage] = useState<ReturnType<typeof createRovoAppUserMessage> | null>(null);
	const [dismissedBrowserArtifactKey, setDismissedBrowserArtifactKey] = useState<string | null>(null);
	const displayMessages = useMemo(() => {
		if (!optimisticUserMessage) {
			return chat.messages;
		}

		const optimisticText = getMessageText(optimisticUserMessage).trim();
		const hasVisibleUserMessage = chat.messages.some((message) => {
			if (message.role !== "user") {
				return false;
			}

			if (message.id === optimisticUserMessage.id) {
				return true;
			}

			return optimisticText.length > 0 && getMessageText(message).trim() === optimisticText;
		});

		return hasVisibleUserMessage ? chat.messages : [...chat.messages, optimisticUserMessage];
	}, [chat.messages, optimisticUserMessage]);
	const visibleMessages = useMemo(() => {
		return displayMessages.filter((message) => {
			return message.role === "user" || message.role === "assistant";
		});
	}, [displayMessages]);
	const isArtifactOpen = chat.panelState !== "closed";
	const hasActiveThreadRun = typeof chat.activeThreadId === "string" && chat.backgroundStreamThreadIds.has(chat.activeThreadId);
	const showHomeState = !chat.isLoadingThread && !isArtifactOpen && !hasActiveThreadRun && visibleMessages.length === 0;
	const realtimeUserMessageIdRef = useRef<string | null>(null);
	const realtimeAssistantMessageIdRef = useRef<string | null>(null);
	const realtimeAssistantMessagePromiseRef = useRef<Promise<string | null> | null>(null);
	const realtimeUserTranscriptHasDeltaRef = useRef(false);
	const manualVoiceStopRef = useRef(false);
	const injectedRealtimeThreadContextKeyRef = useRef<string | null>(null);
	const injectedRealtimeArtifactContextKeyRef = useRef<string | null>(null);
	const pendingTypedScrollAnchorRef = useRef(false);
	const previousTypedAnchorUserMessageIdRef = useRef<string | null>(null);
	const typedScrollAnchorSourceRef = useRef<TypedScrollAnchorSource>("none");
	const realtimeTypedResponseStartedRef = useRef(false);
	const speechStartedAtRef = useRef<string | null>(null);

	const handleGalleryPreviewStart = useCallback((prompt: string) => {
		setPreviewPrompt(prompt);
	}, []);

	const handleGalleryPreviewEnd = useCallback(() => {
		setPreviewPrompt(null);
	}, []);

	const handleGallerySelect = useCallback((prompt: string) => {
		setPrefillText(prompt);
		setPreviewPrompt(null);
	}, []);

	const clearPrefillSources = useCallback(() => {
		setPrefillText(null);
		setVoiceTranscript(null);
	}, []);

	const handleComposerTextChange = useCallback((value: string) => {
		composerTextRef.current = value;
	}, []);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			screenAssistantPointerRef.current = {
				x: event.clientX,
				y: event.clientY,
			};
		};

		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		return () => window.removeEventListener("pointermove", handlePointerMove);
	}, []);

	const handleRovoAppSuggestionSelect = useCallback(
		async (prompt: string) => {
			const contextDescription = annotationContextRef.current ?? undefined;
			try {
				await chat.submitPrompt({
					...buildPromptOptions(contextDescription),
					files: [],
					text: prompt,
				});
			} catch {
				// submitPrompt already sets a user-visible error state.
			}
		},
		[buildPromptOptions, chat],
	);

	const handleDirectoryAutocompleteSelect = useCallback((index: number) => {
		directoryAutocompleteController?.acceptIndex(index);
	}, [directoryAutocompleteController]);

	// Question card / clarification support
	const activeQuestionCard = useMemo(() => getLatestQuestionCardPayload(chat.messages), [chat.messages]);
	const { acceptPlanReview, submitClarification } = chat;
	const {
		shouldShowQuestionCard: shouldShowQuestionCardRaw,
		activeQuestionCardKey,
		hideQuestionCard,
		dismissQuestionCard,
	} = useDismissibleCards({
		activeQuestionCard,
		onDismissQuestionCard: chat.cancelClarificationQuestionSet,
	});
	const isDeferredQuestionCard = Boolean(activeQuestionCard?.deferredToolCallId);
	const shouldShowQuestionCard = shouldShowQuestionCardRaw && (!chat.isStreaming || isDeferredQuestionCard);
	const handleClarificationSubmit = useCallback(
		(answers: ClarificationAnswers) => {
			if (!activeQuestionCard) return;
			void submitClarification(activeQuestionCard, answers);
		},
		[activeQuestionCard, submitClarification],
	);
	const handleBuildPlan = useCallback(
		(planWidget: ParsedPlanWidgetPayload) => {
			return acceptPlanReview(planWidget);
		},
		[acceptPlanReview],
	);

	// Plan approval card support
	const activePendingPlan = useMemo(() => getLatestPendingPlanWidget(chat.messages), [chat.messages]);
	const [dismissedApprovalCardKey, setDismissedApprovalCardKey] = useState<string | null>(null);
	const [isSubmittingPlanApproval, setIsSubmittingPlanApproval] = useState(false);
	const pendingPlanKey = activePendingPlan?.planWidget.deferredToolCallId ?? null;
	const shouldShowApprovalCard = activePendingPlan !== null && pendingPlanKey !== dismissedApprovalCardKey && !shouldShowQuestionCard && !chat.isStreaming;

	useEffect(() => {
		setDismissedApprovalCardKey(null);
		setIsSubmittingPlanApproval(false);
	}, [chat.runtimeThreadId]);

	const handlePlanApprovalSubmit = useCallback(
		(selection: PlanApprovalSelection) => {
			if (!activePendingPlan) return;
			setIsSubmittingPlanApproval(true);
			void (async () => {
				try {
					await chat.submitPlanApproval(activePendingPlan.planWidget, selection);
				} finally {
					setIsSubmittingPlanApproval(false);
				}
			})();
		},
		[activePendingPlan, chat],
	);
	const handleDismissApprovalCard = useCallback(() => {
		setDismissedApprovalCardKey(pendingPlanKey);
	}, [pendingPlanKey]);

	const handleOpenPlanPreview = useCallback(
		(planWidget: ParsedPlanWidgetPayload, sourceMessageId?: string) => {
			chat.openPlanAsDocument({
				title: planWidget.title,
				markdown: planWidget.markdown,
				sourceMessageId: sourceMessageId ?? null,
			});
		},
		[chat],
	);

	const resetTypedScrollAnchorState = useCallback(() => {
		pendingTypedScrollAnchorRef.current = false;
		previousTypedAnchorUserMessageIdRef.current = null;
		typedScrollAnchorSourceRef.current = "none";
		realtimeTypedResponseStartedRef.current = false;
	}, []);

	const activateTailFollowMode = useCallback(() => {
		resetTypedScrollAnchorState();
		setScrollAnchorMessageId(null);
		setScrollFollowMode("bottom");
	}, [resetTypedScrollAnchorState]);

	const queueTypedScrollAnchor = useCallback((source: Exclude<TypedScrollAnchorSource, "none">, latestUserMessageId: string | null) => {
		pendingTypedScrollAnchorRef.current = true;
		previousTypedAnchorUserMessageIdRef.current = latestUserMessageId;
		typedScrollAnchorSourceRef.current = source;
		realtimeTypedResponseStartedRef.current = false;
	}, []);

	const {
		appendRealtimeMessage,
		setChatVoiceMode,
		updateRealtimeMessage,
	} = useRovoRealtimeShellBridge<RovoAppRealtimeShellAdapter>({ chatRef });

	const injectRealtimeContext = useCallback((payload: RealtimeInjectContextPayload | null) => {
		if (!payload) {
			return;
		}

		realtimeInjectContextRef.current?.(payload);
	}, []);

	const resetRealtimeAssistantMessageState = useCallback(() => {
		realtimeAssistantMessageIdRef.current = null;
		realtimeAssistantMessagePromiseRef.current = null;
	}, []);

	const ensureRealtimeAssistantMessage = useCallback(
		async (preferredMessageId?: string | null): Promise<string | null> => {
			// If we already have an active assistant message for this user turn,
			// always reuse it. The ref is only cleared by onSpeechStarted (when
			// the user speaks again), so all GPT responses within the same turn
			// merge into one bubble.
			if (realtimeAssistantMessageIdRef.current) {
				return realtimeAssistantMessageIdRef.current;
			}

			if (realtimeAssistantMessagePromiseRef.current) {
				return realtimeAssistantMessagePromiseRef.current;
			}

			const existingMessageId = preferredMessageId && chatRef.current.messages.some((message) => message.id === preferredMessageId && message.role === "assistant") ? preferredMessageId : null;
			if (existingMessageId) {
				realtimeAssistantMessageIdRef.current = existingMessageId;
				return existingMessageId;
			}

			const assistantCreatedAt = speechStartedAtRef.current ? new Date(new Date(speechStartedAtRef.current).getTime() + 1).toISOString() : undefined;
			const messageCreationPromise = appendRealtimeMessage("assistant", "", {
				messageId: preferredMessageId ?? undefined,
				createdAt: assistantCreatedAt,
			})
				.then((createdMessageId) => {
					if (createdMessageId) {
						realtimeAssistantMessageIdRef.current = createdMessageId;
					}
					return createdMessageId;
				})
				.finally(() => {
					if (realtimeAssistantMessagePromiseRef.current === messageCreationPromise) {
						realtimeAssistantMessagePromiseRef.current = null;
					}
				});
			realtimeAssistantMessagePromiseRef.current = messageCreationPromise;
			return messageCreationPromise;
		},
		[appendRealtimeMessage],
	);

	const handleStop = useCallback(async () => {
		manualVoiceStopRef.current = true;
		await chat.interruptActiveTurn({ source: "user-stop" });
	}, [chat]);

	// --- Rovo AI cursor companion ---
	const clicky = useClicky();
	const {
		activate: activateClicky,
		isActive: isClickyActive,
		deactivate: deactivateClicky,
		startListening: clickyStartListening,
		startProcessing: clickyStartProcessing,
		startPointing: clickyStartPointing,
		startSpeaking: clickyStartSpeaking,
		returnToIdle: clickyReturnToIdle,
		addExchange: clickyAddExchange,
	} = clicky;
	const streamClickyAssistantText = useCallback((text: string) => {
		if (!text.trim()) {
			return false;
		}

		if (!isClickyActive) {
			activateClicky();
		}
		clickyStartSpeaking(text);
		return true;
	}, [activateClicky, clickyStartSpeaking, isClickyActive]);
	const [screenAssistantRegion, setScreenAssistantRegion] = useState<StudioScreenAssistantRegion | null>(null);
	const [screenAssistantRegionPainting, setScreenAssistantRegionPainting] = useState(false);

	useEffect(() => {
		if (!isClickyActive) {
			setScreenAssistantRegion(null);
			setScreenAssistantRegionPainting(false);
		}
	}, [isClickyActive]);

	const getScreenAssistantVisibleTargets = useCallback(
		() => getStudioScreenAssistantVisibleTargets(),
		[],
	);

	const getScreenAssistantSnapshot = useCallback(() => {
		const activePanel = showHomeState
			? "home"
			: chat.panelState === "preview"
				? "artifact-preview"
				: "chat";

		return createStudioScreenAssistantSnapshot({
			activeRegion: screenAssistantRegion,
			activePanel,
			composer: screenAssistantComposerRef.current,
			pointer: screenAssistantPointerRef.current,
			selectedAgent: {
				id: selectedAgent.id,
				name: selectedAgent.name,
			},
		});
	}, [chat.panelState, screenAssistantRegion, selectedAgent.id, selectedAgent.name, showHomeState]);

	const handleScreenAssistantToolCall = useCallback(
		(
			{ name, args }: RovoScreenAssistantToolCall,
			respond: RovoScreenAssistantToolResponder,
		) => {
			switch (name) {
				case "get_screen_state": {
					respond(getScreenAssistantSnapshot());
					return;
				}
				case "point_at_target": {
					const snapshot = getScreenAssistantSnapshot();
					const grounded = groundStudioScreenAssistantTarget({
						fieldId: typeof args.fieldId === "string" ? args.fieldId : undefined,
						id: typeof args.targetId === "string" ? args.targetId : undefined,
						label: typeof args.label === "string" ? args.label : undefined,
						activeRegion: snapshot.activeRegion ?? null,
						pointerTarget: snapshot.pointerContext?.target ?? null,
						visibleTargets: snapshot.visibleTargets,
					});
					const point = getViewportPointFromScreenAssistantTarget(grounded);
					const label = typeof args.label === "string" ? args.label : grounded?.label ?? "";
					let pointingStarted = false;
					if (point) {
						if (!isClickyActive) {
							activateClicky();
						}
						clickyStartPointing(point, label);
						pointingStarted = true;
					}
					respond({
						ok: pointingStarted,
						pointed: pointingStarted && grounded ? { id: grounded.id, label: grounded.label } : null,
					});
					return;
				}
				case "activate_screen_target": {
					const snapshot = getScreenAssistantSnapshot();
					respond(activateStudioScreenAssistantTarget({
						fieldId: typeof args.fieldId === "string" ? args.fieldId : undefined,
						id: typeof args.targetId === "string" ? args.targetId : undefined,
						label: typeof args.label === "string" ? args.label : undefined,
						pointerTarget: snapshot.pointerContext?.target ?? null,
						visibleTargets: snapshot.visibleTargets,
					}));
					return;
				}
				case "set_composer_text": {
					const text = typeof args.text === "string" ? args.text : "";
					composerTextRef.current = text;
					setPrefillText(text);
					setVoiceTranscript(null);
					respond({ ok: Boolean(text) });
					return;
				}
				case "submit_composer": {
					const text = composerTextRef.current.trim();
					if (text) {
						void handleComposerSubmitRef.current?.({ files: [], text });
					}
					respond({ ok: Boolean(text) });
					return;
				}
				case "apply_agent_draft_patch": {
					respond({ ok: false, error: "unsupported_surface" });
					return;
				}
				default:
					respond({ ok: false, error: "unknown_tool" });
			}
		},
		[
			activateClicky,
			clickyStartPointing,
			getScreenAssistantSnapshot,
			isClickyActive,
			setPrefillText,
			setVoiceTranscript,
		],
	);

	// --- Realtime voice (live conversation mode) ---
		const realtime = useRealtimeVoice({
			onDelegateToRovo: useCallback(
				async (request: DelegationRequest) => {
					if (isDictationActiveRef.current) {
						return;
					}

					try {
					const c = chatRef.current as RovoAppRealtimeShellAdapter;
					const contextDescription = mergeContextDescriptions(request.conversationSummary ? `[Voice context] ${request.conversationSummary}` : undefined, annotationContextRef.current);
					const extendedRequest = request as ExtendedDelegationRequest;
					const delegatedMessageId = extendedRequest.delegatedMessageId ?? extendedRequest.realtimeMessageId ?? extendedRequest.messageId ?? realtimeUserMessageIdRef.current;

					if (delegatedMessageId && typeof c.delegateToRovo === "function") {
						await c.delegateToRovo(delegatedMessageId, {
							...buildPromptOptions(contextDescription),
							conversationSummary: request.conversationSummary,
							existingRealtimeMessageId: realtimeAssistantMessageIdRef.current ?? undefined,
							intentType: request.intentType,
							prompt: request.prompt,
							referencedFiles: request.referencedFiles,
							urgency: request.urgency,
						});
						return;
					}

					if (c.isStreaming && c.panelState === "preview") {
						await c.applyVoiceSteer({
							...buildPromptOptions(contextDescription),
							text: request.prompt,
						});
					} else {
						if (c.isStreaming) {
							await c.interruptActiveTurn({ source: "voice-barge-in" });
						}
						await c.submitPrompt({
							...buildPromptOptions(contextDescription),
							text: request.prompt,
							files: [],
						});
					}
				} catch (error) {
					injectRealtimeContext({
						type: "delegation_error",
						content: error instanceof Error ? error.message : "Rovo failed to process the delegated request.",
					});
					throw error;
				}
			},
			[buildPromptOptions, injectRealtimeContext],
			),
			onSpeechStarted: useCallback(() => {
				if (isDictationActiveRef.current) {
					setDictationTranscriptPreview(null);
					return;
				}

				activateTailFollowMode();
			speechStartedAtRef.current = new Date().toISOString();
			realtimeUserTranscriptHasDeltaRef.current = false;
			resetRealtimeAssistantMessageState();
			realtimeUserMessageIdRef.current = null;
			setVoiceTranscript(null);

			// Rovo: transition to listening
			if (isClickyActive) {
				clickyStartListening();
			}

			const annotationContext = annotationContextRef.current;
			if (!annotationContext) {
				return;
			}

			injectRealtimeContext({
				type: "artifact_annotations",
				content: annotationContext,
			});
		}, [activateTailFollowMode, injectRealtimeContext, isClickyActive, clickyStartListening, resetRealtimeAssistantMessageState]),
		onSpeechTranscriptDelta: useCallback((payload: RealtimeSpeechTranscriptPayload) => {
			// Browser SpeechRecognition sends { text } (full replacement);
			// OpenAI transcription deltas send { delta, text } (accumulated).
			// Live chat keeps these deltas out of the composer; dictation owns
			// visible transcript preview and explicit accept/cancel behavior.
			const text = typeof payload === "string" ? payload : (payload.text ?? payload.delta ?? "");
			if (!text) {
				return;
			}

			if (isDictationActiveRef.current) {
				setDictationTranscriptPreview(text);
				const nextText = appendDictationTranscript(dictationCommittedTextRef.current ?? dictationBaselineRef.current ?? "", text);
				composerTextRef.current = nextText;
				setVoiceTranscript(nextText);
				setComposerFocusRequestKey((currentKey) => currentKey + 1);
				return;
			}

			realtimeUserTranscriptHasDeltaRef.current = true;
			}, []),
		onSpeechTranscriptCompleted: useCallback(
			async (payload: RealtimeSpeechTranscriptPayload) => {
				const transcript = typeof payload === "string" ? payload : (payload.transcript ?? payload.text ?? "");

				if (isDictationActiveRef.current) {
					if (!transcript.trim()) {
						return;
					}

					const nextText = appendDictationTranscript(dictationCommittedTextRef.current ?? dictationBaselineRef.current ?? "", transcript);
					dictationCommittedTextRef.current = nextText;
					composerTextRef.current = nextText;
					setDictationTranscriptPreview(transcript);
					setVoiceTranscript(nextText);
					setComposerFocusRequestKey((currentKey) => currentKey + 1);
					return;
				}

				// Rovo: transition to processing and record user exchange
				if (isClickyActive) {
					clickyStartProcessing();
					if (transcript) {
						clickyAddExchange({ role: "user", content: transcript });
					}
				}

				// If the user manually stopped voice, skip auto-submit and keep
				// partial transcript text out of the composer.
				if (manualVoiceStopRef.current) {
					manualVoiceStopRef.current = false;
					setVoiceTranscript(null);
					return;
				}

				if (!transcript) {
					setVoiceTranscript(null);
					return;
				}

				const messageId = await appendRealtimeMessage("user", transcript, {
					createdAt: speechStartedAtRef.current ?? undefined,
				});
				if (messageId) {
					realtimeUserMessageIdRef.current = messageId;
				}
				speechStartedAtRef.current = null;
				realtimeUserTranscriptHasDeltaRef.current = false;
				setVoiceTranscript(null);
			},
			[appendRealtimeMessage, isClickyActive, clickyStartProcessing, clickyAddExchange],
			),
		onTextResponseStart: useCallback(
			async (payload?: { messageId?: string }) => {
				if (isDictationActiveRef.current) {
					return;
				}

				if (typedScrollAnchorSourceRef.current === "realtime") {
					realtimeTypedResponseStartedRef.current = true;
				}
				realtimeAssistantMessageIdRef.current = await ensureRealtimeAssistantMessage(payload?.messageId ?? null);
			},
			[ensureRealtimeAssistantMessage],
			),
		onAssistantTextDelta: useCallback(
			async (payload: RealtimeAssistantTextPayload) => {
				if (isDictationActiveRef.current) {
					return;
				}

				const text = typeof payload === "string" ? payload : (payload.text ?? "");
				const replace = typeof payload === "string" ? false : payload.replace === true;
				const delta = typeof payload === "string" ? payload : (payload.delta ?? payload.text ?? "");
				if (!delta) {
					return;
				}

				if (text) {
					streamClickyAssistantText(text);
				}

				if (typeof payload !== "string" && payload.displayOnly === true) {
					return;
				}

				const messageId = typeof payload === "string" ? await ensureRealtimeAssistantMessage() : await ensureRealtimeAssistantMessage(payload.messageId ?? null);
				await updateRealtimeMessage(messageId, replace ? text : delta, replace ? { replace: true } : undefined);
			},
			[ensureRealtimeAssistantMessage, updateRealtimeMessage, streamClickyAssistantText],
			),
		onAssistantTextCompleted: useCallback(
			async (payload: RealtimeAssistantTextCompletedPayload) => {
				if (isDictationActiveRef.current) {
					return;
				}

				const text = typeof payload === "string" ? payload : (payload.text ?? "");
				if (!text) {
					return;
				}

				// Cursor companion: animate "speaking" while the assistant talks.
				// Pointing is driven separately by the point_at_target tool.
				streamClickyAssistantText(text);
				clickyAddExchange({ role: "assistant", content: text });

				const messageId = typeof payload === "string" ? await ensureRealtimeAssistantMessage() : await ensureRealtimeAssistantMessage(payload.messageId ?? null);
				await updateRealtimeMessage(messageId, text, {
					replace: true,
				});
			},
			[ensureRealtimeAssistantMessage, updateRealtimeMessage, streamClickyAssistantText, clickyAddExchange],
			),
		onEndVoiceSession: useCallback(() => {
			manualVoiceStopRef.current = true;
			speechStartedAtRef.current = null;
			realtimeUserMessageIdRef.current = null;
			setVoiceTranscript(null);
		}, []),
		onToolCall: useCallback(
			({ name, args, callId }: { name: string; args: Record<string, unknown>; callId: string }) => {
				const respond = (output: unknown, createResponse?: boolean) =>
					sendFunctionCallOutputRef.current?.({
						callId,
						output,
						...(createResponse === false ? { createResponse: false } : {}),
					});

				handleScreenAssistantToolCall({ args, callId, name }, respond);
			},
			[handleScreenAssistantToolCall],
		),
		chatMessages: chat.messages,
		isGenerating: chat.isStreaming,
	} satisfies RealtimeVoiceShellOptions) as RealtimeVoiceShellResult;

	useEffect(() => {
		sendFunctionCallOutputRef.current = realtime.sendFunctionCallOutput;
	}, [realtime.sendFunctionCallOutput]);

	const isRealtimeActive = realtime.voiceState !== "idle";

	// --- Rovo voice bridge ---
	useClickyVoice({
		isClickyActive,
		isRealtimeConnected: realtime.isConnected,
		connectRealtime: realtime.connect,
		injectContext: realtime.injectContext,
	});

	const realtimeStatusMessage = resolveRealtimeStatusMessage(realtime);
	const shouldChatVoiceModeBeEnabled = isRealtimeActive;
	const realtimeSessionIdentity = resolveRealtimeSessionIdentity(realtime, chat.activeThreadId, chat.runtimeThreadId);
	const wasRealtimeStreamingRef = useRef(false);
	const dictationState = resolveComposerDictationState({
		active: isDictationActive,
		voiceState: realtime.voiceState,
	});

	useEffect(() => {
		realtimeInjectContextRef.current = realtime.injectContext as typeof realtimeInjectContextRef.current;
	}, [realtime.injectContext]);

	useEffect(() => {
		if (shouldChatVoiceModeBeEnabled !== chat.isVoiceMode) {
			setChatVoiceMode(shouldChatVoiceModeBeEnabled);
		}
	}, [chat.isVoiceMode, setChatVoiceMode, shouldChatVoiceModeBeEnabled]);

	// Inject Rovo results back into GPT session for context continuity
	useEffect(() => {
		if (wasRealtimeStreamingRef.current && !chat.isStreaming && isRealtimeActive) {
			const lastAssistantMessage = [...chat.messages].reverse().find((m) => m.role === "assistant");
			if (lastAssistantMessage) {
				const text = getMessageText(lastAssistantMessage);
				const artifact = getMessageArtifactResult(lastAssistantMessage);
				const summary = artifact ? `Rovo ${artifact.action === "update" ? "updated" : "created"} artifact "${artifact.title}". ${text || ""}` : text || "Rovo completed the task.";
				injectRealtimeContext({
					type: "thread_message",
					content: summary.slice(0, REALTIME_RESULT_SUMMARY_MAX_CHARS),
				});
			}
		}
		wasRealtimeStreamingRef.current = chat.isStreaming;
	}, [chat.isStreaming, chat.messages, injectRealtimeContext, isRealtimeActive]);

	useEffect(() => {
		if (!isRealtimeActive || !realtimeSessionIdentity) {
			injectedRealtimeThreadContextKeyRef.current = null;
			return;
		}

		const contextKey = `${chat.activeThreadId ?? chat.runtimeThreadId}:${realtimeSessionIdentity}`;
		if (injectedRealtimeThreadContextKeyRef.current === contextKey) {
			return;
		}

		const summary = buildRealtimeThreadSummary(chat.messages);
		if (summary) {
			injectRealtimeContext({
				type: "thread_context",
				summary,
			});
		}
		injectedRealtimeThreadContextKeyRef.current = contextKey;
	}, [chat.activeThreadId, chat.messages, chat.runtimeThreadId, injectRealtimeContext, isRealtimeActive, realtimeSessionIdentity]);

	const startRealtimeVoice = useCallback(() => {
		if (isDictationActiveRef.current) {
			isDictationActiveRef.current = false;
			dictationBaselineRef.current = null;
			dictationCommittedTextRef.current = null;
			setIsDictationActive(false);
			setDictationTranscriptPreview(null);
		}

		manualVoiceStopRef.current = false;
		activateClicky();
		realtime.connect();
	}, [activateClicky, realtime]);

	const handleToggleRealtimeVoice = useCallback(() => {
		if (realtime.voiceState === "idle") {
			startRealtimeVoice();
			return;
		}

		realtimeUserMessageIdRef.current = null;
		resetRealtimeAssistantMessageState();
		speechStartedAtRef.current = null;
		// Set flag to prevent auto-submit race from a late transcription_completed
		manualVoiceStopRef.current = true;
		setVoiceTranscript(null);
		realtime.disconnect();
		deactivateClicky();
	}, [deactivateClicky, realtime, resetRealtimeAssistantMessageState, startRealtimeVoice]);

	const handleToggleClicky = useCallback(() => {
		if (isClickyActive) {
			deactivateClicky();
			return;
		}

		activateClicky();
		if (realtime.voiceState === "idle") {
			startRealtimeVoice();
		}
	}, [activateClicky, deactivateClicky, isClickyActive, realtime.voiceState, startRealtimeVoice]);

	// Keyboard shortcuts for Rovo
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Cmd+Shift+K (Mac) / Ctrl+Shift+K (other) toggles Rovo
			if (e.key === "K" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleToggleClicky();
				return;
			}

			// Escape deactivates Rovo
			if (e.key === "Escape" && isClickyActive) {
				deactivateClicky();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [deactivateClicky, handleToggleClicky, isClickyActive]);

	const handleStartDictation = useCallback(() => {
		if (realtime.voiceState !== "idle") {
			realtimeUserMessageIdRef.current = null;
			resetRealtimeAssistantMessageState();
			speechStartedAtRef.current = null;
			manualVoiceStopRef.current = true;
			realtime.disconnect();
		}

		const baselineText = composerTextRef.current;
		dictationBaselineRef.current = baselineText;
		dictationCommittedTextRef.current = baselineText;
		isDictationActiveRef.current = true;
		setIsDictationActive(true);
		setDictationTranscriptPreview(null);
		setPrefillText(null);
		setVoiceTranscript(baselineText);
		setComposerFocusRequestKey((currentKey) => currentKey + 1);
		realtime.connect({ transcriptionOnly: true });
	}, [realtime, resetRealtimeAssistantMessageState]);

	const handleStopDictation = useCallback(() => {
		dictationBaselineRef.current = null;
		dictationCommittedTextRef.current = null;
		isDictationActiveRef.current = false;
		manualVoiceStopRef.current = true;
		setIsDictationActive(false);
		setDictationTranscriptPreview(null);
		setPrefillText(null);
		setVoiceTranscript(composerTextRef.current);
		realtime.disconnect();
	}, [realtime]);

	const handleComposerSubmit = useCallback(
		async ({ files, text }: { files: FileUIPart[]; text: string }) => {
			const realtimeChat = chatRef.current as RovoAppRealtimeShellAdapter;
			const realtimeVoice = realtime as RealtimeVoiceShellResult;
			const contextDescription = annotationContextRef.current ?? undefined;
			const promptOptions = buildPromptOptions(contextDescription);
			const latestUserMessageIdBeforeSubmit = getLatestUserMessageId(chat.messages);

			if (isRealtimeActive) {
				if (typeof realtimeChat.submitRealtimeText === "function") {
					queueTypedScrollAnchor("realtime", latestUserMessageIdBeforeSubmit);
					try {
						await realtimeChat.submitRealtimeText({
							...promptOptions,
							files,
							text,
						});
						clearPrefillSources();
					} catch (error) {
						resetTypedScrollAnchorState();
						throw error;
					}
					return;
				}

				if (typeof realtimeVoice.sendTextInput === "function") {
					queueTypedScrollAnchor("realtime", latestUserMessageIdBeforeSubmit);
					resetRealtimeAssistantMessageState();

					// Cursor companion: show processing for text input sent through voice mode.
					if (isClickyActive) {
						clickyAddExchange({ role: "user", content: text });
						clickyStartProcessing();
					}

					let messageId: string | null = null;
					if (typeof realtimeChat.appendRealtimeMessage === "function") {
						messageId = await appendRealtimeMessage("user", text, {
							contextDescription,
						});
						if (messageId) {
							realtimeUserMessageIdRef.current = messageId;
						}
					}

						try {
							await realtimeVoice.sendTextInput({
								contextDescription,
								messageId: messageId ?? undefined,
								text,
							});
						} catch (error) {
							resetTypedScrollAnchorState();
							throw error;
						}
						clearPrefillSources();
						return;
					}
				}

			const trimmedText = text.trim();
			const shouldShowOptimisticPrompt = !chat.shouldQueueNextSubmission && (trimmedText || files.length > 0);
			if (shouldShowOptimisticPrompt) {
				setOptimisticUserMessage(
					createRovoAppUserMessage({
						id: createId("rovo-app-user"),
						createdAt: new Date().toISOString(),
						files,
						text: trimmedText,
					}),
				);
			}

			queueTypedScrollAnchor("standard", latestUserMessageIdBeforeSubmit);
			try {
				await realtimeChat.submitPrompt({
					...promptOptions,
					files,
					text,
				});
				clearPrefillSources();
			} catch (error) {
				setOptimisticUserMessage(null);
				resetTypedScrollAnchorState();
				throw error;
			}
		},
		[
			appendRealtimeMessage,
			chat.messages,
			isRealtimeActive,
			isClickyActive,
			clickyAddExchange,
			clickyStartProcessing,
			queueTypedScrollAnchor,
			realtime,
			resetRealtimeAssistantMessageState,
			resetTypedScrollAnchorState,
			setOptimisticUserMessage,
			buildPromptOptions,
			clearPrefillSources,
			chat.shouldQueueNextSubmission,
		],
	);
	useEffect(() => {
		handleComposerSubmitRef.current = handleComposerSubmit;
	}, [handleComposerSubmit]);

	const timelineItems = useMemo(() => {
		return deriveRovoAppTimelineItems(displayMessages);
	}, [displayMessages]);
	const latestTimelineMessageId = timelineItems[0]?.id ?? null;
	const scrollActiveTimelineId = scrollActiveTimelineSelection
		&& scrollActiveTimelineSelection.runtimeThreadId === chat.runtimeThreadId
		&& scrollActiveTimelineSelection.latestTimelineMessageId === latestTimelineMessageId
		? scrollActiveTimelineSelection.messageId
		: null;
	const activeTimelineMessageId = scrollActiveTimelineId ?? latestTimelineMessageId;
	const handleScrollActiveTimelineChange = useCallback((messageId: string | null) => {
		setScrollActiveTimelineSelection(
			messageId
				? {
					latestTimelineMessageId,
					messageId,
					runtimeThreadId: chat.runtimeThreadId,
				}
				: null,
		);
	}, [chat.runtimeThreadId, latestTimelineMessageId]);

	useEffect(() => {
		if (!optimisticUserMessage) {
			return;
		}

		const hasVisibleUserMessage = chat.messages.some((message) => {
			if (message.role !== "user") {
				return false;
			}

			return message.id === optimisticUserMessage.id || getMessageText(message).trim() === getMessageText(optimisticUserMessage).trim();
		});

		if (hasVisibleUserMessage) {
			setOptimisticUserMessage(null);
		}
	}, [chat.messages, optimisticUserMessage]);

	useEffect(() => {
		const latestUserMessageId = getLatestUserMessageId(chat.messages);
		if (pendingTypedScrollAnchorRef.current && latestUserMessageId && latestUserMessageId !== previousTypedAnchorUserMessageIdRef.current) {
			pendingTypedScrollAnchorRef.current = false;
			previousTypedAnchorUserMessageIdRef.current = null;
			setScrollAnchorMessageId(latestUserMessageId);
			setScrollFollowMode("target");
		}
	}, [chat.messages]);

	useEffect(() => {
		activateTailFollowMode();
	}, [activateTailFollowMode, chat.runtimeThreadId]);

	useEffect(() => {
		if (typedScrollAnchorSourceRef.current !== "realtime" || !realtimeTypedResponseStartedRef.current) {
			return;
		}

		if (realtime.generationState !== "complete" && realtime.generationState !== "idle") {
			return;
		}

		activateTailFollowMode();
	}, [activateTailFollowMode, realtime.generationState]);

	useEffect(() => {
		if (typedScrollAnchorSourceRef.current !== "standard" || chat.isStreaming) {
			return;
		}

		activateTailFollowMode();
	}, [activateTailFollowMode, chat.isStreaming]);

	const visibleWorkspaceDocumentId = chat.visibleArtifactDocumentId;
	const workspaceDocument = useMemo(() => {
		return visibleWorkspaceDocumentId && chat.streamingArtifact?.documentId === visibleWorkspaceDocumentId
			? {
					id: chat.streamingArtifact.documentId ?? "streaming-artifact",
					threadId: chat.activeThreadId ?? chat.runtimeThreadId,
					title: chat.streamingArtifact.title || "Artifact draft",
					kind: chat.streamingArtifact.kind,
					sourceMessageId: null,
					createdAt: chat.streamingArtifact.createdAt,
					updatedAt: chat.streamingArtifact.updatedAt,
					versions: [
						{
							changeLabel: "Generating",
							id: "streaming",
							content: chat.streamingArtifact.content,
							createdAt: chat.streamingArtifact.updatedAt,
							title: chat.streamingArtifact.title || "Artifact draft",
						},
					],
				}
			: visibleWorkspaceDocumentId
				? (chat.documents.find((document) => document.id === visibleWorkspaceDocumentId) ?? null)
				: null;
	}, [chat.activeThreadId, chat.documents, chat.runtimeThreadId, chat.streamingArtifact, visibleWorkspaceDocumentId]);
	const selectedDocumentVersion = useMemo(() => {
		return workspaceDocument?.versions.find((version) => version.id === chat.selectedVersionId) ?? workspaceDocument?.versions.at(-1) ?? null;
	}, [chat.selectedVersionId, workspaceDocument]);
	// Derive the latest browser state from message data parts
	const latestBrowserArtifact = useMemo(() => {
		let browserState = null;
		let browserStateMessageId: string | null = null;
		let browserScreenshot = null;

		for (let i = chat.messages.length - 1; i >= 0; i--) {
			const message = chat.messages[i];
			if (!browserState) {
				const part = getLatestDataPart(message, "data-browser-state");
				if (part) {
					browserState = part.data;
					browserStateMessageId = message.id;
				}
			}

			if (!browserScreenshot) {
				const part = getLatestDataPart(message, "data-browser-screenshot");
				if (part) {
					browserScreenshot = part.data;
				}
			}

			if (browserState && browserScreenshot) {
				break;
			}
		}

		return {
			browserArtifactKey: buildRovoAppBrowserArtifactKey({
				browserScreenshot,
				browserState,
				messageId: browserStateMessageId,
			}),
			browserScreenshot,
			browserState,
		};
	}, [chat.messages]);
	const browserArtifactKey = latestBrowserArtifact.browserArtifactKey;
	const browserState = latestBrowserArtifact.browserState;
	const browserScreenshot = latestBrowserArtifact.browserScreenshot;

	useEffect(() => {
		setDismissedBrowserArtifactKey(null);
	}, [chat.runtimeThreadId]);

	// Auto-open artifact panel when browser state arrives and no document artifact is active
	useEffect(() => {
		if (shouldAutoOpenRovoAppBrowserArtifact({
			browserArtifactKey,
			dismissedBrowserArtifactKey,
			hasWorkspaceDocument: Boolean(workspaceDocument),
			panelState: chat.panelState,
		})) {
			chat.setPanelState("preview");
		}
	}, [browserArtifactKey, chat, dismissedBrowserArtifactKey, workspaceDocument]);
	const shouldShowReopenBrowserPreviewControl = shouldShowReopenRovoAppBrowserArtifactControl({
		browserArtifactKey,
		dismissedBrowserArtifactKey,
		hasWorkspaceDocument: Boolean(workspaceDocument),
		panelState: chat.panelState,
	});
	const shouldShowDirectoryAutocompleteList =
		showHomeState &&
		directoryAutocompleteState !== null &&
		directoryAutocompleteState.matches.length > 0;
	const shouldHideHomePromptGallery =
		showHomeState &&
		directoryAutocompleteState !== null;
	const directoryAutocompleteLayoutWidth = shellSize.width || viewportWidthPx || 0;
	const shouldUseWideDirectoryAutocompleteLayout = directoryAutocompleteLayoutWidth >= 760;
	const shouldReduceMotion = useReducedMotion();
	const shouldShowTimelineNavigator = !showHomeState && !isArtifactOpen && timelineItems.length > 1;
	const composerPreviewState = resolveRovoAppComposerPlaceholder({
		defaultPlaceholder: DEFAULT_COMPOSER_PLACEHOLDER,
		previewPrompt,
		showHomeState,
	});
	useEffect(() => {
		screenAssistantComposerRef.current = {
			hasPrefill: Boolean(voiceTranscript ?? prefillText),
			placeholder: composerPreviewState.placeholder,
		};
	}, [composerPreviewState.placeholder, prefillText, voiceTranscript]);
	const canAnnotateWorkspaceDocument = workspaceDocument !== null;
	const annotationState = useArtifactAnnotations({
		active: cursorMode && isArtifactOpen && !chat.streamingArtifact && chat.artifactMode === "preview" && process.env.NODE_ENV === "development",
		documentId: workspaceDocument?.id ?? null,
		documentKind: workspaceDocument?.kind ?? null,
		documentVersionId: selectedDocumentVersion?.id ?? null,
		containerRef: artifactContentRef,
	});
	const {
		annotations: artifactAnnotations,
		addComment: addArtifactAnnotationComment,
		clearAnnotations,
		dismissSelection: dismissArtifactSelection,
		formatContextForVoice,
		pendingSelection: pendingArtifactSelection,
		removeAnnotation: removeArtifactAnnotation,
	} = annotationState;

	const handleApplyAnnotations = useCallback(
		(annotationsToApply: ArtifactAnnotation[]) => {
			if (annotationsToApply.length === 0) {
				return;
			}

			for (const annotation of annotationsToApply) {
				const contextDescription = formatAnnotationsForVoiceContext([annotation]);
				void chat
					.submitPrompt({
						...buildPromptOptions(contextDescription),
						text: annotation.comment,
						files: [],
					})
					.catch(() => {});
			}

			clearAnnotations();
			setCursorMode(false);
		},
		[buildPromptOptions, chat, clearAnnotations],
	);

	const shellRef = useRef<HTMLDivElement | null>(null);
	const composerDockRef = useRef<HTMLDivElement | null>(null);
	const artifactCardOriginRef = useRef<DOMRect | null>(null);
	const artifactPreviewOriginRef = useLazyRef<Map<string, DOMRect>>(() => new Map());
	const [artifactOrigin, setArtifactOrigin] = useState({
		left: 0,
		top: 0,
		width: 320,
		height: 96,
	});
	const artifactSplitChatPaneWidthRef = useRef<number | null>(null);
	const artifactLayout = getRovoAppShellLayout(shellSize.width);
	const shouldSplitArtifactPane = isArtifactOpen && artifactLayout.mode === "split";
	const splitChatPaneMaxSize = shouldSplitArtifactPane
		? Math.min(ROVO_APP_MAX_CHAT_PANE_WIDTH, Math.max(ROVO_APP_MIN_CHAT_PANE_WIDTH, shellSize.width - ROVO_APP_MIN_ARTIFACT_PANE_WIDTH))
		: ROVO_APP_MAX_CHAT_PANE_WIDTH;
	const splitChatPaneDefaultSize = shouldSplitArtifactPane
		? clamp(artifactSplitChatPaneWidthRef.current ?? artifactLayout.chatPaneWidth ?? ROVO_APP_MIN_CHAT_PANE_WIDTH, ROVO_APP_MIN_CHAT_PANE_WIDTH, splitChatPaneMaxSize)
		: ROVO_APP_MIN_CHAT_PANE_WIDTH;
	const splitArtifactPaneDefaultSize = shouldSplitArtifactPane ? Math.max(ROVO_APP_MIN_ARTIFACT_PANE_WIDTH, shellSize.width - splitChatPaneDefaultSize) : ROVO_APP_MIN_ARTIFACT_PANE_WIDTH;

	useEffect(() => {
		if (!isRealtimeActive) {
			injectedRealtimeArtifactContextKeyRef.current = null;
			return;
		}

		const artifactContext = buildRealtimeArtifactContextSummary({
			annotationContext: annotationContextRef.current,
			document: workspaceDocument
				? {
						id: workspaceDocument.id,
						kind: workspaceDocument.kind,
						title: workspaceDocument.title,
					}
				: null,
		});
		if (!artifactContext) {
			return;
		}

		const contextKey = [workspaceDocument?.id ?? "none", selectedDocumentVersion?.id ?? "latest", annotationContextRef.current ?? "no-annotations"].join(":");
		if (injectedRealtimeArtifactContextKeyRef.current === contextKey) {
			return;
		}

		injectRealtimeContext({
			type: "artifact_context",
			content: artifactContext,
		});
		injectedRealtimeArtifactContextKeyRef.current = contextKey;
	}, [injectRealtimeContext, isRealtimeActive, selectedDocumentVersion?.id, workspaceDocument]);

	useEffect(() => {
		if (isArtifactOpen || visibleMessages.length > 0) {
			setGalleryExpanded(false);
		}
	}, [isArtifactOpen, visibleMessages.length]);

	useEffect(() => {
		if (!showHomeState && previewPrompt !== null) {
			setPreviewPrompt(null);
		}
	}, [previewPrompt, showHomeState]);

	useEffect(() => {
		const nextContext = formatContextForVoice().trim();
		annotationContextRef.current = nextContext.length > 0 ? nextContext : null;
	}, [artifactAnnotations, formatContextForVoice]);

	useEffect(() => {
		if (!isArtifactOpen) {
			setCursorMode(false);
		}
	}, [isArtifactOpen]);

	useEffect(() => {
		if (chat.streamingArtifact) {
			setCursorMode(false);
		}
	}, [chat.streamingArtifact]);

	useEffect(() => {
		if (!canAnnotateWorkspaceDocument) {
			setCursorMode(false);
		}
	}, [canAnnotateWorkspaceDocument]);

	useEffect(() => {
		clearAnnotations();
	}, [clearAnnotations, workspaceDocument?.id]);

	useEffect(() => {
		clearAnnotations();
	}, [clearAnnotations, selectedDocumentVersion?.id]);

	useEffect(() => {
		if (chat.artifactMode !== "preview") {
			setCursorMode(false);
			clearAnnotations();
		}
	}, [chat.artifactMode, clearAnnotations]);

	useEffect(() => {
		const updateViewportWidth = () => {
			if (typeof window === "undefined") {
				return;
			}

			const width = Math.max(1, Math.round(window.innerWidth));
			setViewportWidthPx((prev) => (prev === width ? prev : width));
		};

		updateViewportWidth();
		window.addEventListener("resize", updateViewportWidth);
		return () => window.removeEventListener("resize", updateViewportWidth);
	}, []);

	useEffect(() => {
		const shellElement = shellRef.current;
		if (!shellElement || typeof ResizeObserver === "undefined") {
			return;
		}

		const updateBounds = () => {
			setShellSize((prev) => {
				const width = shellElement.clientWidth;
				const height = shellElement.clientHeight;
				return prev.width === width && prev.height === height ? prev : { width, height };
			});
		};

		updateBounds();
		const observer = new ResizeObserver(() => {
			updateBounds();
		});
		observer.observe(shellElement);
		return () => observer.disconnect();
	}, []);

	const handleOpenArtifactFromCard = useCallback(
		(documentId: string, element: HTMLElement) => {
			const shellElement = shellRef.current;
			if (shellElement) {
				const shellRect = shellElement.getBoundingClientRect();
				const cardRect = element.getBoundingClientRect();
				artifactCardOriginRef.current = new DOMRect(cardRect.left - shellRect.left, cardRect.top - shellRect.top, cardRect.width, cardRect.height);
			}
			void chat.openDocument(documentId);
		},
		[chat],
	);

		const handleRegisterArtifactCard = useCallback((documentId: string, element: HTMLElement) => {
			const shellElement = shellRef.current;
			if (!shellElement) {
				return;
			}

			const shellRect = shellElement.getBoundingClientRect();
			const cardRect = element.getBoundingClientRect();
			artifactPreviewOriginRef.current.set(documentId, new DOMRect(cardRect.left - shellRect.left, cardRect.top - shellRect.top, cardRect.width, cardRect.height));
		}, [artifactPreviewOriginRef]);

	useEffect(() => {
		if (!isArtifactOpen) {
			return;
		}

		const cardOrigin = artifactCardOriginRef.current;
		if (cardOrigin) {
			artifactCardOriginRef.current = null;
			setArtifactOrigin({
				left: Math.max(cardOrigin.x, 16),
				top: Math.max(cardOrigin.y, 16),
				width: Math.min(Math.max(cardOrigin.width, 260), 420),
				height: Math.min(Math.max(cardOrigin.height, 40), 140),
			});
			return;
		}

		const previewOrigin = workspaceDocument?.id ? (artifactPreviewOriginRef.current.get(workspaceDocument.id) ?? null) : null;
		if (previewOrigin) {
			setArtifactOrigin({
				left: Math.max(previewOrigin.x, 16),
				top: Math.max(previewOrigin.y, 16),
				width: Math.min(Math.max(previewOrigin.width, 260), 420),
				height: Math.min(Math.max(previewOrigin.height, 40), 220),
			});
			return;
		}

		const shellElement = shellRef.current;
		const composerElement = composerDockRef.current;
		if (!shellElement || !composerElement) {
			return;
		}

		const shellRect = shellElement.getBoundingClientRect();
		const composerRect = composerElement.getBoundingClientRect();
		const nextWidth = Math.min(Math.max(composerRect.width - 56, 260), 420);
		const nextHeight = Math.min(Math.max(composerRect.height, 72), 140);
		const nextLeft = Math.max(composerRect.left - shellRect.left + 28, 16);
		const nextTop = Math.max(composerRect.top - shellRect.top + 8, 16);

		setArtifactOrigin({
			left: nextLeft,
			top: nextTop,
			width: nextWidth,
			height: nextHeight,
		});
		}, [artifactPreviewOriginRef, isArtifactOpen, workspaceDocument?.id]);

	const handleArtifactSplitLayoutChanged = useCallback(
		(layout: Record<string, number>) => {
			const nextChatPanePercentage = layout[ROVO_APP_SPLIT_CHAT_PANEL_ID];
			if (!Number.isFinite(nextChatPanePercentage) || shellSize.width <= 0) {
				return;
			}

			artifactSplitChatPaneWidthRef.current = Math.round((shellSize.width * nextChatPanePercentage) / 100);
		},
		[shellSize.width],
	);

	const sortedArtifacts = sortRovoAppArtifacts(chat.documents);
	const artifactMenuItems = (() => {
		const items = sortedArtifacts.map((artifact) => ({
			id: artifact.id,
			typeLabel: getRovoAppArtifactTypeLabel(artifact),
			title: artifact.title,
		}));
		const seenIds = new Set(items.map((item) => item.id));

		for (let index = chat.messages.length - 1; index >= 0; index--) {
			const artifactResult = getMessageArtifactResult(chat.messages[index]);
			if (!artifactResult || seenIds.has(artifactResult.documentId)) {
				continue;
			}

			seenIds.add(artifactResult.documentId);
			items.push({
				id: artifactResult.documentId,
				typeLabel: getRovoAppArtifactKindLabel(artifactResult.kind),
				title: artifactResult.title,
			});
		}

		return items;
	})();

	const handleCloseArtifactPane = useCallback(() => {
		if (!workspaceDocument) {
			return;
		}

		if (chat.streamingArtifact?.documentId !== workspaceDocument.id) {
			chat.setActiveDocumentId(null);
		}
		chat.hideArtifactPane();
	}, [workspaceDocument, chat]);

	const handleOpenBrowserPreview = useCallback(() => {
		setDismissedBrowserArtifactKey(null);
		if (chat.panelState === "closed") {
			chat.setPanelState("preview");
		}
	}, [chat]);

	const handleCloseBrowserPreview = useCallback(() => {
		if (browserArtifactKey) {
			setDismissedBrowserArtifactKey(browserArtifactKey);
		}
		chat.hideArtifactPane();
	}, [browserArtifactKey, chat]);

	const artifactPane = (() => {
		if (!isArtifactOpen) {
			return null;
		}

		if (!workspaceDocument && browserState) {
			return (
				<RovoAppBrowserArtifact
					url={browserState.url}
					title={browserState.title}
					status={browserState.status}
					screenshot={browserScreenshot}
					streamConfig={browserState.streamConfig ?? null}
					workspaceId={browserState.workspaceId ?? null}
					onClose={handleCloseBrowserPreview}
				/>
			);
		}

		if (!workspaceDocument) {
			return null;
		}

		return (
			<ArtifactPanel
				annotations={artifactAnnotations}
				contentRef={artifactContentRef}
				cursorMode={cursorMode}
				document={workspaceDocument}
				draftContent={chat.streamingArtifact?.content ?? chat.artifactDraftContent}
				isStreaming={Boolean(chat.streamingArtifact)}
				mode={chat.artifactMode}
				onAddComment={addArtifactAnnotationComment}
				onApplyAnnotations={handleApplyAnnotations}
				onClose={handleCloseArtifactPane}
				onCursorModeChange={canAnnotateWorkspaceDocument ? setCursorMode : undefined}
				onDelete={() => chat.deleteDocument(workspaceDocument.id)}
				onDraftChange={chat.setArtifactDraftContent}
				onDismissSelection={dismissArtifactSelection}
				onModeChange={chat.setArtifactMode}
				onRemoveAnnotation={removeArtifactAnnotation}
				onSave={chat.saveArtifactDraft}
				onVersionChange={(versionId) => {
					chat.setSelectedVersionId(versionId);
					const nextVersion = workspaceDocument?.versions.find((version) => version.id === versionId) ?? selectedDocumentVersion;
					chat.setArtifactDraftContent(nextVersion?.content ?? "");
				}}
				pendingSelection={pendingArtifactSelection}
				selectedVersionId={selectedDocumentVersion?.id ?? null}
			/>
		);
	})();

	const chatPane = (
		<>
			<ViewTransition key={chat.runtimeThreadId} enter="fade-in" exit="fade-out" default="none">
				<RovoAppMessages
					activeDocumentId={chat.activeDocument?.id ?? null}
					compact={isArtifactOpen}
					extraHorizontalPaddingWhenCompact
					isMaxMode={chat.isPlanMode}
					documents={chat.documents}
					editingMessageId={chat.editingMessageId}
					hideCustomAgentStarters={showHomeState && directoryAutocompleteState !== null}
					isStreaming={chat.isStreaming}
					messages={displayMessages}
					onBuildPlan={handleBuildPlan}
					onEditMessage={chat.editMessage}
					onOpenArtifactFromCard={handleOpenArtifactFromCard}
					onOpenBrowserPreview={handleOpenBrowserPreview}
					onOpenPlanPreview={handleOpenPlanPreview}
					onRegisterArtifactCard={handleRegisterArtifactCard}
					onRegenerate={chat.regenerateLatest}
					onScrollActiveUserMessageChange={handleScrollActiveTimelineChange}
					onSelectSuggestion={handleRovoAppSuggestionSelect}
					onSetEditingMessageId={chat.setEditingMessageId}
					onVote={chat.voteOnMessage}
					pendingPlanMetadataMessageIds={chat.pendingPlanMetadataMessageIds}
					pendingArtifactResult={chat.pendingArtifactResult}
					scrollAnchorMessageId={scrollAnchorMessageId}
					scrollFollowMode={scrollFollowMode}
					selectedAgent={selectedAgent}
					showEmptyState={showHomeState}
					shouldSuppressLatestAssistantSuggestions={chat.shouldSuppressLatestAssistantSuggestions}
					streamingArtifact={chat.streamingArtifact}
					streamingArtifactMessageId={chat.streamingArtifactMessageId}
					votes={chat.votes}
				/>
			</ViewTransition>

			<div
				ref={composerDockRef}
				className={cn(
					"z-10 mx-auto flex min-w-0 w-full flex-col gap-3 overflow-visible",
					!showHomeState && "sticky bottom-0 bg-background/90 backdrop-blur",
					isArtifactOpen ? "max-w-none px-3" : "max-w-[800px]",
				)}
			>
				{realtimeStatusMessage ? <div className="px-1 text-text-subtle text-xs">{realtimeStatusMessage}</div> : null}
				{shouldShowReopenBrowserPreviewControl ? (
					<div className="flex justify-center px-1">
						<Button onClick={handleOpenBrowserPreview} size="default" type="button" variant="outline">
							Reopen browser preview
						</Button>
					</div>
				) : null}
				<div>
					{shouldShowQuestionCard && activeQuestionCard ? (
						<>
							<ClarificationQuestionCard
								key={activeQuestionCardKey ?? undefined}
								questionCard={activeQuestionCard}
								onSubmit={(answers) => {
									handleClarificationSubmit(answers);
									hideQuestionCard();
								}}
								onDismiss={() => {
									dismissQuestionCard();
									hideQuestionCard();
								}}
							/>
							<QuestionCardShortcutsFooter />
						</>
					) : shouldShowApprovalCard && activePendingPlan ? (
						<>
							<ApprovalCard key={pendingPlanKey ?? undefined} onDismiss={handleDismissApprovalCard} onSelect={handlePlanApprovalSubmit} isSubmitting={isSubmittingPlanApproval} />
							<QuestionCardShortcutsFooter escLabel="cancel" />
						</>
					) : (
						<>
														<motion.div
								className="relative overflow-visible"
								initial={showHomeState && !shouldReduceMotion ? { opacity: 0, y: 20 } : false}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4, ease: [0, 0.4, 0, 1], delay: 0.2 }}
								style={{ willChange: "transform, opacity" }}
							>
								<RovoAppComposer
									key={chat.runtimeThreadId}
									artifactTitle={workspaceDocument?.title ?? null}
									autoFocus={!embedded}
									backgroundArtifactLabel={chat.backgroundArtifactLabel}
									composerStatus={chat.composerStatus}
									compact={isArtifactOpen}
									directoryAutocompleteListVisible={shouldShowDirectoryAutocompleteList}
									directoryAutocompleteLimit={ROVO_APP_DIRECTORY_AUTOCOMPLETE_LIMIT}
									dictationState={dictationState}
									dictationTranscriptPreview={dictationTranscriptPreview}
									errorMessage={chat.inputError}
									experimentalDarkCta
									focusRequestKey={composerFocusRequestKey}
									galleryExpanded={galleryExpanded}
									isPlanMode={chat.isPlanMode}
									micStream={realtime.micStream}
									onDismissArtifactContext={handleCloseArtifactPane}
									onDismissPlanExecutionTracker={chat.dismissPlanExecutionTracker}
									onDirectoryAutocompleteChange={setDirectoryAutocompleteState}
									onDirectoryAutocompleteControllerChange={setDirectoryAutocompleteController}
									onStop={handleStop}
									onRemoveQueuedPrompt={chat.removeQueuedPrompt}
									onSubmit={handleComposerSubmit}
									onTextChange={handleComposerTextChange}
									onStartDictation={handleStartDictation}
									onStopDictation={handleStopDictation}
									onTogglePlanMode={chat.togglePlanMode}
									onToggleRealtimeVoice={handleToggleRealtimeVoice}
									onToggleClicky={handleToggleClicky}
									clickyActive={isClickyActive}
									placeholder={composerPreviewState.placeholder}
									prefillText={voiceTranscript ?? prefillText}
									previewPrompt={composerPreviewState.activePreviewPrompt}
									planExecutionTracker={chat.planExecutionTracker}
									queuedPrompts={chat.queuedPrompts}
									realtimeVoiceActive={isRealtimeActive}
									realtimeVoiceState={realtime.voiceState}
									screenAssistantTargetPrefix="rovo-composer"
									showBackgroundStop={chat.hasBackgroundDelegation}
								/>
								{showHomeState && shouldShowDirectoryAutocompleteList && directoryAutocompleteState ? (
									<RovoAppDirectoryAutocompleteRows
										className="absolute inset-x-0 top-full z-20 mt-6"
										shouldReduceMotion={Boolean(shouldReduceMotion)}
										state={directoryAutocompleteState}
										useWideLayout={shouldUseWideDirectoryAutocompleteLayout}
										onSelect={handleDirectoryAutocompleteSelect}
									/>
								) : null}
								{/* Default prompt gallery and the directory-match list both
								    render as absolute overlays anchored to the composer's
								    bottom edge, so swapping between them never changes the
								    centered hero+composer block height — the input stays put
								    instead of sliding up/down as matches appear. */}
								{showHomeState && !isCustomAgentSelected ? (
									<motion.div
										aria-hidden={shouldHideHomePromptGallery ? true : undefined}
										className={cn(
											"absolute inset-x-0 top-full z-10 mt-6",
											shouldHideHomePromptGallery && "pointer-events-none hidden",
										)}
										initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.4, ease: [0, 0.4, 0, 1], delay: 0.3 }}
										style={{ willChange: "transform, opacity" }}
									>
										<ViewTransition exit="slide-down" default="none">
											<PromptGallery
												items={HOME_SUGGESTIONS}
												onSelect={handleGallerySelect}
												onExpandChange={setGalleryExpanded}
												onPreviewStart={handleGalleryPreviewStart}
												onPreviewEnd={handleGalleryPreviewEnd}
											/>
										</ViewTransition>
									</motion.div>
								) : null}
							</motion.div>
							{!showHomeState ? <Footer className="relative z-10" /> : null}
						</>
					)}
				</div>
			</div>
		</>
	);

	const chatPaneContainer = (
		<div className="overscroll-behavior-contain relative z-10 flex h-full min-w-0 flex-1 flex-col touch-pan-y bg-background">
			{shouldShowTimelineNavigator ? (
				<ChatTimelineNavigator
					activeItemId={activeTimelineMessageId}
					className="absolute right-3 top-5 z-20 hidden md:block"
					items={timelineItems}
					onSelectItem={(messageId) => {
						handleScrollActiveTimelineChange(messageId);
						setScrollAnchorMessageId(messageId);
						setScrollFollowMode("target");
					}}
				/>
			) : null}
			{showHomeState && !shouldSplitArtifactPane ? <div className="min-h-[40px] flex-1 shrink" /> : null}
			{chatPane}
			{showHomeState && !shouldSplitArtifactPane ? (
				<>
					<div className="flex-1 shrink" />
					<Footer className="shrink-0" />
				</>
			) : null}
		</div>
	);

	return (
			<SidebarProvider className={cn(embedded ? "h-full" : "h-svh", "overflow-hidden")} defaultOpen={!embedded} onOpenChange={chat.setSidebarOpen} open={chat.sidebarOpen} style={rovoAppSidebarStyle}>
			<RovoAppSidebar
				activeThreadId={chat.activeThreadId}
				hoverOpen={isHoverOpen}
				isResizing={sidebarResize.isResizing}
				onCancelThreadRun={async (threadId) => {
					await chat.cancelThreadRun(threadId);
				}}
				onDeleteThread={async (threadId) => {
					startTransition(() => {
						void chat.deleteThread(threadId);
					});
				}}
				onNewChat={() => {
					setOptimisticUserMessage(null);
					startTransition(() => {
						void chat.openNewChat();
					});
				}}
				onSelectThread={async (threadId) => {
					setOptimisticUserMessage(null);
					startTransition(async () => {
						await chat.loadThread(threadId);
						if (embedded) {
							return;
						}
						window.history.pushState(null, "", buildRovoAppThreadPath(threadId));
					});
				}}
				onSidebarMouseEnter={handleSidebarContentMouseEnter}
				onSidebarMouseLeave={handleSidebarContentMouseLeave}
				resizeHandle={
					<SidebarResizeHandle
						data-active={sidebarResize.isResizing ? "" : undefined}
						data-will-collapse={sidebarResize.willCollapse ? "" : undefined}
						onDoubleClick={sidebarResize.onResizeHandleDoubleClick}
						onPointerDown={sidebarResize.onResizeHandlePointerDown}
						onPointerEnter={sidebarResize.onResizeHandlePointerEnter}
						onPointerLeave={sidebarResize.onResizeHandlePointerLeave}
					/>
				}
				threads={chat.threads}
				threadsLoaded={chat.threadsLoaded}
				topOffset={!embedded}
			/>

			{!embedded ? (
				<div
					className={cn(
						"fixed top-0 left-0 z-50 flex items-center px-3 transition-[width,border-color] duration-medium ease-in-out",
						sidebarResize.isResizing && "transition-none",
						chat.sidebarOpen
							? cn(
									"w-(--sidebar-width) overflow-x-clip border-r",
									// Match resize-handle hover/active (blue). Do not use
									// `border-border-warning` here — it reads as orange/red in the
									// chrome; collapse intent stays on the handle (`data-will-collapse`).
									sidebarResize.isResizing || sidebarResize.isResizeHandleHovered ? "border-border-selected" : "border-border",
								)
							: "border-b border-border",
					)}
					style={{
						...headerHeightStyle,
						width: chat.sidebarOpen ? undefined : `${TOP_NAV_COLLAPSED_LEFT_SECTION_WIDTH_PX}px`,
						backgroundColor: token("elevation.surface"),
						viewTransitionName: "persistent-sidebar" as never,
					}}
				>
					<LeftNavigation
						product="rovo"
						windowWidth={nav.windowWidth}
						isVisible={chat.sidebarOpen}
						isAppSwitcherOpen={nav.isAppSwitcherOpen}
						isSidebarResizing={sidebarResize.isResizing}
						hideAppSwitcher
						separatorLineOffsetPx={sidebarResize.sidebarWidth - TOP_NAV_PADDING_PX}
						onToggleSidebar={() => chat.setSidebarOpen(!chat.sidebarOpen)}
						onToggleAppSwitcher={nav.handleToggleAppSwitcher}
						onCloseAppSwitcher={nav.handleCloseAppSwitcher}
						onNavigate={(path) => nav.handleNavigate(path === "/" ? "/rovo" : path)}
						onHoverEnter={handleSidebarHoverEnter}
						onHoverLeave={handleSidebarHoverLeave}
					/>
				</div>
			) : null}

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				{!embedded ? (
					<div
						className={cn(
							"relative flex shrink-0 items-center border-b px-3 transition-[padding] duration-medium ease-in-out",
							!chat.sidebarOpen && (nav.windowWidth === 0 || nav.windowWidth >= TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX)
								&& "justify-end",
						)}
						style={{
							...headerHeightStyle,
							paddingLeft: chat.sidebarOpen ? undefined : `${TOP_NAV_COLLAPSED_HEADER_PADDING_PX}px`,
							borderColor: token("color.border"),
							backgroundColor: token("elevation.surface"),
							viewTransitionName: "persistent-header" as never,
						}}
					>
						<div
							className={cn(
								"relative flex min-w-0 flex-1 items-center gap-2",
								!chat.sidebarOpen && (nav.windowWidth === 0 || nav.windowWidth >= TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX)
									? "pointer-events-none absolute inset-x-0 justify-center px-3 [&>*]:pointer-events-auto"
									: "justify-start",
							)}
						>
							<div
								ref={nav.searchContainerRef}
								className="relative flex h-9 min-w-0 grow items-center"
								style={{
									flexBasis: `${TOP_NAV_SEARCH_MIN_WIDTH_PX}px`,
									maxWidth: `${TOP_NAV_SEARCH_MAX_WIDTH_PX}px`,
								}}
							>
								<InputGroup
									className={cn(
										"h-8 origin-center rounded-md bg-bg-input shadow-none transition-[transform,background-color,box-shadow] duration-medium ease-out hover:bg-bg-input-hovered motion-reduce:transition-none",
										"has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0",
										nav.isSearchFocused && "scale-y-[1.15]",
										nav.isSearchFocused && "relative z-[1001]",
									)}
									style={
										nav.isSearchFocused
											? {
													backgroundColor: token("elevation.surface.overlay"),
													boxShadow: token("elevation.shadow.overlay"),
												}
											: undefined
									}
								>
									<InputGroupAddon align="inline-start">
										<span className="size-4 shrink-0 text-icon-subtle">
											<SearchIcon label="" spacing="none" />
										</span>
									</InputGroupAddon>
									<InputGroupInput
										type="search"
										aria-label="Search"
										value={nav.searchValue}
										onChange={(event) => nav.setSearchValue(event.currentTarget.value)}
										onFocus={nav.handleFocusSearch}
										onKeyDown={nav.handleSearchKeyDown}
										placeholder="Search"
										className="h-full text-sm placeholder:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
									/>
								</InputGroup>
								<SearchSuggestionsPanel
									anchorRef={nav.searchContainerRef}
									isVisible={nav.isSearchFocused}
									onSearchAllApps={nav.handleSearchAllApps}
									onRecentItemClick={nav.handleRecentItemClick}
									onRecentSearchClick={nav.handleRecentSearchClick}
									panelRef={nav.searchPanelRef}
								/>
							</div>

							<CreateButton />
						</div>
						<RightNavigation product="rovo" windowWidth={nav.windowWidth} onToggleChat={nav.toggleChat} />
					</div>
				) : null}
				<RovoAppHeader
					artifactMenuItems={artifactMenuItems}
					isArtifactOpen={isArtifactOpen}
					onNewChat={() => {
						setOptimisticUserMessage(null);
						void chat.openNewChat();
					}}
					onOpenDocument={(documentId) => void chat.openDocument(documentId)}
				/>
				<main ref={shellRef} className="relative flex min-h-0 min-w-0 flex-1 bg-background px-3 text-foreground">
					<RovoAppShellPaneLayout
						artifactOrigin={artifactOrigin}
						artifactPane={artifactPane}
						artifactPanelId={ROVO_APP_SPLIT_ARTIFACT_PANEL_ID}
						chatPane={chatPaneContainer}
						chatPanelId={ROVO_APP_SPLIT_CHAT_PANEL_ID}
						minArtifactPaneWidth={ROVO_APP_MIN_ARTIFACT_PANE_WIDTH}
						minChatPaneWidth={ROVO_APP_MIN_CHAT_PANE_WIDTH}
						onArtifactSplitLayoutChanged={handleArtifactSplitLayoutChanged}
						shouldSplitArtifactPane={shouldSplitArtifactPane}
						shellSize={shellSize}
						splitArtifactPaneDefaultSize={splitArtifactPaneDefaultSize}
						splitChatPaneDefaultSize={splitChatPaneDefaultSize}
						splitChatPaneMaxSize={splitChatPaneMaxSize}
					/>
				</main>
			</div>
			<ClickyOverlay
				state={clicky.state}
				paintingActive={screenAssistantRegionPainting}
				pointTarget={clicky.pointTarget}
				responseText={clicky.responseText}
				onReturnToIdle={clickyReturnToIdle}
			/>
			<ScreenAssistantRegionOverlay
				active={isClickyActive}
				getVisibleTargets={getScreenAssistantVisibleTargets}
				onPaintingChange={setScreenAssistantRegionPainting}
				onRegionChange={setScreenAssistantRegion}
				region={screenAssistantRegion}
			/>
		</SidebarProvider>
	);
}
