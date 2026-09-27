import type {
	JiraKanbanAssigneeData,
	JiraKanbanCardData,
	JiraKanbanCardSelectModifiers,
	JiraKanbanColumnData,
} from "./index";

export function getJiraKanbanAssignees(
	columns: readonly JiraKanbanColumnData[],
): JiraKanbanAssigneeData[] {
	const assignees = new Map<string, JiraKanbanAssigneeData>();

	for (const card of columns.flatMap((column) => column.cards)) {
		if (card.assignee && !assignees.has(card.assignee.id)) {
			assignees.set(card.assignee.id, card.assignee);
		}
	}

	return [...assignees.values()];
}

export function filterJiraKanbanColumnsByAssignee(
	columns: readonly JiraKanbanColumnData[],
	selectedAssigneeIds: ReadonlySet<string>,
): JiraKanbanColumnData[] {
	if (selectedAssigneeIds.size === 0) {
		return [...columns];
	}

	return columns.map((column) => {
		const cards = column.cards.filter((card) => (
			card.assignee
				? selectedAssigneeIds.has(card.assignee.id)
				: column.presenters?.some((presenter) => selectedAssigneeIds.has(presenter.id)) ?? false
		));

		return {
			...column,
			cards,
			count: cards.length,
		};
	});
}

export interface JiraKanbanSelectionAnchor {
	cardCode: string;
	columnTitle: string;
}

export interface JiraKanbanSelectionState {
	anchor: Readonly<JiraKanbanSelectionAnchor> | null;
	selectedCardCodes: Set<string>;
}

interface SelectJiraKanbanCardInput {
	cardCode: string;
	columnTitle: string;
	indexInColumn: number;
	modifiers: JiraKanbanCardSelectModifiers;
	/** Keyboard ranges start from focus when no valid anchor exists. */
	fallbackAnchor?: Readonly<JiraKanbanSelectionAnchor>;
}

export function createJiraKanbanSelectionState(): JiraKanbanSelectionState {
	return {
		anchor: null,
		selectedCardCodes: new Set(),
	};
}

/** Keep range rows in rendered order and omit columns whose cards are hidden. */
export function getSelectableJiraKanbanColumns(
	columns: readonly JiraKanbanColumnData[],
	collapsedColumnTitles: ReadonlySet<string>,
): JiraKanbanColumnData[] {
	return columns.filter((column) => !collapsedColumnTitles.has(column.title));
}

/** The toolbar expands only columns already represented in the selection. */
export function selectAllJiraKanbanCardsInSelectedColumns(
	state: JiraKanbanSelectionState,
	columns: readonly JiraKanbanColumnData[],
): JiraKanbanSelectionState {
	return {
		anchor: null,
		selectedCardCodes: new Set(columns
			.filter((column) => column.cards.some((card) => state.selectedCardCodes.has(card.code)))
			.flatMap((column) => column.cards.map((card) => card.code))),
	};
}

function getJiraKanbanCardPosition(
	columns: readonly JiraKanbanColumnData[],
	card: Readonly<JiraKanbanSelectionAnchor>,
) {
	const columnIndex = columns.findIndex((column) => column.title === card.columnTitle);
	const cardIndex = columns[columnIndex]?.cards.findIndex((candidate) => candidate.code === card.cardCode) ?? -1;
	return cardIndex < 0 ? null : { columnIndex, cardIndex };
}

/** A hidden, moved or deselected card cannot silently remain the range anchor. */
export function reconcileJiraKanbanSelection<T extends JiraKanbanSelectionState>(
	state: T,
	columns: readonly JiraKanbanColumnData[],
): T {
	if (!state.anchor) return state;
	const anchor = state.anchor;
	const valid = state.selectedCardCodes.has(anchor.cardCode)
		&& columns.some((column) => column.title === anchor.columnTitle
			&& column.cards.some((card) => card.code === anchor.cardCode));
	return valid ? state : { ...state, anchor: null };
}

