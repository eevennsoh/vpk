"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { ROVO_AGENT_ID } from "@/app/data/directory";
import {
	JiraIssue,
	type JiraIssueAgentActivity,
	type JiraIssueAgentActivityMode,
	type JiraIssueGenerativeActionRequest,
} from "@/components/blocks/jira-issue";
import {
	JGP_CARD_KANBAN_AWAITING_ACTIVITIES,
	JGP_CARD_KANBAN_CARD,
	JGP_CARD_KANBAN_DONE_RUNS,
	JGP_CARD_KANBAN_STATES,
	JGP_CARD_KANBAN_SUBTASKS,
	JGP_CARD_KANBAN_WORKING_ACTIVITIES,
} from "@/components/projects/jira-golden-journey-v1/data/card-kanban-data";
import {
	createJgpKanbanActivity,
	getJgpGenerativeAgentSelection,
} from "@/components/projects/jira-golden-journey-v1/data/kanban-data";
import type { UseAutoCycleResult } from "@/components/projects/jira-golden-journey-v1/hooks/use-auto-cycle";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { JgpRovoOverlay } from "./jira-golden-journey-v1-rovo-overlay";

/**
 * The "Card Kanban" design pattern for the Jira Golden Journey v1 gallery.
 *
 * A single `components/blocks/jira-issue` card that transitions across the
 * "Agent activity states" — default, one agent working, multiple agents
 * working, an agent awaiting input, and completed agent work. The compact tab
 * bar above it auto-cycles through the states by default (reusing the
 * `components/blocks/agent-bento` auto-cycling category bar: a linear progress
 * fill sweeps the active tab, then advances). Hovering or focusing the demo
 * pauses the cycle; clicking a tab selects that state and restarts it. The card
 * animates between states. The agent-row "View" action and Ask Rovo open
 * floating chat; selecting a skill or custom agent adds a working activity row.
 *
 * Layout mirrors `KanbanStage`: the stage breaks out of the gallery's centered
 * `max-w-3xl` column to span the full viewport and fills the Gallery's available
 * stage height while the pinned dock floats over the lower portion.
 */
interface CardKanbanControlsProps {
	controller: UseAutoCycleResult;
	showProgress?: boolean;
}

export function CardKanbanControls({
	controller,
	showProgress = true,
}: Readonly<CardKanbanControlsProps>): React.ReactElement {
	const { activeIndex, setActiveIndex, progress, cycleRunning, pauseHandlers } = controller;

	return (
		<ButtonGroup
			variant="connected"
			{...pauseHandlers}
		>
			{JGP_CARD_KANBAN_STATES.map((option, index) => {
				const isActive = index === activeIndex;
				const showProgressFill = showProgress && isActive && cycleRunning;
				return (
					<Button
						key={option.value}
						type="button"
						variant="outline"
						size="compact"
						aria-pressed={isActive}
						onClick={() => setActiveIndex(index)}
						className="relative isolate overflow-hidden aria-pressed:-ml-px aria-pressed:border-l! aria-pressed:z-10"
					>
						<span className="relative z-[2]">{option.label}</span>
						{showProgressFill ? (
							<motion.span
								aria-hidden
								className="pointer-events-none absolute inset-0 z-[1] origin-left bg-bg-selected-hovered"
								style={{ scaleX: progress, willChange: "transform" }}
							/>
						) : null}
					</Button>
				);
			})}
		</ButtonGroup>
	);
}

interface CardKanbanStageProps {
	controller: UseAutoCycleResult;
}

