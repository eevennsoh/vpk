import type { Measured, PartName } from "./measure.ts";
import { PHASES, fmt, hashN, invertDrawEase, scheduleParts } from "./timeline.ts";

const NS = "http://www.w3.org/2000/svg";
/** How far the dot field and guides reach past the element. */
export const MARGIN = 44;
const DOT_SPACING = 15;
/**
 * The field is one SVG circle per dot, restyled every frame, so its size is
 * bounded: past this many, the spacing opens up instead of adding dots.
 */
export const MAX_DOTS = 1200;
/** Most precomputed points per stroke; finer than a stroke moves in one frame. */
const MAX_STOPS = 256;
const DOT_GAP = 4.8;
const GUIDE_GAP = 6.5;
const FLYERS = 44;

/**
 * The drawing stays monochrome, on ADS neutrals that flip with the theme: grey
 * dots read as the agent's working layer, and the real UI brings the colour.
 */
export const OVERLAY_CLASS = {
	dot: "fill-text-disabled",
	dotLit: "fill-text-subtlest",
	wire: "fill-none stroke-border-bold",
	guide: "fill-none stroke-border-bold",
	head: "fill-text-subtlest",
	handle: "fill-surface stroke-text-subtlest",
	reticle: "fill-none stroke-text-subtlest",
	label: "fill-border-bold font-mono",
	labelStrong: "fill-text-subtlest font-mono uppercase",
	glow: "text-border-bold",
} as const;

export interface Stroke {
	readonly el: SVGGeometryElement;
	/** Read with `stops` in `measureStrokes`, once every element is in the page. */
	length: number;
	readonly gap: number;
	/** Scale of an icon's own transform, so its dots match the rest of the drawing. */
	readonly k: number;
	readonly local: boolean;
	readonly together: boolean;
	head: SVGCircleElement | null;
	caps: readonly [SVGCircleElement, SVGCircleElement] | null;
	idx: number;
	dashCount: number;
	live: boolean;
	/** Points along the line every `step` px, read once at build so frames never query SVG geometry. */
	stops: readonly Point[];
	step: number;
	point: Point | null;
}

export interface Point {
	readonly x: number;
	readonly y: number;
}

export interface Dot {
	readonly el: SVGCircleElement;
	readonly x: number;
	readonly y: number;
	readonly d: number;
	readonly edge: number;
	readonly inside: boolean;
	readonly speed: number;
	readonly phase: number;
	readonly trail: number;
	lastOpacity: string;
	lastRadius: string;
	lastLit: boolean;
}

export interface Bounds {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

export interface OverlayPart {
	readonly strokes: Stroke[];
	readonly count: number;
	readonly b: Bounds;
	readonly name: PartName;
	readonly key: boolean;
	readonly t0: number;
	readonly t1: number;
}

export interface KeyMark {
	readonly part: OverlayPart;
	readonly guides: Stroke[];
	readonly handles: { el: SVGRectElement; x: number; y: number }[];
	readonly dim: SVGTextElement;
}

export interface Flyer {
	readonly el: SVGCircleElement;
	readonly x0: number;
	readonly y0: number;
	readonly x1: number;
	readonly y1: number;
	readonly arrive: number;
	readonly start: number;
}

export interface Overlay {
	readonly host: HTMLElement;
	readonly root: SVGSVGElement;
	readonly w: number;
	readonly h: number;
	readonly dots: Dot[];
	readonly maxD: number;
	readonly span: number;
	readonly probe: SVGPathElement;
	readonly guides: Stroke[];
	readonly dim: SVGTextElement;
	readonly clipRect: SVGRectElement;
	readonly wire: SVGGElement;
	readonly outline: Stroke[];
	readonly parts: OverlayPart[];
	readonly keys: KeyMark[];
	readonly flyers: Flyer[];
	readonly reticle: SVGPathElement;
	readonly tag: SVGTextElement;
	readonly handles: { el: SVGRectElement; x: number; y: number; at: number }[];
	readonly readout: SVGTextElement;
	readonly scan: SVGGElement;
	readonly scanLine: SVGPathElement;
}

let overlayCount = 0;

function svg<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string | number>,
	parent?: Element,
): SVGElementTagNameMap[K] {
	const el = document.createElementNS(NS, tag);
	for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
	parent?.appendChild(el);
	return el;
}

