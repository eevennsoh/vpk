"use client";

import { LayoutGroup, motion, useReducedMotion, type Transition } from "motion/react";
import { useState, type ReactNode } from "react";

import { usePanelLayout } from "@/components/blocks/jira-work-item/experimental/context-panel-layout";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

const COMPOSER_REPOSITION_TRANSITION = {
	duration: 0.25,
	ease: motionEase.inOut,
} satisfies Transition; // duration-slow + ease-in-out

const REDUCED_MOTION_TRANSITION = { duration: 0 } satisfies Transition;

interface JiraWorkItemComposerMotionProps {
	children: ReactNode;
	className?: string;
	layout?: true | "position" | "size" | "preserve-aspect";
	layoutDependency?: unknown;
	placement: "planner" | "sticky";
}

/** Shared layout identity for the planner composer becoming the sticky composer. */
export function JiraWorkItemComposerMotion({
	children,
	className,
	layout = "position",
	layoutDependency,
	placement,
}: Readonly<JiraWorkItemComposerMotionProps>) {
	const shouldReduceMotion = Boolean(useReducedMotion());
	const { metadataLayoutAnimating } = usePanelLayout();
	const [isAnimating, setIsAnimating] = useState(false);

	return (
		<LayoutGroup inherit="id">
			<motion.div
				className={cn("min-w-0", className)}
				layout={metadataLayoutAnimating ? false : layout}
				layoutDependency={layoutDependency ?? placement}
				layoutId={metadataLayoutAnimating ? undefined : "jira-work-item-composer"}
				onLayoutAnimationStart={() => setIsAnimating(true)}
				onLayoutAnimationComplete={() => setIsAnimating(false)}
				style={isAnimating && !shouldReduceMotion ? { willChange: "transform" } : undefined}
				transition={shouldReduceMotion ? REDUCED_MOTION_TRANSITION : COMPOSER_REPOSITION_TRANSITION}
			>
				{children}
			</motion.div>
		</LayoutGroup>
	);
}
