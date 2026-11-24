"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";

import { Icon } from "@/components/ui/icon";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { AgentLanyardGrid } from "../agent-lanyard-grid";
import { motionDuration, motionEase } from "@/lib/motion";
import { AGENT_LANYARD_RECOMMENDATION_SURFACE_STYLE, AgentLanyardRecommendation, useAgentLanyardRecommendation } from "./agent-lanyard-recommendation";

interface AgentLanyardCardProps {
	id: string;
	name: string;
	byline: string;
	description: string;
	variant: "agent" | "template" | "recommended" | "mcp-setup";
	recommendationReason?: string;
	recommendationAppearance?: "perforated" | "chin";
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
	/** Tilt while the card is hovered, or settle into the tilt as soon as a preview reveals it. */
	tiltTrigger?: "hover" | "reveal";
	headingLevel?: 2 | 3;
	onSelect?: () => void;
	className?: string;
}

const HOVER_TILT = "perspective(900px) rotateX(-1.2deg) rotateY(4.4deg) rotateZ(-0.6deg)";
const REST_TILT = "perspective(900px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)";
const ENTER = { duration: 0.15, ease: motionEase.outPractical }; // duration-normal + ease-out-practical
const REVEAL = { duration: motionDuration.slow, ease: motionEase.inOut }; // duration-slow + ease-in-out: settles in place while the popup fades in
const EXIT = { duration: 0.1, ease: motionEase.in }; // duration-fast + ease-in
export const AGENT_LANYARD_CUTOUT_MASK = {
	maskImage: `linear-gradient(#000 0 0), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='6'%3E%3Crect width='40' height='6' rx='3' fill='white'/%3E%3C/svg%3E")`,
	maskSize: "100% 100%, 40px 6px",
	maskPosition: "center, center 7px",
	maskRepeat: "no-repeat",
	maskComposite: "exclude",
};

