import { cubicBezier } from "./finale-math";

/*
 * Morphs between the identity's shapes without a morphing library: each path
 * is sampled into the same number of points round its outline, the second
 * ring is turned (and reversed if it winds the other way) to line up with the
 * first, and the morph is a straight blend of the two. The shapes share a
 * centred 100 × 100 box, so the blend never strays outside it.
 */

export interface MorphPoint {
	readonly x: number;
	readonly y: number;
}

export type MorphRing = readonly MorphPoint[];

/** Points round a closed path, evenly by length: `SVGPathElement` in the browser. */
export type PathSampler = (path: string, count: number) => MorphRing;

/** How long a cycling shape rests, then morphs on to the next, as `ShapeTile` does. */
export const SHAPE_HOLD_S = 2.2;
export const SHAPE_MORPH_S = 1.1;
const MORPH_EASE = cubicBezier(0.65, 0, 0.35, 1);

/** The shape a cycling tile shows `t` seconds in, and how far it has morphed on to the next. */
export function shapeStepAt(t: number, count: number): { readonly index: number; readonly progress: number } {
	const step = SHAPE_HOLD_S + SHAPE_MORPH_S;
	const at = Math.max(0, t);
	const index = Math.floor(at / step) % count;
	const local = at % step;
	return { index, progress: local < SHAPE_HOLD_S ? 0 : MORPH_EASE((local - SHAPE_HOLD_S) / SHAPE_MORPH_S) };
}

function signedArea(ring: MorphRing): number {
	let area = 0;
	for (let index = 0; index < ring.length; index += 1) {
		const a = ring[index];
		const b = ring[(index + 1) % ring.length];
		area += a.x * b.y - b.x * a.y;
	}
	return area / 2;
}

function cost(a: MorphRing, b: MorphRing, offset: number): number {
	let sum = 0;
	for (let index = 0; index < a.length; index += 1) {
		const p = a[index];
		const q = b[(index + offset) % b.length];
		sum += (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
	}
	return sum;
}

/** `to`, wound the way `from` winds and started where it lines up best with `from`. */
export function alignRing(from: MorphRing, to: MorphRing): MorphRing {
	const wound = Math.sign(signedArea(from)) === Math.sign(signedArea(to)) ? to : [...to].reverse();
	let best = 0;
	let bestCost = Number.POSITIVE_INFINITY;
	for (let offset = 0; offset < wound.length; offset += 1) {
		const value = cost(from, wound, offset);
		if (value < bestCost) {
			bestCost = value;
			best = offset;
		}
	}
	return wound.map((_, index) => wound[(index + best) % wound.length]);
}

/** A closed polygon path through `ring`, rounded to 0.01 of the 100-unit box. */
export function ringPath(ring: MorphRing): string {
	return `M${ring.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join("L")}Z`;
}

/** The blend of two aligned rings at `amount` (0 → `from`, 1 → `to`). */
export function blendRings(from: MorphRing, to: MorphRing, amount: number): MorphRing {
	return from.map((point, index) => ({ x: point.x + (to[index].x - point.x) * amount, y: point.y + (to[index].y - point.y) * amount }));
}

/** Samples a path with a detached `SVGPathElement`: no layout, no document insertion. */
export function svgPathSampler(): PathSampler {
	const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
	return (path, count) => {
		element.setAttribute("d", path);
		const length = element.getTotalLength();
		return Array.from({ length: count }, (_, index) => {
			const point = element.getPointAtLength((length * index) / count);
			return { x: point.x, y: point.y };
		});
	};
}
