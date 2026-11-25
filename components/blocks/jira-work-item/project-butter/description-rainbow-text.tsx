"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

import { DESCRIPTION_REVEAL_WORD_LIMIT, planDescriptionReveal } from "@/components/blocks/jira-work-item/project-butter/description-reveal-plan";
import { SUGGESTION_REVEAL_EASE, SUGGESTION_REVEAL_FROM, SUGGESTION_REVEAL_SECONDS, SUGGESTION_REVEAL_TO } from "@/components/blocks/jira-work-item/project-butter/suggestion-rainbow-text";

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
	const { paragraphs } = visibleParagraphs(text);
	useLayoutEffect(() => {
		if (reduced) {
			const timer = window.setTimeout(() => onComplete?.(), 0);
			return () => window.clearTimeout(timer);
		}
		const root = rootRef.current;
		if (!root) return;
		const words = [...root.querySelectorAll<HTMLElement>("[data-description-word]")];
		const steps = planDescriptionReveal(words.length);
		const animations: { finished: Promise<unknown>; stop: () => void }[] = [];
		let active = true;
		// Each word rises in with the Text Effects Mask Reveal Up, on the description's own word-by-word timing.
		for (const [index, word] of words.entries()) {
			// A transform string rather than `y`, so Motion hands all three properties to the browser's animation engine.
			animations.push(animate(word, { opacity: [SUGGESTION_REVEAL_FROM.opacity, SUGGESTION_REVEAL_TO.opacity], transform: [`translateY(${SUGGESTION_REVEAL_FROM.y})`, `translateY(${SUGGESTION_REVEAL_TO.y})`], filter: [SUGGESTION_REVEAL_FROM.filter, SUGGESTION_REVEAL_TO.filter] }, { delay: steps[index], duration: SUGGESTION_REVEAL_SECONDS, ease: SUGGESTION_REVEAL_EASE }));
		}
		const finish = () => { if (active) onComplete?.(); };
		void Promise.all(animations.map((animation) => animation.finished)).then(finish, finish);
		return () => {
			active = false;
			for (const animation of animations) animation.stop();
		};
	}, [onComplete, reduced, text]);
	if (reduced) return <span>{text}</span>;

	return <span className="whitespace-break-spaces" data-suggestion-text-reveal="" ref={rootRef}>
		{paragraphs.map((parts, paragraph) => <span className="mb-2.5 block last:mb-0" key={paragraph}>
			{parts.map((part, index) => part.word ? <span className="inline-block whitespace-nowrap" data-description-word="" key={index} style={{ opacity: SUGGESTION_REVEAL_FROM.opacity, transform: `translateY(${SUGGESTION_REVEAL_FROM.y})`, filter: SUGGESTION_REVEAL_FROM.filter, willChange: "opacity, transform, filter" }}>{part.text}</span> : part.text)}
		</span>)}
	</span>;
}
