"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Attachment, AttachmentPreview, Attachments } from "@/components/ui-custom/attachments";
import { Conversation, ConversationContent, ConversationScrollButton, type ConversationFollowMode } from "@/components/ui-custom/conversation";
import { Message, MessageActions, MessageContent, MessageCopyAction, MessageEditAction, MessageRegenerateAction, MessageResponse, MessageVoteActions } from "@/components/ui-custom/message";
import { ArtifactCard, type ArtifactKind } from "@/components/blocks/artifact";
import { AdsReasoningTrigger, Reasoning, ReasoningContent } from "@/components/ui-custom/reasoning";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/ui/inline-edit";
import { getRovoAppInterruptionLabel } from "@/lib/rovo-app-interruptions";
import { resolveRovoAppOrphanArtifactDisplay, type RovoAppPendingArtifactResult } from "@/components/projects/rovo-core/lib/rovo-app-message-artifacts";
import { resolveRovoAppAssistantMessageRenderModel } from "@/components/projects/rovo-core/lib/rovo-app-message-render-model";
import {
	sanitizeRovoAppAssistantText,
	getLatestVisibleRovoAppMessageIdByRole,
	getVisibleRovoAppMessages,
	looksLikeBrowserFallbackAssistantText,
	shouldRenderRovoAppAssistantActions,
	shouldRenderRovoAppAssistantText,
	shouldRenderRovoAppAssistantMessage,
	shouldRenderRovoAppVisibleWidget,
	shouldRenderRovoAppWidget,
} from "@/components/projects/rovo-core/lib/rovo-app-message-display";
import { resolveRovoAppPendingAssistantDisplayState, resolveRovoAppStreamingAssistantMessageId } from "@/components/projects/rovo-core/lib/rovo-app-streaming-assistant";
import { RovoAppConversationEmptyState } from "@/components/projects/rovo-core/components/rovo-app-empty-state";
import { ROVO_APP_DEFAULT_EMPTY_STATE, type RovoAppEmptyStateConfig } from "@/components/projects/rovo-core/components/rovo-app-empty-state-config";
import { RovoAppScrollActiveTracker, RovoAppScrollAnchorSync } from "@/components/projects/rovo-core/components/rovo-app-scroll-sync";
import { computeRovoAppAnchorScrollTop } from "@/components/projects/rovo-core/lib/rovo-app-scroll-anchor-dom";
import { GenerativeWidgetCard } from "@/components/projects/shared/components/generative-widget-card";
import { AssistantSuggestionsSection } from "@/components/projects/shared/components/assistant-suggestions-section";
import { PlanWidgetInlineCard } from "@/components/projects/shared/components/plan-widget-inline-card";
import { PreloadThinkingIndicator } from "@/components/projects/shared/components/preload-thinking-indicator";
import { AssistantThinkingTrace, useAssistantThinkingTraceState } from "@/components/projects/shared/components/assistant-thinking-trace";
import { readAssistantMessage } from "@/components/projects/shared/lib/process-assistant-message";
import { getPreloadShimmerLabel } from "@/components/projects/shared/lib/reasoning-labels";
import {
	getMessageInterruption,
	getMessageText,
	type RovoDataParts,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import { getLatestPendingPlanWidget, getLatestPlanWidgetPayload, parsePlanWidgetPayload, type ParsedPlanWidgetPayload } from "@/components/projects/shared/lib/plan-widget";
import { resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import type { VisualIdentity } from "@/components/projects/shared/lib/visual-identity";
import { cn } from "@/lib/utils";
import { BrowserScreenshotPart } from "@/components/projects/rovo-core/components/rovo-app-browser-screenshot";
import type { RovoAppDocument } from "@/lib/rovo-app-types";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";
import { isRovoAgentProfile, type RovoAgentProfile } from "@/app/data/directory/agents";
import { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerCard } from "@/components/blocks/answer-card/components/answer-card";

export { ROVO_APP_DEFAULT_EMPTY_STATE } from "@/components/projects/rovo-core/components/rovo-app-empty-state-config";
export type { RovoAppEmptyStateConfig } from "@/components/projects/rovo-core/components/rovo-app-empty-state-config";

type RovoAppCustomWidgetRenderContext = {
	message: RovoUIMessage;
	thinkingToolCalls: ReturnType<typeof useAssistantThinkingTraceState>["data"]["thinkingToolCalls"];
	widget: RovoDataParts["widget-data"];
};

type RovoAppMessageRenderContext = {
	message: RovoUIMessage;
};

export interface RovoAppMessagesProps {
	additionalToolDrivenWidgetTypes?: ReadonlySet<string>;
	activeDocumentId: string | null;
	compact?: boolean;
	contentSpacingClassName?: string;
	emptyStateConfig?: RovoAppEmptyStateConfig;
	extraHorizontalPaddingWhenCompact?: boolean;
	hideCustomAgentStarters?: boolean;
	isMaxMode?: boolean;
	documents: ReadonlyArray<RovoAppDocument>;
	editingMessageId: string | null;
	isStreaming: boolean;
	messages: ReadonlyArray<RovoUIMessage>;
	onBuildPlan?: (planWidget: ParsedPlanWidgetPayload) => void | Promise<void>;
	onEditMessage: (messageId: string, nextText: string) => Promise<void>;
	onOpenArtifactFromCard: (documentId: string, element: HTMLElement) => void;
	onOpenBrowserPreview?: () => void;
	onOpenPlanPreview?: (planWidget: ParsedPlanWidgetPayload, sourceMessageId?: string) => void;
	onRegisterArtifactCard: (documentId: string, element: HTMLElement) => void;
	onRegenerate: () => void;
	onScrollActiveUserMessageChange?: (messageId: string | null) => void;
	onSelectSuggestion: (suggestion: string) => Promise<void>;
	onSetEditingMessageId: (messageId: string | null) => void;
	onVote: (messageId: string, value: "up" | "down" | null) => Promise<void>;
	pendingPlanMetadataMessageIds: ReadonlySet<string>;
	pendingArtifactResult: RovoAppPendingArtifactResult | null;
	scrollAnchorMessageId: string | null;
	scrollFollowMode: ConversationFollowMode;
	selectedAgent?: RovoAgentProfile | null;
	showEmptyState?: boolean;
	shouldSuppressArtifactCard?: (context: RovoAppMessageRenderContext) => boolean;
	shouldSuppressLatestAssistantSuggestions?: boolean;
	shouldSuppressResolvedQuestionTrace?: boolean;
	streamingArtifact: RovoAppStreamingArtifact | null;
	streamingArtifactMessageId: string | null;
	renderAfterAssistantMessage?: (context: RovoAppMessageRenderContext) => ReactNode;
	renderCustomWidget?: (context: RovoAppCustomWidgetRenderContext) => ReactNode;
	treatSettledToolsAsPostResultPending?: boolean;
	unavailableProductName?: string;
	votes: Record<string, "up" | "down">;
}

class AssistantMessageRenderBoundary extends Component<
	Readonly<{
		children: ReactNode;
		fallback: ReactNode;
		messageId: string;
		resetKey: string;
	}>,
	Readonly<{
		hasError: boolean;
		resetMarker: string;
	}>
> {
	state = {
		hasError: false,
		resetMarker: getAssistantMessageRenderBoundaryResetMarker(this.props),
	};

	static getDerivedStateFromError() {
		return {
			hasError: true,
		};
	}

	static getDerivedStateFromProps(
		props: Readonly<{
			children: ReactNode;
			fallback: ReactNode;
			messageId: string;
			resetKey: string;
		}>,
		state: Readonly<{
			hasError: boolean;
			resetMarker: string;
		}>,
	) {
		const resetMarker = getAssistantMessageRenderBoundaryResetMarker(props);

		if (state.resetMarker !== resetMarker) {
			return {
				hasError: false,
				resetMarker,
			};
		}

		return null;
	}

	componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
		console.error("[RovoApp] Assistant message render failed", {
			messageId: this.props.messageId,
			error,
			componentStack: errorInfo.componentStack,
		});
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback;
		}

		return this.props.children;
	}
}

