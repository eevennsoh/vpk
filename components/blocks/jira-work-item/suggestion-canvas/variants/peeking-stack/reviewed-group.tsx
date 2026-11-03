"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { DecidedStatus, QUIET_BUTTON } from "./card-parts";

const UNFOLD = { duration: motionDuration.medium, ease: motionEase.inOut };
const FOLD = { duration: motionDuration.normal, ease: motionEase.in };

/** Undo stays in the tab order; it fades in on row hover or keyboard focus, and always shows on touch screens. */
const REVEALED_UNDO = cn(
	QUIET_BUTTON,
	"-mr-1.5 opacity-0 transition-[opacity,background-color] group-hover/receipt:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
);

function tallyOf(review: SuggestionReview, items: readonly WorkItemSuggestion[]): string {
	const accepted = items.filter((item) => review.decisionOf(item.id) === "accepted").length;
	const dismissed = items.length - accepted;
	return [accepted > 0 ? `${accepted} applied` : null, dismissed > 0 ? `${dismissed} dismissed` : null].filter(Boolean).join(", ");
}

/**
 * Decisions made before this look at the list, folded into one quiet line. Expanding it lists each as a hairline-free
 * receipt; Undo sends a card straight back into the deck above.
 */
export function ReviewedGroup({ items, review, groupId }: Readonly<{ items: readonly WorkItemSuggestion[]; review: SuggestionReview; groupId: string }>) {
	const [expanded, setExpanded] = useState(false);
	return (
		<div className="flex flex-col">
			<button
				aria-controls={groupId}
				aria-expanded={expanded}
				className="group/reviewed flex h-8 items-center gap-1.5 rounded-md px-2 text-left text-xs text-text-subtlest outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring"
				onClick={() => setExpanded((current) => !current)}
				type="button"
			>
				<span className="text-text-subtle tabular-nums">{items.length} reviewed</span>
				<span aria-hidden="true">·</span>
				<span className="min-w-0 flex-1 tabular-nums">{tallyOf(review, items)}</span>
				<span aria-hidden="true" className="flex shrink-0 text-icon-subtlest transition-transform duration-normal ease-out-practical group-aria-expanded/reviewed:rotate-180">
					<ChevronDownIcon color="currentColor" label="" size="small" />
				</span>
			</button>
			<AnimatePresence initial={false}>
				{expanded ? (
					<motion.ul
						animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
						aria-label="Reviewed suggestions"
						className="flex flex-col"
						exit={{ height: 0, opacity: 0, overflow: "hidden", transition: FOLD }}
						id={groupId}
						initial={{ height: 0, opacity: 0, overflow: "hidden" }}
						transition={UNFOLD}
					>
						{items.map((item) => {
							const decision = review.decisionOf(item.id);
							if (decision === "pending") return null;
							return (
								<li className="group/receipt flex h-7 items-center gap-2 px-2" key={item.id}>
									<span className="text-xs text-text-subtlest">{item.label}</span>
									<DecidedStatus decision={decision} />
									<span className="flex-1" />
									<button aria-label={`Undo ${item.label} ${decision === "accepted" ? "accept" : "dismiss"}`} className={REVEALED_UNDO} onClick={(event) => {
										// The row leaves the group as its card returns to the deck; keep keyboard focus in the dialog.
										const dialog = event.currentTarget.closest<HTMLElement>("[role=dialog]");
										review.undo(item.id);
										dialog?.focus();
									}} type="button">Undo</button>
								</li>
							);
						})}
					</motion.ul>
				) : null}
			</AnimatePresence>
		</div>
	);
}
