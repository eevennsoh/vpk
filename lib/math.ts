// Numeric helpers with no imports, so render loops and workers can take them without
// lib/utils' class-name helpers. `@/lib/utils` re-exports `clamp` for its existing callers.

/** `min` wins when the range is inverted (`min > max`); NaN stays NaN. */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** Linear interpolation: `from` at `amount` 0, `to` at 1, extrapolating outside 0–1. */
export function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}
