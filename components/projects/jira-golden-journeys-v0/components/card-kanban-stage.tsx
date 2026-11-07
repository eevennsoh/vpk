"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ROVO_AGENT_ID } from "@/app/data/directory";
import {
	JiraIssue,
	type JiraIssueAgentActivity,
	type JiraIssueAgentActivityMode,
	type JiraIssueGenerativeActionRequest,
} from "@/components/blocks/jira-issue";
import {
	ASX_CARD_KANBAN_AWAITING_ACTIVITIES,
	ASX_CARD_KANBAN_CARD,
	ASX_CARD_KANBAN_DONE_RUNS,
	ASX_CARD_KANBAN_STATES,
	ASX_CARD_KANBAN_SUBTASKS,
	ASX_CARD_KANBAN_WORKING_ACTIVITIES,
} from "@/components/projects/jira-golden-journeys-v0/data/card-kanban-data";
import {
	createAsxKanbanActivity,
	getAsxGenerativeAgentSelection,
} from "@/components/projects/jira-golden-journeys-v0/data/kanban-data";
import type { UseAutoCycleResult } from "@/components/projects/jira-golden-journeys-v0/hooks/use-auto-cycle";
import { useAsxAgentChatDemo } from "@/components/projects/jira-golden-journeys-v0/hooks/use-jira-golden-journeys-v0-agent-chat-demo";
import { AsxRovoOverlay } from "./jira-golden-journeys-v0-rovo-overlay";

/**
 * The "Card Kanban" design pattern for the Jira Golden Journeys v0 gallery.
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
interface CardKanbanStageProps {
	controller: UseAutoCycleResult;
}

export function CardKanbanStage({ controller }: Readonly<CardKanbanStageProps>): React.ReactElement {
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useAsxAgentChatDemo();
	const completionTimeoutRef = useRef<number | null>(null);
	const [addedAgentActivities, setAddedAgentActivities] = useState<readonly JiraIssueAgentActivity[]>([]);
	const [pendingChatQuestion, setPendingChatQuestion] = useState<{ submit: () => void } | null>(null);
	const {
		activeIndex,
		pauseHandlers,
		setActiveIndex,
		setExternalInteractionActive,
	} = controller;
	const state = ASX_CARD_KANBAN_STATES[activeIndex].value;

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			if (target !== document.body && !target.matches('[aria-label="Select Card kanban"]') && !target.closest("[data-card-kanban-navigation]")) return;
			const nextIndex = activeIndex + (event.key === "ArrowRight" ? 1 : -1);
			if (nextIndex < 0 || nextIndex >= ASX_CARD_KANBAN_STATES.length) return;
			event.preventDefault();
			setActiveIndex(nextIndex);
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [activeIndex, setActiveIndex]);

	useEffect(() => () => {
		if (completionTimeoutRef.current !== null) {
			window.clearTimeout(completionTimeoutRef.current);
		}
	}, []);

	const presetAgentActivities =
		state === "single-agent-working"
			? ASX_CARD_KANBAN_WORKING_ACTIVITIES.slice(0, 1)
			: state === "multiple-agents-working"
				? ASX_CARD_KANBAN_WORKING_ACTIVITIES.slice(0, 2)
				: state === "awaiting-user-input"
					? ASX_CARD_KANBAN_AWAITING_ACTIVITIES
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
				issueKey: ASX_CARD_KANBAN_CARD.issueKey,
				issueSummary: ASX_CARD_KANBAN_CARD.summary,
				intro: activity.message,
				question: activity.question,
			});
			return;
		}
		openAgentChat({
			agentId: activity.id,
			agentName: activity.name,
			issueKey: ASX_CARD_KANBAN_CARD.issueKey,
			issueSummary: ASX_CARD_KANBAN_CARD.summary,
			request: `Show me your progress on ${ASX_CARD_KANBAN_CARD.issueKey}.`,
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

			const selection = getAsxGenerativeAgentSelection(request);
			const activity = createAsxKanbanActivity(selection.id, false, selection);
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
							agentDoneRuns={state === "agent-completed-work" ? ASX_CARD_KANBAN_DONE_RUNS : undefined}
							assigneeAvatarSrc={ASX_CARD_KANBAN_CARD.assigneeAvatarSrc}
							className="w-full"
							generativeAction={{ onSubmit: handleGenerativeActionSubmit }}
							issueKey={ASX_CARD_KANBAN_CARD.issueKey}
							onAgentActivityOpenChange={setExternalInteractionActive}
							onAgentActivityViewChat={handleViewChat}
							priority={ASX_CARD_KANBAN_CARD.priority}
							subtasks={ASX_CARD_KANBAN_SUBTASKS}
							subtasksCompleted={0}
							summary={ASX_CARD_KANBAN_CARD.summary}
							tags={ASX_CARD_KANBAN_CARD.tags}
						/>
					</div>
				</div>
			</div>
			<AsxRovoOverlay
				chatContextBar={chatContextBar}
				externalThinkingMessageId={externalThinkingMessageId}
				onQuestionAnswer={pendingChatQuestion ? handleChatQuestionAnswer : undefined}
			/>
		</div>
	);
}
