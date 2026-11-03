import { motionDuration } from "../../../../lib/motion.ts";

export const DESCRIPTION_REVEAL_WORD_LIMIT = 64;

export type DescriptionRevealPhase = "word" | "line" | "paragraph" | "all";
export type DescriptionWordPosition = Readonly<{ line: number; paragraph: number }>;
export type DescriptionRevealStep = Readonly<{ delay: number; phase: DescriptionRevealPhase }>;

export function planDescriptionReveal(words: readonly DescriptionWordPosition[]): DescriptionRevealStep[] {
	const steps: DescriptionRevealStep[] = [];
	let cursor = 0;
	let delay = 0;
	while (cursor < Math.min(5, words.length)) {
		steps.push({ delay, phase: "word" });
		cursor += 1;
		delay += motionDuration.fast;
	}
	for (let group = 0; group < 2 && cursor < words.length; group += 1) {
		const { line, paragraph } = words[cursor];
		while (cursor < words.length && words[cursor].line === line && words[cursor].paragraph === paragraph) {
			steps.push({ delay, phase: "line" });
			cursor += 1;
		}
		delay += motionDuration.medium;
	}
	for (let group = 0; group < 2 && cursor < words.length; group += 1) {
		const { paragraph } = words[cursor];
		while (cursor < words.length && words[cursor].paragraph === paragraph) {
			steps.push({ delay, phase: "paragraph" });
			cursor += 1;
		}
		delay += motionDuration.slow;
	}
	while (cursor < words.length) {
		steps.push({ delay, phase: "all" });
		cursor += 1;
	}
	return steps;
}
