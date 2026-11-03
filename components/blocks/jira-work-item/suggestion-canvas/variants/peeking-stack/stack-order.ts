import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";

/** Newest run first, each run in the agent's order, so fresh cards land on top of the deck. */
export function stackOrder(feed: SuggestionFeed): readonly WorkItemSuggestion[] {
	const byId = new Map(feed.review.suggestions.map((suggestion) => [suggestion.id, suggestion]));
	return feed.runs.toReversed().flatMap((run) => run.ids.flatMap((id) => byId.get(id) ?? []));
}

/** Pending cards in deck order: the top card is the next one the stack offers. */
export function pendingDeck(feed: SuggestionFeed): readonly WorkItemSuggestion[] {
	return stackOrder(feed).filter((suggestion) => feed.review.decisionOf(suggestion.id) === "pending");
}

/** The run number that last delivered suggestions, or 0. Changes exactly when new cards arrive. */
export function arrivalRunOf(feed: SuggestionFeed): number {
	const latest = feed.runs.at(-1);
	return latest && latest.ids.length > 0 ? latest.number : 0;
}

export type StackStatus = "running" | "caughtUp" | "nothingNew" | null;

/** True when the latest re-run came back empty. Holds whether or not anything is still pending. */
export function lastRunFoundNothing(feed: SuggestionFeed): boolean {
	const last = feed.runs.at(-1);
	return feed.runs.length > 1 && last?.ids.length === 0;
}

/**
 * The one status the stack reports beyond its count, if any. Caught up wins over "nothing new" as a state, but
 * the caught-up row itself reports the empty re-run (see `lastRunFoundNothing`), so a check is never silent.
 */
export function stackStatusOf(feed: SuggestionFeed): StackStatus {
	if (feed.status === "running") return "running";
	if (feed.review.pending.length === 0) return "caughtUp";
	return lastRunFoundNothing(feed) ? "nothingNew" : null;
}

export type { SuggestionFieldId };

/** What a polite live region says about the latest run while the list is closed. */
export function runAnnouncement(feed: SuggestionFeed): string {
	if (feed.status === "running") return "Checking for new suggestions";
	if (!lastRunFoundNothing(feed)) return "";
	return `Checked just now${feed.review.pending.length === 0 ? ", all caught up" : ""}. Nothing new.`;
}
