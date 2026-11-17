import type { CSSProperties, ReactNode } from "react";
import type { SendPromptOptions, useRovoChat } from "@/app/contexts";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import type { ChatSurfaceSwitchHandler } from "@/components/projects/shared/components/chat-surface-switcher";
import type { GenerativeCardAnimationProps } from "@/components/projects/shared/components/generative-widget-card";
import type { RovoDataParts, RovoRenderableUIMessage, RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { RovoSuggestion } from "@/lib/rovo-suggestions";
import type { RovoAppDocument } from "@/lib/rovo-app-types";
import type { RichTextMentionItem, RichTextMentionSources } from "@/components/ui-custom/rich-text-editor";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import type { ControlledChatHistoryDrawerProps } from "../components/chat-history-drawer";
import type { ArtifactResult } from "../components/artifact-result-card";
import type { AgentResultCreator } from "../components/agent-result-card";
import type { ChatSubmitInterceptOutcome } from "../hooks/use-chat-submit";

export type RovoChat = ReturnType<typeof useRovoChat>;

export interface ChatPanelGeneratedAgentResultRenderInput {
	agent: RovoDataParts["agent-result"];
	message: RovoRenderableUIMessage;
}

export interface ChatPanelCardsProps {
	generatedAgentResult?: RovoDataParts["agent-result"] | null;
	generativeAnimation?: GenerativeCardAnimationProps;
	shouldRenderGeneratedAgentResult?: (input: ChatPanelGeneratedAgentResultRenderInput) => boolean;
}

export type ChatPanelGeneratedResult =
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

export interface ChatComposerPrefillRequest {
	mention?: RichTextMentionItem;
	text?: string;
	append?: boolean;
	requestKey: number;
}

export interface ChatPanelProps {
	onClose: () => void;
	/** Allow conversation inspection without sending or answering. */
	readOnly?: boolean;
	/** Owner named in the explanation for a read-only session. */
	readOnlyOwner?: import("@/components/blocks/agent-list").AgentListInvoker;
	readOnlySessionState?: import("@/components/blocks/agent-list").AgentListState;
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
	composerPrefillRequest?: ChatComposerPrefillRequest;
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
