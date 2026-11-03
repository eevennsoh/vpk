"use client";

import { useId } from "react";
import { motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { Button } from "@/components/ui/button";
import { motionRecipe } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import type { FocusDeck } from "./use-focus-deck";

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

export function summaryLine(review: SuggestionReview): string {
	const filled = review.accepted.length;
	const dismissed = review.dismissed.length;
	if (filled === 0) return `${plural(dismissed, "suggestion", "suggestions")} dismissed`;
	if (dismissed === 0) return `${plural(filled, "field", "fields")} filled`;
	return `${plural(filled, "field", "fields")} filled, ${dismissed} dismissed`;
}

/** Shown once every suggestion is decided: the outcome, per-item Undo, and a replay. */
export function CompletionSummary({ review, deck }: Readonly<{ review: SuggestionReview; deck: FocusDeck }>) {
	const titleId = useId();
	return (
		<article aria-labelledby={titleId} className="flex min-h-0 flex-col rounded-2xl bg-surface-raised" style={{ boxShadow: token("elevation.shadow.raised") }}>
			<header className="flex flex-col items-center gap-3 px-6 pt-7 pb-5 text-center">
				<motion.span
					animate={{ opacity: 1, scale: 1 }}
					className="flex size-12 items-center justify-center rounded-full bg-bg-success text-icon-success ring-8 ring-bg-success/40"
					initial={{ opacity: 0, scale: 0.6 }}
					transition={motionRecipe.avatar.enter}
					style={{ willChange: "transform, opacity" }}
				>
					<CheckMarkIcon color="currentColor" label="" />
				</motion.span>
				<div className="flex flex-col gap-1">
					<h2 className="text-text" id={titleId} style={{ font: token("font.heading.medium") }}>Review complete</h2>
					<p className="text-sm text-text-subtle">{summaryLine(review)}{review.accepted.length > 0 ? " · now showing in Details" : ""}</p>
				</div>
			</header>
			<ol aria-label="Decisions" className="flex min-h-0 flex-col overflow-y-auto border-t border-border px-3 py-2">
				{review.suggestions.map((suggestion) => {
					const accepted = review.decisionOf(suggestion.id) === "accepted";
					return (
						<li className="flex items-start gap-3 rounded-lg px-3 py-2" key={suggestion.id}>
							<span className={cn("mt-0.5 flex size-4 shrink-0", accepted ? "text-icon-success" : "text-icon-subtlest")}>
								{accepted ? <CheckCircleIcon color="currentColor" label="Accepted" size="small" /> : <CrossCircleIcon color="currentColor" label="Dismissed" size="small" />}
							</span>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="text-sm leading-5 font-medium text-text">{suggestion.label}</span>
								<span className={cn("text-xs text-pretty", accepted ? "text-text-subtle" : "text-text-subtlest")}>{accepted ? suggestion.valueText : "Dismissed · field left empty"}</span>
							</span>
							<Button aria-label={`Undo ${suggestion.label} decision`} onClick={() => deck.undo(suggestion.id)} size="compact" type="button" variant="ghost">Undo</Button>
						</li>
					);
				})}
			</ol>
			<footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
				<span className="text-xs text-text-subtlest">Undo any row to review it again</span>
				<Button onClick={deck.reviewAgain} type="button" variant="outline">
					<RefreshIcon label="" size="small" />
					Review again
				</Button>
			</footer>
		</article>
	);
}
