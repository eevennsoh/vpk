"use client";

import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const ORB_DOTS = [
	{ position: "top", className: "spinner-experimental-orb-dot-top" },
	{ position: "top-right", className: "spinner-experimental-orb-dot-top-right" },
	{ position: "bottom-right", className: "spinner-experimental-orb-dot-bottom-right" },
	{ position: "bottom", className: "spinner-experimental-orb-dot-bottom" },
	{ position: "bottom-left", className: "spinner-experimental-orb-dot-bottom-left" },
	{ position: "top-left", className: "spinner-experimental-orb-dot-top-left" },
] as const;

interface ExperimentalSpinnerProps {
	className?: string;
	label: string;
	pulse?: boolean;
	style?: React.CSSProperties;
}

export function ExperimentalSpinner({
	className,
	label,
	pulse = false,
	style,
}: Readonly<ExperimentalSpinnerProps>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const canAnimate = !shouldReduceMotion;

	return (
		<svg
			aria-label={label}
			className={cn("pointer-events-none shrink-0 overflow-visible", className)}
			data-iconic-orb=""
			data-slot="spinner"
			fill="none"
			role="status"
			style={style}
			viewBox="0 0 20 20"
		>
			<g className={cn(
				"spinner-experimental-orb-rotator",
				canAnimate && "spinner-experimental-orb-rotator-motion",
				canAnimate && pulse && "spinner-experimental-orb-rotator-pulse-delay",
			)}>
				{ORB_DOTS.map((dot) => (
					<circle
						className={cn(
							"spinner-experimental-orb-dot",
							dot.className,
							pulse && "spinner-experimental-orb-dot-inner",
							canAnimate && pulse && "spinner-experimental-orb-dot-motion",
						)}
						cx="10"
						cy="10"
						fill="currentColor"
						key={dot.position}
						r="1.2"
					/>
				))}
			</g>
		</svg>
	);
}
