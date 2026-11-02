"use client";

import { motion } from "motion/react";

import { Spinner } from "@/components/ui/spinner";
import { DETAILS_RAIL_GLIDE } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";

/** Filling status bar. It sits in the Details rail below the field about to receive a value, so each move slides one row past it. */
export function ProjectButterSuggestionCursor() {
	return (
		<motion.div
			animate={{ opacity: 1 }}
			aria-hidden
			className="pointer-events-none relative z-20"
			data-project-butter-suggestion-cursor
			initial={{ opacity: 0 }}
			layout="position"
			style={{ willChange: "transform" }}
			transition={{ ...DETAILS_RAIL_GLIDE, opacity: { duration: motionDuration.medium, ease: motionEase.outPractical } }}
		>
			<div className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5" style={{ boxShadow: token("elevation.shadow.overlay") }}>
				<Spinner label="" size="xs" variant="rainbow" />
				<span className="text-xs font-medium text-text-subtle">Filling details</span>
			</div>
		</motion.div>
	);
}
