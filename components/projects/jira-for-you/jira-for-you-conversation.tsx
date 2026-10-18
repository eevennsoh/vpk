"use client";

import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import CommentIcon from "@atlaskit/icon/core/comment";
import PanelRightIcon from "@atlaskit/icon/core/panel-right";
import WorkItemIcon from "@atlaskit/icon/core/work-item";
import type { FileUIPart } from "ai";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { QuestionCard } from "@/components/blocks/question-card/components/question-card";
import type {
	QuestionCardAnswers,
	QuestionCardQuestion,
} from "@/components/blocks/question-card/types";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import type { ConversationContextValue } from "@/components/ui-custom/conversation";
import { Footer } from "@/components/ui-custom/footer";
import { ChatMessages } from "@/components/projects/shared/components/chat-messages";
import { QuestionCardShortcutsFooter } from "@/components/projects/shared/components/question-card-shortcuts-footer";
import { RovoAppComposer } from "@/components/projects/rovo/components/rovo-app-composer";
import {
	type DelegationRequest,
	useRealtimeVoice,
} from "@/components/projects/rovo/hooks/use-realtime-voice";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { JiraForYouIssueTypeIcon } from "./jira-for-you-item";
import type { JiraForYouItem } from "./jira-for-you-types";
import type {
	JiraForYouWorkspaceAgentSession,
	JiraForYouWorkspaceItemDetails,
} from "./jira-for-you-workspace-types";

const JiraForYouWorkItemView = dynamic(() =>
	import("./jira-for-you-work-item-view").then((module) => module.JiraForYouWorkItemView),
);

type JiraForYouMainView = "chat" | "work-item";

function formatQuestionCardAnswers(
	questions: readonly QuestionCardQuestion[],
	answers: QuestionCardAnswers,
): string {
	return questions.flatMap((question) => {
		const answer = answers[question.id];
		const answerIds = Array.isArray(answer) ? answer : answer ? [answer] : [];
		const labels = answerIds.map((answerId) => (
			question.options.find((option) => option.id === answerId)?.label ?? answerId
		));

		return labels.length > 0 ? labels : [];
	}).join("\n");
}

interface JiraForYouConversationProps {
	detailPanelInsetPx: number;
	details: JiraForYouWorkspaceItemDetails;
	isDetailPanelOpen: boolean;
	item: JiraForYouItem;
	onBack: () => void;
	onDetailPanelToggle: () => void;
	onSubmit: (payload: { files: FileUIPart[]; text: string }) => Promise<void>;
	selectedAgentSession: JiraForYouWorkspaceAgentSession;
	showHeaderBorder?: boolean;
	uiMessages: JiraForYouWorkspaceAgentSession["messages"];
}

