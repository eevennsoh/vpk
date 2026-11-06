"use client";

import { motion, useReducedMotion } from "motion/react";

import { SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD } from "@/components/blocks/jira-work-item/project-butter-v1/details-rail";
import { resolveWaveHighlightColor } from "@/components/ui-custom/lib/shimmer-colors";
import { getShimmerWaveCharacterDelay } from "@/components/ui-custom/lib/shimmer-wave-timing";
import { motionDuration, motionEase } from "@/lib/motion";

export const SUGGESTION_RAINBOW_COLORS = ["#FCA700", "#6A9A23", "#1868DB", "#AF59E1"] as const;

export function SuggestionRainbowText({ text }: Readonly<{ text: string }>) {
	const reduced = useReducedMotion();
	if (reduced) return <span>{text}</span>;

	const count = Array.from(text).length;
	let offset = 0;
	const parts: { part: string; characters: string[]; start: number }[] = [];
	for (const part of text.split(/(\s+)/u)) {
		const characters = Array.from(part);
		parts.push({ part, characters, start: offset });
		offset += characters.length;
	}
	return (
		<span className="whitespace-pre-wrap" data-suggestion-text-reveal="">
			<span className="sr-only">{text}</span>
			<span aria-hidden="true">
				{parts.map(({ part, characters, start }, partIndex) => {
					if (/^\s+$/u.test(part)) return part;
					const delay = getShimmerWaveCharacterDelay(start, count, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD);
					return <motion.span animate={{ opacity: 1 }} className="relative inline-block whitespace-nowrap" initial={{ opacity: 0 }} key={partIndex} transition={{ delay, duration: motionDuration.medium, ease: motionEase.outPractical }}>
						<span>{part}</span>
						<motion.span animate={{ opacity: [0, 0.88, 0] }} className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} transition={{ delay, duration: SUGGESTION_REVEAL_DURATION, ease: motionEase.inOut }}>
							{characters.map((character, index) => <span key={start + index} style={{ color: resolveWaveHighlightColor(SUGGESTION_RAINBOW_COLORS, start + index, count) }}>{character}</span>)}
						</motion.span>
					</motion.span>;
				})}
			</span>
		</span>
	);
}
