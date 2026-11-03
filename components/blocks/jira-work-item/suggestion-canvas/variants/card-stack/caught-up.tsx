"use client";

import type { Ref } from "react";
import { motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { motionRecipe } from "@/lib/motion";
import { token } from "@/lib/tokens";

import { UndoButton } from "./deck-controls";
import { decisionSummary } from "./reviewed-list";
import { lastRunFoundNothing } from "./run-status";
import type { Deck } from "./use-deck";

export interface CaughtUpProps {
	feed: SuggestionFeed;
	deck: Deck;
	checkRef: Ref<HTMLButtonElement>;
	onUndo: () => void;
}

/**
 * The empty deck at its natural height: one calm confirmation, a single summary line (what was decided, or that
 * the last check found nothing), then Undo for the last decision, even a bulk one, beside Check again.
 * It is the only place that summarises the review; the footer's receipt stays quiet here.
 */
export function CaughtUp({ feed, deck, checkRef, onUndo }: Readonly<CaughtUpProps>) {
	const summary = decisionSummary(feed.review);
	const subtitle = lastRunFoundNothing(feed) ? "Nothing new since you last checked" : summary || "Nothing left to review";
	return (
		<motion.div
			animate={{ opacity: 1, transition: motionRecipe.popup.enter }}
			className="flex flex-col items-center gap-3.5 pt-5 pb-4 text-center"
			initial={{ opacity: 0 }}
		>
			<span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-bg-success text-icon-success">
				<CheckMarkIcon color="currentColor" label="" />
			</span>
			<div className="flex flex-col items-center gap-0.5">
				<p className="text-text" style={{ font: token("font.heading.xsmall") }}>All caught up</p>
				<p aria-live="polite" className="text-sm leading-5 text-text-subtle" key={subtitle}>{subtitle}</p>
			</div>
			<div className="flex items-center gap-2 pt-0.5">
				{deck.lastDecision ? <UndoButton className="h-7" last={deck.lastDecision} onUndo={onUndo} /> : null}
				<Button onClick={feed.rerun} ref={checkRef} size="compact" type="button" variant="outline">
					<RefreshIcon color="currentColor" label="" size="small" />
					Check again
				</Button>
			</div>
		</motion.div>
	);
}
