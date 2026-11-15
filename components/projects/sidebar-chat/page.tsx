"use client";

// oxlint-disable react-doctor/exhaustive-deps -- The abort and markdown-preload effects intentionally key off narrow lifecycle inputs rather than every value they read.
// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for conversation and composer bodies.

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_REASONING_OPTION_ID } from "@/components/projects/shared/components/chat-configuration/customize-menu-data";
import { useRovoChat } from "@/app/contexts";
import { preloadMessageMarkdownForReply } from "@/components/projects/rovo-core/hooks/use-preload-message-markdown";
import { isRenderableRovoUIMessage } from "@/lib/rovo-ui-messages";
import type { ComposerDirectoryAutocompleteController } from "@/components/ui-custom/rich-text-editor";
import type { DirectoryAutocompleteState } from "@/lib/directory-autocomplete";
import { isRovoAgentProfile } from "@/app/data/directory/agents";
import ChatHeader from "./components/chat-header";
import { ChatHistoryDrawer, ControlledChatHistoryDrawer } from "./components/chat-history-drawer";
import { ChatPanelComposerArea } from "./components/chat-panel-composer-area";
import { ChatPanelConversation } from "./components/chat-panel-conversation";
import { CustomAgentTabs } from "./components/custom-agent-tabs";
import { ClickyOverlay } from "@/components/projects/rovo-core/components/clicky/clicky-overlay";
import { ScreenAssistantRegionOverlay } from "@/components/screen-assistant/screen-assistant-region-overlay";
import { chatStyles } from "./data/styles";
import { DEFAULT_AGENT_VERSION_OPTIONS } from "./data/chat-panel-defaults";
import { cn } from "@/lib/utils";
import { useChatSubmit } from "./hooks/use-chat-submit";
import { useScrollAnchor } from "./hooks/use-scroll-anchor";
import { useThinkingStatus } from "./hooks/use-thinking-status";
import { useAgentVersionSelection } from "./hooks/use-agent-version-selection";
import { useArtifactDialogFloatingPin, useArtifactResultReporting } from "./hooks/use-chat-panel-artifacts";
import { useChatPanelClicky } from "./hooks/use-chat-panel-clicky";
import { useChatPanelDecisions } from "./hooks/use-chat-panel-decisions";
import { useChatPanelPromptActions } from "./hooks/use-chat-panel-prompt-actions";
import { useChatPanelRealtime } from "./hooks/use-chat-panel-realtime";
import { useChatPanelScreenAssistant } from "./hooks/use-chat-panel-screen-assistant";
import { useChatPanelWidth } from "./hooks/use-chat-panel-width";
import { useComposerPromptBridge } from "./hooks/use-composer-prompt-bridge";
import { useContextBarOpenState } from "./hooks/use-context-bar-open-state";
import { useLocalConversationVoice } from "./hooks/use-local-conversation-voice";
import { appendOptimisticCompactUserMessage } from "./lib/optimistic-user-message";
import { isCustomAgentTabsProfile, resolveChatPanelLayout } from "./lib/chat-panel-layout";
import {
	getAnsweredTraceMessageIds,
	getLastAssistantMessageId,
	shouldRenderGeneratedAgentFallbackCard as resolveShouldRenderGeneratedAgentFallbackCard,
} from "./lib/chat-panel-messages";
import type { ChatPanelProps } from "./lib/chat-panel-types";

