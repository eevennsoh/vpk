import { lerp } from "@/lib/math";

/**
 * Timing, gating and easing rules for the Jira linking.
 *
 * `field.ts` owns what one frame of the metaball field looks like; this module
 * owns the surrounding lifecycle — when the effect is allowed to exist at all,
 * how the release fuse ramps, and how a jittery pointer is smoothed into a
 * velocity. Pure, so the contract can be tested without a DOM, a GL context, or
 * a pointer.
 *
 * Deliberately domain-free: where the target *is* belongs to the host, because
 * only the host knows whether a target is a card, a row, a tray, or a well.
 */

/** Fuse ramp length, in ms. The `duration-slower` token. */
export const JIRA_LINKING_FUSE_DURATION_MS = 400;

/**
 * Smallest value an armed fuse ever reports.
 *
 * `resolveJiraLinkingFrame` returns null when nearness and fuseProgress are
 * both 0, so an exact 0 on the frame the fuse arms would blink the field out
 * for one frame between the approach and the fuse.
 */
export const JIRA_LINKING_FUSE_MIN_PROGRESS = 0.001;

/** Per-frame catch-up applied to the source's smoothed velocity. */
export const JIRA_LINKING_VELOCITY_SMOOTHING = 0.35;

/** Distance at which a target starts reacting to an approaching source. */
export const JIRA_LINKING_DEFAULT_RANGE_PX = 120;

/**
 * Turn a source-to-target distance into the 0-1 `nearness` the field consumes.
 *
 * Smoothstep, not linear: a linear ramp makes the field creep in from too far
 * away and reads as mush rather than as the target noticing the source.
 */
export function resolveJiraLinkingNearness(
	distance: number,
	rangePx: number = JIRA_LINKING_DEFAULT_RANGE_PX,
): number {
	if (!Number.isFinite(distance) || rangePx <= 0) {
		return 0;
	}
	const ramp = clamp01(1 - distance / rangePx);
	return ramp * ramp * (3 - 2 * ramp);
}

export interface JiraLinkingVector {
	x: number;
	y: number;
}

/**
 * Where the field is pulling, in client coordinates.
 *
 * A full rect rather than a point because the target blob morphs into the
 * target's actual shape: a host linking into a whole card wants the goo to
 * become that card, not a pill floating inside it.
 */
export interface JiraLinkingTarget {
	anchor: { x: number; y: number };
	width: number;
	height: number;
	/** Corner radius of the landing shape. Defaults to a pill if omitted. */
	radius?: number;
}

export interface JiraLinkingGate {
	hasRelease: boolean;
	nearness: number;
	shouldReduceMotion: boolean | null;
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(Math.max(value, 0), 1);
}

/**
 * Whether the effect should mount at all.
 *
 * Reduced motion is a hard veto rather than a shortened animation: the field is
 * decoration with no informational content, so the honest reduced-motion
 * treatment is no field, no RAF loop, and no WebGL context.
 */
export function isJiraLinkingActive(gate: Readonly<JiraLinkingGate>): boolean {
	if (gate.shouldReduceMotion) {
		return false;
	}
	return gate.hasRelease || clamp01(gate.nearness) > 0;
}

/**
 * Fuse ramp from the ms elapsed since release. Only called while the fuse is
 * armed, so it never reports a clean 0 — see the constant's note.
 */
export function resolveJiraLinkingFuseProgress(elapsedMs: number): number {
	if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
		return JIRA_LINKING_FUSE_MIN_PROGRESS;
	}
	return Math.min(
		Math.max(elapsedMs / JIRA_LINKING_FUSE_DURATION_MS, JIRA_LINKING_FUSE_MIN_PROGRESS),
		1,
	);
}

/**
 * Nearness handed to the field during the fuse.
 *
 * The approach ends at nearness ~1 and a released gesture has no proximity left
 * to read, so feeding a raw 0 would snap the neck shut on the release frame.
 * Decaying the last observed value keeps `smoothness` continuous, and reaching 0
 * by the end is what lets the field's own alpha collapse term win instead of
 * being pinned open by `max(nearness, …)`.
 */
export function resolveJiraLinkingFuseNearness(
	lastNearness: number,
	fuseProgress: number,
): number {
	return clamp01(lastNearness) * (1 - clamp01(fuseProgress));
}

/** Exponential catch-up so a single jittery frame cannot spike the dispersion. */
export function advanceJiraLinkingVelocity(
	previous: Readonly<JiraLinkingVector>,
	sample: Readonly<JiraLinkingVector>,
	smoothing: number = JIRA_LINKING_VELOCITY_SMOOTHING,
): JiraLinkingVector {
	const amount = clamp01(smoothing);
	return {
		x: previous.x + (sample.x - previous.x) * amount,
		y: previous.y + (sample.y - previous.y) * amount,
	};
}

/** Cubic ease-in-out, matching the curve the fuse travels its balls on. */
function easeInOut(t: number): number {
	return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

/**
 * Morph the landing shape across the fuse.
 *
 * A host can want the approach and the landing to be different shapes: the
 * field grows into a whole card while you carry the subject over it, but the
 * subject itself lands in one row of that card, and that row is where the glow
 * belongs. Swapping the target at the release frame pops — the blob would jump
 * from card-sized to row-sized in one frame — so the two rects are interpolated
 * on the same easing the balls travel on.
 *
 * `from` absent means no morph: the fuse simply lands on `to`.
 */
export function lerpJiraLinkingTarget(
	from: JiraLinkingTarget | null | undefined,
	to: JiraLinkingTarget | null,
	progress: number,
): JiraLinkingTarget | null {
	if (!to) {
		return from ?? null;
	}
	if (!from) {
		return to;
	}

	const amount = easeInOut(clamp01(progress));
	return {
		anchor: {
			x: lerp(from.anchor.x, to.anchor.x, amount),
			y: lerp(from.anchor.y, to.anchor.y, amount),
		},
		height: lerp(from.height, to.height, amount),
		radius: lerp(from.radius ?? 0, to.radius ?? 0, amount),
		width: lerp(from.width, to.width, amount),
	};
}
