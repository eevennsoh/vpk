"use client";

import { createContext, type ReactNode, use, useMemo } from "react";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import { useChartStable } from "./chart-context";

const DEFAULT_GROUND_SHADOW = 0.26;
const GLASS_TIP_OPACITY = 0.2;

export interface BarDepthEntry {
	label: string;
	/** Index in the original `data` array — used for stagger calc. NOT the
	 * index in this entries list. */
	dataIndex: number;
	/** Original datum reference — handed back to `colorAccessor` /
	 * `segmentsAccessor` so consumers can color or split bars without
	 * bar-depth knowing the data shape. */
	datum: Record<string, unknown>;
	/** True when this bar is the active bar (`dataIndex === activeIndex`).
	 * Used only by `<BarPulse>`; geometry is identical regardless. */
	isActive: boolean;
	/** True when the bar's value is negative — the bar extends downward from
	 * the baseline. The lid still sits at the baseline; the side parallelogram
	 * grows downward instead of upward. */
	isNegative: boolean;
	/** y of the chart's baseline (= `yScale(0)`). For positive bars this equals
	 * `bottomY`; for negative bars it equals `topY`. Used as the grow-from
	 * anchor for both the clipPath (side face) and the glass rect. */
	baselineY: number;
	bandX: number;
	bandWidth: number;
	/** Visual top of the bar in screen Y (smaller y = higher on screen). */
	topY: number;
	/** Visual bottom of the bar in screen Y. */
	bottomY: number;
	barHeight: number;
	/** Un-trimmed natural pixel height of the bar (= `|baselineY - yScale(value)|`).
	 * Segment heights are scaled against this so they line up with `<Bar>`. */
	naturalHeight: number;
	/** Pixels subtracted from the bar's visual top (and added to `topY`) so the
	 * lid's back edge lands at `yScale(value)` regardless of depth. */
	topYTrim: number;
	/** Side-face thickness in px (0 = dead-center bar / dense chart). */
	depth: number;
	perspectiveRise: number;
	isRightOfCenter: boolean;
}

/** One segment of a stacked bar, in stack order bottom→top. The values across
 * all segments should sum to the bar's value; bar-depth uses the proportions
 * to pick segment boundaries that line up with the front face's stacking. */
export interface BarDepthSegment {
	value: number;
	color: string;
}

/** Resolve a per-datum color, falling back to the shared `color` default. */
export type ColorAccessor = (datum: Record<string, unknown>, index: number) => string;

export function resolveColor(
	datum: Record<string, unknown>,
	index: number,
	color: string,
	colorAccessor?: ColorAccessor
): string {
	return colorAccessor?.(datum, index) ?? color;
}

/** Side-face parallelogram between two screen-Y edges, on the depth side of
 * the bar (left of the bar for right-of-center bars, right for left-of). */
export function sideFacePath(
	e: BarDepthEntry,
	topEdge: number,
	bottomEdge: number
): string {
	const rise = e.perspectiveRise;
	if (e.isRightOfCenter) {
		const x = e.bandX;
		return `M ${x} ${topEdge} L ${x - e.depth} ${topEdge - rise} L ${x - e.depth} ${bottomEdge - rise} L ${x} ${bottomEdge} Z`;
	}
	const x = e.bandX + e.bandWidth;
	return `M ${x} ${topEdge} L ${x + e.depth} ${topEdge - rise} L ${x + e.depth} ${bottomEdge - rise} L ${x} ${bottomEdge} Z`;
}

/** Lid (top face) parallelogram above the bar's top edge. */
export function lidFacePath(e: BarDepthEntry): string {
	const rise = e.perspectiveRise;
	const left = e.bandX;
	const right = e.bandX + e.bandWidth;
	if (e.isRightOfCenter) {
		return `M ${left} ${e.topY} L ${right} ${e.topY} L ${right - e.depth} ${e.topY - rise} L ${left - e.depth} ${e.topY - rise} Z`;
	}
	return `M ${left} ${e.topY} L ${right} ${e.topY} L ${right + e.depth} ${e.topY - rise} L ${left + e.depth} ${e.topY - rise} Z`;
}

/**
 * Build the side-face parallelograms for a bar. Without segments it's a single
 * piece in `baseColor`; with segments each gets its natural scaled height
 * `(seg.value/total) * naturalHeight` and only the topmost has `topYTrim`
 * removed — matching exactly how `<Bar>` stacks segments, so the side seams
 * line up with the front face.
 */