function getAssistantMessageRenderBoundaryResetMarker({
	messageId,
	resetKey,
}: Readonly<{
	messageId: string;
	resetKey: string;
}>): string {
	return `${messageId}:${resetKey}`;
}

function UserMessage({
	isEditing,
	isScrollAnchor,
	message,
	onEditMessage,
	onSetEditingMessageId,
}: Readonly<{
	isEditing: boolean;
	isScrollAnchor: boolean;
	message: RovoUIMessage;
	onEditMessage: (messageId: string, nextText: string) => Promise<void>;
	onSetEditingMessageId: (messageId: string | null) => void;
}>) {
	const isDismissed = message.metadata?.clarificationStatus === "dismissed";
	const clarificationSummaryRows = (() => {
		if (isDismissed) return [];
		const meta = message.metadata;
		if (!meta || meta.source !== "clarification-submit") return [];
		if (!Array.isArray(meta.clarificationSummary)) return [];
		return meta.clarificationSummary.filter(
			(row): row is { question: string; answer: string; status?: "skipped" } =>
				typeof row?.question === "string" && row.question.trim().length > 0 && typeof row?.answer === "string" && row.answer.trim().length > 0,
		);
	})();
	const attachments = message.parts.filter((part): part is Extract<(typeof message.parts)[number], { type: "file" }> => part.type === "file");

	return (
		<Message
			animate
			className={isEditing ? "w-full max-w-full" : undefined}
			contain={!(isDismissed || clarificationSummaryRows.length > 0)}
			data-rovo-app-scroll-anchor={isScrollAnchor ? "true" : undefined}
			data-message-id={message.id}
			data-role="user"
			data-testid="message-user"
			fitContent={!isEditing}
			from="user"
		>
			{attachments.length > 0 ? (
				<Attachments className="justify-end" variant="grid">
					{attachments.map((attachment) => (
						<Attachment
							key={`${message.id}-${attachment.url}-${attachment.filename ?? "attachment"}`}
							data={{
								...attachment,
								id: `${message.id}-${attachment.url}-${attachment.filename ?? "attachment"}`,
							}}
						>
							<AttachmentPreview />
						</Attachment>
					))}
				</Attachments>
			) : null}

			{isEditing ? (
				<InlineEdit
					value={getMessageText(message)}
					multiline
					startWithEditViewOpen
					keepEditViewOpenOnBlur
					onConfirm={(nextValue) => void onEditMessage(message.id, nextValue)}
					onCancel={() => onSetEditingMessageId(null)}
				/>
			) : isDismissed ? (
				<AnswerCard label="Questions dismissed" rows={[]} />
			) : clarificationSummaryRows.length > 0 ? (
				<>
					<AnswerCard rows={clarificationSummaryRows} />
					<MessageActions reveal="hover" className="justify-end text-text-subtle">
						<MessageCopyAction text={getMessageText(message)} />
					</MessageActions>
				</>
			) : (
				<>
					<MessageContent>
						<MessageResponse plain className="font-medium text-inherit [&>*+*]:mt-3">{getMessageText(message)}</MessageResponse>
					</MessageContent>
					<MessageActions reveal="hover" className="justify-end text-text-subtle">
						<MessageCopyAction text={getMessageText(message)} />
						<MessageEditAction onClick={() => onSetEditingMessageId(message.id)} />
					</MessageActions>
				</>
			)}
		</Message>
	);
}

