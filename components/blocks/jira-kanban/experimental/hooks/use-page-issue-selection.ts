"use client";

import { useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { JiraKanbanCardData, JiraKanbanCardSelectModifiers, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { moveJiraKanbanCardsToDropTarget, moveJiraKanbanCardsToStatus, type JiraKanbanCardDropTarget } from "@/components/blocks/jira-kanban/card-drop";
import { createJiraKanbanSelectionState, moveJiraKanbanCardsToColumn, reconcileJiraKanbanSelection, selectJiraKanbanCard, type JiraKanbanSelectionState } from "@/components/blocks/jira-kanban/state";
import { useJiraIssueSelectionKeyboard, visibleJiraIssueCards } from "@/components/blocks/jira-kanban/use-jira-issue-selection-keyboard";
import { useJiraSelectionDismiss } from "@/components/blocks/jira-kanban/use-jira-selection-dismiss";
import type { DraggedCardState, ExperimentalJiraKanbanPageProps } from "@/components/blocks/jira-kanban/experimental/experimental-page-types";

/** Page-owned transactions reuse the same interaction contract as Jira Dragging. */
export function usePageIssueSelection({
	rootRef, enabled, filteredBoardColumns, boardColumns, selection, setSelection, draggedCard, setDraggedCard, updateBoardColumns, onCardClick,
}: Readonly<{
	rootRef: RefObject<HTMLDivElement | null>;
	enabled: boolean;
	filteredBoardColumns: readonly JiraKanbanColumnData[];
	boardColumns: readonly JiraKanbanColumnData[];
	selection: JiraKanbanSelectionState;
	setSelection: Dispatch<SetStateAction<JiraKanbanSelectionState>>;
	draggedCard: DraggedCardState | null;
	setDraggedCard: Dispatch<SetStateAction<DraggedCardState | null>>;
	updateBoardColumns: (updater: (columns: readonly JiraKanbanColumnData[]) => readonly JiraKanbanColumnData[]) => void;
	onCardClick: ExperimentalJiraKanbanPageProps["onCardClick"];
}>) {
	const dragCohort = useRef<readonly string[] | null>(null);
	const handleCardDragEnd = () => { dragCohort.current = null; setDraggedCard(null); };
	const onClearSelection = () => { handleCardDragEnd(); setSelection(createJiraKanbanSelectionState()); };
	const onSelectAll = () => {
		handleCardDragEnd();
		const codes = enabled ? visibleJiraIssueCards(rootRef.current).flatMap((card) => card.dataset.issueKey ? [card.dataset.issueKey] : [])
			: filteredBoardColumns.flatMap((column) => column.cards.map((card) => card.code));
		setSelection({ ...createJiraKanbanSelectionState(), selectedCardCodes: new Set(codes) });
	};
	const handleCardSelect = (
		cardCode: string,
		columnTitle: string,
		indexInColumn: number,
		modifiers: JiraKanbanCardSelectModifiers,
	) => {
		if (enabled && !modifiers.shiftKey && !modifiers.metaOrCtrlKey && modifiers.source !== "selection-control") return;
		handleCardDragEnd();
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
	// Fused selection follows Jira Dragging: an unmodified click never selects.
	// Other standalone boards keep their original plain-click selection behavior.
	const handleCardClick = (
		_title: string,
		cardCode: string,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => {
		if (onCardClick) {
			onClearSelection();
			onCardClick(card, columnTitle);
			return;
		}
		if (enabled) return;

		const indexInColumn = filteredBoardColumns
			.find((column) => column.title === columnTitle)
			?.cards.findIndex((card) => card.code === cardCode) ?? 0;
		handleCardSelect(cardCode, columnTitle, indexInColumn, {
			metaOrCtrlKey: false,
			shiftKey: false,
		});
	};

	const handleCardDragStart = (card: JiraKanbanCardData, sourceColumnTitle: string) => {
		const startsFromSelection = selection.selectedCardCodes.has(card.code);
		dragCohort.current = startsFromSelection ? [...selection.selectedCardCodes] : [card.code];
		if (!startsFromSelection) {
			setSelection(createJiraKanbanSelectionState());
		}
		setDraggedCard({ card, sourceColumnTitle });
	};

	const handleCardDrop = (targetColumnTitle: string, target?: JiraKanbanCardDropTarget) => {
		if (!draggedCard || !dragCohort.current || (!target && draggedCard.sourceColumnTitle === targetColumnTitle)) {
			handleCardDragEnd();
			return;
		}
		const draggedCardCodes = dragCohort.current;
		const isMultiDrag = draggedCardCodes.length > 1;
		const movableCardCodes = draggedCardCodes.filter((cardCode) => boardColumns.some((column) => (
			column.title !== targetColumnTitle && column.cards.some((card) => card.code === cardCode)
		)));
		const movedColumns = target
			? moveJiraKanbanCardsToDropTarget(boardColumns, draggedCardCodes, targetColumnTitle, target)
			: moveJiraKanbanCardsToColumn(boardColumns, movableCardCodes, targetColumnTitle);
		const moved = movedColumns.some((column, columnIndex) => {
			const previous = boardColumns[columnIndex];
			return column.cards.length !== previous.cards.length || column.cards.some((card, cardIndex) => {
				const previousCard = previous.cards[cardIndex];
				return card.code !== previousCard.code
					|| (card.status ?? column.title) !== (previousCard.status ?? previous.title);
			});
		});
		if (moved) {
			updateBoardColumns(() => movedColumns);
			setSelection((current) => isMultiDrag ? createJiraKanbanSelectionState() : reconcileJiraKanbanSelection(current, movedColumns));
		}
		handleCardDragEnd();
	};
	const handleSelectedCardsStatusChange = (status: string) => {
		handleCardDragEnd();
		const columns = moveJiraKanbanCardsToStatus(boardColumns, [...selection.selectedCardCodes], status);
		updateBoardColumns(() => columns);
		setSelection((current) => reconcileJiraKanbanSelection(current, columns));
	};
	const handleCardRemove = (card: JiraKanbanCardData) => {
		handleCardDragEnd();
		const columns = boardColumns.map((column) => {
			const cards = column.cards.filter((candidate) => candidate.code !== card.code);
			return cards.length === column.cards.length ? column : { ...column, cards, count: cards.length };
		});
		updateBoardColumns(() => columns);
		setSelection((current) => reconcileJiraKanbanSelection({
			...current,
			selectedCardCodes: new Set([...current.selectedCardCodes].filter((code) => code !== card.code)),
		}, columns));
	};
	useJiraIssueSelectionKeyboard({
		rootRef, enabled, dragging: draggedCard !== null, onCancelDrag: handleCardDragEnd, onClearSelection, onSelectAll,
		onRangeSelect: (range) => {
			handleCardDragEnd();
			setSelection((current) => selectJiraKanbanCard(current, filteredBoardColumns, {
				...range, modifiers: { shiftKey: true, metaOrCtrlKey: false },
			}));
		},
	});
	useJiraSelectionDismiss({ rootRef, enabled, boardColumns: filteredBoardColumns, selectedCardCodes: selection.selectedCardCodes, dragging: draggedCard !== null, onClearSelection });
	return { handleCardSelect, handleCardClick, handleCardDragStart, handleCardDrop, handleCardDragEnd, handleCardRemove, handleSelectedCardsStatusChange, onSelectAll, onClearSelection };
}
