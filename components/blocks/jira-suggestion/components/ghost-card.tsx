"use client";

import type { Ref } from "react";
import { motion } from "motion/react";

import { Skeleton } from "@/components/ui/skeleton";
import { motionRecipe } from "@/lib/motion";

import { CARD_PAPER, CARD_PAPER_STYLE } from "./card-face";

/**
 * The card the agent is still looking for, alone on an empty stack while a check runs: the shape of a card (label,
 * three lines, the Why line) so whatever arrives lands where the ghost was.
 */
export function GhostCard({ ref }: Readonly<{ ref?: Ref<HTMLDivElement> }>) {
	return (
		<motion.div
			animate={{ opacity: 1, transition: motionRecipe.popup.enter }}
			aria-hidden="true"
			className={`relative flex flex-col gap-3 px-4 pt-4 pb-3.5 ${CARD_PAPER}`}
			exit={{ opacity: 0, transition: motionRecipe.popup.exit }}
			initial={{ opacity: 0 }}
			ref={ref}
			style={CARD_PAPER_STYLE}
		>
			<Skeleton className="h-3 w-20 rounded-full bg-skeleton-subtle" />
			<div className="flex flex-col gap-2.5 pt-1">
				<Skeleton className="h-3 w-full rounded-full bg-skeleton-subtle" />
				<Skeleton className="h-3 w-11/12 rounded-full bg-skeleton-subtle" />
				<Skeleton className="h-3 w-3/5 rounded-full bg-skeleton-subtle" />
			</div>
			<Skeleton className="h-3 w-24 rounded-full bg-skeleton-subtle" />
		</motion.div>
	);
}

/**
 * While the agent re-runs, one more blank sheet waits at the very back of the stack, softly pulsing: the shape of
 * what may arrive. It is not a suggestion yet, so it simply fades in and out.
 */
export function StackSheetGhost({ pose }: Readonly<{ pose: { x: number; y: number; rotate: number } }>) {
	return (
		<motion.div
			animate={{ opacity: 1, transition: motionRecipe.popup.enter }}
			aria-hidden="true"
			className={`pointer-events-none absolute inset-0 animate-pulse motion-reduce:animate-none ${CARD_PAPER}`}
			exit={{ opacity: 0, transition: motionRecipe.popup.exit }}
			initial={{ opacity: 0 }}
			style={{ ...CARD_PAPER_STYLE, x: pose.x, y: pose.y, rotate: pose.rotate, zIndex: 0 }}
		/>
	);
}
