"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import LinkIcon from "@atlaskit/icon/core/link";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import { ContextEditableTitle } from "@/components/blocks/jira-work-item/experimental-v4/components/context-editable-header";
import { useJiraWorkItemMeta } from "@/components/blocks/jira-work-item/experimental-v4/context-jira-work-item";
import { useWorkItemHeaderVariant } from "@/components/blocks/jira-work-item/experimental-v4/context-section-navigation";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

const COPIED_STATE_DURATION_MS = 1800;
const HEADER_LAYOUT_TRANSITION = {
	duration: 0.2,
	ease: motionEase.inOut,
} as const; // duration-medium + ease-in-out
const TITLE_ENTER_TRANSITION = {
	delay: 0.1,
	duration: 0.1,
	ease: motionEase.outPractical,
} as const; // delay-fast + duration-fast + ease-out-practical
const TITLE_EXIT_TRANSITION = {
	duration: 0.1,
	ease: motionEase.in,
} as const; // duration-fast + ease-in
const INSTANT_TRANSITION = { duration: 0 } as const;

/** Compact breadcrumb control for copying the stable work-item key. */
export function WorkItemKeyCopy() {
	const { workItem } = useJiraWorkItemMeta();
	const [copied, setCopied] = useState(false);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const workItemKeyAnchorRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (!copied) return undefined;

		const timeout = window.setTimeout(() => {
			setCopied(false);
			setTooltipOpen(false);
		}, COPIED_STATE_DURATION_MS);

		return () => window.clearTimeout(timeout);
	}, [copied]);

	const handleCopyWorkItemKey = () => {
		void (async () => {
			try {
				await navigator.clipboard?.writeText(workItem.code);
			} catch {
				// Keep the interaction optimistic if clipboard access is unavailable.
			}

			setCopied(true);
			setTooltipOpen(true);
		})();
	};

	const copyLabel = copied ? "Work item key copied" : "Copy work item key";

	return (
		<Tooltip onOpenChange={setTooltipOpen} open={copied || tooltipOpen}>
			{/* Base UI TooltipTrigger defaults to 600ms; 0 keeps the copy affordance snappy.
			    Plain text button is the trigger; the link icon is decorative. */}
			<TooltipTrigger
				delay={0}
				render={
					<button
						aria-label={copyLabel}
						className="group inline-flex cursor-pointer items-center rounded-sm bg-transparent p-0 font-mono text-text-subtlest"
						data-jira-work-item-key
						type="button"
						onClick={handleCopyWorkItemKey}
					>
						<span className="pointer-events-none inline-flex min-w-0 items-center">
							<span ref={workItemKeyAnchorRef} data-jira-work-item-key-label>
								{workItem.code}
							</span>
							<span
								aria-hidden
								className={cn(
									"inline-flex max-w-0 shrink-0 translate-x-1 scale-95 overflow-hidden opacity-0 transition-[max-width,opacity,translate,scale] duration-normal ease-out-practical motion-reduce:transition-none group-hover:max-w-6 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:max-w-6 group-focus-visible:translate-x-0 group-focus-visible:scale-100 group-focus-visible:opacity-100",
									copied && "max-w-6 translate-x-0 scale-100 opacity-100",
								)}
								data-jira-work-item-key-copy-icon
							>
								<span className="ml-1 inline-flex size-4 shrink-0 items-center justify-center [&_[data-slot=icon]]:size-4 [&_svg]:size-4">
									<Icon
										className={cn("size-4", copied ? "text-icon-success" : "text-text-subtlest")}
										render={
											copied ? (
												<StatusSuccessIcon label="" size="small" />
											) : (
												<LinkIcon label="" size="small" />
											)
										}
									/>
								</span>
							</span>
						</span>
					</button>
				}
			/>
			<TooltipContent anchor={workItemKeyAnchorRef} side="top">
				{copyLabel}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Editable title in the dialog header band. Expanded mode places the control
 * row beneath the title; compact mode keeps status + Add inline before it.
 * Owns the header-band padding so the two-column body starts beneath this band.
 */
export function ContextTitleBar({
	controlRow,
}: Readonly<{ controlRow?: (compact: boolean) => ReactNode }> = {}) {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const variant = useWorkItemHeaderVariant();
	const compact = variant === "compact";
	const [presentedCompact, setPresentedCompact] = useState(compact);
	const layout = shouldReduceMotion ? false : "position";
	const titleEnterTransition = shouldReduceMotion
		? INSTANT_TRANSITION
		: TITLE_ENTER_TRANSITION;
	const titleExitTransition = shouldReduceMotion
		? INSTANT_TRANSITION
		: TITLE_EXIT_TRANSITION;

	return (
		<motion.div
			className={cn(
				"min-w-0 self-stretch px-6",
				presentedCompact ? "pb-0" : "pb-4",
			)}
			data-header-variant={variant}
			data-jira-work-item-title-block
			data-jira-work-item-title-column
			layout={layout}
			transition={{ layout: HEADER_LAYOUT_TRANSITION }}
		>
			<motion.div
				className={cn(
					"relative flex min-w-0",
					presentedCompact ? "items-center gap-2" : "flex-col",
				)}
				layout={layout}
				transition={{ layout: HEADER_LAYOUT_TRANSITION }}
			>
				<AnimatePresence
					initial={false}
					mode="wait"
					onExitComplete={() => setPresentedCompact(compact)}
				>
					<motion.div
						animate={compact ? {
							opacity: 1,
						} : {
							opacity: 1,
							transform: "scale(1)",
						}}
						className={cn("min-w-0", compact ? "order-2 flex-1" : "order-1")}
						exit={compact ? {
							opacity: 0,
							transition: titleExitTransition,
						} : {
							opacity: 0,
							transform: "scale(0.96)",
							transition: titleExitTransition,
						}}
						initial={shouldReduceMotion ? false : compact ? {
							opacity: 0,
						} : {
							opacity: 0,
							transform: "scale(1)",
						}}
						key={variant}
						style={{
							transformOrigin: "left center",
							willChange: compact ? "opacity" : "opacity, transform",
						}}
						transition={titleEnterTransition}
					>
						<ContextEditableTitle compact={compact} />
					</motion.div>
				</AnimatePresence>
				{controlRow ? (
					<motion.div
						className={presentedCompact ? "order-1 shrink-0" : "order-2"}
						layout={layout}
						transition={{ layout: HEADER_LAYOUT_TRANSITION }}
					>
						{controlRow(presentedCompact)}
					</motion.div>
				) : null}
			</motion.div>
		</motion.div>
	);
}
