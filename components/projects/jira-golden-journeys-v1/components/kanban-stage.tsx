"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CodeReview } from "@/components/blocks/code-review";
import {
	DEFAULT_PINNED_WORK_ITEM_SKILL_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
	WORK_ITEM_SKILLS,
} from "@/components/blocks/jira-work-item/lib/work-item-picker-options";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
	JiraIssueGenerativeActionRequest,
} from "@/components/blocks/jira-issue";
import {
	JiraKanban,
	type JiraKanbanCardData,
	type JiraKanbanCardMoveAnimation,
} from "@/components/blocks/jira-kanban";
import { JiraKanbanBoardHeader } from "@/components/blocks/jira-kanban/board-header";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
	filterJiraKanbanColumnsByAssignee,
	getJiraKanbanAssignees,
} from "@/components/blocks/jira-kanban/state";
import {
	JGP_CODE_REVIEW_FILES,
	JGP_CODE_REVIEW_WORK_ITEM,
	JGP_GLOBAL_KANBAN_SELECTION_AGENTS,
	JGP_KANBAN_AGENTS,
	JGP_KANBAN_DEFAULT_AGENT_ID,
	JGP_KANBAN_SELECTION_AGENTS,
	createJgpKanbanCompletionStoryColumns,
	type JgpKanbanCompletionStoryPhase,
	type JgpKanbanScenario,
} from "@/components/projects/jira-golden-journeys-v1/data/kanban-data";
import { JGP_CLAUDE_CODE_AGENT_PROFILE } from "@/components/projects/jira-golden-journeys-v1/data/agent-chat-data";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journeys-v1/hooks/use-jira-golden-journeys-v1-agent-chat-demo";
import { useJgpKanbanLifecycle } from "@/components/projects/jira-golden-journeys-v1/hooks/use-kanban-lifecycle";
import { token } from "@/lib/tokens";
import { JgpRovoOverlay } from "./jira-golden-journeys-v1-rovo-overlay";

const JGP_COMPLETION_STORY_DELAY_MS = 2_000;
const JGP_COMPLETION_SCALE_OUT_MS = 400;

function getCompletionCardMoveAnimation(
	scenario: JgpKanbanScenario,
	phase: JgpKanbanCompletionStoryPhase,
): JiraKanbanCardMoveAnimation | undefined {
	if (scenario !== "local-completed") return undefined;
	if (phase !== "departing" && phase !== "arriving") return undefined;

	return {
		cardCode: "JGP-247",
		phase,
	};
}

/**
 * The "Kanban" design pattern for the Jira Golden Journeys v1 gallery.
 *
 * Reuses the real `components/blocks/jira-kanban` board with deterministic,
 * route-owned focus-work scenarios for the gallery story.
 *
 * Layout intent: the Gallery viewport is the container. The board breaks out of
 * the stage's centered `max-w-3xl` column to span the full Gallery width
 * (`left-1/2 -translate-x-1/2 w-[100cqw]`) and fills the available stage height.
 * The pinned dock floats over the board's lower portion via its backdrop blur
 * (the gallery's "content flows under the dock" effect). Columns flow to fill
 * the width and scroll their own cards.
 *
 * The arbitrary variants complete the board's flex-column height chain (its
 * shared root is only `flex-1 min-h-0`, so its inner section would otherwise
 * grow to content height) — scoped here so the /jira board and the block demo
 * keep their existing behavior.
 */
interface KanbanStageProps {
	scenario?: JgpKanbanScenario;
}

