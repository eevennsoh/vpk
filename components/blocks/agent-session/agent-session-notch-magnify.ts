import type { RefObject } from "react";
import type { MotionValue } from "motion/react";

/**
 * The notch rail's dock model — the geometry behind the mountain profile.
 *
 * A rail of notches is the same idea as the Pulse ruler: a column of hairlines
 * that swells around the pointer, so the notch under the hand is the longest and
 * its neighbours taper off either side. That falloff is what makes the rail read
 * as one connected surface being pushed rather than a single mark lighting up.
 *
 * Declared here rather than imported from Pulse, because a shared block must not
 * reach into a kanban variant's internals — the same trade the collapsed column
 * already makes for its 32px width. Pure on purpose: this is the half a test can
 * execute without a React tree behind it, and keeping it out of the component
 * file is also what keeps Fast Refresh working in the mark.
 */

/**
 * Parked well outside the rail, and finite. An `Infinity` or `NaN` written to a
 * motion value poisons it permanently — every later frame reads back `NaN`.
 */
export const AGENT_SESSION_NOTCH_POINTER_AWAY = -1;

/**
 * How far from the pointer a notch still answers, in px.
 *
 * Notches sit on a 24px pitch (a 20px row plus `gap-1`), so 96px puts three
 * neighbours either side on the slope — a seven-notch mountain: wide enough to
 * read as a surface being pushed, narrow enough that the rest of a long rail
 * stays at rest.
 */
export const AGENT_SESSION_NOTCH_MAGNIFY_RADIUS = 96;

/**
 * Notch length in px at either end of the swell.
 *
 * `rest` is the canonical mark and must stay in step with the `w-3` the
 * unmagnified mark paints. `peak` is the widest the rail can carry: a 32px
 * column with a 24px channel, so a notch directly under the pointer spans that
 * channel edge to edge and no further. A newly synced notch rests part-way up
 * the ramp: already lit, as though the rail were holding the hover open for you.
 */
export const AGENT_SESSION_NOTCH_LENGTH = {
	newRest: 18,
	peak: 24,
	rest: 12,
} as const;

/** Circular user-dot diameter in px; the revealed photo is capped at 12px. */
export const AGENT_SESSION_USER_NOTCH_DIAMETER = {
	peak: 12,
	rest: 4,
} as const;

/**
 * Notch colour, as named icon tokens.
 *
 * Colour is a **selection** signal, not a slope one. Only the notch the pointer
 * has landed on takes `color.icon`; every other notch — near neighbours on the
 * swell included — stays `color.icon.disabled`. Spreading the darkening across
 * the mountain the way the length is spread washed the distinction out: seven
 * marks each a shade darker than the last reads as one grey gradient and answers
 * "where am I" for none of them. Length says how close, colour says which one.
 *
 * These are the tokens themselves, not an alpha of `color.icon` mixed over the
 * plane. A 0.66–0.68 opacity used to approximate a subtler grey over the old
 * fill; once the plane became `bg-surface` that mix was a third grey, and a
 * 1px hairline has no weight to spare on a wrong one. Line-mode new
 * notches stay on `color.icon` — already lit. Circle dots rest in
 * `color.icon.disabled` regardless of whether they are newly synced.
 */
export const AGENT_SESSION_NOTCH_TONE = {
	rest: "var(--color-icon-disabled)",
	selected: "var(--color-icon)",
} as const;

/** Swell in at the list-item interaction profile; out faster, as every exit is. */
export const AGENT_SESSION_NOTCH_MAGNIFY_IN = {
	duration: 0.15,
	ease: [0.4, 1, 0.6, 1] as [number, number, number, number],
}; // duration-normal + ease-out-practical

export const AGENT_SESSION_NOTCH_MAGNIFY_OUT = {
	duration: 0.1,
	ease: [0.6, 0, 0.8, 0.6] as [number, number, number, number],
}; // duration-fast + ease-in

/** No notch is selected — the pointer is off the rail. Finite, like the pointer. */
export const AGENT_SESSION_NOTCH_NO_NEAREST = -1;

