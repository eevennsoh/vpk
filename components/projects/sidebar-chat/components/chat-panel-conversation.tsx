"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for empty states and adornments.

import type { CSSProperties } from "react";
import { StreamingThinkingIndicator } from "@/components/projects/shared/components/streaming-thinking-indicator";
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerViewport } from "@/components/ui/message-scroller";
import { ChatScrollerItem } from "@/components/projects/shared/components/chat-scroller-item";
import { MessageTurns, turnEnterClassName } from "@/components/projects/shared/message-turns";
import type { RovoRenderableUIMessage } from "@/lib/rovo-ui-messages";
import type { GenerativeWidgetPrimaryActionPayload } from "@/components/projects/shared/lib/generative-widget";
import type { RovoSuggestion } from "@/lib/rovo-suggestions";
import type { DirectoryAutocompleteState } from "@/lib/directory-autocomplete";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import { PreloadThinkingIndicator } from "@/components/projects/shared/components/preload-thinking-indicator";
import { AwaitingUserResponseIndicator } from "@/components/projects/shared/components/chat-messages";
import { cn } from "@/lib/utils";
import { chatStyles } from "../data/styles";
import { getTurnGeneratedResults } from "../lib/chat-panel-messages";
import type { ChatPanelGreetingProps, ChatPanelProps, RovoChat } from "../lib/chat-panel-types";
import type { useThinkingStatus } from "../hooks/use-thinking-status";
import type { ChatPanelDecisions } from "../hooks/use-chat-panel-decisions";
import ChatGreeting from "./chat-greeting";
import MessageBubble from "./message-bubble";
import { ArtifactResultCard, type ArtifactResult } from "./artifact-result-card";
import { AgentResultCard } from "./agent-result-card";

interface ChatPanelConversationProps
	extends Pick<
		ChatPanelProps,
		| "agentCreator"
		| "cards"
		| "conversationContentClassName"
		| "enableSmartWidgets"
		| "externalThinkingMessageId"
		| "getWidgetPosition"
		| "inlineArtifactDocuments"
		| "onOpenAgentEditSummary"
		| "renderWidget"
		| "showAgentTestControls"
		| "showAwaitingIndicator"
		| "readOnly"
	> {
	answeredTraceMessageIds: ReadonlySet<string>;
	decisions: Pick<ChatPanelDecisions, "handleBuildPlan" | "resolvePlanBuildState" | "shouldShowQuestionCard">;
	directoryAutocompleteState: DirectoryAutocompleteState | null;
	editingMessageId: RovoChat["editingMessageId"];
	greetingAgent: RovoAgentProfile | RovoChat["selectedAgent"] | null;
	hasMessages: boolean;
	hasPendingChatWork: boolean;
	isMaxMode: boolean;
	isStreamingLifecycleActive: boolean;
	lastAssistantMessageId: string | null;
	localThinkingAssistantMessageId: string | null;
	messages: ReadonlyArray<RovoRenderableUIMessage>;
	messagesContainerStyle: CSSProperties;
	onAgentResultSelect: Parameters<typeof AgentResultCard>[0]["onSelectAgent"];
	onArtifactDialogClose: () => void;
	onArtifactDialogOpen: (artifact: ArtifactResult) => void;
	onDirectoryAutocompleteSelect: (index: number) => void;
	onEditMessage: (messageId: string, nextText: string) => void;
	onFollowUpSuggestionClick: (question: string) => void;
	onGreetingSuggestionClick: (suggestion: RovoSuggestion) => void;
	onSetEditingMessageId: RovoChat["setEditingMessageId"];
	onWidgetPrimaryAction: (payload: GenerativeWidgetPrimaryActionPayload) => void;
	prompt: string;
	resolvedGreeting?: ChatPanelGreetingProps;
	enableTurnAnchor: boolean;
	shouldRenderGeneratedAgentFallbackCard: boolean;
	shouldUseWideDirectoryAutocompleteList: boolean;
	thinking: ReturnType<typeof useThinkingStatus>;
}

