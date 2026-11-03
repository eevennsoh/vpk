"use client";

import { useCallback, useMemo, useReducer } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "./data/suggestions";

export type SuggestionDecision = "pending" | "accepted" | "dismissed";

type ReviewAction =
	| { type: "decide"; id: SuggestionFieldId; decision: SuggestionDecision }
	| { type: "decideAll"; decision: Exclude<SuggestionDecision, "pending"> }
	| { type: "reset" };

type DecisionMap = Readonly<Record<SuggestionFieldId, SuggestionDecision>>;

function initialDecisions(suggestions: readonly WorkItemSuggestion[]): DecisionMap {
	return Object.fromEntries(suggestions.map((suggestion) => [suggestion.id, "pending"])) as DecisionMap;
}

function reviewReducer(state: DecisionMap, action: ReviewAction, initial: DecisionMap): DecisionMap {
	switch (action.type) {
		case "decide":
			return { ...state, [action.id]: action.decision };
		case "decideAll":
			return Object.fromEntries(
				Object.entries(state).map(([id, decision]) => [id, decision === "pending" ? action.decision : decision]),
			) as DecisionMap;
		case "reset":
			return initial;
		default: {
			const unreachable: never = action;
			return unreachable;
		}
	}
}

export interface SuggestionReview {
	suggestions: readonly WorkItemSuggestion[];
	decisionOf: (id: SuggestionFieldId) => SuggestionDecision;
	pending: readonly WorkItemSuggestion[];
	accepted: readonly WorkItemSuggestion[];
	dismissed: readonly WorkItemSuggestion[];
	accept: (id: SuggestionFieldId) => void;
	dismiss: (id: SuggestionFieldId) => void;
	/** Return one decided suggestion to pending. */
	undo: (id: SuggestionFieldId) => void;
	acceptAll: () => void;
	dismissAll: () => void;
	/** Restore every suggestion to pending, for replaying the demo. */
	reset: () => void;
}

/** Local, synthetic review state for one canvas preview. Nothing is written anywhere. */
export function useSuggestionReview(suggestions: readonly WorkItemSuggestion[]): SuggestionReview {
	const initial = useMemo(() => initialDecisions(suggestions), [suggestions]);
	const [decisions, dispatch] = useReducer(
		(state: DecisionMap, action: ReviewAction) => reviewReducer(state, action, initial),
		initial,
	);

	const accept = useCallback((id: SuggestionFieldId) => dispatch({ type: "decide", id, decision: "accepted" }), []);
	const dismiss = useCallback((id: SuggestionFieldId) => dispatch({ type: "decide", id, decision: "dismissed" }), []);
	const undo = useCallback((id: SuggestionFieldId) => dispatch({ type: "decide", id, decision: "pending" }), []);
	const acceptAll = useCallback(() => dispatch({ type: "decideAll", decision: "accepted" }), []);
	const dismissAll = useCallback(() => dispatch({ type: "decideAll", decision: "dismissed" }), []);
	const reset = useCallback(() => dispatch({ type: "reset" }), []);

	return useMemo(() => {
		const decisionOf = (id: SuggestionFieldId) => decisions[id] ?? "pending";
		return {
			suggestions,
			decisionOf,
			pending: suggestions.filter((suggestion) => decisionOf(suggestion.id) === "pending"),
			accepted: suggestions.filter((suggestion) => decisionOf(suggestion.id) === "accepted"),
			dismissed: suggestions.filter((suggestion) => decisionOf(suggestion.id) === "dismissed"),
			accept,
			dismiss,
			undo,
			acceptAll,
			dismissAll,
			reset,
		};
	}, [accept, acceptAll, decisions, dismiss, dismissAll, reset, suggestions, undo]);
}
