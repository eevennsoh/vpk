"use client";

import { type MotionValue, type SpringOptions, useSpring } from "motion/react";
import { createContext, isValidElement, type ReactNode, type SVGProps, useCallback, use, useLayoutEffect, useRef } from "react";


import { niceRadialDomain, polarToCartesian, type RadialLayout, TAU } from "./radial-geometry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadialSeries {
	/** Datum key holding this series' value for a bin */
	dataKey: string;
	/** Legend / center label. Default: `dataKey` */
	label?: string;
	/**
	 * Fill / stroke color. Default: the palette slot for the series index,
	 * `var(--chart-N)` (see `radialSeriesColor`)
	 */
	color?: string;
	/** Base opacity of the series' marks. Default: 1 */
	opacity?: number;
	/**
	 * Radial opacity ramp: opacity at the band base, rising to full opacity
	 * outward. Layers decide how to apply it. Default: 1 (no ramp)
	 */
	rampFrom?: number;
	/** Tint this series' legend count with its color (e.g. an alert series) */
	emphasize?: boolean;
}

/**
 * What the angle encodes.
 * - `clock`: bins of a day (00 at the start angle). Tracks "now" and future
 *   bins (ghost data) and labels the axis 00 / 06 / 12 / 18.
 * - `band`: categories — `RadialAxis` labels every bin with `datum[xDataKey]`.
 * - `time`: `datum[xDataKey]` is a Date / timestamp / ISO string per evenly
 *   spaced bin — `RadialAxis` draws time ticks (e.g. months).
 */
export type RadialAngleType = "clock" | "band" | "time";

/**
 * How bins and values map onto the disc.
 * - `radial` (default): bins around the angle, value outward along the radius.
 * - `angular`: bins are concentric rings (first bin innermost) and the value
 *   sweeps along the angle — progress-ring / MUI "horizontal" radial bars.
 *   Draw it with `RadialRingBar`.
 */
export type RadialOrientation = "radial" | "angular";

/**
 * Chart-level value scale shared by every layer that doesn't pass its own
 * `maxValue`.
 * - number: the value at the band top
 * - `"auto"`: the largest single value of any series / `valueKeys` key
 * - `"stacked"`: the largest per-bin sum of the series (and any `valueKeys`)
 */
export type RadialMaxValue = number | "auto" | "stacked";

export interface RadialRingBand {
	inner: number;
	outer: number;
	/** Mid radius of the ring */
	center: number;
}

export interface RadialChartContextValue {
	data: Record<string, unknown>[];
	xDataKey: string;
	series: RadialSeries[];
	binCount: number;
	/** Stage diameter in px (twice `radius`; 0 until measured) */
	size: number;
	/** Chart radius — every layout fraction is relative to this */
	radius: number;
	layout: RadialLayout;
	/** Center circle radius in px */
	centerRadius: number;
	/** Value band base (min value) in px */
	innerRadius: number;
	/** Value band top (max value) in px */
	outerRadius: number;
	/**
	 * Bins where no series has a value — e.g. the rest of today. Layers can
	 * draw comparison ("ghost") data there. All false unless `trackNow`.
	 */
	futureBins: boolean[];
	/** Last bin with data (or the `nowIndex` prop) */
	nowIndex: number;
	/** True when the chart tracks "now" / future bins (clock charts) */
	trackNow: boolean;
	/** Per-series sums over every non-future bin */
	totals: Record<string, number>;
	hoveredIndex: number | null;
	setHoveredIndex: (index: number | null) => void;
	/**
	 * Animated crosshair angle in radians: the mounted `RadialScrubber`'s
	 * spring, else a chart-owned spring with the same config. Hover dots
	 * locked to the crosshair follow it. May run past one turn (it takes the
	 * short way round), so treat it as periodic.
	 */
	crosshairAngle: MotionValue<number>;
	/** `RadialScrubber` registers its spring as the crosshair; returns the cleanup */
	registerCrosshair: (angle: MotionValue<number>) => () => void;
	/** Legend-hovered series index (dim the others) */
	hoveredSeries: number | null;
	setHoveredSeries: (index: number | null) => void;
	/** False until the first frame after mount — flip to run enter transitions */
	revealed: boolean;
	/** Enter animations on (false under prefers-reduced-motion) */
	animate: boolean;
	reducedMotion: boolean;

