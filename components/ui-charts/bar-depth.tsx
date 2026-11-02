"use client";

import { m, type Transition, useReducedMotion } from "motion/react";
import { use, useId } from "react";
import { BarDepthContext, type ColorAccessor, buildSidePieces, lidFacePath, resolveColor, sideFacePath, useBarDepthEntries, useBarDepthStagger, useGlassStops } from "./bar-depth-context";
import { useChartHover, useChartStable } from "./chart-context";
import { transitionWithDelay } from "./motion-utils";

export { BarDepthProvider, type BarDepthProviderProps, type BarDepthEntry, type BarDepthSegment, useBarDepthEntries } from "./bar-depth-context";
export { BarPulse, type BarPulseProps } from "./bar-pulse";

const BAR_DEPTH_MIN_PX = 0.5;
const BAR_FADED_OPACITY = 0.3;
const DEFAULT_BAR_COLOR = "var(--chart-line-primary)";
const GLASS_TIP_OPACITY = 0.2;
const BAR_HOVER_TRANSITION = { duration: 0.15, ease: "easeOut" as const };

export interface BarDepthBackProps {
	/** Key in data for the bar value. Match the sibling `<Bar dataKey>`. */
	dataKey: string;
	/** Solid color for the side + top faces. Default: var(--chart-line-primary). */
	color?: string;
	/** Per-bar color override; takes precedence over `color` when provided. */
	colorAccessor?: ColorAccessor;
}

/**
 * Renders the back surfaces (side + top faces) of the 3D bar effect.
 *
 * Place BEFORE the `<Bar>` elements in `<BarChart>` children so the bar's
 * solid front face occludes any depth that would extend into an adjacent
 * column. Skips bars at chart center (depth ≈ 0) and dense charts.
 *
 * For stacked bars, wrap the `<BarChart>` in a
 * `<BarDepthProvider segmentsAccessor={...}>` so the side face splits into
 * per-segment parallelograms and the lid color matches the topmost segment.
 */
