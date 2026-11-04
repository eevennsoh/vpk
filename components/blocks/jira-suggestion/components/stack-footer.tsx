"use client";

import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import { Button } from "@/components/ui/button";
import { motionRecipe } from "@/lib/motion";

import { FOOTER_HEIGHT, SETTLE } from "./constants";
import type { Deck, DeckReceipt } from "./use-deck";

/** One line in the progress slot: a mark for which way it went, then what. "Nothing new" after an empty re-run. */
function Receipt({ receipt }: Readonly<{ receipt: DeckReceipt }>) {
	if (receipt.kind === "nothing-new") return <span className="text-xs whitespace-nowrap text-text-subtlest">No new suggestions</span>;
	const accepted = receipt.kind === "accept";
	return (
		<span className="flex min-w-0 items-center gap-1 text-xs whitespace-nowrap">
			<span className={accepted ? "flex shrink-0 text-icon-success" : "flex shrink-0 text-icon-subtlest"}>
				{accepted ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <CrossIcon color="currentColor" label="" size="small" />}
			</span>
			<span className="min-w-0 text-text-subtle">{receipt.subject} {accepted ? "added" : "dismissed"}</span>
		</span>
	);
}

/**
 * Under a full-width hairline: "1 of 6 reviewed" on the left (briefly replaced by a receipt for the latest change),
 * then Dismiss all as quiet text and Accept all as the one primary action, while anything is pending. It folds away
 * when everything is caught up, where the body owns the summary.
 */
export function StackFooter({ deck }: Readonly<{ deck: Deck }>) {
	const reviewed = deck.total - deck.order.length;
	const pending = deck.order.length > 0;
	// Once nothing is pending the body summarises every decision; the footer just confirms the count, so the two never disagree.
	const receipt = pending ? deck.receipt : null;
	return (
		<motion.footer
			animate={{ height: FOOTER_HEIGHT, opacity: 1, transition: SETTLE }}
			className="flex shrink-0 items-center gap-2 overflow-hidden border-t border-border pr-3 pl-4"
			exit={{ height: 0, opacity: 0, transition: SETTLE }}
			initial={{ height: 0, opacity: 0 }}
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
						{receipt ? <Receipt receipt={receipt} /> : <span className="text-xs whitespace-nowrap text-text-subtlest tabular-nums">{reviewed} of {deck.total} reviewed</span>}
					</motion.span>
				</AnimatePresence>
			</div>
			{pending ? (
				<div className="flex shrink-0 items-center gap-1">
					<Button className="text-text-subtlest hover:text-text-subtle" onClick={() => deck.decideAll("dismiss")} type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={() => deck.decideAll("accept")} type="button">Accept all</Button>
				</div>
			) : null}
		</motion.footer>
	);
}
