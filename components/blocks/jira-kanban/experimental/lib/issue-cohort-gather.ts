export type IssueCohortGatherLayer = Readonly<{ xPx: number; yPx: number; rotateDeg: number }>;

/** Jira's wider issue faces fan out at opposite corners above and below the lead. */
export const ISSUE_COHORT_DECK_LAYERS = [
	{ rotateDeg: -5, xPx: -6, yPx: -2 },
	{ rotateDeg: 6, xPx: 6, yPx: 4 },
] as const satisfies readonly IssueCohortGatherLayer[];

/** Roll once at pickup; gathering and release retain this gesture's exact poses. */
export function createIssueCohortDeckLayers(
	random: () => number = Math.random,
	previous: readonly IssueCohortGatherLayer[] = [],
	layerCount: number = ISSUE_COHORT_DECK_LAYERS.length,
): readonly IssueCohortGatherLayer[] {
	const bases = ISSUE_COHORT_DECK_LAYERS.slice(0, Math.max(0, layerCount));
	if (bases.length === 0) return [];
	const patterns = bases.length === 1 ? [[1], [-1]] : [[1, 1], [-1, -1], [1, -1], [-1, 1]];
	const family = (angles: readonly number[]) => angles.every((angle) => angle > 0) ? 1 : angles.every((angle) => angle < 0) ? -1 : 0;
	const previousFamily = family(previous.map((layer) => layer.rotateDeg));
	// Reversing two opposing blank sheets still looks like the same fan. Exclude
	// that whole silhouette, while allowing each sheet to tilt independently.
	const choices = previous.length > 0 ? patterns.filter((pattern) => family(pattern) !== previousFamily) : patterns;
	const directions = choices[Math.min(Math.floor(random() * choices.length), choices.length - 1)];
	const jitter = () => Math.round((random() * 3 - 1.5) * 100) / 100;
	return bases.map((layer, index) => ({
		rotateDeg: directions[index] * (Math.abs(layer.rotateDeg) + jitter()),
		xPx: layer.xPx + jitter(),
		yPx: layer.yPx + jitter(),
	}));
}

export const ISSUE_COHORT_GATHER_RISE_PX = 24;

// duration-slow + ease-out-practical; 35ms separates the two rear arrivals.
export const ISSUE_COHORT_GATHER_TIMING = {
	duration: 250,
	stagger: 35,
	easing: "cubic-bezier(0.4, 1, 0.6, 1)",
} as const;

/** Plain rear sheets gather straight upward into the existing deck poses. */
export function createIssueCohortGatherKeyframes(
	layer: IssueCohortGatherLayer,
): Keyframe[] {
	return [
		{ offset: 0, transform: `translate(${layer.xPx}px, ${layer.yPx + ISSUE_COHORT_GATHER_RISE_PX}px) rotate(${layer.rotateDeg}deg)` },
		{ offset: 1, transform: `translate(${layer.xPx}px, ${layer.yPx}px) rotate(${layer.rotateDeg}deg)` },
	];
}