export function KanbanStage({ scenario = "local-review" }: Readonly<KanbanStageProps>): React.ReactElement {
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useJgpAgentChatDemo();
	const [pendingChatQuestion, setPendingChatQuestion] = useState<Readonly<{ submit: () => void }> | null>(null);
	const [isCodeReviewOpen, setCodeReviewOpen] = useState(false);
	const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(() => new Set());
	const [completionStoryPhase, setCompletionStoryPhase] = useState<JgpKanbanCompletionStoryPhase>(
		scenario === "local-completed" ? "in-progress" : "done",
	);
	const openCardChat = useCallback((agentId: string, agentName: string, card: JiraKanbanCardData, request?: string) => {
		openAgentChat({
			agentId,
			agentName,
			issueKey: card.code,
			issueSummary: card.title,
			request,
		});
	}, [openAgentChat]);
	const handleNonAgentAction = useCallback((request: JiraIssueGenerativeActionRequest, card: JiraKanbanCardData) => {
		setPendingChatQuestion(null);
		openCardChat(
			JGP_KANBAN_DEFAULT_AGENT_ID,
			"Claude",
			card,
			request.prompt,
		);
	}, [openCardChat]);
	const {
		boardColumns,
		draggedCardCode,
		handleCardDragEnd,
		handleCardDragStart,
		handleCardDrop,
		handleCardClick,
		handleCardSelect,
		handleGenerativeActionSubmit,
		handleQuestionSubmit,
		handleStatusChange,
		handleAgentAssignmentChange,
		handleClearSelection,
		selectedAgentIds,
		selectedCardCodes,
	} = useJgpKanbanLifecycle({ onNonAgentAction: handleNonAgentAction, scenario });
	useEffect(() => {
		if (scenario !== "local-completed") return;
		let moveTimer: number | undefined;
		let departureFrame: number | undefined;
		let arrivalFrame: number | undefined;
		const departureTimer = window.setTimeout(() => {
			setCompletionStoryPhase("departing");
			departureFrame = window.requestAnimationFrame(() => {
				moveTimer = window.setTimeout(() => {
					setCompletionStoryPhase("arriving");
					arrivalFrame = window.requestAnimationFrame(() => setCompletionStoryPhase("done"));
				}, JGP_COMPLETION_SCALE_OUT_MS);
			});
		}, JGP_COMPLETION_STORY_DELAY_MS);
		return () => {
			window.clearTimeout(departureTimer);
			if (moveTimer !== undefined) window.clearTimeout(moveTimer);
			if (departureFrame !== undefined) window.cancelAnimationFrame(departureFrame);
			if (arrivalFrame !== undefined) window.cancelAnimationFrame(arrivalFrame);
		};
	}, [scenario]);
	const storyBoardColumns = useMemo(
		() => scenario === "local-completed"
			? createJgpKanbanCompletionStoryColumns(completionStoryPhase)
			: boardColumns,
		[boardColumns, completionStoryPhase, scenario],
	);
	const assignees = useMemo(() => getJiraKanbanAssignees(storyBoardColumns), [storyBoardColumns]);
	const filteredBoardColumns = useMemo(
		() => filterJiraKanbanColumnsByAssignee(storyBoardColumns, selectedAssigneeIds),
		[selectedAssigneeIds, storyBoardColumns],
	);
	const completionCardMoveAnimation = getCompletionCardMoveAnimation(scenario, completionStoryPhase);
	const handleAssigneeFilterChange = useCallback((assigneeIds: Set<string>) => {
		handleClearSelection();
		handleCardDragEnd();
		setSelectedAssigneeIds(assigneeIds);
	}, [handleCardDragEnd, handleClearSelection]);
	const handleFilteredCardSelect = useCallback((
		cardCode: string,
		columnTitle: string,
		indexInColumn: number,
		modifiers: Parameters<typeof handleCardSelect>[3],
	) => {
		handleCardSelect(cardCode, columnTitle, indexInColumn, modifiers, filteredBoardColumns);
	}, [filteredBoardColumns, handleCardSelect]);
	const handleViewChat = useCallback((activity: JiraIssueAgentActivity, card: JiraKanbanCardData) => {
		setPendingChatQuestion(activity.question ? {
			submit: () => handleQuestionSubmit(activity, {}, card),
		} : null);
		openAgentChat({
			agentId: activity.id,
			agentName: activity.name,
			issueKey: card.code,
			issueSummary: card.title,
			intro: activity.message,
			question: activity.question,
		});
	}, [handleQuestionSubmit, openAgentChat]);
	const handleCompletedAgentView = useCallback((
		run: JiraIssueCompletedAgentRun,
		card: JiraKanbanCardData,
	) => {
		if (run.actionLabel !== "View") return;

		const artifact = run.outputs?.[0];
		const artifactSummary = artifact
			? `The **${artifact.title}** ${artifact.owner?.toLowerCase() ?? "artifact"} is ready in ${artifact.source}.`
			: "The completed work is ready to review from the Jira work item.";

		setPendingChatQuestion(null);
		openAgentChat({
			agentId: run.agentName.toLowerCase().replaceAll(" ", "-"),
			agentName: run.agentName,
			issueKey: card.code,
			issueSummary: card.title,
			request: `Show me what you completed for ${card.code}.`,
			result: [
				`I completed **${run.summary.toLowerCase()}** for **${card.code}**.`,
				run.description ?? artifactSummary,
				artifactSummary,
			].join("\n\n"),
		});
	}, [openAgentChat]);
	const handleChatQuestionAnswer = useCallback(() => {
		pendingChatQuestion?.submit();
		setPendingChatQuestion(null);
	}, [pendingChatQuestion]);
	const handleReviewSubmit = useCallback(() => {
		setCodeReviewOpen(false);
	}, []);

	return (
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 flex-col px-8 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div>section]:flex [&>div>section]:min-h-0">
			<JiraKanbanBoardHeader
				assignees={assignees}
				onSelectedAssigneeIdsChange={handleAssigneeFilterChange}
				selectedAssigneeIds={selectedAssigneeIds}
			/>
			<JiraKanban
				agents={JGP_KANBAN_AGENTS}
				animateCardMoves={scenario === "local-completed"}
				ariaLabel="Jira board focus work. Assign a coding agent or drag To do cards into In progress to start work."
				boardColumns={filteredBoardColumns}
				cardMoveAnimation={completionCardMoveAnimation}
				draggedCardCode={draggedCardCode}
				onCardAgentActivityViewChat={handleViewChat}
				onCardAgentDoneRunReview={(_run, card) => {
					if (card.code === "JGP-247") setCodeReviewOpen(true);
				}}
				onCardAgentDoneRunView={handleCompletedAgentView}
				onCardDragEnd={handleCardDragEnd}
				onCardDragStart={handleCardDragStart}
				onCardDrop={handleCardDrop}
				onCardClick={handleCardClick}
				onCardGenerativeActionSubmit={handleGenerativeActionSubmit}
				onCardSelect={handleFilteredCardSelect}
				paddingBottom={token("space.200")}
				paddingTop={0}
				selectedCardCodes={selectedCardCodes}
				selectionToolbar={{
					agents: scenario === "global-assignment"
						? JGP_GLOBAL_KANBAN_SELECTION_AGENTS
						: JGP_KANBAN_SELECTION_AGENTS,
					defaultPinnedAgentIds: ["claude-code", "cursor"],
					...(scenario === "global-assignment"
						? {
								defaultPinnedSkillIds: DEFAULT_PINNED_WORK_ITEM_SKILL_IDS,
								pinnedItemsLabel: WORK_ITEM_PINNED_ITEMS_LABEL,
								skills: WORK_ITEM_SKILLS,
							}
						: {}),
					onAgentAssignmentChange: handleAgentAssignmentChange,
					onClearSelection: handleClearSelection,
					onStatusChange: handleStatusChange,
					selectedAgentIds,
				}}
			/>
			<CodeReview
				agentProfile={JGP_CLAUDE_CODE_AGENT_PROFILE}
				agentVariant="third-party-local"
				explorerRootLabel="jira"
				files={JGP_CODE_REVIEW_FILES}
				hideComposerSourceAndModelControls
				onOpenChange={setCodeReviewOpen}
				onPrimaryAction={() => setCodeReviewOpen(false)}
				onReviewSubmit={handleReviewSubmit}
				open={isCodeReviewOpen}
				primaryActionLabel="Merge pull request"
				primaryActionMenu={
					<>
						<DropdownMenuItem>Close pull request</DropdownMenuItem>
						<DropdownMenuItem>Convert to draft pull request</DropdownMenuItem>
					</>
				}
				workItem={JGP_CODE_REVIEW_WORK_ITEM}
			/>
			<JgpRovoOverlay
				chatContextBar={chatContextBar}
				externalThinkingMessageId={externalThinkingMessageId}
				onQuestionAnswer={pendingChatQuestion ? handleChatQuestionAnswer : undefined}
			/>
		</div>
	);
}