export function buildSidePieces(
	e: BarDepthEntry,
	visibleSegments: BarDepthSegment[] | null,
	baseColor: string
): { path: string; color: string }[] {
	if (!(visibleSegments && visibleSegments.length > 0)) {
		return [{ path: sideFacePath(e, e.topY, e.bottomY), color: baseColor }];
	}
	const totalValue = visibleSegments.reduce((sum, s) => sum + s.value, 0);
	const pieces: { path: string; color: string }[] = [];
	let cursorY = e.bottomY;
	for (let i = 0; i < visibleSegments.length; i++) {
		const seg = visibleSegments[i];
		if (!seg) {
			continue;
		}
		const isTopmost = i === visibleSegments.length - 1;
		const segScaledHeight = (seg.value / totalValue) * e.naturalHeight;
		const segHeight = isTopmost
			? Math.max(0, segScaledHeight - e.topYTrim)
			: segScaledHeight;
		const segBottomY = cursorY;
		const segTopY = cursorY - segHeight;
		cursorY = segTopY;
		pieces.push({
			path: sideFacePath(e, segTopY, segBottomY),
			color: seg.color,
		});
	}
	return pieces;
}

// ─── Context ──────────────────────────────────────────────────────────
// `BarDepthProvider` is the single source of truth for `segmentsAccessor`,
// shared by every depth surface (`<BarDepthBack>`, `<BarDepthFront>`,
// `<BarPulse>`) AND by the entries hook those surfaces consume.
//
// Why context instead of per-component props: `useBarDepthEntries` computes
// `topYTrim` from the topmost segment's scaled height, so all three layers
// need the *same* `segmentsAccessor` to produce the same `topY`. A single
// provider above the chart makes it structurally impossible for them to
// disagree.
//
// `BarChart` reads its `<Bar>` children with `React.Children.forEach`, which
// doesn't recurse into a provider. Wrap the provider *around* the
// `<BarChart>`, not inside it.

interface BarDepthContextValue {
	segmentsAccessor?: (
		datum: Record<string, unknown>
	) => BarDepthSegment[] | null | undefined;
	/** Opacity (0–1) of the baseline contact shadow. 0 removes it. */
	groundShadow?: number;
	/** Minimum bar height in px — floors short/zero bars so they stay visible.
	 * Match the value passed to `<Bar minBarHeight>`. */
	minBarHeight?: number;
}

export const BarDepthContext = createContext<BarDepthContextValue>({});

export interface BarDepthProviderProps extends BarDepthContextValue {
	children: ReactNode;
}

/**
 * Provides shared bar-depth configuration to every depth surface beneath it.
 * Wrap a `<BarChart>` whose children include `<BarDepthBack>` /
 * `<BarDepthFront>` / `<BarPulse>` with this provider to:
 *   - split stacked bars into per-segment side faces (`segmentsAccessor`),
 *   - tune the baseline contact shadow (`groundShadow`, default 0.26; 0 = off),
 *   - floor short/zero bars so they stay visible (`minBarHeight`; pair with the
 *     same value on `<Bar minBarHeight>`).
 *
 * Because the glass gradient is chart-wide (one Y-anchored ramp shared by the
 * front face and the side glass), the provider is the single source of truth —
 * so the surfaces can never disagree.
 */
export function BarDepthProvider({
	segmentsAccessor,
	groundShadow,
	minBarHeight,
	children,
}: BarDepthProviderProps) {
	// Memoize so consumers don't re-render when the config is stable.
	const value = useMemo<BarDepthContextValue>(
		() => ({ segmentsAccessor, groundShadow, minBarHeight }),
		[segmentsAccessor, groundShadow, minBarHeight]
	);
	return (
		<BarDepthContext value={value}>
			{children}
		</BarDepthContext>
	);
}

BarDepthProvider.displayName = "BarDepthProvider";

// ─── Per-bar glass gradient ──────────────────────────────────────────
// The glass is anchored to EACH BAR's own height (objectBoundingBox: 0% = the
// bar's tip, 100% = its baseline), not to the chart. So every bar — tall or
// short — gets the identical proportional gloss. (Anchoring per-chart made a
// tall bar's tip bright while a short bar's tip fell in the transparent middle
// and read as matte.)

