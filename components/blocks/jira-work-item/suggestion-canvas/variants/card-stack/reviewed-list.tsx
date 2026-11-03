"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";

import type { SuggestionFieldId, SuggestionValue, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const QUIET_LINK =
	"inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring";

export function decisionSummary(review: SuggestionReview): string {
	const added = review.accepted.length;
	const dismissed = review.dismissed.length;
	return [added > 0 ? `${added} added` : null, dismissed > 0 ? `${dismissed} dismissed` : null].filter(Boolean).join(" · ");
}

/**
 * A short, complete reminder of what was decided, so a row's Undo is an informed choice. Short values show in full;
 * long ones are described (never cut off): the full value is one Undo away on the card.
 */
function valueGist(value: SuggestionValue): string {
	switch (value.kind) {
		case "paragraph":
			return `Paragraph · ${value.text.split(/\s+/).length} words`;
		case "date":
			return value.display;
		case "person":
			return value.person.name;
		case "issue":
			return `${value.issue.key} ${value.issue.summary}`;
		case "labels":
			return value.labels.join(", ");
		case "checklist":
			return `${value.items.length} criteria`;
		default: {
			const unreachable: never = value;
			return unreachable;
		}
	}
}

/** A quiet link to the reviewed list: a list mark while it is closed, a back arrow once it replaces the deck. */
export function ReviewedToggle({ open, controls, onToggle, children, className }: Readonly<{ open: boolean; controls: string; onToggle: () => void; children: ReactNode; className?: string }>) {
	return (
		<button aria-controls={controls} aria-expanded={open} className={cn(QUIET_LINK, "whitespace-nowrap text-text-subtle hover:text-text", className)} onClick={onToggle} type="button">
			<span className="flex text-icon-subtlest">
				{open ? <ArrowLeftIcon color="currentColor" label="" size="small" /> : <ListBulletedIcon color="currentColor" label="" size="small" />}
			</span>
			<span className="tabular-nums">{children}</span>
		</button>
	);
}

/** Every decision so far, newest first, each with its own Undo that puts the card back on top of the deck. */
export function ReviewedList({ id, reviewed, review, onRestore }: Readonly<{ id: string; reviewed: readonly WorkItemSuggestion[]; review: SuggestionReview; onRestore: (id: SuggestionFieldId) => void }>) {
	return (
		<motion.ul
			animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
			aria-label="Reviewed suggestions"
			className="flex flex-col"
			id={id}
			initial={{ opacity: 0, y: -4 }}
		>
			{reviewed.map((suggestion) => {
				const accepted = review.decisionOf(suggestion.id) === "accepted";
				return (
					<li className="flex items-start gap-2.5 py-1.5 text-sm" key={suggestion.id}>
						<span className={cn("mt-0.5 flex shrink-0", accepted ? "text-icon-success" : "text-icon-subtlest")}>
							{accepted ? <CheckMarkIcon color="currentColor" label="Added" size="small" /> : <CrossIcon color="currentColor" label="Dismissed" size="small" />}
						</span>
						<span className="flex min-w-0 flex-1 flex-col">
							<span className={cn("leading-5", accepted ? "text-text" : "text-text-subtle")}>{suggestion.label}</span>
							<span className="text-xs leading-4 text-pretty text-text-subtlest">{valueGist(suggestion.value)}</span>
						</span>
						<button aria-label={`Undo ${suggestion.label.toLowerCase()}`} className={cn(QUIET_LINK, "-mr-1.5 shrink-0 text-text-subtlest hover:text-text-subtle")} onClick={() => onRestore(suggestion.id)} type="button">
							Undo
						</button>
					</li>
				);
			})}
		</motion.ul>
	);
}
