"use client";

import ChangesIcon from "@atlaskit/icon/core/changes";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ProjectStatusIcon from "@atlaskit/icon/core/project-status";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FileUIPart } from "ai";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { QuestionCard } from "@/components/blocks/question-card/components/question-card";
import type { QuestionCardAnswers } from "@/components/blocks/question-card/types";
import type { ConversationContextValue } from "@/components/ui-custom/conversation";
import {
	ContextBarPill,
	ContextBarTagGroup,
} from "@/components/ui-custom/context-bar";
import { ChatMessages } from "@/components/projects/shared/components/chat-messages";
import ChatContextBar from "@/components/projects/shared/components/chat-context-bar";
import { QuestionCardShortcutsFooter } from "@/components/projects/shared/components/question-card-shortcuts-footer";
import { RovoAppComposer } from "@/components/projects/rovo/components/rovo-app-composer";
import type { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import {
	type DelegationRequest,
	useRealtimeVoice,
} from "@/components/projects/rovo/hooks/use-realtime-voice";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Footer } from "@/components/ui-custom/footer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lozenge } from "@/components/ui/lozenge";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import type { AsxQueueJiraColumn, AsxQueueSession } from "../data/queue-sessions";
import { QueueConversationHeader } from "./queue-conversation-header";
import { QueueDetailPanel } from "./queue-detail-panel";
import { motionEase } from "@/lib/motion";

const CHAT_BODY_OPEN_TRANSITION: Transition = {
	duration: 0.25,
	ease: motionEase.inOut, // duration-slow + ease-in-out
};
const CHAT_BODY_CLOSE_TRANSITION: Transition = {
	duration: 0.2,
	ease: motionEase.in, // duration-medium + ease-in
};
const CHAT_BODY_REDUCED_MOTION_TRANSITION: Transition = { duration: 0 };
const QUEUE_JIRA_COLUMNS: readonly AsxQueueJiraColumn[] = [
	"To do",
	"In progress",
	"In review",
	"Done",
];
const QUEUE_JIRA_COLUMN_VARIANTS = {
	"To do": "neutral",
	"In progress": "information",
	"In review": "information",
	Done: "success",
} as const;

interface QueueConversationWorkspaceProps {
	agent: RovoAgentProfile;
	/**
	 * Detail-panel resize state, owned by the persistent QueueStage. The workspace
	 * remounts on `key={activeSession.id}`, so a locally-owned resize hook would
	 * reset its width on every session switch; keeping it in the stage lets the
	 * dragged width persist across switches (and still reset on refresh / double-click).
	 */
	detailPanelResize: ReturnType<typeof useSidebarResize>;
	isDetailPanelOpen: boolean;
	onAnswerQuestion: (answers: QuestionCardAnswers) => Promise<void> | void;
	onDetailPanelOpenChange: (open: boolean) => void;
	onDismissFileChanges: () => void;
	onJiraColumnChange: (column: AsxQueueJiraColumn) => void;
	onSubmit: (payload: { files: FileUIPart[]; text: string }) => Promise<void>;
	session: AsxQueueSession;
}

interface QueueSessionContextBarProps extends Pick<
	QueueConversationWorkspaceProps,
	"onDismissFileChanges" | "onJiraColumnChange" | "session"
> {
	compact?: boolean;
}