export function AgentLanyardCard({
	id, name, byline, description, variant, recommendationReason, recommendationAppearance = "perforated", avatar, footer, verified = false,
	accentColor, showGrid = true, showDescription = true, perspectiveTilt = true, animateGrid = false, gridAnimationTrigger = "hover", tiltTrigger = "hover", headingLevel = 3, onSelect, className,
}: Readonly<AgentLanyardCardProps>) {
	const Title = headingLevel === 2 ? "h2" : "h3";
	const [hovered, setHovered] = useState(false);
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	const tiltEnabled = perspectiveTilt && !reducedMotion;
	const revealTilt = tiltTrigger === "reveal";
	const tilted = revealTilt || hovered;
	const gridEnabled = showGrid && animateGrid && !reducedMotion;
	const recommended = variant === "recommended" && recommendationReason !== undefined;
	const mcpSetup = variant === "mcp-setup";
	const hoverSurface = hovered && !recommended && !mcpSetup;
	const hasChin = recommended && recommendationAppearance === "chin";
	const perforated = recommended && !hasChin;
	const { surfaceRef, identityRef } = useAgentLanyardRecommendation(perforated);
	const identity = (
		<>
			<div className={cn("relative h-[108px] shrink-0 overflow-hidden rounded-t-xl", showGrid && !mcpSetup ? "bg-bg-neutral" : "bg-surface-sunken", hoverSurface ? "-mx-px -mt-px h-[109px]" : null)} aria-hidden="true">
				{showGrid ? <AgentLanyardGrid key={id} active={gridEnabled && (gridAnimationTrigger === "reveal" || hovered)} color={accentColor} /> : null}
				<span data-slot="agent-lanyard-cutout" className="pointer-events-none absolute top-[7px] left-1/2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full">
					<span
						data-slot="agent-lanyard-cutout-shadow"
						className="absolute -inset-[0.5px] rounded-[inherit] text-border"
						// Fractional paint preserves Figma's rim instead of a snapped CSS border.
						style={{ boxShadow: "inset 0 0 0 0.5px currentColor, inset 0 1px 1px 0 rgba(30, 31, 33, 0.16), inset 0 0 1px 0 rgba(30, 31, 33, 0.12)" }}
					/>
				</span>
				<div className="absolute inset-x-0 top-4 bottom-0 grid place-items-center">{avatar}</div>
			</div>
			<div className="flex flex-1 flex-col gap-3 p-4">
				<div>
					<div className="flex min-w-0 items-center gap-1.5">
						<Title className={cn("min-w-0 text-base leading-6 font-medium text-text", recommended ? "wrap-anywhere" : "truncate")} title={name}>{name}</Title>
						{verified ? <Icon label="Verified by your org" className="shrink-0 text-icon-information" render={<StatusVerifiedIcon label="" size="small" color="currentColor" />} /> : null}
					</div>
					<p className="text-xs leading-4 font-medium text-text-subtle">{byline}</p>
				</div>
				{showDescription ? <p className={cn("text-xs leading-4 text-text-subtle", recommended ? "wrap-anywhere" : "min-h-12")}>{description}</p> : null}
				{footer}
			</div>
		</>
	);

	return (
		// The outer hover target stays stationary while the inner material rotates.
		<article
			aria-label={`${name} ${variant}`}
			className={cn("flow-root w-[252px] max-w-full", perforated ? "rounded-xl shadow-2xl" : null, className)}
			data-slot="agent-lanyard" data-agent-id={id} data-variant={variant}
			data-perspective-tilt={tiltEnabled} data-tilt-trigger={tiltEnabled ? tiltTrigger : undefined} data-grid-animation={gridEnabled}
			onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
			onPointerLeave={() => setHovered(false)}
			onPointerCancel={() => setHovered(false)}
		>
			<motion.div
				data-slot="agent-lanyard-cutout-mask"
				className="-m-4 p-4"
				style={{ ...AGENT_LANYARD_CUTOUT_MASK, maskPosition: "center, center 23px" }}
				initial={tiltEnabled && revealTilt ? { transform: REST_TILT } : false}
				animate={{ transform: tiltEnabled ? (tilted ? HOVER_TILT : REST_TILT) : "none" }}
				transition={tiltEnabled ? (tilted ? (revealTilt ? REVEAL : ENTER) : EXIT) : { duration: 0 }}
			>
			<div
				ref={surfaceRef}
				style={perforated ? AGENT_LANYARD_RECOMMENDATION_SURFACE_STYLE : undefined}
				data-slot="agent-lanyard-surface"
				className={cn(
					"relative flex flex-col rounded-xl",
					recommended ? null : "transition-[background-color,box-shadow] duration-normal ease-out-practical motion-reduce:transition-none",
					hasChin ? "bg-transparent" : "bg-surface",
					recommended ? "border-0" : "border border-border",
					mcpSetup ? "bg-clip-padding" : null,
					recommended || mcpSetup ? null : "min-h-[280px]",
					hoverSurface ? "border-transparent bg-surface-hovered shadow-2xl" : null,
				)}
			>
				{onSelect && !recommended ? (
					<button type="button" aria-label={variant === "template" ? `Use ${name} template` : `View ${name}`} onClick={onSelect} className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
				) : null}
				{recommended ? <>
					<div
						ref={identityRef}
						className={hasChin ? "relative z-10 rounded-xl bg-surface-raised shadow-sm" : undefined}
						data-slot="agent-lanyard-recommended-identity"
					>{identity}</div>
					{hasChin ? <div className="agent-lanyard-chin -mt-(--radius-xl) rounded-b-xl bg-surface shadow-2xl"><div className="rounded-b-xl bg-bg-neutral pt-(--radius-xl)"><AgentLanyardRecommendation reason={recommendationReason} headingLevel={headingLevel} perforated={false} /></div></div> : <AgentLanyardRecommendation reason={recommendationReason} headingLevel={headingLevel} perforated />}
				</> : identity}
			</div>
			</motion.div>
		</article>
	);
}
