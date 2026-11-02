"use client";

import { domAnimation, LazyMotion, type MotionValue, useReducedMotion } from "motion/react";
import { Children, type ReactNode, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useElementSize } from "./chart-parent-size";
import { cartesianToAngle, createRadialScale, defaultRadialLayout, degreesToRadians, isFullArc, radialArcBounds, radialArcFraction, radialWedgePath } from "./radial-geometry";

import { RadialChartContext, radialNumberAt, radialTimeOf, useRadialAngleSpring, CENTER_CHILDREN, BELOW_CHILDREN, childDisplayName, computeValueDomain, type RadialRingBand, type RadialChartProps, type RadialChartContextValue } from "./radial-context";
export { RadialChartContext, useRadialChart, radialNumberAt, radialTimeOf, RADIAL_CROSSHAIR_SPRING, RADIAL_DOT_SPRING, useRadialAngleSpring, useRadialDotAngle, createRadialEdgeLookup, RadialHoverDot, computeValueDomain } from "./radial-context";
export type { RadialSeries, RadialAngleType, RadialOrientation, RadialMaxValue, RadialRingBand, RadialChartContextValue, RadialChartProps, RadialDotMotion, RadialEdgeLookup } from "./radial-context";

// ---------------------------------------------------------------------------

/**
 * Square, responsive shell for radial charts: measures itself, owns the
 * shared geometry (start angle at the top, clockwise; full circle or a
 * partial arc), the shared value scale, hover-by-angle (or by ring), legend
 * hover and the enter flag, and exposes them through {@link useRadialChart}.
 */