/** A rounded rectangle, closed. */
function roundedRect(x: number, y: number, w: number, h: number, radius: number): string {
	const r = Math.max(0, Math.min(radius, w / 2, h / 2));
	const R = fmt(r);
	return `M${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}A${R} ${R} 0 0 1 ${fmt(x + w)} ${fmt(y + r)}V${fmt(y + h - r)}A${R} ${R} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)}H${fmt(x + r)}A${R} ${R} 0 0 1 ${fmt(x)} ${fmt(y + h - r)}V${fmt(y + r)}A${R} ${R} 0 0 1 ${fmt(x + r)} ${fmt(y)}Z`;
}

/** Half a rounded rectangle, top centre to bottom centre, clockwise or counter-clockwise. */
function roundedHalf(x: number, y: number, w: number, h: number, radius: number, clockwise: boolean): string {
	const r = Math.max(0, Math.min(radius, w / 2, h / 2));
	const X = (v: number) => fmt(x + v);
	const Y = (v: number) => fmt(y + v);
	const R = fmt(r);
	return clockwise
		? `M${X(w / 2)} ${Y(0)}H${X(w - r)}A${R} ${R} 0 0 1 ${X(w)} ${Y(r)}V${Y(h - r)}A${R} ${R} 0 0 1 ${X(w - r)} ${Y(h)}H${X(w / 2)}`
		: `M${X(w / 2)} ${Y(0)}H${X(r)}A${R} ${R} 0 0 0 ${X(0)} ${Y(r)}V${Y(h - r)}A${R} ${R} 0 0 0 ${X(r)} ${Y(h)}H${X(w / 2)}`;
}

const line = (a: number, b: number, c: number, d: number) => `M${fmt(a)} ${fmt(b)}L${fmt(c)} ${fmt(d)}`;

function makeStroke(
	el: SVGGeometryElement,
	options: { gap: number; k?: number; local?: boolean; together?: boolean },
): Stroke {
	return {
		el,
		length: 0,
		gap: options.gap,
		k: options.k ?? 1,
		local: options.local ?? false,
		together: options.together ?? false,
		head: null,
		caps: null,
		idx: 0,
		dashCount: -1,
		live: false,
		stops: [],
		step: 0,
		point: null,
	};
}

/**
 * Reads every stroke's length and samples the line its dot head rides along (about once per
 * dot gap, at most `MAX_STOPS`). Runs once, after the whole drawing is appended: a geometry read
 * after each append would force style and layout over the whole SVG every time.
 */
function measureStrokes(strokes: readonly Stroke[]) {
	for (const s of strokes) {
		s.length = s.el.getTotalLength();
		const count = Math.min(MAX_STOPS, Math.ceil(s.length / (s.gap / s.k)) + 1);
		s.step = count > 1 ? s.length / (count - 1) : 0;
		s.stops = Array.from({ length: count }, (_, i) => {
			const { x, y } = s.el.getPointAtLength(i * s.step);
			return { x, y };
		});
	}
}

/** The point `at` px along a stroke, from its precomputed stops. */
export function pointAt(s: Stroke, at: number): Point {
	const last = s.stops.length - 1;
	const f = s.step > 0 ? Math.min(last, at / s.step) : 0;
	const i = Math.floor(f);
	const a = s.stops[i];
	const b = s.stops[Math.min(last, i + 1)];
	return { x: a.x + (b.x - a.x) * (f - i), y: a.y + (b.y - a.y) * (f - i) };
}

