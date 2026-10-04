"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

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
					{renderSelectedItem(item)}
				</motion.div>
			</AnimatePresence>
		</motion.section>
	);
}