export function BarDepthBack({
	dataKey,
	color = DEFAULT_BAR_COLOR,
	colorAccessor,
}: BarDepthBackProps) {
	const reduceMotion = useReducedMotion();
	const { isLoaded, enterTransition, revealEpoch = 0 } = useChartStable();
	const { hoveredBarIndex } = useChartHover();
	const { segmentsAccessor } = use(BarDepthContext);
	const entries = useBarDepthEntries(dataKey);
	const stagger = useBarDepthStagger();
	const { posStops: glassStops, negStops: glassNegStops } = useGlassStops();
	const idPrefix = useId().replace(/[^a-z0-9]/gi, "_");

	// Two horizontal black gradients (one per depth direction) shade the side
	// from front-edge (lit) to back-edge (in shadow). A single vertical white
	// gradient on the lid: bright catch at the front lip → soft white at the
	// back. The vertical glass gradient layered on top of the side adds the same
	// bright-tip / dark-baseline curve as the front face for continuity.
	const sideShadeRtl = `bdb-side-rtl-${idPrefix}`;
	const sideShadeLtr = `bdb-side-ltr-${idPrefix}`;
	const topShade = `bdb-top-${idPrefix}`;
	const sideGlass = `bdb-glass-${idPrefix}`;
	// Per-bar bbox variant used only for bars that extend below the baseline.
	const sideGlassNeg = `bdb-glass-neg-${idPrefix}`;

	return (
		<g className="bar-depth-back" pointerEvents="none">
			<defs>
				{/* Side shade — diagonal: lit corner at front-top, dark corner at
						back-bottom. Right-of-center bars have the side on the LEFT
						(gradient runs (1,0)→(0,1)); left-of-center bars mirror it. */}
				<linearGradient id={sideShadeRtl} x1="1" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor="black" stopOpacity="0.05" />
					<stop offset="100%" stopColor="black" stopOpacity="0.55" />
				</linearGradient>
				<linearGradient id={sideShadeLtr} x1="0" x2="1" y1="0" y2="1">
					<stop offset="0%" stopColor="black" stopOpacity="0.05" />
					<stop offset="100%" stopColor="black" stopOpacity="0.55" />
				</linearGradient>
				{/* Lid 3D shade — mirrors the side face's directionality so the lid
						never reads as a brighter "white-washed cap". Front lip at opacity
						0 (seamless with the front face), back edge picks up shadow as it
						angles into perspective. */}
				<linearGradient id={topShade} x1="0" x2="0" y1="1" y2="0">
					<stop offset="0%" stopColor="black" stopOpacity="0" />
					<stop offset="100%" stopColor="black" stopOpacity="0.18" />
				</linearGradient>
				{/* Side glass — per-bar (objectBoundingBox): 0% = the bar's tip,
						100% = its baseline, same proportional gloss as the front face. */}
				<linearGradient id={sideGlass} x1="0" x2="0" y1="0" y2="1">
					{glassStops.map((stop) => (
						<stop
							key={`${stop.offset}-${stop.opacity}`}
							offset={stop.offset}
							stopColor={stop.color}
							stopOpacity={stop.opacity}
						/>
					))}
				</linearGradient>
				{/* Side glass (per-bar bbox variant for negative bars). The gradient
						runs from the bar's baseline-edge (top of bbox) down to the bar's
						value tip (bottom of bbox), lifting the tip glow onto each bar's
						own value edge. */}
				<linearGradient id={sideGlassNeg} x1="0" x2="0" y1="0" y2="1">
					{glassNegStops.map((stop) => (
						<stop
							key={`${stop.offset}-${stop.opacity}`}
							offset={stop.offset}
							stopColor={stop.color}
							stopOpacity={stop.opacity}
						/>
					))}
				</linearGradient>
			</defs>

			{entries.map((e) => {
				if (e.depth < BAR_DEPTH_MIN_PX) {
					return null;
				}

				// Resolve stacked segments for this bar. Filter to non-zero so a
				// missing segment doesn't paint an invisible 0-height piece or quietly
				// become the lid color.
				const rawSegments = segmentsAccessor?.(e.datum);
				const visibleSegments = rawSegments?.filter((s) => s.value > 0) ?? null;
				const baseColor = resolveColor(
					e.datum,
					e.dataIndex,
					color,
					colorAccessor
				);

				const sidePieces = buildSidePieces(e, visibleSegments, baseColor);
				// Full-side path for the vertical glass overlay — drawn once per bar
				// so the brightness curve sweeps across the entire side as one layer.
				const fullSidePath = sideFacePath(e, e.topY, e.bottomY);
				// Lid is one parallelogram regardless of segmentation — colored by the
				// topmost visible segment so it matches the front face's top section.
				const topPath = lidFacePath(e);
				const topColor = visibleSegments?.at(-1)?.color ?? baseColor;

				const delay = e.dataIndex * stagger;
				// Grow uses the SAME enter transition + stagger as `<Bar>` so the side
				// and lid rise at the exact speed of the front face. Post-load geometry
				// changes get a quick settle instead.
				const growTransition = reduceMotion ? { duration: 0 } : isLoaded
					? { duration: 0.3, ease: "easeOut" as const }
					: transitionWithDelay(enterTransition, delay);
				const isFaded =
					hoveredBarIndex != null && hoveredBarIndex !== e.dataIndex;
				const sideShadeId = e.isRightOfCenter ? sideShadeRtl : sideShadeLtr;
				const safeId = e.label.replace(/[^a-z0-9]/gi, "_");
				const clipId = `bdb-clip-${idPrefix}-${safeId}`;
				// Lid ENTRANCE only (hover-dim is owned by the wrapping group below, so
				// the lid can never dim differently from the side). Positive lids
				// translate up from the baseline riding the growing top edge; negative
				// lids already sit at the baseline, so they fade in instead.
				let lidEntrance: {
					initial: false | { y?: number; opacity?: number };
					animate: { y?: number; opacity?: number };
					transition: Transition;
				} = {
					initial: false,
					animate: { y: 0 },
					transition: { y: growTransition },
				};
				if (!reduceMotion && !isLoaded && e.isNegative) {
					lidEntrance = {
						initial: { y: 0, opacity: 0 },
						animate: { y: 0, opacity: 1 },
						transition: { y: growTransition, opacity: growTransition },
					};
				} else if (!reduceMotion && !isLoaded) {
					lidEntrance = {
						initial: { y: e.barHeight },
						animate: { y: 0 },
						transition: { y: growTransition },
					};
				}

				return (
					// Single hover-dim group for the whole back surface — side AND lid
					// share this one opacity so they always fade in lockstep (mirrors
					// `<Bar>`, which puts grow on the inner rect and hover-dim on a
					// wrapping group). Entrance animations live on the inner groups.
					<m.g
						animate={{ opacity: isFaded ? BAR_FADED_OPACITY : 1 }}
						initial={false}
						key={e.label}
						transition={reduceMotion ? { duration: 0 } : BAR_HOVER_TRANSITION}
					>
						{/* Side face — a clip-rect that grows from the baseline reveals the
								static side path(s) bottom-up, in lockstep with the bar's grow
								animation. ClipPath beats CSS scaleY because motion writes the
								SVG `transform` directly. */}
						<defs>
							<clipPath id={clipId}>
								{/* Keyed on revealEpoch AND isLoaded so it (a) replays on
										every reveal and (b) snaps to final the instant `<Bar>`
										swaps to its static rect at isLoaded — so the side never
										trails the face past the animation cutoff. */}
								<m.rect
									animate={{
										y: e.topY - e.perspectiveRise,
										height: e.barHeight + e.perspectiveRise,
									}}
									initial={reduceMotion || isLoaded ? false : { y: e.baselineY, height: 0 }}
									key={`${clipId}-${revealEpoch}-${isLoaded}`}
									transition={growTransition}
									width={e.bandWidth + 2 * e.depth + 2}
									x={e.bandX - e.depth - 1}
								/>
							</clipPath>
						</defs>
						<g clipPath={`url(#${clipId})`}>
							{/* Per-segment SOLID colors only. */}
							{sidePieces.map((piece) => (
								<path d={piece.path} fill={piece.color} key={piece.path} />
							))}
							{/* Directional shade + Y-anchored glass painted ONCE over the
									full side so both gradients stay continuous across segment
									seams. Per-segment shading uses objectBoundingBox units, which
									would restart the lit→shadowed ramp at every stacked boundary
									and read as a notch/indent. The glass is the same global
									Y-anchored curve as the front face; negatives swap to the
									per-bar bbox variant so the tip catch lands on the bar's own
									bottom edge. */}
							<path d={fullSidePath} fill={`url(#${sideShadeId})`} />
							<path
								d={fullSidePath}
								fill={`url(#${e.isNegative ? sideGlassNeg : sideGlass})`}
							/>
						</g>

						{/* Top face — three paint passes: solid color → a flat tip-bright
								highlight (the lid is the bar's top, so it gets the reflection
								catch; it can't share the side's objectBoundingBox glass, which
								would map the full ramp onto the lid's own tiny bbox) →
								directional 3D shade darkening the back edge. */}
						<m.g
							animate={lidEntrance.animate}
							initial={lidEntrance.initial}
							key={`lid-${safeId}-${revealEpoch}-${isLoaded}`}
							transition={lidEntrance.transition}
						>
							<path d={topPath} fill={topColor} />
							<path d={topPath} fill="white" fillOpacity={GLASS_TIP_OPACITY} />
							<path d={topPath} fill={`url(#${topShade})`} />
						</m.g>
					</m.g>
				);
			})}
		</g>
	);
}

