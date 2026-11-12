"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";

import { Icon } from "@/components/ui/icon";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { AgentLanyardGrid } from "../agent-lanyard-grid";
import { motionEase } from "@/lib/motion";

interface AgentLanyardCardProps {
	id: string;
	name: string;
	byline: string;
	description: string;
	variant: "agent" | "template";
	avatar: ReactNode;
	footer: ReactNode;
	verified?: boolean;
	accentColor?: string;
	showGrid?: boolean;
	showDescription?: boolean;
	perspectiveTilt?: boolean;
	animateGrid?: boolean;
	/** Play the finite grid wave when mounted by a preview instead of on card hover. */
	gridAnimationTrigger?: "hover" | "reveal";
	headingLevel?: 2 | 3;
	onSelect?: () => void;
	className?: string;
}

const HOVER_TILT = "perspective(900px) rotateX(-1.2deg) rotateY(4.4deg) rotateZ(-0.6deg)";
const REST_TILT = "perspective(900px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)";
const ENTER = { duration: 0.15, ease: motionEase.outPractical }; // duration-normal + ease-out-practical
const EXIT = { duration: 0.1, ease: motionEase.in }; // duration-fast + ease-in

export function AgentLanyardCard({
	id, name, byline, description, variant, avatar, footer, verified = false,
	accentColor, showGrid = true, showDescription = true, perspectiveTilt = true, animateGrid = true, gridAnimationTrigger = "hover", headingLevel = 3, onSelect, className,
}: Readonly<AgentLanyardCardProps>) {
	const Title = headingLevel === 2 ? "h2" : "h3";
	const [hovered, setHovered] = useState(false);
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	const tiltEnabled = perspectiveTilt && !reducedMotion;
	const gridEnabled = showGrid && animateGrid && !reducedMotion;

	return (
		// The outer hover target stays stationary while the inner material rotates.
		<article
			aria-label={`${name} ${variant}`}
			className={cn("w-[252px] max-w-full", className)}
			data-slot="agent-lanyard" data-agent-id={id} data-variant={variant}
			data-perspective-tilt={tiltEnabled} data-grid-animation={gridEnabled}
			onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
			onPointerLeave={() => setHovered(false)}
			onPointerCancel={() => setHovered(false)}
		>
			<motion.div
				data-slot="agent-lanyard-surface"
				className={cn(
					"relative flex min-h-[280px] flex-col rounded-xl border border-border bg-surface transition-[background-color,box-shadow] duration-normal ease-out-practical motion-reduce:transition-none",
					hovered ? "border-transparent bg-surface-hovered shadow-2xl" : null,
				)}
				initial={false}
				animate={{ transform: tiltEnabled ? (hovered ? HOVER_TILT : REST_TILT) : "none" }}
				transition={tiltEnabled ? (hovered ? ENTER : EXIT) : { duration: 0 }}
			>
				{onSelect ? (
					<button type="button" aria-label={variant === "template" ? `Use ${name} template` : `View ${name}`} onClick={onSelect} className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
				) : null}
				<div className={cn("relative h-[108px] shrink-0 overflow-hidden rounded-t-xl", showGrid ? "bg-bg-neutral" : "bg-surface-sunken", hovered ? "-mx-px -mt-px h-[109px]" : null)} aria-hidden="true">
					{showGrid ? <AgentLanyardGrid key={id} active={gridEnabled && (gridAnimationTrigger === "reveal" || hovered)} color={accentColor} /> : null}
					<span data-slot="agent-lanyard-cutout" className="pointer-events-none absolute top-[7px] left-1/2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-[3.75px]">
						<span className="absolute inset-0 rounded-[inherit] bg-surface" />
						<span
							data-slot="agent-lanyard-cutout-shadow"
							className="absolute -inset-[0.5px] rounded-[inherit] text-border"
							// Fractional paint preserves Figma's rim instead of a snapped CSS border.
							style={{ boxShadow: "inset 0 0 0 0.5px currentColor, inset 0 1px 1px 0 rgba(30, 31, 33, 0.16), inset 0 0 1px 0 rgba(30, 31, 33, 0.12)" }}
						/>
					</span>
					<div className="absolute inset-x-0 top-4 bottom-0 grid place-items-center">
						{avatar}
					</div>
				</div>
				<div className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-4">
					<div>
						<div className="flex min-w-0 items-center gap-1.5">
							<Title className="min-w-0 truncate text-base leading-6 font-medium text-text" title={name}>{name}</Title>
							{verified ? <Icon label="Verified by your org" className="shrink-0 text-icon-information" render={<StatusVerifiedIcon label="" size="small" color="currentColor" />} /> : null}
						</div>
						<p className="text-xs leading-4 font-medium text-text-subtle">{byline}</p>
					</div>
					{showDescription ? <p className="min-h-12 text-xs leading-4 text-text-subtle">{description}</p> : null}
					{footer}
				</div>
			</motion.div>
		</article>
	);
}