function pathStroke(d: string, parent: Element, kind: "wire" | "guide", extra: Record<string, string | number> = {}): Stroke {
	const cls = kind === "guide" ? OVERLAY_CLASS.guide : OVERLAY_CLASS.wire;
	const attrs: Record<string, string | number> = kind === "guide" ? { "stroke-width": 1.6, "stroke-linecap": "round" } : {};
	const el = svg("path", { d, class: cls, ...attrs, ...extra }, parent);
	return makeStroke(el, { gap: kind === "guide" ? GUIDE_GAP : DOT_GAP });
}

const head = (parent: Element, r: number) => svg("circle", { r, class: OVERLAY_CLASS.head, opacity: 0 }, parent);

function buildDots(root: SVGSVGElement, w: number, h: number, n: number) {
	const group = svg("g", {}, root);
	const dots: Dot[] = [];
	let maxD = 0;
	// A grid of W×H at spacing s holds about (W/s + 1)(H/s + 1) dots; widen s until that fits.
	const W = w + 2 * MARGIN;
	const H = h + 2 * MARGIN;
	let spacing = DOT_SPACING;
	while ((Math.floor(W / spacing) + 2) * (Math.floor(H / spacing) + 2) > MAX_DOTS) spacing *= 1.05;
	const start = -Math.floor(MARGIN / spacing) * spacing;
	for (let x = start; x <= w + MARGIN; x += spacing) {
		const column = Math.round(x / spacing);
		for (let y = start; y <= h + MARGIN; y += spacing) {
			const d = Math.hypot(x - w / 2, y - h / 2);
			const outside = Math.max(0, -x, x - w, -y, y - h);
			dots.push({
				el: svg("circle", { cx: x, cy: y, r: 1.1, class: OVERLAY_CLASS.dot, opacity: 0 }, group),
				x,
				y,
				d,
				edge: 1 - Math.min(1, outside / MARGIN),
				inside: outside === 0,
				speed: 0.07 + 0.09 * hashN(column * 7.13 + n * 31.7),
				phase: hashN(column * 3.71 + n * 11.3) * 900,
				trail: 50 + 70 * hashN(column * 1.91 + n),
				lastOpacity: "",
				lastRadius: "",
				lastLit: false,
			});
			maxD = Math.max(maxD, d);
		}
	}
	return { dots, maxD };
}

function buildParts(M: Measured, wire: SVGGElement): OverlayPart[] {
	const built: Omit<OverlayPart, "t0" | "t1">[] = [];
	for (const P of M.parts) {
		const strokes: Stroke[] = [];
		if (P.kind === "box" && P.key) {
			for (const clockwise of [true, false]) {
				const el = svg("path", { d: roundedHalf(P.x, P.y, P.w, P.h, P.r, clockwise), class: OVERLAY_CLASS.wire }, wire);
				strokes.push(makeStroke(el, { gap: DOT_GAP, together: true }));
			}
		} else if (P.kind === "box") {
			strokes.push(pathStroke(roundedRect(P.x, P.y, P.w, P.h, P.r), wire, "wire"));
		} else if (P.kind === "text") {
			for (const ln of P.lines) {
				const y = ln.y + ln.h * 0.56;
				const stroke = pathStroke(`M${fmt(ln.x)} ${fmt(y)}H${fmt(ln.x2)}`, wire, "wire");
				const cap = (x: number) => svg("circle", { cx: fmt(x), cy: fmt(y), r: 1.7, class: OVERLAY_CLASS.head, opacity: 0 }, wire);
				stroke.caps = [cap(ln.x), cap(ln.x2)];
				strokes.push(stroke);
			}
		} else {
			for (const src of P.paths) {
				const [a, b, c, d] = src.matrix;
				const k = Math.sqrt(Math.abs(a * d - b * c)) || 1;
				const group = svg(
					"g",
					{ transform: `matrix(${src.matrix.map((v) => v.toFixed(3)).join(" ")})`, "stroke-width": (1.8 / k).toFixed(3) },
					wire,
				);
				const el = svg(src.tag as "path", { ...src.attrs, class: OVERLAY_CLASS.wire }, group);
				if (typeof el.getTotalLength !== "function") continue;
				strokes.push(makeStroke(el, { gap: 3.6, k, local: true }));
			}
		}
		if (!strokes.length) continue;
		let index = -1;
		strokes.forEach((s, i) => {
			s.head = head(s.local ? (s.el.parentNode as Element) : wire, 2.4 / s.k);
			s.idx = s.together && i > 0 && strokes[i - 1].together ? index : ++index;
		});
		built.push({ strokes, count: index + 1, b: { x: P.x, y: P.y, w: P.w, h: P.h }, name: P.name, key: P.key });
	}
	const schedules = scheduleParts(built.length);
	return built.map((part, i) => ({ ...part, ...schedules[i] }));
}