function WidgetErrorCard({
	onRetry,
	productName,
	widgetError,
}: Readonly<{
	onRetry: () => void;
	productName: string;
	widgetError: { data: { code?: string; message: string; details?: string; canRetry?: boolean } };
}>) {
	const [showDetails, setShowDetails] = useState(false);
	const code = widgetError.data.code;
	const isUnavailable = code === "ROVO_UNAVAILABLE";
	const isBusy = code === "ROVO_BUSY";

	const friendlyMessage = isUnavailable
		? `${productName} is currently unavailable. Please try again later.`
		: isBusy
			? `All ${productName} instances are busy. Your request will be retried shortly.`
			: widgetError.data.message;

	const borderClass = isBusy ? "border-warning" : "border-danger";
	const bgClass = isBusy ? "bg-warning/5" : "bg-danger/5";
	const textClass = isBusy ? "text-warning" : "text-danger";

	return (
		<div className={cn("rounded-xl border px-3 py-2 text-sm", borderClass, bgClass)}>
			<p className={textClass}>{friendlyMessage}</p>
			{widgetError.data.canRetry ? (
				<div className="mt-2">
					<Button onClick={onRetry} size="default" type="button" variant="outline">
						Retry
					</Button>
				</div>
			) : null}
			{widgetError.data.details ? (
				<div className="mt-2">
					<button className="text-text-subtlest text-xs underline" onClick={() => setShowDetails((prev) => !prev)} type="button">
						{showDetails ? "Hide details" : "Show details"}
					</button>
					{showDetails ? <pre className="mt-1 whitespace-pre-wrap text-text-subtlest text-xs">{widgetError.data.details}</pre> : null}
				</div>
			) : null}
		</div>
	);
}

