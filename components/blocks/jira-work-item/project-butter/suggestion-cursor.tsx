"use client";

import { motion, useReducedMotion } from "motion/react";

import type { ProjectButterSuggestionFill } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { Spinner } from "@/components/ui/spinner";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";

/** Traveling status pill. It sits on the field that is about to receive a value. */
export function ProjectButterSuggestionCursor({ fill }: Readonly<{ fill: ProjectButterSuggestionFill }>) {
	const shouldReduceMotion = useReducedMotion() ?? false;
	if (!fill.running || fill.pillTop == null || shouldReduceMotion) return null;

	return (
		<motion.div
			animate={{ opacity: 1, y: fill.pillTop }}
			aria-hidden
			className="pointer-events-none absolute inset-x-1 top-0 z-20"
			data-project-butter-suggestion-cursor
			initial={{ opacity: 0, y: fill.pillTop }}
			transition={{ duration: motionDuration.medium, ease: motionEase.inOut }}
		>
			<div className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5" style={{ boxShadow: token("elevation.shadow.overlay") }}>
				<Spinner label="" size="xs" variant="rainbow" />
				<span className="text-xs font-medium text-text-subtle">Filling details</span>
			</div>
		</motion.div>
	);
}
