"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerViewport, useMessageScroller } from "@/components/ui/message-scroller";
import {
	ChainOfThought,
	ChainOfThoughtHeader,
} from "@/components/ui-custom/chain-of-thought";
import { cn } from "@/lib/utils";
import { MessageTurns } from "@/components/projects/shared/message-turns";
import { ThreadMessage } from "@/components/projects/shared/thread-message";
import {
	isRenderableRovoUIMessage,
	type RovoUIMessage,
	type RovoRenderableUIMessage,
} from "@/lib/rovo-ui-messages";
import { PreloadThinkingIndicator } from "./preload-thinking-indicator";
import { StreamingThinkingIndicator } from "./streaming-thinking-indicator";
import { useStreamingIndicatorState } from "@/components/projects/shared/hooks/use-streaming-indicator";
import {
	getAwaitingUserResponseLabel,
	getDefaultThinkingLabel,
} from "@/lib/reasoning-labels";
import styles from "./chat-messages.module.css";

export interface ChatMessagesProps {
	uiMessages: RovoUIMessage[];
	contentClassName?: string;
	onSuggestedQuestionClick?: (question: string) => void;
	onDeleteMessage?: (messageId: string) => void;
	contentTopPadding?: string;
	contentBottomPadding?: string;
	hideScrollbar?: boolean;
	defaultScrollPosition?: "start" | "end" | "last-anchor";
	isStreaming?: boolean;
	isSubmitPending?: boolean;
	messageMode?: "plan" | "ask";
	reasoningContent?: string;
	streamingIndicatorVariant?: "thinking" | "reasoning-expanded";
	streamingIndicatorMessages?: RovoUIMessage[];
	showAwaitingIndicator?: boolean;
	awaitingIndicatorLabel?: string;
	showFeedbackActions?: boolean;
	showFollowUpSuggestions?: boolean;
	showWidgetSections?: boolean;
	assistantStreamingRenderMode?: "rich" | "text-first";
	renderEmptyState?: () => ReactNode;
	renderWidget?: (
		widget: { type: string; data: unknown },
		message: RovoRenderableUIMessage
	) => ReactNode;
}

export function AwaitingUserResponseIndicator({
	label = getAwaitingUserResponseLabel(),
}: Readonly<{ label?: string }>): ReactNode {
	return (
		<div className="flex justify-start">
			<ChainOfThought>
				<ChainOfThoughtHeader showChevron={false} state="thinking">
					{label}
				</ChainOfThoughtHeader>
			</ChainOfThought>
		</div>
	);
}

function AwaitingScrollSync({ awaiting }: Readonly<{ awaiting: boolean }>) {
	const { scrollToEnd } = useMessageScroller();
	useEffect(() => {
		if (!awaiting) return;
		const frame = requestAnimationFrame(() => scrollToEnd({ behavior: "instant" }));
		return () => cancelAnimationFrame(frame);
	}, [awaiting, scrollToEnd]);
	return null;
}

