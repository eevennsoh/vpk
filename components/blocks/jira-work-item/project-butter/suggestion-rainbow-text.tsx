"use client";

import { useRef, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";

import { DETAIL_VALUE_HANDOFF, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import type { DetailSuggestionReveal } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { resolveWaveHighlightColor } from "@/components/ui-custom/lib/shimmer-colors";
import { getShimmerWaveCharacterDelay } from "@/components/ui-custom/lib/shimmer-wave-timing";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const SUGGESTION_RAINBOW_COLORS = ["#FCA700", "#6A9A23", "#1868DB", "#AF59E1"] as const;
/** Each word comes into focus as it fades in under the rainbow: from this blur to sharp over the focus duration. */
export const SUGGESTION_REVEAL_BLUR = "blur(4px)";
export const SUGGESTION_REVEAL_FOCUS = { duration: motionDuration.slower, ease: motionEase.outPractical } as const;

function finishesVisibleSweep(clip: HTMLElement, partIndex: number) {
	const word = clip.querySelector(`[data-suggestion-rainbow-word="${partIndex}"]`);
	if (!word) return false;
	const bounds = clip.getBoundingClientRect();
	const isVisible = (element: Element) => {
		const { left, right, top, bottom } = element.getBoundingClientRect();
		return left < bounds.right && right > bounds.left && top < bounds.bottom && bottom > bounds.top;
	};
	if (!isVisible(word)) return false;
	for (let next = word.nextElementSibling; next; next = next.nextElementSibling) {
		if (isVisible(next)) return false;
	}
	return true;
}

export function SuggestionRainbowText({ text, onComplete, clipRef, truncate = false }: Readonly<{
	text: string;
	onComplete?: () => void;
	clipRef?: RefObject<HTMLSpanElement | null>;
	truncate?: boolean;
}>) {
	const reduced = useReducedMotion();
	const textClass = truncate ? "block min-w-0 truncate" : "whitespace-pre-wrap";
	if (reduced) return <span className={textClass}>{text}</span>;

	const count = Array.from(text).length;
	let offset = 0;
	const parts: { part: string; characters: string[]; start: number }[] = [];
	for (const part of text.split(/(\s+)/u)) {
		const characters = Array.from(part);
		parts.push({ part, characters, start: offset });
		offset += characters.length;
	}
	const lastWord = parts.findLastIndex(({ part }) => /\S/u.test(part));
	return (
		<span className={textClass} data-suggestion-text-reveal="">
			<span className="sr-only">{text}</span>
			<span aria-hidden="true">
				{parts.map(({ part, characters, start }, partIndex) => {
					if (!part || /^\s+$/u.test(part)) return part;
					const delay = getShimmerWaveCharacterDelay(start, count, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD);
					const finish = clipRef && onComplete ? () => {
						const clip = clipRef.current;
						if (partIndex === lastWord || (clip && finishesVisibleSweep(clip, partIndex))) onComplete();
					} : partIndex === lastWord ? onComplete : undefined;
					return <motion.span animate={{ opacity: 1, filter: "blur(0px)" }} className="relative inline-block whitespace-nowrap" data-suggestion-rainbow-word={clipRef ? partIndex : undefined} initial={{ opacity: 0, filter: SUGGESTION_REVEAL_BLUR }} key={partIndex} style={{ willChange: "opacity, filter" }} transition={{ delay, duration: motionDuration.medium, ease: motionEase.outPractical, filter: { ...SUGGESTION_REVEAL_FOCUS, delay } }}>
						<span>{part}</span>
						<motion.span animate={{ opacity: [0, 0.88, 0.88, 0] }} className="pointer-events-none absolute inset-0" data-suggestion-rainbow-band initial={{ opacity: 0 }} onAnimationComplete={finish} transition={{ delay, duration: SUGGESTION_REVEAL_DURATION, ease: motionEase.linear, times: [0, 0.17, 0.45, 1] }}>
							{characters.map((character, index) => <span key={start + index} style={{ color: resolveWaveHighlightColor(SUGGESTION_RAINBOW_COLORS, start + index, count) }}>{character}</span>)}
						</motion.span>
					</motion.span>;
				})}
			</span>
		</span>
	);
}

export function SuggestionValueReveal({ className, reveal, truncate }: Readonly<{
	className?: string;
	reveal: DetailSuggestionReveal;
	truncate?: boolean;
}>) {
	const clipRef = useRef<HTMLSpanElement>(null);
	return (
		<motion.span
			animate={{ opacity: 1 }}
			aria-hidden
			className={cn("pointer-events-none absolute inset-0 min-w-0 overflow-hidden group-focus-within/butter-field:opacity-0!", className)}
			exit={{ opacity: 0 }}
			initial={false}
			ref={clipRef}
			transition={DETAIL_VALUE_HANDOFF}
		>
			<SuggestionRainbowText clipRef={clipRef} onComplete={reveal.finish} text={reveal.text} truncate={truncate} />
		</motion.span>
	);
}
