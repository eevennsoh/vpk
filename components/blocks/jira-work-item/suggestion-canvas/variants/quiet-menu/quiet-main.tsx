"use client";

import { cn } from "@/lib/utils";

import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { QuietValue } from "./quiet-value";

/** Clearance from the menu's left edge to the main column's text, so the description stays readable beside it. */
const MENU_CLEARANCE = 16;

/**
 * The shell's left column, with the description filled in once its suggestion is accepted. While the menu is open,
 * an accepted description reflows into the space the menu leaves free, so it is visible rather than hidden beneath;
 * the empty placeholder never moves, so opening the menu leaves the page untouched.
 */
export function QuietMain({ review, highlighted, reserve }: Readonly<{ review: SuggestionReview; highlighted: boolean; reserve: number }>) {
	const description = review.suggestions.find((suggestion) => suggestion.id === "description");
	const accepted = description != null && review.decisionOf(description.id) === "accepted";
	return (
		<div className="flex flex-col gap-6">
			<div
				className={cn("-mx-2 -my-1 rounded-md px-2 py-1 transition-colors duration-slow ease-out", highlighted ? "bg-bg-success" : null)}
				style={reserve > 0 && accepted ? { maxWidth: `calc(100% - ${reserve + MENU_CLEARANCE}px)` } : undefined}
			>
				{accepted ? <QuietValue value={description.value} /> : <p className="text-sm text-text-subtlest">Add description</p>}
			</div>
			<div className="flex w-fit gap-0.5 rounded-md bg-bg-neutral p-0.5 text-sm">
				<span className="rounded-sm bg-surface px-2.5 py-1 text-text shadow-sm">Activity</span>
				<span className="px-2.5 py-1 text-text-subtle">Audit</span>
			</div>
			<div className="rounded-lg border border-border px-3 py-2.5 text-sm text-text-subtlest">Add a comment…</div>
		</div>
	);
}