export function QueueSessionContextBar({
	compact = false,
	onDismissFileChanges,
	onJiraColumnChange,
	session,
}: Readonly<QueueSessionContextBarProps>) {
	const fileChanges = session.fileChanges?.isDismissed ? undefined : session.fileChanges;
	const shouldShowJiraColumn = session.status === "pr-open";

	if (!fileChanges && !shouldShowJiraColumn) return null;

	const items = [];
	if (fileChanges) {
		items.push({
			id: "changes",
			label: `Dismiss changes: +${fileChanges.additions} -${fileChanges.deletions}`,
			icon: <ChangesIcon label="" size="small" />,
			onSelect: onDismissFileChanges,
			content: (
				<ContextBarPill
					aria-label="Dismiss file changes"
					className={compact ? "px-2" : undefined}
					icon={<ChangesIcon color="currentColor" label="" size="small" />}
					onClick={onDismissFileChanges}
					title={fileChanges.files.join("\n")}
				>
					Changes:
					<span className="inline-flex items-center gap-0.5">
						<span className="font-mono font-normal text-text-success">+{fileChanges.additions}</span>
						<span className="font-mono font-normal text-text-danger">-{fileChanges.deletions}</span>
					</span>
				</ContextBarPill>
			),
		});
	}
	if (shouldShowJiraColumn) {
		items.push({
			id: "jira-column",
			label: `Move to ${session.jiraColumn}`,
			icon: <ProjectStatusIcon label="" size="small" />,
			onSelect: () => onJiraColumnChange(session.jiraColumn),
			content: (
				<ContextBarPill
					className={compact ? "gap-2 px-2" : "gap-2 pr-2"}
					icon={<ProjectStatusIcon color="currentColor" label="" size="small" />}
					interactive={false}
				>
					Move to:
					<ButtonGroup aria-label="Move Jira issue" variant="split">
						<Button
							aria-label={`Move Jira issue to ${session.jiraColumn}`}
							onClick={() => onJiraColumnChange(session.jiraColumn)}
							size="compact"
							variant="outline"
						>
							{session.jiraColumn}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={<Button aria-label="Choose Jira column" size="icon-compact" variant="outline" />}
							>
								<ChevronDownIcon label="" size="small" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-44" side="top">
								<DropdownMenuGroup>
									{QUEUE_JIRA_COLUMNS.map((column) => (
										<DropdownMenuItem
											key={column}
											onSelect={() => onJiraColumnChange(column)}
										>
											<Lozenge className="pointer-events-none" variant={QUEUE_JIRA_COLUMN_VARIANTS[column]}>
												{column}
											</Lozenge>
										</DropdownMenuItem>
									))}
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</ButtonGroup>
				</ContextBarPill>
			),
		});
	}

	return (
		<ContextBarTagGroup
			className="mb-3 w-full"
			items={items}
			overflowAriaLabel="Show more session actions"
		/>
	);
}

