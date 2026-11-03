"use client";

import { useCallback, useMemo, useReducer } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "./data/suggestions";

export type SuggestionDecision = "pending" | "accepted" | "dismissed";

type ReviewAction =
	| { type: "decide"; id: SuggestionFieldId; decision: SuggestionDecision }
	| { type: "decideMany"; ids: readonly SuggestionFieldId[]; decision: Exclude<SuggestionDecision, "pending"> }
	| { type: "reset" };

/** Missing ids are pending, so suggestions that arrive on a later run start undecided. */
type DecisionMap = Readonly<Partial<Record<SuggestionFieldId, SuggestionDecision>>>;

function reviewReducer(state: DecisionMap, action: ReviewAction): DecisionMap {
	switch (action.type) {
		case "decide":
			return { ...state, [action.id]: action.decision };
		case "decideMany":
			return { ...state, ...Object.fromEntries(action.ids.map((id) => [id, action.decision])) };
		case "reset":
			return {};
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
	/** Accept every pending suggestion. Already decided ones keep their decision. */
	acceptAll: () => void;
	dismissAll: () => void;
	/** Restore every suggestion to pending, for replaying the demo. */
	reset: () => void;
}

/** Local, synthetic review state for one canvas preview. Nothing is written anywhere. `suggestions` may grow. */
export function useSuggestionReview(suggestions: readonly WorkItemSuggestion[]): SuggestionReview {
	const [decisions, dispatch] = useReducer(reviewReducer, {});

	const accept = useCallback((id: SuggestionFieldId) => dispatch({ type: "decide", id, decision: "accepted" }), []);
	const dismiss = useCallback((id: SuggestionFieldId) => dispatch({ type: "decide", id, decision: "dismissed" }), []);
	const undo = useCallback((id: SuggestionFieldId) => dispatch({ type: "decide", id, decision: "pending" }), []);
	const reset = useCallback(() => dispatch({ type: "reset" }), []);

	return useMemo(() => {
		const decisionOf = (id: SuggestionFieldId) => decisions[id] ?? "pending";
		const pending = suggestions.filter((suggestion) => decisionOf(suggestion.id) === "pending");
		const pendingIds = pending.map((suggestion) => suggestion.id);
		return {
			suggestions,
			decisionOf,
			pending,
			accepted: suggestions.filter((suggestion) => decisionOf(suggestion.id) === "accepted"),
			dismissed: suggestions.filter((suggestion) => decisionOf(suggestion.id) === "dismissed"),
			accept,
			dismiss,
			undo,
			acceptAll: () => dispatch({ type: "decideMany", ids: pendingIds, decision: "accepted" }),
			dismissAll: () => dispatch({ type: "decideMany", ids: pendingIds, decision: "dismissed" }),
			reset,
		};
	}, [accept, decisions, dismiss, reset, suggestions, undo]);
}
