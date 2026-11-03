"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { DecidedStatus, DecisionPair, NewMark, QUIET_BUTTON, SuggestionCardBody, useUndoFocus } from "./card-parts";

export interface ListCardProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	isNew: boolean;
	whyMaxHeight?: number;
	onAccept: () => void;
	onDismiss: () => void;
	onUndo: () => void;
}

const UNFOLD = { duration: motionDuration.medium, ease: motionEase.inOut };
const FOLD = { duration: motionDuration.normal, ease: motionEase.in };
/** Arrivals unfold a touch slower than a fold so the eye catches where they land. */
const ARRIVE = { duration: motionDuration.slow, ease: motionEase.inOut };

/**
 * One card of the fanned-out deck: a soft borderless tile with the field label above the full value, the reason as
 * one quiet line that opens the why card, and a ✕|✓ pair. A decision folds the tile into a quiet receipt in place,
 * so Undo stays exactly where the decision was made.
 */
export function ListCard({ suggestion, decision, isNew, whyMaxHeight, onAccept, onDismiss, onUndo }: Readonly<ListCardProps>) {
	const rowRef = useRef<HTMLLIElement>(null);
	const pending = decision === "pending";
	const { undoRef, markDeciding } = useUndoFocus(decision);
	const decide = (action: () => void) => () => {
		markDeciding();
		action();
	};
	return (
		<motion.li
			animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
			aria-label={`${isNew ? "New: " : ""}${suggestion.label}: ${suggestion.valueText}`}
			className="relative"
			data-decision={decision}
			exit={{ height: 0, opacity: 0, overflow: "hidden", transition: FOLD }}
			initial={{ height: 0, opacity: 0, overflow: "hidden" }}
			ref={rowRef}
			transition={ARRIVE}
		>
			<div
				className={cn(
					"rounded-lg px-2 transition-[background-color,padding] duration-medium ease-in-out",
					pending ? "bg-surface-sunken pt-2 pb-2.5 dark:bg-bg-neutral-subtle-hovered" : "bg-transparent py-0.5",
				)}
			>
				<div className="flex min-h-7 items-center gap-2">
					<span className={cn("text-xs", pending ? "text-text-subtle" : "text-text-subtlest")}>{suggestion.label}</span>
					{pending ? (isNew ? <NewMark /> : null) : <DecidedStatus decision={decision} />}
					<span className="flex-1" />
					{pending ? (
						<DecisionPair label={suggestion.label} onAccept={decide(onAccept)} onDismiss={decide(onDismiss)} />
					) : (
						<button aria-label={`Undo ${suggestion.label} ${decision === "accepted" ? "accept" : "dismiss"}`} className={cn(QUIET_BUTTON, "-mr-1.5")} onClick={onUndo} ref={undoRef} type="button">Undo</button>
					)}
				</div>
				<AnimatePresence initial={false}>
					{pending ? (
						<motion.div
							animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
							exit={{ height: 0, opacity: 0, overflow: "hidden", transition: FOLD }}
							initial={{ height: 0, opacity: 0, overflow: "hidden" }}
							key="body"
							transition={UNFOLD}
						>
							<div className="flex flex-col items-start gap-1.5 pt-0.5">
								<SuggestionCardBody layout="row" suggestion={suggestion} whyAnchor={rowRef} whyMaxHeight={whyMaxHeight} />
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</motion.li>
	);
}