function buildKeyMarks(parts: readonly OverlayPart[], root: SVGSVGElement): KeyMark[] {
	const E = 16;
	return parts
		.filter((part) => part.key)
		.map((part) => {
			const { x, y, w, h } = part.b;
			return {
				part,
				guides: [
					[x - E, y, x + w + E, y],
					[x + w, y - E, x + w, y + h + E],
					[x + w + E, y + h, x - E, y + h],
					[x, y + h + E, x, y - E],
				].map(([a, b, c, d]) => pathStroke(line(a, b, c, d), root, "guide", { opacity: 0 })),
				handles: [
					[x, y],
					[x + w, y],
					[x + w, y + h],
					[x, y + h],
				].map(([hx, hy]) => ({
					el: svg("rect", { x: -2, y: -2, width: 4, height: 4, class: OVERLAY_CLASS.handle, transform: `translate(${fmt(hx)} ${fmt(hy)}) scale(0)` }, root),
					x: hx,
					y: hy,
				})),
				dim: svg("text", { x: fmt(x), y: fmt(y - 5), class: OVERLAY_CLASS.labelStrong, "font-size": 7.5, opacity: 0 }, root),
			};
		});
}

/** Loose dots that fly in and land on the outline just as it is drawn there. */
function buildFlyers(outline: readonly Stroke[], root: SVGSVGElement, n: number): Flyer[] {
	const [start, stop] = PHASES.outline;
	return Array.from({ length: FLYERS }, (_, i) => {
		const half = outline[i % 2];
		const f = 0.06 + 0.9 * (Math.floor(i / 2) / (FLYERS / 2 - 1));
		const pt = pointAt(half, half.length * f);
		const angle = hashN(i * 9.1 + n) * Math.PI * 2;
		const dist = 30 + 70 * hashN(i * 4.7 + n * 2);
		const arrive = start + (stop - start) * invertDrawEase(f);
		return {
			el: svg("circle", { r: 1.6, class: OVERLAY_CLASS.head, opacity: 0 }, root),
			x0: pt.x + Math.cos(angle) * dist,
			y0: pt.y + Math.sin(angle) * dist,
			x1: pt.x,
			y1: pt.y,
			arrive,
			start: arrive - 0.09,
		};
	});
}