/**
 * Everything one notch needs to place itself on the shared slope.
 *
 * `centersRef` holds every notch's centre in the rail's *content* space, indexed
 * as rendered, so scrolling moves the pointer rather than invalidating the
 * measurements. `nearestIndex` is the one notch the pointer has landed on, which
 * is the only one that takes the selected colour. A mark given no proximity
 * simply has no rail behind it — the Small session variant — and stays at its
 * resting length.
 */
export interface AgentSessionNotchProximity {
	centersRef: RefObject<number[]>;
	index: number;
	/** 0–1, faded in when the pointer arrives and out when it leaves. */
	magnify: MotionValue<number>;
	/** Index of the notch under the pointer; `AGENT_SESSION_NOTCH_NO_NEAREST` when out. */
	nearestIndex: MotionValue<number>;
	/** Pointer position in rail content space; `AGENT_SESSION_NOTCH_POINTER_AWAY` when out. */
	pointerY: MotionValue<number>;
}

/**
 * Dock falloff: 1 under the pointer, 0 at the radius, smooth at both ends.
 *
 * Distance is in pixels, never in list index. The two agree while the rail is
 * uniform, but an arriving notch animates its neighbours into place over a
 * quarter second, and index distance would jump where the pixels are still
 * sliding.
 */
export function toAgentSessionNotchMagnification(
	distance: number,
	radius: number = AGENT_SESSION_NOTCH_MAGNIFY_RADIUS,
): number {
	if (!Number.isFinite(distance) || radius <= 0) {
		return 0;
	}
	const normalized = Math.min(Math.abs(distance) / radius, 1);
	const eased = 1 - normalized * normalized;
	return eased * eased;
}

function toClampedMagnification(magnification: number): number {
	if (!Number.isFinite(magnification)) {
		return 0;
	}
	return Math.min(Math.max(magnification, 0), 1);
}

/** Length in px for a notch at `magnification` along the slope. */
export function toAgentSessionNotchLength(magnification: number, isNew: boolean): number {
	const rest = isNew ? AGENT_SESSION_NOTCH_LENGTH.newRest : AGENT_SESSION_NOTCH_LENGTH.rest;
	return rest + (AGENT_SESSION_NOTCH_LENGTH.peak - rest) * toClampedMagnification(magnification);
}

/** Diameter in px for a collapsed user dot at `magnification`. */
export function toAgentSessionUserNotchDiameter(magnification: number): number {
	return AGENT_SESSION_USER_NOTCH_DIAMETER.rest + (
		AGENT_SESSION_USER_NOTCH_DIAMETER.peak - AGENT_SESSION_USER_NOTCH_DIAMETER.rest
	) * toClampedMagnification(magnification);
}

/**
 * Named token for a notch. Binary: selected (or newly synced) is `color.icon`,
 * everything else is `color.icon.disabled`. `magnify` is only a gate — the
 * colour does not interpolate along the swell.
 */
export function toAgentSessionNotchTone(isSelected: boolean, isNew: boolean): string {
	return isNew || isSelected
		? AGENT_SESSION_NOTCH_TONE.selected
		: AGENT_SESSION_NOTCH_TONE.rest;
}

/**
 * Which notch the pointer has landed on, by nearest measured centre.
 *
 * Nearest, not "within half a pitch": the rail's rows are uniform at rest but an
 * arrival slides them, and a threshold would leave the gap between two moving
 * notches selecting neither. A pointer anywhere on the rail always belongs to
 * exactly one notch.
 */
export function toNearestAgentSessionNotchIndex(
	centers: readonly number[],
	pointerY: number,
): number {
	if (!Number.isFinite(pointerY) || pointerY < 0) {
		return AGENT_SESSION_NOTCH_NO_NEAREST;
	}
	let nearest = AGENT_SESSION_NOTCH_NO_NEAREST;
	let shortest = Number.POSITIVE_INFINITY;
	for (let index = 0; index < centers.length; index += 1) {
		const distance = Math.abs(centers[index] - pointerY);
		if (distance < shortest) {
			shortest = distance;
			nearest = index;
		}
	}
	return nearest;
}
