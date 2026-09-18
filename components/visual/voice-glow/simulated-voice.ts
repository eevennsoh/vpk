// Speech-like phrases and pauses. The imported runtime supplies the actual
// attack/release envelope, band response, and glow animation.
const PHRASE = [
	[0, 0.55], [0.4, 0.85], [0.8, 0.35], [1.2, 0.03], [2.1, 0.03],
	[2.6, 0.55], [3, 1], [3.5, 0.75], [4, 0.55],
] as const;

export function sampleSimulatedVoice(seconds: number): number {
	const time = ((seconds % 4) + 4) % 4;
	for (let index = 1; index < PHRASE.length; index++) {
		const [end, next] = PHRASE[index];
		if (time > end) continue;
		const [start, previous] = PHRASE[index - 1];
		const progress = (time - start) / (end - start);
		const envelope = previous + (next - previous) * progress * progress * (3 - 2 * progress);
		const syllables = 0.8 + 0.12 * Math.sin(time * Math.PI * 14) + 0.08 * Math.sin(time * Math.PI * 21.5 + 1.1);
		return envelope * syllables;
	}
	return 0;
}

/** Sampled by VoiceBeam's shared driver; no second frame loop or React updates. */
export function createVoiceGlowSimulation(now: () => number = () => performance.now()) {
	let elapsed = 0;
	let lastRead: number | null = null;
	return {
		read: () => {
			const current = now();
			// Paused/offscreen instances aren't sampled. Resume without skipping
			// ahead through the phrase after a long gap, as the upstream clock does.
			if (lastRead !== null) elapsed += Math.max(0, Math.min(50, current - lastRead));
			lastRead = current;
			return sampleSimulatedVoice(elapsed / 1000) * 0.5;
		},
		reset: () => { elapsed = 0; lastRead = null; },
	};
}
