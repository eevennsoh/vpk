"use client";

import { AnimatePresence, motion, PresenceContext, useReducedMotion } from "motion/react";
import { use, useEffect, useMemo, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { GalleryItem } from "../data/gallery-items";
import { motionEase } from "@/lib/motion";

const ENTER_EASE = motionEase.outPractical; // --ease-out-practical
const EXIT_EASE = motionEase.in; // --ease-in
const LAYOUT_EASE = motionEase.inOut; // --ease-in-out

export type GalleryStagePosition = "top" | "center";

export interface GallerySelectedStageProps {
	item: GalleryItem;
	position: GalleryStagePosition;
	resetKey: number;
	renderSelectedItem: (item: GalleryItem) => ReactNode;
}

/**
 * `<AnimatePresence initial={false}>` skips the entrance of the item shown on first render, but
 * Motion memoizes that `initial: false` in the presence context, so every motion element mounted
 * inside that item later (a hover preview, a handoff avatar) also loses its `initial` keyframe.
 * Keep the block for the first render only; descendants that mount afterwards see no block.
 */
function ReleaseInitialBlockAfterMount({ children }: Readonly<{ children: ReactNode }>) {
	const presence = use(PresenceContext);
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
	}, []);
	// Motion reads `initial` once, when a motion element mounts, so a getter is enough and nothing re-renders.
	const released = useMemo(() => presence ? { ...presence, get initial() { return mounted.current ? undefined : presence.initial; } } : presence, [presence]);
	return <PresenceContext value={released}>{children}</PresenceContext>;
}

export function GallerySelectedStage({
	item,
	position,
	resetKey,
	renderSelectedItem,
}: Readonly<GallerySelectedStageProps>) {
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.section
			layout={shouldReduceMotion ? false : true}
			aria-live="polite"
			className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center px-6"
			transition={shouldReduceMotion ? { duration: 0 } : { layout: { duration: 0.2, ease: LAYOUT_EASE } }}
			style={{ willChange: "transform" }}
		>
			<AnimatePresence initial={false} mode="wait">
				<motion.div
					key={`${item.id}:${resetKey}`}
					initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
					animate={{ opacity: 1, y: 0 }}
					exit={
						shouldReduceMotion
							? { opacity: 0 }
							: {
									opacity: 0,
									y: -12,
									transition: { duration: 0.1, ease: EXIT_EASE },
								}
					}
					transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: ENTER_EASE }}
					className={cn(
						"flex h-full w-full origin-top flex-col",
						position === "center"
							? "items-center justify-center"
							: "items-stretch justify-start",
					)}
					style={{ willChange: "transform, opacity" }}
				>
					<ReleaseInitialBlockAfterMount>{renderSelectedItem(item)}</ReleaseInitialBlockAfterMount>
				</motion.div>
			</AnimatePresence>
		</motion.section>
	);
}