	// Angle ---------------------------------------------------------------------
	angleType: RadialAngleType;
	orientation: RadialOrientation;
	/** Arc start in radians (0 = 12 o'clock, clockwise) */
	startAngle: number;
	/** Arc end in radians */
	endAngle: number;
	/** True when the arc is the full turn */
	isFullCircle: boolean;
	/** Signed angular width of one bin (radial orientation) */
	binWidth: number;
	/** Center angle of bin `index` */
	binAngle: (index: number) => number;
	/** Start angle of bin `index` (`binStartAngle(binCount)` is the arc end) */
	binStartAngle: (index: number) => number;
	/** Bin under an angle, or null in the gap of a partial arc */
	angleToBin: (angle: number) => number | null;
	/** Fraction (0–1) along the arc → angle */
	fractionToAngle: (fraction: number) => number;
	/**
	 * `time` charts: timestamp (ms) / Date → angle, or null outside the data's
	 * time span. Bin `i` starts at `datum[i][xDataKey]`.
	 */
	timeToAngle: (time: Date | number) => number | null;
	/** `time` charts: [first bin start, last bin end] in ms, else null */
	timeDomain: [number, number] | null;

	// Value ---------------------------------------------------------------------
	/** Value domain mapped to [innerRadius, outerRadius] (or the arc when angular) */
	valueDomain: [number, number];
	/** Shorthand for `valueDomain[1]` */
	maxValue: number;
	/**
	 * True when `RadialChart` got `maxValue` — layers without their own
	 * `maxValue` then share `valueScale`. False keeps each layer's own scale.
	 */
	sharedValueScale: boolean;
	/** Value → radius (`scaleRadial` over `valueDomain`, clamped) */
	valueScale: (value: number) => number;
	/** `angular` orientation: value → angle (linear over `valueDomain`, clamped) */
	valueToAngle: (value: number) => number;
	/** `angular` orientation: radii of bin `index`'s ring */
	ringBand: (index: number) => RadialRingBand;
}

