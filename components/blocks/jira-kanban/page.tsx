"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
	JiraKanban,
	type JiraKanbanAgentData,
	type JiraKanbanCardData,
	type JiraKanbanCardSelectModifiers,
	type JiraKanbanColumnData,
	type JiraKanbanProps,
} from "./index";
import { createJiraKanbanColumns } from "./jira-kanban-data";
import { JiraKanbanBoardHeader } from "./board-header";
import {
	createJiraKanbanSelectionState,
	filterJiraKanbanColumnsByAssignee,
	getCommonJiraKanbanAgentIds,
	getJiraKanbanAssignees,
	moveJiraKanbanCardsToColumn,
	selectJiraKanbanCard,
	updateJiraKanbanCardAgentAssignment,
} from "./state";
import { BOARD_AGENTS } from "@/components/projects/jira/data/board-agents";
import { BOARD_COLUMNS } from "@/components/projects/jira/data/board-data";

const DEFAULT_CREATED_COLUMN_AGENT_ID = "readiness-checker";

export interface JiraKanbanPageProps {
	activeCardCode?: string;
	agents?: readonly JiraKanbanAgentData[];
	ariaLabel?: string;
	boardColumns?: readonly JiraKanbanColumnData[];
	columnChrome?: JiraKanbanProps["columnChrome"];
	compactHeader?: boolean;
	onBoardColumnsChange?: (columns: readonly JiraKanbanColumnData[]) => void;
	onCardClick?: (card: JiraKanbanCardData, columnTitle: string) => void;
	viewTabs?: ReactNode;
}

interface DraggedCardState {
	card: JiraKanbanCardData;
	sourceColumnTitle: string;
}

