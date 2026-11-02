"use client";

import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const ORB_DOTS = [
	{ position: "top", className: "spinner-bloom-orb-dot-top" },
	{ position: "top-right", className: "spinner-bloom-orb-dot-top-right" },
	{ position: "bottom-right", className: "spinner-bloom-orb-dot-bottom-right" },
	{ position: "bottom", className: "spinner-bloom-orb-dot-bottom" },
	{ position: "bottom-left", className: "spinner-bloom-orb-dot-bottom-left" },
	{ position: "top-left", className: "spinner-bloom-orb-dot-top-left" },
] as const;

interface BloomSpinnerProps {
	avatar?: boolean;
	className?: string;
	label: string;
	pulse?: boolean;
	style?: React.CSSProperties;
}

export function BloomSpinner({
	avatar = false,
	className,
	label,
	pulse = false,
	style,
}: Readonly<BloomSpinnerProps>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const canAnimate = !shouldReduceMotion;

	return (
		<svg
			aria-label={label}
			className={cn("pointer-events-none shrink-0 overflow-visible", className)}
			data-iconic-orb=""
			data-iconic-orb-avatar={avatar ? "" : undefined}
			data-slot="spinner"
			fill="none"
			role="status"
			style={style}
			viewBox="0 0 20 20"
		>
			<g className={cn(
				"spinner-bloom-orb-rotator",
				canAnimate && "spinner-bloom-orb-rotator-motion",
				canAnimate && pulse && "spinner-bloom-orb-rotator-pulse-delay",
			)}>
				{ORB_DOTS.map((dot) => (
					<circle
						className={cn(
							"spinner-bloom-orb-dot",
							dot.className,
							avatar && "spinner-bloom-avatar-dot",
							canAnimate && pulse && (avatar
								? "spinner-bloom-avatar-dot-motion"
								: "spinner-bloom-orb-dot-motion"),
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