export interface RadialChartProps {
	/** One datum per angular bin, clockwise from the start angle (e.g. 96 × 15 min) */
	data: Record<string, unknown>[];
	/** Datum key with the bin label / category / time. Default: "time" */
	xDataKey?: string;
	/** Series, innermost / first stacked first */
	series: RadialSeries[];
	/** Override ring radii (fractions of the chart radius) */
	layout?: Partial<RadialLayout>;
	/** What the angle encodes. Default: "clock" */
	angleType?: RadialAngleType;
	/** Bins along the angle (default) or as concentric rings. Default: "radial" */
	orientation?: RadialOrientation;
	/** Arc start in degrees, 0 = 12 o'clock, clockwise. Default: 0 */
	startAngle?: number;
	/** Arc end in degrees. Default: `startAngle + 360` (full circle) */
	endAngle?: number;
	/**
	 * Crop the stage to the arc's bounding box for partial arcs (e.g. a
	 * semicircle is about twice as wide as tall). Default: true
	 */
	fitArc?: boolean;
	/**
	 * Track "now": bins after the last bin with data are future bins (ghost
	 * data, scrubber rests at now). Default: true for `clock` charts
	 */
	trackNow?: boolean;
	/** Bin the resting scrubber points at. Default: last bin with data */
	nowIndex?: number;
	/**
	 * Shared value scale for every layer without its own `maxValue` (also
	 * drives `RadialAxis` value rings). Default: unset — each layer scales
	 * itself (`angular` charts default to "stacked").
	 */
	maxValue?: RadialMaxValue;
	/** Value mapped to the band base. "auto" = smallest value. Default: 0 */
	minValue?: number | "auto";
	/** Extra datum keys (not series) included in the auto domain, e.g. "yesterday" */
	valueKeys?: string[];
	/** Round an automatic domain to nice tick values. Default: true */
	niceValues?: boolean;
	/** `angular` orientation: gap between rings as a fraction of a ring step. Default: 0.3 */
	ringGap?: number;
	/** Enter animations. Default: true (skipped for prefers-reduced-motion) */
	animate?: boolean;
	/** Controlled hovered bin */
	hoveredIndex?: number | null;
	onHoverChange?: (index: number | null) => void;
	/** Max chart width in px. Default: 640 */
	maxWidth?: number;
	className?: string;
	/**
	 * SVG layers (`RadialAxis`, `RadialDotBar`, `RadialScrubber`, …) are drawn
	 * in a group centred on the chart. `RadialCenter` is drawn as HTML in the
	 * hole and `RadialLegend` below the chart.
	 */
	children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const RadialChartContext = createContext<RadialChartContextValue | null>(null);

export function useRadialChart(): RadialChartContextValue {
	const context = use(RadialChartContext);
	if (!context) {
		throw new Error(
			"useRadialChart must be used within a <RadialChart> component."
		);
	}
	return context;
}

/** Finite number at `datum[key]`, else null. */
export function radialNumberAt(
	datum: Record<string, unknown> | undefined | null,
	key: string
): number | null {
	const value = datum?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Timestamp (ms) of a Date / number / date string, else null. */
export function radialTimeOf(value: unknown): number | null {
	let time = Number.NaN;
	if (value instanceof Date) {
		time = value.getTime();
	} else if (typeof value === "number") {
		time = value;
	} else if (typeof value === "string") {
		time = Date.parse(value);
	}
	return Number.isFinite(time) ? time : null;
}

// ---------------------------------------------------------------------------
// Crosshair + hover dots
// ---------------------------------------------------------------------------

/** Spring of the crosshair (`RadialScrubber` and dots locked to it). */
export const RADIAL_CROSSHAIR_SPRING: SpringOptions = {
	stiffness: 420,
	damping: 42,
};

/** Default spring of a hover dot with its own spring (`"spring"` motion). */
export const RADIAL_DOT_SPRING: SpringOptions = {
	stiffness: 240,
	damping: 24,
};

/**
 * How a hover dot (`RadialLine` marker, `RadialArea` active dot) follows the
 * pointer. It always rides the curve: its radius is the edge's radius at the
 * dot's current angle.
 * - `crosshair`: locked to the crosshair — the same animated angle as
 *   `RadialScrubber` (or the chart's matching spring when there is none)
 * - `spring`: its own spring toward the hovered bin (see the `*Spring` prop)
 * - `none`: snaps to the hovered bin
 */
export type RadialDotMotion = "crosshair" | "spring" | "none";

/**
 * Angle that springs toward `angle`, taking the short way round on full
 * circles. While `hidden` it holds still; leaving hidden jumps straight to
 * the target. `snap` (e.g. reduced motion) jumps on every change.
 */
export function useRadialAngleSpring({
	angle,
	hidden,
	isFullCircle,
	snap,
	spring: springOptions = RADIAL_CROSSHAIR_SPRING,
}: {
	angle: number;
	hidden: boolean;
	isFullCircle: boolean;
	snap: boolean;
	spring?: SpringOptions;
}): MotionValue<number> {
	const spring = useSpring(angle, springOptions);
	const targetRef = useRef(angle);
	const wasHiddenRef = useRef(hidden);

	// Layout effect: hover dots read the jump before the first paint.
	useLayoutEffect(() => {
		const wasHidden = wasHiddenRef.current;
		wasHiddenRef.current = hidden;
		if (hidden) {
			return;
		}
		if (wasHidden) {
			targetRef.current = angle;
			spring.jump(angle);
			return;
		}
		const previous = targetRef.current;
		let next = angle;
		if (isFullCircle) {
			let delta = (angle - previous) % TAU;
			if (delta > Math.PI) {
				delta -= TAU;
			} else if (delta < -Math.PI) {
				delta += TAU;
			}
			next = previous + delta;
		}
		targetRef.current = next;
		if (snap) {
			spring.jump(next);
		} else {
			spring.set(next);
		}
	}, [spring, angle, snap, isFullCircle, hidden]);

	return spring;
}

/**
 * Animated angle for a hover dot. `crosshair` returns the chart's crosshair;
 * `spring` / `none` run the dot's own spring (`none` and reduced motion snap).
 */
export function useRadialDotAngle(
	motion: RadialDotMotion,
	spring: SpringOptions = RADIAL_DOT_SPRING
): MotionValue<number> {
	const {
		crosshairAngle,
		hoveredIndex,
		binAngle,
		isFullCircle,
		reducedMotion,
	} = useRadialChart();
	const own = useRadialAngleSpring({
		angle: binAngle(hoveredIndex ?? 0),
		hidden: hoveredIndex === null || motion === "crosshair",
		isFullCircle,
		snap: motion === "none" || reducedMotion,
		spring,
	});
	return motion === "crosshair" ? crosshairAngle : own;
}

/** Edge radius along a ray at `angle`, or null where there is no edge (gaps). */
export type RadialEdgeLookup = (angle: number) => number | null;

export const BEZIER_STEPS = 10;

/**
 * Flatten whatever a d3 radial generator draws (pass it the context) into
 * segments, and look up the edge radius at any angle by ray intersection —
 * exact for the rendered curve, gaps included.
 */
export function createRadialEdgeLookup(
	draw: (context: CanvasRenderingContext2D) => void
): RadialEdgeLookup {
	const segments: number[] = [];
	let startX = 0;
	let startY = 0;
	let x = 0;
	let y = 0;
	const push = (nx: number, ny: number) => {
		segments.push(x, y, nx, ny);
		x = nx;
		y = ny;
	};
	const context = {
		moveTo(nx: number, ny: number) {
			startX = nx;
			startY = ny;
			x = nx;
			y = ny;
		},
		lineTo: push,
		bezierCurveTo(
			x1: number,
			y1: number,
			x2: number,
			y2: number,
			x3: number,
			y3: number
		) {
			const x0 = x;
			const y0 = y;
			for (let k = 1; k <= BEZIER_STEPS; k++) {
				const t = k / BEZIER_STEPS;
				const u = 1 - t;
				const a = u * u * u;
				const b = 3 * u * u * t;
				const c = 3 * u * t * t;
				const d = t * t * t;
				push(
					a * x0 + b * x1 + c * x2 + d * x3,
					a * y0 + b * y1 + c * y2 + d * y3
				);
			}
		},
		quadraticCurveTo(x1: number, y1: number, x2: number, y2: number) {
			const x0 = x;
			const y0 = y;
			for (let k = 1; k <= BEZIER_STEPS; k++) {
				const t = k / BEZIER_STEPS;
				const u = 1 - t;
				push(
					u * u * x0 + 2 * u * t * x1 + t * t * x2,
					u * u * y0 + 2 * u * t * y1 + t * t * y2
				);
			}
		},
		closePath() {
			if (x !== startX || y !== startY) {
				push(startX, startY);
			}
		},
	};
	draw(context as unknown as CanvasRenderingContext2D);
	const flat = Float64Array.from(segments);

	return (angle) => {
		const dx = Math.sin(angle);
		const dy = -Math.cos(angle);
		let best = -1;
		for (let i = 0; i < flat.length; i += 4) {
			const x0 = flat[i] ?? 0;
			const y0 = flat[i + 1] ?? 0;
			const ex = (flat[i + 2] ?? 0) - x0;
			const ey = (flat[i + 3] ?? 0) - y0;
			const denom = dx * ey - dy * ex;
			if (Math.abs(denom) < 1e-9) {
				continue;
			}
			// Ray s·d meets segment P0 + t·e
			const t = (x0 * dy - y0 * dx) / denom;
			if (t < -1e-6 || t > 1 + 1e-6) {
				continue;
			}
			const s = (x0 * ey - y0 * ex) / denom;
			if (s > best) {
				best = s;
			}
		}
		return best > 0 ? best : null;
	};
}

/**
 * Hover dot that rides an edge at an animated angle. Position is written to
 * the DOM from the motion value (no React render per frame); the dot hides
 * where the edge has no point (gaps, partial runs).
 */
export function RadialHoverDot({
	angle,
	lookup,
	...props
}: {
	angle: MotionValue<number>;
	lookup: RadialEdgeLookup;
} & Omit<SVGProps<SVGCircleElement>, "cx" | "cy" | "ref" | "visibility">) {
	const ref = useRef<SVGCircleElement>(null);
	const place = useCallback(
		(a: number) => {
			const r = lookup(a);
			return r === null ? null : polarToCartesian(a, r);
		},
		[lookup]
	);

	useLayoutEffect(() => {
		const apply = (a: number) => {
			const el = ref.current;
			if (!el) {
				return;
			}
			const p = place(a);
			if (!p) {
				el.setAttribute("visibility", "hidden");
				return;
			}
			el.removeAttribute("visibility");
			el.setAttribute("cx", String(p.x));
			el.setAttribute("cy", String(p.y));
		};
		apply(angle.get());
		return angle.on("change", apply);
	}, [angle, place]);

	const initial = place(angle.get());
	return (
		<circle
			{...props}
			cx={initial?.x ?? 0}
			cy={initial?.y ?? 0}
			ref={ref}
			visibility={initial ? undefined : "hidden"}
		/>
	);
}

/** Children with these display names are drawn as HTML over the hole. */
export const CENTER_CHILDREN = new Set(["RadialCenter"]);
/** Children with these display names are drawn below the chart. */
export const BELOW_CHILDREN = new Set(["RadialLegend"]);

export function childDisplayName(child: ReactNode): string {
	if (!isValidElement(child)) {
		return "";
	}
	return (child.type as { displayName?: string }).displayName ?? "";
}

/** Smallest / largest value of any key, and the largest per-bin series stack. */
export function scanValues(
	data: Record<string, unknown>[],
	series: RadialSeries[],
	keys: string[]
) {
	let lo = Number.POSITIVE_INFINITY;
	let hi = 0;
	let stack = 0;
	for (const d of data) {
		for (const key of keys) {
			const v = radialNumberAt(d, key);
			if (v !== null) {
				lo = Math.min(lo, v);
				hi = Math.max(hi, v);
			}
		}
		const sum = series.reduce(
			(total, s) => total + Math.max(0, radialNumberAt(d, s.dataKey) ?? 0),
			0
		);
		stack = Math.max(stack, sum);
	}
	return { lo: Number.isFinite(lo) ? lo : 0, hi, stack };
}

export function computeValueDomain({
	data,
	series,
	valueKeys,
	maxValue,
	minValue,
	nice,
}: {
	data: Record<string, unknown>[];
	series: RadialSeries[];
	valueKeys: string[];
	maxValue: RadialMaxValue;
	minValue: number | "auto";
	nice: boolean;
}): [number, number] {
	const keys = [...series.map((s) => s.dataKey), ...valueKeys];
	const { lo, hi, stack } = scanValues(data, series, keys);
	const autoMin = minValue === "auto";
	const fixedMax = typeof maxValue === "number";
	const min = autoMin ? lo : minValue;
	let max = Math.max(hi, maxValue === "stacked" ? stack : 0);
	if (fixedMax) {
		max = maxValue;
	}
	if (!nice || (fixedMax && !autoMin)) {
		return [min, max];
	}
	const [niceMin, niceMax] = niceRadialDomain([min, Math.max(max, min)]);
	return [autoMin ? niceMin : min, fixedMax ? max : niceMax];
}

// ---------------------------------------------------------------------------
// Chart shell
