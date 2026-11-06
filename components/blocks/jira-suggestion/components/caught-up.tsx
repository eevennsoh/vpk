"use client";

import type { Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { motionRecipe } from "@/lib/motion";
import { token } from "@/lib/tokens";

import { FADE_OUT, FAN, INSTANT } from "./constants";
import type { Deck } from "./use-deck";

/** What is happening or was decided: the check in flight, a check that found nothing, or the tally of decisions. */
function summary(feed: SuggestionFeed, deck: Deck): string {
	if (feed.status === "running") return "Checking for anything new…";
	if (deck.quietCheck) return "Nothing new since you last checked";
	const added = feed.review.accepted.length;
	const dismissed = feed.review.dismissed.length;
	return [added > 0 ? `${added} added` : null, dismissed > 0 ? `${dismissed} dismissed` : null].filter(Boolean).join(" · ") || "Nothing left to review";
}

/**
 * The empty stack at its natural height: one calm confirmation, a single summary line, then Undo for the last
 * decision (even a bulk one) beside Check again. A check runs in place: the line and the button say so while the
 * layout holds still, so a check that finds nothing never makes the popover jump; only real finds replace it.
 */
export function CaughtUp({ feed, deck, checkRef, onUndo }: Readonly<{ feed: SuggestionFeed; deck: Deck; checkRef: Ref<HTMLButtonElement>; onUndo: () => void }>) {
	const running = feed.status === "running";
	const line = summary(feed, deck);
	const last = deck.lastDecision;
	const reduced = useReducedMotion() ?? false;
	return (
		<motion.div animate={{ opacity: 1, transition: motionRecipe.popup.enter }} className="flex flex-col items-center gap-3.5 px-4 pt-5 pb-3 text-center" initial={{ opacity: 0 }}>
			<span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-bg-success text-icon-success">
				<CheckMarkIcon color="currentColor" label="" />
			</span>
			<div className="flex flex-col items-center gap-0.5">
				<p className="text-text" style={{ font: token("font.heading.xsmall") }}>All caught up</p>
				<p aria-live="polite" className="grid text-sm leading-5 text-text-subtle">
					<AnimatePresence initial={false} mode="popLayout">
						<motion.span
							animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
							className="col-start-1 row-start-1"
							exit={{ opacity: 0, y: -4, transition: motionRecipe.popup.exit }}
							initial={{ opacity: 0, y: 4 }}
							key={line}
						>
							{line}
						</motion.span>
					</AnimatePresence>
				</p>
			</div>
			{/* Undo steps aside while a check runs (never a dead disabled button); Check again glides to centre and back. */}
			<div className="flex items-center justify-center gap-2 pt-0.5">
				<AnimatePresence initial={false} mode="popLayout">
					{last && !running ? (
						<motion.div
							animate={{ opacity: 1, scale: 1, transition: reduced ? INSTANT : FAN }}
							exit={{ opacity: 0, scale: 0.8, transition: reduced ? INSTANT : FADE_OUT }}
							initial={{ opacity: 0, scale: 0.8 }}
							key="undo"
						>
							<Button aria-label={deck.undoLabel ?? "Undo"} onClick={onUndo} type="button" variant="outline">Undo</Button>
						</motion.div>
					) : null}
					<motion.div key="check" layout="position" transition={reduced ? INSTANT : FAN}>
						<Button aria-disabled={running || undefined} onClick={running ? undefined : feed.rerun} ref={checkRef} type="button" variant="outline">
							Check again
						</Button>
					</motion.div>
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
