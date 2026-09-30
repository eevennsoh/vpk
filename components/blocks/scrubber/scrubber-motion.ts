import { motionEase } from "../../../lib/motion.ts";
/**
 * Motion signatures for the notch rail.
 *
 * The swell is an *interaction* — it answers the pointer — so it takes the
 * practical curve in and the practical exit curve out, and the exit is shorter
 * than the entrance because the user caused the dismissal
 * (`.agents/rules/motion-decisions.md`).
 *
 * Only the swell lives here. It is driven by Motion for React, which cannot read
 * `var()`, so these are the resolved token values with the token name kept in
 * the comment. Everything animated by CSS instead — the sliding pill — keeps its
 * timing in `duration-*` / `ease-*` utility classes, where the token indirection
 * survives. `as const` matters: without it TypeScript widens `ease` to
 * `number[]`, which does not satisfy Motion's four-tuple bezier type.
 */

export const SCRUBBER_MAGNIFY_IN = {
	duration: 0.15,
	ease: motionEase.outPractical,
} as const; // duration-normal + ease-out-practical

export const SCRUBBER_MAGNIFY_OUT = {
	duration: 0.1,
	ease: motionEase.in,
} as const; // duration-fast + ease-in

export const SCRUBBER_REDUCED = { duration: 0 } as const;

/**
 * VPK duration tokens resolve to literal milliseconds and keep playing when the
 * user has asked for reduced motion, so every consumer has to collapse them
 * explicitly. `useReducedMotion()` returns `null` before hydration, which reads
 * as "not reduced" here — the same as the CSS default.
 *
 * Collapsing a transition is necessary but not sufficient for the rail: the
 * pointer handlers must also skip hover-driven selection under reduced motion,
 * because a zero-duration swell would still let a sweep commit at frame rate.
 */
export function resolveScrubberTransition<T>(
	transition: T,
	shouldReduceMotion: boolean | null,
): T | typeof SCRUBBER_REDUCED {
	return shouldReduceMotion ? SCRUBBER_REDUCED : transition;
}
