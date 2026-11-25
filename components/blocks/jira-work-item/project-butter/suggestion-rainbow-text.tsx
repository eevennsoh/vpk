"use client";

import { useRef, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";

import { DETAIL_VALUE_HANDOFF } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import type { DetailSuggestionReveal } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { TEXT_EFFECTS } from "@/components/visual/text-effects/data";
import { cn } from "@/lib/utils";

/**
 * AI-suggested text arrives with the Text Effects "Mask Reveal Up": each unit rises into place from below while it
 * fades and comes into focus. Values come from that effect's spec so the two cannot drift; its 30px rise (drawn for a
 * ~44px display heading) is kept as a proportion of the text, so it suits UI-sized type.
 */
const MASK_REVEAL = TEXT_EFFECTS["mask-reveal-up"];
const RISE_EM = 0.7;
export const SUGGESTION_REVEAL_FROM = { opacity: 0, y: `${RISE_EM}em`, filter: `blur(${MASK_REVEAL.from.blur ?? 0}px)` } as const;
export const SUGGESTION_REVEAL_TO = { opacity: 1, y: "0em", filter: "blur(0px)" } as const;
export const SUGGESTION_REVEAL_EASE = [...MASK_REVEAL.easing] as [number, number, number, number];
export const SUGGESTION_REVEAL_SECONDS = MASK_REVEAL.durationMs / 1000;
/** The effect's stagger, shortened for long values so the whole reveal still lands within about a second. */
export function suggestionRevealStagger(units: number): number {
	return Math.min(MASK_REVEAL.staggerMs / 1000, 0.6 / Math.max(units - 1, 1));
}

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

	const parts = text.split(/(\s+)/u);
	// Each part's place among the words, so every word can take its own slot in the stagger.
	const wordOrder = parts.map((part, index) => parts.slice(0, index).filter((earlier) => /\S/u.test(earlier)).length);
	const words = parts.filter((part) => /\S/u.test(part)).length;
	const stagger = suggestionRevealStagger(words);
	const lastWord = parts.findLastIndex((part) => /\S/u.test(part));
	return (
		<span className={textClass} data-suggestion-text-reveal="">
			<span className="sr-only">{text}</span>
			<span aria-hidden="true">
				{parts.map((part, partIndex) => {
					if (!part || /^\s+$/u.test(part)) return part;
					const delay = wordOrder[partIndex] * stagger;
					const finish = clipRef && onComplete ? () => {
						const clip = clipRef.current;
						if (partIndex === lastWord || (clip && finishesVisibleSweep(clip, partIndex))) onComplete();
					} : partIndex === lastWord ? onComplete : undefined;
					return (
						<motion.span
							animate={SUGGESTION_REVEAL_TO}
							className="inline-block whitespace-nowrap"
							data-suggestion-rainbow-word={clipRef ? partIndex : undefined}
							initial={SUGGESTION_REVEAL_FROM}
							key={partIndex}
							onAnimationComplete={finish}
							style={{ willChange: "opacity, transform, filter" }}
							transition={{ delay, duration: SUGGESTION_REVEAL_SECONDS, ease: SUGGESTION_REVEAL_EASE }}
						>
							{part}
						</motion.span>
					);
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
