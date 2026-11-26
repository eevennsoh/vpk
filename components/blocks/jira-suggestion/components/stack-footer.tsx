"use client";

import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { motionRecipe } from "@/lib/motion";

import { FOOTER_HEIGHT, SETTLE } from "./constants";
import type { Deck } from "./use-deck";

/**
 * Under a full-width hairline: "1 of 6 reviewed" on the left (briefly replaced after an empty re-check),
 * then Discard all as quiet text and Accept all as the one primary action, while anything is pending. It folds away
 * when everything is caught up, where the body owns the summary, and while a check runs, when the panel folds to its header.
 */
export function StackFooter({ deck, animateEntrance }: Readonly<{ deck: Deck; animateEntrance: boolean }>) {
	const reviewed = deck.reviewed.length;
	const pending = deck.order.length;
	const total = reviewed + pending;
	const receipt = pending > 0 ? deck.receipt : null;
	return (
		<motion.footer
			animate={{ height: FOOTER_HEIGHT, opacity: 1, transition: SETTLE }}
			className="flex shrink-0 items-center gap-2 overflow-hidden border-t border-border pr-3 pl-4"
			exit={{ height: 0, opacity: 0, transition: SETTLE }}
			initial={animateEntrance ? { height: 0, opacity: 0 } : false}
		>
			<div aria-live="polite" className="grid min-w-0 flex-1 items-center">
				<AnimatePresence initial={false} mode="popLayout">
					<motion.span
						animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
						className="col-start-1 row-start-1 flex min-w-0"
						exit={{ opacity: 0, y: -4, transition: motionRecipe.popup.exit }}
						initial={{ opacity: 0, y: 4 }}
						key={receipt ? `receipt-${receipt.key}` : "progress"}
					>
						<span className="text-xs whitespace-nowrap text-text-subtlest tabular-nums">{receipt ? "No new suggestions" : `${reviewed} of ${total} reviewed`}</span>
					</motion.span>
				</AnimatePresence>
			</div>
			{pending > 0 ? (
				<div className="flex shrink-0 items-center gap-1">
					<Button onClick={() => deck.decideAll("dismiss")} type="button" variant="ghost">Discard all</Button>
					<Button onClick={() => deck.decideAll("accept")} type="button">Accept all</Button>
				</div>
			) : null}
		</motion.footer>
	);
}