BarDepthBack.displayName = "BarDepthBack";
// Mark as a non-series layer so `BarChart` doesn't count it as a bar (it
// carries a `dataKey` to pair with a Bar). Mirrors `ChartMarkers`'
// `__isChartMarkers` flag — a static property is minification-safe, unlike
// matching on `displayName`.
(BarDepthBack as { __isBarDepthLayer?: boolean }).__isBarDepthLayer = true;

export interface BarDepthFrontProps {
	/** Key in data for the bar value. Match the sibling `<Bar dataKey>`. */
	dataKey: string;
}

/**
 * Renders the front surface: a glossy glass sheen over the bar's solid fill.
 * Place AFTER the `<Bar>` elements in `<BarChart>` children so the gradient
 * sits on top of the bar.
 *
 * Reads `segmentsAccessor` from the surrounding `<BarDepthProvider>` (if any)
 * via `useBarDepthEntries`, so the glass rectangle's `topY` automatically
 * matches the lid+side's trim. No prop wiring required.
 */
export function BarDepthFront({ dataKey }: BarDepthFrontProps) {
	const reduceMotion = useReducedMotion();
	const { isLoaded, enterTransition, revealEpoch = 0 } = useChartStable();
	const { hoveredBarIndex } = useChartHover();
	const entries = useBarDepthEntries(dataKey);
	const stagger = useBarDepthStagger();
	const { posStops: glassStops, negStops: glassNegStops } = useGlassStops();
	const idPrefix = useId().replace(/[^a-z0-9]/gi, "_");
	const glassId = `bdf-glass-${idPrefix}`;
	const glassIdNeg = `bdf-glass-neg-${idPrefix}`;

	return (
		<g className="bar-depth-front" pointerEvents="none">
			<defs>
				{/* Per-bar (objectBoundingBox) glass for POSITIVE bars: 0% = the bar's
						tip, 100% = its baseline — same proportional gloss on every bar. */}
				<linearGradient id={glassId} x1="0" x2="0" y1="0" y2="1">
					{glassStops.map((stop) => (
						<stop
							key={`${stop.offset}-${stop.opacity}`}
							offset={stop.offset}
							stopColor={stop.color}
							stopOpacity={stop.opacity}
						/>
					))}
				</linearGradient>
				{/* Per-bar bbox variant for negative bars — the bright catch always
						sits on the value-bearing tip no matter how deep the bar reaches. */}
				<linearGradient id={glassIdNeg} x1="0" x2="0" y1="0" y2="1">
					{glassNegStops.map((stop) => (
						<stop
							key={`${stop.offset}-${stop.opacity}`}
							offset={stop.offset}
							stopColor={stop.color}
							stopOpacity={stop.opacity}
						/>
					))}
				</linearGradient>
			</defs>

			{entries.map((e) => {
				const delay = e.dataIndex * stagger;
				// Same enter transition + stagger as `<Bar>` so the glass rises in
				// lockstep with the front face.
				const baseTransition = reduceMotion ? { duration: 0 } : isLoaded
					? { duration: 0.3, ease: "easeOut" as const }
					: transitionWithDelay(enterTransition, delay);
				const isFaded =
					hoveredBarIndex != null && hoveredBarIndex !== e.dataIndex;

				return (
					<m.rect
						animate={{
							y: e.topY,
							height: e.barHeight,
							opacity: isFaded ? BAR_FADED_OPACITY : 1,
						}}
						fill={`url(#${e.isNegative ? glassIdNeg : glassId})`}
						// Anchor the grow at the baseline (not bottomY) so the glass grows
						// outward in whichever direction the bar extends. Keyed on
						// revealEpoch so it replays the grow on every reveal, like `<Bar>`.
						// `opacity` must be seeded too: `animate` drives it, and an SVG
						// rect has no readable opacity to start from.
						initial={
							reduceMotion || isLoaded ? false : { y: e.baselineY, height: 0, opacity: 1 }
						}
						key={`${e.label}-${revealEpoch}-${isLoaded}`}
						transition={{ ...baseTransition, opacity: reduceMotion ? { duration: 0 } : BAR_HOVER_TRANSITION }}
						width={e.bandWidth}
						x={e.bandX}
					/>
				);
			})}
		</g>
	);
}

BarDepthFront.displayName = "BarDepthFront";
(BarDepthFront as { __isBarDepthLayer?: boolean }).__isBarDepthLayer = true;
