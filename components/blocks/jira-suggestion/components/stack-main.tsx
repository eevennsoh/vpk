"use client";

import type { SuggestionReview } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { cn } from "@/lib/utils";

import { CardValue } from "./card-value";

/** The shell's left column, with the description filled in once its suggestion is accepted. */
export function StackMain({ review, highlighted }: Readonly<{ review: SuggestionReview; highlighted: boolean }>) {
	const description = review.suggestions.find((suggestion) => suggestion.id === "description");
	const accepted = description != null && review.decisionOf(description.id) === "accepted";
	return (
		<div className="flex flex-col gap-6">
			<div className="relative">
				<span aria-hidden="true" className={cn("absolute inset-y-0.5 -left-3 w-0.5 rounded-full bg-border-success transition-opacity duration-slow ease-out", highlighted ? "opacity-100" : "opacity-0")} />
				{accepted ? <CardValue value={description.value} /> : <p className="text-sm text-text-subtlest">Add description</p>}
			</div>
			<div className="flex w-fit gap-0.5 rounded-md bg-bg-neutral p-0.5 text-sm">
				<span className="rounded-sm bg-surface px-2.5 py-1 text-text shadow-sm">Activity</span>
				<span className="px-2.5 py-1 text-text-subtle">Audit</span>
			</div>
			<div className="rounded-lg border border-border px-3 py-2.5 text-sm text-text-subtlest">Add a comment…</div>
		</div>
	);
}
