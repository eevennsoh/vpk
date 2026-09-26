/**
 * Shared Agent Session deck poses. Both backing sheets fan downward with
 * irregular angles and offsets; the lead stays upright for legibility and
 * stable measurement. The count badge represents the full cohort.
 */
export const DECK_VISIBLE_MAX = 3;
export const DECK_LAYERS = [
	{ rotateDeg: 2.4, xPx: 4, yPx: 3 },
	{ rotateDeg: -3.2, xPx: -3, yPx: 6 },
] as const;
export const DECK_LAYER_FALLBACK = { rotateDeg: 4, xPx: 6, yPx: 9 } as const;
