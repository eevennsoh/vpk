import { cubicBezier } from "motion";

import { referenceEase } from "../../../lib/motion.ts";

/**
 * One build, as fractions of `duration`. The reveal runs a little past 1 and the
 * overlay is removed at `END`. Ported from transitions.dev's UI generation skill
 * (`skills/transitions-ui-generation/ui-generation.js`); the phases are tuned
 * together, so change `duration`, not the windows.
 */
export type PhaseWindow = readonly [number, number];

export const PHASES = {
	dots: [0, 0.3],
	probe: [0.02, 0.24],
	guides: [0.04, 0.3],
	outline: [0.1, 0.42],
	parts: [0.28, 0.74],
	reveal: [0.74, 1.055],
	clean: [0.84, 1.04],
} as const satisfies Record<string, PhaseWindow>;

export const END = 1.09;

/**
 * Upstream defaults to 2400ms; the reference capture reads `t+2.38s` on its size
 * label just as the scan line starts (0.74 of the build), which puts it at ~3200ms.
 */
export const DEFAULT_DURATION = 3200;
export const MIN_DURATION = 400;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export { lerp } from "@/lib/math";
export const smooth = (a: number, b: number, x: number) => {
	const q = clamp01((x - a) / (b - a));
	return q * q * (3 - 2 * q);
};
export const win = (range: PhaseWindow, p: number) => clamp01((p - range[0]) / (range[1] - range[0]));
export const fmt = (n: number) => n.toFixed(2);

/** Deterministic 0..1 noise, so every run of the same layout draws the same rain. */
export const hashN = (x: number) => {
	const v = Math.sin(x * 127.1 + 311.7) * 43758.5453;
	return v - Math.floor(v);
};

const clamped = (fn: (x: number) => number) => (x: number) => fn(clamp01(x));

/** Every stroke of the drawing: a soft, quick-settling ease-out. */
export const drawEase = clamped(cubicBezier(...referenceEase.generationDraw));
/** The real UI coming in behind the scan line. */
export const revealEase = clamped(cubicBezier(...referenceEase.smoothOut));

/** Inverse of `drawEase`: when along the outline window a point at fraction `f` is drawn. */
export function invertDrawEase(f: number): number {
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 26; i++) {
		const mid = (lo + hi) / 2;
		if (drawEase(mid) < f) lo = mid;
		else hi = mid;
	}
	return lo;
}

export interface PartSchedule {
	readonly t0: number;
	readonly t1: number;
}

/** Parts are traced in document order, overlapping, across the parts window. */
export function scheduleParts(count: number): PartSchedule[] {
	const [start, stop] = PHASES.parts;
	const span = stop - start;
	const dur = Math.min(0.2, span * 0.6);
	return Array.from({ length: count }, (_, i) => {
		const t0 = start + (count > 1 ? (span - dur) * (i / (count - 1)) : 0);
		return { t0, t1: t0 + dur };
	});
}

/** Index of the part the reticle is on: the last one that has started, or -1. */
export function activePartIndex(schedules: readonly PartSchedule[], p: number): number {
	let index = -1;
	schedules.forEach((schedule, i) => {
		if (p >= schedule.t0) index = i;
	});
	return index;
}