export function CardKanbanStage({ controller }: Readonly<CardKanbanStageProps>): React.ReactElement {
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useJgpAgentChatDemo();
	const completionTimeoutRef = useRef<number | null>(null);
	const [addedAgentActivities, setAddedAgentActivities] = useState<readonly JiraIssueAgentActivity[]>([]);
	const [pendingChatQuestion, setPendingChatQuestion] = useState<{ submit: () => void } | null>(null);
	const {
		activeIndex,
		pauseHandlers,
		setActiveIndex,
		setExternalInteractionActive,
	} = controller;
	const state = JGP_CARD_KANBAN_STATES[activeIndex].value;

	useEffect(() => () => {
		if (completionTimeoutRef.current !== null) {
			window.clearTimeout(completionTimeoutRef.current);
		}
	}, []);

	const presetAgentActivities =
		state === "single-agent-working"
			? JGP_CARD_KANBAN_WORKING_ACTIVITIES.slice(0, 1)
			: state === "multiple-agents-working"
				? JGP_CARD_KANBAN_WORKING_ACTIVITIES.slice(0, 2)
				: state === "awaiting-user-input"
					? JGP_CARD_KANBAN_AWAITING_ACTIVITIES
					: undefined;
	const agentActivities: JiraIssueAgentActivity[] = [...(presetAgentActivities ?? [])];
	for (const activity of addedAgentActivities) {
		if (!agentActivities.some((candidate) => candidate.id === activity.id)) {
			agentActivities.push(activity);
		}
	}

	const agentActivityMode: JiraIssueAgentActivityMode =
		state === "awaiting-user-input"
			? "awaiting-input"
			: agentActivities.length > 0
				? "working"
				: state === "agent-completed-work"
					? "completed"
					: "none";

	const handleQuestionSubmit = useCallback(() => {
		if (completionTimeoutRef.current !== null) {
			window.clearTimeout(completionTimeoutRef.current);
		}
		setExternalInteractionActive(false);
		setActiveIndex(1);
		completionTimeoutRef.current = window.setTimeout(() => {
			setActiveIndex(4);
			completionTimeoutRef.current = null;
		}, 2_500);
	}, [setActiveIndex, setExternalInteractionActive]);

	/**
	 * The agent row no longer answers clarifications inline, so an awaiting-input
	 * activity hands its question to floating chat and advances the story only
	 * once the viewer answers there.
	 */
	const handleViewChat = useCallback((activity: JiraIssueAgentActivity) => {
		setPendingChatQuestion(activity.question ? { submit: handleQuestionSubmit } : null);
		if (activity.question) {
			openAgentChat({
				agentId: activity.id,
				agentName: activity.name,
				issueKey: JGP_CARD_KANBAN_CARD.issueKey,
				issueSummary: JGP_CARD_KANBAN_CARD.summary,
				intro: activity.message,
				question: activity.question,
			});
			return;
		}
		openAgentChat({
			agentId: activity.id,
			agentName: activity.name,
			issueKey: JGP_CARD_KANBAN_CARD.issueKey,
			issueSummary: JGP_CARD_KANBAN_CARD.summary,
			request: `Show me your progress on ${JGP_CARD_KANBAN_CARD.issueKey}.`,
		});
	}, [handleQuestionSubmit, openAgentChat]);

	const handleChatQuestionAnswer = useCallback(() => {
		pendingChatQuestion?.submit();
		setPendingChatQuestion(null);
	}, [pendingChatQuestion]);

	const handleGenerativeActionSubmit = useCallback(
		(request: JiraIssueGenerativeActionRequest) => {
			if (request.kind === "ask-rovo") {
				openAgentChat({
					agentId: ROVO_AGENT_ID,
					agentName: "Rovo",
					issueKey: request.issue.issueKey,
					issueSummary: request.issue.summary,
					request: request.prompt,
				});
				return;
			}

			const selection = getJgpGenerativeAgentSelection(request);
			const activity = createJgpKanbanActivity(selection.id, selection);
			setAddedAgentActivities((current) => current.some((candidate) => candidate.id === activity.id)
				? current
				: [...current, activity]);
		},
		[openAgentChat],
	);

	return (
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 flex-col px-8">
			<div className="flex flex-1 flex-col items-center justify-center pb-28">
				{/* Tight wrapper so hover/focus only pauses the cycle over the card. */}
				<div className="flex flex-col items-center" {...pauseHandlers}>
					{/*
					 * Reserve the default card height so the demo reads as centered at
					 * rest while the toggle bar + card top stay anchored: taller states
					 * (agent rows, "Agent done") overflow downward instead of
					 * re-centering the group and shoving the toggle bar upward.
					 */}
					<div className="h-[149px] w-[280px]">
						<JiraIssue appearance="default"
							agentActivities={agentActivities}
							agentActivityMode={agentActivityMode}
							agentDoneRuns={state === "agent-completed-work" ? JGP_CARD_KANBAN_DONE_RUNS : undefined}
							assigneeAvatarSrc={JGP_CARD_KANBAN_CARD.assigneeAvatarSrc}
							className="w-full"
							generativeAction={{ onSubmit: handleGenerativeActionSubmit }}
							issueKey={JGP_CARD_KANBAN_CARD.issueKey}
							onAgentActivityOpenChange={setExternalInteractionActive}
							onAgentActivityViewChat={handleViewChat}
							priority={JGP_CARD_KANBAN_CARD.priority}
							subtasks={JGP_CARD_KANBAN_SUBTASKS}
							subtasksCompleted={0}
							summary={JGP_CARD_KANBAN_CARD.summary}
							tags={JGP_CARD_KANBAN_CARD.tags}
						/>
					</div>
				</div>
			</div>
			<JgpRovoOverlay
				chatContextBar={chatContextBar}
				externalThinkingMessageId={externalThinkingMessageId}
				onQuestionAnswer={pendingChatQuestion ? handleChatQuestionAnswer : undefined}
			/>
		</div>
	);
}
