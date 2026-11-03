"use client";

import type { SuggestionReview } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { cn } from "@/lib/utils";

import { PeekValue } from "./value";

/** The shell's left column, with the description filled in once its suggestion is accepted. */
export function PeekMain({ review, highlighted }: Readonly<{ review: SuggestionReview; highlighted: boolean }>) {
	const description = review.suggestions.find((suggestion) => suggestion.id === "description");
	const accepted = description != null && review.decisionOf(description.id) === "accepted";
	return (
		<div className="flex flex-col gap-6">
			<div className={cn("-mx-2 -my-1 rounded-md px-2 py-1 transition-colors duration-slow ease-out", highlighted ? "bg-bg-success-subtler" : null)}>
				{accepted ? <PeekValue value={description.value} /> : <p className="text-sm text-text-subtlest">Add description</p>}
			</div>
			<div className="flex w-fit gap-0.5 rounded-md bg-bg-neutral p-0.5 text-sm">
				<span className="rounded-sm bg-surface px-2.5 py-1 text-text shadow-sm">Activity</span>
				<span className="px-2.5 py-1 text-text-subtle">Audit</span>
			</div>
			<div className="rounded-lg border border-border px-3 py-2.5 text-sm text-text-subtlest">Add a comment…</div>
		</div>
	);
}
