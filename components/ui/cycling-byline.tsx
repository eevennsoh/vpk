"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

const BYLINE_TRANSITION = { duration: 0.2, ease: "easeOut" } as const
const BYLINE_SLIDE = {
	enter: { opacity: 0, y: -4 },
	active: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: 4 },
} as const
const BYLINE_FADE = {
	enter: { opacity: 0 },
	active: { opacity: 1 },
	exit: { opacity: 0 },
} as const

export type CyclingBylineProps = {
	children: ReactNode
	className?: string
	/** Explicit transition key when composed children carry cycling text. */
	contentKey?: string
	/** Keep compact bylines on their text line while content changes. */
	slide?: boolean
}

/**
 * A byline that animates between three transitions:
 * - appear (height grows, text fades and slides in) when it becomes visible,
 * - disappear (height collapses, text fades and slides out) when it is hidden, and
 * - cross-fade in place (stable height) when the text cycles.
 *
 * The persistent byline on an active step keeps a fixed row height while its
 * text changes, so it stays put instead of flickering on every update.
 */
function CyclingByline({ children, className, contentKey, slide = true }: Readonly<CyclingBylineProps>) {
	const shouldReduceMotion = useReducedMotion()
	const hasContent = children != null && children !== false
	const textKey = contentKey ?? (typeof children === "string" ? children : "byline")
	const transitionStates = slide ? BYLINE_SLIDE : BYLINE_FADE

	return (
		<motion.span
			data-slot="cycling-byline"
			className={cn("block overflow-hidden", className ?? "text-xs leading-4 text-text-subtle")}
			initial={false}
			animate={shouldReduceMotion ? undefined : { height: hasContent ? "auto" : 0 }}
			transition={BYLINE_TRANSITION}
		>
			<span className="block min-h-4">
				<AnimatePresence initial={false} mode="wait">
					{hasContent ? (
						<motion.span
							key={textKey}
							className="block truncate"
							initial={shouldReduceMotion ? false : transitionStates.enter}
							animate={shouldReduceMotion ? undefined : transitionStates.active}
							exit={shouldReduceMotion ? undefined : transitionStates.exit}
							transition={BYLINE_TRANSITION}
						>
							{children}
						</motion.span>
					) : null}
				</AnimatePresence>
			</span>
		</motion.span>
	)
}

export { CyclingByline }
