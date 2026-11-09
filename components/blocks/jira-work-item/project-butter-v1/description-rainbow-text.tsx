"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

import { DESCRIPTION_REVEAL_WORD_LIMIT, planDescriptionReveal } from "@/components/blocks/jira-work-item/project-butter-v1/description-reveal-plan";
import { SUGGESTION_RAINBOW_COLORS } from "@/components/blocks/jira-work-item/project-butter-v1/suggestion-rainbow-text";
import { resolveWaveHighlightColor } from "@/components/ui-custom/lib/shimmer-colors";
import { motionDuration, motionEase } from "@/lib/motion";

type RevealPart = Readonly<{ text: string; start: number; word: boolean }>;

function visibleParagraphs(text: string): { paragraphs: RevealPart[][]; count: number } {
	const paragraphs: RevealPart[][] = [];
	let words = 0;
	let offset = 0;
	for (const paragraph of text.split(/\n[\t ]*\n/u)) {
		if (words >= DESCRIPTION_REVEAL_WORD_LIMIT) break;
		const parts: RevealPart[] = [];
		for (const part of paragraph.split(/(\s+)/u)) {
			if (!part) continue;
			const word = /\S/u.test(part);
			if (word && words >= DESCRIPTION_REVEAL_WORD_LIMIT) break;
			parts.push({ text: part, start: offset, word });
			offset += Array.from(part).length;
			if (word) words += 1;
		}
		paragraphs.push(parts);
		offset += 2;
	}
	return { paragraphs, count: Math.max(offset - 2, 1) };
}

export function DescriptionRainbowText({ onComplete, text }: Readonly<{ onComplete?: () => void; text: string }>) {
	const rootRef = useRef<HTMLSpanElement>(null);
	const reduced = useReducedMotion();
	const { paragraphs, count } = visibleParagraphs(text);
	useLayoutEffect(() => {
		if (reduced) {
			const timer = window.setTimeout(() => onComplete?.(), 0);
			return () => window.clearTimeout(timer);
		}
		const root = rootRef.current;
		if (!root) return;
		const words = [...root.querySelectorAll<HTMLElement>("[data-description-word]")];
		const positions = words.map((word) => ({ line: Math.round(word.getBoundingClientRect().top), paragraph: Number(word.dataset.paragraph) }));
		const colorOffsets = words.map((word) => {
			const base = word.firstElementChild;
			const color = word.querySelector<HTMLElement>("[data-description-color]");
			if (!base || !color) return null;
			const baseRange = document.createRange();
			const colorRange = document.createRange();
			baseRange.selectNodeContents(base);
			colorRange.selectNodeContents(color);
			const baseRect = baseRange.getBoundingClientRect();
			const colorRect = colorRange.getBoundingClientRect();
			return { color, x: baseRect.left - colorRect.left, y: baseRect.top - colorRect.top };
		});
		const steps = planDescriptionReveal(positions);
		const animations: { finished: Promise<unknown>; stop: () => void }[] = [];
		let active = true;
		for (const [index, word] of words.entries()) {
			const step = steps[index];
			word.dataset.revealPhase = step.phase;
			animations.push(animate(word, { opacity: 1 }, { delay: step.delay, duration: motionDuration.medium, ease: motionEase.outPractical }));
			const offset = colorOffsets[index];
			if (offset) {
				offset.color.style.translate = `${offset.x}px ${offset.y}px`;
				animations.push(animate(offset.color, { opacity: [0, 1, 1, 0] }, { delay: step.delay, duration: motionDuration.slowest, ease: motionEase.inOut, times: [0, 0.2, 0.65, 1] }));
			}
		}
		const finish = () => { if (active) onComplete?.(); };
		void Promise.all(animations.map((animation) => animation.finished)).then(finish, finish);
		return () => {
			active = false;
			for (const animation of animations) animation.stop();
			for (const offset of colorOffsets) offset?.color.style.removeProperty("translate");
		};
	}, [onComplete, reduced, text]);
	if (reduced) return <span>{text}</span>;

	return <span className="whitespace-break-spaces" data-suggestion-text-reveal="" ref={rootRef}>
		{paragraphs.map((parts, paragraph) => <span className="mb-2.5 block last:mb-0" key={paragraph}>
			{parts.map((part, index) => part.word ? <span className="relative inline whitespace-nowrap" data-description-word="" data-paragraph={paragraph} key={index} style={{ opacity: 0 }}>
				<span>{part.text}</span>
				<span className="pointer-events-none absolute inset-0 bg-clip-text text-transparent" data-description-color="" style={{
					backgroundImage: `linear-gradient(to right, ${resolveWaveHighlightColor(SUGGESTION_RAINBOW_COLORS, part.start, count)}, ${resolveWaveHighlightColor(SUGGESTION_RAINBOW_COLORS, part.start + Array.from(part.text).length - 1, count)})`,
					opacity: 0,
				}}>{part.text}</span>
			</span> : part.text)}
		</span>)}
	</span>;
}
