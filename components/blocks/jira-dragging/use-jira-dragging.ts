"use client";

import { useRef, useState } from "react";
import type { JiraKanbanCardData, JiraKanbanProps } from "@/components/blocks/jira-kanban";
import { moveJiraKanbanCardsToDropTarget, moveJiraKanbanCardsToStatus } from "@/components/blocks/jira-kanban/card-drop";
import {
	createJiraKanbanSelectionState,
	getCommonJiraKanbanAgentIds,
	moveJiraKanbanCardsToColumn,
	reconcileJiraKanbanSelection,
	selectJiraKanbanCard,
	updateJiraKanbanCardAgentAssignment,
} from "@/components/blocks/jira-kanban/state";
import { createJiraDraggingColumns } from "./data";
import { useJiraIssueSelectionKeyboard, visibleJiraIssueCards } from "@/components/blocks/jira-kanban/use-jira-issue-selection-keyboard";
import { useBoardAutoArrangeCommit } from "@/components/blocks/jira-kanban/experimental/hooks/use-board-auto-arrange-commit";

export function useJiraDragging() {
	const [boardColumns, setBoardColumns] = useState(createJiraDraggingColumns);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const [selection, setSelection] = useState(createJiraKanbanSelectionState);
	const [draggedCardCode, setDraggedCardCode] = useState<string | null>(null);
	const dragCohort = useRef<readonly string[] | null>(null);
	const [assignedAgentIdsByCard, setAssignedAgentIdsByCard] = useState<Record<string, string[]>>({});
	const archivedCards = useRef(new Map<string, JiraKanbanCardData>());

	function cancelDrag() {
		dragCohort.current = null;
		setDraggedCardCode(null);
	}
	const onAutoArrange = useBoardAutoArrangeCommit(
		(updater) => setBoardColumns((columns) => [...updater(columns)]),
		setSelection,
		cancelDrag,
	);

	function removeCard(code: string) {
		cancelDrag();
		const columns = boardColumns.map((column) => {
			const cards = column.cards.filter((card) => card.code !== code);
			return { ...column, cards, count: cards.length };
		});
		setBoardColumns(columns);
		setSelection((current) => reconcileJiraKanbanSelection(current, columns));
	}

	const onCardSelect: JiraKanbanProps["onCardSelect"] = (cardCode, columnTitle, indexInColumn, modifiers) => {
		if (!modifiers.shiftKey && !modifiers.metaOrCtrlKey && modifiers.source !== "selection-control") return;
		cancelDrag();
		setSelection((current) => selectJiraKanbanCard(current, boardColumns, {
			cardCode, columnTitle, indexInColumn, modifiers,
		}));
	};
	const onClearSelection = () => { cancelDrag(); setSelection(createJiraKanbanSelectionState()); };
	const onSelectAll = () => {
		cancelDrag();
		setSelection({ ...createJiraKanbanSelectionState(), selectedCardCodes: new Set(visibleJiraIssueCards(rootRef.current).flatMap((card) => card.dataset.issueKey ? [card.dataset.issueKey] : [])) });
	};
	useJiraIssueSelectionKeyboard({
		rootRef, dragging: draggedCardCode !== null, onCancelDrag: cancelDrag, onClearSelection, onSelectAll,
		onRangeSelect: (range) => {
			cancelDrag();
			setSelection((current) => selectJiraKanbanCard(current, boardColumns, {
				...range, modifiers: { shiftKey: true, metaOrCtrlKey: false },
			}));
		},
	});

	const onCardDrop: JiraKanbanProps["onCardDrop"] = (columnTitle, target) => {
		if (!draggedCardCode || !dragCohort.current) return;
		const codes = dragCohort.current;
		const multiDrag = codes.length > 1;
		const columns = target
			? moveJiraKanbanCardsToDropTarget(boardColumns, codes, columnTitle, target)
			: moveJiraKanbanCardsToColumn(boardColumns, codes, columnTitle);
		// Drop helpers can clone an unchanged board; compare placement and effective status.
		const moved = columns.some((column, columnIndex) => {
			const previous = boardColumns[columnIndex];
			return column.cards.length !== previous.cards.length || column.cards.some((card, cardIndex) => {
				const previousCard = previous.cards[cardIndex];
				return card.code !== previousCard.code
					|| (card.status ?? column.title) !== (previousCard.status ?? previous.title);
			});
		});
		if (!moved) {
			cancelDrag();
			return;
		}
		setBoardColumns(columns);
		setSelection((current) => multiDrag ? createJiraKanbanSelectionState() : reconcileJiraKanbanSelection(current, columns));
		cancelDrag();
	};

	const onCardDragStart: JiraKanbanProps["onCardDragStart"] = (card) => {
		dragCohort.current = selection.selectedCardCodes.has(card.code) ? [...selection.selectedCardCodes] : [card.code];
		if (!selection.selectedCardCodes.has(card.code)) setSelection(createJiraKanbanSelectionState());
		setDraggedCardCode(card.code);
	};

	return {
		rootRef,
		boardColumns,
		draggedCardCode,
		selectedCardCodes: selection.selectedCardCodes,
		onCardSelect,
		onCardDragStart,
		onCardDrop,
		onAutoArrange,
		onCardDragEnd: cancelDrag,
		cardMoreMenuActions: {
			onArchive: (card: JiraKanbanCardData) => { archivedCards.current.set(card.code, card); removeCard(card.code); },
			onDelete: (card: JiraKanbanCardData) => removeCard(card.code),
		},
		selectionToolbar: {
			dismissOnEscape: false,
			onSelectAll,
			onAgentAssignmentChange: (agentId, assigned) => {
				setAssignedAgentIdsByCard((current) => updateJiraKanbanCardAgentAssignment(
					current, selection.selectedCardCodes, agentId, assigned,
				));
			},
			onClearSelection,
			onStatusChange: (status) => {
				cancelDrag();
				const columns = moveJiraKanbanCardsToStatus(boardColumns, [...selection.selectedCardCodes], status);
				setBoardColumns(columns);
				setSelection((current) => reconcileJiraKanbanSelection(current, columns));
			},
			onDelete: () => {
				cancelDrag();
				setBoardColumns((columns) => columns.map((column) => {
					const cards = column.cards.filter((card) => !selection.selectedCardCodes.has(card.code));
					return { ...column, cards, count: cards.length };
				}));
				setSelection(createJiraKanbanSelectionState());
			},
			selectedAgentIds: getCommonJiraKanbanAgentIds(assignedAgentIdsByCard, selection.selectedCardCodes),
		} satisfies NonNullable<JiraKanbanProps["selectionToolbar"]>,
	};
}