function AssistantMessage({
	additionalToolDrivenWidgetTypes,
	artifactCard,
	isQuestionCardResolved,
	isLastAssistant,
	isPlanMetadataPending,
	isStreaming,
	isThinkingLifecycleStreaming,
	message,
	onBuildPlan,
	onOpenBrowserPreview,
	onOpenPlanPreview,
	onRegenerate,
	onVote,
	planBuildDisabled,
	planBuildDisabledReason,
	renderCustomWidget,
	shouldSuppressResolvedQuestionTrace,
	treatSettledToolsAsPostResultPending,
	unavailableProductName,
	voteValue,
}: Readonly<{
	additionalToolDrivenWidgetTypes?: ReadonlySet<string>;
	artifactCard: ReactNode;
	isQuestionCardResolved: boolean;
	isLastAssistant: boolean;
	isPlanMetadataPending: boolean;
	isStreaming: boolean;
	isThinkingLifecycleStreaming: boolean;
	message: RovoUIMessage;
	onBuildPlan?: (planWidget: ParsedPlanWidgetPayload) => void | Promise<void>;
	onOpenBrowserPreview?: () => void;
	onOpenPlanPreview?: (planWidget: ParsedPlanWidgetPayload, sourceMessageId?: string) => void;
	onRegenerate: () => void;
	onVote: (messageId: string, value: "up" | "down" | null) => Promise<void>;
	planBuildDisabled?: boolean;
	planBuildDisabledReason?: string;
	renderCustomWidget?: (context: RovoAppCustomWidgetRenderContext) => ReactNode;
	shouldSuppressResolvedQuestionTrace: boolean;
	treatSettledToolsAsPostResultPending: boolean;
	unavailableProductName: string;
	voteValue?: "up" | "down";
}>) {
	const interruption = getMessageInterruption(message);
	const interruptionLabel = getRovoAppInterruptionLabel(interruption);
	const facts = readAssistantMessage(message);
	const { reasoning, sources, browserScreenshots, routeDecision, hasTurnComplete } = facts;
	const text = sanitizeRovoAppAssistantText(facts.rawMessageText);
	const widget = facts.widgetDataPart;
	const widgetLoading = facts.widgetLoadingPart;
	const widgetError = facts.widgetErrorPart;
	const hasBrowserScreenshotContent = browserScreenshots.length > 0;

	// Widget type determines rendering path: "question-card" and "plan" widgets
	// render regardless of routing presentation (they come from Rovo tool calls
	// during clarification flows where presentation is "text"). GenUI widgets
	// only render when the routing decision says "genui_card".
	const widgetType = widget?.data.type ?? null;
	const parsedPlanWidget = widgetType === "plan" ? parsePlanWidgetPayload(widget?.data.payload) : null;
	const shouldShowWidget = shouldRenderRovoAppWidget({
		additionalToolDrivenWidgetTypes,
		hasBrowserScreenshots: hasBrowserScreenshotContent,
		hasWidget: Boolean(widget),
		routeDecision,
		widgetType,
	});
	const shouldHideResolvedQuestionCard = widgetType === "question-card" && isQuestionCardResolved;
	const hasVisibleWidget = shouldRenderRovoAppVisibleWidget({
		hasWidget: shouldShowWidget,
		shouldHideResolvedQuestionCard,
	});
	const isTextPresentation = routeDecision ? routeDecision.presentation === "text" : !widget;
	const isFallbackRoute = routeDecision !== null && routeDecision.confidence < 0.3;

	const shouldRenderPlanWidget = shouldShowWidget && parsedPlanWidget !== null;
	const isResponseInFlight = facts.isStreaming || isThinkingLifecycleStreaming || widgetLoading?.data.loading === true;
	const thinkingTraceState = useAssistantThinkingTraceState({
		message,
		isThinkingLifecycleStreaming,
		isResponseInFlight,
		treatQuestionToolCallsAsAnswered: isQuestionCardResolved,
		treatSettledToolsAsPostResultPending,
		planNarrationText: shouldRenderPlanWidget ? text : "",
		planNarrationStreaming: facts.isStreaming,
	});
	const thinkingToolCalls = thinkingTraceState.data.thinkingToolCalls;
	const hasThinkingToolCalls = thinkingTraceState.data.hasThinkingToolCalls;
	const hasTraceDataSignals = thinkingTraceState.data.hasTraceDataSignals;
	const shouldSuppressTraceForResolvedQuestion =
		shouldSuppressResolvedQuestionTrace &&
		shouldHideResolvedQuestionCard &&
		thinkingTraceState.data.hasAnsweredQuestionToolCalls &&
		thinkingTraceState.data.visibleThinkingToolCalls.length === 0 &&
		!isResponseInFlight;
	const thinkingActive = thinkingTraceState.thinkingActive && !shouldSuppressTraceForResolvedQuestion;
	const customWidget = shouldShowWidget && widget && !shouldHideResolvedQuestionCard && !shouldRenderPlanWidget
		? renderCustomWidget?.({
			message,
			thinkingToolCalls,
			widget: widget.data,
		}) ?? null
		: null;
	const shouldSuppressAssistantTextForBrowserScreenshot =
		hasBrowserScreenshotContent &&
		(
			widgetType === "genui-preview" ||
			looksLikeBrowserFallbackAssistantText(text)
		);
	const shouldRenderAssistantText = shouldRenderRovoAppAssistantText({
		hasText: Boolean(text),
		hasTurnComplete,
		hasToolActivity: hasThinkingToolCalls || hasTraceDataSignals,
		hasWidgetSignal: Boolean(widget) || widgetLoading?.data.loading === true,
		isFallbackRoute,
		isResponseInFlight,
		isTextPresentation,
		shouldRenderPlanWidget,
	}) && !shouldSuppressAssistantTextForBrowserScreenshot;
	const shouldRenderAssistantActions = shouldRenderRovoAppAssistantActions({
		hasArtifactCard: Boolean(artifactCard),
		hasBrowserScreenshots: hasBrowserScreenshotContent,
		hasAssistantText: shouldRenderAssistantText,
		hasInterruption: Boolean(interruptionLabel),
		hasSources: sources.length > 0,
		hasWidget: hasVisibleWidget,
		hasWidgetError: Boolean(widgetError),
		isLastAssistant,
		isResponseInFlight,
	});
	const shouldRenderAssistantMessage = shouldRenderRovoAppAssistantMessage({
		hasArtifactCard: Boolean(artifactCard),
		hasBrowserScreenshots: hasBrowserScreenshotContent,
		hasAssistantText: shouldRenderAssistantText,
		hasInterruption: Boolean(interruptionLabel),
		hasReasoning: Boolean(reasoning?.text) || thinkingActive,
		hasSources: sources.length > 0,
		hasWidget: hasVisibleWidget,
		hasWidgetError: Boolean(widgetError),
	});
	const isPlanWidgetStreaming = widgetType === "plan" && ((widgetLoading?.data.type === "plan" && widgetLoading.data.loading) || facts.isStreaming);

	if (!shouldRenderAssistantMessage) {
		return null;
	}

	const assistantRenderFallback = (
		<div className="flex flex-col gap-3">
			<div className="rounded-xl border border-border-warning/40 bg-bg-warning-subtler px-3 py-2 text-sm text-text-warning">
				I couldn&apos;t render part of this response. Retry the message or continue the chat.
			</div>
			{shouldRenderAssistantText ? (
				<MessageContent className="max-w-3xl">
					<MessageResponse>{text}</MessageResponse>
				</MessageContent>
			) : null}
			{isLastAssistant ? (
				<div>
					<Button size="default" type="button" variant="outline" onClick={onRegenerate}>
						Retry
					</Button>
				</div>
			) : null}
		</div>
	);

	return (
		<Message animate className="max-w-full" data-role="assistant" data-testid="message-assistant" from="assistant">
			<div className="flex w-full items-start gap-2 md:gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-3">
					<AssistantMessageRenderBoundary fallback={assistantRenderFallback} messageId={message.id} resetKey={`${message.parts.length}:${isStreaming ? "streaming" : "done"}`}>
						{thinkingActive ? (
							<AssistantThinkingTrace state={thinkingTraceState} />
						) : reasoning?.text ? (
							<Reasoning defaultOpen={reasoning.isStreaming} isStreaming={isStreaming && reasoning.isStreaming}>
								<AdsReasoningTrigger />
								<ReasoningContent>{reasoning.text}</ReasoningContent>
							</Reasoning>
						) : null}

						{shouldRenderPlanWidget ? (
							<div className="w-full pt-2">
								<PlanWidgetInlineCard
									title={parsedPlanWidget.title}
									description={parsedPlanWidget.description}
									shortDescription={parsedPlanWidget.shortDescription}
									markdown={parsedPlanWidget.markdown}
									tasks={parsedPlanWidget.tasks}
									isStreaming={isPlanWidgetStreaming}
									isMetadataPending={isPlanMetadataPending}
									onBuild={onBuildPlan ? () => onBuildPlan(parsedPlanWidget) : undefined}
									onOpenPreview={onOpenPlanPreview ? () => onOpenPlanPreview(parsedPlanWidget, message.id) : undefined}
									isBuildDisabled={planBuildDisabled}
									buildDisabledReason={planBuildDisabledReason}
									shouldAutoCollapse={planBuildDisabled === true}
								/>
							</div>
						) : customWidget ? (
							customWidget
						) : shouldShowWidget && widget && !shouldHideResolvedQuestionCard ? (
							<div className="w-full">
								<GenerativeWidgetCard thinkingToolCalls={thinkingToolCalls} widgetData={widget.data.payload} widgetType={widget.data.type ?? "message"} />
							</div>
						) : null}

						{widgetError ? <WidgetErrorCard productName={unavailableProductName} widgetError={widgetError} onRetry={onRegenerate} /> : null}

						{shouldRenderAssistantText ? (
							<MessageContent className="max-w-3xl">
								<MessageResponse isAnimating={facts.isStreaming}>{text}</MessageResponse>
							</MessageContent>
						) : null}

						{artifactCard}

						{browserScreenshots.length > 0 ? (
							<div className="flex flex-col gap-2">
								{browserScreenshots.map((part, index) => (
									<BrowserScreenshotPart
										key={`browser-screenshot-${message.id}-${index}`}
										screenshot={part.data}
										onFocusBrowserPanel={onOpenBrowserPreview}
									/>
								))}
							</div>
						) : null}

						{interruptionLabel ? (
							<div className="inline-flex w-fit items-center rounded-full border border-border-warning/40 bg-bg-warning-subtler px-2.5 py-1 text-text-warning-bolder text-xs">{interruptionLabel}</div>
						) : null}

						{sources.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{sources.map((source) =>
										source.type === "source-url" && source.url ? (
											<Button key={`${message.id}-${source.url}`} nativeButton={false} render={<a aria-label={source.title || source.url} href={source.url} rel="noreferrer" target="_blank" />} size="default" type="button" variant="outline">
												{source.title || source.url}
										</Button>
									) : (
										<Button key={`${message.id}-${source.title ?? "source"}`} size="default" type="button" variant="outline">
											{source.title || "Source"}
										</Button>
									),
								)}
							</div>
						) : null}

						{shouldRenderAssistantActions && shouldRenderAssistantText ? (
							<MessageActions reveal="hover" className="flex-wrap text-text-subtle">
								<MessageCopyAction text={text} />
								<MessageVoteActions onVote={(v) => void onVote(message.id, v)} value={voteValue} />
								{isLastAssistant && !message.metadata?.realtimeMessageId ? <MessageRegenerateAction onClick={onRegenerate} /> : null}
							</MessageActions>
						) : null}
					</AssistantMessageRenderBoundary>
				</div>
			</div>
		</Message>
	);
}

