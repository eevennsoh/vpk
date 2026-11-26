"use client";

import { motion, useReducedMotion } from "motion/react";

import { AgentSession } from "@/components/blocks/agent-session";
import { cn } from "@/lib/utils";

import type { ScrollingProps } from "./scrolling-viewport";
import { useScrollingVisibility } from "./use-scrolling-visibility";

export function ScrollingViewport({ className, items, viewportHeight }: Readonly<Required<ScrollingProps>>) {
	const { toggleVisibility, visibilityLabel, visibleItems } = useScrollingVisibility(items);
	const reduceMotion = useReducedMotion();
	return (
		<motion.div aria-label="Agent sessions" className={cn("overflow-y-auto p-1", className)} role="region" style={{ height: viewportHeight }} tabIndex={0} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
			<AgentSession items={visibleItems} onToggleVisibility={toggleVisibility} variant="large" visibilityLabel={visibilityLabel} />
		</motion.div>
	);
}
