import { motionEase } from "../../../lib/motion.ts";
/**
 * Motion signatures for the Omnibar's geometries.
 *
 * The pill and the bar are **not** one morphing box. They are two surfaces that cross-fade
 * through each other on a shared z-axis: the outgoing one keeps travelling in the direction
 * the transition is heading (toward the viewer when expanding, away when collapsing) while
 * the incoming one arrives from the other side of rest. Animating a 96px pill's width into a
 * 720px bar instead stretches one box across the screen, which reads as a rubber band and
 * forces every child to defend itself against the parent's layout projection.
 *
 * Because each surface only ever enters in one direction and exits in the other, the two
 * scales below are constants rather than a runtime branch: the pill exits only when the bar
 * is arriving, and the bar exits only when the pill is coming back.
 *
 * Motion for React cannot read `var()`, so these are the resolved token values with the
 * token name kept in the comment.
 */

/**
 * The arriving surface. `duration-slow` + the bold `ease-out` — a long, decelerating
 * landing, which is the curve the reference settles on.
 */
export const OMNIBAR_SURFACE_ENTER = {
	duration: 0.25,
	ease: motionEase.out,
} as const; // duration-slow + ease-out

/**
 * The leaving surface. Roughly a third of the entrance, so the outgoing geometry is gone
 * before the incoming one is legible and the two never read as a double image.
 */
export const OMNIBAR_SURFACE_EXIT = {
	duration: 0.1,
	ease: motionEase.in,
} as const; // duration-fast + ease-in

/**
 * Zoom endpoints for each surface, as scale factors around rest (1).
 *
 * Expanding pushes both surfaces *up* the z-axis — the pill overshoots past the viewer as it
 * leaves, the bar rises from behind. Collapsing pulls both *down* — the bar recedes, the pill
 * drops back from in front. Exits travel further than entrances because they have a third of
 * the time to clear the frame.
 */
export const OMNIBAR_PILL_ZOOM = { enterFrom: 1.1, exitTo: 1.3 } as const;
export const OMNIBAR_BAR_ZOOM = { enterFrom: 0.9, exitTo: 0.78 } as const;

export const OMNIBAR_PANEL_ENTER = {
	duration: 0.25,
	ease: motionEase.out,
} as const; // duration-slow + ease-out

export const OMNIBAR_PANEL_EXIT = {
	duration: 0.2,
	ease: motionEase.in,
} as const; // duration-medium + ease-in

/**
 * The edge-docked timeline rail. A small, high-frequency surface that slides in from
 * the edge it belongs to, so it takes the practical entrance rather than the bold one
 * — the same signature the popup family uses.
 */
export const OMNIBAR_RAIL_ENTER = {
	duration: 0.15,
	ease: motionEase.outPractical,
} as const; // duration-normal + ease-out-practical

export const OMNIBAR_RAIL_EXIT = {
	duration: 0.1,
	ease: motionEase.in,
} as const; // duration-fast + ease-in

export const OMNIBAR_REDUCED = { delay: 0, duration: 0 } as const;

/**
 * VPK duration tokens resolve to literal milliseconds and keep playing when the user has
 * asked for reduced motion, so every consumer has to collapse them explicitly.
 */
export function resolveOmnibarTransition<T>(
	transition: T,
	shouldReduceMotion: boolean | null,
): T | typeof OMNIBAR_REDUCED {
	return shouldReduceMotion ? OMNIBAR_REDUCED : transition;
}

/**
 * Reduced motion has to flatten the zoom as well as the duration: a zero-duration
 * transition still paints one frame at the `initial` scale, which is a visible pop on a
 * 720px surface.
 */
export function resolveOmnibarZoom(
	scale: number,
	shouldReduceMotion: boolean | null,
): number {
	return shouldReduceMotion ? 1 : scale;
}