export type { ChatSubmitInterceptOutcome } from "./hooks/use-chat-submit";
export type {
	ChatComposerPrefillRequest,
	ChatPanelAgentVersionOption,
	ChatPanelCardsProps,
	ChatPanelCustomAgentTabs,
	ChatPanelGeneratedAgentResultRenderInput,
	ChatPanelGreetingProps,
	ChatPanelHistoryController,
	ChatPanelLocalConversation,
	ChatPanelLocalConversationSubmitDetails,
	ChatPanelLocalConversationSubmitResult,
	ComposerInputContext,
} from "./lib/chat-panel-types";

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
	// The chat's markdown runtime loads when the chat opens (sidebar or floating), not with the
	// route that mounts this panel, so the answer to a first message is not held up by it.
	useEffect(() => {
		if (chatSurface) {
			preloadMessageMarkdownForReply();
		}
	}, [chatSurface]);
	const [selectedReasoning, setSelectedReasoning] = useState(DEFAULT_REASONING_OPTION_ID);
	const [directoryAutocompleteState, setDirectoryAutocompleteState] = useState<DirectoryAutocompleteState | null>(null);
	const [directoryAutocompleteController, setDirectoryAutocompleteController] = useState<ComposerDirectoryAutocompleteController | null>(null);
	const agentVersion = useAgentVersionSelection({ agentVersionOptions, onAgentVersionChange, selectedAgentVersionId });
	const { isCollapsibleEditContextBar, isContextBarOpen, setIsContextBarOpen } = useContextBarOpenState(chatContextBar);
	const { containerWidthPx, panelRef, resolvedSendPromptOptions, viewportWidthPx } = useChatPanelWidth(sendPromptOptions);

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
	const localConversationVoice = useLocalConversationVoice(localConversation);
	const {
		handleAgentResultSelect,
		handleComposerSubmit,
		handleDirectoryAutocompleteSelect,
		handleFollowUpSuggestionClick,
		handleGreetingSuggestionClick,
		handleWidgetPrimaryAction,
	} = useChatPanelPromptActions({
		composerInputContext,
		directoryAutocompleteController,
		handleSubmit,
		interceptSubmit,
		localConversation,
		prompt,
		resolvedSendPromptOptions,
		selectAgent,
		selectableAgents,
		sendPrompt,
		setPrompt,
		speakLocalConversationVoiceText: localConversationVoice.speakLocalConversationVoiceText,
		submitPrompt,
	});

	// --- Rovo AI cursor companion (Clicky) ---
	const { clicky, screenAssistantRegion: screenAssistantRegionState, streamClickyAssistantText } = useChatPanelClicky(hideAiCursor);
	const isClickyActive = clicky.isActive;
	const {
		painting: screenAssistantRegionPainting,
		region: screenAssistantRegion,
		setPainting: setScreenAssistantRegionPainting,
		setRegion: setScreenAssistantRegion,
	} = screenAssistantRegionState;
	const { composerFocusRequestKey, promptRef, requestComposerFocus } = useComposerPromptBridge({
		composerPrefillRequest,
		onComposerPrefillConsumed,
		prompt,
		setPrompt,
	});
	const { getScreenAssistantVisibleTargets, handleScreenAssistantToolCall } = useChatPanelScreenAssistant({
		chatSurface,
		clicky,
		handleComposerSubmit,
		promptRef,
		screenAssistantRegion,
		selectedAgent,
		setPrompt,
	});
	const {
		dictationState,
		dictationTranscriptPreview,
		handleStartDictation,
		handleStopDictation,
		handleToggleClicky,
		handleToggleRealtimeVoice,
		isRealtimeVoiceActive,
		realtime,
	} = useChatPanelRealtime({
		clicky,
		handleScreenAssistantToolCall,
		handleSubmit,
		hideAiCursor,
		isStreaming,
		localConversation,
		localConversationVoice,
		promptRef,
		recordLocalAssistantTurn,
		requestComposerFocus,
		resolvedSendPromptOptions,
		sendPrompt,
		setPrompt,
		startRealtimeVoiceRequestKey,
		streamClickyAssistantText,
		uiMessages,
	});

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
	const shouldRenderGeneratedAgentFallbackCard = useMemo(
		() => resolveShouldRenderGeneratedAgentFallbackCard(cards?.generatedAgentResult, messages),
		[cards?.generatedAgentResult, messages],
	);

	useArtifactResultReporting(messages, onArtifactResult);
	const lastAssistantMessageId = useMemo(() => getLastAssistantMessageId(messages), [messages]);

	// Opt-in (markAnsweredQuestionTraces): assistant messages followed by a later
	// user message have had their clarification answered.
	const answeredTraceMessageIds = useMemo(
		() => getAnsweredTraceMessageIds(rawUiMessages, markAnsweredQuestionTraces),
		[markAnsweredQuestionTraces, rawUiMessages],
	);

	const decisions = useChatPanelDecisions({
		acceptPlanReview,
		activeThreadId,
		interceptClarificationAnswers,
		interceptSubmit,
		isLocalConversationActive,
		isRequestInFlight,
		isStreamingLifecycleActive,
		rawUiMessages,
		resolvedSendPromptOptions,
		sendPrompt,
		submitPlanApproval,
	});

	const scrollAnchor = useScrollAnchor({
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

	const { handleArtifactDialogOpen, releaseArtifactDialogFloatingPin } = useArtifactDialogFloatingPin({
		chatSurface,
		onArtifactDialogOpen,
		pinFloating,
		preserveFloatingSurfaceOnArtifactDialogOpen,
		unpinFloating,
	});

	const hasMessages = messages.length > 0;
	const { isAgentTestEmptyState, messagesContainerStyle, resolvedContainerStyle, resolvedGreeting } = resolveChatPanelLayout({
		composerReservesContextBarSpace,
		containerStyle,
		emptyGreetingPlacement,
		greeting,
		hasMessages,
		isEditContextBarCollapsed: isCollapsibleEditContextBar && !isContextBarOpen,
		showAgentTestControls,
	});
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
		<ChatPanelConversation
			agentCreator={agentCreator}
			answeredTraceMessageIds={answeredTraceMessageIds}
			cards={cards}
			conversationContentClassName={conversationContentClassName}
			decisions={decisions}
			directoryAutocompleteState={directoryAutocompleteState}
			editingMessageId={editingMessageId}
			enableSmartWidgets={enableSmartWidgets}
			externalThinkingMessageId={externalThinkingMessageId}
			getWidgetPosition={getWidgetPosition}
			greetingAgent={greetingSelectedAgent ?? selectedAgent}
			hasMessages={hasMessages}
			hasPendingChatWork={hasPendingChatWork}
			inlineArtifactDocuments={inlineArtifactDocuments}
			isMaxMode={selectedReasoning === "max"}
			isStreamingLifecycleActive={isStreamingLifecycleActive}
			lastAssistantMessageId={lastAssistantMessageId}
			localThinkingAssistantMessageId={localThinkingAssistantMessageId}
			messages={messages}
			messagesContainerStyle={messagesContainerStyle}
			onAgentResultSelect={handleAgentResultSelect}
			onArtifactDialogClose={releaseArtifactDialogFloatingPin}
			onArtifactDialogOpen={handleArtifactDialogOpen}
			onDirectoryAutocompleteSelect={handleDirectoryAutocompleteSelect}
			onEditMessage={(messageId, nextText) =>
				editMessage(messageId, nextText, resolvedSendPromptOptions)
			}
			onFollowUpSuggestionClick={handleFollowUpSuggestionClick}
			onGreetingSuggestionClick={handleGreetingSuggestionClick}
			onOpenAgentEditSummary={onOpenAgentEditSummary}
			onSetEditingMessageId={setEditingMessageId}
			onWidgetPrimaryAction={handleWidgetPrimaryAction}
			prompt={prompt}
			renderWidget={renderWidget}
			resolvedGreeting={resolvedGreeting}
			scrollAnchor={scrollAnchor}
			shouldRenderGeneratedAgentFallbackCard={shouldRenderGeneratedAgentFallbackCard}
			shouldUseWideDirectoryAutocompleteList={shouldUseWideDirectoryAutocompleteList}
			showAgentTestControls={showAgentTestControls}
			showAwaitingIndicator={showAwaitingIndicator}
			thinking={thinking}
		/>
	);
	const chatComposerBody = (
		<ChatPanelComposerArea
			addMenuItemsBefore={addMenuItemsBefore}
			autoFocusComposer={autoFocusComposer}
			chatContextBar={chatContextBar}
			clickyActive={!hideAiCursor && (isClickyActive || isLocalConversationActive)}
			composerContainerClassName={composerContainerClassName}
			composerContextBar={composerContextBar}
			composerFocusRequestKey={composerFocusRequestKey}
			composerInputContext={composerInputContext}
			composerMentionSources={composerMentionSources}
			composerPrefillRequest={composerPrefillRequest}
			composerSurfaceHeader={composerSurfaceHeader}
			composerSurfaceHeaderTooltip={composerSurfaceHeaderTooltip}
			composerToolsAfterAdd={composerToolsAfterAdd}
			decisions={decisions}
			dictationState={dictationState}
			dictationTranscriptPreview={dictationTranscriptPreview}
			hasInFlightTurn={hasInFlightTurn}
			hideAiCursor={hideAiCursor}
			hideAiDisclaimer={hideAiDisclaimer}
			hideComposerSourceAndModelControls={hideComposerSourceAndModelControls}
			isRealtimeVoiceActive={isRealtimeVoiceActive}
			isStreamingLifecycleActive={isStreamingLifecycleActive}
			micStream={realtime.micStream}
			onComposerPrefillConsumed={onComposerPrefillConsumed}
			onComposerSubmit={handleComposerSubmit}
			onContextBarOpenChange={setIsContextBarOpen}
			onDirectoryAutocompleteChange={setDirectoryAutocompleteState}
			onDirectoryAutocompleteControllerChange={setDirectoryAutocompleteController}
			onPromptChange={setPrompt}
			onReasoningChange={setSelectedReasoning}
			onRemoveQueuedPrompt={removeQueuedPrompt}
			onStartDictation={handleStartDictation}
			onStop={abort}
			onStopDictation={handleStopDictation}
			onToggleClicky={handleToggleClicky}
			onToggleRealtimeVoice={handleToggleRealtimeVoice}
			prompt={prompt}
			queuedPrompts={queuedPrompts}
			realtimeVoiceState={realtime.voiceState}
			resolveComposerPlaceholder={resolveComposerPlaceholder}
			selectedReasoning={selectedReasoning}
			shouldShowDirectoryAutocompleteList={shouldShowDirectoryAutocompleteList}
		/>
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
				<CustomAgentTabs
					agentVersion={agentVersion}
					agentVersionOptions={agentVersionOptions}
					chatComposerBody={chatComposerBody}
					chatConversationBody={chatConversationBody}
					customAgentTabs={customAgentTabs}
					getSessionAgentEntry={getSessionAgentEntry}
					isAgentTestEmptyState={isAgentTestEmptyState}
					onResetChat={resetChat}
					rawUiMessages={rawUiMessages}
					selectedAgent={selectedAgent}
					showAgentTestControls={showAgentTestControls}
				/>
			) : (
				chatPanelBody
			)}
			{hideAiCursor ? null : (
				<ClickyOverlay
					state={clicky.state}
					paintingActive={screenAssistantRegionPainting}
					pointTarget={clicky.pointTarget}
					responseText={clicky.responseText}
					onReturnToIdle={clicky.returnToIdle}
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
