import type { JiraKanbanCardSelectModifiers, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import {
	createJiraKanbanSelectionState,
	reconcileJiraKanbanSelection,
	type JiraKanbanSelectionState,
	moveJiraKanbanCardsToColumn,
	selectJiraKanbanCard,
} from "@/components/blocks/jira-kanban/state";
import {
	JGP_KANBAN_DEFAULT_AGENT_ID,
	JGP_KANBAN_DONE_COLUMN,
	JGP_KANBAN_REVIEW_COLUMN,
	JGP_KANBAN_IN_PROGRESS_COLUMN,
	JGP_KANBAN_TODO_COLUMN,
	type JgpKanbanAgentSelection,
	type JgpKanbanScenario,
	createJgpKanbanActivity,
	createJgpKanbanCompletedRun,
	createJgpKanbanColumns,
} from "../data/kanban-data";

export type JgpKanbanLifecyclePhase = "default" | "thinking" | "generating" | "needs-input" | "completed";
export type JgpKanbanCompletionMode = "complete" | "stay-active";

export interface JgpKanbanLifecycle {
	agentIds: string[];
	agentSelectionsById: Record<string, JgpKanbanAgentSelection>;
	generatedOutput?: string;
	phase: JgpKanbanLifecyclePhase;
}

export interface JgpKanbanDragState {
	cardCodes: string[];
	sourceColumnTitle: string;
}

export interface JgpKanbanState extends JiraKanbanSelectionState {
	agentCompletionMode: JgpKanbanCompletionMode;
	columns: JiraKanbanColumnData[];
	dragged: JgpKanbanDragState | null;
	lifecycleByCode: Record<string, JgpKanbanLifecycle>;
}

export type JgpKanbanAction =
	| { type: "assign-agent"; cardCodes: readonly string[]; agent: JgpKanbanAgentSelection }
	| { type: "advance-generating"; cardCode: string }
	| { type: "request-input"; cardCode: string }
	| { type: "answer-question"; cardCode: string }
	| { type: "complete"; cardCode: string; generatedOutput?: string }
	| { type: "select"; cardCode: string; columnTitle: string; indexInColumn: number; modifiers: JiraKanbanCardSelectModifiers; selectionColumns?: readonly JiraKanbanColumnData[] }
	| { type: "drag-start"; cardCode: string; sourceColumnTitle: string }
	| { type: "drag-end" }
	| { type: "drop"; targetColumnTitle: string; agent?: JgpKanbanAgentSelection }
	| { type: "set-status"; targetColumnTitle: string }
	| { type: "assign-toolbar-agent"; agent: JgpKanbanAgentSelection; assigned: boolean }
	| { type: "clear-selection" };

function assignAgents(
	lifecycleByCode: Readonly<Record<string, JgpKanbanLifecycle>>,
	cardCodes: readonly string[],
	agent: JgpKanbanAgentSelection,
): Record<string, JgpKanbanLifecycle> {
	const next = { ...lifecycleByCode };
	for (const cardCode of cardCodes) {
		const current = next[cardCode] ?? {
			agentIds: [],
			agentSelectionsById: {},
			phase: "default" as const,
		};
		next[cardCode] = {
			...current,
			agentIds: current.agentIds.includes(agent.id) ? current.agentIds : [...current.agentIds, agent.id],
			agentSelectionsById: {
				...current.agentSelectionsById,
				[agent.id]: agent,
			},
			phase: "thinking",
		};
	}
	return next;
}

function unassignAgent(
	lifecycleByCode: Readonly<Record<string, JgpKanbanLifecycle>>,
	cardCodes: readonly string[],
	agentId: string,
): Record<string, JgpKanbanLifecycle> {
	const next = { ...lifecycleByCode };
	for (const cardCode of cardCodes) {
		const current = next[cardCode];
		if (!current || !current.agentIds.includes(agentId)) continue;
		const agentSelectionsById = { ...current.agentSelectionsById };
		delete agentSelectionsById[agentId];
		next[cardCode] = {
			...current,
			agentIds: current.agentIds.filter((id) => id !== agentId),
			agentSelectionsById,
		};
	}
	return next;
}

function updateLifecycle(
	state: JgpKanbanState,
	cardCode: string,
	update: (current: JgpKanbanLifecycle) => JgpKanbanLifecycle,
): JgpKanbanState {
	const current = state.lifecycleByCode[cardCode];
	if (!current) return state;
	return {
		...state,
		lifecycleByCode: { ...state.lifecycleByCode, [cardCode]: update(current) },
	};
}

export function createInitialJgpKanbanState(scenario: JgpKanbanScenario = "local-review"): JgpKanbanState {
	return {
		agentCompletionMode: scenario === "global-assignment" ? "stay-active" : "complete",
		columns: createJgpKanbanColumns(scenario),
		dragged: null,
		...createJiraKanbanSelectionState(),
		lifecycleByCode: {},
	};
}

/** Resolves lifecycle state into the shared JiraIssue presentation contract. */
export function resolveJgpKanbanColumns(state: JgpKanbanState): JiraKanbanColumnData[] {
	return state.columns.map((column) => ({
		...column,
		count: column.cards.length,
		cards: column.cards.map((card) => {
			const lifecycle = state.lifecycleByCode[card.code];
			if (!lifecycle) return card;

			if (lifecycle.phase === "completed") {
				return {
					...card,
					agentActivities: undefined,
					agentActivityMode: "completed" as const,
					agentDoneRuns: lifecycle.agentIds.map((agentId, index) => createJgpKanbanCompletedRun(
						agentId,
						{ issueKey: card.code, issueSummary: card.title },
						lifecycle.agentSelectionsById[agentId],
						index === 0 ? lifecycle.generatedOutput : undefined,
					)),
				};
			}

			const awaitingInput = lifecycle.phase === "needs-input";
			const activities = lifecycle.agentIds.map((agentId) => (
				createJgpKanbanActivity(
					agentId,
					lifecycle.agentSelectionsById[agentId],
					// Seed per-card variation so the same agent assigned across
					// multiple cards reads as distinct, concurrent work rather than a
					// uniform placeholder. Include the agent id so multiple agents on
					// one card also vary relative to each other.
					`${card.code}:${agentId}`,
				)
			));

			return {
				...card,
				agentActivities: activities,
				agentActivityMode: awaitingInput ? "awaiting-input" as const : "working" as const,
				agentDoneRuns: undefined,
			};
		}),
	}));
}

export function jgpKanbanReducer(state: JgpKanbanState, action: JgpKanbanAction): JgpKanbanState {
	const next = reduceJgpKanbanAction(state, action);
	return reconcileJiraKanbanSelection(next, next.columns);
}

function reduceJgpKanbanAction(state: JgpKanbanState, action: JgpKanbanAction): JgpKanbanState {
	switch (action.type) {
		case "assign-agent":
			return {
				...state,
				columns: moveJiraKanbanCardsToColumn(state.columns, action.cardCodes, JGP_KANBAN_IN_PROGRESS_COLUMN),
				lifecycleByCode: assignAgents(state.lifecycleByCode, action.cardCodes, action.agent),
			};
		case "advance-generating":
			return updateLifecycle(state, action.cardCode, (current) => ({ ...current, phase: "generating" }));
		case "request-input":
			return updateLifecycle(state, action.cardCode, (current) => ({ ...current, phase: "needs-input" }));
		case "answer-question":
			return updateLifecycle(state, action.cardCode, (current) => ({ ...current, phase: "generating" }));
		case "complete": {
			if (state.agentCompletionMode === "stay-active") {
				const next = updateLifecycle(state, action.cardCode, (current) => ({
					...current,
					phase: "generating",
				}));
				return {
					...next,
					selectedCardCodes: new Set([...next.selectedCardCodes].filter((code) => code !== action.cardCode)),
				};
			}
			const next = updateLifecycle(state, action.cardCode, (current) => ({
				...current,
				generatedOutput: action.generatedOutput,
				phase: "completed",
			}));
			return {
				...next,
				columns: moveJiraKanbanCardsToColumn(next.columns, [action.cardCode], JGP_KANBAN_REVIEW_COLUMN),
				selectedCardCodes: new Set([...next.selectedCardCodes].filter((code) => code !== action.cardCode)),
			};
		}
		case "select": {
			return {
				...state,
				...selectJiraKanbanCard(state, action.selectionColumns ?? state.columns, action),
			};
		}
		case "drag-start": {
			const cardCodes = state.selectedCardCodes.has(action.cardCode) && state.selectedCardCodes.size > 1
				? [...state.selectedCardCodes]
				: [action.cardCode];
			return { ...state, dragged: { cardCodes, sourceColumnTitle: action.sourceColumnTitle } };
		}
		case "drag-end":
			return { ...state, dragged: null };
		case "drop": {
			if (!state.dragged) return { ...state, dragged: null };
			// Dropping into Done marks work as delivered: move the card(s)
			// without running the generative lifecycle and clear each card's
			// lifecycle entry so the "Agent done" completed-run footer is removed.
			if (action.targetColumnTitle === JGP_KANBAN_DONE_COLUMN) {
				const droppedCodes = state.dragged.cardCodes;
				const lifecycleByCode = { ...state.lifecycleByCode };
				for (const cardCode of droppedCodes) delete lifecycleByCode[cardCode];
				return {
					...state,
					columns: moveJiraKanbanCardsToColumn(state.columns, droppedCodes, JGP_KANBAN_DONE_COLUMN),
					dragged: null,
					lifecycleByCode,
					selectedCardCodes: new Set(
						[...state.selectedCardCodes].filter((code) => !droppedCodes.includes(code)),
					),
				};
			}
			if (state.dragged.sourceColumnTitle !== JGP_KANBAN_TODO_COLUMN
				|| action.targetColumnTitle !== JGP_KANBAN_IN_PROGRESS_COLUMN) {
				return { ...state, dragged: null };
			}
			return {
				...state,
				columns: moveJiraKanbanCardsToColumn(state.columns, state.dragged.cardCodes, JGP_KANBAN_IN_PROGRESS_COLUMN),
				dragged: null,
				lifecycleByCode: assignAgents(
					state.lifecycleByCode,
					state.dragged.cardCodes,
					action.agent ?? { id: JGP_KANBAN_DEFAULT_AGENT_ID },
				),
				selectedCardCodes: new Set(),
			};
		}
		case "set-status": {
			const cardCodes = [...state.selectedCardCodes];
			if (cardCodes.length === 0) return state;
			return {
				...state,
				columns: moveJiraKanbanCardsToColumn(state.columns, cardCodes, action.targetColumnTitle),
			};
		}
		case "assign-toolbar-agent": {
			const cardCodes = [...state.selectedCardCodes];
			if (cardCodes.length === 0) return state;
			return {
				...state,
				lifecycleByCode: action.assigned
					? assignAgents(state.lifecycleByCode, cardCodes, action.agent)
					: unassignAgent(state.lifecycleByCode, cardCodes, action.agent.id),
			};
		}
		case "clear-selection":
			return { ...state, ...createJiraKanbanSelectionState() };
	}
}
