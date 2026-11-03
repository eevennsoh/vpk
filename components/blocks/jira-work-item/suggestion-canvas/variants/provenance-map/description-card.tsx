"use client";

import { cn } from "@/lib/utils";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";

/**
 * Jira keeps Description in the main column, which this variant gives to the provenance map, and the
 * shared Details rail has no Description row. This small card shows where an accepted description lands.
 */
export function DescriptionCard({ suggestion, review, highlighted }: Readonly<{ suggestion: WorkItemSuggestion; review: SuggestionReview; highlighted: boolean }>) {
	const accepted = review.decisionOf(suggestion.id) === "accepted";
	return (
		<section aria-label="Description" className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
			<h2 className="px-1 text-sm font-semibold text-text">Description</h2>
			<div className={cn("rounded-md px-1 py-1.5 transition-colors duration-slow ease-out", highlighted ? "bg-bg-success-subtler" : null)}>
				{accepted && suggestion.value.kind === "paragraph" ? (
					<p className="text-sm text-pretty text-text">{suggestion.value.text}</p>
				) : (
					<p className="text-sm text-text-subtlest">{suggestion.currentDisplay}</p>
				)}
			</div>
		</section>
	);
}
