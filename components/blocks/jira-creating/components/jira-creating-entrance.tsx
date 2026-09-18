"use client";

import { type ReactNode } from "react";
import { motion, type MotionProps, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import {
	getJiraCreateMotion,
	getJiraCreateSlotTransition,
	JIRA_CREATE_MOTION_STYLE,
} from "../lib/jira-creating-motion";

export interface JiraCreateEntranceProps {
	/** Play the insert-and-push entrance. Off keeps the slot at rest so callers can keep children mounted. */
	active?: boolean;
	children: ReactNode;
	/** Hold the existing entrance at its hidden start until the prerequisite completes. */
	deferred?: boolean;
	className?: string;
	enterDelayS?: number;
	itemId?: string;
	onAnimationComplete?: MotionProps["onAnimationComplete"];
}

export function JiraCreateEntrance({
	active = true,
	children,
	className,
	deferred = false,
	enterDelayS = 0,
	itemId,
	onAnimationComplete,
}: Readonly<JiraCreateEntranceProps>) {
	const shouldReduceMotion = useReducedMotion();
	const motionVariants = getJiraCreateMotion(shouldReduceMotion, enterDelayS);
	const slotTransition = getJiraCreateSlotTransition(shouldReduceMotion, enterDelayS);
	const playEntrance = active && !shouldReduceMotion;
	const waiting = active && deferred;

	return (
		<motion.div
			animate={{ height: waiting ? 0 : "auto" }}
			aria-hidden={waiting || undefined}
			className={cn("w-full min-w-0 shrink-0", active ? "overflow-hidden" : null)}
			data-jira-creating-item-id={itemId}
			data-slot="jira-creating-slot"
			exit={shouldReduceMotion ? { height: "auto" } : { height: 0 }}
			initial={playEntrance ? { height: 0 } : false}
			inert={waiting || undefined}
			style={{ boxSizing: "border-box" }}
			transition={slotTransition}
		>
			<motion.div
				animate={waiting ? "hidden" : "show"}
				className={cn("w-full min-w-0", className)}
				data-slot="jira-creating-card"
				exit="exit"
				initial={active ? "hidden" : false}
				onAnimationComplete={active && !waiting ? onAnimationComplete : undefined}
				style={{
					...(active ? JIRA_CREATE_MOTION_STYLE : undefined),
					transformOrigin: "top center",
				}}
				variants={motionVariants.card}
			>
				{children}
			</motion.div>
		</motion.div>
	);
}