export function RadialChart({
	data,
	xDataKey = "time",
	series,
	layout: layoutProp,
	angleType = "clock",
	orientation = "radial",
	startAngle: startAngleDeg = 0,
	endAngle: endAngleDeg,
	fitArc = true,
	trackNow: trackNowProp,
	nowIndex: nowIndexProp,
	maxValue: maxValueProp,
	minValue = 0,
	valueKeys,
	niceValues = true,
	ringGap = 0.3,
	animate = true,
	hoveredIndex: hoveredIndexProp,
	onHoverChange,
	maxWidth = 640,
	className,
	children,
}: RadialChartProps) {
	const stageRef = useRef<HTMLDivElement>(null);
	const { width } = useElementSize(stageRef, 100);
	const layout = useMemo(
		() => ({ ...defaultRadialLayout, ...layoutProp }),
		[layoutProp]
	);

	// Arc -----------------------------------------------------------------------
	const startAngle = degreesToRadians(startAngleDeg);
	const endAngle = degreesToRadians(endAngleDeg ?? startAngleDeg + 360);
	const isFullCircle = isFullArc(startAngle, endAngle);
	const span = endAngle - startAngle;

	const bounds = useMemo(
		() =>
			isFullCircle || !fitArc
				? { minX: -1, maxX: 1, minY: -1, maxY: 1 }
				: (() => {
						const b = radialArcBounds(startAngle, endAngle);
						// Room around the centre for the hole / center content.
						const pad = 0.12;
						return {
							minX: Math.min(b.minX, -pad),
							maxX: Math.max(b.maxX, pad),
							minY: Math.min(b.minY, -pad),
							maxY: Math.max(b.maxY, pad),
						};
					})(),
		[isFullCircle, fitArc, startAngle, endAngle]
	);
	const boundsWidth = bounds.maxX - bounds.minX;
	const boundsHeight = bounds.maxY - bounds.minY;
	const stageWidth = Math.max(0, width);
	const radius = stageWidth / boundsWidth;
	const stageHeight = radius * boundsHeight;
	const cx = -bounds.minX * radius;
	const cy = -bounds.minY * radius;
	const size = radius * 2;

	const reducedMotion = useReducedMotion() === true;
	const shouldAnimate = animate && !reducedMotion;

	// Hover ------------------------------------------------------------------
	const [internalHovered, setInternalHovered] = useState<number | null>(null);
	const isControlled = hoveredIndexProp !== undefined;
	const hoveredIndex = isControlled ? hoveredIndexProp : internalHovered;
	const setHoveredIndex = useCallback(
		(index: number | null) => {
			if (!isControlled) {
				setInternalHovered(index);
			}
			onHoverChange?.(index);
		},
		[isControlled, onHoverChange]
	);
	const [hoveredSeries, setHoveredSeries] = useState<number | null>(null);

	// Data -------------------------------------------------------------------
	const binCount = data.length;
	const trackNow = trackNowProp ?? angleType === "clock";

	const futureBins = useMemo(
		() =>
			data.map(
				(d) =>
					trackNow && series.every((s) => radialNumberAt(d, s.dataKey) === null)
			),
		[data, series, trackNow]
	);

	const nowIndex = useMemo(() => {
		if (nowIndexProp !== undefined) {
			return nowIndexProp;
		}
		for (let i = binCount - 1; i >= 0; i--) {
			if (series.some((s) => radialNumberAt(data[i], s.dataKey) !== null)) {
				return i;
			}
		}
		return binCount - 1;
	}, [nowIndexProp, data, series, binCount]);

	const totals = useMemo(() => {
		const result: Record<string, number> = {};
		for (const s of series) {
			result[s.dataKey] = 0;
		}
		data.forEach((d, i) => {
			if (futureBins[i]) {
				return;
			}
			for (const s of series) {
				result[s.dataKey] =
					(result[s.dataKey] ?? 0) + (radialNumberAt(d, s.dataKey) ?? 0);
			}
		});
		return result;
	}, [data, series, futureBins]);

	// Value scale ----------------------------------------------------------------
	const sharedValueScale =
		maxValueProp !== undefined || orientation === "angular";
	const valueDomain = useMemo(
		() =>
			computeValueDomain({
				data,
				series,
				valueKeys: valueKeys ?? [],
				maxValue: maxValueProp ?? "stacked",
				minValue,
				nice: niceValues,
			}),
		[data, series, valueKeys, maxValueProp, minValue, niceValues]
	);

	const innerRadius = radius * layout.bandInner;
	const outerRadius = radius * layout.bandOuter;

	const valueScale = useMemo(() => {
		const scale = createRadialScale({
			minValue: valueDomain[0],
			maxValue: valueDomain[1],
			innerRadius,
			outerRadius,
		});
		return (value: number) => scale(value) ?? innerRadius;
	}, [valueDomain, innerRadius, outerRadius]);

	const valueToAngle = useCallback(
		(value: number) => {
			const [lo, hi] = valueDomain;
			const t = hi > lo ? (value - lo) / (hi - lo) : 0;
			return startAngle + Math.min(1, Math.max(0, t)) * span;
		},
		[valueDomain, startAngle, span]
	);

	const ringBand = useCallback(
		(index: number): RadialRingBand => {
			const step = (outerRadius - innerRadius) / Math.max(1, binCount);
			const gap = step * Math.min(0.95, Math.max(0, ringGap));
			const inner = innerRadius + index * step + gap / 2;
			const outer = innerRadius + (index + 1) * step - gap / 2;
			return { inner, outer, center: (inner + outer) / 2 };
		},
		[innerRadius, outerRadius, binCount, ringGap]
	);

	// Time --------------------------------------------------------------------
	const timeDomain = useMemo((): [number, number] | null => {
		if (angleType !== "time" || binCount === 0) {
			return null;
		}
		const first = radialTimeOf(data[0]?.[xDataKey]);
		const last = radialTimeOf(data[binCount - 1]?.[xDataKey]);
		if (first === null || last === null) {
			return null;
		}
		const step = binCount > 1 ? (last - first) / (binCount - 1) : 1;
		return [first, first + step * binCount];
	}, [angleType, binCount, data, xDataKey]);

	const timeToAngle = useCallback(
		(time: Date | number) => {
			if (!timeDomain) {
				return null;
			}
			const t = typeof time === "number" ? time : time.getTime();
			const [t0, t1] = timeDomain;
			if (t < t0 || t > t1 || t1 <= t0) {
				return null;
			}
			return startAngle + ((t - t0) / (t1 - t0)) * span;
		},
		[timeDomain, startAngle, span]
	);

	// Enter flag ---------------------------------------------------------------
	const [enterRevealed, setRevealed] = useState(false);
	const revealed = !shouldAnimate || enterRevealed;
	const hasSize = stageWidth > 0;
	useEffect(() => {
		if (!hasSize || !shouldAnimate) {
			return;
		}
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => setRevealed(true));
		});
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
		};
	}, [hasSize, shouldAnimate]);

	// Angle helpers ------------------------------------------------------------
	const centerRadius = radius * layout.center;
	const binWidth = binCount > 0 ? span / binCount : 0;

	const binStartAngle = useCallback(
		(index: number) => startAngle + (index / Math.max(1, binCount)) * span,
		[startAngle, span, binCount]
	);
	const binAngle = useCallback(
		(index: number) =>
			startAngle + ((index + 0.5) / Math.max(1, binCount)) * span,
		[startAngle, span, binCount]
	);
	const fractionToAngle = useCallback(
		(fraction: number) => startAngle + fraction * span,
		[startAngle, span]
	);
	const angleToBin = useCallback(
		(angle: number) => {
			const fraction = radialArcFraction(angle, startAngle, endAngle);
			if (fraction === null || binCount === 0) {
				return null;
			}
			return Math.min(binCount - 1, Math.floor(fraction * binCount));
		},
		[startAngle, endAngle, binCount]
	);

	// Crosshair ------------------------------------------------------------------
	// Fallback for charts without a RadialScrubber, so locked hover dots move
	// the same way either way.
	const fallbackCrosshair = useRadialAngleSpring({
		angle: binAngle(hoveredIndex ?? 0),
		hidden: hoveredIndex === null,
		isFullCircle,
		snap: reducedMotion,
	});
	const [scrubberCrosshair, setScrubberCrosshair] =
		useState<MotionValue<number> | null>(null);
	const registerCrosshair = useCallback((angle: MotionValue<number>) => {
		setScrubberCrosshair(angle);
		return () =>
			setScrubberCrosshair((current) => (current === angle ? null : current));
	}, []);
	const crosshairAngle = scrubberCrosshair ?? fallbackCrosshair;

	// Pointer ----------------------------------------------------------------
	const handlePointerMove = useCallback(
		(event: ReactPointerEvent<SVGSVGElement>) => {
			if (binCount === 0) {
				return;
			}
			const rect = event.currentTarget.getBoundingClientRect();
			const dx = event.clientX - rect.left - cx;
			const dy = event.clientY - rect.top - cy;
			const distance = Math.hypot(dx, dy);
			let next: number | null = null;
			if (orientation === "angular") {
				const step = (outerRadius - innerRadius) / binCount;
				const ring = Math.floor((distance - innerRadius) / step);
				next = ring >= 0 && ring < binCount ? ring : null;
			} else if (distance >= centerRadius * 0.5) {
				next = angleToBin(cartesianToAngle(dx, dy));
			}
			if (next !== hoveredIndex) {
				setHoveredIndex(next);
			}
		},
		[
			binCount,
			cx,
			cy,
			orientation,
			outerRadius,
			innerRadius,
			centerRadius,
			angleToBin,
			hoveredIndex,
			setHoveredIndex,
		]
	);

	const handlePointerLeave = useCallback(() => {
		setHoveredIndex(null);
	}, [setHoveredIndex]);

	// Context ----------------------------------------------------------------
	const contextValue = useMemo(
		(): RadialChartContextValue => ({
			data,
			xDataKey,
			series,
			binCount,
			size,
			radius,
			layout,
			centerRadius,
			innerRadius,
			outerRadius,
			futureBins,
			nowIndex,
			trackNow,
			totals,
			hoveredIndex,
			setHoveredIndex,
			crosshairAngle,
			registerCrosshair,
			hoveredSeries,
			setHoveredSeries,
			revealed,
			animate: shouldAnimate,
			reducedMotion,
			angleType,
			orientation,
			startAngle,
			endAngle,
			isFullCircle,
			binWidth,
			binAngle,
			binStartAngle,
			angleToBin,
			fractionToAngle,
			timeToAngle,
			timeDomain,
			valueDomain,
			maxValue: valueDomain[1],
			sharedValueScale,
			valueScale,
			valueToAngle,
			ringBand,
		}),
		[
			data,
			xDataKey,
			series,
			binCount,
			size,
			radius,
			layout,
			centerRadius,
			innerRadius,
			outerRadius,
			futureBins,
			nowIndex,
			trackNow,
			totals,
			hoveredIndex,
			setHoveredIndex,
			crosshairAngle,
			registerCrosshair,
			hoveredSeries,
			revealed,
			shouldAnimate,
			reducedMotion,
			angleType,
			orientation,
			startAngle,
			endAngle,
			isFullCircle,
			binWidth,
			binAngle,
			binStartAngle,
			angleToBin,
			fractionToAngle,
			timeToAngle,
			timeDomain,
			valueDomain,
			sharedValueScale,
			valueScale,
			valueToAngle,
			ringBand,
		]
	);

	// Children -------------------------------------------------------------------
	const svgChildren: ReactNode[] = [];
	const centerChildren: ReactNode[] = [];
	const belowChildren: ReactNode[] = [];
	Children.forEach(children, (child) => {
		const name = childDisplayName(child);
		if (CENTER_CHILDREN.has(name)) {
			centerChildren.push(child);
		} else if (BELOW_CHILDREN.has(name)) {
			belowChildren.push(child);
		} else if (child !== null && child !== undefined && child !== false) {
			svgChildren.push(child);
		}
	});

	const centerSize = Math.max(0, centerRadius * 2 - 16);

	return (
		<LazyMotion features={domAnimation}>
			<RadialChartContext value={contextValue}>
				<div
					className={cn("mx-auto flex w-full flex-col items-center", className)}
					style={{ maxWidth }}
				>
					<div
						className="relative w-full"
						ref={stageRef}
						style={{ aspectRatio: `${boundsWidth} / ${boundsHeight}` }}
					>
						{hasSize ? (
							<>
								<svg
									aria-hidden="true"
									className="absolute inset-0 touch-pan-y select-none"
									height={stageHeight}
									onPointerLeave={handlePointerLeave}
									onPointerMove={handlePointerMove}
									style={{ overflow: "visible" }}
									width={stageWidth}
								>
									<g transform={`translate(${cx},${cy})`}>
										{/* Hit area so the whole disc tracks the pointer */}
										{isFullCircle ? (
											<circle fill="transparent" r={radius} />
										) : (
											<path
												d={radialWedgePath(radius, startAngle, endAngle)}
												fill="transparent"
											/>
										)}
										{svgChildren}
									</g>
								</svg>

								{centerChildren.length > 0 ? (
									<div
										className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
										style={{
											left: cx,
											top: cy,
											width: centerSize,
											height: centerSize,
										}}
									>
										{centerChildren}
									</div>
								) : null}
							</>
						) : null}
					</div>
					{belowChildren}
				</div>
			</RadialChartContext>
		</LazyMotion>
	);
}

RadialChart.displayName = "RadialChart";

export default RadialChart;
