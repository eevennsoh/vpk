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
			card.assignee ? selectedAssigneeIds.has(card.assignee.id) : false
		));

		return {
			...column,
			cards,
			count: cards.length,
		};
	});
}

export interface JiraKanbanSelectionState {
	lastSelectedByColumn: Readonly<Record<string, number>>;
	selectedCardCodes: Set<string>;
}

interface SelectJiraKanbanCardInput {
	cardCode: string;
	columnTitle: string;
	indexInColumn: number;
	modifiers: JiraKanbanCardSelectModifiers;
}

export function createJiraKanbanSelectionState(): JiraKanbanSelectionState {
	return {
		lastSelectedByColumn: {},
		selectedCardCodes: new Set(),
	};
}

export function selectJiraKanbanCard(
	state: JiraKanbanSelectionState,
	columns: readonly JiraKanbanColumnData[],
	input: SelectJiraKanbanCardInput,
): JiraKanbanSelectionState {
	const nextSelection = new Set(state.selectedCardCodes);
	const column = columns.find((candidate) => candidate.title === input.columnTitle);
	const previousIndex = state.lastSelectedByColumn[input.columnTitle];

	if (input.modifiers.shiftKey && column && previousIndex !== undefined) {
		const start = Math.min(previousIndex, input.indexInColumn);
		const end = Math.max(previousIndex, input.indexInColumn);
		for (const card of column.cards.slice(start, end + 1)) {
			nextSelection.add(card.code);
		}
	} else if (input.modifiers.metaOrCtrlKey) {
		if (nextSelection.has(input.cardCode)) {
			nextSelection.delete(input.cardCode);
		} else {
			nextSelection.add(input.cardCode);
		}
	} else {
		nextSelection.clear();
		nextSelection.add(input.cardCode);
	}

	return {
		lastSelectedByColumn: {
			...state.lastSelectedByColumn,
			[input.columnTitle]: input.indexInColumn,
		},
		selectedCardCodes: nextSelection,
	};
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
