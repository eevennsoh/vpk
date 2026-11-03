"use client";

import { useState } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";

export interface DecidedHistory {
	/** Rows that stay in the list: everything pending, plus what was decided since the last settle point. */
	inline: readonly WorkItemSuggestion[];
	/** Decided before the last settle point, so they fold into one summary line. */
	settled: readonly WorkItemSuggestion[];
	/** The latest decision (one row, or a whole bulk action). Only it keeps Undo on screen. */
	lastBatch: ReadonlySet<SuggestionFieldId>;
	/** Record a decision. */
	record: (ids: readonly SuggestionFieldId[]) => void;
	/** A row returned to pending: it leaves the summary and the latest batch. */
	release: (ids: readonly SuggestionFieldId[]) => void;
}

function decidedIds(review: SuggestionReview): ReadonlySet<SuggestionFieldId> {
	return new Set(review.suggestions.filter((suggestion) => review.decisionOf(suggestion.id) !== "pending").map((suggestion) => suggestion.id));
}

/**
 * Splits decided suggestions into the ones still worth showing in place and a settled history.
 *
 * While a review is under way, a decision folds its row in place so nothing jumps under the pointer. At a settle
 * point (the popover opens, the last pending row is decided, or a re-run completes) everything decided so far moves
 * into one summary, so the list never becomes a column of identical "Added · Undo" lines. A run in flight changes
 * nothing, so the list never regroups under the reader while the agent is still looking.
 */
export function useDecidedHistory(review: SuggestionReview, rows: readonly WorkItemSuggestion[], runCount: number): DecidedHistory {
	const [settledIds, setSettledIds] = useState<ReadonlySet<SuggestionFieldId>>(() => decidedIds(review));
	const [lastBatch, setLastBatch] = useState<ReadonlySet<SuggestionFieldId>>(new Set());

	const caughtUp = review.suggestions.length > 0 && review.pending.length === 0;
	const settlePoint = caughtUp ? "caught-up" : `run-${runCount}`;
	const [lastSettlePoint, setLastSettlePoint] = useState(settlePoint);
	if (settlePoint !== lastSettlePoint) {
		setLastSettlePoint(settlePoint);
		setSettledIds(decidedIds(review));
	}

	const isSettled = (id: SuggestionFieldId) => settledIds.has(id) && review.decisionOf(id) !== "pending";
	return {
		inline: rows.filter((suggestion) => !isSettled(suggestion.id)),
		settled: rows.filter((suggestion) => isSettled(suggestion.id)),
		lastBatch,
		record: (ids) => setLastBatch(new Set(ids)),
		release: (ids) => {
			setSettledIds((current) => new Set([...current].filter((id) => !ids.includes(id))));
			setLastBatch((current) => new Set([...current].filter((id) => !ids.includes(id))));
		},
	};
}
