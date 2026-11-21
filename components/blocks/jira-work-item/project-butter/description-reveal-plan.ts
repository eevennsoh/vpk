import { motionDuration } from "../../../../lib/motion.ts";

export const DESCRIPTION_REVEAL_WORD_LIMIT = 64;

export function planDescriptionReveal(wordCount: number): number[] {
	let delay = 0;
	return Array.from({ length: Math.min(wordCount, DESCRIPTION_REVEAL_WORD_LIMIT) }, (_, index) => {
		const start = delay;
		delay += motionDuration.fast * (0.2 + 0.65 * 0.83 ** index);
		return start;
	});
}