function RovoAppThinkingIndicator() {
	return <PreloadThinkingIndicator label={getPreloadShimmerLabel()} />;
}

function StreamingArtifactMessage({
	documentId,
	visualIdentity,
	kind,
	onOpenArtifactFromCard,
	onRegisterArtifactCard,
	streamingArtifact,
	title,
	versionNumber = 1,
}: Readonly<{
	documentId: string;
	visualIdentity?: VisualIdentity;
	kind: ArtifactKind;
	onOpenArtifactFromCard: (documentId: string, element: HTMLElement) => void;
	onRegisterArtifactCard: (documentId: string, element: HTMLElement) => void;
	streamingArtifact: RovoAppStreamingArtifact;
	title: string;
	versionNumber?: number;
}>) {
	return (
		<div className="group/message fade-in w-full animate-in duration-medium" data-role="assistant" data-testid="message-assistant-streaming-artifact">
			<div className="flex w-full items-start gap-2 md:gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-3">
					<ArtifactCard
						action={null}
						displayMode="preview"
						visualIdentity={visualIdentity}
						isStreaming={true}
						kind={kind}
						onOpen={(element) => onOpenArtifactFromCard(documentId, element)}
						onRegister={(element) => onRegisterArtifactCard(documentId, element)}
						previewContent={streamingArtifact.content}
						title={title}
						versionNumber={versionNumber}
					/>
				</div>
			</div>
		</div>
	);
}