export function QueueConversationWorkspace({
	agent,
	detailPanelResize,
	isDetailPanelOpen,
	onAnswerQuestion,
	onDetailPanelOpenChange,
	onDismissFileChanges,
	onJiraColumnChange,
	onSubmit,
	session,
}: Readonly<QueueConversationWorkspaceProps>) {
	const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
	const conversationContextRef = useRef<ConversationContextValue | null>(null);
	const scrollSpacerRef = useRef<HTMLDivElement | null>(null);
	const shouldReduceMotion = useReducedMotion();
	const awaitingQuestion = session.status === "awaiting-input" ? session.question : undefined;
	const realtime = useRealtimeVoice({
		chatMessages: session.messages,
		isGenerating: false,
		onDelegateToRovo: useCallback((request: DelegationRequest) => {
			const text = request.prompt.trim();
			if (!text) return;
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
	const handleAnswerQuestion = useCallback(async (answers: QuestionCardAnswers) => {
		setIsSubmittingAnswer(true);

		try {
			await onAnswerQuestion(answers);
		} catch {
			setIsSubmittingAnswer(false);
		}
	}, [onAnswerQuestion]);
	useEffect(() => {
		if (!awaitingQuestion) return;

		const frameId = window.requestAnimationFrame(() => {
			void conversationContextRef.current?.scrollToBottom({
				animation: false,
				ignoreEscapes: true,
				target: "bottom",
			});
		});

		return () => window.cancelAnimationFrame(frameId);
	}, [awaitingQuestion]);

	const chatBodyTransition = shouldReduceMotion || detailPanelResize.isResizing
		? CHAT_BODY_REDUCED_MOTION_TRANSITION
		: isDetailPanelOpen
			? CHAT_BODY_OPEN_TRANSITION
			: CHAT_BODY_CLOSE_TRANSITION;
	const composerPlaceholder = session.status === "stopped"
		? "Resume this session"
		: session.status === "pr-open"
			? session.pullRequestNumber
				? `Ask about pull request #${session.pullRequestNumber}`
				: "Ask about the pull request"
			: session.status === "merged"
				? "Ask about the merged changes"
				: `Message ${agent.name}`;

	return (
		<div className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background text-foreground">
			<section
				aria-label={`Conversation: ${session.title}`}
				className="flex min-h-0 min-w-0 flex-1 flex-col"
				data-testid="asx-queue-conversation"
			>
				<QueueConversationHeader
					agent={agent}
					isDetailPanelOpen={isDetailPanelOpen}
					onDetailPanelToggle={() => onDetailPanelOpenChange(!isDetailPanelOpen)}
				/>
				<motion.div
					className="flex min-h-0 w-full flex-1 flex-col"
					data-testid="asx-queue-chat-body"
					initial={false}
					layout
					style={{ paddingRight: isDetailPanelOpen ? detailPanelResize.sidebarWidth : 0, willChange: shouldReduceMotion ? undefined : "transform" }}
					transition={chatBodyTransition}
				>
					<ChatMessages
						contentClassName="mx-auto max-w-[800px] px-6"
						contentBottomPadding="32px"
						contentTopPadding="32px"
						conversationContextRef={conversationContextRef}
						hideScrollbar={false}
						isStreaming={session.status === "running"}
						messageMode="ask"
						resizeTarget={awaitingQuestion ? "bottom" : "follow"}
						scrollSpacerRef={scrollSpacerRef}
						showAwaitingIndicator={Boolean(awaitingQuestion)}
						showFeedbackActions={false}
						showFollowUpSuggestions={false}
						uiMessages={session.messages}
					/>
					<div className="sticky bottom-0 z-10 shrink-0 bg-background/90 backdrop-blur">
						<div className="mx-auto w-full max-w-[800px] px-3">
							{awaitingQuestion ? (
								<>
									<QuestionCard
										isSubmitting={isSubmittingAnswer}
										onSubmit={(answers) => void handleAnswerQuestion(answers)}
										questions={awaitingQuestion.questions}
									/>
									<QuestionCardShortcutsFooter />
								</>
							) : (
								<>
									{session.status === "running" ? (
										<div className="mb-3">
											<ChatContextBar
												context={{
													iconName: "work-item",
													label: `${session.issueKey}: ${session.issueSummary}`,
													showDismissPlaceholder: false,
													signature: `asx-queue-work-item:${session.issueKey}`,
												}}
											/>
										</div>
									) : null}
									<QueueSessionContextBar
										onDismissFileChanges={onDismissFileChanges}
										onJiraColumnChange={onJiraColumnChange}
										session={session}
									/>
									<RovoAppComposer
										composerStatus="ready"
										experimentalDarkCta
										hideSourceAndModelControls
										micStream={realtime.micStream}
										onStop={async () => realtime.disconnect()}
										onSubmit={onSubmit}
										onToggleRealtimeVoice={handleToggleRealtimeVoice}
										placeholder={composerPlaceholder}
										realtimeVoiceActive={realtime.voiceState !== "idle"}
										realtimeVoiceState={realtime.voiceState}
									/>
									<Footer />
								</>
							)}
						</div>
					</div>
				</motion.div>
			</section>
			<AnimatePresence initial={false}>
				{isDetailPanelOpen ? (
					<QueueDetailPanel
						key="detail-panel"
						onClose={() => onDetailPanelOpenChange(false)}
						resize={detailPanelResize}
						session={session}
					/>
				) : null}
			</AnimatePresence>
		</div>
	);
}