export function selectJiraKanbanCard(
	state: JiraKanbanSelectionState,
	columns: readonly JiraKanbanColumnData[],
	input: SelectJiraKanbanCardInput,
): JiraKanbanSelectionState {
	const current = reconcileJiraKanbanSelection(state, columns);
	const target = { cardCode: input.cardCode, columnTitle: input.columnTitle };
	const targetPosition = getJiraKanbanCardPosition(columns, target);
	if (!targetPosition) return current;

	if (input.modifiers.shiftKey) {
		const candidate = current.anchor ?? input.fallbackAnchor ?? target;
		const candidatePosition = getJiraKanbanCardPosition(columns, candidate);
		const anchor = candidatePosition ? candidate : target;
		const anchorPosition = candidatePosition ?? targetPosition;
		const [left, right] = anchorPosition.columnIndex <= targetPosition.columnIndex
			? [anchorPosition, targetPosition] : [targetPosition, anchorPosition];
		const startRow = Math.min(anchorPosition.cardIndex, targetPosition.cardIndex);
		const endRow = Math.max(anchorPosition.cardIndex, targetPosition.cardIndex);
		const spansBoard = left.columnIndex !== right.columnIndex
			&& left.columnIndex === columns.findIndex((column) => column.cards.length > 0)
			&& right.columnIndex === columns.findLastIndex((column) => column.cards.length > 0);
		const oppositeCorners = spansBoard && (
			(left.cardIndex === 0 && right.cardIndex === columns[right.columnIndex].cards.length - 1)
			|| (right.cardIndex === 0 && left.cardIndex === columns[left.columnIndex].cards.length - 1)
		);
		const range = columns.slice(left.columnIndex, right.columnIndex + 1);
		return {
			anchor,
			selectedCardCodes: new Set(range.flatMap((column) => (
				oppositeCorners ? column.cards : column.cards.slice(startRow, endRow + 1)
			)).map((card) => card.code)),
		};
	}
	if (input.modifiers.metaOrCtrlKey) {
		const nextSelection = new Set(current.selectedCardCodes);
		if (nextSelection.has(input.cardCode)) {
			nextSelection.delete(input.cardCode);
			return { anchor: current.anchor?.cardCode === input.cardCode ? null : current.anchor, selectedCardCodes: nextSelection };
		}
		nextSelection.add(input.cardCode);
		return { anchor: target, selectedCardCodes: nextSelection };
	}
	return { anchor: target, selectedCardCodes: new Set([input.cardCode]) };
}

export function moveJiraKanbanCardsToColumn(
	columns: readonly JiraKanbanColumnData[],
	cardCodes: readonly string[],
	targetColumnTitle: string,
): JiraKanbanColumnData[] {
	const codeSet = new Set(cardCodes);
	const movingCards = columns.flatMap((column) => (
		column.title === targetColumnTitle
			? []
			: column.cards.filter((card) => codeSet.has(card.code))
	));

	if (movingCards.length === 0) {
		return [...columns];
	}
	const movingCardCodes = new Set(movingCards.map((card) => card.code));

	return columns.map((column) => {
		const remainingCards = column.cards.filter((card) => !movingCardCodes.has(card.code));
		const cards = column.title === targetColumnTitle
			? [...movingCards.map((card) => card.status === undefined ? card : { ...card, status: targetColumnTitle }), ...remainingCards]
			: remainingCards;

		return {
			...column,
			cards,
			count: cards.length,
		};
	});
}

function getAgentActivityModeAfterUnlink(
	card: JiraKanbanCardData,
	remainingActivities: NonNullable<JiraKanbanCardData["agentActivities"]>,
): JiraKanbanCardData["agentActivityMode"] {
	if (remainingActivities.some((activity) => activity.state === "awaiting-input")) {
		return "awaiting-input";
	}
	if (remainingActivities.some((activity) => activity.state === "working")) {
		return "working";
	}
	return remainingActivities.some((activity) => activity.state === "completed") || card.agentDoneRuns?.length
		? "completed"
		: "none";
}

export function unlinkJiraKanbanAgentSession(
	columns: readonly JiraKanbanColumnData[],
	cardCode: string,
	sessionId: string,
): JiraKanbanColumnData[] {
	let changed = false;
	const nextColumns = columns.map((column) => {
		const cards = column.cards.map((card) => {
			if (card.code !== cardCode || !card.agentActivities?.some((activity) => activity.id === sessionId)) {
				return card;
			}

			changed = true;
			const agentActivities = card.agentActivities.filter((activity) => activity.id !== sessionId);
			return {
				...card,
				agentActivities,
				agentActivityMode: getAgentActivityModeAfterUnlink(card, agentActivities),
			};
		});

		return cards.some((card, index) => card !== column.cards[index])
			? { ...column, cards }
			: column;
	});

	return changed ? nextColumns : [...columns];
}