export function JiraForYouConversation({
	detailPanelInsetPx,
	details,
	isDetailPanelOpen,
	item,
	onBack,
	onDetailPanelToggle,
	onSubmit,
	selectedAgentSession,
	showHeaderBorder = true,
	uiMessages,
}: Readonly<JiraForYouConversationProps>) {
	const [mainView, setMainView] = useState<JiraForYouMainView>("chat");
	const [isQuestionAnswered, setIsQuestionAnswered] = useState(false);
	const [isQuestionSubmitting, setIsQuestionSubmitting] = useState(false);
	const conversationContextRef = useRef<ConversationContextValue | null>(null);
	const scrollSpacerRef = useRef<HTMLDivElement | null>(null);
	const renderableMessages = [...uiMessages];
	const realtime = useRealtimeVoice({
		chatMessages: renderableMessages,
		isGenerating: false,
		onDelegateToRovo: useCallback((request: DelegationRequest) => {
			const text = request.prompt.trim();
			if (!text) {
				return;
			}
			void onSubmit({ files: [], text });
		}, [onSubmit]),
	});
	const handleToggleRealtimeVoice = useCallback(() => {
		if (realtime.voiceState === "idle") {
			realtime.connect();
			return;
		}

		realtime.disconnect();
	}, [realtime]);
	const conversationColumnStyle =
		detailPanelInsetPx > 0
			? { maxWidth: `calc(100% - ${detailPanelInsetPx}px)` }
			: undefined;
	const handleMainViewChange = useCallback((values: string[]) => {
		const nextView = values[0];
		if (nextView === "chat" || nextView === "work-item") {
			setMainView(nextView);
		}
	}, []);
	const awaitingQuestions = selectedAgentSession.awaitingQuestions;
	const shouldShowAwaitingQuestion = Boolean(awaitingQuestions?.length) && !isQuestionAnswered;
	const handleQuestionSubmit = useCallback(async (answers: QuestionCardAnswers) => {
		if (!awaitingQuestions?.length) {
			return;
		}

		setIsQuestionSubmitting(true);
		try {
			await onSubmit({
				files: [],
				text: formatQuestionCardAnswers(awaitingQuestions, answers),
			});
			setIsQuestionAnswered(true);
		} finally {
			setIsQuestionSubmitting(false);
		}
	}, [awaitingQuestions, onSubmit]);

	return (
		<section
			aria-label={`Conversation: ${item.title}`}
			className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
		>
			<div
				className="flex min-h-0 min-w-0 flex-1 flex-col"
				data-testid="jira-for-you-conversation-pane"
				style={conversationColumnStyle}
			>
				<header className={cn(
					"flex min-w-0 shrink-0 items-center gap-2 px-3 py-3",
					showHeaderBorder && "border-b border-border",
				)}>
					<Button
						aria-label="Back to For you feed"
						onClick={onBack}
						size="icon"
						type="button"
						variant="ghost"
					>
						<Icon aria-hidden render={<ArrowLeftIcon label="" />} />
					</Button>
					<div className="flex min-w-0 flex-1 items-center gap-2">
						{mainView === "work-item" ? (
							<>
								<JiraForYouIssueTypeIcon issueType={item.issueType} />
								<p className="truncate text-sm font-semibold text-text">
									{item.title}
								</p>
							</>
						) : (
							<>
								<AgentAvatarVisual
									avatarSrc={selectedAgentSession.profile.avatarSrc}
									brandName={selectedAgentSession.profile.brandName}
									className="size-6 object-contain"
									fallbackText={selectedAgentSession.profile.name.slice(0, 2)}
									label={selectedAgentSession.profile.name}
									logoName={selectedAgentSession.profile.logoName}
									sizePx={24}
								/>
								<p className="truncate text-sm font-semibold text-text">
									{selectedAgentSession.profile.name}
								</p>
							</>
						)}
					</div>
					<ToggleGroup
						aria-label="Workspace view"
						className="h-8 bg-surface"
						onValueChange={handleMainViewChange}
						value={[mainView]}
						variant="outline"
					>
						<ToggleGroupItem
							aria-label="Chat view"
							className="size-8 px-0 [&:not([data-pressed])_[data-slot=icon]]:text-text-subtle! [&:not([data-pressed])_svg]:text-text-subtle!"
							value="chat"
						>
							<Icon aria-hidden render={<CommentIcon label="" />} />
						</ToggleGroupItem>
						<ToggleGroupItem
							aria-label="Work item view"
							className="size-8 px-0 [&:not([data-pressed])_[data-slot=icon]]:text-text-subtle! [&:not([data-pressed])_svg]:text-text-subtle!"
							value="work-item"
						>
							<Icon aria-hidden render={<WorkItemIcon label="" />} />
						</ToggleGroupItem>
					</ToggleGroup>
					<Button
						aria-controls="jira-for-you-detail-panel"
						aria-expanded={isDetailPanelOpen}
						aria-label={isDetailPanelOpen ? "Close detail panel" : "Open detail panel"}
						className="size-8 aria-expanded:[&_[data-slot=icon]]:text-icon-selected! aria-expanded:[&_svg]:text-icon-selected!"
						onClick={onDetailPanelToggle}
						size="icon"
						type="button"
						variant="outline"
					>
						<Icon aria-hidden render={<PanelRightIcon label="" />} />
					</Button>
				</header>

				{mainView === "chat" ? (
					<>
						<ChatMessages
							contentBottomPadding="24px"
							contentClassName="mx-auto flex min-w-0 w-full max-w-[800px] px-3 md:px-6"
							contentTopPadding="16px"
							conversationContextRef={conversationContextRef}
							hideScrollbar={false}
							messageMode="ask"
							resizeTarget={shouldShowAwaitingQuestion ? "bottom" : "follow"}
							scrollSpacerRef={scrollSpacerRef}
							showAwaitingIndicator={shouldShowAwaitingQuestion}
							showFeedbackActions={false}
							showFollowUpSuggestions={false}
							uiMessages={renderableMessages}
						/>

						<div
							className="sticky bottom-0 z-10 shrink-0 bg-background"
							data-testid="jira-for-you-composer-region"
						>
							<div className="mx-auto flex min-w-0 w-full max-w-[800px] flex-col px-3 pt-3 md:px-6">
								{shouldShowAwaitingQuestion && awaitingQuestions ? (
									<>
										<QuestionCard
											customInputPlaceholder={awaitingQuestions[0]?.placeholder}
											isSubmitting={isQuestionSubmitting}
											onDismiss={() => setIsQuestionAnswered(true)}
											onSubmit={(answers) => void handleQuestionSubmit(answers)}
											questions={awaitingQuestions}
										/>
										<QuestionCardShortcutsFooter />
									</>
								) : (
									<>
										<div className="min-w-0 max-w-full" data-testid="jira-for-you-composer">
											<RovoAppComposer
												composerStatus="ready"
												hideReasoningSelector
												hideSourceAndModelControls
												micStream={realtime.micStream}
												onStop={async () => realtime.disconnect()}
												onSubmit={onSubmit}
												onToggleRealtimeVoice={handleToggleRealtimeVoice}
												placeholder={selectedAgentSession.composerPlaceholder}
												realtimeVoiceActive={realtime.voiceState !== "idle"}
												realtimeVoiceState={realtime.voiceState}
											/>
										</div>
										<div data-testid="jira-for-you-footer">
											<Footer />
										</div>
									</>
								)}
							</div>
						</div>
					</>
				) : (
					<JiraForYouWorkItemView details={details} item={item} />
				)}
			</div>
		</section>
	);
}
