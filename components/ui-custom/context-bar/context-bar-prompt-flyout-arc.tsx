"use client";

import type { ReactNode } from "react";
import { motion, type Transition } from "motion/react";
import { motionEase } from "@/lib/motion";

/**
 * Vertical extras for `ContextBarPromptFlyout`. Each extra is a context-bar
 * pill that fades and slides 8px from the trigger; no offset-path travel.
 */

/** duration-normal + ease-out-practical — popup-family entrance. */
const ITEM_ENTER: Transition = { duration: 0.15, ease: motionEase.outPractical };
/** duration-fast + ease-in — faster than enter so exit does not pile onto the trigger. */
const ITEM_EXIT: Transition = { duration: 0.1, ease: motionEase.in };
const REDUCED_MOTION: Transition = { duration: 0, delay: 0 };
const STAGGER_INTERVAL = 0.05;
const EXTRA_SLIDE_Y = 8;

interface ContextBarPromptFlyoutStackItemProps {
	children: ReactNode;
	index: number;
	reduceMotion: boolean;
}

export function ContextBarPromptFlyoutStackItem({
	children,
	index,
	reduceMotion,
}: Readonly<ContextBarPromptFlyoutStackItemProps>) {
	const enterDelay = index * STAGGER_INTERVAL;
	const slideY = reduceMotion ? 0 : EXTRA_SLIDE_Y;
	const enterTransition = reduceMotion
		? REDUCED_MOTION
		: { ...ITEM_ENTER, delay: enterDelay };
	const exitTransition = reduceMotion ? REDUCED_MOTION : ITEM_EXIT;

	return (
		<motion.div
			animate={{
				opacity: 1,
				y: 0,
				transition: enterTransition,
			}}
			className="pointer-events-auto relative z-20 rounded-xl bg-surface"
			data-context-bar-prompt-flyout-item=""
			exit={{
				opacity: 0,
				y: slideY,
				transition: exitTransition,
			}}
			initial={{ opacity: 0, y: slideY }}
			style={{ willChange: reduceMotion ? "opacity" : "opacity, transform" }}
		>
			{children}
		</motion.div>
	);
}

/**
 * Invisible hit region covering the stack, including the gap down to the
 * trigger. Without it, `pointer-events-none` on the extras wrapper lets
 * `mouseleave` fire while crossing the 8px gaps.
 */
export function ContextBarPromptFlyoutHoverPad() {
	return (
		<div
			aria-hidden
			className="pointer-events-auto absolute inset-0"
			data-context-bar-prompt-flyout-hover-pad=""
		/>
	);
}
