"use client";

import { useId } from "react";
import { motion } from "motion/react";

import { GRID_WAVE_PATHS, GRID_WAVE_TIMES, STATIC_GRID_PATH } from "./grid-path";

interface AgentLanyardGridProps {
	active: boolean;
	color?: string;
	animationTrigger?: "hover" | "reveal";
}

// Existing hover feedback stays on duration-normal + ease-out-practical.
const HOVER_WAVE_TRANSITION = { duration: 0.15, ease: [0.4, 1, 0.6, 1] as const, times: GRID_WAVE_TIMES };
// Revealed previews opt into the original duration-slowest linear wave.
const REVEAL_WAVE_TRANSITION = { duration: 0.6, ease: "linear" as const, times: GRID_WAVE_TIMES };

export function AgentLanyardGrid({ active, color, animationTrigger = "hover" }: Readonly<AgentLanyardGridProps>) {
	const maskId = `lanyard-wave-${useId().replaceAll(":", "")}`;
	const waveTransition = animationTrigger === "reveal" ? REVEAL_WAVE_TRANSITION : HOVER_WAVE_TRANSITION;
	return (
		<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full text-border-bold" viewBox="0 0 252 108" preserveAspectRatio="xMidYMid slice" data-slot="agent-lanyard-grid" data-animated={active}>
			<defs>
				<mask id={maskId}>
					<motion.circle
						cx="126" cy="54" fill="none" stroke="white" strokeWidth="42"
						initial={{ r: 0, opacity: 0 }}
						animate={active ? { r: [0, 18.48, 47.74, 81.62, 118.58, 154], opacity: [0, 1, 1, 0.9, 0.45, 0] } : { r: 0, opacity: 0 }}
						transition={active ? waveTransition : { duration: 0 }}
					/>
				</mask>
			</defs>
			<motion.path
				data-slot="agent-lanyard-grid-lines"
				d={STATIC_GRID_PATH} fill="none" stroke="currentColor" strokeOpacity="0.6" strokeDasharray="0.01 3" strokeLinecap="round"
				initial={{ d: STATIC_GRID_PATH }} animate={{ d: active ? GRID_WAVE_PATHS : STATIC_GRID_PATH }}
				transition={active ? waveTransition : { duration: 0 }}
			/>
			<motion.path
				d={STATIC_GRID_PATH} fill="none" mask={`url(#${maskId})`} stroke={color ?? "currentColor"} strokeDasharray="0.01 3" strokeLinecap="round"
				initial={{ d: STATIC_GRID_PATH }} animate={{ d: active ? GRID_WAVE_PATHS : STATIC_GRID_PATH }}
				transition={active ? waveTransition : { duration: 0 }}
			/>
		</svg>
	);
}
