/**
 * Pure timeline math for the closing-keynote finale. Every scene is a function
 * of the music clock, so these helpers stay deterministic and seekable.
 */

export type Ease = (progress: number) => number;

export function clamp(value: number, min = 0, max = 1): number {
	return value < min ? min : value > max ? max : value;
}

export function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

/** Linear 0→1 progress of `time` through the window [start, end]. */
export function progress(time: number, start: number, end: number): number {
	if (end <= start) return time >= end ? 1 : 0;
	return clamp((time - start) / (end - start));
}

/** Smoothstep of `value` from `edge0` to `edge1`: 0 → 1, eased at both ends. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
	const x = clamp((value - edge0) / (edge1 - edge0));
	return x * x * (3 - 2 * x);
}

export const HANDOVER_FACE_SHARE = 0.6;

/** The live face comes up before its printed sheet fades, keeping coverage above 98%. */
export function handoverFaceOpacity(amount: number): number {
	return progress(amount, 0, HANDOVER_FACE_SHARE);
}

/** The sheet's distortion clears continuously while the live face takes over. */
export function handoverSheetOpacity(amount: number): number {
	return 1 - smoothstep(0.4, 1, amount);
}

/** CSS-style cubic-bezier easing solved with Newton-Raphson plus bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
	const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

	return (input) => {
		const x = clamp(input);
		if (x === 0 || x === 1) return x;
		let t = x;
		for (let index = 0; index < 8; index += 1) {
			const error = sampleX(t) - x;
			if (Math.abs(error) < 1e-5) return sampleY(t);
			const slope = slopeX(t);
			if (Math.abs(slope) < 1e-6) break;
			t -= error / slope;
		}
		let low = 0;
		let high = 1;
		t = x;
		for (let index = 0; index < 24; index += 1) {
			const value = sampleX(t);
			if (Math.abs(value - x) < 1e-5) break;
			if (value < x) low = t;
			else high = t;
			t = (low + high) / 2;
		}
		return sampleY(t);
	};
}

/**
 * ADS motion curves, resolved for JS (Motion/JS cannot read `var()`).
 * See `.agents/rules/motion-decisions.md` for the token map.
 */
export const EASE = {
	/** `--ease-out` (bold): prominent entrances. */
	outBold: cubicBezier(0, 0.4, 0, 1),
	/** `--ease-in-out` (bold): in-place transforms and camera moves. */
	inOut: cubicBezier(0.4, 0, 0, 1),
	/** `--ease-in` (practical): every exit. */
	in: cubicBezier(0.6, 0, 0.8, 0.6),
	/** `--ease-out-practical`: small, frequent entrances. */
	outPractical: cubicBezier(0.4, 1, 0.6, 1),
	linear: (value: number) => clamp(value),
} as const satisfies Record<string, Ease>;

/** Eased progress through a window. */
export function eased(time: number, start: number, end: number, ease: Ease = EASE.inOut): number {
	return ease(progress(time, start, end));
}

/**
 * Critically-under-damped spring response for elapsed seconds. Settles at 1
 * with one soft overshoot — the "slam then land" used when bento tiles arrive.
 */
export function spring(elapsed: number, stiffness = 170, damping = 18): number {
	if (elapsed <= 0) return 0;
	const omega = Math.sqrt(stiffness);
	const zeta = damping / (2 * omega);
	if (zeta >= 1) return 1 - Math.exp(-omega * elapsed) * (1 + omega * elapsed);
	const omegaD = omega * Math.sqrt(1 - zeta * zeta);
	const decay = Math.exp(-zeta * omega * elapsed);
	return 1 - decay * (Math.cos(omegaD * elapsed) + (zeta * omega / omegaD) * Math.sin(omegaD * elapsed));
}

/** Deterministic per-index pseudo random in [0, 1). */
export function hash01(seed: number): number {
	const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
	return value - Math.floor(value);
}

/**
 * Parses `#rrggbb` or `rgb()/rgba()` into channels. Hex is checked first: its
 * digits would otherwise be misread as decimal channels (#F8F8F8 → 8, 8, 8).
 */
export function parseRgb(colour: string): readonly [number, number, number] {
	const value = colour.trim();
	if (value.startsWith("#")) {
		const hex = value.slice(1);
		return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
	}
	const channels = value.match(/\d+(\.\d+)?/gu) ?? [];
	return [Number(channels[0] ?? 0), Number(channels[1] ?? 0), Number(channels[2] ?? 0)];
}
