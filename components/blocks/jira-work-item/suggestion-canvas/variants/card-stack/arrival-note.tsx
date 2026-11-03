"use client";

import { AnimatePresence, motion } from "motion/react";

import { motionRecipe } from "@/lib/motion";
import { token } from "@/lib/tokens";

import type { DeckArrival } from "./use-deck";

/**
 * The moment a re-run lands: new cards join the back of the deck, out of sight, so a small note rises from the
 * peeking edge to say so and offers to bring them forward. It leaves on its own, or once its cards reach the top.
 */
export function ArrivalNote({ arrival, onReviewFirst }: Readonly<{ arrival: DeckArrival | null; onReviewFirst: () => void }>) {
	const count = arrival?.ids.length ?? 0;
	return (
		<div className="pointer-events-none absolute inset-x-0 -bottom-1 z-30 flex justify-center">
			<AnimatePresence>
				{arrival ? (
					<motion.button
						animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
						aria-label={`${count} new ${count === 1 ? "suggestion" : "suggestions"} at the back of the deck. Review ${count === 1 ? "it" : "them"} next`}
						className="pointer-events-auto inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-overlay pr-1 pl-2 text-xs whitespace-nowrap text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-surface-overlay-hovered focus-visible:ring-2 focus-visible:ring-ring"
						exit={{ opacity: 0, y: 4, transition: motionRecipe.popup.exit }}
						initial={{ opacity: 0, y: 4 }}
						key={arrival.key}
						onClick={onReviewFirst}
						style={{ boxShadow: token("elevation.shadow.overlay"), willChange: "transform, opacity" }}
						type="button"
					>
						<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-discovery" />
						<span className="font-medium text-text-discovery">{count} new</span>
						<span>at the back</span>
						<span className="rounded-full bg-bg-discovery px-1.5 leading-4 font-medium text-text-discovery">Review next</span>
					</motion.button>
				) : null}
			</AnimatePresence>
		</div>
	);
}