interface GlassGradientStop {
	offset: string;
	color: string;
	opacity: string;
}

/**
 * Stop list for a POSITIVE bar's glass (0% = tip, 100% = baseline): a sharp
 * white reflection catch at the tip falling off fast to transparent, then the
 * contact shadow at the base.
 */
function buildPosBarStops(groundShadow: number): GlassGradientStop[] {
	return [
		{ offset: "0%", color: "white", opacity: String(GLASS_TIP_OPACITY) },
		{ offset: "3%", color: "white", opacity: "0.09" },
		{ offset: "8%", color: "white", opacity: "0.02" },
		{ offset: "55%", color: "white", opacity: "0" },
		{ offset: "100%", color: "black", opacity: String(groundShadow) },
	];
}

/**
 * Mirror of `buildPosBarStops` for NEGATIVE bars (which grow downward): the
 * contact shadow sits at the top (the baseline) and the reflection catch at
 * the bottom (the bar's tip).
 */
function buildNegBarStops(groundShadow: number): GlassGradientStop[] {
	return [
		{ offset: "0%", color: "black", opacity: String(groundShadow) },
		{ offset: "45%", color: "white", opacity: "0" },
		{ offset: "92%", color: "white", opacity: "0.02" },
		{ offset: "97%", color: "white", opacity: "0.09" },
		{ offset: "100%", color: "white", opacity: String(GLASS_TIP_OPACITY) },
	];
}

/**
 * Build both per-bar glass stop lists from the current `groundShadow`. Each
 * depth surface picks `posStops` or `negStops` by the bar's direction and
 * paints it objectBoundingBox, so the gloss is identical across bar heights.
 */
export function useGlassStops() {
	const { groundShadow = DEFAULT_GROUND_SHADOW } = use(BarDepthContext);
	return useMemo(
		() => ({
			posStops: buildPosBarStops(groundShadow),
			negStops: buildNegBarStops(groundShadow),
		}),
		[groundShadow]
	);
}

function readBarValue(d: Record<string, unknown>, key: string): number {
	const v = key ? d[key] : undefined;
	return typeof v === "number" ? v : 0;
}

// ─── Hooks ───────────────────────────────────────────────────────────

/**
 * Compute per-bar 3D depth geometry from chart context.
 *
 * Memoized on the chart's scales + data, so calling this from sibling layers
 * within the same chart is essentially free after the first settles. Returns
 * one entry per renderable bar; bars with no resolvable height are excluded.
 *
 * Negative-value bars are kept — `isNegative` flips the entry's geometry so
 * the side parallelogram and lid render in the correct direction.
 *
 * Exported for advanced consumers that want to render custom layers aligned
 * with the same geometry (e.g. labels above each bar's top face).
 */
