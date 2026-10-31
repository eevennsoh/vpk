"use client";

import { useId, useState, type ReactNode } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { motion, useReducedMotion } from "motion/react";

import {
	CONTENT_ENTER,
	CONTENT_EXIT,
	panelContentVariants,
	REDUCED_MOTION_TRANSITION,
} from "@/components/blocks/jira-work-item/team-eu26/components/panel-content-motion";
import { cn } from "@/lib/utils";

interface TeamEuRailPanelProps {
	children: ReactNode;
	defaultOpen?: boolean;
	headerActions?: ReactNode;
	footer?: ReactNode;
	alwaysShowHeaderActions?: boolean;
	surface?: "card" | "inline";
	title: string;
}

export function TeamEuRailPanel({
	children,
	defaultOpen = false,
	headerActions,
	footer,
	alwaysShowHeaderActions = false,
	surface = "card",
	title,
}: Readonly<TeamEuRailPanelProps>) {
	const [open, setOpen] = useState(defaultOpen);
	const contentId = useId();
	const headingId = useId();
	const shouldReduceMotion = Boolean(useReducedMotion());

	return (
		<section
			aria-labelledby={headingId}
			className={cn("group/rail-panel bg-surface", footer ? "relative" : undefined, surface === "card" ? "rounded-lg border border-border-disabled" : undefined)}
		>
			<div className={cn("relative flex items-center", surface === "card" ? "min-h-12 px-4" : "min-h-8")}>
				<button
					aria-controls={contentId}
					aria-expanded={open}
					aria-labelledby={headingId}
					className="absolute inset-0 z-0 cursor-pointer rounded-t-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					onClick={() => setOpen((current) => !current)}
					type="button"
				/>
				<h2
					className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-text"
					id={headingId}
				>
					<span className="truncate">{title}</span>
					<motion.span
						animate={{ rotate: open ? 0 : -90 }}
						aria-hidden
						className={cn(
							"inline-flex shrink-0 origin-center text-icon-subtlest transition-opacity duration-normal ease-out-practical motion-reduce:transition-none",
							open
								? "opacity-0 group-hover/rail-panel:opacity-100 group-focus-within/rail-panel:opacity-100"
								: "opacity-100",
						)}
						initial={false}
						style={shouldReduceMotion ? undefined : { willChange: "transform" }}
						transition={shouldReduceMotion ? REDUCED_MOTION_TRANSITION : open ? CONTENT_ENTER : CONTENT_EXIT}
					>
						<ChevronDownIcon label="" size="small" />
					</motion.span>
				</h2>
				{open || alwaysShowHeaderActions ? (
					headerActions ? (
						<div className="relative z-10 ml-auto flex items-center gap-0.5">
							{headerActions}
						</div>
					) : null
				) : null}
			</div>
			<motion.div
				animate={open ? "open" : "closed"}
				aria-hidden={!open}
				className={cn("overflow-hidden", open ? "has-[:focus-visible]:overflow-visible" : undefined)}
				id={contentId}
				inert={!open ? true : undefined}
				initial={false}
				style={shouldReduceMotion ? undefined : { willChange: "opacity" }}
				variants={panelContentVariants(shouldReduceMotion)}
			>
				{children}
			</motion.div>
			{open ? footer : null}
		</section>
	);
}
