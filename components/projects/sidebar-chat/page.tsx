"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.
// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.
// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props or external runtime state before user edits take ownership.
// oxlint-disable react-doctor/no-pass-data-to-parent -- Callbacks in this file intentionally report measured, generated, or selected data to an owning parent component.

/* eslint-disable react-hooks/exhaustive-deps -- These callbacks/effects intentionally read stable refs that bridge external animation, drag, preview, and editor state. */

import { Fragment, useEffect, useMemo, useCallback, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { FileUIPart } from "ai";
import { DEFAULT_REASONING_OPTION_ID } from "@/components/projects/shared/components/chat-configuration/customize-menu-data";
import { useRovoChat } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import type { ChatSurfaceSwitchHandler } from "@/components/projects/shared/components/chat-surface-switcher";
import { StreamingThinkingIndicator } from "@/components/projects/shared/components/streaming-thinking-indicator";
import { useLazyRef } from "@/lib/use-lazy-ref";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ui-custom/conversation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import EditIcon from "@atlaskit/icon/core/edit";
import { MessageTurns } from "@/components/projects/shared/message-turns";
import {
	getMessageAgentResult,
	getMessageArtifactResult,
	hasTurnCompleteSignal,
	isRenderableRovoUIMessage,
	type RovoRenderableUIMessage,
	type RovoDataParts,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import { mergeRovoContextDescriptions } from "@/lib/rovo-context";
import {
	buildClarificationMessageMetadata,
	buildClarificationDismissPrompt,
	buildClarificationSummaryPrompt,
	createClarificationSubmission,
	getLatestQuestionCardPayload,
	type ClarificationAnswers,
	type ParsedQuestionCardPayload,
} from "@/components/projects/shared/lib/question-card-widget";
import {
	getLatestPendingPlanWidget,
	type ParsedPlanWidgetPayload,
} from "@/components/projects/shared/lib/plan-widget";
import {
	getPlanApprovalKeyFromPlanWidget,
	type PlanApprovalSelection,
} from "@/components/projects/shared/lib/plan-approval";
import { buildGenerativeWidgetSubmitPrompt, type GenerativeWidgetPrimaryActionPayload } from "@/components/projects/shared/lib/generative-widget";
import type { GenerativeCardAnimationProps } from "@/components/projects/shared/components/generative-widget-card";
import { ClarificationQuestionCard } from "@/components/projects/shared/components/clarification-question-card";
import { QuestionCardShortcutsFooter } from "@/components/projects/shared/components/question-card-shortcuts-footer";
import { ApprovalCard } from "@/components/blocks/approval-card/page";
import { useDismissibleCards } from "@/components/projects/shared/hooks/use-dismissible-cards";
import type { RovoSuggestion } from "@/lib/rovo-suggestions";
import type { RovoAppDocument } from "@/lib/rovo-app-types";
import type { ComposerDirectoryAutocompleteController, RichTextMentionItem, RichTextMentionSources } from "@/components/ui-custom/rich-text-editor";
import type { DirectoryAutocompleteState } from "@/lib/directory-autocomplete";
import { isRovoAgentProfile, type RovoAgentProfile } from "@/app/data/directory/agents";
import ChatHeader from "./components/chat-header";
import {
	ChatHistoryDrawer,
	ControlledChatHistoryDrawer,
	type ControlledChatHistoryDrawerProps,
} from "./components/chat-history-drawer";
import ChatGreeting from "./components/chat-greeting";
import ChatComposer from "./components/chat-composer";
import MessageBubble from "./components/message-bubble";
import { AgentActivityTimeline } from "./components/agent-activity-timeline";
import { ArtifactResultCard, type ArtifactResult } from "./components/artifact-result-card";
import { AgentResultCard, isGeneratedAgentResult, type AgentResultCreator } from "./components/agent-result-card";
import { PreloadThinkingIndicator } from "@/components/projects/shared/components/preload-thinking-indicator";
import { AwaitingUserResponseIndicator } from "@/components/projects/shared/components/chat-messages";
import { chatStyles } from "./data/styles";
import { cn } from "@/lib/utils";
import { useChatSubmit, type ChatSubmitInterceptOutcome } from "./hooks/use-chat-submit";
import { useScrollAnchor } from "./hooks/use-scroll-anchor";
import { useThinkingStatus } from "./hooks/use-thinking-status";
import { appendOptimisticCompactUserMessage } from "./lib/optimistic-user-message";
import {
	reduceDictationPresentation,
	reduceScreenAssistantRegion,
	subscribeToUserActivation,
} from "./lib/sidebar-chat-state";
import { type DelegationRequest, type UseRealtimeVoiceResult, useRealtimeVoice } from "@/components/projects/rovo-core/hooks/use-realtime-voice";
import { appendDictationTranscript, resolveComposerDictationState } from "@/lib/composer-dictation";
import { useClicky } from "@/components/projects/rovo-core/hooks/use-clicky";
import { useDefaultClickyVoice } from "@/components/projects/rovo-core/hooks/use-default-clicky-voice";
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
import styles from "./chat.module.css";

export type { ChatSubmitInterceptOutcome } from "./hooks/use-chat-submit";

export interface ChatPanelGeneratedAgentResultRenderInput {
	agent: RovoDataParts["agent-result"];
	message: RovoRenderableUIMessage;
}

export interface ChatPanelCardsProps {
	generatedAgentResult?: RovoDataParts["agent-result"] | null;
	generativeAnimation?: GenerativeCardAnimationProps;
	shouldRenderGeneratedAgentResult?: (input: ChatPanelGeneratedAgentResultRenderInput) => boolean;
}

type GeneratedResult =
	| { type: "artifact"; result: ArtifactResult }
	| { type: "agent"; result: RovoDataParts["agent-result"] };

export interface ChatPanelGreetingProps {
	heading?: string;
	illustrationSrc?: string;
	illustrationDarkSrc?: string;
	showHero?: boolean;
	suggestions?: ReadonlyArray<RovoSuggestion>;
	/**
	 * Opt-in (custom-agent greeting only): text for the optional group header
	 * above the conversation-starter rows.
	 */
	starterGroupLabel?: string;
	/**
	 * Opt-in (custom-agent greeting only): label the conversation-starter list
	 * with `starterGroupLabel`.
	 */
	showStarterGroupLabel?: boolean;
	/**
	 * Opt-in (custom-agent greeting only): extra rows rendered after the
	 * conversation starters. Kept as an opaque node so automation/trigger
	 * specifics stay in the caller's domain.
	 */
	agentTestSection?: ReactNode;
}

export interface ChatPanelCustomAgentTabs {
	activity?: ReactNode;
	trigger?: ReactNode;
}

export interface ComposerInputContext {
	content: ReactNode;
	submitText: string;
	onSubmitStart?: () => void;
	onSubmitted?: () => void;
}

export type ChatPanelHistoryController = Pick<
	ControlledChatHistoryDrawerProps,
	| "activeThreadId"
	| "cancelThreadRun"
	| "deleteThread"
	| "getThreadActions"
	| "getThreadPresentation"
	| "onNewChat"
	| "onSortModeChange"
	| "pinnedThreadIds"
	| "selectThread"
	| "sortMode"
	| "threads"
	| "threadsLoaded"
>;

export interface ChatPanelAgentVersionOption {
	id: string;
	label: string;
	variant?: "neutral" | "success";
	sectionBreakBefore?: boolean;
	/**
	 * Marks the currently published / live version. The dropdown renders a
	 * "Current" text label (outside the badge) on this row so users can tell
	 * which version is live, independent of which one they have selected to
	 * preview.
	 */
	isCurrent?: boolean;
}

export interface ChatPanelLocalConversation {
	buildVoiceInput?: (voiceText: string) => string;
	initialVoiceKey?: string | null;
	initialVoiceText?: string | null;
	messages: ReadonlyArray<RovoUIMessage>;
	onSubmit: (text: string) => Promise<ChatPanelLocalConversationSubmitResult> | ChatPanelLocalConversationSubmitResult;
}

export interface ChatPanelLocalConversationSubmitDetails {
	handled?: boolean;
	voiceText?: string | null;
}

export type ChatPanelLocalConversationSubmitResult =
	| boolean
	| ChatPanelLocalConversationSubmitDetails
	| void;

const LOCAL_CONVERSATION_VOICE_SUPPRESSION_MIN_MS = 2200;
const LOCAL_CONVERSATION_VOICE_SUPPRESSION_MAX_MS = 12000;
const LOCAL_CONVERSATION_VOICE_SUPPRESSION_PER_WORD_MS = 280;
const LOCAL_CONVERSATION_VOICE_SUPPRESSION_BUFFER_MS = 900;

function isLocalConversationSubmitHandled(result: ChatPanelLocalConversationSubmitResult): boolean {
	return result !== false && (
		typeof result !== "object" ||
		result === null ||
		result.handled !== false
	);
}

function getLocalConversationVoiceText(result: ChatPanelLocalConversationSubmitResult): string {
	if (typeof result !== "object" || result === null || typeof result.voiceText !== "string") {
		return "";
	}

	return result.voiceText.trim();
}

function getLocalConversationVoiceSuppressionMs(text: string): number {
	const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;
	const estimatedDuration = wordCount * LOCAL_CONVERSATION_VOICE_SUPPRESSION_PER_WORD_MS + LOCAL_CONVERSATION_VOICE_SUPPRESSION_BUFFER_MS;
	return Math.min(
		Math.max(estimatedDuration, LOCAL_CONVERSATION_VOICE_SUPPRESSION_MIN_MS),
		LOCAL_CONVERSATION_VOICE_SUPPRESSION_MAX_MS,
	);
}

interface ChatPanelProps {
	onClose: () => void;
	onBackToRovo?: () => void;
	addMenuItemsBefore?: ReactNode;
	/** Optional host-owned controls rendered immediately after the Add menu trigger. */
	composerToolsAfterAdd?: ReactNode;
	sendPromptOptions?: SendPromptOptions;
	enableSmartWidgets?: boolean;
	cards?: ChatPanelCardsProps;
	agentCreator?: AgentResultCreator;
	greeting?: ChatPanelGreetingProps;
	customAgentTabs?: ChatPanelCustomAgentTabs;
	chatHistory?: ChatPanelHistoryController;
	/**
	 * When true, renders the agent Test-mode-only controls in the custom
	 * agent tab header: the version dropdown and the new-chat/edit button.
	 * Other custom-agent tab surfaces (e.g. the RFP report canvas) keep these
	 * hidden, so this must only be set by the agent Test panel. It also keeps
	 * the custom agent tab list (Chat / Trigger / Activity) as a centered pill;
	 * every other surface renders the tab list full width.
	 */
	showAgentTestControls?: boolean;
	/**
	 * Agent Test can own its own starting-state chooser while still using the
	 * selected custom agent inside ChatPanel. Suppress the automatic custom-agent
	 * tab strip for that chat-only surface.
	 */
	suppressCustomAgentTabs?: boolean;
	agentVersionOptions?: readonly ChatPanelAgentVersionOption[];
	selectedAgentVersionId?: string;
	onAgentVersionChange?: (versionId: string) => void;
	/**
	 * Optional override appended to the scrollable conversation content
	 * wrapper. Used to align the conversation body's horizontal padding with
	 * a surrounding header (e.g. the agent Test panel matches its `px-6`
	 * header). Shared chat surfaces omit this to keep the default `px-4`.
	 */
	conversationContentClassName?: string;
	/**
	 * Optional override appended to the compact chat composer wrapper. Shared
	 * chat surfaces omit this to keep the default `px-3`; the Studio agent Test
	 * panel passes `px-0` because the surrounding panel already supplies the
	 * 24px horizontal inset.
	 */
	composerContainerClassName?: string;
	/** Optional host-owned actions rendered directly above the composer. */
	composerContextBar?: ReactNode;
	/** Optional host-owned header attached to the top of the prompt surface. */
	composerSurfaceHeader?: ReactNode;
	/** Optional tooltip shown when the user hovers the prompt surface header. */
	composerSurfaceHeaderTooltip?: ReactNode;
	/** Optional host-owned, non-text context rendered inside the prompt surface. */
	composerInputContext?: ComposerInputContext;
	/** Opt-in first-render focus for host surfaces where the composer is primary. */
	autoFocusComposer?: boolean;
	/**
	 * When true, the bottom-aligned Test greeting reserves vertical space equal
	 * to a single-line chat context bar below its last conversation starter.
	 * The Studio agent Test panel sets this because its sibling Ask Rovo panel
	 * renders an "Edit:" context bar above its composer; reserving the matching
	 * footprint keeps the two greetings' last prompts on the same baseline.
	 */
	composerReservesContextBarSpace?: boolean;
	/** Third-party agents center the empty greeting; custom agents and Rovo keep it near the composer. */
	emptyGreetingPlacement?: "centered" | "near-composer";
	greetingSelectedAgent?: RovoAgentProfile | null;
	hideAiCursor?: boolean;
	/** Opt-out for embedded surfaces that should not show the AI verification disclaimer. */
	hideAiDisclaimer?: boolean;
	hideComposerSourceAndModelControls?: boolean;
	hideHeader?: boolean;
	headerEndAction?: ReactNode;
	headerVariant?: "default" | "minimal";
	showAgentBackButton?: boolean;
	showAgentSelector?: boolean;
	abortOnUnmount?: boolean;
	/**
	 * Optional deterministic submit interceptor. When provided and it reports the
	 * prompt as handled, the composer submission skips the model entirely — the
	 * user message and the returned `assistantReply` are injected locally. Used by
	 * the studio agent-edit ("Improve your agent?") chat to apply local agent
	 * edits; absent for normal conversational chats (including the agent test
	 * chat, which must stay a real conversation).
	 */
	onInterceptSubmit?: (text: string) => ChatSubmitInterceptOutcome;
	containerClassName?: string;
	containerStyle?: CSSProperties;
	onSurfaceSwitch?: ChatSurfaceSwitchHandler;
	chatContextBar?: ChatContextBarDescriptor | null;
	renderWidget?: (
		widget: { type: string; data: unknown },
		message: RovoRenderableUIMessage
	) => ReactNode;
	getWidgetPosition?: (widgetType: string) => "before-content" | "after-content" | undefined;
	/**
	 * Opens the host's automation trigger/flow dialog from an agent-edit-summary
	 * card's "Open" button. Studio passes its config-panel automation opener here.
	 */
	onOpenAgentEditSummary?: () => void;
	/**
	 * Id of an externally-injected assistant message that should render as
	 * actively "thinking" (live morphing-Rovo trace, auto-expanded) — used by the
	 * Agent Test panel while it plays a local run via `applyLocalTurn`. Cleared
	 * (set to null) when the run settles so the trace collapses to "Thought for Xs".
	 */
	externalThinkingMessageId?: string | null;
	onArtifactResult?: (artifact: ArtifactResult) => void;
	onArtifactDialogOpen?: (artifact: ArtifactResult) => void;
	/** Route-owned static documents for artifact previews that do not use backend persistence. */
	inlineArtifactDocuments?: Readonly<Record<string, RovoAppDocument>>;
	preserveFloatingSurfaceOnArtifactDialogOpen?: boolean;
	localConversation?: ChatPanelLocalConversation | null;
	startRealtimeVoiceRequestKey?: number;
	/**
	 * Opt-in: derive the composer placeholder from the current prompt text.
	 * Returns `undefined` to use the default. Used by the Skills demo to switch
	 * the placeholder when the create-skill tag is present.
	 */
	resolveComposerPlaceholder?: (prompt: string) => string | undefined;
	/**
	 * Opt-in: imperatively set the composer text. Apply on `requestKey` change
	 * (keyed-request idiom, like `startRealtimeVoiceRequestKey`). Used to
	 * auto-prefill a newly-created skill's tag.
	 */
	composerPrefillRequest?: { mention?: RichTextMentionItem; text?: string; requestKey: number };
	/** Called after the rich composer applies the keyed mention request. */
	onComposerPrefillConsumed?: (requestKey: number) => void;
	/**
	 * Opt-in: route docked question-card answers back through `onInterceptSubmit`
	 * (via the clarification summary prompt) instead of the model. Lets a
	 * deterministic flow (e.g. create-skill) continue without a backend call.
	 */
	interceptClarificationAnswers?: boolean;
	/**
	 * Opt-in: extra mention sources merged into the composer's `/` and `@` menus
	 * (e.g. runtime-created skills). Forwarded to the rich-text editor.
	 */
	composerMentionSources?: RichTextMentionSources;
	/**
	 * Opt-in: flip a message's thinking trace from "Awaiting user response" to
	 * "Questions answered" once a later user message exists (studio behavior).
	 * Default false leaves other consumers unchanged.
	 */
	markAnsweredQuestionTraces?: boolean;
	/** Opt-in Queue-style status shown above a docked clarification card. */
	showAwaitingIndicator?: boolean;
}

const COMPACT_CHAT_WIDTH_MAX = 520;

/**
 * Footprint of a single-line chat context bar (the "Edit:" pill above the
 * sidebar composer): the pill's `py-2` + small-icon line height (~36px) plus
 * its `mb-3` bottom margin (12px). The bottom-aligned Test greeting reserves
 * this much space below its last starter so it lines up with the sibling Ask
 * Rovo greeting, whose composer carries that context bar. Keep in sync with
 * `ContextBar` in components/ui-custom/context-bar/context-bar.tsx.
 */
const CONTEXT_BAR_RESERVED_SPACE_PX = 48;
/**
 * Vertical gap the Test layout inserts between the conversation track and the
 * composer (the `gap-3` on the empty-state wrapper below). The sibling Ask Rovo
 * composer has no such gap, so the bottom-aligned Test greeting subtracts it
 * from its reserved space to keep its last starter level with the Ask Rovo one.
 * Keep in sync with the `gap-3` on the agent-test empty-state wrapper.
 */
const AGENT_TEST_COMPOSER_GAP_PX = 12;
const REGULAR_CHAT_WIDTH_MAX = 900;
const ARTIFACT_DIALOG_FLOATING_PIN_REASON = "sidebar-chat-artifact-dialog";

const DEFAULT_AGENT_VERSION_OPTIONS: readonly ChatPanelAgentVersionOption[] = [
	{ id: "draft", label: "Draft", variant: "neutral" },
	{ id: "version-2", label: "V2", variant: "success", sectionBreakBefore: true, isCurrent: true },
	{ id: "version-1", label: "V1", variant: "success" },
];

type SmartWidthClass = "compact" | "regular" | "wide";

type RealtimeTranscriptPayload =
	| string
	| {
			delta?: string;
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

function getSmartWidthClass(widthPx: number): SmartWidthClass {
	if (widthPx <= COMPACT_CHAT_WIDTH_MAX) return "compact";
	if (widthPx <= REGULAR_CHAT_WIDTH_MAX) return "regular";
	return "wide";
}

function getRealtimeTranscriptText(payload: RealtimeTranscriptPayload): string {
	if (typeof payload === "string") {
		return payload;
	}

	return payload.text ?? payload.transcript ?? payload.delta ?? "";
}

function CustomAgentTabEmptyState({
	description,
	title,
}: Readonly<{
	description: string;
	title: string;
}>): React.ReactElement {
	return (
		<div className="flex min-h-[220px] items-center justify-center p-6 text-center">
			<div className="max-w-[280px] space-y-2">
				<h3 className="text-sm font-semibold text-text">{title}</h3>
				<p className="text-sm leading-6 text-text-subtle">{description}</p>
			</div>
		</div>
	);
}

function isCustomAgentTabsProfile(agent: { byline?: string }): boolean {
	return /\bcustom agent\b/iu.test(agent.byline ?? "");
}

type SidebarScreenAssistantToolCall = {
	args: Record<string, unknown>;
	callId: string;
	name: string;
};

type SidebarScreenAssistantToolResponder = (output: unknown, createResponse?: boolean) => void;

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

export default function ChatPanel({ onClose, agentCreator,
	onBackToRovo,
	addMenuItemsBefore,
	composerToolsAfterAdd,
	sendPromptOptions,
	enableSmartWidgets = false,
	cards,
	greeting,
	greetingSelectedAgent,
	customAgentTabs,
	chatHistory,
	showAgentTestControls = false,
	suppressCustomAgentTabs = false,
	agentVersionOptions = DEFAULT_AGENT_VERSION_OPTIONS,
	selectedAgentVersionId,
	onAgentVersionChange,
	conversationContentClassName,
	composerContainerClassName,
	composerContextBar,
	composerSurfaceHeader,
	composerSurfaceHeaderTooltip,
	composerInputContext,
	autoFocusComposer = false,
	composerReservesContextBarSpace = false,
	emptyGreetingPlacement = "near-composer",
	hideAiCursor = false,
	hideAiDisclaimer = false,
	hideComposerSourceAndModelControls = false,
	hideHeader = false,
	headerEndAction,
	headerVariant = "default",
	showAgentBackButton = true,
	showAgentSelector = true,
	abortOnUnmount = true,
	onInterceptSubmit,
	containerClassName,
	containerStyle,
	onSurfaceSwitch,
	chatContextBar,
	renderWidget,
	getWidgetPosition,
	onOpenAgentEditSummary,
	externalThinkingMessageId,
	onArtifactResult,
	onArtifactDialogOpen,
	inlineArtifactDocuments,
	preserveFloatingSurfaceOnArtifactDialogOpen = false,
	localConversation = null,
	startRealtimeVoiceRequestKey = 0,
	resolveComposerPlaceholder,
	composerPrefillRequest,
	onComposerPrefillConsumed,
	interceptClarificationAnswers = false,
	composerMentionSources,
	markAnsweredQuestionTraces = false,
	showAwaitingIndicator = false,
}: Readonly<ChatPanelProps>): React.ReactElement {
	const {
		resetChat,
		uiMessages: rawUiMessages,
		sendPrompt,
		acceptPlanReview,
		submitPlanApproval,
		editMessage,
		editingMessageId,
		setEditingMessageId,
		chatSurface,
		activeThreadId,
		selectedAgent,
		selectableAgents,
		selectAgent,
		getSessionAgentEntry,
		isCustomAgentSelected,
		activePrompt,
		closeHistory,
		isHistoryOpen,
		pinFloating,
		toggleHistory,
		unpinFloating,
	} = useRovoChat();
	const panelRef = useRef<HTMLDivElement | null>(null);
	const artifactDialogFloatingPinRef = useRef(false);
	const reportedArtifactResultKeysRef = useLazyRef<Set<string>>(() => new Set());
	const [containerWidthPx, setContainerWidthPx] = useState<number | null>(null);
	const [viewportWidthPx, setViewportWidthPx] = useState<number | null>(null);
	const [selectedReasoning, setSelectedReasoning] = useState(DEFAULT_REASONING_OPTION_ID);
	const [directoryAutocompleteState, setDirectoryAutocompleteState] = useState<DirectoryAutocompleteState | null>(null);
	const [directoryAutocompleteController, setDirectoryAutocompleteController] = useState<ComposerDirectoryAutocompleteController | null>(null);
	const [uncontrolledAgentVersionId, setUncontrolledAgentVersionId] = useState<string>(agentVersionOptions[0]?.id ?? "draft");
	const fallbackAgentVersionId = agentVersionOptions[0]?.id ?? DEFAULT_AGENT_VERSION_OPTIONS[0].id;
	const resolvedUncontrolledAgentVersionId = agentVersionOptions.some((version) => version.id === uncontrolledAgentVersionId)
		? uncontrolledAgentVersionId
		: fallbackAgentVersionId;
	const resolvedAgentVersionId = selectedAgentVersionId ?? resolvedUncontrolledAgentVersionId;
	const selectedAgentVersion =
		agentVersionOptions.find((version) => version.id === resolvedAgentVersionId) ??
		agentVersionOptions[0] ??
		DEFAULT_AGENT_VERSION_OPTIONS[0];
	const isCollapsibleEditContextBar = Boolean(chatContextBar?.collapsible && chatContextBar.variant === "edit");
	const [contextBarOpenState, setContextBarOpenState] = useState({
		isOpen: true,
		signature: chatContextBar?.signature,
	});
	let resolvedContextBarOpenState = contextBarOpenState;
	if (contextBarOpenState.signature !== chatContextBar?.signature) {
		resolvedContextBarOpenState = {
			isOpen: true,
			signature: chatContextBar?.signature,
		};
		setContextBarOpenState(resolvedContextBarOpenState);
	}
	const isContextBarOpen = resolvedContextBarOpenState.isOpen;
	const setIsContextBarOpen = (isOpen: boolean) => {
		setContextBarOpenState((currentState) => ({ ...currentState, isOpen }));
	};

	useEffect(() => {
		if (agentVersionOptions.some((version) => version.id === resolvedAgentVersionId)) {
			return;
		}

		onAgentVersionChange?.(fallbackAgentVersionId);
	}, [agentVersionOptions, fallbackAgentVersionId, onAgentVersionChange, resolvedAgentVersionId]);

	useEffect(() => {
		const updateViewportWidth = () => {
			if (typeof window === "undefined") return;
			const width = Math.max(1, Math.round(window.innerWidth));
			setViewportWidthPx((prev) => (prev === width ? prev : width));
		};

		updateViewportWidth();
		window.addEventListener("resize", updateViewportWidth);
		return () => window.removeEventListener("resize", updateViewportWidth);
	}, []);

	useEffect(() => {
		const panelElement = panelRef.current;
		if (!panelElement) return;

		const updateContainerWidth = (widthValue: number) => {
			const width = Math.max(1, Math.round(widthValue));
			setContainerWidthPx((prev) => (prev === width ? prev : width));
		};

		updateContainerWidth(panelElement.getBoundingClientRect().width);

		if (typeof ResizeObserver !== "function") return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			updateContainerWidth(entry.contentRect.width);
		});

		observer.observe(panelElement);
		return () => observer.disconnect();
	}, []);

	const resolvedSendPromptOptions = useMemo(() => {
		if (!sendPromptOptions?.smartGeneration) return sendPromptOptions;

		const widthSource = containerWidthPx ?? viewportWidthPx;
		const widthClass = widthSource ? getSmartWidthClass(widthSource) : undefined;

		return {
			...sendPromptOptions,
			smartGeneration: {
				...sendPromptOptions.smartGeneration,
				containerWidthPx: containerWidthPx ?? undefined,
				viewportWidthPx: viewportWidthPx ?? undefined,
				widthClass,
			},
		};
	}, [containerWidthPx, sendPromptOptions, viewportWidthPx]);

	const {
		prompt,
		setPrompt,
		handleSubmit,
		submitPrompt,
		recordLocalAssistantTurn,
		interceptSubmit,
		abort,
		uiMessages,
		isStreaming,
		hasInFlightTurn,
		isSubmitPending,
		activeRequestStartedAt,
		localThinkingAssistantMessageId,
		queuedPrompts,
		removeQueuedPrompt,
	} = useChatSubmit({
		defaultPromptOptions: resolvedSendPromptOptions,
		onInterceptSubmit,
		requireIntercept: isCollapsibleEditContextBar && isContextBarOpen,
	});
	const isLocalConversationActive = localConversation !== null;
	const sendRealtimeTextInputRef = useRef<UseRealtimeVoiceResult["sendTextInput"] | null>(null);
	const realtimeVoiceStateRef = useRef<UseRealtimeVoiceResult["voiceState"]>("idle");
	const lastLocalInitialVoiceKeyRef = useRef<string | null>(null);
	const localConversationVoiceSuppressedUntilRef = useRef(0);
	const speakLocalConversationVoiceText = useCallback((result: ChatPanelLocalConversationSubmitResult) => {
		const voiceText = getLocalConversationVoiceText(result);
		if (!voiceText) {
			return;
		}

		localConversationVoiceSuppressedUntilRef.current = Math.max(
			localConversationVoiceSuppressedUntilRef.current,
			Date.now() + getLocalConversationVoiceSuppressionMs(voiceText),
		);
		void sendRealtimeTextInputRef.current?.({
			text: localConversation?.buildVoiceInput?.(voiceText) ?? voiceText,
		});
	}, [localConversation]);
	useEffect(() => {
		if (!localConversation) {
			lastLocalInitialVoiceKeyRef.current = null;
			localConversationVoiceSuppressedUntilRef.current = 0;
			return;
		}

		const initialVoiceText = localConversation.initialVoiceText?.trim() ?? "";
		if (!initialVoiceText) {
			return;
		}

		const initialVoiceKey = localConversation.initialVoiceKey?.trim() || initialVoiceText;
		if (lastLocalInitialVoiceKeyRef.current === initialVoiceKey) {
			return;
		}

		lastLocalInitialVoiceKeyRef.current = initialVoiceKey;
		speakLocalConversationVoiceText({ voiceText: initialVoiceText });
	}, [localConversation, speakLocalConversationVoiceText]);
	const handleComposerSubmit = useCallback(async ({ files, text }: { text: string; files: FileUIPart[] }) => {
		const promptText = (text || prompt).trim() || composerInputContext?.submitText.trim() || "";
		if (!promptText && files.length === 0) {
			return;
		}
		composerInputContext?.onSubmitStart?.();

		if (!localConversation) {
			await handleSubmit({ files, text: promptText });
			composerInputContext?.onSubmitted?.();
			return;
		}

		const result = await localConversation.onSubmit(promptText);
		if (!isLocalConversationSubmitHandled(result)) {
			await handleSubmit({ files, text: promptText });
			composerInputContext?.onSubmitted?.();
			return;
		}

		setPrompt("");
		speakLocalConversationVoiceText(result);
		composerInputContext?.onSubmitted?.();
	}, [composerInputContext, handleSubmit, prompt, localConversation, setPrompt, speakLocalConversationVoiceText]);

	// --- Rovo AI cursor companion (Clicky) ---
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
			if (!text.trim() || hideAiCursor) {
				return false;
			}

			if (!isClickyActive) {
				activateClicky();
			}
			clickyStartSpeaking(text);
			return true;
		}, [activateClicky, clickyStartSpeaking, hideAiCursor, isClickyActive]);
		const [{ painting: screenAssistantRegionPainting, region: screenAssistantRegion }, dispatchScreenAssistantRegion] = useReducer(
			reduceScreenAssistantRegion,
			{ painting: false, region: null },
		);
		const setScreenAssistantRegionPainting = useCallback((painting: boolean) => {
			dispatchScreenAssistantRegion({ type: "set-painting", painting });
		}, []);
		const setScreenAssistantRegion = useCallback((region: StudioScreenAssistantRegion | null) => {
			dispatchScreenAssistantRegion({ type: "set-region", region });
		}, []);
		if (
			(hideAiCursor || !isClickyActive) &&
			(screenAssistantRegion || screenAssistantRegionPainting)
		) {
			dispatchScreenAssistantRegion({ type: "reset" });
		}

	useEffect(() => {
		if (hideAiCursor && isClickyActive) {
			deactivateClicky();
		}
	}, [deactivateClicky, hideAiCursor, isClickyActive]);

	const realtimeTranscriptRef = useRef("");
	const promptRef = useRef(prompt);
	const lastComposerPrefillKeyRef = useRef(0);

	// Opt-in imperative composer prefill (keyed-request idiom). Text requests
	// route through setPrompt; mention requests are applied by the rich editor so
	// deliberate directory selections skip the visual-trace auto-tagger.
	useEffect(() => {
		const requestKey = composerPrefillRequest?.requestKey ?? 0;
		if (requestKey <= 0 || lastComposerPrefillKeyRef.current === requestKey) {
			return;
		}
		lastComposerPrefillKeyRef.current = requestKey;
		if (!composerPrefillRequest?.mention) {
			setPrompt(composerPrefillRequest?.text ?? "");
		}
		setComposerFocusRequestKey((currentKey) => currentKey + 1);
	}, [composerPrefillRequest, setPrompt]);
	const screenAssistantPointerRef = useRef<{ x: number; y: number } | null>(null);
	const sendFunctionCallOutputRef = useRef<
		((payload: { callId: string; output: unknown; createResponse?: boolean }) => void) | null
	>(null);
	const dictationBaselineRef = useRef<string | null>(null);
	const dictationCommittedTextRef = useRef<string | null>(null);
	const isDictationActiveRef = useRef(false);
	const [{ isActive: isDictationActive, transcriptPreview: dictationTranscriptPreview }, dispatchDictation] = useReducer(
		reduceDictationPresentation,
		{ isActive: false, transcriptPreview: null },
	);
	const [composerFocusRequestKey, setComposerFocusRequestKey] = useState(0);

	useEffect(() => {
		promptRef.current = prompt;
	}, [prompt]);

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

	const getScreenAssistantVisibleTargets = useCallback(
		() => getStudioScreenAssistantVisibleTargets(),
		[],
	);

	const handleRealtimeSpeechStarted = useCallback(() => {
		realtimeTranscriptRef.current = "";

		if (isDictationActiveRef.current) {
			dispatchDictation({ type: "preview", transcript: null });
			return;
		}

		// The AI cursor runs a private voice loop; leave the composer untouched.
		if (isClickyActive) {
			clickyStartListening();
			return;
		}
	}, [isClickyActive, clickyStartListening]);
	const handleRealtimeTranscript = useCallback((payload: RealtimeTranscriptPayload) => {
		// Suppress live transcript deltas in the composer while Clicky is active.
		if (isClickyActive) {
			return;
		}

		const transcriptText = getRealtimeTranscriptText(payload);
		if (!transcriptText.trim()) {
			return;
		}

		if (
			localConversation &&
			(Date.now() < localConversationVoiceSuppressedUntilRef.current || realtimeVoiceStateRef.current === "speaking")
		) {
			realtimeTranscriptRef.current = "";
			return;
		}

		if (isDictationActiveRef.current) {
			dispatchDictation({ type: "preview", transcript: transcriptText });
			const nextText = appendDictationTranscript(dictationCommittedTextRef.current ?? dictationBaselineRef.current ?? "", transcriptText);
			promptRef.current = nextText;
			setPrompt(nextText);
			setComposerFocusRequestKey((currentKey) => currentKey + 1);
			return;
		}

		realtimeTranscriptRef.current = transcriptText;
	}, [isClickyActive, localConversation]);
	const handleRealtimeTranscriptCompleted = useCallback((payload: RealtimeTranscriptPayload) => {
		const transcriptText = getRealtimeTranscriptText(payload);

		if (isDictationActiveRef.current) {
			if (!transcriptText.trim()) {
				return;
			}

			const nextText = appendDictationTranscript(dictationCommittedTextRef.current ?? dictationBaselineRef.current ?? "", transcriptText);
			dictationCommittedTextRef.current = nextText;
			promptRef.current = nextText;
			dispatchDictation({ type: "preview", transcript: transcriptText });
			setPrompt(nextText);
			setComposerFocusRequestKey((currentKey) => currentKey + 1);
			return;
		}

		if (!transcriptText.trim()) {
			return;
		}

		if (
			localConversation &&
			(Date.now() < localConversationVoiceSuppressedUntilRef.current || realtimeVoiceStateRef.current === "speaking")
		) {
			realtimeTranscriptRef.current = "";
			return;
		}

		// Clicky: transition to processing and record the user's spoken question
		// instead of routing it into the chat composer/thread.
		if (isClickyActive) {
			clickyStartProcessing();
			if (transcriptText.trim()) {
				clickyAddExchange({ role: "user", content: transcriptText });
			}
			return;
		}

		if (localConversation) {
			void Promise.resolve(localConversation.onSubmit(transcriptText)).then((result) => {
				if (isLocalConversationSubmitHandled(result)) {
					realtimeTranscriptRef.current = "";
					speakLocalConversationVoiceText(result);
					return;
				}
				realtimeTranscriptRef.current = transcriptText;
				void handleSubmit({ files: [], text: transcriptText });
			});
			return;
		}

		realtimeTranscriptRef.current = transcriptText;
	}, [clickyAddExchange, clickyStartProcessing, handleSubmit, isClickyActive, localConversation, setPrompt, speakLocalConversationVoiceText]);

	const getScreenAssistantSnapshot = useCallback(() => {
		return createStudioScreenAssistantSnapshot({
			activeRegion: screenAssistantRegion,
			activePanel: `sidebar-chat:${chatSurface}`,
			composer: {
				hasPrefill: Boolean(promptRef.current.trim()),
				placeholder: "Ask Rovo",
			},
			pointer: screenAssistantPointerRef.current,
			selectedAgent: {
				id: selectedAgent.id,
				name: selectedAgent.name,
			},
		});
	}, [chatSurface, screenAssistantRegion, selectedAgent.id, selectedAgent.name]);

	const handleScreenAssistantToolCall = useCallback(
		(
			{ name, args }: SidebarScreenAssistantToolCall,
			respond: SidebarScreenAssistantToolResponder,
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
					promptRef.current = text;
					setPrompt(text);
					respond({ ok: Boolean(text) });
					return;
				}
				case "submit_composer": {
					const text = promptRef.current.trim();
					if (text) {
						void handleComposerSubmit({ files: [], text });
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
			handleComposerSubmit,
			isClickyActive,
			setPrompt,
		],
	);

		const handleRealtimeAssistantTextDelta = useCallback((payload: RealtimeAssistantTextPayload) => {
			if (isDictationActiveRef.current) {
				return;
			}

			if (localConversation) {
				return;
			}

			// Stream direct realtime text into the cursor overlay as it arrives.
			const text = typeof payload === "string" ? payload : (payload.text ?? "");
			if (!text) {
				return;
			}

			streamClickyAssistantText(text);
		}, [localConversation, streamClickyAssistantText]);

		const handleRealtimeAssistantTextCompleted = useCallback((payload: { messageId?: string; text?: string } | string) => {
			if (isDictationActiveRef.current) {
				return;
			}

			if (localConversation) {
				return;
			}

			// Realtime may answer directly without delegating to Rovo. Keep the
			// audible/Clicky response, but also mirror that direct voice turn into
			// compact chat history when we have the user's transcript.
			const text = typeof payload === "string" ? payload : (payload.text ?? "");
			const promptText = realtimeTranscriptRef.current.trim();
			if (!text) {
				return;
			}

			const didStreamToClicky = streamClickyAssistantText(text);
			if (promptText) {
				realtimeTranscriptRef.current = "";
				void recordLocalAssistantTurn({
					assistantParts: [{ type: "text", text, state: "done" }],
					promptText,
				});
			}

			if (didStreamToClicky) {
				clickyAddExchange({ role: "assistant", content: text });
			}
		}, [clickyAddExchange, recordLocalAssistantTurn, localConversation, streamClickyAssistantText]);
	const handleRealtimeDelegateToRovo = useCallback(
		(request: DelegationRequest) => {
			if (isDictationActiveRef.current) {
				return;
			}

			// Clicky's spoken queries must never delegate into the chat thread.
			if (isClickyActive) {
				return;
			}

			const promptText = request.prompt.trim();
			if (!promptText) {
				return;
			}

			realtimeTranscriptRef.current = "";
			setPrompt("");
			const sendRealtimePrompt = () => {
				const contextDescription = mergeRovoContextDescriptions(
					resolvedSendPromptOptions?.contextDescription,
					request.conversationSummary ? `[Voice context] ${request.conversationSummary}` : undefined,
				);
				const promptOptions = contextDescription
					? {
							...resolvedSendPromptOptions,
							contextDescription,
						}
					: resolvedSendPromptOptions;
				void sendPrompt(promptText, promptOptions);
			};

			if (!localConversation) {
				sendRealtimePrompt();
				return;
			}

			void Promise.resolve(localConversation.onSubmit(promptText)).then((result) => {
				if (!isLocalConversationSubmitHandled(result)) {
					sendRealtimePrompt();
					return;
				}
				speakLocalConversationVoiceText(result);
			});
		},
		[isClickyActive, resolvedSendPromptOptions, localConversation, sendPrompt, setPrompt, speakLocalConversationVoiceText],
	);
	const realtime = useRealtimeVoice({
		sessionPolicyMode: "auto",
		chatMessages: uiMessages,
		isGenerating: isStreaming,
		onDelegateToRovo: handleRealtimeDelegateToRovo,
		onSpeechStarted: handleRealtimeSpeechStarted,
		onSpeechTranscriptCompleted: handleRealtimeTranscriptCompleted,
		onSpeechTranscriptDelta: handleRealtimeTranscript,
		onAssistantTextDelta: handleRealtimeAssistantTextDelta,
		onAssistantTextCompleted: handleRealtimeAssistantTextCompleted,
		onEndVoiceSession: useCallback(() => {
			realtimeTranscriptRef.current = "";
			deactivateClicky();
		}, [deactivateClicky]),
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
	});

	useEffect(() => {
		sendRealtimeTextInputRef.current = realtime.sendTextInput;
		realtimeVoiceStateRef.current = realtime.voiceState;
		sendFunctionCallOutputRef.current = realtime.sendFunctionCallOutput;
	}, [realtime.sendFunctionCallOutput, realtime.sendTextInput, realtime.voiceState]);

	// --- AI cursor voice bridge: connects realtime + injects tool-based prompt ---
	useDefaultClickyVoice({
		isClickyActive,
		isRealtimeConnected: realtime.isConnected,
		connectRealtime: realtime.connect,
		injectContext: realtime.injectContext,
	});
	const isRealtimeVoiceActive = realtime.voiceState !== "idle";
	const dictationState = resolveComposerDictationState({
		active: isDictationActive,
		voiceState: realtime.voiceState,
	});
	const handleStopDictation = useCallback(() => {
		dictationBaselineRef.current = null;
		dictationCommittedTextRef.current = null;
		isDictationActiveRef.current = false;
		dispatchDictation({ type: "stop" });
		realtime.disconnect();
	}, [realtime]);
	const handleStartDictation = useCallback(() => {
		if (realtime.voiceState !== "idle") {
			realtimeTranscriptRef.current = "";
			realtime.disconnect();
		}

		const baselineText = promptRef.current;
		dictationBaselineRef.current = baselineText;
		dictationCommittedTextRef.current = baselineText;
		isDictationActiveRef.current = true;
		dispatchDictation({ type: "start" });
		setComposerFocusRequestKey((currentKey) => currentKey + 1);
		realtime.connect({ transcriptionOnly: true });
	}, [realtime]);

	const startRealtimeVoice = useCallback(() => {
		if (isDictationActiveRef.current) {
			dictationBaselineRef.current = null;
			dictationCommittedTextRef.current = null;
			isDictationActiveRef.current = false;
			dispatchDictation({ type: "stop" });
		}

		realtimeTranscriptRef.current = "";
		realtime.connect(isLocalConversationActive ? { explicitResponseOnly: true } : undefined);
	}, [isLocalConversationActive, realtime]);
	const lastStartRealtimeVoiceRequestKeyRef = useRef(0);
	const cleanupDeferredStartRealtimeVoiceRef = useRef<(() => void) | null>(null);
	const clearDeferredStartRealtimeVoice = useCallback(() => {
		cleanupDeferredStartRealtimeVoiceRef.current?.();
		cleanupDeferredStartRealtimeVoiceRef.current = null;
	}, []);
	const shouldDeferRealtimeVoiceStartForUserActivation = useCallback(() => {
		if (typeof navigator === "undefined" || !navigator.userActivation) {
			return false;
		}

		return !navigator.userActivation.hasBeenActive;
	}, []);
	const startRealtimeVoiceAfterUserActivation = useCallback(() => {
		if (typeof window === "undefined") {
			return;
		}

		clearDeferredStartRealtimeVoice();
		const handleUserActivation = (event: Event) => {
			if (!event.isTrusted) {
				return;
			}

			clearDeferredStartRealtimeVoice();
			startRealtimeVoice();
		};
		cleanupDeferredStartRealtimeVoiceRef.current = subscribeToUserActivation(handleUserActivation);
	}, [clearDeferredStartRealtimeVoice, startRealtimeVoice]);
	useEffect(() => {
		if (startRealtimeVoiceRequestKey <= 0) {
			lastStartRealtimeVoiceRequestKeyRef.current = 0;
			clearDeferredStartRealtimeVoice();
			return;
		}

		if (lastStartRealtimeVoiceRequestKeyRef.current === startRealtimeVoiceRequestKey) {
			return;
		}

		lastStartRealtimeVoiceRequestKeyRef.current = startRealtimeVoiceRequestKey;
		if (realtime.voiceState !== "idle") {
			return;
		}

		if (shouldDeferRealtimeVoiceStartForUserActivation()) {
			startRealtimeVoiceAfterUserActivation();
			return;
		}

		startRealtimeVoice();
	}, [
		clearDeferredStartRealtimeVoice,
		realtime.voiceState,
		shouldDeferRealtimeVoiceStartForUserActivation,
		startRealtimeVoice,
		startRealtimeVoiceAfterUserActivation,
		startRealtimeVoiceRequestKey,
	]);
	useEffect(() => {
		return () => clearDeferredStartRealtimeVoice();
	}, [clearDeferredStartRealtimeVoice]);

	const handleToggleRealtimeVoice = useCallback(() => {
		clearDeferredStartRealtimeVoice();
		if (realtime.voiceState === "idle") {
			startRealtimeVoice();
			return;
		}

		realtimeTranscriptRef.current = "";
		realtime.disconnect();
		deactivateClicky();
	}, [clearDeferredStartRealtimeVoice, deactivateClicky, realtime, startRealtimeVoice]);

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

	// Cmd+Shift+K (Mac) / Ctrl+Shift+K toggles the AI cursor; Escape deactivates it.
	useEffect(() => {
		if (hideAiCursor) {
			return;
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "K" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleToggleClicky();
				return;
			}

			if (e.key === "Escape" && isClickyActive) {
				deactivateClicky();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [deactivateClicky, handleToggleClicky, hideAiCursor, isClickyActive]);
	const isStreamingLifecycleActive = isStreaming || isSubmitPending;
	const isRequestInFlight = hasInFlightTurn;
	const hasPendingChatWork = isRequestInFlight || queuedPrompts.length > 0;

	const rawMessages = useMemo(() => {
		const realMessages = uiMessages.filter(isRenderableRovoUIMessage);
		if (!isLocalConversationActive) {
			return realMessages;
		}

		const localMessages = localConversation?.messages.filter(isRenderableRovoUIMessage) ?? [];
		return [...realMessages, ...localMessages];
	}, [isLocalConversationActive, localConversation, uiMessages]);
	const optimisticPrompt = activePrompt ?? (isSubmitPending ? queuedPrompts[0] ?? null : null);
	const messages = useMemo(
		() => appendOptimisticCompactUserMessage(rawMessages, optimisticPrompt),
		[optimisticPrompt, rawMessages]
	);
	const shouldRenderGeneratedAgentFallbackCard = useMemo(() => {
		if (!isGeneratedAgentResult(cards?.generatedAgentResult)) {
			return false;
		}

		const cardAgentId = cards.generatedAgentResult.agentId;
		const cardAction = cards.generatedAgentResult.action;
		return !messages.some((message) => {
			if (!hasTurnCompleteSignal(message)) {
				return false;
			}

			const messageAgentResult = getMessageAgentResult(message);
			return (
				isGeneratedAgentResult(messageAgentResult) &&
				messageAgentResult.agentId === cardAgentId &&
				messageAgentResult.action === cardAction
			);
		});
	}, [cards?.generatedAgentResult, messages]);

	useEffect(() => {
		if (!onArtifactResult) {
			return;
		}

		for (const message of messages) {
			const artifactResult = getMessageArtifactResult(message);
			if (!artifactResult) {
				continue;
			}

			const resultKey = `${message.id}:${artifactResult.documentId}:${artifactResult.action}`;
			if (reportedArtifactResultKeysRef.current.has(resultKey)) {
				continue;
			}

			reportedArtifactResultKeysRef.current.add(resultKey);
			onArtifactResult(artifactResult);
		}
	}, [messages, onArtifactResult]);
	const lastAssistantMessageId = useMemo(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "assistant") {
				return messages[i].id;
			}
		}
		return null;
	}, [messages]);

	// Opt-in (markAnsweredQuestionTraces): assistant messages followed by a later
	// user message have had their clarification answered, so their thinking trace
	// should read "Questions answered" instead of "Awaiting user response".
	const answeredTraceMessageIds = useMemo(() => {
		const ids = new Set<string>();
		if (!markAnsweredQuestionTraces) {
			return ids;
		}
		let sawLaterUser = false;
		for (let i = rawUiMessages.length - 1; i >= 0; i--) {
			const candidate = rawUiMessages[i];
			if (candidate.role === "assistant" && sawLaterUser) {
				ids.add(candidate.id);
			}
			if (candidate.role === "user") {
				sawLaterUser = true;
			}
		}
		return ids;
	}, [markAnsweredQuestionTraces, rawUiMessages]);

	const activeQuestionCard = useMemo(() => (
		isLocalConversationActive ? null : getLatestQuestionCardPayload(rawUiMessages)
	), [isLocalConversationActive, rawUiMessages]);
	const handleClarificationDismiss = useCallback(
		(questionCard: ParsedQuestionCardPayload) => {
			const dismissPrompt = buildClarificationDismissPrompt(questionCard);
			void sendPrompt(dismissPrompt, {
				...resolvedSendPromptOptions,
				messageMetadata: {
					...(resolvedSendPromptOptions?.messageMetadata ?? {}),
					...buildClarificationMessageMetadata(questionCard, {
						status: "dismissed",
					}),
				},
			});
		},
		[resolvedSendPromptOptions, sendPrompt],
	);

	const {
		shouldShowQuestionCard: shouldShowQuestionCardRaw,
		activeQuestionCardKey,
		hideQuestionCard,
		dismissQuestionCard,
	} = useDismissibleCards({
		activeQuestionCard,
		onDismissQuestionCard: handleClarificationDismiss,
	});
	const shouldShowQuestionCard = !isRequestInFlight && shouldShowQuestionCardRaw;
	const activePendingPlan = useMemo(() => (
		isLocalConversationActive ? null : getLatestPendingPlanWidget(rawUiMessages)
	), [isLocalConversationActive, rawUiMessages]);
	const [dismissedApprovalCardKey, setDismissedApprovalCardKey] = useState<string | null>(null);
	const [isSubmittingPlanApproval, setIsSubmittingPlanApproval] = useState(false);
	const pendingPlanKey = activePendingPlan?.planWidget.deferredToolCallId ?? null;
	const shouldShowApprovalCard =
		activePendingPlan !== null &&
		pendingPlanKey !== dismissedApprovalCardKey &&
		!shouldShowQuestionCard &&
		!isStreamingLifecycleActive;

	useEffect(() => {
		setDismissedApprovalCardKey(null);
		setIsSubmittingPlanApproval(false);
	}, [activeThreadId]);

	const { conversationContextRef, scrollSpacerRef, getLatestTurnTargetTop, scrollFollowMode } = useScrollAnchor({
		enableTargetFollow: chatSurface !== "floating",
		isGenerationActive: isStreamingLifecycleActive,
		uiMessages: messages,
	});

	const thinking = useThinkingStatus({
		messages,
		isRequestInFlight,
		activeRequestStartedAt,
	});

	useEffect(() => {
		if (!abortOnUnmount) return;
		return () => abort();
	}, [abort, abortOnUnmount]);

	const releaseArtifactDialogFloatingPin = useCallback(() => {
		if (!artifactDialogFloatingPinRef.current) {
			return;
		}

		artifactDialogFloatingPinRef.current = false;
		unpinFloating(ARTIFACT_DIALOG_FLOATING_PIN_REASON);
	}, [unpinFloating]);

	useEffect(() => releaseArtifactDialogFloatingPin, [releaseArtifactDialogFloatingPin]);

	const hasMessages = messages.length > 0;
	const resolvedGreeting = isCollapsibleEditContextBar && !isContextBarOpen ? undefined : greeting;
	const isAgentTestEmptyState = showAgentTestControls && !hasMessages;
	// Bottom-align the Test greeting so its last conversation starter lines up
	// with the Ask Rovo greeting's last prompt. Only fall back to vertical
	// centering when the custom agent has no conversation starters to anchor.
	const hasTestGreetingSuggestions = (resolvedGreeting?.suggestions?.length ?? 0) > 0;
	const shouldBottomAlignAgentTestEmptyState = isAgentTestEmptyState && hasTestGreetingSuggestions;
	const shouldCenterAgentTestEmptyState = isAgentTestEmptyState && !hasTestGreetingSuggestions;
	const shouldCenterEmptyGreeting = emptyGreetingPlacement === "centered" && !hasMessages;
	const shouldHugEmptyGreeting = !hasMessages && greeting?.showHero === false;
	const shouldUseNaturalEmptyGreeting = shouldHugEmptyGreeting || isAgentTestEmptyState;
	const shouldUseAutoMessageTrack = shouldUseNaturalEmptyGreeting && containerStyle?.display === "grid";
	const directoryAutocompleteGreetingAgent = greetingSelectedAgent ?? selectedAgent;
	const canShowDirectoryAutocompleteGreeting =
		directoryAutocompleteGreetingAgent === null ||
		isRovoAgentProfile(directoryAutocompleteGreetingAgent);
	const shouldShowDirectoryAutocompleteList =
		!hasMessages &&
		canShowDirectoryAutocompleteGreeting &&
		directoryAutocompleteState !== null &&
		directoryAutocompleteState.matches.length > 0;
	const shouldUseWideDirectoryAutocompleteList =
		(chatSurface !== "floating") &&
		(containerWidthPx ?? viewportWidthPx ?? 0) >= 760;
	const resolvedContainerStyle = shouldUseAutoMessageTrack
		? { ...containerStyle, gridTemplateRows: "auto auto" }
		: containerStyle;

	const handleClarificationSubmit = useCallback(
		(answers: ClarificationAnswers) => {
			if (!activeQuestionCard) return;

			const clarificationSubmission = createClarificationSubmission(activeQuestionCard, answers);
			const clarificationPrompt = buildClarificationSummaryPrompt(activeQuestionCard, answers);

			// Opt-in: let a deterministic interceptor (e.g. the create-skill flow)
			// handle the answer locally. interceptSubmit returns false when there is
			// no interceptor or it declines, in which case we fall back to the model.
			if (interceptClarificationAnswers) {
				const clarificationMetadata = {
					...(resolvedSendPromptOptions?.messageMetadata ?? {}),
					...buildClarificationMessageMetadata(activeQuestionCard, { answers, status: "answered" }),
				};
				void interceptSubmit(clarificationPrompt, [], { userMetadata: clarificationMetadata }).then((handled) => {
					if (handled) return;
					void sendPrompt(clarificationPrompt, {
						...resolvedSendPromptOptions,
						messageMetadata: clarificationMetadata,
						clarification: clarificationSubmission,
					});
				});
				return;
			}

			const clarificationMetadata = {
				...(resolvedSendPromptOptions?.messageMetadata ?? {}),
				...buildClarificationMessageMetadata(activeQuestionCard, {
					answers,
					status: "answered",
				}),
			};

			void sendPrompt(clarificationPrompt, {
				...resolvedSendPromptOptions,
				messageMetadata: clarificationMetadata,
				clarification: clarificationSubmission,
			});
		},
		[activeQuestionCard, interceptClarificationAnswers, interceptSubmit, resolvedSendPromptOptions, sendPrompt],
	);
	const handleBuildPlan = useCallback(
		(planWidget: ParsedPlanWidgetPayload) => {
			return acceptPlanReview(planWidget);
		},
		[acceptPlanReview],
	);
	const handlePlanApprovalSubmit = useCallback(
		(selection: PlanApprovalSelection) => {
			if (!activePendingPlan) return;
			setIsSubmittingPlanApproval(true);
			void submitPlanApproval(activePendingPlan.planWidget, selection)
				.finally(() => setIsSubmittingPlanApproval(false));
		},
		[activePendingPlan, submitPlanApproval],
	);
	const handleDismissApprovalCard = useCallback(() => {
		setDismissedApprovalCardKey(pendingPlanKey);
	}, [pendingPlanKey]);
	const resolvePlanBuildState = useCallback(
		(planWidget: ParsedPlanWidgetPayload, message: { id: string }) => {
			if (!planWidget.deferredToolCallId) {
				return {};
			}

			const isActivePendingPlan =
				activePendingPlan?.sourceMessageId === message.id &&
				getPlanApprovalKeyFromPlanWidget(activePendingPlan.planWidget) ===
					getPlanApprovalKeyFromPlanWidget(planWidget);
			if (isActivePendingPlan) {
				return {};
			}

			return {
				isBuildDisabled: true,
				buildDisabledReason: activePendingPlan
					? "A newer reply superseded this plan."
					: "This plan is no longer awaiting review.",
			};
		},
		[activePendingPlan],
	);

	const handleFollowUpSuggestionClick = useCallback((question: string) => void submitPrompt(question), [submitPrompt]);

	const handleGreetingSuggestionClick = useCallback(
		(suggestion: RovoSuggestion) => {
			const promptText = suggestion.prompt ?? suggestion.label;
			const hasSeparatePrompt = suggestion.prompt && suggestion.prompt !== suggestion.label;

			void (async () => {
				// Route build-intent greeting chips through the deterministic
				// interceptor first so they get the local reply instead of the
				// real model; fall back to the normal send for everything else.
				if (await interceptSubmit(promptText)) {
					return;
				}

				void sendPrompt(promptText, {
					...resolvedSendPromptOptions,
					contextDescription: mergeRovoContextDescriptions(
						resolvedSendPromptOptions?.contextDescription,
						suggestion.contextDescription,
					),
					messageMetadata: {
						...resolvedSendPromptOptions?.messageMetadata,
						...(hasSeparatePrompt ? { displayLabel: suggestion.label } : {}),
					},
				});
			})();
		},
		[interceptSubmit, resolvedSendPromptOptions, sendPrompt],
	);
	const handleDirectoryAutocompleteSelect = useCallback((index: number) => {
		directoryAutocompleteController?.acceptIndex(index);
	}, [directoryAutocompleteController]);

	const handleWidgetPrimaryAction = useCallback(
		(payload: GenerativeWidgetPrimaryActionPayload) => {
			void submitPrompt(buildGenerativeWidgetSubmitPrompt(payload));
		},
		[submitPrompt],
	);

	const handleArtifactDialogOpen = useCallback(
		(artifact: ArtifactResult) => {
			if (
				preserveFloatingSurfaceOnArtifactDialogOpen &&
				chatSurface === "floating" &&
				!artifactDialogFloatingPinRef.current
			) {
				artifactDialogFloatingPinRef.current = true;
				pinFloating(ARTIFACT_DIALOG_FLOATING_PIN_REASON);
			}

			onArtifactDialogOpen?.(artifact);
		},
		[
			chatSurface,
			onArtifactDialogOpen,
			pinFloating,
			preserveFloatingSurfaceOnArtifactDialogOpen,
		],
	);
	const handleAgentResultSelect = useCallback((agent: RovoDataParts["agent-result"]) => {
		if (selectableAgents.some((selectableAgent) => selectableAgent.id === agent.agentId)) {
			selectAgent(agent.agentId);
		}
	}, [selectAgent, selectableAgents]);

	const messagesContainerStyle = {
		display: chatStyles.messagesContainer.display,
		flexDirection: chatStyles.messagesContainer.flexDirection,
		// Test empty state: grow to full height, then bottom-align the greeting
		// (so its last starter lines up with the Ask Rovo greeting) — or center it
		// when the agent has no starters. (Inline values win over Tailwind classes,
		// so the alignment must live here rather than only on the className.)
		justifyContent: shouldBottomAlignAgentTestEmptyState
			? "flex-end"
			: shouldCenterAgentTestEmptyState || shouldCenterEmptyGreeting
				? "center"
				: hasMessages || shouldUseNaturalEmptyGreeting
					? "flex-start"
					: "flex-end",
		flex: isAgentTestEmptyState ? "1 1 auto" : hasMessages || shouldUseNaturalEmptyGreeting ? "0 0 auto" : chatStyles.messagesContainer.flex,
		minHeight: isAgentTestEmptyState ? "100%" : shouldUseNaturalEmptyGreeting ? "auto" : "100%",
		// When bottom-aligning the Test greeting, reserve the sibling Ask Rovo
		// composer's context-bar footprint below the last starter, minus the
		// `gap-3` the Test layout already inserts above its composer, so both
		// greetings share a baseline. (Base 24px from the content track's `py-6`.)
		...(shouldBottomAlignAgentTestEmptyState && composerReservesContextBarSpace
			? { paddingBottom: `${24 + CONTEXT_BAR_RESERVED_SPACE_PX - AGENT_TEST_COMPOSER_GAP_PX}px` }
			: {}),
	};
	const isHeaderHistoryEnabled = !hideHeader && headerVariant === "default";
	const shouldRenderHeaderHistory = isHeaderHistoryEnabled && chatSurface !== "floating";
	const shouldRenderCustomAgentTabs = !suppressCustomAgentTabs && (
		Boolean(customAgentTabs) ||
		(isCustomAgentSelected && isCustomAgentTabsProfile(selectedAgent))
	);
	const handleNewChat = () => {
		if (chatHistory) {
			void chatHistory.onNewChat();
			return;
		}
		resetChat();
	};
	const chatConversationBody = (
		<Conversation
			className="min-h-0 min-w-0 flex-1"
			contextRef={conversationContextRef}
			followMode={scrollFollowMode}
			initial={false}
			resize={isStreamingLifecycleActive ? "instant" : "smooth"}
			resizeTarget={isStreamingLifecycleActive ? "bottom" : "follow"}
			targetScrollTop={getLatestTurnTargetTop}
		>
			<ConversationContent
				className={cn(
					"mx-auto flex min-w-0 max-w-[800px] flex-col gap-4 px-4 py-6 md:gap-6",
					conversationContentClassName
				)}
				reserveScrollbarGutter={hasMessages}
				revealScrollbarOnScroll={hasMessages}
				// In the Test empty state, messagesContainerStyle grows this content
				// track to full height and bottom-aligns (or centers when there are no
				// starters) the greeting (inline values win over Tailwind classes).
				style={messagesContainerStyle}
			>
				{messages.length === 0 ? (
					<div className="w-full" style={chatStyles.emptyState}>
						<ChatGreeting
							heading={resolvedGreeting?.heading}
							illustrationSrc={resolvedGreeting?.illustrationSrc}
							illustrationDarkSrc={resolvedGreeting?.illustrationDarkSrc}
							isAgentTest={showAgentTestControls}
							isComposing={prompt.trim().length > 0}
							isMaxMode={selectedReasoning === "max"}
							selectedAgent={greetingSelectedAgent ?? selectedAgent}
							showHero={resolvedGreeting?.showHero}
							showStarterGroupLabel={resolvedGreeting?.showStarterGroupLabel}
							starterGroupLabel={resolvedGreeting?.starterGroupLabel}
							agentTestSection={resolvedGreeting?.agentTestSection}
							suggestions={resolvedGreeting?.suggestions}
							directoryAutocompleteState={directoryAutocompleteState}
							useWideSuggestionLayout={shouldUseWideDirectoryAutocompleteList}
							onSuggestionClick={handleGreetingSuggestionClick}
							onDirectoryAutocompleteSelect={handleDirectoryAutocompleteSelect}
						/>
					</div>
				) : (
					<MessageTurns
						isUserMessage={(message) => message.role === "user"}
						getMessageContainerClassName={(message) => (message.role === "assistant" ? "[&:empty]:hidden" : undefined)}
						getMessageContainerStyle={(message, messageIndex, turn) => {
							return {
								paddingLeft: message.role === "assistant" ? "12px" : "0",
								paddingRight: message.role === "assistant" ? "12px" : "0",
								marginTop: message.role === "assistant" && messageIndex > 0 && (turn[messageIndex - 1]?.role === "user" || turn[messageIndex - 1]?.role === "assistant") ? "24px" : "0",
							};
						}}
						latestTurnClassName={styles.latestTurn}
						latestTurnDataAttribute="data-chat-latest-turn"
						messages={messages}
						renderMessage={(message) => (
							<MessageBubble
								message={message}
								isThinkingLifecycleStreaming={(isStreamingLifecycleActive || message.id === localThinkingAssistantMessageId || message.id === externalThinkingMessageId) && message.id === lastAssistantMessageId}
								treatQuestionToolCallsAsAnswered={answeredTraceMessageIds.has(message.id)}
								onSuggestionClick={handleFollowUpSuggestionClick}
								showFollowUpSuggestions={message.id === lastAssistantMessageId && !hasPendingChatWork}
								enableSmartWidgets={enableSmartWidgets}
								generativeCardAnimation={cards?.generativeAnimation}
								editingMessageId={editingMessageId}
								onEditMessage={(messageId, nextText) =>
									editMessage(messageId, nextText, resolvedSendPromptOptions)
								}
								onSetEditingMessageId={setEditingMessageId}
								onWidgetPrimaryAction={handleWidgetPrimaryAction}
								onOpenAgentEditSummary={onOpenAgentEditSummary}
								renderWidget={renderWidget}
								getWidgetPosition={getWidgetPosition}
								onBuildPlan={handleBuildPlan}
								resolvePlanBuildState={resolvePlanBuildState}
							/>
						)}
						renderTurnAfter={(turn) => {
							const shouldRenderGeneratedAgentResult = cards?.shouldRenderGeneratedAgentResult;
							const generatedResults = turn.flatMap((message): GeneratedResult[] => {
								const artifactResult = getMessageArtifactResult(message);
								const agentResult = getMessageAgentResult(message);
								const generatedAgentResult =
									isGeneratedAgentResult(agentResult) &&
									hasTurnCompleteSignal(message) &&
									(shouldRenderGeneratedAgentResult?.({ agent: agentResult, message }) ?? true)
										? agentResult
										: null;
								const results: GeneratedResult[] = [];

								if (artifactResult && !generatedAgentResult) {
									results.push({ type: "artifact", result: artifactResult });
								}
								if (generatedAgentResult) {
									results.push({ type: "agent", result: generatedAgentResult });
								}

								return results;
							});

							return generatedResults.length > 0 ? (
								<div className="w-full space-y-2" data-testid="rovo-generated-result-group">
									{generatedResults.map((generatedResult) => (
										generatedResult.type === "artifact" ? (
											<ArtifactResultCard
												key={`artifact-${generatedResult.result.documentId}-${generatedResult.result.action}`}
												artifact={generatedResult.result}
												inlineDocument={inlineArtifactDocuments?.[generatedResult.result.documentId]}
												onDialogOpen={handleArtifactDialogOpen}
												onDialogClose={releaseArtifactDialogFloatingPin}
											/>
										) : (
											<AgentResultCard creator={agentCreator}
												key={`agent-${generatedResult.result.agentId}-${generatedResult.result.action}`}
												agent={generatedResult.result}
												onSelectAgent={handleAgentResultSelect}
											/>
										)
									))}
								</div>
							) : null;
						}}
					/>
				)}
				{shouldRenderGeneratedAgentFallbackCard && cards?.generatedAgentResult ? (
					<div className="w-full px-3" data-testid="rovo-generated-result-group">
						<AgentResultCard creator={agentCreator}
							agent={cards.generatedAgentResult}
							onSelectAgent={handleAgentResultSelect}
						/>
					</div>
				) : null}
				{thinking.shouldShowPreloader ? (
					<div style={chatStyles.thinkingContainer}>
						<PreloadThinkingIndicator />
					</div>
				) : null}
				{thinking.shouldShowThinkingStatus ? (
					<StreamingThinkingIndicator
						reasoningKey={thinking.streamingReasoningKey}
						label={thinking.resolvedThinkingLabel}
						hasDetails={thinking.hasThinkingDetails}
						hasReasoningContent={thinking.hasReasoningContent}
						trimmedReasoningContent={thinking.trimmedReasoningContent}
						hasThinkingToolCalls={thinking.hasThinkingToolCalls}
						thinkingToolCalls={thinking.thinkingToolCalls}
						allowAutoCollapse={thinking.allowAutoCollapse}
						lastMessageId={thinking.lastMessage?.id}
						containerStyle={chatStyles.thinkingContainer}
						phaseProps={thinking.reasoningPhaseProps}
					/>
				) : null}
				{!thinking.shouldShowPreloader &&
				!thinking.shouldShowThinkingStatus &&
				showAwaitingIndicator &&
				shouldShowQuestionCard ? (
					<AwaitingUserResponseIndicator />
				) : null}
				{hasMessages ? <div ref={scrollSpacerRef} aria-hidden style={{ height: 0, flexShrink: 0 }} /> : null}
			</ConversationContent>
			<ConversationScrollButton className="z-10 transition-all" />
		</Conversation>
	);
	const chatComposerBody = (
		<div className="min-w-0 shrink-0">
			{shouldShowQuestionCard && activeQuestionCard ? (
				<>
					<div className="px-3">
						<ClarificationQuestionCard
							key={activeQuestionCardKey ?? undefined}
							questionCard={activeQuestionCard}
							onSubmit={(answers) => {
								handleClarificationSubmit(answers);
								hideQuestionCard();
							}}
							onDismiss={dismissQuestionCard}
						/>
					</div>
					<QuestionCardShortcutsFooter />
				</>
			) : shouldShowApprovalCard && activePendingPlan ? (
				<>
					<ApprovalCard
						key={pendingPlanKey ?? undefined}
						onDismiss={handleDismissApprovalCard}
						onSelect={handlePlanApprovalSubmit}
						isSubmitting={isSubmittingPlanApproval}
					/>
					<QuestionCardShortcutsFooter escLabel="cancel" />
				</>
			) : (
				<>
					<ChatComposer
						prompt={prompt}
						isStreaming={isStreamingLifecycleActive}
						hasInFlightTurn={hasInFlightTurn}
						queuedPrompts={queuedPrompts}
						addMenuItemsBefore={addMenuItemsBefore}
						composerToolsAfterAdd={composerToolsAfterAdd}
						experimentalDarkCta
						containerClassName={composerContainerClassName}
						hideAiCursor={hideAiCursor}
						hideAiDisclaimer={hideAiDisclaimer}
						hideSourceAndModelControls={hideComposerSourceAndModelControls}
						micStream={realtime.micStream}
						dictationState={dictationState}
						dictationTranscriptPreview={dictationTranscriptPreview}
						focusRequestKey={composerFocusRequestKey}
						autoFocus={autoFocusComposer}
						clickyActive={!hideAiCursor && (isClickyActive || isLocalConversationActive)}
						onPromptChange={setPrompt}
						onStartDictation={handleStartDictation}
						onStopDictation={handleStopDictation}
						onSubmit={handleComposerSubmit}
						onStop={abort}
						onToggleClicky={handleToggleClicky}
						onToggleRealtimeVoice={handleToggleRealtimeVoice}
						onRemoveQueuedPrompt={removeQueuedPrompt}
						onReasoningChange={setSelectedReasoning}
						onPrefillMentionConsumed={onComposerPrefillConsumed}
						realtimeVoiceActive={isRealtimeVoiceActive}
						realtimeVoiceState={realtime.voiceState}
						screenAssistantTargetPrefix="sidebar-composer"
						selectedReasoning={selectedReasoning}
						chatContextBar={chatContextBar}
						composerContextBar={composerContextBar}
						composerSurfaceHeader={composerSurfaceHeader}
						composerSurfaceHeaderTooltip={composerSurfaceHeaderTooltip}
						composerInputContext={composerInputContext?.content}
						hasComposerInputContext={composerInputContext !== undefined}
						directoryAutocompleteListVisible={shouldShowDirectoryAutocompleteList}
						prefillMentionRequest={
							composerPrefillRequest?.mention
								? {
										mention: composerPrefillRequest.mention,
										requestKey: composerPrefillRequest.requestKey,
									}
								: undefined
						}
						placeholder={resolveComposerPlaceholder?.(prompt)}
						mentionSources={composerMentionSources}
						onContextBarOpenChange={setIsContextBarOpen}
						onDirectoryAutocompleteChange={setDirectoryAutocompleteState}
						onDirectoryAutocompleteControllerChange={setDirectoryAutocompleteController}
					/>
				</>
			)}
		</div>
	);
	const chatPanelBody = (
		<>
			{chatConversationBody}
			{chatComposerBody}
		</>
	);

	return (
		<div ref={panelRef} className={cn("relative overflow-hidden", containerClassName)} style={{ ...chatStyles.chatPanel, ...resolvedContainerStyle }}>
			{chatHistory ? (
				<ControlledChatHistoryDrawer
					active={shouldRenderHeaderHistory}
					activeThreadId={chatHistory.activeThreadId}
					cancelThreadRun={chatHistory.cancelThreadRun}
					closeHistory={closeHistory}
					deleteThread={chatHistory.deleteThread}
					getThreadActions={chatHistory.getThreadActions}
					getThreadPresentation={chatHistory.getThreadPresentation}
					isHistoryOpen={isHistoryOpen}
					onNewChat={chatHistory.onNewChat}
					onSortModeChange={chatHistory.onSortModeChange}
					pinnedThreadIds={chatHistory.pinnedThreadIds}
					selectThread={chatHistory.selectThread}
					sortMode={chatHistory.sortMode}
					threads={chatHistory.threads}
					threadsLoaded={chatHistory.threadsLoaded}
				/>
			) : (
				<ChatHistoryDrawer active={shouldRenderHeaderHistory} />
			)}
			{!hideHeader ? <div className="shrink-0">
					<ChatHeader
						endAction={headerEndAction}
						variant={headerVariant}
						isHistoryOpen={isHistoryOpen}
						onBackToRovo={onBackToRovo}
						onClose={onClose}
						onHistoryToggle={toggleHistory}
						onNewChat={handleNewChat}
						onSurfaceSwitch={onSurfaceSwitch}
						showAgentBackButton={showAgentBackButton}
						showAgentSelector={showAgentSelector}
					/>
				</div> : null}
			{shouldRenderCustomAgentTabs ? (
				<>
					<Tabs
						defaultValue="chat"
						aria-label="Custom agent views"
						className={cn(
							"min-h-0 min-w-0 flex-1",
							isAgentTestEmptyState && "flex flex-col",
						)}
					>
						<div
							className={cn(
								"flex shrink-0 items-center gap-2 pt-3 pb-3",
								// In Test mode the surrounding panel already supplies the
								// header-matching horizontal inset (px-6), so the row drops
								// its own padding to keep the version dropdown and edit
								// button aligned with the header controls above. Other
								// surfaces keep the px-3 inset.
								showAgentTestControls ? null : "px-3",
								// Match the Test-mode control bar height on every surface so
								// the Chat/Trigger/Activity pill lands at the same vertical
								// position as the Test-mode tab bar. The Test row is sized by
								// its flanking controls (version dropdown + edit button), so
								// reserve the same row height when those controls are absent.
								showAgentTestControls ? null : "min-h-[56px]",
							)}
						>
							{showAgentTestControls ? (
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button
												aria-label="Switch version"
												// Nudge the version control 8px left so its lozenge
												// visually aligns with the header controls above.
												className="-ml-2 h-8 shrink-0 gap-1.5 px-2 text-sm font-medium text-text"
												type="button"
												variant="ghost"
											/>
										}
									>
										<Badge variant={selectedAgentVersion.variant ?? "success"}>
											{selectedAgentVersion.label}
										</Badge>
										<ChevronDownIcon label="" size="small" spacing="none" />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" sideOffset={8}>
										<DropdownMenuGroup>
											{agentVersionOptions.map((version) => (
												<Fragment key={version.id}>
													{version.sectionBreakBefore ? (
														<DropdownMenuSeparator />
													) : null}
													<DropdownMenuItem
														onSelect={() => {
															if (selectedAgentVersionId === undefined) {
																setUncontrolledAgentVersionId(version.id);
															}
															onAgentVersionChange?.(version.id);
														}}
														className={cn((version.variant ?? "success") === "neutral" && "bg-popover sticky top-0 z-10")}
														elemAfter={version.id === selectedAgentVersion.id ? <CheckMarkIcon label="Selected" /> : undefined}
													>
														<span className="flex min-w-0 items-center gap-2">
															<Badge variant={version.variant ?? "success"}>{version.label}</Badge>
															{version.isCurrent ? (
																<span className="text-xs text-text-subtle">Current</span>
															) : null}
														</span>
													</DropdownMenuItem>
												</Fragment>
											))}
										</DropdownMenuGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
							<div className={cn("flex flex-1", showAgentTestControls ? "justify-center" : null)}>
								<TabsList
									className={cn(
										showAgentTestControls
											? "w-full max-w-[376px]"
											: "w-full",
									)}
								>
									<TabsTrigger value="chat">Chat</TabsTrigger>
									<TabsTrigger value="trigger">Trigger</TabsTrigger>
									<TabsTrigger value="activity">Activity</TabsTrigger>
								</TabsList>
							</div>
							{showAgentTestControls ? (
								<Button aria-label="New chat" size="icon" variant="ghost" onClick={resetChat}>
									<EditIcon label="" />
								</Button>
							) : null}
						</div>
						<TabsContent
							value="chat"
							keepMounted
							className="min-h-0 flex flex-1 flex-col data-[hidden]:hidden"
						>
							{isAgentTestEmptyState ? (
								// Fill the full tab height and pin the composer to the
								// bottom (conversation grows to take the slack) so the Test
								// composer aligns with the bottom-anchored sidebar composer
								// instead of floating mid-height.
								<div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-3">
									{chatConversationBody}
									{chatComposerBody}
								</div>
							) : (
								chatConversationBody
							)}
						</TabsContent>
						<TabsContent value="trigger" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 data-[hidden]:hidden">
							{customAgentTabs?.trigger ?? (
								<CustomAgentTabEmptyState
									title="No trigger configured"
									description={`${selectedAgent.name} does not have trigger details in this view yet.`}
								/>
							)}
						</TabsContent>
						<TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 data-[hidden]:hidden">
							{customAgentTabs?.activity ?? (
								<AgentActivityTimeline
									entry={getSessionAgentEntry(selectedAgent.id)}
									messages={rawUiMessages}
									emptyState={
										<CustomAgentTabEmptyState
											title="No activity yet"
											description={`${selectedAgent.name} has not recorded activity in this view yet.`}
										/>
									}
								/>
							)}
						</TabsContent>
					</Tabs>
					{isAgentTestEmptyState ? null : chatComposerBody}
				</>
			) : (
				chatPanelBody
			)}
			{hideAiCursor ? null : (
					<ClickyOverlay
						state={clicky.state}
						paintingActive={screenAssistantRegionPainting}
						pointTarget={clicky.pointTarget}
						responseText={clicky.responseText}
						onReturnToIdle={clickyReturnToIdle}
					/>
			)}
				<ScreenAssistantRegionOverlay
					active={!hideAiCursor && isClickyActive}
					getVisibleTargets={getScreenAssistantVisibleTargets}
					onPaintingChange={setScreenAssistantRegionPainting}
					onRegionChange={setScreenAssistantRegion}
					region={screenAssistantRegion}
			/>
		</div>
	);
}