export default function JiraKanbanPage({
	activeCardCode,
	agents = BOARD_AGENTS,
	ariaLabel = "RFP board columns. Scroll horizontally to review all statuses.",
	boardColumns: controlledBoardColumns,
	columnChrome,
	compactHeader = false,
	onBoardColumnsChange,
	onCardClick,
	viewTabs,
}: Readonly<JiraKanbanPageProps>) {
	const [localBoardColumns, setLocalBoardColumns] = useState<JiraKanbanColumnData[]>(
		() => createJiraKanbanColumns(BOARD_COLUMNS),
	);
	const boardColumns = controlledBoardColumns ?? localBoardColumns;
	const updateBoardColumns = useCallback((
		updater: (columns: readonly JiraKanbanColumnData[]) => readonly JiraKanbanColumnData[],
	) => {
		const nextColumns = updater(boardColumns);
		if (controlledBoardColumns !== undefined) {
			onBoardColumnsChange?.(nextColumns);
			return;
		}

		setLocalBoardColumns([...nextColumns]);
	}, [boardColumns, controlledBoardColumns, onBoardColumnsChange]);
	const [columnAgentAssignments, setColumnAgentAssignments] = useState<Record<string, string[]>>({});
	const [draggedCard, setDraggedCard] = useState<DraggedCardState | null>(null);
	const [selection, setSelection] = useState(createJiraKanbanSelectionState);
	const [assignedAgentIdsByCard, setAssignedAgentIdsByCard] = useState<Record<string, string[]>>({});
	const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(() => new Set());
	const assignees = useMemo(() => getJiraKanbanAssignees(boardColumns), [boardColumns]);
	const filteredBoardColumns = useMemo(
		() => filterJiraKanbanColumnsByAssignee(boardColumns, selectedAssigneeIds),
		[boardColumns, selectedAssigneeIds],
	);
	const selectedAgentIds = useMemo(
		() => getCommonJiraKanbanAgentIds(assignedAgentIdsByCard, selection.selectedCardCodes),
		[assignedAgentIdsByCard, selection.selectedCardCodes],
	);

	const handleCardSelect = (
		cardCode: string,
		columnTitle: string,
		indexInColumn: number,
		modifiers: JiraKanbanCardSelectModifiers,
	) => {
		setSelection((current) => selectJiraKanbanCard(current, filteredBoardColumns, {
			cardCode,
			columnTitle,
			indexInColumn,
			modifiers,
		}));
	};

	// An owning workspace uses a plain click for activation, so clear any bulk
	// selection before opening it. Shift/⌘ clicks bypass this handler in
	// `JiraKanban` and continue through `onCardSelect` for range/toggle selection.
	// The standalone block keeps its original plain-click selection behavior.
	const handleCardClick = (
		_title: string,
		cardCode: string,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => {
		if (onCardClick) {
			setSelection(createJiraKanbanSelectionState());
			onCardClick(card, columnTitle);
			return;
		}

		const indexInColumn = filteredBoardColumns
			.find((column) => column.title === columnTitle)
			?.cards.findIndex((card) => card.code === cardCode) ?? 0;
		handleCardSelect(cardCode, columnTitle, indexInColumn, {
			metaOrCtrlKey: false,
			shiftKey: false,
		});
	};

	const handleCardDragStart = (card: JiraKanbanCardData, sourceColumnTitle: string) => {
		if (!selection.selectedCardCodes.has(card.code)) {
			setSelection(createJiraKanbanSelectionState());
		}
		setDraggedCard({ card, sourceColumnTitle });
	};

	const handleCardDrop = (targetColumnTitle: string) => {
		if (!draggedCard || draggedCard.sourceColumnTitle === targetColumnTitle) {
			setDraggedCard(null);
			return;
		}

		const isMultiDrag = selection.selectedCardCodes.has(draggedCard.card.code)
			&& selection.selectedCardCodes.size > 1;
		const draggedCardCodes = isMultiDrag
			? [...selection.selectedCardCodes]
			: [draggedCard.card.code];

		updateBoardColumns((prevColumns) => {
			const movableCardCodes = draggedCardCodes.filter((cardCode) => prevColumns.some((column) => (
				column.title !== targetColumnTitle && column.cards.some((card) => card.code === cardCode)
			)));
			return moveJiraKanbanCardsToColumn(prevColumns, movableCardCodes, targetColumnTitle);
		});

		if (isMultiDrag) {
			setSelection(createJiraKanbanSelectionState());
		}
		setDraggedCard(null);
	};

	const handleCardDragEnd = () => {
		setDraggedCard(null);
	};

	const handleAssigneeFilterChange = (assigneeIds: Set<string>) => {
		setSelection(createJiraKanbanSelectionState());
		setDraggedCard(null);
		setSelectedAssigneeIds(assigneeIds);
	};

	const handleSelectedCardsStatusChange = (targetColumnTitle: string) => {
		updateBoardColumns((currentColumns) => moveJiraKanbanCardsToColumn(
			currentColumns,
			[...selection.selectedCardCodes],
			targetColumnTitle,
		));
	};

	const handleSelectedCardsAgentAssignmentChange = (agentId: string, assigned: boolean) => {
		setAssignedAgentIdsByCard((currentAssignments) => updateJiraKanbanCardAgentAssignment(
			currentAssignments,
			selection.selectedCardCodes,
			agentId,
			assigned,
		));
	};

	const handleToggleColumnAgent = (columnTitle: string, agentId: string) => {
		setColumnAgentAssignments((prevAssignments) => {
			const assignedAgentIds = prevAssignments[columnTitle] ?? [];
			const hasAgent = assignedAgentIds.includes(agentId);
			const nextAgentIds = hasAgent
				? assignedAgentIds.filter((assignedAgentId) => assignedAgentId !== agentId)
				: [...assignedAgentIds, agentId];

			return {
				...prevAssignments,
				[columnTitle]: nextAgentIds,
			};
		});
	};

	const handleCreateColumnAgent = (columnTitle: string) => {
		setColumnAgentAssignments((prevAssignments) => {
			const assignedAgentIds = prevAssignments[columnTitle] ?? [];

			if (assignedAgentIds.includes(DEFAULT_CREATED_COLUMN_AGENT_ID)) {
				return prevAssignments;
			}

			return {
				...prevAssignments,
				[columnTitle]: [...assignedAgentIds, DEFAULT_CREATED_COLUMN_AGENT_ID],
			};
		});
	};

	return (
		<div className="flex h-full min-h-[640px] flex-col rounded-lg bg-surface">
			<JiraKanbanBoardHeader
				assignees={assignees}
				compact={compactHeader}
				onSelectedAssigneeIdsChange={handleAssigneeFilterChange}
				selectedAssigneeIds={selectedAssigneeIds}
				viewTabs={viewTabs}
			/>
			<div className="flex min-h-0 min-w-0 flex-1">
				<JiraKanban
					activeCardCode={activeCardCode}
					agents={agents}
					ariaLabel={ariaLabel}
					assignedAgentIdsByColumn={columnAgentAssignments}
					boardColumns={filteredBoardColumns}
					columnChrome={columnChrome}
					draggedCardCode={draggedCard?.card.code ?? null}
					selectedCardCodes={selection.selectedCardCodes}
					onCardClick={handleCardClick}
					onCardSelect={handleCardSelect}
					onCardDragStart={handleCardDragStart}
					onCardDrop={handleCardDrop}
					onCardDragEnd={handleCardDragEnd}
					onCreateAgent={handleCreateColumnAgent}
					onToggleColumnAgent={handleToggleColumnAgent}
					paddingTop={0}
					selectionToolbar={{
						onSelectAll: () => setSelection({ ...createJiraKanbanSelectionState(), selectedCardCodes: new Set(filteredBoardColumns.flatMap((column) => column.cards.map((card) => card.code))) }),
						onAgentAssignmentChange: handleSelectedCardsAgentAssignmentChange,
						onClearSelection: () => setSelection(createJiraKanbanSelectionState()),
						onStatusChange: handleSelectedCardsStatusChange,
						selectedAgentIds,
					}}
				/>
			</div>
		</div>
	);
}