/** Scrollable thread: greeting or message turns, generated result cards, and thinking indicators. */
export function ChatPanelConversation({
	readOnly = false,
	agentCreator,
	answeredTraceMessageIds,
	cards,
	conversationContentClassName,
	decisions,
	directoryAutocompleteState,
	editingMessageId,
	enableSmartWidgets,
	externalThinkingMessageId,
	getWidgetPosition,
	greetingAgent,
	hasMessages,
	hasPendingChatWork,
	inlineArtifactDocuments,
	isMaxMode,
	isStreamingLifecycleActive,
	lastAssistantMessageId,
	localThinkingAssistantMessageId,
	messages,
	messagesContainerStyle,
	onAgentResultSelect: handleAgentResultSelect,
	onArtifactDialogClose: releaseArtifactDialogFloatingPin,
	onArtifactDialogOpen: handleArtifactDialogOpen,
	onDirectoryAutocompleteSelect: handleDirectoryAutocompleteSelect,
	onEditMessage,
	onFollowUpSuggestionClick: handleFollowUpSuggestionClick,
	onGreetingSuggestionClick: handleGreetingSuggestionClick,
	onOpenAgentEditSummary,
	onSetEditingMessageId: setEditingMessageId,
	onWidgetPrimaryAction: handleWidgetPrimaryAction,
	prompt,
	renderWidget,
	resolvedGreeting,
	enableTurnAnchor,
	shouldRenderGeneratedAgentFallbackCard,
	shouldUseWideDirectoryAutocompleteList,
	showAgentTestControls,
	showAwaitingIndicator,
	thinking,
}: Readonly<ChatPanelConversationProps>): React.ReactElement {
	const { handleBuildPlan, resolvePlanBuildState, shouldShowQuestionCard } = decisions;

	return (
		<MessageScroller autoScroll scrollPreviousItemPeek={0} className="min-h-0 min-w-0 flex-1">
			<MessageScrollerViewport className={cn(!hasMessages ? "[scrollbar-gutter:auto]" : null)}>
				<MessageScrollerContent
					className={cn(
						"mx-auto flex min-w-0 max-w-[800px] flex-col gap-4 px-4 py-6 md:gap-6",
						conversationContentClassName
					)}
					// In the Test empty state, messagesContainerStyle grows this content
					// track to full height and bottom-aligns (or centers when there are no
					// starters) the greeting (inline values win over Tailwind classes).
					style={messagesContainerStyle}
				>
					{messages.length === 0 ? (
						<ChatScrollerItem className="w-full" style={chatStyles.emptyState}>
							<ChatGreeting
								heading={resolvedGreeting?.heading}
								illustrationSrc={resolvedGreeting?.illustrationSrc}
								illustrationDarkSrc={resolvedGreeting?.illustrationDarkSrc}
								isAgentTest={showAgentTestControls}
								isComposing={prompt.trim().length > 0}
								isMaxMode={isMaxMode}
								selectedAgent={greetingAgent}
								showHero={resolvedGreeting?.showHero}
								showStarterGroupLabel={resolvedGreeting?.showStarterGroupLabel}
								starterGroupLabel={resolvedGreeting?.starterGroupLabel}
								agentTestSection={resolvedGreeting?.agentTestSection}
								suggestions={resolvedGreeting?.suggestions}
								directoryAutocompleteState={directoryAutocompleteState}
								useWideSuggestionLayout={shouldUseWideDirectoryAutocompleteList}
								onSuggestionClick={(suggestion) => {
									if (!resolvedGreeting?.onSuggestionSelect?.(suggestion)) handleGreetingSuggestionClick(suggestion);
								}}
								onDirectoryAutocompleteSelect={handleDirectoryAutocompleteSelect}
							/>
						</ChatScrollerItem>
					) : (
						<MessageTurns
							renderTurnContainer={(turn, children) => (
								<ChatScrollerItem messageId={turn[0]?.id} scrollAnchor={enableTurnAnchor && turn[0]?.role === "user"}>
									{children}
								</ChatScrollerItem>
							)}
							isUserMessage={(message) => message.role === "user"}
							getMessageContainerClassName={(message) => (message.role === "assistant" ? "[&:empty]:hidden" : undefined)}
							getMessageContainerStyle={(message, messageIndex, turn) => {
								return {
									paddingLeft: message.role === "assistant" ? "12px" : "0",
									paddingRight: message.role === "assistant" ? "12px" : "0",
									marginTop: message.role === "assistant" && messageIndex > 0 && (turn[messageIndex - 1]?.role === "user" || turn[messageIndex - 1]?.role === "assistant") ? "24px" : "0",
								};
							}}
							latestTurnClassName={turnEnterClassName}
							latestTurnDataAttribute="data-chat-latest-turn"
							messages={messages}
							renderMessage={(message) => (
								<MessageBubble
									message={message}
									isThinkingLifecycleStreaming={(isStreamingLifecycleActive || message.id === localThinkingAssistantMessageId || message.id === externalThinkingMessageId) && message.id === lastAssistantMessageId}
									treatQuestionToolCallsAsAnswered={answeredTraceMessageIds.has(message.id)}
									onSuggestionClick={readOnly ? undefined : handleFollowUpSuggestionClick}
									showFollowUpSuggestions={!readOnly && message.id === lastAssistantMessageId && !hasPendingChatWork}
									enableSmartWidgets={enableSmartWidgets}
									generativeCardAnimation={cards?.generativeAnimation}
									editingMessageId={readOnly ? null : editingMessageId}
									onEditMessage={readOnly ? undefined : onEditMessage}
									onSetEditingMessageId={readOnly ? undefined : setEditingMessageId}
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
								const generatedResults = getTurnGeneratedResults(turn, shouldRenderGeneratedAgentResult);

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
						<ChatScrollerItem className="w-full px-3" data-testid="rovo-generated-result-group">
							<AgentResultCard creator={agentCreator}
								agent={cards.generatedAgentResult}
								onSelectAgent={handleAgentResultSelect}
							/>
						</ChatScrollerItem>
					) : null}
					{thinking.shouldShowPreloader ? (
						<ChatScrollerItem style={chatStyles.thinkingContainer}>
							<PreloadThinkingIndicator />
						</ChatScrollerItem>
					) : null}
					{thinking.shouldShowThinkingStatus ? (
						<ChatScrollerItem>
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
						</ChatScrollerItem>
					) : null}
					{!thinking.shouldShowPreloader &&
					!thinking.shouldShowThinkingStatus &&
					showAwaitingIndicator &&
					shouldShowQuestionCard ? (
						<ChatScrollerItem><AwaitingUserResponseIndicator /></ChatScrollerItem>
					) : null}
				</MessageScrollerContent>
			</MessageScrollerViewport>
			<MessageScrollerButton className="z-10" />
		</MessageScroller>
	);
}