export function linkJiraKanbanAgentSession(
	columns: readonly JiraKanbanColumnData[],
	cardCode: string,
	activity: NonNullable<JiraKanbanCardData["agentActivities"]>[number],
): JiraKanbanColumnData[] {
	let changed = false;
	const nextColumns = columns.map((column) => {
		const cards = column.cards.map((card) => {
			if (card.code !== cardCode || card.agentActivities?.some((candidate) => candidate.id === activity.id)) {
				return card;
			}

			changed = true;
			const agentActivities = [...(card.agentActivities ?? []), activity];
			return {
				...card,
				agentActivities,
				agentActivityMode: getAgentActivityModeAfterUnlink(card, agentActivities),
			};
		});

		return cards.some((card, index) => card !== column.cards[index])
			? { ...column, cards }
			: column;
	});

	return changed ? nextColumns : [...columns];
}

export function moveJiraKanbanAgentSession(
	columns: readonly JiraKanbanColumnData[],
	sourceCardCode: string,
	targetCardCode: string,
	sessionId: string,
): JiraKanbanColumnData[] {
	if (sourceCardCode === targetCardCode) {
		return [...columns];
	}

	const cards = columns.flatMap((column) => column.cards);
	const sourceCard = cards.find((card) => card.code === sourceCardCode);
	const targetCard = cards.find((card) => card.code === targetCardCode);
	const activity = sourceCard?.agentActivities?.find((candidate) => candidate.id === sessionId);

	if (!sourceCard || !targetCard || !activity || targetCard.agentActivities?.some((candidate) => candidate.id === sessionId)) {
		return [...columns];
	}

	return columns.map((column) => {
		let changed = false;
		const nextCards = column.cards.map((card) => {
			if (card.code === sourceCardCode) {
				changed = true;
				const agentActivities = (card.agentActivities ?? []).filter((candidate) => candidate.id !== sessionId);
				return {
					...card,
					agentActivities,
					agentActivityMode: getAgentActivityModeAfterUnlink(card, agentActivities),
				};
			}

			if (card.code === targetCardCode) {
				changed = true;
				const agentActivities = [...(card.agentActivities ?? []), activity];
				return {
					...card,
					agentActivities,
					agentActivityMode: getAgentActivityModeAfterUnlink(card, agentActivities),
				};
			}

			return card;
		});

		return changed ? { ...column, cards: nextCards } : column;
	});
}

export function getCommonJiraKanbanAgentIds(
	assignedAgentIdsByCard: Readonly<Record<string, readonly string[]>>,
	selectedCardCodes: ReadonlySet<string>,
): string[] {
	const selectedCodes = [...selectedCardCodes];
	if (selectedCodes.length === 0) {
		return [];
	}

	const firstAssignments = assignedAgentIdsByCard[selectedCodes[0]] ?? [];
	return firstAssignments.filter((agentId) => selectedCodes.every((cardCode) => (
		assignedAgentIdsByCard[cardCode]?.includes(agentId) ?? false
	)));
}

export function updateJiraKanbanCardAgentAssignment(
	assignedAgentIdsByCard: Readonly<Record<string, readonly string[]>>,
	selectedCardCodes: ReadonlySet<string>,
	agentId: string,
	assigned: boolean,
): Record<string, string[]> {
	const nextAssignments = Object.fromEntries(
		Object.entries(assignedAgentIdsByCard).map(([cardCode, agentIds]) => [cardCode, [...agentIds]]),
	);

	for (const cardCode of selectedCardCodes) {
		const currentAgentIds = nextAssignments[cardCode] ?? [];
		nextAssignments[cardCode] = assigned
			? Array.from(new Set([...currentAgentIds, agentId]))
			: currentAgentIds.filter((currentAgentId) => currentAgentId !== agentId);
	}

	return nextAssignments;
}
