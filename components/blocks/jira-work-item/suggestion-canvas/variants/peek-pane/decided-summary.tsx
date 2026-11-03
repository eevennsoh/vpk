"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { motionDuration, motionEase, motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { DecidedLine, type Decided } from "./decided-line";

const UNFOLD = { duration: motionDuration.medium, ease: motionEase.inOut };
const FOLD = { duration: motionDuration.normal, ease: motionEase.in };

function countsLine(review: SuggestionReview, settled: readonly WorkItemSuggestion[]): string {
	const added = settled.filter((suggestion) => review.decisionOf(suggestion.id) === "accepted").length;
	const dismissed = settled.length - added;
	return [added > 0 ? `${added} added` : null, dismissed > 0 ? `${dismissed} dismissed` : null].filter(Boolean).join(" · ");
}

export interface DecidedSummaryProps {
	review: SuggestionReview;
	settled: readonly WorkItemSuggestion[];
	/** Caught up: the hero already states the counts, so the disclosure only names the list. */
	caughtUp: boolean;
	onUndo: (id: SuggestionFieldId, keyboard: boolean) => void;
}

/** Every earlier decision folded behind one quiet disclosure; opening it lists each field with its own Undo. */
export function DecidedSummary({ review, settled, caughtUp, onUndo }: Readonly<DecidedSummaryProps>) {
	const [open, setOpen] = useState(false);
	const listId = useId();
	if (settled.length === 0) return null;
	return (
		<div className="mx-1.5">
			<button
				aria-controls={listId}
				aria-expanded={open}
				className="flex h-8 w-full items-center gap-1.5 rounded-lg px-2.5 text-left text-xs leading-4 text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
				onClick={() => setOpen((current) => !current)}
				type="button"
			>
				<span className="flex-1">{caughtUp ? `${open ? "Hide" : "Show"} ${settled.length} decisions` : `${settled.length} reviewed earlier`}</span>
				{caughtUp ? null : <span className="text-text-subtlest">{countsLine(review, settled)}</span>}
				<span className={cn("flex text-icon-subtlest transition-transform duration-normal ease-in-out", open ? "rotate-180" : null)}>
					<ChevronDownIcon color="currentColor" label="" size="small" />
				</span>
			</button>
			<AnimatePresence initial={false}>
				{open ? (
					<motion.ul
						animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
						aria-label="Earlier decisions"
						exit={{ height: 0, opacity: 0, overflow: "hidden", transition: FOLD }}
						id={listId}
						initial={{ height: 0, opacity: 0, overflow: "hidden" }}
						transition={UNFOLD}
					>
						{settled.map((suggestion) => (
							<li className="px-2.5 py-1" data-peek-row={suggestion.id} key={suggestion.id}>
								<DecidedLine decision={review.decisionOf(suggestion.id) as Decided} id={suggestion.id} label={suggestion.label} onUndo={(keyboard) => onUndo(suggestion.id, keyboard)} recent={false} />
							</li>
						))}
					</motion.ul>
				) : null}
			</AnimatePresence>
		</div>
	);
}

export interface CaughtUpProps {
	review: SuggestionReview;
	settled: readonly WorkItemSuggestion[];
	lastBatch: ReadonlySet<SuggestionFieldId>;
	/** `keyboard` is true when Undo was pressed from a key. */
	onUndoBatch: (keyboard: boolean) => void;
}

/** Names exactly what Undo will revert: a bulk action by its verb, a single decision by its field. */
function batchUndoLabel(review: SuggestionReview, batch: readonly SuggestionFieldId[]): string {
	if (batch.length === 1) {
		const only = review.suggestions.find((suggestion) => suggestion.id === batch[0]);
		return only ? `Undo ${only.label}` : "Undo";
	}
	const decisions = new Set(batch.map((id) => review.decisionOf(id)));
	if (decisions.size === 1 && decisions.has("accepted")) return "Undo accept all";
	if (decisions.size === 1 && decisions.has("dismissed")) return "Undo dismiss all";
	return `Undo last ${batch.length}`;
}

/**
 * The payoff once nothing is pending: one calm statement of what landed in Details and an Undo that says what it
 * reverts. It is static on purpose: the header byline owns the agent's time, result and live state.
 */
export function CaughtUp({ review, settled, lastBatch, onUndoBatch }: Readonly<CaughtUpProps>) {
	const added = settled.filter((suggestion) => review.decisionOf(suggestion.id) === "accepted").length;
	const dismissed = settled.length - added;
	const headline = added > 0 ? `${added} added to Details` : "Nothing added";
	const batch = [...lastBatch].filter((id) => review.decisionOf(id) !== "pending");
	const undoLabel = batchUndoLabel(review, batch);
	return (
		<motion.div
			animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
			className="flex items-start gap-2.5 pt-2 pr-3 pb-3 pl-4"
			initial={{ opacity: 0, y: 4 }}
			style={{ willChange: "transform, opacity" }}
		>
			<span className="mt-0.5 flex shrink-0 text-icon-success"><CheckCircleIcon color="currentColor" label="" size="small" /></span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-sm leading-5 font-medium text-text">All caught up</p>
				<p className="text-sm leading-5 text-text-subtle">
					{headline}
					{dismissed > 0 ? <span className="text-text-subtlest">{` · ${dismissed} dismissed`}</span> : null}
				</p>
			</div>
			{batch.length > 0 ? (
				<button
					aria-label={batch.length === 1 ? undoLabel : `${undoLabel}, ${batch.length} decisions`}
					className="-my-0.5 inline-flex h-6 shrink-0 items-center rounded-md px-1.5 text-xs font-medium text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
					data-peek-focus="batch-undo"
					onClick={(event) => onUndoBatch(event.detail === 0)}
					type="button"
				>
					{undoLabel}
				</button>
			) : null}
		</motion.div>
	);
}
