"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { animate, motion, useReducedMotion } from "motion/react";

import { Spinner } from "@/components/ui/spinner";
import { DETAILS_RAIL_GLIDE } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import type { ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";

/** Filling status bar. It sits in the Details rail below the field about to receive a value, so each move slides one row past it. */
export function ProjectButterSuggestionCursor({ after, rootRef }: Readonly<{ after: ProjectButterDetailFieldId | "top"; rootRef: RefObject<HTMLDivElement | null> }>) {
	const cursorRef = useRef<HTMLDivElement>(null);
	const reduced = useReducedMotion();
	useLayoutEffect(() => {
		const root = rootRef.current;
		const cursor = cursorRef.current;
		if (!root || !cursor) return;
		const row = after === "top" ? null : root.querySelector<HTMLElement>(`[data-field-id="${after}"]`);
		const y = row ? row.offsetTop + row.offsetHeight : 0;
		const controls = animate(cursor, { transform: `translateY(${y}px)` }, reduced ? { duration: 0 } : DETAILS_RAIL_GLIDE.layout);
		return () => controls.stop();
	}, [after, reduced, rootRef]);
	return (
		<motion.div
			animate={{ opacity: 1 }}
			aria-hidden
			className="pointer-events-none absolute inset-x-0 top-0 z-20 -mx-2"
			data-project-butter-suggestion-cursor
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			ref={cursorRef}
			style={{ willChange: "transform" }}
			transition={{ opacity: { duration: motionDuration.medium, ease: motionEase.outPractical } }}
		>
			<div className="flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5" style={{ boxShadow: token("elevation.shadow.overlay") }}>
				<span className="flex h-3 w-6 shrink-0 items-center justify-center"><Spinner label="" size="xs" variant="rainbow" /></span>
				<span className="text-xs font-medium text-text-subtle">Filling details</span>
			</div>
		</motion.div>
	);
}