/** Builds the whole drawing into `host`, sized to the measured element. */
export function buildOverlay(host: HTMLElement, M: Measured): Overlay {
	const n = ++overlayCount;
	const { w, h } = M;
	const root = svg("svg", { width: fmt(w), height: fmt(h), viewBox: `0 0 ${fmt(w)} ${fmt(h)}`, class: "absolute top-0 left-0 overflow-visible" });
	// In the page first: SVG geometry can only be measured once it renders.
	host.appendChild(root);
	const defs = svg("defs", {}, root);

	const { dots, maxD } = buildDots(root, w, h, n);

	const probe = svg("path", { d: `M0 ${-MARGIN}V${fmt(h + MARGIN)}`, class: OVERLAY_CLASS.guide, "stroke-width": 1.6, "stroke-linecap": "round", "stroke-dasharray": "0 5", opacity: 0 }, root);
	const guides = [
		[-MARGIN, 0, w + MARGIN, 0],
		[w, -MARGIN, w, h + MARGIN],
		[w + MARGIN, h, -MARGIN, h],
		[0, h + MARGIN, 0, -MARGIN],
	].map(([a, b, c, d]) => pathStroke(line(a, b, c, d), root, "guide"));
	const dim = svg("text", { x: 0, y: -10, class: OVERLAY_CLASS.label, "font-size": 9, "letter-spacing": "0.02em", opacity: 0 }, root);

	// The wireframe is wiped away behind the scan line.
	const clip = svg("clipPath", { id: `ui-gen-clip-${n}` }, defs);
	const clipRect = svg("rect", { x: -MARGIN - 10, y: -MARGIN, width: w + 2 * MARGIN + 20, height: h + 2 * MARGIN }, clip);
	const glow = svg("linearGradient", { id: `ui-gen-glow-${n}`, x1: 0, y1: 0, x2: 0, y2: 1, class: OVERLAY_CLASS.glow }, defs);
	svg("stop", { offset: 0, "stop-color": "currentColor", "stop-opacity": 0 }, glow);
	svg("stop", { offset: 1, "stop-color": "currentColor", "stop-opacity": 0.12 }, glow);
	const wire = svg("g", { "clip-path": `url(#ui-gen-clip-${n})`, "stroke-width": 2.1, "stroke-linecap": "round", "stroke-linejoin": "round" }, root);
	const outline = [true, false].map((clockwise) => {
		const el = svg("path", { d: roundedHalf(0, 0, w, h, M.r, clockwise), class: OVERLAY_CLASS.wire }, wire);
		const stroke = makeStroke(el, { gap: DOT_GAP });
		stroke.head = head(wire, 2.8);
		return stroke;
	});

	const parts = buildParts(M, wire);
	const keys = buildKeyMarks(parts, root);
	measureStrokes([...guides, ...outline, ...parts.flatMap((part) => part.strokes), ...keys.flatMap((key) => key.guides)]);
	const flyers = buildFlyers(outline, root, n);

	const reticle = svg("path", { class: OVERLAY_CLASS.reticle, "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0 }, root);
	const tag = svg("text", { class: OVERLAY_CLASS.labelStrong, "font-size": 7.5, "letter-spacing": "0.05em", opacity: 0 }, root);
	const handles = [
		[0, 0, 0.17],
		[w, 0, 0.17],
		[w, h, 0.37],
		[0, h, 0.37],
	].map(([x, y, at]) => ({
		el: svg("rect", { x: -2.5, y: -2.5, width: 5, height: 5, class: OVERLAY_CLASS.handle, transform: `translate(${fmt(x)} ${fmt(y)}) scale(0)` }, root),
		x,
		y,
		at,
	}));
	const readout = svg("text", { class: OVERLAY_CLASS.labelStrong, "font-size": 7.5, opacity: 0 }, root);
	const scan = svg("g", { opacity: 0 }, root);
	svg("rect", { x: 0, y: -28, width: w, height: 28, fill: `url(#ui-gen-glow-${n})` }, scan);
	const scanLine = svg("path", { d: `M-18 0H${fmt(w + 18)}`, class: OVERLAY_CLASS.guide, "stroke-width": 1.6, "stroke-linecap": "round", "stroke-dasharray": "0 5" }, scan);
	svg("circle", { cx: 0, cy: 0, r: 2.3, class: OVERLAY_CLASS.head }, scan);
	svg("circle", { cx: w, cy: 0, r: 2.3, class: OVERLAY_CLASS.head }, scan);

	return { host, root, w, h, dots, maxD, span: h + 2 * MARGIN, probe, guides, dim, clipRect, wire, outline, parts, keys, flyers, reticle, tag, handles, readout, scan, scanLine };
}
