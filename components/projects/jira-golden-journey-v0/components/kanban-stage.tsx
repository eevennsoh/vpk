"use client";

import { useCallback, useMemo, useState } from "react";

import type { JiraIssueAgentActivity, JiraIssueGenerativeActionRequest } from "@/components/blocks/jira-issue";
import { JiraKanban, type JiraKanbanCardData } from "@/components/blocks/jira-kanban";
import { JiraKanbanBoardHeader } from "@/components/blocks/jira-kanban/board-header";
import {
	filterJiraKanbanColumnsByAssignee,
	getJiraKanbanAssignees,
} from "@/components/blocks/jira-kanban/state";
import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import {
	DEFAULT_PINNED_SPACE_AGENT_IDS,
	DEFAULT_PINNED_WORK_ITEM_SKILL_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
	WORK_ITEM_SKILLS,
} from "@/components/blocks/jira-work-item/lib/work-item-picker-options";
import { ASX_KANBAN_AGENTS, ASX_KANBAN_DEFAULT_AGENT_ID } from "@/components/projects/jira-golden-journey-v0/data/kanban-data";
import { useAsxAgentChatDemo } from "@/components/projects/jira-golden-journey-v0/hooks/use-jira-golden-journey-v0-agent-chat-demo";
import { useAsxKanbanLifecycle } from "@/components/projects/jira-golden-journey-v0/hooks/use-kanban-lifecycle";
import { token } from "@/lib/tokens";
import { AsxRovoOverlay } from "./jira-golden-journey-v0-rovo-overlay";

/**
 * The "Kanban" design pattern for the Jira Golden Journey v0 gallery.
 *
 * Reuses the real `components/blocks/jira-kanban` board verbatim (same sample
 * columns + agents as the block's own demo), shown read-only in the gallery
 * stage when the Kanban card is selected.
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
export function KanbanStage(): React.ReactElement {
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useAsxAgentChatDemo();
	const [pendingChatQuestion, setPendingChatQuestion] = useState<Readonly<{ submit: () => void }> | null>(null);
	const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(() => new Set());
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
			ASX_KANBAN_DEFAULT_AGENT_ID,
			"RFP Drafter",
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
	} = useAsxKanbanLifecycle({ onNonAgentAction: handleNonAgentAction });
	const assignees = useMemo(() => getJiraKanbanAssignees(boardColumns), [boardColumns]);
	const filteredBoardColumns = useMemo(
		() => filterJiraKanbanColumnsByAssignee(boardColumns, selectedAssigneeIds),
		[boardColumns, selectedAssigneeIds],
	);
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
	const handleChatQuestionAnswer = useCallback(() => {
		pendingChatQuestion?.submit();
		setPendingChatQuestion(null);
	}, [pendingChatQuestion]);

	return (
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 flex-col px-8 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col [&>div>section]:flex [&>div>section]:min-h-0">
			<JiraKanbanBoardHeader
				assignees={assignees}
				onSelectedAssigneeIdsChange={handleAssigneeFilterChange}
				selectedAssigneeIds={selectedAssigneeIds}
			/>
			<JiraKanban variant="standard"
				agents={ASX_KANBAN_AGENTS}
				ariaLabel="RFP board columns. Assign agents or drag Intake cards into Drafting to start work."
				boardColumns={filteredBoardColumns}
				draggedCardCode={draggedCardCode}
				onCardAgentActivityViewChat={handleViewChat}
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
					agents: ROVO_AGENT_SELECTOR_AGENTS,
					defaultPinnedAgentIds: DEFAULT_PINNED_SPACE_AGENT_IDS,
					defaultPinnedSkillIds: DEFAULT_PINNED_WORK_ITEM_SKILL_IDS,
					onAgentAssignmentChange: handleAgentAssignmentChange,
					onClearSelection: handleClearSelection,
					onStatusChange: handleStatusChange,
					pinnedItemsLabel: WORK_ITEM_PINNED_ITEMS_LABEL,
					selectedAgentIds,
					skills: WORK_ITEM_SKILLS,
				}}
			/>
			<AsxRovoOverlay
				chatContextBar={chatContextBar}
				externalThinkingMessageId={externalThinkingMessageId}
				onQuestionAnswer={pendingChatQuestion ? handleChatQuestionAnswer : undefined}
			/>
		</div>
	);
}
