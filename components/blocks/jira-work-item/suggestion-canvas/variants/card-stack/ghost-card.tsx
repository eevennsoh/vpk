"use client";

import { motion } from "motion/react";

import { Skeleton } from "@/components/ui/skeleton";
import { motionRecipe } from "@/lib/motion";
import { token } from "@/lib/tokens";

import { GHOST_HEIGHT, PEEK_STEP, SCALE_STEP, SETTLE } from "./constants";

/**
 * The placeholder for what the agent is still looking for. It takes the slot at the back of the stack while a
 * re-run is in flight, so the card that arrives lands exactly where the ghost was. Alone in an empty deck it
 * sits on top and sketches a card's shape. Its back-slot pulse stops under reduced motion, like the shared skeleton.
 */
export function GhostCard({ index, height }: Readonly<{ index: number; height: number | null }>) {
	return (
		<motion.div
			animate={{ y: index * PEEK_STEP, scale: 1 - index * SCALE_STEP, transition: SETTLE }}
			aria-hidden="true"
			className="pointer-events-none absolute inset-x-0 top-0 origin-bottom"
			initial={false}
			style={{ zIndex: 10 - index }}
		>
			<motion.div
				animate={{ opacity: 1, transition: motionRecipe.popup.enter }}
				className="relative flex flex-col overflow-hidden rounded-xl bg-surface-overlay"
				exit={{ opacity: 0, transition: motionRecipe.popup.exit }}
				initial={{ opacity: 0 }}
				style={{ height: height ?? GHOST_HEIGHT, boxShadow: token("elevation.shadow.raised") }}
			>
				<span className={index === 0 ? "pointer-events-none absolute inset-0 bg-bg-discovery-subtler opacity-30" : "pointer-events-none absolute inset-0 animate-pulse bg-bg-discovery-subtler motion-reduce:animate-none"} />
				{index === 0 ? (
					<div className="relative flex flex-1 flex-col gap-3 px-4 pt-4 pb-3.5">
						<Skeleton className="h-3 w-20 rounded-full bg-skeleton-subtle" />
						<div className="flex flex-col gap-2.5 pt-1">
							<Skeleton className="h-3 w-full rounded-full bg-skeleton-subtle" />
							<Skeleton className="h-3 w-11/12 rounded-full bg-skeleton-subtle" />
							<Skeleton className="h-3 w-3/5 rounded-full bg-skeleton-subtle" />
						</div>
						<Skeleton className="mt-auto h-3 w-24 rounded-full bg-skeleton-subtle" />
					</div>
				) : null}
			</motion.div>
		</motion.div>
	);
}
