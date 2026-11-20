"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";

import { Spinner } from "@/components/ui/spinner";
import { FILL_LANDING, FILL_LIFT, fillCursorY, type FillCursorPosition } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import { motionDuration, motionEase } from "@/lib/motion";

const FILL_CURSOR_SURFACE = "flex origin-center items-center gap-2 rounded-lg bg-surface-overlay px-2 py-1.5 shadow-2xl";

export function ProjectButterSuggestionCursor({ position, rootRef }: Readonly<{ position: FillCursorPosition; rootRef: RefObject<HTMLDivElement | null> }>) {
	const cursorRef = useRef<HTMLDivElement>(null);
	const reduced = useReducedMotion();
	const offset = useMotionValue(0);
	const finishing = position.phase === "land";
	const transition = reduced ? { duration: 0 } : finishing ? FILL_LANDING : {
		...FILL_LIFT,
		scale: { duration: FILL_LIFT.duration, ease: motionEase.inOut },
		opacity: { duration: motionDuration.medium, ease: motionEase.inOut },
	};
	const exitTransition = { duration: reduced ? 0 : finishing ? motionDuration.slower : motionDuration.fast, ease: motionEase.inOut };
	useLayoutEffect(() => {
		const root = rootRef.current;
		const cursor = cursorRef.current;
		if (!root || !cursor) return;
		const row = root.querySelector<HTMLElement>(`[data-field-id="${position.field}"]`);
		if (!row) return;
		let target: number | undefined;
		let controls: ReturnType<typeof animate> | undefined;
		const align = () => {
			const y = fillCursorY(row, cursor, position.phase);
			if (y === target) return;
			target = y;
			controls?.stop();
			if (position.phase === "lift") offset.jump(y);
			else controls = animate(offset, y, reduced ? { duration: 0 } : position.travel);
		};
		align();
		const observer = new ResizeObserver(align);
		observer.observe(root);
		observer.observe(row);
		return () => {
			observer.disconnect();
			controls?.stop();
		};
	}, [position, reduced, rootRef, offset]);
	return (
		<motion.div
			aria-hidden
			className="pointer-events-none absolute inset-x-2 top-3"
			data-project-butter-suggestion-cursor
			exit={{ opacity: 0, transition: exitTransition }}
			ref={cursorRef}
			style={{ y: offset, willChange: "transform" }}
		>
			<motion.div
				animate={{ opacity: 1, scale: finishing || reduced ? 1 : 1.012, y: finishing || reduced ? 0 : -3 }}
				className={FILL_CURSOR_SURFACE}
				data-project-butter-suggestion-cursor-surface
				initial={reduced ? false : { opacity: 0.2, scale: 0.92, y: 4 }}
				exit={{ scale: reduced ? 1 : 0.94, transition: exitTransition }}
				transition={transition}
			>
				<span className="flex h-3 w-6 shrink-0 items-center justify-center"><Spinner label="" size="xs" variant="rainbow" /></span>
				<span className="text-xs font-medium text-text-subtle">Filling details</span>
			</motion.div>
		</motion.div>
	);
}
