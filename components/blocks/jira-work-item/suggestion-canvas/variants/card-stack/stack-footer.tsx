"use client";

import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import { Button } from "@/components/ui/button";
import { motionRecipe } from "@/lib/motion";

import { ReviewedToggle } from "./reviewed-list";
import type { BodyMode } from "./stack-panel";
import type { Deck, DeckReceipt } from "./use-deck";

export interface StackFooterProps {
	deck: Deck;
	mode: BodyMode;
	reviewedId: string;
	onToggleReviewed: () => void;
}

function Progress({ deck, mode, reviewedId, onToggleReviewed }: Readonly<StackFooterProps>) {
	const reviewed = deck.total - deck.order.length;
	if (reviewed === 0) {
		return <span className="px-1.5 text-xs whitespace-nowrap text-text-subtlest tabular-nums">0 of {deck.total} reviewed</span>;
	}
	return (
		<ReviewedToggle controls={reviewedId} onToggle={onToggleReviewed} open={mode === "reviewed"}>
			{mode === "reviewed" ? (deck.order.length > 0 ? "Back to cards" : "Back") : `${reviewed} of ${deck.total} reviewed`}
		</ReviewedToggle>
	);
}

/**
 * One line, always, beside the bulk actions: an icon slot both decisions share, then the field. The mark says
 * which way it went (a success check, or a cross with the field struck through); the verb is for screen readers.
 */
function Receipt({ receipt }: Readonly<{ receipt: DeckReceipt }>) {
	const accepted = receipt.decision === "accept";
	return (
		<span className="flex min-w-0 items-center gap-1 px-1.5 text-xs whitespace-nowrap">
			<span className={accepted ? "flex shrink-0 text-icon-success" : "flex shrink-0 text-icon-subtlest"}>
				{accepted ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <CrossIcon color="currentColor" label="" size="small" />}
			</span>
			<span className={accepted ? "min-w-0 text-text-subtle" : "min-w-0 text-text-subtlest line-through decoration-border-bold"}>{receipt.subject}</span>
			<span className="sr-only">{accepted ? "added" : "dismissed"}</span>
		</span>
	);
}

/**
 * Progress on the left ("3 of 8 reviewed", which opens the reviewed list), quiet bulk actions on the right while
 * anything is pending. Right after a decision the progress line briefly confirms it ("Description added"), so a
 * consequence that lands under the popover is still acknowledged. The caught-up body summarises on its own, so
 * the receipt stays out of the way there.
 */
export function StackFooter(props: Readonly<StackFooterProps>) {
	const { deck, mode } = props;
	const receipt = mode === "deck" ? deck.receipt : null;
	const pending = deck.order.length > 0 && mode === "deck";
	return (
		<footer className="flex h-11 shrink-0 items-center gap-2 px-2.5 pb-1">
			<div className="grid min-w-0 flex-1 items-center">
				<AnimatePresence initial={false} mode="popLayout">
					{receipt ? (
						<motion.span
							animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
							className="col-start-1 row-start-1 flex min-w-0"
							exit={{ opacity: 0, y: -4, transition: motionRecipe.popup.exit }}
							initial={{ opacity: 0, y: 4 }}
							key={receipt.key}
						>
							<Receipt receipt={receipt} />
						</motion.span>
					) : (
						<motion.span
							animate={{ opacity: 1, transition: motionRecipe.popup.enter }}
							className="col-start-1 row-start-1 flex min-w-0 justify-self-start"
							exit={{ opacity: 0, transition: motionRecipe.popup.exit }}
							initial={{ opacity: 0 }}
							key="progress"
						>
							<Progress {...props} />
						</motion.span>
					)}
				</AnimatePresence>
			</div>
			{pending ? (
				<div className="flex shrink-0 items-center">
					<Button className="text-text-subtlest hover:text-text-subtle" onClick={() => deck.decideAll("dismiss")} size="compact" type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={() => deck.decideAll("accept")} size="compact" type="button" variant="ghost">Accept all</Button>
				</div>
			) : null}
		</footer>
	);
}