export function useBarDepthEntries(
	dataKey: string,
	activeIndex?: number
): BarDepthEntry[] {
	const {
		data,
		barScale,
		bandWidth,
		yScale,
		innerHeight,
		innerWidth,
		barXAccessor,
	} = useChartStable();
	// Read shared config from `<BarDepthProvider>`. Outside a provider these are
	// the defaults (no segmentation, no floor) — correct for simple charts.
	const { segmentsAccessor, minBarHeight = 0 } = use(BarDepthContext);

	return useMemo(() => {
		if (!(barScale && bandWidth && barXAccessor)) {
			return [];
		}

		const centerX = innerWidth / 2;
		const zeroY = yScale(0) ?? innerHeight;

		// d3-scaleBand exposes step() (= bandwidth + gap); the shared helper caps
		// depth below the gap so a side face never spills past the next bar.
		const step =
			barScale.step();
		const maxDepth = barDepthMaxDepth(step, bandWidth);

		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-bar 3D geometry (direction, perspective trim, segment scaling) reads clearest as one pass
		return data.flatMap((d, dataIndex): BarDepthEntry[] => {
			// Stacked bars: the bar's value is the SUM of its segments (so the depth
			// height matches the host BarChart's stacked total). Single bars: the
			// `dataKey` column. `segmentsAccessor` comes from `<BarDepthProvider>`.
			const visibleSegs =
				segmentsAccessor?.(d)?.filter((s) => s.value > 0) ?? null;
			const value =
				visibleSegs && visibleSegs.length > 0
					? visibleSegs.reduce((sum, s) => sum + s.value, 0)
					: readBarValue(d, dataKey);
			const isActive = activeIndex != null && dataIndex === activeIndex;
			const isNegative = value < 0;
			const label = barXAccessor(d);
			const bandX = barScale(label) ?? 0;
			const cx = bandX + bandWidth / 2;

			// `Math.abs` so negative bars produce a positive height — direction is
			// captured by `isNegative`. Non-negative bars are floored to
			// `minBarHeight` so short/zero values stay visible (mirrors
			// `<Bar minBarHeight>`); a floored bar skips the perspective trim so its
			// tiny front face and lid stay aligned. With the default floor of 0,
			// zero-value bars produce no height and are skipped.
			const valuePos = yScale(value) ?? innerHeight;
			const rawHeight = Math.abs(zeroY - valuePos);
			const naturalHeight = isNegative
				? rawHeight
				: Math.max(rawHeight, minBarHeight);
			if (naturalHeight <= 0) {
				return [];
			}
			const isFloored = !isNegative && rawHeight < naturalHeight;

			const offsetFromCenter = centerX > 0 ? (cx - centerX) / centerX : 0;
			const isRightOfCenter = offsetFromCenter > 0;
			const absOffset = Math.min(1, Math.abs(offsetFromCenter));
			const { depth, perspectiveRise: rawRise } = barDepthAndRise(
				absOffset,
				naturalHeight,
				maxDepth
			);
			// Perspective lift applies only to positive bars. For negative bars a
			// lift would raise the lid's back edge above the baseline (a visible
			// "lip" at the chart edges), so it's forced to 0 — degenerating the lid
			// and flattening the side into a rectangle flush with the baseline.
			const perspectiveRise = isNegative ? 0 : rawRise;

			// Perspective trim — positive value-bearing bars only. The lid's back
			// edge sits `perspectiveRise` above `topY`. Without trim the silhouette
			// top would vary with depth (bars further from center look taller).
			// Trim shifts `topY` DOWN by `perspectiveRise` so the lid's back edge
			// lands on `yScale(value)` regardless of depth. The clamp denominator
			// is the topmost segment's scaled height (for stacked bars) or the whole
			// bar's natural height, matching how `<Bar>` stacks segments.
			let trimClampReference = naturalHeight;
			if (visibleSegs && visibleSegs.length > 0) {
				const segTotal = visibleSegs.reduce((sum, s) => sum + s.value, 0);
				const topmost = visibleSegs.at(-1);
				if (segTotal > 0 && topmost) {
					trimClampReference = (topmost.value / segTotal) * naturalHeight;
				}
			}
			const isValueBar = naturalHeight > 0 && !isNegative && !isFloored;
			const topYTrim = isValueBar
				? Math.min(perspectiveRise, Math.max(0, trimClampReference - 1))
				: 0;
			// Direction-aware top/bottom: positive bars hang ABOVE the baseline;
			// negative bars hang BELOW it. The lid always lives at `topY` so for
			// negative bars it sits on the baseline.
			const topY = isNegative ? zeroY : zeroY - naturalHeight + topYTrim;
			const bottomY = isNegative ? zeroY + naturalHeight : zeroY;
			const barHeight = bottomY - topY;

			return [
				{
					label,
					dataIndex,
					datum: d,
					isActive,
					isNegative,
					baselineY: zeroY,
					bandX,
					bandWidth,
					topY,
					bottomY,
					barHeight,
					naturalHeight,
					topYTrim,
					depth,
					perspectiveRise,
					isRightOfCenter,
				},
			];
		});
	}, [
		data,
		barScale,
		bandWidth,
		yScale,
		innerHeight,
		innerWidth,
		barXAccessor,
		segmentsAccessor,
		minBarHeight,
		dataKey,
		activeIndex,
	]);
}

export function useBarDepthStagger() {
	const { data, animationDuration } = useChartStable();
	// Mirror `Bar`'s stagger formula so each depth surface enters in lockstep
	// with its front face (`Bar` uses `animationDuration * 0.4 / count`).
	const total = animationDuration || 1100;
	return data.length > 1 ? (total * 0.4) / 1000 / data.length : 0;
}

// ─── Components ───────────────────────────────────────────────────────
