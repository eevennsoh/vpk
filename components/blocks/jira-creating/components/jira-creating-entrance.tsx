"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { motion, type MotionProps, useAnimationControls, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import {
	getJiraCreateMotion,
	getJiraCreateSlotTransition,
	getJiraCreateRemovalTransition,
	JIRA_CREATE_MOTION_STYLE,
	shouldClipJiraCreateSlot,
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
	/** Replay this entrance for an existing card without remounting its interactive content. */
	replayKey?: number;
	/** A flying existing card needs its final slot measured before revealing its face. */
	reserveSlot?: boolean;
	/** Reverse the entrance before the owner removes the work item. */
	removing?: boolean;
	onRemovalComplete?: () => void;
}

export function JiraCreateEntrance({
	active = true,
	children,
	className,
	deferred = false,
	enterDelayS = 0,
	itemId,
	onAnimationComplete,
	replayKey,
	reserveSlot = false,
	removing = false,
	onRemovalComplete,
}: Readonly<JiraCreateEntranceProps>) {
	const shouldReduceMotion = useReducedMotion();
	const motionVariants = getJiraCreateMotion(shouldReduceMotion, enterDelayS);
	const slotTransition = getJiraCreateSlotTransition(shouldReduceMotion, enterDelayS);
	const playEntrance = active && !shouldReduceMotion;
	const waiting = active && deferred;
	const slotPlayback = useAnimationControls();
	const cardPlayback = useAnimationControls();
	useLayoutEffect(() => {
		if (!active || replayKey === undefined || waiting || removing) return;
		if (!reserveSlot) slotPlayback.set({ height: 0 });
		cardPlayback.set("hidden");
		if (!reserveSlot) void slotPlayback.start({ height: "auto", transition: getJiraCreateSlotTransition(shouldReduceMotion, enterDelayS) });
		void cardPlayback.start("show");
		return () => { slotPlayback.stop(); cardPlayback.stop(); };
	}, [active, waiting, removing, replayKey, reserveSlot, shouldReduceMotion, enterDelayS, slotPlayback, cardPlayback]);

	return (
		<motion.div
			animate={removing ? { height: 0 } : reserveSlot ? { height: "auto" } : replayKey === undefined ? { height: waiting ? 0 : "auto" } : slotPlayback}
			aria-hidden={waiting || removing || undefined}
			className={cn("w-full min-w-0 shrink-0", shouldClipJiraCreateSlot({ active, removing, reserveSlot }) ? "overflow-hidden" : null)}
			data-jira-creating-removing={removing || undefined}
			data-jira-creating-item-id={itemId}
			data-slot="jira-creating-slot"
			exit={shouldReduceMotion ? { height: "auto" } : { height: 0 }}
			initial={playEntrance && !reserveSlot ? { height: 0 } : false}
			inert={waiting || removing || undefined}
			onAnimationComplete={removing ? onRemovalComplete : undefined}
			style={{ boxSizing: "border-box" }}
			transition={removing ? getJiraCreateRemovalTransition(shouldReduceMotion) : slotTransition}
		>
			<motion.div
				animate={removing ? "exit" : replayKey === undefined ? waiting ? "hidden" : "show" : cardPlayback}
				className={cn("w-full min-w-0", className)}
				data-slot="jira-creating-card"
				exit="exit"
				initial={active ? "hidden" : false}
				onAnimationComplete={active && !waiting && !removing ? onAnimationComplete : undefined}
				style={{
					...(active || removing ? JIRA_CREATE_MOTION_STYLE : undefined),
					transformOrigin: "top center",
				}}
				variants={motionVariants.card}
			>
				{children}
			</motion.div>
		</motion.div>
	);
}
