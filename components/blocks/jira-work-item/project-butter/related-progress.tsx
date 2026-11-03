"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RelatedStatusCounts } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { motionDuration, motionEase } from "@/lib/motion";

const RADIUS = 5.25;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENTS = [
	{ key: "todo", className: "text-icon-subtle" },
	{ key: "inProgress", className: "text-icon-information" },
	{ key: "done", className: "text-icon-success" },
] as const;

/**
 * Child header progress (reference SubItemsProgress): a 12px segmented ring (to do, in progress, done
 * clockwise from 12 o'clock over a border track) and a "{done}/{total}" chip. Decorative: the group trigger
 * carries the spoken counts. Segments ease on change; reduced motion snaps.
 */
export function RelatedProgress({ counts }: Readonly<{ counts: RelatedStatusCounts }>) {
	const reducedMotion = useReducedMotion();
	const transition = reducedMotion ? { duration: 0 } : { duration: motionDuration.medium, ease: motionEase.outPractical };
	const lengths = SEGMENTS.map((segment) => counts.total ? CIRCUMFERENCE * (counts[segment.key] / counts.total) : 0);
	const starts = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, length) => sum + length, 0));
	return (
		<span aria-hidden className="flex items-center gap-1" data-component="SubItemsProgress">
			<svg className="size-3 shrink-0 -rotate-90" viewBox="0 0 12 12">
				<circle className="text-border" cx="6" cy="6" fill="none" r={RADIUS} stroke="currentColor" strokeWidth="1.5" />
				{SEGMENTS.map((segment, index) => {
					const length = lengths[index];
					const start = starts[index];
					return (
						<motion.circle
							animate={{ strokeDasharray: `${length} ${CIRCUMFERENCE - length}`, strokeDashoffset: -start, opacity: length > 0 ? 1 : 0 }}
							className={segment.className}
							cx="6"
							cy="6"
							fill="none"
							initial={false}
							key={segment.key}
							r={RADIUS}
							stroke="currentColor"
							strokeWidth="1.5"
							transition={transition}
						/>
					);
				})}
			</svg>
			<span className="inline-flex items-center gap-0.5 rounded-xs px-1 py-0.5 text-xs font-normal text-text tabular-nums">{counts.done}/{counts.total}</span>
		</span>
	);
}
