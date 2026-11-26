"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FOLLOW_UP_SUGGESTIONS, WORK_ITEM_SUGGESTIONS, type SuggestionFieldId, type WorkItemSuggestion } from "../data/suggestions";
import { useSuggestionReview, type SuggestionReview } from "./use-suggestion-review";

/** Simulated agent latency for a re-run, long enough to read as real work while the panel waits folded. */
export const SUGGESTION_RERUN_MS = 3200;

export interface SuggestionRun {
	/** 1-based run number. */
	number: number;
	/** When the run finished, in epoch milliseconds. */
	at: number;
	/** Suggestions this run added. Empty when the run found nothing new. */
	ids: readonly SuggestionFieldId[];
}

export type SuggestionFeedStatus = "idle" | "running";

export interface SuggestionFeed {
	onOpenReview?: (panelId: string) => void;
	onPreviewCard?: (card: Pick<WorkItemSuggestion, "id" | "valueText"> | null) => void;
	review: SuggestionReview;
	status: SuggestionFeedStatus;
	/** Oldest first. */
	runs: readonly SuggestionRun[];
	/** Ids added by the most recent run that have not yet been decided or acknowledged. */
	newIds: ReadonlySet<SuggestionFieldId>;
	/** Mark new suggestions as seen, e.g. once the user has looked at them. */
	acknowledgeNew: () => void;
	/** Re-run the agent and publish any suggestions it finds. */
	rerun: () => void;
	/** Stop a running re-run without publishing anything; the review stays as it was. */
	cancelRerun: () => void;
	/** True while another re-run would still find suggestions. */
	hasMore: boolean;
}

/**
 * Ongoing suggestions for one preview: the agent has already run once, and can run again as the work item changes.
 * Synthetic and local; nothing is fetched or written.
 */
export function useSuggestionFeed(): SuggestionFeed {
	const [suggestions, setSuggestions] = useState<readonly WorkItemSuggestion[]>(WORK_ITEM_SUGGESTIONS);
	const [runs, setRuns] = useState<readonly SuggestionRun[]>(() => [{ number: 1, at: Date.now() - 2 * 60_000, ids: WORK_ITEM_SUGGESTIONS.map((suggestion) => suggestion.id) }]);
	const [status, setStatus] = useState<SuggestionFeedStatus>("idle");
	const [newIds, setNewIds] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const timer = useRef(0);
	const review = useSuggestionReview(suggestions);
	const hasMore = FOLLOW_UP_SUGGESTIONS.some((suggestion) => !suggestions.some((existing) => existing.id === suggestion.id));

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const rerun = useCallback(() => {
		if (status === "running") return;
		setStatus("running");
		timer.current = window.setTimeout(() => {
			const added = FOLLOW_UP_SUGGESTIONS.filter((suggestion) => !suggestions.some((existing) => existing.id === suggestion.id));
			setSuggestions((current) => [...current, ...added]);
			setRuns((current) => [...current, { number: current.length + 1, at: Date.now(), ids: added.map((suggestion) => suggestion.id) }]);
			setNewIds(new Set(added.map((suggestion) => suggestion.id)));
			setStatus("idle");
		}, SUGGESTION_RERUN_MS);
	}, [status, suggestions]);

	const cancelRerun = useCallback(() => {
		window.clearTimeout(timer.current);
		setStatus("idle");
	}, []);

	const acknowledgeNew = useCallback(() => setNewIds(new Set()), []);
	const unseen = new Set([...newIds].filter((id) => review.decisionOf(id) === "pending"));

	return { review, status, runs, newIds: unseen, acknowledgeNew, rerun, cancelRerun, hasMore };
}
