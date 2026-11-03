"use client";

import { useState } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import type { ProjectButterRelatedStatus } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

const RING = 2 * Math.PI * 7.25;
/** TaskToDo's dashed ring (reference 8 / 8.6667 of a 100-unit path). */
const DASHED = `${(RING * 0.08).toFixed(3)} ${(RING * 0.086667).toFixed(3)}`;
const SOLID = `${RING.toFixed(3)} 0`;
const COLOR: Readonly<Record<ProjectButterRelatedStatus, string>> = {
	"To do": "text-icon-subtle",
	"In progress": "text-icon-information",
	Done: "text-icon-success",
};
const POP = { times: [0, 0.58, 0.8, 1], scale: [0.82, 1.1, 0.97, 1] };

/**
 * Row status glyph matching the menu icons (TaskToDo, StatusWorkflowInProgress, StatusSuccess)
 * that morphs between them like the reference AnimatedStatusIcon: the dashes close into a ring and the
 * half fill appears for In progress; the ring completes and the check pops for Done; reverse plays back.
 * Mounts settled; reduced motion snaps.
 */
export function RelatedStatusGlyph({ className, status }: Readonly<{ className?: string; status: ProjectButterRelatedStatus }>) {
	const reducedMotion = useReducedMotion();
	const [shown, setShown] = useState(status);
	const [from, setFrom] = useState(status);
	if (shown !== status) {
		setFrom(shown);
		setShown(status);
	}
	const instant: Transition = { duration: 0 };
	const toDone = status === "Done";
	const fromDone = from === "Done";
	const ring: Transition = reducedMotion ? instant : from === "To do" || status === "To do"
		? { duration: motionDuration.slow, ease: motionEase.out, delay: status === "To do" ? 0 : motionDuration.xxshort }
		: { duration: motionDuration.medium, ease: motionEase.out };
	const check: Transition = reducedMotion ? instant : toDone
		? { duration: from === "To do" ? motionDuration.slow : motionDuration.medium, delay: from === "To do" ? motionDuration.xxshort : motionDuration.medium, ease: motionEase.outPractical, times: POP.times }
		: { duration: motionDuration.medium, ease: motionEase.in };
	return (
		<svg aria-hidden className={cn("block size-4 shrink-0 overflow-visible transition-colors duration-slow ease-out", COLOR[status], className)} data-status={status} focusable="false" height="16" viewBox="0 0 16 16" width="16">
			<motion.circle
				animate={{ strokeDasharray: status === "To do" ? DASHED : SOLID, opacity: toDone ? 0 : 1 }}
				cx="8"
				cy="8"
				fill="none"
				initial={false}
				r="7.25"
				stroke="currentColor"
				strokeWidth="1.5"
				transition={toDone || fromDone ? { ...ring, opacity: reducedMotion ? instant : { duration: motionDuration.medium, ease: motionEase.in } } : ring}
			/>
			<motion.path
				animate={{ opacity: status === "In progress" ? 1 : 0, rotate: toDone ? 180 : 0 }}
				d="M8 3a5 5 0 1 1 0 10z"
				fill="currentColor"
				initial={false}
				style={{ transformBox: "view-box", transformOrigin: "8px 8px" }}
				transition={reducedMotion ? instant : { duration: motionDuration.medium, ease: motionEase.out, delay: from === "To do" ? motionDuration.fast : 0 }}
			/>
			<motion.g
				animate={toDone ? fromDone ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 1], scale: POP.scale } : { opacity: 0, scale: 1 }}
				initial={false}
				style={{ transformBox: "view-box", transformOrigin: "8px 8px" }}
				transition={check}
			>
				<circle className="fill-icon-success" cx="8" cy="8" r="8" />
				<path className="fill-surface" d="M6.75 9.828 4.826 7.52l-1.152.96 2.5 3a.75.75 0 0 0 1.152 0l5-6-1.152-.96z" />
			</motion.g>
		</svg>
	);
}