function AssistantSuggestionPills({
	messageId,
	onSelectSuggestion,
	suggestions,
}: Readonly<{
	messageId: string;
	onSelectSuggestion: (suggestion: string) => Promise<void>;
	suggestions: ReadonlyArray<string>;
}>) {
	if (suggestions.length === 0) {
		return null;
	}

	return (
		<div className="fade-in mb-6 w-full animate-in duration-medium" data-role="assistant-suggestions">
			<div className="flex w-full items-start gap-2 md:gap-3">
				<div aria-hidden className="size-8 shrink-0" />
				<div className="flex min-w-0 flex-1 justify-end">
					<AssistantSuggestionsSection
						className="max-w-3xl py-0"
						messageId={messageId}
						onSuggestionClick={(suggestion) => {
							void onSelectSuggestion(suggestion);
						}}
						suggestedQuestions={suggestions}
					/>
				</div>
			</div>
		</div>
	);
}

export function RovoAppMessages({
	additionalToolDrivenWidgetTypes,
	activeDocumentId,
	compact = false,
	contentSpacingClassName = "py-6",
	emptyStateConfig = ROVO_APP_DEFAULT_EMPTY_STATE,
	extraHorizontalPaddingWhenCompact = false,
	hideCustomAgentStarters = false,
	isMaxMode = false,
	documents,
	editingMessageId,
	isStreaming,
	messages,
	onBuildPlan,
	onEditMessage,
	onOpenArtifactFromCard,
	onOpenBrowserPreview,
	onOpenPlanPreview,
	onRegisterArtifactCard,
	onRegenerate,
	onScrollActiveUserMessageChange,
	onSelectSuggestion,
	onSetEditingMessageId,
	onVote,
	pendingPlanMetadataMessageIds,
	pendingArtifactResult,
	scrollAnchorMessageId,
	scrollFollowMode,
	selectedAgent = null,
	showEmptyState = true,
	shouldSuppressArtifactCard,
	shouldSuppressLatestAssistantSuggestions = false,
	shouldSuppressResolvedQuestionTrace = false,
	streamingArtifact,
	streamingArtifactMessageId,
	renderAfterAssistantMessage,
	renderCustomWidget,
	treatSettledToolsAsPostResultPending = false,
	unavailableProductName = "Rovo",
	votes,
}: Readonly<RovoAppMessagesProps>) {
	const scrollSpacerRef = useRef<HTMLDivElement | null>(null);
	const visibleMessages = useMemo(
		() => getVisibleRovoAppMessages(messages),
		[messages],
	);
	const latestVisibleUserMessageId = useMemo(() => {
		return getLatestVisibleRovoAppMessageIdByRole(visibleMessages, "user");
	}, [visibleMessages]);
	const lastAssistantMessageId = useMemo(() => {
		return getLatestVisibleRovoAppMessageIdByRole(visibleMessages, "assistant");
	}, [visibleMessages]);
	const pendingPlanReview = useMemo(() => getLatestPendingPlanWidget(messages), [messages]);
	const latestPlanPayload = useMemo(() => getLatestPlanWidgetPayload(messages), [messages]);
	const latestPlanVisualIdentity = latestPlanPayload ? (latestPlanPayload.visualIdentity ?? resolvePlanVisualIdentity(latestPlanPayload.title)) : undefined;
	const latestPlanTitle = latestPlanPayload?.title ?? null;
	const latestPlanShortDescription = latestPlanPayload?.shortDescription?.trim() || null;
	const orphanArtifactDisplay = useMemo(() => {
		return resolveRovoAppOrphanArtifactDisplay({
			activeDocumentId,
			documents,
			fallbackPreviewSummary: latestPlanShortDescription,
			fallbackTitle: latestPlanTitle,
			messages: visibleMessages,
		});
	}, [activeDocumentId, documents, latestPlanShortDescription, latestPlanTitle, visibleMessages]);
	const streamingAssistantMessageId = useMemo(() => {
		return resolveRovoAppStreamingAssistantMessageId(visibleMessages);
	}, [visibleMessages]);
	const pendingAssistantDisplayState = useMemo(() => {
		return resolveRovoAppPendingAssistantDisplayState({
			isStreaming,
			messages: visibleMessages,
		});
	}, [isStreaming, visibleMessages]);
	const shouldShowPendingAssistantSurface = pendingAssistantDisplayState !== "idle";
	const shouldShowStreamingArtifactPreview = shouldShowPendingAssistantSurface && Boolean(streamingArtifact?.documentId) && streamingArtifactMessageId === null;
	const shouldShowPreloader = shouldShowPendingAssistantSurface && !shouldShowStreamingArtifactPreview;
	const shouldShowEmptyConversationState = showEmptyState && visibleMessages.length === 0;
	const customAgent = selectedAgent !== null && !isRovoAgentProfile(selectedAgent) ? selectedAgent : null;
	const handleTargetScrollTop = useCallback((defaultTargetTop: number, { scrollElement }: { scrollElement: HTMLElement }) => {
		return computeRovoAppAnchorScrollTop(defaultTargetTop, scrollElement, scrollSpacerRef);
	}, []);

	useEffect(() => {
		if (scrollFollowMode !== "bottom" || !scrollSpacerRef.current) {
			return;
		}

		scrollSpacerRef.current.style.height = "0px";
	}, [scrollFollowMode]);

	return (
		<Conversation
			className={cn("relative bg-background", shouldShowEmptyConversationState && "!flex-none overflow-visible")}
			followMode={scrollFollowMode}
			resize={isStreaming && scrollAnchorMessageId === latestVisibleUserMessageId ? "instant" : "smooth"}
			resizeTarget={isStreaming && scrollAnchorMessageId === latestVisibleUserMessageId ? "bottom" : "follow"}
			targetScrollTop={handleTargetScrollTop}
		>
			<RovoAppScrollAnchorSync
				scrollAnchorMessageId={scrollAnchorMessageId}
				target={isStreaming && scrollAnchorMessageId === latestVisibleUserMessageId ? "bottom" : "follow"}
			/>
			{onScrollActiveUserMessageChange ? <RovoAppScrollActiveTracker onActiveChange={onScrollActiveUserMessageChange} /> : null}
			{shouldShowEmptyConversationState ? (
				<RovoAppConversationEmptyState
					customAgent={customAgent}
					emptyStateConfig={emptyStateConfig}
					hideCustomAgentStarters={hideCustomAgentStarters}
					isMaxMode={isMaxMode}
					onSelectSuggestion={onSelectSuggestion}
				/>
			) : null}

			<ConversationContent
				className={cn(
					"mx-auto flex min-w-0 flex-col gap-4 md:gap-6",
					contentSpacingClassName,
					extraHorizontalPaddingWhenCompact && compact ? "px-9" : "px-4",
					compact ? "max-w-none" : "max-w-[800px]",
					shouldShowEmptyConversationState && "hidden",
				)}
			>
				{visibleMessages.map((message) => {
					if (message.role === "user") {
						return (
							<UserMessage
								isEditing={editingMessageId === message.id}
								isScrollAnchor={message.id === scrollAnchorMessageId}
								key={message.id}
								message={message}
								onEditMessage={onEditMessage}
								onSetEditingMessageId={onSetEditingMessageId}
							/>
						);
				}

					const renderModel = resolveRovoAppAssistantMessageRenderModel({
						documents,
						fallbackPreviewSummary: latestPlanShortDescription,
						fallbackTitle: latestPlanTitle,
						lastAssistantMessageId,
						message,
						messages,
						orphanArtifactDisplay,
						pendingArtifactResult,
						pendingPlanReview,
						shouldSuppressLatestAssistantSuggestions,
						streamingArtifact,
						streamingArtifactMessageId,
					});
					const resolvedArtifactDisplayForMessage =
						shouldSuppressArtifactCard?.({ message }) ? null : renderModel.artifactDisplay;

					return (
						<Fragment key={message.id}>
							<AssistantMessage
								additionalToolDrivenWidgetTypes={additionalToolDrivenWidgetTypes}
								artifactCard={
									resolvedArtifactDisplayForMessage ? (
										<ArtifactCard
											action={resolvedArtifactDisplayForMessage.action}
											displayMode={resolvedArtifactDisplayForMessage.displayMode}
											visualIdentity={latestPlanVisualIdentity}
											isStreaming={resolvedArtifactDisplayForMessage.isStreaming}
											kind={resolvedArtifactDisplayForMessage.kind}
											onOpen={(element) => onOpenArtifactFromCard(resolvedArtifactDisplayForMessage.documentId, element)}
											onRegister={(element) => onRegisterArtifactCard(resolvedArtifactDisplayForMessage.documentId, element)}
											previewContent={resolvedArtifactDisplayForMessage.previewContent}
											previewSummary={resolvedArtifactDisplayForMessage.previewSummary ?? undefined}
											title={resolvedArtifactDisplayForMessage.title}
											versionNumber={resolvedArtifactDisplayForMessage.document?.versions.length ?? 1}
										/>
									) : null
								}
								isLastAssistant={message.id === lastAssistantMessageId}
								isPlanMetadataPending={pendingPlanMetadataMessageIds.has(message.id)}
								isQuestionCardResolved={renderModel.isQuestionCardResolved}
								isStreaming={isStreaming}
								isThinkingLifecycleStreaming={isStreaming && message.id === streamingAssistantMessageId}
								message={message}
								onBuildPlan={onBuildPlan}
								onOpenBrowserPreview={onOpenBrowserPreview}
								onOpenPlanPreview={onOpenPlanPreview}
								onRegenerate={onRegenerate}
								onVote={onVote}
								planBuildDisabled={renderModel.planBuildDisabled}
								planBuildDisabledReason={renderModel.planBuildDisabledReason}
								renderCustomWidget={renderCustomWidget}
								shouldSuppressResolvedQuestionTrace={shouldSuppressResolvedQuestionTrace}
								treatSettledToolsAsPostResultPending={treatSettledToolsAsPostResultPending}
								unavailableProductName={unavailableProductName}
								voteValue={votes[message.id]}
							/>
							{renderAfterAssistantMessage?.({ message })}
							<AssistantSuggestionPills messageId={message.id} onSelectSuggestion={onSelectSuggestion} suggestions={renderModel.suggestions} />
						</Fragment>
					);
				})}

				{shouldShowStreamingArtifactPreview && streamingArtifact?.documentId ? (
					<StreamingArtifactMessage
						documentId={streamingArtifact.documentId}
						visualIdentity={latestPlanVisualIdentity}
						kind={streamingArtifact.kind}
						onOpenArtifactFromCard={onOpenArtifactFromCard}
						onRegisterArtifactCard={onRegisterArtifactCard}
						streamingArtifact={streamingArtifact}
						title={streamingArtifact.title}
						versionNumber={documents.find((document) => document.id === streamingArtifact.documentId)?.versions.length ?? 1}
					/>
				) : shouldShowPreloader ? (
					<RovoAppThinkingIndicator />
				) : null}
				<div aria-hidden className="h-0 shrink-0" ref={scrollSpacerRef} />
			</ConversationContent>

			<ConversationScrollButton className="z-10 transition-all" />
		</Conversation>
	);
}
