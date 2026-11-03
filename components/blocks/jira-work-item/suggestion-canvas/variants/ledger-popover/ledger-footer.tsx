"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One segment per suggestion, in ledger order, so progress also shows where the decisions landed. */
function ProgressSegments({ review, ordered }: Readonly<{ review: SuggestionReview; ordered: readonly WorkItemSuggestion[] }>) {
	return (
		<span aria-hidden="true" className="flex gap-0.5">
			{ordered.map((suggestion) => {
				const decision = review.decisionOf(suggestion.id);
				return (
					<span
						className={cn(
							"h-1 w-3 rounded-full transition-colors duration-normal ease-out-practical",
							decision === "accepted" ? "bg-icon-success" : decision === "dismissed" ? "bg-icon-subtlest" : "bg-bg-neutral-hovered",
						)}
						key={suggestion.id}
					/>
				);
			})}
		</span>
	);
}

/** Caught up: the reviewed rows fold away behind this one quiet disclosure. The tally lives in the status line above. */
function ReviewedToggle({ open, controls, onToggle }: Readonly<{ open: boolean; controls: string; onToggle: () => void }>) {
	return (
		<button
			aria-controls={controls}
			aria-expanded={open}
			className="-ml-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
			onClick={onToggle}
			type="button"
		>
			<span>{open ? "Hide reviewed" : "Show reviewed"}</span>
			<span className={cn("flex text-icon-subtlest transition-transform duration-medium ease-in-out", open ? "rotate-180" : null)}>
				<ChevronDownIcon color="currentColor" label="" size="small" />
			</span>
		</button>
	);
}

export interface LedgerFooterProps {
	review: SuggestionReview;
	ordered: readonly WorkItemSuggestion[];
	/** Rows continue below the fold: a hairline separates them from the footer. */
	moreBelow: boolean;
	reviewedOpen: boolean;
	reviewedListId: string;
	onToggleReviewed: () => void;
	onAcceptAll: () => void;
	onDismissAll: () => void;
	onClose: () => void;
}

export function LedgerFooter({ review, ordered, moreBelow, reviewedOpen, reviewedListId, onToggleReviewed, onAcceptAll, onDismissAll, onClose }: Readonly<LedgerFooterProps>) {
	const total = ordered.length;
	const reviewed = total - review.pending.length;
	const done = review.pending.length === 0;
	return (
		<footer
			className={cn(
				"relative flex min-h-[52px] items-center gap-2 px-4 py-2.5",
				"before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border before:transition-opacity before:duration-fast before:ease-out-practical",
				moreBelow ? "before:opacity-100" : "before:opacity-0",
			)}
		>
			{done ? (
				<>
					<div className="min-w-0 flex-1">
						<ReviewedToggle controls={reviewedListId} onToggle={onToggleReviewed} open={reviewedOpen} />
					</div>
					<Button onClick={onClose} type="button" variant="ghost">Done</Button>
				</>
			) : (
				<>
					<div className="flex min-w-0 flex-1 flex-col gap-1.5">
						<span className="text-xs leading-4 text-text-subtlest tabular-nums">
							<span className="text-text-subtle">{reviewed}</span> of {total} reviewed
						</span>
						<ProgressSegments ordered={ordered} review={review} />
					</div>
					<Button onClick={onDismissAll} type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={onAcceptAll} type="button">Accept all</Button>
				</>
			)}
		</footer>
	);
}
