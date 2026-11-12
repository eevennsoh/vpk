"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { JiraIssueGenerativeActionRequest } from "@/components/blocks/jira-issue";
import type { JiraKanbanCardData, JiraKanbanCardSelectModifiers, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import {
	ASX_KANBAN_DEFAULT_AGENT_ID,
	ASX_KANBAN_DRAFTING_COLUMN,
	ASX_KANBAN_INTAKE_COLUMN,
	getAsxGenerativeAgentSelection,
	type AsxKanbanAgentSelection,
} from "../data/kanban-data";
import {
	asxKanbanReducer,
	createInitialAsxKanbanState,
	resolveAsxKanbanColumns,
} from "../lib/kanban-lifecycle";

const GENERATING_DELAY_MS = 1_200;
const COMPLETION_DELAY_MS = 5_500;
const INPUT_RESUME_COMPLETION_DELAY_MS = 2_500;
const NEEDS_INPUT_CARD_CODE = "RFP-101";

type TimerHandle = number;

interface UseAsxKanbanLifecycleOptions {
	onNonAgentAction?: (request: JiraIssueGenerativeActionRequest, card: JiraKanbanCardData) => void;
}

export function useAsxKanbanLifecycle({
	onNonAgentAction,
}: UseAsxKanbanLifecycleOptions = {}) {
	const [state, dispatch] = useReducer(asxKanbanReducer, undefined, createInitialAsxKanbanState);
	const stateRef = useRef(state);
	const timersRef = useRef(new Map<string, Set<TimerHandle>>());

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	const clearCardTimers = useCallback((cardCode: string) => {
		const timers = timersRef.current.get(cardCode);
		if (!timers) return;
		for (const timer of timers) window.clearTimeout(timer);
		timersRef.current.delete(cardCode);
	}, []);

	const schedule = useCallback((cardCode: string, delayMs: number, callback: () => void) => {
		const timer = window.setTimeout(() => {
			timersRef.current.get(cardCode)?.delete(timer);
			callback();
		}, delayMs);
		const cardTimers = timersRef.current.get(cardCode) ?? new Set<TimerHandle>();
		cardTimers.add(timer);
		timersRef.current.set(cardCode, cardTimers);
	}, []);

	useEffect(() => () => {
		for (const timers of timersRef.current.values()) {
			for (const timer of timers) window.clearTimeout(timer);
		}
		timersRef.current.clear();
	}, []);

	const startCards = useCallback((cardCodes: readonly string[], agent: AsxKanbanAgentSelection) => {
		for (const cardCode of cardCodes) {
			clearCardTimers(cardCode);
			dispatch({ type: "assign-agent", cardCodes: [cardCode], agent });
			schedule(cardCode, GENERATING_DELAY_MS, () => {
				dispatch({ type: "advance-generating", cardCode });
			});
			schedule(cardCode, COMPLETION_DELAY_MS, () => {
				dispatch({ type: cardCode === NEEDS_INPUT_CARD_CODE ? "request-input" : "complete", cardCode });
			});
		}
	}, [clearCardTimers, schedule]);

	const handleGenerativeActionSubmit = useCallback((
		request: JiraIssueGenerativeActionRequest,
		card: JiraKanbanCardData,
	) => {
		if (request.kind === "ask-rovo") {
			onNonAgentAction?.(request, card);
			return;
		}
		startCards([card.code], getAsxGenerativeAgentSelection(request));
	}, [onNonAgentAction, startCards]);

	const handleCardSelect = useCallback((
		cardCode: string,
		columnTitle: string,
		indexInColumn: number,
		modifiers: JiraKanbanCardSelectModifiers,
		selectionColumns?: readonly JiraKanbanColumnData[],
	) => {
		dispatch({ type: "select", cardCode, columnTitle, indexInColumn, modifiers, selectionColumns });
	}, []);

	const handleCardDragStart = useCallback((card: JiraKanbanCardData, sourceColumnTitle: string) => {
		dispatch({ type: "drag-start", cardCode: card.code, sourceColumnTitle });
	}, []);

	const handleCardDrop = useCallback((targetColumnTitle: string) => {
		const dragged = stateRef.current.dragged;
		if (dragged && targetColumnTitle === ASX_KANBAN_DRAFTING_COLUMN) {
			const codes = [...dragged.cardCodes];
			dispatch({ type: "drop", targetColumnTitle, agent: { id: ASX_KANBAN_DEFAULT_AGENT_ID } });
			for (const cardCode of codes) {
				clearCardTimers(cardCode);
				schedule(cardCode, GENERATING_DELAY_MS, () => dispatch({ type: "advance-generating", cardCode }));
				schedule(cardCode, COMPLETION_DELAY_MS, () => {
					dispatch({ type: cardCode === NEEDS_INPUT_CARD_CODE ? "request-input" : "complete", cardCode });
				});
			}
			return;
		}
		dispatch({ type: "drop", targetColumnTitle });
	}, [clearCardTimers, schedule]);

	const handleQuestionSubmit = useCallback((_activity: unknown, _answers: unknown, card: JiraKanbanCardData) => {
		clearCardTimers(card.code);
		dispatch({ type: "answer-question", cardCode: card.code });
		schedule(card.code, INPUT_RESUME_COMPLETION_DELAY_MS, () => {
			dispatch({ type: "complete", cardCode: card.code });
		});
	}, [clearCardTimers, schedule]);

	const handleCardClick = useCallback((
		_title: string,
		cardCode: string,
		_card: JiraKanbanCardData,
		columnTitle: string,
	) => {
		const indexInColumn = stateRef.current.columns
			.find((column) => column.title === columnTitle)
			?.cards.findIndex((card) => card.code === cardCode) ?? 0;
		dispatch({
			type: "select",
			cardCode,
			columnTitle,
			indexInColumn,
			modifiers: { metaOrCtrlKey: false, shiftKey: false },
		});
	}, []);

	const handleStatusChange = useCallback((targetColumnTitle: string) => {
		dispatch({ type: "set-status", targetColumnTitle });
	}, []);

	const handleAgentAssignmentChange = useCallback((agentId: string, assigned: boolean) => {
		if (!assigned) {
			dispatch({ type: "assign-toolbar-agent", agent: { id: agentId }, assigned: false });
			return;
		}
		// Assigning an agent to the selected cards starts real work: each card
		// moves into Drafting (the in-progress column) and runs the same
		// thinking → generating → complete lifecycle as a drag or generative
		// action. Clear the selection afterwards so the toolbar dismisses, matching
		// the multi-card drop behavior.
		const currentState = stateRef.current;
		const intakeCardCodes = new Set(
			currentState.columns
				.find((column) => column.title === ASX_KANBAN_INTAKE_COLUMN)
				?.cards.map((card) => card.code) ?? [],
		);
		const startableCodes = [...currentState.selectedCardCodes].filter((code) => intakeCardCodes.has(code));
		if (startableCodes.length === 0) return;
		startCards(startableCodes, { id: agentId });
		dispatch({ type: "clear-selection" });
	}, [startCards]);

	const handleClearSelection = useCallback(() => {
		dispatch({ type: "clear-selection" });
	}, []);

	const selectedAgentIds = useMemo(
		() => getCommonSelectedAgentIds(state.lifecycleByCode, state.selectedCardCodes),
		[state.lifecycleByCode, state.selectedCardCodes],
	);

	return {
		boardColumns: useMemo(() => resolveAsxKanbanColumns(state), [state]),
		draggedCardCode: state.dragged?.cardCodes[0] ?? null,
		handleCardDragEnd: useCallback(() => dispatch({ type: "drag-end" }), []),
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
		selectedCardCodes: state.selectedCardCodes,
	};
}

/** Agents assigned to every currently-selected card (intersection). */
function getCommonSelectedAgentIds(
	lifecycleByCode: Readonly<Record<string, { agentIds: readonly string[] }>>,
	selectedCardCodes: ReadonlySet<string>,
): string[] {
	const selectedCodes = [...selectedCardCodes];
	if (selectedCodes.length === 0) return [];
	const firstAgentIds = lifecycleByCode[selectedCodes[0]]?.agentIds ?? [];
	return firstAgentIds.filter((agentId) => selectedCodes.every(
		(cardCode) => lifecycleByCode[cardCode]?.agentIds.includes(agentId) ?? false,
	));
}
