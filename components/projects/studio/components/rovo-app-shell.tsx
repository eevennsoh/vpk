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
import { type CSSProperties, type ReactNode, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, ViewTransition } from "react";
import dynamic from "next/dynamic";
import { ArtifactPanel } from "@/components/blocks/artifact";
import { ChatTimelineNavigator } from "@/components/blocks/chat-timeline/chat-timeline-navigator";
import { useLazyRef } from "@/lib/use-lazy-ref";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import { CreateButton } from "@/components/blocks/top-navigation/components/create-button";
import { AgentsDirectoryDialog, type AgentsDirectoryTemplateBuildOptions } from "@/components/blocks/agent-directory";
import { inferAutomationRules } from "@/components/blocks/triggers/data/trigger-catalog";
import { AGENT_TEMPLATES_CATEGORIES, AgentTemplatesDialog, type AgentTemplatesAgent } from "@/components/blocks/agent-templates";
import {
	DEMO_AGENT_TEMPLATES,
	DEMO_AGENT_TEMPLATES_SESSION,
} from "@/components/blocks/agent-templates/data/demo-template-agents";
import { RovoAppBrowserArtifact } from "@/components/projects/rovo-core/components/rovo-app-browser-artifact";
import { RovoAppComposer } from "@/components/projects/studio/components/rovo-app-composer";
import { RovoAppHomeStarterBento } from "@/components/projects/studio/components/rovo-app-home-starter-bento";
import { HOME_STARTER_DEFAULT_CATEGORY, type HomeStarterCategory } from "@/components/projects/studio/data/home-starter-templates";
import { StudioAgentsSection } from "@/components/projects/studio/components/rovo-app-custom-agents-table";
import {
	parseStudioAutomationArtifactListPayload,
	STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE,
} from "@/components/projects/studio/lib/studio-automation-artifact-list";
import {
	StudioAutomationArtifactListWidget,
} from "@/components/projects/studio/components/studio-automation-artifact-list-widget";
import { isStudioAutomationDiscoveryDemoPrompt } from "@/components/projects/studio/lib/studio-automation-discovery-prompt";
import {
	RovoAppMessages,
} from "@/components/projects/studio/components/rovo-app-messages";
import type { AgentConfigView } from "@/components/projects/studio/components/rovo-app-agent-config-panel";
import { RovoCursorOnboardingTour } from "@/components/projects/studio/components/rovo-cursor-onboarding-tour";
import { useAgentOnboardingTour } from "@/components/projects/studio/hooks/use-agent-onboarding-tour";
import { RovoAppShellPaneLayoutCore as RovoAppShellPaneLayout } from "@/components/projects/rovo-core/components/rovo-app-shell-pane-layout";
import { RovoAppSidebar } from "@/components/projects/studio/components/rovo-app-sidebar";
import { isGeneratedAgentResult } from "@/components/projects/sidebar-chat/components/agent-result-card";
import { useArtifactAnnotations } from "@/components/ui-custom/hooks/use-artifact-annotations";
import { formatAnnotationsForVoiceContext } from "@/components/ui-custom/lib/artifact-annotations";
import type { ArtifactAnnotation } from "@/components/ui-custom/lib/artifact-annotations";
import { useRovoApp } from "@/components/projects/studio/hooks/use-rovo-app";
import { useHmrReloadSuppression } from "@/components/projects/rovo-core/hooks/use-hmr-reload-suppression";
import { useStudioDemoReset } from "@/components/projects/studio/hooks/use-studio-demo-reset";
import { useStudioAgentResultRegistration } from "@/components/projects/studio/hooks/use-studio-agent-result-registration";
import { useAgentUrlSync } from "@/hooks/use-agent-url-sync";
import {
	buildRovoAppBrowserArtifactKey,
	shouldAutoOpenRovoAppBrowserArtifact,
	shouldShowReopenRovoAppBrowserArtifactControl,
} from "@/components/projects/rovo-core/lib/rovo-app-browser-preview";
import { resolveRovoAppComposerPlaceholder } from "@/components/projects/shared/lib/rovo-app-composer-placeholder";
import { ROVO_APP_MAX_CHAT_PANE_WIDTH, ROVO_APP_MIN_ARTIFACT_PANE_WIDTH, ROVO_APP_MIN_CHAT_PANE_WIDTH, getRovoAppShellLayout } from "@/components/projects/rovo-core/lib/rovo-app-shell-layout";
import { getRovoAppSmartGenerationLayoutContext } from "@/components/projects/rovo-core/lib/rovo-app-smart-generation-layout";
import { deriveRovoAppTimelineItems } from "@/components/projects/rovo-core/lib/rovo-app-timeline";
import {
	buildDeterministicTriggerThinkingParts,
	DETERMINISTIC_TRIGGER_TRACE_INITIAL_DELAY_MS,
	DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS,
	planDeterministicAgentBuild,
} from "@/components/projects/studio/lib/demo-agent-builder";
import {
	adoptStudioGenerationTranscript,
	createStudioAgentEditCards,
} from "@/components/projects/studio/lib/studio-chat-helpers";
import { mergeContextDescriptions } from "@/components/projects/studio/lib/studio-context-descriptions";
import {
	normalizeStudioAgentResult,
	resolveRegisteredStudioAgentId,
	type StudioAgentRegistrationResult,
} from "@/components/projects/studio/lib/studio-agent-result-normalization";
import {
	createStudioAgentOnboardingGuideMessage,
	createStudioAgentOnboardingLocalConversation,
	getStudioAgentOnboardingGuideGreeting,
	getStudioAgentOnboardingGuideStepByIndex,
	getStudioAgentOnboardingGuideStepNarration,
	resolveStudioAgentOnboardingGuideCommand,
	STUDIO_AGENT_ONBOARDING_GUIDE_SUPPORTED_COMMANDS,
} from "@/components/projects/studio/lib/studio-agent-onboarding-guide";
import {
	buildStudioRealtimeArtifactContextSummary,
	buildStudioRealtimeResultSummary,
	buildStudioRealtimeThreadSummary,
	resolveStudioRealtimeSessionIdentity,
	resolveStudioRealtimeStatusMessage,
} from "@/components/projects/studio/lib/studio-realtime-context";
import { buildFallbackTemplatePrompt } from "@/components/projects/studio/lib/studio-template-prompts";
import { getStudioAutomationGeneratingAgents } from "@/components/projects/studio/lib/studio-automation-generating-agents";
import { prepareStudioAgentDraftPatch } from "@/components/projects/studio/lib/studio-agent-draft-patch";
import { buildRovoAppThreadPath } from "@/components/projects/studio/lib/rovo-app-thread-route-sync";
import { createRovoAppUserMessage } from "@/components/projects/rovo-core/lib/rovo-app-user-message";
import { appendDictationTranscript, resolveComposerDictationState } from "@/lib/composer-dictation";
import { readSessionAgentRecords } from "@/components/projects/rovo-core/lib/agent-records/session-agent-storage";
import {
	applyTemplateDefaultsToResult,
	buildCreationTemplateContextFromAgent,
	buildStudioAgentCreationContext,
	buildStudioAgentCreationContinuationContext,
	buildStudioAssistantKnowledgeContext,
	buildTemplateAgentResultFromAgent,
	resolveTemplateConfigForResult,
	type StudioCreationTemplateContext,
} from "@/components/projects/rovo-core/lib/agent-records/agent-creation-context";
import {
	deriveTemplateCategoryIds,
	omitDomainScopeAnswer,
	readDomainCategoryIds,
	withDomainScopeQuestion,
} from "@/components/projects/studio/lib/agent-creation-domain-scope";
import { repairGeneratedAgentCatalog } from "@/app/data/directory/repair-agent-result";
import { type DelegationRequest, useRealtimeVoice } from "@/components/projects/studio/hooks/use-realtime-voice";
import { type RovoRealtimeShellAdapter, useRovoRealtimeShellBridge } from "@/components/projects/rovo-core/hooks/use-rovo-realtime-shell-bridge";
import type { ConversationFollowMode } from "@/components/ui-custom/conversation";
import { useSidebar as useGlobalSidebar } from "@/app/contexts/context-sidebar";
import { LeftNavigation } from "@/components/blocks/top-navigation/components/left-navigation";
import { RightNavigation } from "@/components/blocks/top-navigation/components/right-navigation";
import SearchSuggestionsPanel from "@/components/blocks/top-navigation/components/search-suggestions-panel";
import { useTopNavigation } from "@/components/blocks/top-navigation/hooks/use-top-navigation";
import {
	TOP_NAV_COLLAPSED_HEADER_PADDING_PX,
	TOP_NAV_COLLAPSED_LEFT_SECTION_WIDTH_PX,
	TOP_NAV_HEADER_HEIGHT_PX,
	TOP_NAV_PADDING_PX,
	TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX,
	TOP_NAV_SEARCH_MAX_WIDTH_PX,
	TOP_NAV_SEARCH_MIN_WIDTH_PX,
} from "@/components/blocks/top-navigation/layout-constants";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SearchIcon from "@atlaskit/icon/core/search";
import { SidebarProvider, SidebarResizeHandle } from "@/components/ui/sidebar";
import { Footer } from "@/components/ui-custom/footer";
import { useClicky } from "@/components/projects/rovo-core/hooks/use-clicky";
import { useClickyVoice } from "@/components/projects/studio/hooks/use-clicky-voice";
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
import { useSidebarResize as useStudioAskRovoChatResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import ChatPanel, { type ChatPanelGreetingProps, type ChatPanelLocalConversation } from "@/components/projects/sidebar-chat/page";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import {
	AGENT_EDIT_GREETING_HEADING,
	AGENT_EDIT_GREETING_ILLUSTRATION_DARK_SRC,
	AGENT_EDIT_GREETING_ILLUSTRATION_SRC,
	agentEditSuggestions,
} from "@/components/projects/studio/data/agent-edit-greeting";
import {
	STUDIO_RFP_DEMO_AGENT_PROFILE_ID,
	STUDIO_RFP_DEMO_AGENT_RESULT,
	STUDIO_RFP_DEMO_AGENT_SOURCE_KEY,
} from "@/components/projects/studio/data/rfp-demo-agent";
import { clamp, cn, createId } from "@/lib/utils";
import { getRandomAgentAvatarSrc } from "@/lib/agent-avatars";
import { token } from "@/lib/tokens";
import { getLatestDataPart, getLatestUserMessageId, getMessageAgentResult, getMessageArtifactResult, getMessageText, hasTurnCompleteSignal, type RovoDataParts, type RovoRenderableUIMessage, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import { getRovoAppArtifactKindLabel, getRovoAppArtifactTypeLabel, sortRovoAppArtifacts } from "@/components/projects/rovo-core/lib/rovo-app-artifacts";
import { RovoAppHeader } from "@/components/projects/studio/components/rovo-app-header";
import { ApprovalCard } from "@/components/blocks/approval-card/page";
import { ClarificationQuestionCard } from "@/components/projects/shared/components/clarification-question-card";
import { QuestionCardShortcutsFooter } from "@/components/projects/shared/components/question-card-shortcuts-footer";
import { getLatestQuestionCardPayload, type ClarificationAnswers, type ParsedQuestionCardPayload } from "@/components/projects/shared/lib/question-card-widget";
import type { PlanApprovalSelection } from "@/components/projects/shared/lib/plan-approval";
import { getLatestPendingPlanWidget, type ParsedPlanWidgetPayload } from "@/components/projects/shared/lib/plan-widget";
import { useDismissibleCards } from "@/components/projects/shared/hooks/use-dismissible-cards";
import { getStudioSessionAgentDisplayName, useRovoSelectedAgent, type SendPromptOptions } from "@/app/contexts";
import { ROVO_DIRECTORY_AGENT_PROFILES, getRovoAgentPromptContext, isRovoAgentProfile } from "@/app/data/directory/agents";

const RovoAppAgentConfigPanel = dynamic(
	() => import("@/components/projects/studio/components/rovo-app-agent-config-panel").then((module) => module.RovoAppAgentConfigPanel),
	{ ssr: true },
);
const AgentTestPanel = dynamic(
	() => import("@/components/blocks/agent-test").then((module) => module.AgentTestPanel),
	{ ssr: true },
);

interface RovoAppShellProps {
	embedded?: boolean;
	initialThreadId?: string | null;
}

const ROVO_APP_SIDEBAR_MOTION_DURATION = "--duration-medium";
const ROVO_APP_SIDEBAR_MOTION_FALLBACK_MS = 200;
// Studio sidebar opens at this width by default across every view (home, agent
// config, etc.). The resize minimum is lowered to match so the default width is
// never clamped up on mount.
const ROVO_APP_SIDEBAR_DEFAULT_WIDTH = 216;
const ROVO_APP_SIDEBAR_MIN_WIDTH = 216;
const ROVO_APP_SIDEBAR_MAX_WIDTH = 480;
const STUDIO_LANDING_ENTER_TRANSITION = {
	type: "spring",
	visualDuration: 0.32,
	bounce: 0,
} as const;
const STUDIO_LANDING_REDUCED_TRANSITION = {
	duration: 0.08,
} as const;
const STUDIO_LANDING_CONTENT_INITIAL = {
	opacity: 0,
	transform: "translateY(8px)",
} as const;
const STUDIO_LANDING_CONTENT_VISIBLE = {
	opacity: 1,
	transform: "translateY(0px)",
} as const;
const STUDIO_LANDING_REDUCED_CONTENT_INITIAL = {
	opacity: 0,
} as const;
const STUDIO_LANDING_REDUCED_CONTENT_VISIBLE = {
	opacity: 1,
} as const;

const DEFAULT_COMPOSER_PLACEHOLDER = "Describe the agent you want to build";
const ROVO_APP_SPLIT_CHAT_PANEL_ID = "rovo-app-chat-pane";
const ROVO_APP_SPLIT_ARTIFACT_PANEL_ID = "rovo-app-artifact-pane";
const STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES = [
	{
		root: "right",
		selectors: [
			"[data-screen-assistant-target='sidebar-composer:voice']",
			"[data-screen-assistant-target='sidebar-composer'] button[aria-label='Stop live voice']",
			"[data-screen-assistant-target='sidebar-composer'] button[aria-label='Start live voice']",
		],
	},
	{
		root: "document",
		selectors: [
			"[data-screen-assistant-target='sidebar-composer:voice']",
			"[data-screen-assistant-target='sidebar-composer'] button[aria-label='Stop live voice']",
			"[data-screen-assistant-target='sidebar-composer'] button[aria-label='Start live voice']",
		],
	},
] as const;
const STUDIO_LIVE_CHAT_ANCHOR_RESOLVE_FRAMES = 180;
const STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_PARAM = "onboarding";
const STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_VALUE = "rovo-cursor";

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

function getStudioAgentCreationThreadTitle(thread: { title: string } | null): string {
	const title = thread?.title.trim();

	if (title && title !== "New chat") {
		return title;
	}

	return "Agent creation";
}

type StudioAgentRegistryContext = ReturnType<typeof useRovoSelectedAgent> & {
	registerCreatedAgentFromResult?: (
		agentResult: RovoDataParts["agent-result"],
		options?: { preserveCurrentThread?: boolean; select?: boolean; sourceKey?: string }
	) => RovoAgentProfile | null;
	registerAgentResult?: (agentResult: RovoDataParts["agent-result"], normalizedAgent?: RovoAgentProfile) => StudioAgentRegistrationResult;
	registerSessionAgent?: (agent: RovoAgentProfile, options?: { source?: string; result?: RovoDataParts["agent-result"] }) => StudioAgentRegistrationResult;
	selectAgent: (agentId: string, options?: { preserveCurrentThread?: boolean }) => void;
};

type StudioSubmitPromptPayload = Parameters<ReturnType<typeof useRovoApp>["submitPrompt"]>[0] & {
	creationMode?: "agent";
};

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

function waitForDeterministicTrace(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

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

type StudioScreenAssistantToolCall = {
	args: Record<string, unknown>;
	callId: string;
	name: string;
};

type StudioScreenAssistantToolResponder = (output: unknown, createResponse?: boolean) => void;

type StudioScreenAssistantTestWindow = Window & {
	__VPK_E2E_SCREEN_ASSISTANT__?: boolean;
	__vpkStudioScreenAssistantTest?: {
		callTool: (call: { args?: Record<string, unknown>; name: string }) => Promise<unknown>;
		streamAssistantText: (chunks: string[]) => Promise<{ ok: true }>;
	};
};

type TypedScrollAnchorSource = "none" | "standard" | "realtime";

type ScrollActiveTimelineSelection = {
	latestTimelineMessageId: string | null;
	messageId: string;
	runtimeThreadId: string | null;
};

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

export function RovoAppShell({ embedded = false, initialThreadId = null }: Readonly<RovoAppShellProps>) {
	const nav = useTopNavigation();
	const studioAgentRegistry = useRovoSelectedAgent() as StudioAgentRegistryContext;
	const { selectedAgent } = studioAgentRegistry;
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

	const [activeAgentConfig, setActiveAgentConfig] = useState<{
		profileId: string;
		sourceMessageId: string | null;
	} | null>(null);
	const activeAgentConfigRef = useRef(activeAgentConfig);
	const setActiveAgentConfigState = useCallback((nextAgentConfig: typeof activeAgentConfig) => {
		activeAgentConfigRef.current = nextAgentConfig;
		setActiveAgentConfig(nextAgentConfig);
	}, []);
	const [activeAgentConfigView, setActiveAgentConfigView] = useState<AgentConfigView>("configure");
	const [isSidebarAgentBrowserOpen, setIsSidebarAgentBrowserOpen] = useState(false);
	const [sidebarAgentBrowserInitialCategory, setSidebarAgentBrowserInitialCategory] = useState<HomeStarterCategory>(HOME_STARTER_DEFAULT_CATEGORY);
	const generatedAgentTestViewKeysRef = useLazyRef<Set<string>>(() => new Set());
	const hasSeededStudioRfpDemoAgentRef = useRef(false);
	const hasStartedAgentOnboardingTourPreviewRef = useRef(false);
	const hasQueuedAgentOnboardingTourPreviewRef = useRef(false);
	// Bumped each time an agent is created from a generated result, so a later
	// effect (declared after the onboarding-tour hook) can kick off the tour
	// without the earlier create handler needing the tour controller in scope.
	const [agentCreationTourSignal, setAgentCreationTourSignal] = useState(0);
	const openAgentCreationAskRovoChat = useCallback(() => {
		// Keep the Ask Rovo panel on the default Rovo build helper.
		studioAgentRegistry.resetAgentToRovo({ preserveCurrentThread: true });
		adoptStudioGenerationTranscript({
			chat: chatRef.current,
			registry: studioAgentRegistry,
		});
		nav.openChat("sidebar");
	}, [nav, studioAgentRegistry]);

	const resetSessionAgentsToStudioRfpDemoAgent = useCallback(() => {
		for (const entry of studioAgentRegistry.sessionAgentEntries) {
			studioAgentRegistry.removeSessionAgent(entry.profile.id);
		}

		const registeredProfile = studioAgentRegistry.registerCreatedAgentFromResult?.(STUDIO_RFP_DEMO_AGENT_RESULT, {
			preserveCurrentThread: true,
			select: false,
			sourceKey: STUDIO_RFP_DEMO_AGENT_SOURCE_KEY,
		});
		const profileId = registeredProfile?.id ?? STUDIO_RFP_DEMO_AGENT_PROFILE_ID;
		let seededEntry = studioAgentRegistry.getSessionAgentEntry?.(profileId) ?? null;
		if (seededEntry && seededEntry.publishedVersion === 0 && !seededEntry.publishedResult) {
			studioAgentRegistry.commitSessionAgentPublishReady?.(profileId);
			seededEntry =
				studioAgentRegistry.publishSessionAgent?.(profileId) ??
				studioAgentRegistry.getSessionAgentEntry?.(profileId) ??
				seededEntry;
		}
		hasSeededStudioRfpDemoAgentRef.current = true;
		return seededEntry;
	}, [studioAgentRegistry]);

	useEffect(() => {
		if (
			embedded ||
			initialThreadId ||
			hasSeededStudioRfpDemoAgentRef.current ||
			typeof studioAgentRegistry.registerCreatedAgentFromResult !== "function"
		) {
			return;
		}

		if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("agent")) {
			return;
		}

		const existingEntry = studioAgentRegistry.getSessionAgentEntry?.(STUDIO_RFP_DEMO_AGENT_PROFILE_ID);
		const persistedRecord = readSessionAgentRecords().find(
			(record) => record.profileId === STUDIO_RFP_DEMO_AGENT_PROFILE_ID,
		);

		// A hydrated entry or persisted record whose resultKey predates the current
		// seed version carries the OLD instruction body (before apps/skills were woven
		// in as inline mention chips). resultKey is `${sourceKey}:…`, so a bump of
		// STUDIO_RFP_DEMO_AGENT_SOURCE_KEY marks every prior copy stale — re-seed it so
		// returning users pick up the new lozenge-rich instructions instead of keeping
		// their localStorage copy.
		const seedVersionPrefix = `${STUDIO_RFP_DEMO_AGENT_SOURCE_KEY}:`;
		const persistedResultKey = existingEntry?.resultKey ?? persistedRecord?.resultKey;
		const hasStaleSeed =
			typeof persistedResultKey === "string" && !persistedResultKey.startsWith(seedVersionPrefix);

		// An up-to-date persisted record not yet hydrated into an entry: leave it for
		// the rehydration effect to surface, and don't reseed.
		if (!existingEntry && persistedRecord && !hasStaleSeed) {
			return;
		}

		hasSeededStudioRfpDemoAgentRef.current = true;

		// Drop a stale hydrated entry first so the re-register replaces it instead of
		// adding a second entry with the same profileId. removeSessionAgent updates the
		// entries ref synchronously, so the register below sees the cleared state.
		if (hasStaleSeed && existingEntry) {
			studioAgentRegistry.removeSessionAgent?.(STUDIO_RFP_DEMO_AGENT_PROFILE_ID);
		}

		const reuseExistingProfile = hasStaleSeed ? undefined : existingEntry?.profile;
		const registeredProfile = reuseExistingProfile
			?? studioAgentRegistry.registerCreatedAgentFromResult(STUDIO_RFP_DEMO_AGENT_RESULT, {
				preserveCurrentThread: true,
				select: false,
				sourceKey: STUDIO_RFP_DEMO_AGENT_SOURCE_KEY,
			});
		const profileId = registeredProfile?.id ?? existingEntry?.profile.id;
		if (!profileId) {
			return;
		}

		const seededEntry = studioAgentRegistry.getSessionAgentEntry?.(profileId);
		if (seededEntry && seededEntry.publishedVersion === 0 && !seededEntry.publishedResult) {
			studioAgentRegistry.commitSessionAgentPublishReady?.(profileId);
			studioAgentRegistry.publishSessionAgent?.(profileId);
		}
	}, [embedded, initialThreadId, studioAgentRegistry]);

	const handleStudioAgentResultSelect = useCallback(
		(rawAgentResult: RovoDataParts["agent-result"], options?: { sourceMessageId?: string; sourceKey?: string }): boolean => {
			// Repair catalog references on every generated result at this single ingest
			// boundary (create AND any future update path), so hallucinated ids are
			// fuzzy-repaired, @[category:id] tokens resolved, and body lozenges unioned
			// into the config arrays. Idempotent — the context-side create path repairs
			// too, but applying here also covers non-create results. User panel edits go
			// through updateSessionAgentDraft and are intentionally NOT repaired here.
			// Deterministically enrich a template-based result from its originating
			// template BEFORE repair, so an agent created from a template always looks
			// rich (chipped body + bound skills/apps/knowledge/subagents + triggers)
			// even when the model returns a thin profile. Fill-when-empty + chip-less-
			// body-only replacement; a no-op for from-scratch (non-matching) results.
			const templateEnriched = applyTemplateDefaultsToResult(rawAgentResult);
			const repaired = {
				...templateEnriched,
				...repairGeneratedAgentCatalog(templateEnriched),
			};
			// Hydrate generated trigger strings (e.g. "A Jira issue is blocked",
			// "every day at 7am") into automation rules so the config panel shows
			// automation chips with nested provider-icon event triggers instead of
			// plain labels. Maps each string to its provider; only when no rules exist.
			const triggerStrings = Array.isArray(repaired.triggers) && repaired.triggers.length > 0
				? repaired.triggers
				: repaired.trigger
					? [repaired.trigger]
					: [];
			const templateForTriggers = resolveTemplateConfigForResult(repaired);
			const inferredAutomationRules = !repaired.automationRules || repaired.automationRules.length === 0
				? inferAutomationRules(triggerStrings, {
						automationName: templateForTriggers?.triggerAutomationName,
						prompt: templateForTriggers?.triggerPrompt,
					})
				: undefined;
			// Pre-fill the shared automation prompt + name (the "Agent Instructions" /
			// "Automation name" fields in the trigger dialog) from the originating
			// template, so a template-based agent's automation isn't a blank form.
			const agentResult = inferredAutomationRules
				? { ...repaired, automationRules: inferredAutomationRules }
				: repaired;
			const normalizedAgent = normalizeStudioAgentResult(agentResult);
			if (!normalizedAgent) {
				return false;
			}

			const sourceKey = options?.sourceKey
				?? (options?.sourceMessageId
					? `studio-agent-result:${chat.activeThreadId ?? chat.runtimeThreadId}:${options.sourceMessageId}:${agentResult.agentId}`
					: undefined);

			if (typeof studioAgentRegistry.registerCreatedAgentFromResult === "function") {
				const registered = studioAgentRegistry.registerCreatedAgentFromResult(agentResult, {
					preserveCurrentThread: true,
					select: true,
					sourceKey,
				});
				if (!registered) {
					return false;
				}
				setActiveAgentConfigState({
					profileId: registered.id,
					sourceMessageId: options?.sourceMessageId ?? null,
				});
				setActiveAgentConfigView("test");
				openAgentCreationAskRovoChat();
				setAgentCreationTourSignal((signal) => signal + 1);
				return true;
			}

			// Fallback integration point for older Worker C drafts: use session-agent
			// registration plus preserve-current-thread selection when available.
			let didRegisterAgent = false;
			let registrationResult: StudioAgentRegistrationResult = null;
			if (typeof studioAgentRegistry.registerAgentResult === "function") {
				didRegisterAgent = true;
				registrationResult = studioAgentRegistry.registerAgentResult(agentResult, normalizedAgent);
			} else if (typeof studioAgentRegistry.registerSessionAgent === "function") {
				didRegisterAgent = true;
				registrationResult = studioAgentRegistry.registerSessionAgent(normalizedAgent, {
					result: agentResult,
					source: "/studio",
				});
			}

			if (!didRegisterAgent) {
				return false;
			}

			const agentId = resolveRegisteredStudioAgentId(registrationResult, normalizedAgent.id);
			studioAgentRegistry.selectAgent(agentId, { preserveCurrentThread: true });
			setActiveAgentConfigState({
				profileId: agentId,
				sourceMessageId: options?.sourceMessageId ?? null,
			});
			setActiveAgentConfigView("test");
			openAgentCreationAskRovoChat();
			setAgentCreationTourSignal((signal) => signal + 1);
			return true;
		},
		[chat.activeThreadId, chat.runtimeThreadId, openAgentCreationAskRovoChat, setActiveAgentConfigState, studioAgentRegistry],
	);
	const renderStudioAskRovoWidget = useCallback(
		(widget: { type: string; data: unknown }, message: RovoRenderableUIMessage): ReactNode => {
			if (widget.type !== STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE) {
				return null;
			}

			const payload = parseStudioAutomationArtifactListPayload(widget.data);
			if (!payload) {
				return null;
			}

			return (
				<StudioAutomationArtifactListWidget
					messageId={message.id}
					onAgentResultSelect={handleStudioAgentResultSelect}
					payload={payload}
				/>
			);
		},
		[handleStudioAgentResultSelect],
	);
	const getStudioAskRovoWidgetPosition = useCallback(
		(widgetType: string) => (
			widgetType === STUDIO_AUTOMATION_ARTIFACT_LIST_TYPE
				? "before-content" as const
				: undefined
		),
		[],
	);

	// "Start from scratch" — create a fresh, untitled session agent (no AI result
	// to derive from) and open the blank config pane on it. We register a minimal
	// create-payload directly via the registry because the normal agent-result path
	// (`normalizeStudioAgentResult`) requires a name, description, and conversation
	// starters, none of which exist for a from-scratch agent.
	const handleStartAgentFromScratch = useCallback(() => {
		if (typeof studioAgentRegistry.registerCreatedAgentFromResult !== "function") {
			return;
		}

		const uniqueSuffix = `${Date.now()}`;
		const blankAgentResult: RovoDataParts["agent-result"] = {
			action: "create",
			agentId: `untitled-agent-${uniqueSuffix}`,
			avatarSrc: getRandomAgentAvatarSrc(),
			name: "",
			summary: "",
		};

		const registered = studioAgentRegistry.registerCreatedAgentFromResult(blankAgentResult, {
			preserveCurrentThread: true,
			select: true,
			// A from-scratch agent has no name/content yet, so suppress the
			// "Saving…/Saved" indicator — there is nothing meaningful to save.
			silentSave: true,
			sourceKey: `studio-start-from-scratch:${uniqueSuffix}`,
		});
		if (!registered) {
			return;
		}

		setActiveAgentConfigState({
			profileId: registered.id,
			sourceMessageId: null,
		});
		setActiveAgentConfigView("configure");
		openAgentCreationAskRovoChat();
	}, [openAgentCreationAskRovoChat, setActiveAgentConfigState, studioAgentRegistry]);

	const handleStudioSidebarAgentSelect = useCallback(
		(agentId: string) => {
			// Open the agent for editing WITHOUT pointing chat at the custom
			// agent. The right-hand "Ask Rovo" panel must stay on the default Rovo
			// build helper (with the "Edit: <agent>" bar), exactly like the
			// create-from-scratch path. Selecting the custom agent here is what
			// caused the panel to "swap" onto the custom agent on the second
			// click. `activeAgentConfig` drives both the config pane and `?agent=`.
			setActiveAgentConfigState({
				profileId: agentId,
				sourceMessageId: null,
			});
			setActiveAgentConfigView("configure");
		},
		[setActiveAgentConfigState],
	);

	const handleDeleteStudioAgent = useCallback(
		(agentId: string) => {
			// Close the config pane first so its draft editor cannot re-save a
			// session agent after the registry entry is removed.
			if (activeAgentConfig?.profileId === agentId) {
				setActiveAgentConfigState(null);
			}
			startTransition(() => {
				studioAgentRegistry.removeSessionAgent(agentId);
			});
		},
		[activeAgentConfig?.profileId, setActiveAgentConfigState, studioAgentRegistry],
	);

	// Returns to the "Agents" landing (bento). Shared by the sidebar's "Agents"
	// header (when it has no recent agents to expand) and the "View all agents"
	// row. Must clear all three view-model layers: the agent-config pane
	// (activeAgentConfig), the selected custom agent (resetAgentToRovo flips
	// isCustomAgentSelected), and the chat thread (openNewChat). Without the first
	// two, openNewChat alone leaves the custom-agent screen open.
	const handleReturnToAgentsHome = useCallback(() => {
		setOptimisticUserMessage(null);
		setActiveAgentConfigState(null);
		setActiveAgentConfigView("configure");
		studioAgentRegistry.resetAgentToRovo();
		startTransition(() => {
			void chat.openNewChat();
		});
	}, [chat, setActiveAgentConfigState, studioAgentRegistry]);

	const handleSidebarBrowseAgentSelect = useCallback(
		(agent: { id: string }) => {
			if (studioAgentRegistry.getSessionAgentEntry?.(agent.id)) {
				// Editable custom agent: open the config pane and keep the
				// Ask Rovo build helper (do NOT select it for chat), matching the
				// create + sidebar-select paths so nothing "swaps" on re-entry.
				setActiveAgentConfigState({
					profileId: agent.id,
					sourceMessageId: null,
				});
				setActiveAgentConfigView("configure");
			} else {
				// Non-editable (built-in/published) agent: there is no config pane
				// to edit, so this is a genuine "chat with this agent" action.
				studioAgentRegistry.selectAgent(agent.id, { preserveCurrentThread: true });
				setActiveAgentConfigState(null);
				setActiveAgentConfigView("configure");
			}
			setIsSidebarAgentBrowserOpen(false);
		},
		[setActiveAgentConfigState, studioAgentRegistry],
	);

	const handleUpdateAgentDraft = useCallback(
		(profileId: string, patch: Partial<RovoDataParts["agent-result"]>) => {
			studioAgentRegistry.updateSessionAgentDraft?.(profileId, patch);
		},
		[studioAgentRegistry],
	);

	const handleCommitAgentPublishReady = useCallback(
		(profileId: string) => {
			studioAgentRegistry.commitSessionAgentPublishReady?.(profileId);
		},
		[studioAgentRegistry],
	);

	const handleTestAgent = useCallback(
		(profileId: string) => {
			studioAgentRegistry.commitSessionAgentPublishReady?.(profileId);
			setActiveAgentConfigView("test");
		},
		[studioAgentRegistry],
	);

	const handleAgentConfigViewChange = useCallback(
		(view: AgentConfigView) => {
			setActiveAgentConfigView(view);
		},
		[],
	);

	// Restore (or clear) the agent config pane when the active agent is
	// reconciled *from the URL* — deep link, reload, or browser back/forward.
	// In-page selection sets `activeAgentConfig` in its own handler; this covers
	// the URL-seed path, which otherwise only re-selects the agent for chat and
	// would leave the studio on the agent's chat surface with no config pane.
	const handleAgentRestoredFromUrl = useCallback((agentId: string | null) => {
		if (activeAgentConfigRef.current?.profileId !== agentId) {
			setActiveAgentConfigView("configure");
		}
		setActiveAgentConfigState(agentId ? { profileId: agentId, sourceMessageId: null } : null);
	}, [setActiveAgentConfigState]);

	// Mirror the agent being EDITED (the open config pane / `activeAgentConfig`)
	// into the URL (`?agent=`) so it is deep-linkable, survives reload, and works
	// with browser back/forward. This intentionally tracks the edited agent, not
	// the chat-selected agent: the Ask Rovo panel stays on the default Rovo build
	// helper while editing, so URL identity must follow the config pane.
	// `onAgentRestoredFromUrl` re-opens the config pane for the URL-restored agent.
	const selectableAgentIds = useMemo(
		() => studioAgentRegistry.selectableAgents.map((agent) => agent.id),
		[studioAgentRegistry.selectableAgents],
	);
	useAgentUrlSync({
		enabled: !embedded,
		editingAgentId: activeAgentConfig?.profileId ?? null,
		selectableAgentIds,
		onAgentRestored: handleAgentRestoredFromUrl,
	});

	const handlePublishAgent = useCallback(
		(profileId: string) => {
			studioAgentRegistry.publishSessionAgent?.(profileId);
		},
		[studioAgentRegistry],
	);

	const activeSessionAgentEntry = useMemo(() => {
		if (!activeAgentConfig) {
			return null;
		}
		const entries = studioAgentRegistry.sessionAgentEntries;
		if (!Array.isArray(entries)) {
			return null;
		}
		return entries.find((entry) => entry.profile.id === activeAgentConfig.profileId) ?? null;
	}, [activeAgentConfig, studioAgentRegistry.sessionAgentEntries]);
	const shouldShowAgentConfigPane = Boolean(activeSessionAgentEntry);
	// Drives the "Edit agent" context bar above the studio sidebar-chat input.
	// Defaults to the expanded "Edit: <agent>" state; the bar itself owns the
	// collapse-to-pill / re-expand affordance.
	const agentEditContextBar = useMemo<ChatContextBarDescriptor | null>(() => {
		if (!activeSessionAgentEntry) {
			return null;
		}
		const { profile } = activeSessionAgentEntry;
		const agentName = getStudioSessionAgentDisplayName(activeSessionAgentEntry);
		return {
			iconName: "agent",
			label: agentName,
			avatarSrc: profile.avatarSrc,
			signature: `studio-edit-agent:${profile.id}`,
			variant: "edit",
			collapsible: true,
			collapsedLabel: "Edit agent",
		};
	}, [activeSessionAgentEntry]);
	// When the "Edit agent" context bar is active, the Ask Rovo empty state pivots
	// to an agent-improvement greeting; closing the bar reverts to the default.
	const agentEditGreeting = useMemo<ChatPanelGreetingProps | undefined>(() => {
		if (!agentEditContextBar) {
			return undefined;
		}
		return {
			heading: AGENT_EDIT_GREETING_HEADING,
			illustrationSrc: AGENT_EDIT_GREETING_ILLUSTRATION_SRC,
			illustrationDarkSrc: AGENT_EDIT_GREETING_ILLUSTRATION_DARK_SRC,
			suggestions: agentEditSuggestions,
		};
	}, [agentEditContextBar]);
	const agentEditCards = useMemo(() => {
		return createStudioAgentEditCards({
			entry: activeSessionAgentEntry,
			sourceMessageId: activeAgentConfig?.sourceMessageId ?? null,
		});
	}, [activeSessionAgentEntry, activeAgentConfig?.sourceMessageId]);
	// When the Ask Rovo sidebar is editing a studio agent, ride the shared product
	// knowledge (catalog ids + editable fields) on every sidebar turn that falls
	// through to the model, so typed requests understand the agent builder the same
	// way the voice cursor does. Deterministic edits are intercepted before this
	// reaches the backend; only model-backed turns carry it.
	const agentEditSendPromptOptions = useMemo<SendPromptOptions | undefined>(() => {
		if (!agentEditContextBar) {
			return undefined;
		}
		return { contextDescription: buildStudioAssistantKnowledgeContext() };
	}, [agentEditContextBar]);
	// The Ask Rovo edit panel always talks to the default Rovo agent (it's a
	// build/improve helper), so it renders as a plain default-Rovo chat without
	// the custom-agent Chat / Trigger / Activity tab header. Those tabs belong to
	// the left-hand Test panel, which is the surface scoped to the custom agent.
	const askRovoChatResize = useStudioAskRovoChatResize({
		defaultWidth: 400,
		minWidth: 320,
		maxWidth: 720,
		direction: "rtl",
	});
	const askRovoChatPanelWidth = askRovoChatResize.sidebarWidth;
	const isStudioAskRovoChatActive = !embedded && shouldShowAgentConfigPane && nav.isSidebarChatOpen;
	// "Ask Rovo" must always talk to the default Rovo agent, not the custom agent
	// being edited in the config pane. Point the selected agent back to Rovo when
	// the chat is being opened, but preserve the current thread so a generation
	// transcript (or in-progress edit conversation) stays visible on reopen.
	const handleToggleAskRovoChat = useCallback(() => {
		if (!nav.isSidebarChatOpen) {
			studioAgentRegistry.resetAgentToRovo({ preserveCurrentThread: true });
		}
		nav.toggleChat();
	}, [nav, studioAgentRegistry]);
	// When the active agent disappears (e.g. provider remounts), clear the
	// config pane so we don't keep a stale reference around.
	useEffect(() => {
		if (activeAgentConfig && !activeSessionAgentEntry) {
			if (studioAgentRegistry.getSessionAgentEntry?.(activeAgentConfig.profileId)) {
				return;
			}

			setActiveAgentConfigState(null);
			setActiveAgentConfigView("configure");
		}
	}, [activeAgentConfig, activeSessionAgentEntry, setActiveAgentConfigState, studioAgentRegistry]);

	useEffect(() => {
		if (!activeAgentConfig || !activeSessionAgentEntry) {
			return;
		}

		for (const message of chat.messages.toReversed()) {
			const agentResult = getMessageAgentResult(message);
			if (!isGeneratedAgentResult(agentResult) || !hasTurnCompleteSignal(message)) {
				continue;
			}

			const isActiveGeneratedAgent =
				message.id === activeAgentConfig.sourceMessageId ||
				agentResult.agentId === activeSessionAgentEntry.sourceResult.agentId ||
				agentResult.agentId === activeSessionAgentEntry.draftResult.agentId ||
				agentResult.agentId === activeSessionAgentEntry.publishReadyResult.agentId;

			if (isActiveGeneratedAgent) {
				const agentResultKey = `${chat.runtimeThreadId}:${message.id}:${agentResult.agentId}:${agentResult.action}`;
				if (generatedAgentTestViewKeysRef.current.has(agentResultKey)) {
					break;
				}

				// Record the key as soon as the completed result is observed —
				// even when we're already in Test because a registration path
				// (handleRegisterAgent) or the Test toggle put us there. Only the
				// view-switch below is gated on "not already in test"; the key
				// itself must always be marked seen. Otherwise the first time the
				// user leaves Test this effect re-runs, finds the key unseen, and
				// yanks them back into Test — remounting the chat and replaying the
				// greeting (the "two clicks to leave Test" bug).
				generatedAgentTestViewKeysRef.current.add(agentResultKey);
				if (activeAgentConfigView !== "test") {
					setActiveAgentConfigView("test");
					openAgentCreationAskRovoChat();
				}
				break;
			}
		}
		}, [activeAgentConfig, activeAgentConfigView, activeSessionAgentEntry, chat.messages, chat.runtimeThreadId, generatedAgentTestViewKeysRef, openAgentCreationAskRovoChat]);

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
	const dictationBaselineRef = useRef<string | null>(null);
	const dictationCommittedTextRef = useRef<string | null>(null);
	const isDictationActiveRef = useRef(false);
	const sidebarResize = useSidebarResize({
		defaultWidth: ROVO_APP_SIDEBAR_DEFAULT_WIDTH,
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
	// Gate the persistent chrome's width/border transition so it never plays on
	// first paint. The chrome renders at its final geometry during hydration,
	// but a post-mount state settle (the global-sidebar bridge syncing
	// sidebarOpen, or a responsive width pass) would otherwise trigger the
	// transition-[width,border-color] animation on every refresh — the chrome
	// visibly slides into place. Flipping the flag a frame after mount lets that
	// initial settle apply instantly; only user-driven toggles after load animate.
	const [hasMountedChrome, setHasMountedChrome] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setHasMountedChrome(true));
		return () => cancelAnimationFrame(frame);
	}, []);
	const [cursorMode, setCursorMode] = useState(false);
	const [galleryExpanded, setGalleryExpanded] = useState(false);
	const [agentTemplatesDialogOpen, setAgentTemplatesDialogOpen] = useState(false);
	const [agentTemplatesInitialCategory, setAgentTemplatesInitialCategory] = useState<HomeStarterCategory>(HOME_STARTER_DEFAULT_CATEGORY);
	const [composerFocusRequestKey, setComposerFocusRequestKey] = useState(0);
	const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
	const [prefillText, setPrefillText] = useState<string | null>(null);
	const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
	const [isDictationActive, setIsDictationActive] = useState(false);
	const [dictationTranscriptPreview, setDictationTranscriptPreview] = useState<string | null>(null);
	const [scrollActiveTimelineSelection, setScrollActiveTimelineSelection] = useState<ScrollActiveTimelineSelection | null>(null);
	const [scrollAnchorMessageId, setScrollAnchorMessageId] = useState<string | null>(null);
	const [scrollFollowMode, setScrollFollowMode] = useState<ConversationFollowMode>("bottom");
	const [optimisticUserMessage, setOptimisticUserMessage] = useState<ReturnType<typeof createRovoAppUserMessage> | null>(null);
	const [isDefaultHomeSubmitTransition, setIsDefaultHomeSubmitTransition] = useState(false);
	const [dismissedBrowserArtifactKey, setDismissedBrowserArtifactKey] = useState<string | null>(null);
	const realtimeUserMessageIdRef = useRef<string | null>(null);
	const realtimeAssistantMessageIdRef = useRef<string | null>(null);
	const realtimeAssistantMessagePromiseRef = useRef<Promise<string | null> | null>(null);
	const realtimeUserTranscriptHasDeltaRef = useRef(false);
	const manualVoiceStopRef = useRef(false);
	const injectedRealtimeThreadContextKeyRef = useRef<string | null>(null);
	const injectedRealtimeArtifactContextKeyRef = useRef<string | null>(null);
	const pendingTypedScrollAnchorRef = useRef(false);
	const isDefaultAgentHomeStateRef = useRef(false);
	const studioAgentCreationThreadKeysRef = useLazyRef<Set<string>>(() => new Set());
	const studioAgentCreationThreadTouchedAtRef = useLazyRef<Map<string, number>>(() => new Map());
	const [studioAgentCreationThreadIds, setStudioAgentCreationThreadIds] = useState<ReadonlySet<string>>(() => new Set());
	const studioAgentCreationThreads = useMemo(() => {
		return Array.from(studioAgentCreationThreadIds).map((threadId) => {
			const thread = chat.threads.find((currentThread) => currentThread.id === threadId) ?? null;
			// Prefer the live message list for the active thread (freshest); fall
			// back to a background thread's persisted messages. A pending question
			// card means that creation thread is paused awaiting the user's answers.
			const threadMessages = threadId === chat.activeThreadId ? chat.messages : (thread?.messages ?? []);
			return {
				id: threadId,
				lastTouchedAt: studioAgentCreationThreadTouchedAtRef.current.get(threadId) ?? 0,
				title: getStudioAgentCreationThreadTitle(thread),
				isAwaitingResponse: Boolean(getLatestQuestionCardPayload(threadMessages)),
			};
		});
		}, [chat.activeThreadId, chat.messages, chat.threads, studioAgentCreationThreadIds, studioAgentCreationThreadTouchedAtRef]);
	const studioAutomationGeneratingAgents = useMemo(() => (
		getStudioAutomationGeneratingAgents(chat.messages)
	), [chat.messages]);

	const resetStudioDemoLocalState = useCallback(() => {
		setOptimisticUserMessage(null);
		setCursorMode(false);
		setGalleryExpanded(false);
		setAgentTemplatesDialogOpen(false);
		setAgentTemplatesInitialCategory(HOME_STARTER_DEFAULT_CATEGORY);
		setIsSidebarAgentBrowserOpen(false);
		setSidebarAgentBrowserInitialCategory(HOME_STARTER_DEFAULT_CATEGORY);
		setComposerFocusRequestKey(0);
		setPreviewPrompt(null);
		setPrefillText(null);
		creationTemplateRef.current = null;
		creationTemplateByThreadRef.current = {};
		setVoiceTranscript(null);
		setIsDictationActive(false);
		setDictationTranscriptPreview(null);
		setScrollActiveTimelineSelection(null);
		setScrollAnchorMessageId(null);
		setScrollFollowMode("bottom");
		setIsDefaultHomeSubmitTransition(false);
		setDismissedBrowserArtifactKey(null);
		studioAgentCreationThreadKeysRef.current.clear();
		studioAgentCreationThreadTouchedAtRef.current.clear();
		setStudioAgentCreationThreadIds(new Set<string>());
		setActiveAgentConfigState(null);
		setActiveAgentConfigView("configure");
	}, [
		setActiveAgentConfigState,
		studioAgentCreationThreadKeysRef,
		studioAgentCreationThreadTouchedAtRef,
	]);
	const { isResettingStudioDemo, resetStudioDemo } = useStudioDemoReset({
		chat,
		embedded,
		onResetLocalState: resetStudioDemoLocalState,
		resetSessionAgentsToStudioRfpDemoAgent,
		studioAgentRegistry,
	});

	const studioSettingsMenuItems = useMemo(() => [
		{
			disabled: isResettingStudioDemo,
			elemBefore: <RefreshIcon label="" />,
			id: "reset-studio-demo",
			label: isResettingStudioDemo ? "Resetting demo..." : "Reset demo",
			onSelect: resetStudioDemo,
			variant: "destructive" as const,
		},
	], [isResettingStudioDemo, resetStudioDemo]);
	const handledAgentResultKeysRef = useLazyRef<Set<string>>(() => new Set());
	const previousTypedAnchorUserMessageIdRef = useRef<string | null>(null);
	const typedScrollAnchorSourceRef = useRef<TypedScrollAnchorSource>("none");
	const realtimeTypedResponseStartedRef = useRef(false);
	const speechStartedAtRef = useRef<string | null>(null);

	const markStudioAgentCreationThread = useCallback((threadId: string | null) => {
		if (!threadId) {
			return;
		}

		studioAgentCreationThreadKeysRef.current.add(threadId);
		studioAgentCreationThreadTouchedAtRef.current.set(threadId, Date.now());
		setStudioAgentCreationThreadIds((currentThreadIds) => {
			const nextThreadIds = new Set(currentThreadIds);
			nextThreadIds.add(threadId);
			return nextThreadIds;
		});
		}, [studioAgentCreationThreadKeysRef, studioAgentCreationThreadTouchedAtRef]);

	const unmarkStudioAgentCreationThread = useCallback((threadId: string | null) => {
		if (!threadId) {
			return;
		}

		studioAgentCreationThreadKeysRef.current.delete(threadId);
		studioAgentCreationThreadTouchedAtRef.current.delete(threadId);
		setStudioAgentCreationThreadIds((currentThreadIds) => {
			if (!currentThreadIds.has(threadId)) {
				return currentThreadIds;
			}

			const nextThreadIds = new Set(currentThreadIds);
			nextThreadIds.delete(threadId);
			return nextThreadIds;
		});
		}, [studioAgentCreationThreadKeysRef, studioAgentCreationThreadTouchedAtRef]);

	// Provenance of the template a user started agent creation from. The ref holds
	// the pending selection (set when a template/bento card is chosen, consumed +
	// cleared on submit); the per-thread map keeps it available for the
	// clarification continuation rounds on that creation thread.
	const creationTemplateRef = useRef<StudioCreationTemplateContext | null>(null);
	const creationTemplateByThreadRef = useRef<Record<string, StudioCreationTemplateContext>>({});

	const handleGalleryPreviewStart = useCallback((prompt: string) => {
		setPreviewPrompt(prompt);
	}, []);

	const handleGalleryPreviewEnd = useCallback(() => {
		setPreviewPrompt(null);
	}, []);

	const handleGallerySelect = useCallback((prompt: string, template?: StudioCreationTemplateContext) => {
		setPrefillText(prompt);
		setPreviewPrompt(null);
		creationTemplateRef.current = template ?? null;
		// Refocus the composer caret so the user can immediately hit Enter to submit.
		setComposerFocusRequestKey((currentKey) => currentKey + 1);
	}, []);

	const handleBrowseAgentTemplates = useCallback((category: HomeStarterCategory = HOME_STARTER_DEFAULT_CATEGORY) => {
		setAgentTemplatesInitialCategory(category);
		setAgentTemplatesDialogOpen(true);
	}, []);

	// The home bento's "Browse all" pill opens the full Agent Directory instead
	// of the lighter templates dialog. The bento auto-cycles its category, but we
	// always land the directory on the first template tab ("Planning") for a
	// predictable entry point, so the cycling tab is intentionally ignored.
	const handleBrowseAgentsDirectory = useCallback(() => {
		setSidebarAgentBrowserInitialCategory(AGENT_TEMPLATES_CATEGORIES[0].id);
		setIsSidebarAgentBrowserOpen(true);
	}, []);

	// The empty-instructions "start with a template" link opens the same agents
	// directory as "Browse all", landing on the first template tab.
	const handleStartAgentWithTemplate = handleBrowseAgentsDirectory;

	const handleTemplateAgentSelect = useCallback((agent: AgentTemplatesAgent) => {
		handleGallerySelect(
			agent.templatePrompt ?? buildFallbackTemplatePrompt(agent),
			buildCreationTemplateContextFromAgent(agent),
		);
		setAgentTemplatesDialogOpen(false);
		setIsSidebarAgentBrowserOpen(false);
	}, [handleGallerySelect]);

	const handleBuildTemplateAgent = useCallback((agent: AgentTemplatesAgent, options: AgentsDirectoryTemplateBuildOptions) => {
		if (typeof studioAgentRegistry.registerCreatedAgentFromResult !== "function") {
			return null;
		}

		const agentResult = buildTemplateAgentResultFromAgent(agent, {
			appIds: options.connectApps ? options.appIds : [],
		});
		const registered = studioAgentRegistry.registerCreatedAgentFromResult(agentResult, {
			preserveCurrentThread: true,
			select: true,
			sourceKey: `studio-template-setup:${agent.id}:${Date.now()}`,
		});

		return registered
			? {
					profileId: registered.id,
					onCancel: () => studioAgentRegistry.removeSessionAgent(registered.id),
				}
			: null;
	}, [studioAgentRegistry]);

	const handleOpenBuiltTemplateAgentConfig = useCallback((profileId: string) => {
		setActiveAgentConfigState({
			profileId,
			sourceMessageId: null,
		});
		setActiveAgentConfigView("configure");
		setIsSidebarAgentBrowserOpen(false);
	}, [setActiveAgentConfigState]);

	const handleFocusStudioComposer = useCallback(() => {
		setComposerFocusRequestKey((currentKey) => currentKey + 1);
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

	// Question card / clarification support
	const activeQuestionCard = useMemo(() => getLatestQuestionCardPayload(chat.messages), [chat.messages]);
	const hasPersistedAgentCreationPrompt = useMemo(
		() => chat.messages.some((message) => message.metadata?.creationMode === "agent"),
		[chat.messages],
	);
	const { acceptPlanReview, submitClarification } = chat;
	// True when the active thread is a Studio agent-creation flow (model creation
	// card, persisted creation prompt, or a thread we tagged as creation). Computed
	// inline (not memoized) so it always reflects the live mutable refs — a memo
	// keyed on thread ids alone would read a stale snapshot if the ref is mutated
	// without a dep change.
	const isStudioAgentCreationThread =
		activeQuestionCard?.creationMode === "agent" ||
		hasPersistedAgentCreationPrompt ||
		studioAgentCreationThreadKeysRef.current.has(chat.runtimeThreadId) ||
		(chat.activeThreadId
			? studioAgentCreationThreadKeysRef.current.has(chat.activeThreadId)
			: false);
	// The template (if any) bound to this creation thread. Templates derive their
	// catalog scope from their bound ids and skip the domain-scope question;
	// free-text creation injects it instead. Read live for the same reason.
	const studioCreationTemplate =
		creationTemplateByThreadRef.current[chat.runtimeThreadId] ??
		(chat.activeThreadId ? creationTemplateByThreadRef.current[chat.activeThreadId] : undefined);
	// Free-text creation cards get a deterministic 10-category domain question
	// prepended so the user's pick scopes the generation catalog. Rendered only;
	// the base `activeQuestionCard` is what we submit to the model tool contract.
	const renderedQuestionCard =
		activeQuestionCard && isStudioAgentCreationThread && !studioCreationTemplate
			? withDomainScopeQuestion(activeQuestionCard)
			: activeQuestionCard;
	// Remember the chosen scope per thread so later clarification rounds (which no
	// longer render the domain question) keep the same catalog scope.
	const creationDomainScopeByThreadRef = useRef<Record<string, readonly string[]>>({});
	const getStudioAgentCreationClarificationOptions = useCallback(
		(categoryIds?: readonly string[]) => {
			if (!isStudioAgentCreationThread) {
				return undefined;
			}
			return {
				contextDescription: buildStudioAgentCreationContinuationContext(studioCreationTemplate, {
					categoryIds,
				}),
				creationMode: "agent" as const,
			};
		},
		[isStudioAgentCreationThread, studioCreationTemplate],
	);
	const handleCancelClarificationQuestionSet = useCallback(
		(questionCard: ParsedQuestionCardPayload) => {
			return chat.cancelClarificationQuestionSet(questionCard, getStudioAgentCreationClarificationOptions());
		},
		[chat, getStudioAgentCreationClarificationOptions],
	);
	const {
		shouldShowQuestionCard: shouldShowQuestionCardRaw,
		activeQuestionCardKey,
		hideQuestionCard,
		dismissQuestionCard,
	} = useDismissibleCards({
		activeQuestionCard,
		onDismissQuestionCard: handleCancelClarificationQuestionSet,
	});
	const [submittingQuestionCardKey, setSubmittingQuestionCardKey] = useState<string | null>(null);
	const isDeferredQuestionCard = Boolean(activeQuestionCard?.deferredToolCallId);
	const shouldShowQuestionCard = shouldShowQuestionCardRaw && (!chat.isStreaming || isDeferredQuestionCard);
	const handleClarificationSubmit = useCallback(
		async (answers: ClarificationAnswers) => {
			if (!activeQuestionCard) return;
			const questionCardKey = activeQuestionCardKey ?? `${activeQuestionCard.sessionId}:${activeQuestionCard.round}`;
			if (submittingQuestionCardKey === questionCardKey) return;
			setSubmittingQuestionCardKey(questionCardKey);
			try {
				// Scope the generation catalog: templates derive it from their bound
				// ids; free-text uses the domain-scope answer, remembered per thread so
				// later rounds (no domain question) keep the same scope.
				const scopeKey = activeQuestionCard.sessionId;
				const storedScope = scopeKey
					? creationDomainScopeByThreadRef.current[scopeKey]
					: undefined;
				const categoryIds = studioCreationTemplate
					? deriveTemplateCategoryIds(studioCreationTemplate)
					: (readDomainCategoryIds(answers) ?? storedScope);
				if (categoryIds && scopeKey) {
					creationDomainScopeByThreadRef.current[scopeKey] = categoryIds;
				}
				await submitClarification(
					activeQuestionCard,
					omitDomainScopeAnswer(answers),
					{
						...getStudioAgentCreationClarificationOptions(categoryIds),
						onSubmitted: hideQuestionCard,
					},
				);
			} catch {
				// submitClarification owns the user-facing error state.
			} finally {
				setSubmittingQuestionCardKey((currentKey) =>
					currentKey === questionCardKey ? null : currentKey,
				);
			}
		},
		[
			activeQuestionCard,
			activeQuestionCardKey,
			getStudioAgentCreationClarificationOptions,
			hideQuestionCard,
			studioCreationTemplate,
			submitClarification,
			submittingQuestionCardKey,
		],
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
	// True when the composer dock renders a shadowed card (question or approval)
	// rather than the regular composer. Used to reserve room for the card's soft
	// shadow so the home-state scrollport doesn't clip it.
	const isShowingDockCard = (shouldShowQuestionCard && activeQuestionCard !== null) || (shouldShowApprovalCard && activePendingPlan !== null);

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

	// --- Studio AI cursor companion ---
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
	const screenAssistantPointerRef = useRef<{ x: number; y: number } | null>(null);
	const screenAssistantComposerRef = useRef<{
		hasPrefill?: boolean;
		placeholder?: string;
	}>({
		placeholder: DEFAULT_COMPOSER_PLACEHOLDER,
	});
	// Refs let the screen-assistant tool executor (created with the realtime hook
	// below) reach values defined later in this component without re-creating the
	// hook on every change.
	const sendFunctionCallOutputRef = useRef<
		((payload: { callId: string; output: unknown; createResponse?: boolean }) => void) | null
	>(null);
	const handleComposerSubmitRef = useRef<
		((payload: { files: FileUIPart[]; text: string }) => void | Promise<void>) | null
	>(null);
	const prefillTextRef = useRef<string | null>(null);

	const clearPrefillSources = useCallback(() => {
		setPrefillText(null);
		setVoiceTranscript(null);
		composerTextRef.current = "";
		prefillTextRef.current = null;
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
		const activePanel = activeSessionAgentEntry
			? "agent-config"
			: chat.panelState === "preview"
				? "artifact-preview"
				: "chat";

		return createStudioScreenAssistantSnapshot({
			activeAgentDraft: activeSessionAgentEntry?.draftResult ?? null,
			activeRegion: screenAssistantRegion,
			activePanel,
			composer: screenAssistantComposerRef.current,
			pointer: screenAssistantPointerRef.current,
			selectedAgent: {
				id: selectedAgent.id,
				name: selectedAgent.name,
			},
		});
	}, [activeSessionAgentEntry, chat.panelState, screenAssistantRegion, selectedAgent.id, selectedAgent.name]);

	const handleScreenAssistantToolCall = useCallback(
		(
			{ name, args }: StudioScreenAssistantToolCall,
			respond: StudioScreenAssistantToolResponder,
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
					const label =
						typeof args.label === "string" ? args.label : grounded?.label ?? "";
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
					setPrefillText(text);
					respond({ ok: Boolean(text) });
					return;
				}
				case "submit_composer": {
					const text = prefillTextRef.current ?? "";
					if (text.trim()) {
						void handleComposerSubmitRef.current?.({ files: [], text });
					}
					respond({ ok: Boolean(text.trim()) });
					return;
				}
				case "apply_agent_draft_patch": {
					let ok = false;
					let appliedFields: string[] = [];
					if (activeSessionAgentEntry) {
						const patch = prepareStudioAgentDraftPatch({
							currentDraft: activeSessionAgentEntry.draftResult,
							rawPatch: args.patch,
						});
						if (!patch) {
							respond({ appliedFields, ok });
							return;
						}
						const nextEntry = studioAgentRegistry.updateSessionAgentDraft?.(
							activeSessionAgentEntry.profile.id,
							patch,
						);
						ok = Boolean(nextEntry);
						appliedFields = ok ? Object.keys(patch) : [];
					}
					if (ok) {
						streamClickyAssistantText(
							appliedFields.includes("instructions")
								? "Updated the instructions."
								: "Updated the agent draft.",
						);
					}
					respond({ appliedFields, ok });
					return;
				}
				default:
					respond({ ok: false, error: "unknown_tool" });
			}
		},
		[
			activateClicky,
			activeSessionAgentEntry,
			clickyStartPointing,
			getScreenAssistantSnapshot,
			isClickyActive,
			setPrefillText,
			streamClickyAssistantText,
			studioAgentRegistry,
		],
	);

	const handleRealtimeAssistantTextDelta = useCallback(
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
		[ensureRealtimeAssistantMessage, streamClickyAssistantText, updateRealtimeMessage],
	);

	const handleRealtimeAssistantTextCompleted = useCallback(
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
		[clickyAddExchange, ensureRealtimeAssistantMessage, streamClickyAssistantText, updateRealtimeMessage],
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
						content: error instanceof Error ? error.message : "Studio failed to process the delegated request.",
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
		onAssistantTextDelta: handleRealtimeAssistantTextDelta,
		onAssistantTextCompleted: handleRealtimeAssistantTextCompleted,
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
		const testWindow = window as StudioScreenAssistantTestWindow;
		if (!testWindow.__VPK_E2E_SCREEN_ASSISTANT__) {
			return;
		}

		testWindow.__vpkStudioScreenAssistantTest = {
			callTool: async ({ args = {}, name }) =>
				new Promise((resolve) => {
					handleScreenAssistantToolCall(
						{ args, callId: `e2e-${Date.now()}`, name },
						(output) => resolve(output),
					);
				}),
			streamAssistantText: async (chunks) => {
				let text = "";
				for (const chunk of chunks) {
					text += chunk;
					await handleRealtimeAssistantTextDelta({
						delta: chunk,
						displayOnly: true,
						source: "text",
						text,
					});
				}
				return { ok: true };
			},
		};

		return () => {
			if (testWindow.__vpkStudioScreenAssistantTest) {
				delete testWindow.__vpkStudioScreenAssistantTest;
			}
		};
	}, [handleRealtimeAssistantTextDelta, handleScreenAssistantToolCall]);

	const isRealtimeActive = realtime.voiceState !== "idle";

	// --- Rovo voice bridge (connect + inject tool-based system prompt) ---
	useClickyVoice({
		isClickyActive,
		isRealtimeConnected: realtime.isConnected,
		connectRealtime: realtime.connect,
		injectContext: realtime.injectContext,
	});

	const realtimeStatusMessage = resolveStudioRealtimeStatusMessage(realtime);
	const shouldChatVoiceModeBeEnabled = isRealtimeActive;
	const realtimeSessionIdentity = resolveStudioRealtimeSessionIdentity(realtime, chat.activeThreadId, chat.runtimeThreadId);
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
				injectRealtimeContext({
					type: "thread_message",
					content: buildStudioRealtimeResultSummary(lastAssistantMessage),
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

		const summary = buildStudioRealtimeThreadSummary(chat.messages);
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
			const trimmedText = text.trim();
			const isAutomationDiscoveryDemoPrompt = isStudioAutomationDiscoveryDemoPrompt(trimmedText);
			const shouldStartStudioAgentCreation =
				isDefaultAgentHomeStateRef.current &&
				!isRealtimeActive &&
				!isAutomationDiscoveryDemoPrompt;
			const creationTemplate = shouldStartStudioAgentCreation ? (creationTemplateRef.current ?? undefined) : undefined;
			const studioAgentCreationContext = shouldStartStudioAgentCreation ? buildStudioAgentCreationContext(text, creationTemplate) : undefined;
			const contextDescription = mergeContextDescriptions(annotationContextRef.current, studioAgentCreationContext);
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

					// Realtime text stays inside the active voice session so existing
					// voice barge-in behavior is unchanged; Send mode applies to
					// standard Studio text submissions below.
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

			// Deterministic demo agent-editor. Studio build prompts typed while an
			// agent draft is open ("add a trigger to…", "give it Jira tools",
			// "rename it to…") are mapped onto the fake directory catalogs and
			// applied directly — no model call — so the demo is reliable and never
			// returns gibberish. New-agent prompts fall through to the normal
			// model-backed creation flow so the AI can ask clarification questions.
			// Voice/realtime is never intercepted.
			if (!isRealtimeActive && trimmedText) {
				const openAgentEntry = activeSessionAgentEntry;
				const buildPlan = planDeterministicAgentBuild(
					trimmedText,
					openAgentEntry ? openAgentEntry.draftResult : null,
				);
				if (buildPlan.handled) {
					// A build prompt typed from the default home state must run the same
					// landing→studio collapse + creation-thread bookkeeping the normal
					// path below does, since this branch returns before reaching it.
					const fromDefaultHomeState = isDefaultAgentHomeStateRef.current;
					const triggerAutomationNames = buildPlan.triggerAutomationNames ?? [];
					if (fromDefaultHomeState) {
						setIsDefaultHomeSubmitTransition(true);
						markStudioAgentCreationThread(chat.runtimeThreadId);
						markStudioAgentCreationThread(chat.activeThreadId);
					}
					queueTypedScrollAnchor("standard", latestUserMessageIdBeforeSubmit);
					try {
						await appendRealtimeMessage("user", trimmedText, { contextDescription });
						const assistantMessageId = createId("rovo-app-deterministic");
						const triggerTraceStartedAt = new Date();
						if (triggerAutomationNames.length > 0) {
							const triggerTraceStates = ["thinking", "review", "schedule", "delivery", "save", "complete"] as const;
							await appendRealtimeMessage("assistant", "", {
								contextDescription,
								messageId: assistantMessageId,
								parts: buildDeterministicTriggerThinkingParts({
									prompt: trimmedText,
									startedAt: triggerTraceStartedAt,
									state: triggerTraceStates[0],
									triggerAutomationNames,
								}),
							});
							const triggerTraceDelays = [
								DETERMINISTIC_TRIGGER_TRACE_INITIAL_DELAY_MS,
								...DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS,
							] as const;
							for (let index = 0; index < triggerTraceDelays.length; index += 1) {
								await waitForDeterministicTrace(triggerTraceDelays[index]);
								const stagedTraceState = triggerTraceStates[index + 1] ?? "complete";
								await appendRealtimeMessage("assistant", "", {
									contextDescription,
									messageId: assistantMessageId,
									parts: buildDeterministicTriggerThinkingParts({
										...(index === triggerTraceDelays.length - 1
											? {
												...(buildPlan.assistantReply ? { assistantReply: buildPlan.assistantReply } : {}),
												summaryWidgetPart: buildPlan.summaryWidgetPart,
											}
											: {}),
										prompt: trimmedText,
										startedAt: triggerTraceStartedAt,
										state: stagedTraceState,
										triggerAutomationNames,
									}),
								});
							}
						}
						if (buildPlan.mode === "update" && openAgentEntry && buildPlan.patch) {
							handleUpdateAgentDraft(openAgentEntry.profile.id, buildPlan.patch);
						}
						if (triggerAutomationNames.length === 0) {
							// Collapsed change card instead of a plain text reply (fallback to text).
							if (buildPlan.summaryWidgetPart) {
								await appendRealtimeMessage("assistant", "", {
									contextDescription,
									parts: [buildPlan.summaryWidgetPart],
								});
							} else if (buildPlan.assistantReply) {
								await appendRealtimeMessage("assistant", buildPlan.assistantReply, {
									contextDescription,
								});
							}
						}
					} catch (error) {
						if (fromDefaultHomeState) {
							setIsDefaultHomeSubmitTransition(false);
						}
						resetTypedScrollAnchorState();
						throw error;
					}
					clearPrefillSources();
					return;
				}
			}

			const shouldShowOptimisticPrompt =
				(chat.sendMode === "immediate" || !chat.shouldQueueNextSubmission) &&
				(trimmedText || files.length > 0);
			if (shouldShowOptimisticPrompt) {
				if (isDefaultAgentHomeStateRef.current) {
					setIsDefaultHomeSubmitTransition(true);
				}
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
				if (shouldStartStudioAgentCreation) {
					markStudioAgentCreationThread(chat.runtimeThreadId);
					markStudioAgentCreationThread(chat.activeThreadId);
					// Keep the template provenance available for clarification rounds on
					// this creation thread, then clear the pending selection so a later
					// hand-typed brief isn't mislabeled as template-derived.
					if (creationTemplate) {
						if (chat.runtimeThreadId) {
							creationTemplateByThreadRef.current[chat.runtimeThreadId] = creationTemplate;
						}
						if (chat.activeThreadId) {
							creationTemplateByThreadRef.current[chat.activeThreadId] = creationTemplate;
						}
					}
					creationTemplateRef.current = null;
				}
				const submitPrompt = realtimeChat.submitPrompt as (payload: StudioSubmitPromptPayload) => Promise<void>;
				await submitPrompt({
					...promptOptions,
					files,
					text,
					...(shouldStartStudioAgentCreation ? { creationMode: "agent" as const } : {}),
				});
				clearPrefillSources();
			} catch (error) {
				setIsDefaultHomeSubmitTransition(false);
				setOptimisticUserMessage(null);
				resetTypedScrollAnchorState();
				throw error;
			}
		},
		[
			appendRealtimeMessage,
			activeSessionAgentEntry,
			handleUpdateAgentDraft,
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
			markStudioAgentCreationThread,
			chat.activeThreadId,
			chat.sendMode,
			chat.shouldQueueNextSubmission,
			chat.runtimeThreadId,
		],
	);

	// Deterministic agent-edit interception for the ask-Rovo ("Improve your
	// agent?") chat. That composer runs through ChatPanel/RovoChatProvider, not
	// handleComposerSubmit, so it gets its own seam wired to the same shared
	// planner. Returns { handled } so ChatPanel can skip the model and inject a
	// believable reply. While the edit context bar is open, ChatPanel also blocks
	// unmatched prompts from falling through to the normal clarification / plan
	// flow. The test chat does NOT receive this prop, so conversing with the
	// agent stays a real conversation.
	const handleAgentEditInterceptSubmit = useCallback(
		(text: string) => {
			const trimmedText = text.trim();
			const openAgentEntry = activeSessionAgentEntry;
			const buildPlan = planDeterministicAgentBuild(
				trimmedText,
				openAgentEntry ? openAgentEntry.draftResult : null,
			);
			if (!buildPlan.handled) {
				return { handled: false };
			}
			const applyBuildPlan = () => {
				if (buildPlan.mode === "update" && openAgentEntry && buildPlan.patch) {
					handleUpdateAgentDraft(openAgentEntry.profile.id, buildPlan.patch);
				}
			};
			const triggerAutomationNames = buildPlan.triggerAutomationNames ?? [];
			if (triggerAutomationNames.length === 0) {
				applyBuildPlan();
				// Render a collapsed change card instead of a plain "Done — …" reply;
				// fall back to text when there is nothing displayable to summarize.
				return {
					handled: true,
					...(buildPlan.summaryWidgetPart ? { assistantParts: [buildPlan.summaryWidgetPart] } : {}),
					assistantReply: buildPlan.assistantReply,
				};
			}
			return {
				handled: true,
				assistantReply: buildPlan.assistantReply,
				getPendingAssistantParts: ({ startedAt }: { startedAt: Date }) => buildDeterministicTriggerThinkingParts({
					prompt: trimmedText,
					startedAt,
					state: "thinking",
					triggerAutomationNames,
				}),
				assistantPartStages: [
					{
						delayMs: DETERMINISTIC_TRIGGER_TRACE_INITIAL_DELAY_MS,
						getAssistantParts: ({ startedAt }: { startedAt: Date }) => buildDeterministicTriggerThinkingParts({
							prompt: trimmedText,
							startedAt,
							state: "review",
							triggerAutomationNames,
						}),
					},
					{
						delayMs: DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS[0],
						getAssistantParts: ({ startedAt }: { startedAt: Date }) => buildDeterministicTriggerThinkingParts({
							prompt: trimmedText,
							startedAt,
							state: "schedule",
							triggerAutomationNames,
						}),
					},
					{
						delayMs: DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS[1],
						getAssistantParts: ({ startedAt }: { startedAt: Date }) => buildDeterministicTriggerThinkingParts({
							prompt: trimmedText,
							startedAt,
							state: "delivery",
							triggerAutomationNames,
						}),
					},
					{
						delayMs: DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS[2],
						getAssistantParts: ({ startedAt }: { startedAt: Date }) => buildDeterministicTriggerThinkingParts({
							prompt: trimmedText,
							startedAt,
							state: "save",
							triggerAutomationNames,
						}),
					},
					{
						delayMs: DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS[3],
						getAssistantParts: ({ startedAt }: { startedAt: Date }) => buildDeterministicTriggerThinkingParts({
							assistantReply: buildPlan.assistantReply,
							summaryWidgetPart: buildPlan.summaryWidgetPart,
							prompt: trimmedText,
							startedAt,
							state: "complete",
							triggerAutomationNames,
						}),
						onApply: applyBuildPlan,
					},
				],
			};
		},
		[activeSessionAgentEntry, handleUpdateAgentDraft],
	);

	// Keep the screen-assistant tool executor (created with the realtime hook
	// above) pointed at the latest handlers without re-creating the hook.
	useEffect(() => {
		sendFunctionCallOutputRef.current = realtime.sendFunctionCallOutput;
		handleComposerSubmitRef.current = handleComposerSubmit;
		prefillTextRef.current = prefillText;
	}, [handleComposerSubmit, prefillText, realtime.sendFunctionCallOutput]);

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
	useStudioAgentResultRegistration({
		activeThreadId: chat.activeThreadId,
		handledAgentResultKeysRef,
		markStudioAgentCreationThread,
		messages: chat.messages,
		onAgentResultSelect: handleStudioAgentResultSelect,
		runtimeThreadId: chat.runtimeThreadId,
		studioAgentCreationThreadKeysRef,
		studioAgentRegistry,
		unmarkStudioAgentCreationThread,
	});
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
	const isArtifactOpen = chat.panelState !== "closed";

	const artifactMenuItems = useMemo(() => {
		const items = sortRovoAppArtifacts(chat.documents).map((artifact) => ({
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
	}, [chat.documents, chat.messages]);

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
	const hasActiveThreadRun = typeof chat.activeThreadId === "string" && chat.backgroundStreamThreadIds.has(chat.activeThreadId);
	const showHomeState = !chat.isLoadingThread && !isArtifactOpen && !hasActiveThreadRun && visibleMessages.length === 0;
	const shouldShowChatHeader = !shouldShowAgentConfigPane && (visibleMessages.length > 0 || hasActiveThreadRun || chat.isStreaming);
	const isDefaultAgentHomeState = showHomeState && !isCustomAgentSelected && !shouldShowAgentConfigPane;
	useEffect(() => {
		isDefaultAgentHomeStateRef.current = isDefaultAgentHomeState;
	}, [isDefaultAgentHomeState]);
	const shouldReduceMotion = useReducedMotion();
	const shouldReduceStudioLandingMotion = Boolean(shouldReduceMotion);
	const [landingMotionReady, setLandingMotionReady] = useState(false);
	const [bentoDismissed, setBentoDismissed] = useState(false);
	const shouldGateDefaultLandingContent = isDefaultAgentHomeState && !landingMotionReady;
	const shouldShowDefaultLandingContent = !shouldGateDefaultLandingContent;
	const shouldShowStudioAgentsSection = isDefaultAgentHomeState && shouldShowDefaultLandingContent;
	const shouldShowHomeStarterBento = isDefaultAgentHomeState && shouldShowDefaultLandingContent && !bentoDismissed;
	const shouldShowComposerDock = shouldShowDefaultLandingContent;
	const shouldShowTimelineNavigator = !showHomeState && !isArtifactOpen && timelineItems.length > 1;
	const composerPreviewState = resolveRovoAppComposerPlaceholder({
		defaultPlaceholder: DEFAULT_COMPOSER_PLACEHOLDER,
		previewPrompt,
		showHomeState,
	});
	const studioLandingMotionInitial = shouldReduceStudioLandingMotion
		? STUDIO_LANDING_REDUCED_CONTENT_INITIAL
		: STUDIO_LANDING_CONTENT_INITIAL;
	const studioLandingMotionVisible = shouldReduceStudioLandingMotion
		? STUDIO_LANDING_REDUCED_CONTENT_VISIBLE
		: STUDIO_LANDING_CONTENT_VISIBLE;
	const studioLandingMotionTransition = shouldReduceStudioLandingMotion
		? STUDIO_LANDING_REDUCED_TRANSITION
		: STUDIO_LANDING_ENTER_TRANSITION;
	useEffect(() => {
		screenAssistantComposerRef.current = {
			hasPrefill: Boolean(voiceTranscript ?? prefillText),
			placeholder: composerPreviewState.placeholder,
		};
	}, [composerPreviewState.placeholder, prefillText, voiceTranscript]);

	useEffect(() => {
		if (landingMotionReady || shellSize.width <= 0 || shellSize.height <= 0) {
			return;
		}

		const frame = requestAnimationFrame(() => setLandingMotionReady(true));
		return () => cancelAnimationFrame(frame);
	}, [landingMotionReady, shellSize.height, shellSize.width]);

	useEffect(() => {
		if (showHomeState || !isDefaultHomeSubmitTransition) {
			return;
		}

		const frame = requestAnimationFrame(() => {
			setIsDefaultHomeSubmitTransition(false);
		});
		return () => cancelAnimationFrame(frame);
	}, [isDefaultHomeSubmitTransition, showHomeState]);

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
	// Onboarding tour: anchors steps to the right "Ask Rovo" panel (result card +
	// composer) and the center config panel (chat starters + Activate). shellRef
	// wraps the center <main> and excludes the right panel, so it scopes those
	// center selectors cleanly.
	const askRovoPanelRef = useRef<HTMLDivElement | null>(null);
	const agentOnboardingTour = useAgentOnboardingTour({
		rightPanelRef: askRovoPanelRef,
		centerRef: shellRef,
	});
	const {
		back: backAgentOnboardingTourStep,
		dismiss: dismissAgentOnboardingTour,
		isLast: isAgentOnboardingTourLastStep,
		next: nextAgentOnboardingTourStep,
		start: startAgentOnboardingTour,
	} = agentOnboardingTour;
	const [liveChatAnchorElement, setLiveChatAnchorElement] = useState<HTMLElement | null>(null);
	const [agentOnboardingTourFinishRequestKey, setAgentOnboardingTourFinishRequestKey] = useState(0);
	const [agentOnboardingLiveVoiceRequestKey, setAgentOnboardingLiveVoiceRequestKey] = useState(0);
	const [agentOnboardingGuideMessages, setAgentOnboardingGuideMessages] = useState<ReadonlyArray<RovoUIMessage>>([]);
	const activeAgentOnboardingGuideAgentIdRef = useRef<string | null>(null);
	useEffect(() => {
		if (
			process.env.NODE_ENV === "production" ||
			hasStartedAgentOnboardingTourPreviewRef.current ||
			hasQueuedAgentOnboardingTourPreviewRef.current ||
			!shouldShowAgentConfigPane ||
			!activeSessionAgentEntry
		) {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		if (params.get(STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_PARAM) !== STUDIO_AGENT_ONBOARDING_TOUR_PREVIEW_VALUE) {
			return;
		}

		hasQueuedAgentOnboardingTourPreviewRef.current = true;
		setActiveAgentConfigView("test");
		openAgentCreationAskRovoChat();
		let frame = 0;
		let rafId = 0;
		const startPreviewTour = () => {
			frame += 1;
			if (frame < 4) {
				rafId = requestAnimationFrame(startPreviewTour);
				return;
			}

			hasStartedAgentOnboardingTourPreviewRef.current = true;
			hasQueuedAgentOnboardingTourPreviewRef.current = false;
			startAgentOnboardingTour();
		};
		rafId = requestAnimationFrame(startPreviewTour);
		return () => {
			cancelAnimationFrame(rafId);
			if (!hasStartedAgentOnboardingTourPreviewRef.current) {
				hasQueuedAgentOnboardingTourPreviewRef.current = false;
			}
		};
	}, [activeSessionAgentEntry, openAgentCreationAskRovoChat, shouldShowAgentConfigPane, startAgentOnboardingTour]);
	useEffect(() => {
		if (agentCreationTourSignal === 0) {
			return;
		}
		// Defer a frame so the freshly opened right panel, result card, and test
		// view are mounted before the tour resolves its first anchor.
		const frame = requestAnimationFrame(() => startAgentOnboardingTour());
		return () => cancelAnimationFrame(frame);
	}, [agentCreationTourSignal, startAgentOnboardingTour]);
	useEffect(() => {
		if (!agentOnboardingTour.isActive) {
			setLiveChatAnchorElement(null);
			return;
		}

		let frame = 0;
		let rafId = 0;
		let cancelled = false;
		const resolveLiveChatAnchor = () => {
			if (cancelled) {
				return;
			}

			const getCandidateRoot = (root: typeof STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES[number]["root"]) => {
				if (root === "right") {
					return askRovoPanelRef.current;
				}
				return document;
			};
			let element: HTMLElement | null = null;
			for (const candidate of STUDIO_LIVE_CHAT_ANCHOR_CANDIDATES) {
				const root = getCandidateRoot(candidate.root);
				if (!root) {
					continue;
				}
				for (const selector of candidate.selectors) {
					const match = root.querySelector<HTMLElement>(selector);
					if (match && match.getClientRects().length > 0) {
						element = match;
						break;
					}
				}
				if (element) {
					break;
				}
			}
			if (element || frame >= STUDIO_LIVE_CHAT_ANCHOR_RESOLVE_FRAMES) {
				setLiveChatAnchorElement(element);
				if (!element) {
					dismissAgentOnboardingTour();
				}
				return;
			}

			frame += 1;
			rafId = requestAnimationFrame(resolveLiveChatAnchor);
		};

		rafId = requestAnimationFrame(resolveLiveChatAnchor);
		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
		};
	}, [agentOnboardingTour.isActive, agentOnboardingTour.stepIndex, activeAgentConfigView, shouldShowAgentConfigPane, dismissAgentOnboardingTour]);
	const handleAgentOnboardingTourNext = useCallback(() => {
		if (isAgentOnboardingTourLastStep) {
			setAgentOnboardingTourFinishRequestKey((currentKey) => currentKey + 1);
			return;
		}

		nextAgentOnboardingTourStep();
	}, [isAgentOnboardingTourLastStep, nextAgentOnboardingTourStep]);
	useEffect(() => {
		if (!agentOnboardingTour.isActive) {
			activeAgentOnboardingGuideAgentIdRef.current = null;
			setAgentOnboardingGuideMessages([]);
			setAgentOnboardingLiveVoiceRequestKey(0);
			return;
		}

		const agentId = activeSessionAgentEntry?.profile.id ?? "generated-agent";
		if (activeAgentOnboardingGuideAgentIdRef.current === agentId) {
			return;
		}

		activeAgentOnboardingGuideAgentIdRef.current = agentId;
		setAgentOnboardingLiveVoiceRequestKey((currentKey) => currentKey + 1);
		setAgentOnboardingGuideMessages([
			createStudioAgentOnboardingGuideMessage({
				role: "assistant",
				text: getStudioAgentOnboardingGuideGreeting(activeSessionAgentEntry?.profile.name ?? null),
			}),
		]);
	}, [activeSessionAgentEntry?.profile.id, activeSessionAgentEntry?.profile.name, agentOnboardingTour.isActive]);
	const appendAgentOnboardingGuideExchange = useCallback((userText: string, assistantText: string) => {
		const createdAt = new Date().toISOString();
		setAgentOnboardingGuideMessages((messages) => [
			...messages,
			createStudioAgentOnboardingGuideMessage({
				createdAt,
				role: "user",
				text: userText,
			}),
			createStudioAgentOnboardingGuideMessage({
				createdAt,
				role: "assistant",
				text: assistantText,
			}),
		]);
	}, []);
	const handleAgentOnboardingGuideSubmit = useCallback(
		(text: string) => {
			const command = resolveStudioAgentOnboardingGuideCommand(text);
			const respond = (assistantText: string) => {
				appendAgentOnboardingGuideExchange(text, assistantText);
				return {
					handled: true,
					voiceText: assistantText,
				};
			};
			switch (command) {
				case "next": {
					if (agentOnboardingTour.isLast) {
						setAgentOnboardingTourFinishRequestKey((currentKey) => currentKey + 1);
						return respond("Done - I will move back to the live chat button. You can find me here any time.");
					}

					nextAgentOnboardingTourStep();
					const nextStepIndex = Math.min(agentOnboardingTour.stepIndex + 1, agentOnboardingTour.total - 1);
					return respond(getStudioAgentOnboardingGuideStepNarration(getStudioAgentOnboardingGuideStepByIndex(nextStepIndex)));
				}
				case "back": {
					if (agentOnboardingTour.isFirst) {
						return respond(getStudioAgentOnboardingGuideStepNarration(getStudioAgentOnboardingGuideStepByIndex(0)));
					}

					backAgentOnboardingTourStep();
					const previousStepIndex = Math.max(agentOnboardingTour.stepIndex - 1, 0);
					return respond(getStudioAgentOnboardingGuideStepNarration(getStudioAgentOnboardingGuideStepByIndex(previousStepIndex)));
				}
				case "done": {
					setAgentOnboardingTourFinishRequestKey((currentKey) => currentKey + 1);
					return respond("Done - I will tuck back into live chat. If you need help, you can always find me here.");
				}
				default:
					return respond(`Try ${STUDIO_AGENT_ONBOARDING_GUIDE_SUPPORTED_COMMANDS} to control the tour.`);
			}
		},
		[
			agentOnboardingTour.isFirst,
			agentOnboardingTour.isLast,
			agentOnboardingTour.stepIndex,
			agentOnboardingTour.total,
			appendAgentOnboardingGuideExchange,
			backAgentOnboardingTourStep,
			nextAgentOnboardingTourStep,
		],
	);
	const agentOnboardingLocalConversation = useMemo<ChatPanelLocalConversation | null>(() => {
		return createStudioAgentOnboardingLocalConversation({
			initialAgentName: activeSessionAgentEntry?.profile.name ?? null,
			initialVoiceKey: activeSessionAgentEntry?.profile.id ?? null,
			isActive: agentOnboardingTour.isActive,
			messages: agentOnboardingGuideMessages,
			onSubmit: handleAgentOnboardingGuideSubmit,
			resolveInitialVoiceText: getStudioAgentOnboardingGuideGreeting,
		});
	}, [activeSessionAgentEntry?.profile.id, activeSessionAgentEntry?.profile.name, agentOnboardingGuideMessages, agentOnboardingTour.isActive, handleAgentOnboardingGuideSubmit]);
	const composerDockRef = useRef<HTMLDivElement | null>(null);
	const defaultHomeTopSpacerRef = useRef<HTMLDivElement | null>(null);
	const artifactCardOriginRef = useRef<DOMRect | null>(null);
	const artifactPreviewOriginRef = useLazyRef<Map<string, DOMRect>>(() => new Map());
	const [defaultHomeTopSpacerMeasurement, setDefaultHomeTopSpacerMeasurement] = useState<{ key: string; height: number } | null>(null);
	const [artifactOrigin, setArtifactOrigin] = useState({
		left: 0,
		top: 0,
		width: 320,
		height: 96,
	});
	const artifactSplitChatPaneWidthRef = useRef<number | null>(null);
	const artifactLayout = getRovoAppShellLayout(shellSize.width);
	const isAgentConfigOverlayActive = shouldShowAgentConfigPane && artifactLayout.mode !== "split";
	const shouldSplitArtifactPane = !shouldShowAgentConfigPane && isArtifactOpen && artifactLayout.mode === "split";
	const splitChatPaneMaxSize = shouldSplitArtifactPane || (shouldShowAgentConfigPane && !isAgentConfigOverlayActive)
		? Math.min(ROVO_APP_MAX_CHAT_PANE_WIDTH, Math.max(ROVO_APP_MIN_CHAT_PANE_WIDTH, shellSize.width - ROVO_APP_MIN_ARTIFACT_PANE_WIDTH))
		: ROVO_APP_MAX_CHAT_PANE_WIDTH;
	const splitChatPaneDefaultSize = shouldSplitArtifactPane || (shouldShowAgentConfigPane && !isAgentConfigOverlayActive)
		? clamp(artifactSplitChatPaneWidthRef.current ?? artifactLayout.chatPaneWidth ?? ROVO_APP_MIN_CHAT_PANE_WIDTH, ROVO_APP_MIN_CHAT_PANE_WIDTH, splitChatPaneMaxSize)
		: ROVO_APP_MIN_CHAT_PANE_WIDTH;
	const splitArtifactPaneDefaultSize = shouldSplitArtifactPane || (shouldShowAgentConfigPane && !isAgentConfigOverlayActive)
		? Math.max(ROVO_APP_MIN_ARTIFACT_PANE_WIDTH, shellSize.width - splitChatPaneDefaultSize)
		: ROVO_APP_MIN_ARTIFACT_PANE_WIDTH;
	const defaultHomeTopSpacerMeasurementKey = isDefaultAgentHomeState && landingMotionReady ? `${shellSize.width}:${shellSize.height}` : null;
	const defaultHomeTopSpacerHeight = defaultHomeTopSpacerMeasurement?.key === defaultHomeTopSpacerMeasurementKey
		? defaultHomeTopSpacerMeasurement.height
		: null;

	useLayoutEffect(() => {
		if (!landingMotionReady || !defaultHomeTopSpacerMeasurementKey || !isDefaultAgentHomeState || shouldSplitArtifactPane || shouldShowAgentConfigPane || defaultHomeTopSpacerHeight !== null) {
			return;
		}

		const spacerElement = defaultHomeTopSpacerRef.current;
		if (!spacerElement) {
			return;
		}

		const spacerHeight = Math.round(spacerElement.getBoundingClientRect().height);
		if (spacerHeight > 0) {
			setDefaultHomeTopSpacerMeasurement({
				key: defaultHomeTopSpacerMeasurementKey,
				height: spacerHeight,
			});
		}
	}, [defaultHomeTopSpacerHeight, defaultHomeTopSpacerMeasurementKey, isDefaultAgentHomeState, landingMotionReady, shouldShowAgentConfigPane, shouldSplitArtifactPane]);

	useEffect(() => {
		if (!isRealtimeActive) {
			injectedRealtimeArtifactContextKeyRef.current = null;
			return;
		}

		const artifactContext = buildStudioRealtimeArtifactContextSummary({
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

	const agentConfigTestPanel = activeSessionAgentEntry ? (
		<AgentTestPanel entry={activeSessionAgentEntry} />
	) : null;

	// Bridges the agent config's encapsulated automation dialog to the sibling
	// Ask Rovo chat: the config panel registers its opener here, and the
	// agent-edit-summary card's "Open" button invokes it via onOpenAgentEditSummary.
	const automationDialogOpenerRef = useRef<(() => void) | null>(null);

	const agentConfigPane = activeSessionAgentEntry ? (
		<RovoAppAgentConfigPanel
			activeView={activeAgentConfigView}
			entry={activeSessionAgentEntry}
			onCommitPublishReady={handleCommitAgentPublishReady}
			onPublish={handlePublishAgent}
			onTest={handleTestAgent}
			onViewChange={handleAgentConfigViewChange}
			testPanel={agentConfigTestPanel}
			chatContextBar={agentEditContextBar}
			chatGreeting={agentEditGreeting}
			chatSendPromptOptions={agentEditSendPromptOptions}
			onChatInterceptSubmit={handleAgentEditInterceptSubmit}
			onUpdateDraft={handleUpdateAgentDraft}
			onStartWithTemplate={handleStartAgentWithTemplate}
			registerAutomationDialogOpener={(opener) => {
				automationDialogOpenerRef.current = opener;
			}}
		/>
	) : null;

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
					compact={isArtifactOpen || shouldShowAgentConfigPane}
					extraHorizontalPaddingWhenCompact
					isMaxMode={chat.isPlanMode}
					documents={chat.documents}
					editingMessageId={chat.editingMessageId}
					isStreaming={chat.isStreaming}
					messages={displayMessages}
					onBuildPlan={handleBuildPlan}
					onEditMessage={chat.editMessage}
					onOpenArtifactFromCard={handleOpenArtifactFromCard}
					onOpenBrowserPreview={handleOpenBrowserPreview}
					onOpenPlanPreview={handleOpenPlanPreview}
					onAgentResultSelect={handleStudioAgentResultSelect}
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
					showEmptyState={showHomeState && shouldShowDefaultLandingContent}
					shouldSuppressLatestAssistantSuggestions={chat.shouldSuppressLatestAssistantSuggestions}
					streamingArtifact={chat.streamingArtifact}
					streamingArtifactMessageId={chat.streamingArtifactMessageId}
					votes={chat.votes}
				/>
			</ViewTransition>

			{shouldShowAgentConfigPane && showHomeState ? <div aria-hidden className="flex-1 shrink" /> : null}

			<RovoAppHomeStarterBento
				instantExit={isDefaultHomeSubmitTransition}
				isVisible={shouldShowHomeStarterBento}
				onBrowseTemplates={handleBrowseAgentsDirectory}
				onDismiss={() => setBentoDismissed(true)}
				onPreviewEnd={handleGalleryPreviewEnd}
				onPreviewStart={handleGalleryPreviewStart}
				onSelect={handleGallerySelect}
				reduceMotion={shouldReduceStudioLandingMotion}
				templatesDialogOpen={agentTemplatesDialogOpen || isSidebarAgentBrowserOpen}
			/>

			{shouldShowComposerDock ? (
				<div
					ref={composerDockRef}
					className={cn(
						"relative z-10 mx-auto flex min-w-0 w-full flex-col gap-3 overflow-visible",
						!showHomeState && "sticky bottom-0 bg-background/90 backdrop-blur",
						isArtifactOpen || shouldShowAgentConfigPane ? "max-w-none px-3" : "max-w-[800px]",
						// The question/approval card carries a soft 50px-blur shadow that the
						// home-state scrollport (chatPaneContainer overflow-y-auto) clips on the
						// left/right/bottom. When a card is shown, reserve room for that blur with
						// inner padding and bump max-w by the same amount so the card content width
						// is unchanged. Padding is scoped to the card case so the regular sticky
						// composer keeps its flush bottom alignment.
						isShowingDockCard && !(isArtifactOpen || shouldShowAgentConfigPane) && "max-w-[848px] px-6 pb-6",
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
									questionCard={renderedQuestionCard ?? activeQuestionCard}
									isSubmitting={submittingQuestionCardKey === (activeQuestionCardKey ?? `${activeQuestionCard.sessionId}:${activeQuestionCard.round}`)}
									onSubmit={(answers) => {
										void handleClarificationSubmit(answers);
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
								animate={showHomeState ? studioLandingMotionVisible : { opacity: 1, transform: "translateY(0px)" }}
								initial={showHomeState ? studioLandingMotionInitial : false}
								transition={showHomeState ? studioLandingMotionTransition : { duration: 0 }}
								style={{ willChange: "transform, opacity" }}
							>
								<RovoAppComposer
									key={chat.runtimeThreadId}
									artifactTitle={workspaceDocument?.title ?? null}
									autoFocus={!embedded}
									backgroundArtifactLabel={chat.backgroundArtifactLabel}
									composerStatus={chat.composerStatus}
									compact={isArtifactOpen || shouldShowAgentConfigPane}
									errorMessage={chat.inputError}
									dictationState={dictationState}
									dictationTranscriptPreview={dictationTranscriptPreview}
									focusRequestKey={composerFocusRequestKey}
									fillWidth={!showHomeState && !(isArtifactOpen || shouldShowAgentConfigPane)}
									galleryExpanded={galleryExpanded}
									isPlanMode={chat.isPlanMode}
									micStream={realtime.micStream}
									onDismissArtifactContext={handleCloseArtifactPane}
									onDismissPlanExecutionTracker={chat.dismissPlanExecutionTracker}
									onBrowseTemplates={
										isDefaultAgentHomeState && bentoDismissed ? () => setBentoDismissed(false) : undefined
									}
									onStartFromScratch={isDefaultAgentHomeState ? handleStartAgentFromScratch : undefined}
									onStop={handleStop}
									onRemoveQueuedPrompt={chat.removeQueuedPrompt}
									onSendQueuedPromptNow={chat.sendQueuedPromptNow}
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
									showBackgroundStop={chat.hasBackgroundDelegation}
								/>
							</motion.div>
							{!showHomeState ? <Footer className="relative z-10" /> : null}
						</>
					)}
					</div>
				</div>
			) : null}
		</>
	);

	const chatPaneContainer = (
		<div
			className={cn(
				"overscroll-behavior-contain relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col touch-pan-y bg-background",
				// Home landing stacks bento + composer + agents table + footer in a
				// centered (flex-1 spacers) column. Without a scrollport the spacers
				// can't collapse far enough on short viewports and the bottom (the
				// agents table) gets clipped with no way to reach it. Chat state is
				// excluded: RovoAppMessages owns its own scroll there.
				showHomeState && "overflow-y-auto",
			)}
		>
			{shouldShowAgentConfigPane && activeSessionAgentEntry ? (
				<div
					className="absolute left-3 top-3 z-20 hidden items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs md:flex"
					data-testid="chat-agent-testing-chrome"
				>
					<Badge
						variant={
							activeSessionAgentEntry.publishedVersion > 0 || activeSessionAgentEntry.publishedResult
								? "success"
								: "information"
						}
					>
						{activeSessionAgentEntry.publishedVersion > 0 || activeSessionAgentEntry.publishedResult
							? "Published"
							: "Testing"}
					</Badge>
					<span className="max-w-[180px] truncate text-text-subtle">
						{activeSessionAgentEntry.profile.name}
					</span>
				</div>
			) : null}
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
			{showHomeState && !shouldSplitArtifactPane && !shouldShowAgentConfigPane ? (
				<div
					ref={isDefaultAgentHomeState ? defaultHomeTopSpacerRef : undefined}
					aria-hidden
					className={cn(
						"min-h-3",
						isDefaultAgentHomeState && defaultHomeTopSpacerHeight !== null ? "shrink-0" : "flex-1 shrink",
					)}
					style={isDefaultAgentHomeState && defaultHomeTopSpacerHeight !== null ? { flexBasis: defaultHomeTopSpacerHeight } : undefined}
				/>
			) : null}
			{chatPane}
			{shouldShowStudioAgentsSection ? (
				<motion.div
					animate={studioLandingMotionVisible}
					initial={studioLandingMotionInitial}
					transition={studioLandingMotionTransition}
					style={{ willChange: "transform, opacity" }}
				>
					<StudioAgentsSection
						directoryAgents={ROVO_DIRECTORY_AGENT_PROFILES}
						entries={studioAgentRegistry.sessionAgentEntries}
						onBrowseTemplates={() => handleBrowseAgentTemplates()}
						onCreateAgent={handleFocusStudioComposer}
						onDeleteAgent={handleDeleteStudioAgent}
						onEditAgent={handleStudioSidebarAgentSelect}
						onSelectDirectoryAgent={handleSidebarBrowseAgentSelect}
					/>
				</motion.div>
			) : null}
			{showHomeState && !shouldSplitArtifactPane ? (
				<>
					{!shouldShowAgentConfigPane ? <div className="min-h-0 flex-1 shrink" /> : null}
					<Footer className="shrink-0" />
				</>
			) : null}
		</div>
	);

	return (
		<SidebarProvider className={cn(embedded ? "h-full" : "h-svh", "overflow-hidden")} defaultOpen={!embedded} onOpenChange={chat.setSidebarOpen} open={chat.sidebarOpen} style={rovoAppSidebarStyle}>
			<RovoAppSidebar
				activeThreadId={chat.activeThreadId}
				agentCreationThreads={studioAgentCreationThreads}
				generatingAgents={studioAutomationGeneratingAgents}
				hoverOpen={isHoverOpen}
				isAgentsHomeActive={isDefaultAgentHomeState}
				isResizing={sidebarResize.isResizing}
				onCancelThreadRun={async (threadId) => {
					await chat.cancelThreadRun(threadId);
				}}
				onCreateAgent={handleStartAgentFromScratch}
				onDeleteAgent={handleDeleteStudioAgent}
				onDeleteThread={async (threadId) => {
					// Clear any in-progress agent-creation tracking first. Otherwise the
					// thread lingers in `studioAgentCreationThreadIds` after `chat.threads`
					// drops it, and the memo re-renders it as a ghost "Agent creation" row.
					unmarkStudioAgentCreationThread(threadId);
					startTransition(() => {
						void chat.deleteThread(threadId);
					});
				}}
				onNewChat={handleReturnToAgentsHome}
				onSelectAgent={handleStudioSidebarAgentSelect}
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
				onViewAllAgents={handleReturnToAgentsHome}
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
				selectedAgentId={activeSessionAgentEntry?.profile.id ?? studioAgentRegistry.selectedAgentId}
				sessionAgentEntries={studioAgentRegistry.sessionAgentEntries}
				threads={chat.threads}
				threadsLoaded={chat.threadsLoaded}
				topOffset={!embedded}
			/>
			<AgentTemplatesDialog
				key={agentTemplatesInitialCategory}
				open={agentTemplatesDialogOpen}
				onOpenChange={setAgentTemplatesDialogOpen}
				agents={DEMO_AGENT_TEMPLATES}
				initialCategoryId={agentTemplatesInitialCategory}
				onSelectAgent={handleTemplateAgentSelect}
				sessionAgents={DEMO_AGENT_TEMPLATES_SESSION}
			/>
			{/* Opened by the home bento's "Browse all" pill, landing straight on the
			    category the user was exploring (e.g. "Planning"). The `key` remounts
			    AgentBrowser so its `initialTemplateCategory` re-seeds per category. */}
			<AgentsDirectoryDialog
				key={`agent-directory-${sidebarAgentBrowserInitialCategory}`}
				open={isSidebarAgentBrowserOpen}
				onOpenChange={setIsSidebarAgentBrowserOpen}
				agents={ROVO_DIRECTORY_AGENT_PROFILES}
				onSelectAgent={handleSidebarBrowseAgentSelect}
				onSelectTemplateAgent={handleTemplateAgentSelect}
				onBuildTemplateAgent={handleBuildTemplateAgent}
				onOpenBuiltTemplateAgentConfig={handleOpenBuiltTemplateAgentConfig}
				sessionAgents={studioAgentRegistry.sessionAgentEntries.map((entry) => entry.profile)}
				initialTemplateCategory={sidebarAgentBrowserInitialCategory}
				variant="experimental"
			/>

			{!embedded ? (
				<div
					className={cn(
						"fixed top-0 left-0 z-50 flex items-center px-3",
						hasMountedChrome && !sidebarResize.isResizing && "transition-[width,border-color] duration-medium ease-in-out",
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
						product="studio"
						windowWidth={nav.windowWidth}
						isVisible={chat.sidebarOpen}
						isAppSwitcherOpen={nav.isAppSwitcherOpen}
						isSidebarResizing={sidebarResize.isResizing}
						hideAppSwitcher
						separatorLineOffsetPx={sidebarResize.sidebarWidth - TOP_NAV_PADDING_PX}
						onToggleSidebar={() => chat.setSidebarOpen(!chat.sidebarOpen)}
						onToggleAppSwitcher={nav.handleToggleAppSwitcher}
						onCloseAppSwitcher={nav.handleCloseAppSwitcher}
						onNavigate={(path) => nav.handleNavigate(path === "/" ? "/studio" : path)}
						onHoverEnter={handleSidebarHoverEnter}
						onHoverLeave={handleSidebarHoverLeave}
					/>
				</div>
			) : null}

			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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
						<RightNavigation
							product="studio"
							windowWidth={nav.windowWidth}
							forceShowRovoAction={shouldShowAgentConfigPane}
							isChatOpen={nav.isSidebarChatOpen}
							onToggleChat={handleToggleAskRovoChat}
							settingsMenuItems={studioSettingsMenuItems}
						/>
					</div>
				) : null}
				{shouldShowChatHeader ? (
					<RovoAppHeader
						artifactMenuItems={artifactMenuItems}
						isArtifactOpen={isArtifactOpen}
						onNewChat={() => {
							setOptimisticUserMessage(null);
							void chat.openNewChat();
						}}
						onOpenDocument={(documentId) => void chat.openDocument(documentId)}
						onSendModeChange={chat.setSendMode}
						sendMode={chat.sendMode}
					/>
				) : null}
				<main
					ref={shellRef}
					className={cn(
						"relative flex min-h-0 min-w-0 flex-1 bg-background text-foreground",
						!shouldShowAgentConfigPane && "px-3",
					)}
					style={{
						marginRight: isStudioAskRovoChatActive ? `${askRovoChatPanelWidth}px` : "0px",
						transition: askRovoChatResize.isResizing
							? undefined
							: "margin-right var(--duration-medium) var(--ease-in-out)",
					}}
				>
					<RovoAppShellPaneLayout
						artifactOrigin={artifactOrigin}
						artifactPane={artifactPane}
						artifactPanelId={ROVO_APP_SPLIT_ARTIFACT_PANEL_ID}
						chatPane={chatPaneContainer}
						chatPanelId={ROVO_APP_SPLIT_CHAT_PANEL_ID}
						minArtifactPaneWidth={ROVO_APP_MIN_ARTIFACT_PANE_WIDTH}
						minChatPaneWidth={ROVO_APP_MIN_CHAT_PANE_WIDTH}
						onArtifactSplitLayoutChanged={handleArtifactSplitLayoutChanged}
						priorityPane={shouldShowAgentConfigPane ? agentConfigPane : undefined}
						shouldSplitArtifactPane={shouldSplitArtifactPane}
						shellSize={shellSize}
						splitArtifactPaneDefaultSize={splitArtifactPaneDefaultSize}
						splitChatPaneDefaultSize={splitChatPaneDefaultSize}
						splitChatPaneMaxSize={splitChatPaneMaxSize}
					/>
				</main>
				{!embedded && shouldShowAgentConfigPane ? (
					<div
						ref={askRovoPanelRef}
						data-shell-chrome=""
						aria-hidden={!isStudioAskRovoChatActive}
						{...(!isStudioAskRovoChatActive ? { inert: true } : {})}
						style={{
							position: "absolute",
							top: TOP_NAV_HEADER_HEIGHT_PX,
							right: 0,
							bottom: 0,
							width: `${askRovoChatPanelWidth}px`,
							pointerEvents: isStudioAskRovoChatActive ? "auto" : "none",
							transform: isStudioAskRovoChatActive
								? "translateX(0)"
								: `translateX(${askRovoChatPanelWidth}px)`,
							transition: askRovoChatResize.isResizing
								? undefined
								: "transform var(--duration-medium) var(--ease-in-out)",
							willChange: "transform",
							zIndex: 90,
						}}
					>
						<ChatPanel
							onClose={nav.toggleChat}
							abortOnUnmount={false}
							cards={agentEditCards}
							chatContextBar={agentEditContextBar}
							greeting={agentEditGreeting}
							sendPromptOptions={agentEditSendPromptOptions}
							renderWidget={renderStudioAskRovoWidget}
							getWidgetPosition={getStudioAskRovoWidgetPosition}
							onInterceptSubmit={handleAgentEditInterceptSubmit}
							onOpenAgentEditSummary={() => automationDialogOpenerRef.current?.()}
							localConversation={agentOnboardingLocalConversation}
							startRealtimeVoiceRequestKey={agentOnboardingLiveVoiceRequestKey}
							hideComposerSourceAndModelControls={Boolean(agentEditContextBar)}
							// No left border here: the SidebarResizeHandle below paints the divider.
							// Keeping the panel's own `border-l` too would stack two translucent
							// `color.border` lines into a darker double-edge.
							containerStyle={{ borderRadius: 0, borderWidth: 0 }}
						/>
						<SidebarResizeHandle
							side="left"
							data-active={askRovoChatResize.isResizing ? "" : undefined}
							onDoubleClick={askRovoChatResize.onResizeHandleDoubleClick}
							onPointerDown={askRovoChatResize.onResizeHandlePointerDown}
							onPointerEnter={askRovoChatResize.onResizeHandlePointerEnter}
							onPointerLeave={askRovoChatResize.onResizeHandlePointerLeave}
						/>
					</div>
				) : null}
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
			{agentOnboardingTour.step ? (
				<RovoCursorOnboardingTour
					isActive={agentOnboardingTour.isActive && Boolean(agentOnboardingTour.anchorElement) && Boolean(liveChatAnchorElement)}
					step={agentOnboardingTour.step}
					stepIndex={agentOnboardingTour.stepIndex}
					total={agentOnboardingTour.total}
					isFirst={agentOnboardingTour.isFirst}
					isLast={agentOnboardingTour.isLast}
					anchorElement={agentOnboardingTour.anchorElement}
					liveChatAnchorElement={liveChatAnchorElement}
					finishRequestKey={agentOnboardingTourFinishRequestKey}
					onBack={backAgentOnboardingTourStep}
					onNext={handleAgentOnboardingTourNext}
					onDismiss={dismissAgentOnboardingTour}
				/>
			) : null}
		</SidebarProvider>
	);
}