export function ChatMessages({
	uiMessages,
	contentClassName,
	onSuggestedQuestionClick,
	onDeleteMessage,
	contentTopPadding,
	contentBottomPadding,
	hideScrollbar = true,
	defaultScrollPosition = "start",
	isStreaming = false,
	isSubmitPending = false,
	messageMode = "plan",
	reasoningContent,
	streamingIndicatorVariant = "thinking",
	streamingIndicatorMessages,
	showAwaitingIndicator = false,
	awaitingIndicatorLabel = getAwaitingUserResponseLabel(),
	showFeedbackActions,
	showFollowUpSuggestions,
	showWidgetSections: showWidgetSectionsProp,
	assistantStreamingRenderMode = "rich",
	renderEmptyState,
	renderWidget,
}: Readonly<ChatMessagesProps>): ReactNode {
	const renderableMessages = useMemo(
		() => uiMessages.filter(isRenderableRovoUIMessage),
		[uiMessages]
	);
	const isPureMode = messageMode === "ask";
	const shouldShowWidgetSections = showWidgetSectionsProp ?? !isPureMode;
	const thinkingLabel = getDefaultThinkingLabel();

	const lastAssistantMessageId = useMemo(() => {
		for (let i = renderableMessages.length - 1; i >= 0; i--) {
			if (renderableMessages[i].role === "assistant") {
				return renderableMessages[i].id;
			}
		}
		return null;
	}, [renderableMessages]);

	const indicator = useStreamingIndicatorState(uiMessages, {
		isStreaming,
		isSubmitPending,
		thinkingLabel,
		reasoningContent,
		streamingIndicatorVariant,
		streamingIndicatorMessages,
		lastAssistantMessageId,
	});

	const isRequestInFlight = isStreaming || isSubmitPending;

	return (
		<MessageScroller
			autoScroll
			defaultScrollPosition={defaultScrollPosition}
			scrollPreviousItemPeek={0}
			scrollMargin={Math.max(0, 48 - (Number.parseFloat(contentTopPadding ?? "12") || 0))}
			className={cn("min-h-0 flex-1", hideScrollbar && styles.hideScrollbar)}
		>
			<AwaitingScrollSync awaiting={showAwaitingIndicator} />
			<MessageScrollerViewport>
				<MessageScrollerContent
					className={cn("flex w-full shrink-0 flex-col gap-6 p-3", contentClassName)}
					style={{
						paddingTop: contentTopPadding,
						paddingBottom: contentBottomPadding ?? "80px",
					}}
				>
					{renderableMessages.length === 0 ? (
						<MessageScrollerItem className="[content-visibility:visible]">{renderEmptyState?.() ?? null}</MessageScrollerItem>
					) : (
						<MessageTurns
							renderTurnContainer={(turn, children) => (
								<MessageScrollerItem className="[content-visibility:visible]" messageId={turn[0]?.id} scrollAnchor={turn[0]?.role === "user"}>
									{children}
								</MessageScrollerItem>
							)}
							isUserMessage={(message) => message.role === "user"}
							getTurnContainerClassName={() => "w-full"}
							getTurnContainerStyle={(_turn, turnIndex) => ({
								marginTop: turnIndex > 0 ? "24px" : "0",
							})}
							getMessageContainerStyle={(message, messageIndex, turn) => {
								return {
									display: "flex",
									justifyContent: message.role === "user" ? "flex-end" : "flex-start",
									marginTop:
										message.role === "assistant" &&
										messageIndex > 0 &&
										(
											turn[messageIndex - 1]?.role === "user" ||
											turn[messageIndex - 1]?.role === "assistant"
										)
											? "24px"
											: "0",
								};
							}}
							latestTurnClassName={styles.latestTurn}
							latestTurnDataAttribute="data-rovo-latest-turn"
							messages={renderableMessages}
							renderMessage={(message) => {
								const shouldShowFeedback = showFeedbackActions ?? true;
								const shouldShowSuggestions = showFollowUpSuggestions ?? true;
								return (
									<ThreadMessage.Root
										message={message}
										surface="fullscreen"
										isThinkingLifecycleStreaming={
											isRequestInFlight && message.id === lastAssistantMessageId
										}
										assistantStreamingRenderMode={assistantStreamingRenderMode}
										onDeleteMessage={onDeleteMessage}
										renderWidget={shouldShowWidgetSections ? renderWidget : undefined}
									>
										<ThreadMessage.Widget position="before-content" />
										{/* Agent text first; chain-of-thought / tool calls follow beneath it. */}
										<ThreadMessage.Content />
										<ThreadMessage.Reasoning />
										<ThreadMessage.ThinkingStatus />
										{shouldShowFeedback ? <ThreadMessage.Feedback /> : null}
										{!isPureMode ? (
											<>
												<ThreadMessage.Tools />
												<ThreadMessage.ToolFirstWarning />
											</>
										) : null}
										<ThreadMessage.Sources />
										{shouldShowSuggestions ? (
											<ThreadMessage.Suggestions onSuggestionClick={onSuggestedQuestionClick} />
										) : null}
										<ThreadMessage.Widget position="after-content" />
									</ThreadMessage.Root>
								);
							}}
						/>
					)}
					{indicator.shouldShowPreloader ? (
						<MessageScrollerItem className="flex justify-start [content-visibility:visible]">
							<PreloadThinkingIndicator />
						</MessageScrollerItem>
					) : null}
					{indicator.shouldShowThinkingStatus ? (
						<MessageScrollerItem className="[content-visibility:visible]">
							<StreamingThinkingIndicator
								reasoningKey={indicator.reasoningKey}
								label={indicator.resolvedLabel}
								hasDetails={indicator.shouldUseExpanded && indicator.hasDetails}
								hasReasoningContent={indicator.hasContent}
								trimmedReasoningContent={indicator.trimmedContent}
								hasThinkingToolCalls={indicator.hasToolCalls}
								thinkingToolCalls={indicator.thinkingToolCalls}
								allowAutoCollapse={indicator.allowAutoCollapse}
								lastMessageId={indicator.lastSourceMessageId}
								containerClassName="flex justify-start"
								phaseProps={indicator.reasoningPhaseProps}
							/>
						</MessageScrollerItem>
					) : null}
					{!indicator.shouldShowPreloader && !indicator.shouldShowThinkingStatus && showAwaitingIndicator ? (
						<MessageScrollerItem className="[content-visibility:visible]"><AwaitingUserResponseIndicator label={awaitingIndicatorLabel} /></MessageScrollerItem>
					) : null}
				</MessageScrollerContent>
			</MessageScrollerViewport>
			<MessageScrollerButton className="z-10" />
		</MessageScroller>
	);
}
