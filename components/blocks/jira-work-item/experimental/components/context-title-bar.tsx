"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";

import { token } from "@/lib/tokens";
import { ContextEditableTitle } from "@/components/blocks/jira-work-item/experimental/components/context-editable-header";
import {
	ContextTitleActions,
	type CodingAgentId,
} from "@/components/blocks/jira-work-item/experimental/components/context-title-actions";
import {
	METADATA_CONTENT_COLLAPSE_TRANSITION,
	METADATA_CONTENT_EXPAND_TRANSITION,
	METADATA_CONTENT_REDUCED_MOTION_TRANSITION,
} from "@/components/blocks/jira-work-item/experimental/context-panel-layout-motion";
import { usePanelLayout } from "@/components/blocks/jira-work-item/experimental/context-panel-layout";
import { motionEase } from "@/lib/motion";

const ACTIONS_ENTER_TRANSITION: Transition = {
	duration: 0.1,
	ease: motionEase.outPractical, // duration-fast + ease-out-practical
};
const EXPANDED_ACTIONS_ENTER_TRANSITION: Transition = {
	duration: 0.05,
	ease: motionEase.outPractical, // duration-xxshort + ease-out-practical
};
const ACTIONS_EXIT_DURATION_MS = 50;
const ACTIONS_EXIT_TRANSITION: Transition = {
	duration: ACTIONS_EXIT_DURATION_MS / 1000,
	ease: motionEase.in, // duration-xxshort + ease-in
};

interface AnimatedContextTitleActionsProps {
	collapsed: boolean;
	hideForToggle: boolean;
	isLayoutSettled: boolean;
	onToggleExitComplete: () => void;
	primaryAgentId?: CodingAgentId;
	shouldReduceMotion: boolean;
}

function AnimatedContextTitleActions({
	collapsed,
	hideForToggle,
	isLayoutSettled,
	onToggleExitComplete,
	primaryAgentId,
	shouldReduceMotion,
}: Readonly<AnimatedContextTitleActionsProps>) {
	const didCompleteToggleExit = useRef(false);
	const [isAnimating, setIsAnimating] = useState(false);
	const isInteractive = !hideForToggle && isLayoutSettled && !isAnimating;
	const enterTransition = collapsed ? ACTIONS_ENTER_TRANSITION : EXPANDED_ACTIONS_ENTER_TRANSITION;

	useEffect(() => {
		if (!hideForToggle || didCompleteToggleExit.current) return undefined;

		const timeout = window.setTimeout(() => {
			didCompleteToggleExit.current = true;
			onToggleExitComplete();
		}, shouldReduceMotion ? 0 : ACTIONS_EXIT_DURATION_MS);
		return () => window.clearTimeout(timeout);
	}, [hideForToggle, onToggleExitComplete, shouldReduceMotion]);

	return (
		<motion.div
			animate={
				hideForToggle
					? {
							opacity: 0,
							scale: 0.96,
							transition: shouldReduceMotion ? { duration: 0 } : ACTIONS_EXIT_TRANSITION,
						}
					: isLayoutSettled
					? { opacity: 1, scale: 1, transition: enterTransition }
					: { opacity: 0, scale: 0.96, transition: { duration: 0 } }
			}
			aria-hidden={isInteractive ? undefined : true}
			exit={{ opacity: 0, scale: 0.96, transition: { duration: 0 } }}
			inert={isInteractive ? undefined : true}
			initial={shouldReduceMotion || isLayoutSettled ? false : { opacity: 0, scale: 0.96 }}
			onAnimationComplete={() => setIsAnimating(false)}
			onAnimationStart={() => setIsAnimating(true)}
			style={{
				transformOrigin: "right center",
				willChange: isAnimating ? "transform, opacity" : undefined,
			}}
		>
			<ContextTitleActions collapsed={collapsed} primaryAgentId={primaryAgentId} />
		</motion.div>
	);
}

/**
 * Full-width title band beneath the breadcrumb header: the editable work-item
 * title (left) and the visual action cluster (right). Spanning the whole dialog
 * — rather than living inside the left content column — keeps the actions aligned
 * to the modal's right edge (under the breadcrumb controls) and above the
 * two-column body, so they can never collide with the metadata rail.
 */
export function ContextTitleBar({ primaryAgentId }: Readonly<{ primaryAgentId?: CodingAgentId }>) {
	const {
		completeMetadataToggle,
		metadataCollapsed,
		metadataTogglePending,
	} = usePanelLayout();
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [settledMetadataCollapsed, setSettledMetadataCollapsed] = useState(metadataCollapsed);
	const isActionLayoutSettled = shouldReduceMotion || settledMetadataCollapsed === metadataCollapsed;
	const contentLayoutTransition = shouldReduceMotion
		? METADATA_CONTENT_REDUCED_MOTION_TRANSITION
		: metadataCollapsed
			? METADATA_CONTENT_COLLAPSE_TRANSITION
			: METADATA_CONTENT_EXPAND_TRANSITION;
	const contentColumnStyle = {
		maxWidth: metadataCollapsed ? "800px" : "100%",
	} as CSSProperties;

	return (
		<div style={{ paddingBottom: token("space.200") }}>
			<motion.div
				className="mx-auto flex w-full items-center justify-between gap-3 px-6 motion-reduce:transition-none"
				data-jira-work-item-title-column
				layout={shouldReduceMotion ? false : "position"}
				onLayoutAnimationComplete={() => setSettledMetadataCollapsed(metadataCollapsed)}
				style={contentColumnStyle}
				transition={contentLayoutTransition}
			>
				<div className="min-w-0 flex-1" data-jira-work-item-title>
					<ContextEditableTitle />
				</div>
				<AnimatePresence initial={false} mode="popLayout">
					<AnimatedContextTitleActions
						key={metadataCollapsed ? "metadata-collapsed" : "metadata-expanded"}
						collapsed={metadataCollapsed}
						hideForToggle={metadataTogglePending}
						isLayoutSettled={isActionLayoutSettled}
						onToggleExitComplete={completeMetadataToggle}
						primaryAgentId={primaryAgentId}
						shouldReduceMotion={shouldReduceMotion}
					/>
				</AnimatePresence>
			</motion.div>
		</div>
	);
}
