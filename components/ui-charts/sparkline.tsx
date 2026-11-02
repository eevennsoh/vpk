"use client";

import { motionDuration, motionEase } from "@/lib/motion";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import { memo, type RefObject, useCallback, useMemo, useRef, useState } from "react";

import { DEFAULT_ANIMATION_EASING } from "./animation";

import { buildSparklineAreaPath, buildSparklineBarSegment, buildSparklineBarsPath, buildSparklineLinePath, resolveSparklinePadding, type SparklineCurve, type SparklineLayout, type SparklinePadding, sparklineBarWidth } from "./sparkline-geometry";

import { DEFAULT_SPARKLINE_ANIMATION_DURATION_MS, DEFAULT_SPARKLINE_DATA_TRANSITION_MS, HOVER_FADE, useEnterAnimation, useDataTransition, wipeKeyframes, drawKeyframes, SparklineFrame, SparklineDot, SparklineHighlight, HoverOverlay, resolveHoverSpring, type SparklineCrosshair, type SparklineSpringConfig, type LineSparklineProps, type AreaSparklineProps, type BarSparklineProps } from "./sparkline-internal";
export { DEFAULT_SPARKLINE_ANIMATION_DURATION_MS, DEFAULT_SPARKLINE_DATA_TRANSITION_MS, DEFAULT_SPARKLINE_HOVER_SPRING } from "./sparkline-internal";
export type { SparklineCrosshair, SparklineSpringConfig, SparklineBaseProps, LineSparklineProps, AreaSparklineProps, BarSparklineProps } from "./sparkline-internal";
export type { SparklineCurve, SparklineDataKey, SparklinePadding } from "./sparkline-geometry";

function LineOrArea<T>({
	config,
	variant,
}: {
	config: AreaSparklineProps<T>;
	variant: "line" | "area";
}) {
	const {
		curve = "monotone",
		strokeWidth = 1.5,
		endDot = false,
		fill = "gradient",
		fillOpacity = variant === "area" ? 0.3 : 0,
		animate = true,
		animationDuration = DEFAULT_SPARKLINE_ANIMATION_DURATION_MS,
		animationEasing = DEFAULT_ANIMATION_EASING,
		dataTransitionDuration = DEFAULT_SPARKLINE_DATA_TRANSITION_MS,
		crosshair = "dashed",
		dot = true,
		hoverTransition = true,
		springConfig,
		showHighlight = true,
		inactiveOpacity = 0.5,
	} = config;
	const spring = resolveHoverSpring(hoverTransition, springConfig);
	const padding = resolveSparklinePadding(config.padding, 4);
	const groupRef = useRef<SVGGElement>(null);
	const lineRef = useRef<SVGPathElement>(null);

	return (
		<SparklineFrame
			config={config}
			defaultPadding={4}
			includeZero={false}
			kind="point"
		>
			{({ width, height, layout, hoverIndex, color, gradientId }) => (
				<LineOrAreaPaths
					animate={animate}
					animationDuration={animationDuration}
					animationEasing={animationEasing}
					color={color}
					crosshair={crosshair}
					curve={curve}
					dataTransitionDuration={animate ? dataTransitionDuration : 0}
					dot={dot}
					endDot={endDot}
					fill={fill}
					fillOpacity={fillOpacity}
					gradientId={gradientId}
					groupRef={groupRef}
					height={height}
					hoverIndex={hoverIndex}
					inactiveOpacity={showHighlight ? inactiveOpacity : 1}
					layout={layout}
					lineRef={lineRef}
					padding={padding}
					showHighlight={showHighlight}
					spring={spring}
					strokeWidth={strokeWidth}
					variant={variant}
					width={width}
				/>
			)}
		</SparklineFrame>
	);
}

function LineOrAreaPaths({
	variant,
	layout,
	width,
	height,
	padding,
	curve,
	strokeWidth,
	color,
	fill,
	fillOpacity,
	endDot,
	hoverIndex,
	crosshair,
	dot,
	gradientId,
	animate,
	animationDuration,
	animationEasing,
	dataTransitionDuration,
	groupRef,
	lineRef,
	spring,
	showHighlight,
	inactiveOpacity,
}: {
	variant: "line" | "area";
	layout: SparklineLayout;
	width: number;
	height: number;
	padding: SparklinePadding;
	curve: SparklineCurve;
	strokeWidth: number;
	color: string;
	fill: "gradient" | "solid";
	fillOpacity: number;
	endDot: boolean;
	hoverIndex: number | null;
	crosshair: SparklineCrosshair;
	dot: boolean;
	gradientId: string;
	animate: boolean;
	animationDuration: number;
	animationEasing: string;
	dataTransitionDuration: number;
	groupRef: RefObject<SVGGElement | null>;
	lineRef: RefObject<SVGPathElement | null>;
	spring: SparklineSpringConfig | null;
	showHighlight: boolean;
	inactiveOpacity: number;
}) {
	const linePath = useMemo(
		() => buildSparklineLinePath(layout.points, curve),
		[layout, curve]
	);
	const areaPath = useMemo(
		() =>
			variant === "area"
				? buildSparklineAreaPath(layout.points, curve, layout.baselineY)
				: "",
		[variant, layout, curve]
	);

	const areaRef = useRef<SVGPathElement>(null);
	useDataTransition(layout, width, dataTransitionDuration, (frame) => {
		lineRef.current?.setAttribute(
			"d",
			buildSparklineLinePath(frame.points, curve)
		);
		areaRef.current?.setAttribute(
			"d",
			buildSparklineAreaPath(frame.points, curve, frame.baselineY)
		);
	});

	// Line draws in along its stroke; area wipes in left → right.
	useEnterAnimation(variant === "line" ? lineRef : groupRef, width > 0, {
		animate,
		duration: animationDuration,
		easing: animationEasing,
		keyframes: variant === "line" ? drawKeyframes : wipeKeyframes,
	});

	const fillId = `${gradientId}-fill`;
	let last: SparklineLayout["points"][number] | undefined;
	for (let i = layout.points.length - 1; i >= 0 && !last; i--) {
		const point = layout.points[i];
		if (point && Number.isFinite(point.y)) {
			last = point;
		}
	}

	return (
		<>
			<g
				aria-hidden
				ref={groupRef}
				style={{
					opacity: hoverIndex === null ? 1 : inactiveOpacity,
					transition: HOVER_FADE,
				}}
			>
				{variant === "area" ? (
					<>
						{fill === "gradient" ? (
							<defs>
								<linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
									<stop
										offset="0"
										stopColor={color}
										stopOpacity={fillOpacity}
									/>
									<stop offset="1" stopColor={color} stopOpacity={0} />
								</linearGradient>
							</defs>
						) : null}
						<path
							d={areaPath}
							fill={fill === "gradient" ? `url(#${fillId})` : color}
							fillOpacity={fill === "gradient" ? 1 : fillOpacity}
							ref={areaRef}
						/>
					</>
				) : null}
				<path
					d={linePath}
					fill="none"
					pathLength={1}
					ref={lineRef}
					stroke={color}
					strokeDasharray={variant === "line" ? 1 : undefined}
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={strokeWidth}
				/>
			</g>
			{showHighlight && hoverIndex !== null ? (
				<SparklineHighlight
					height={height}
					hoverIndex={hoverIndex}
					layout={layout}
					lineRef={lineRef}
					stroke={color}
					strokeWidth={strokeWidth}
				/>
			) : null}
			{endDot && hoverIndex === null && last ? (
				<SparklineDot color={color} x={last.x} y={last.y} />
			) : null}
			<HoverOverlay
				color={color}
				crosshair={crosshair}
				dot={dot}
				gradientId={gradientId}
				height={height}
				hoverIndex={hoverIndex}
				layout={layout}
				padding={padding}
				spring={spring}
			/>
		</>
	);
}

function LineSparklineImpl<T>(props: LineSparklineProps<T>) {
	return (
		<LazyMotion features={domAnimation}>
			<LineOrArea config={props} variant="line" />
		</LazyMotion>
	);
}

function AreaSparklineImpl<T>(props: AreaSparklineProps<T>) {
	return (
		<LazyMotion features={domAnimation}>
			<LineOrArea config={props} variant="area" />
		</LazyMotion>
	);
}

function BarSparklineImpl<T>(props: BarSparklineProps<T>) {
	const {
		barGap = 2,
		barRadius = 1,
		inactiveOpacity = 0.4,
		animate = true,
		animationDuration = DEFAULT_SPARKLINE_ANIMATION_DURATION_MS,
		animationEasing = DEFAULT_ANIMATION_EASING,
		dataTransitionDuration = DEFAULT_SPARKLINE_DATA_TRANSITION_MS,
		crosshair = "dashed",
		dot = true,
		hoverTransition = true,
		springConfig,
	} = props;
	const spring = resolveHoverSpring(hoverTransition, springConfig);
	const padding = resolveSparklinePadding(props.padding, 2);
	const groupRef = useRef<SVGGElement>(null);

	return (
		<LazyMotion features={domAnimation}>
			<SparklineFrame config={props} defaultPadding={2} includeZero kind="band">
				{({ width, height, layout, hoverIndex, color, gradientId }) => (
					<BarPaths
						animate={animate}
						animationDuration={animationDuration}
						animationEasing={animationEasing}
						barGap={barGap}
						barRadius={barRadius}
						color={color}
						crosshair={crosshair}
						dataTransitionDuration={animate ? dataTransitionDuration : 0}
						dot={dot}
						gradientId={gradientId}
						groupRef={groupRef}
						height={height}
						hoverIndex={hoverIndex}
						inactiveOpacity={inactiveOpacity}
						layout={layout}
						padding={padding}
						spring={spring}
						width={width}
					/>
				)}
			</SparklineFrame>
		</LazyMotion>
	);
}

function BarPaths({
	layout,
	width,
	height,
	padding,
	barGap,
	barRadius,
	inactiveOpacity,
	color,
	hoverIndex,
	crosshair,
	dot,
	gradientId,
	animate,
	animationDuration,
	animationEasing,
	dataTransitionDuration,
	groupRef,
	spring,
}: {
	layout: SparklineLayout;
	width: number;
	height: number;
	padding: SparklinePadding;
	barGap: number;
	barRadius: number;
	inactiveOpacity: number;
	color: string;
	hoverIndex: number | null;
	crosshair: SparklineCrosshair;
	dot: boolean;
	gradientId: string;
	animate: boolean;
	animationDuration: number;
	animationEasing: string;
	dataTransitionDuration: number;
	groupRef: RefObject<SVGGElement | null>;
	spring: SparklineSpringConfig | null;
}) {
	const barsRef = useRef<SVGPathElement>(null);
	useDataTransition(layout, width, dataTransitionDuration, (frame) => {
		barsRef.current?.setAttribute(
			"d",
			buildSparklineBarsPath(frame, { gap: barGap, radius: barRadius })
		);
	});
	const barsPath = useMemo(
		() => buildSparklineBarsPath(layout, { gap: barGap, radius: barRadius }),
		[layout, barGap, barRadius]
	);

	// Bars grow from the baseline while a left → right wipe staggers them.
	const keyframes = useMemo<Keyframe[]>(
		() => [
			{
				clipPath: "inset(0 100% 0 0)",
				transform: "scaleY(0)",
				transformOrigin: `0 ${layout.baselineY}px`,
			},
			{
				clipPath: "inset(0 0% 0 0)",
				transform: "scaleY(1)",
				transformOrigin: `0 ${layout.baselineY}px`,
			},
		],
		[layout.baselineY]
	);
	useEnterAnimation(groupRef, width > 0, {
		animate,
		duration: animationDuration,
		easing: animationEasing,
		keyframes,
	});

	const hovered = hoverIndex === null ? undefined : layout.points[hoverIndex];

	return (
		<>
			<g aria-hidden ref={groupRef}>
				<path
					d={barsPath}
					fill={color}
					ref={barsRef}
					style={{
						opacity: hovered ? inactiveOpacity : 1,
						transition: HOVER_FADE,
					}}
				/>
				{/* The focused bar sits on top at full strength; moving between bars
						cross-fades it, and the rest fade with the base path above. */}
				<AnimatePresence>
					{hovered && hoverIndex !== null && Number.isFinite(hovered.y) ? (
						<m.path
							animate={{ opacity: 1 }}
							d={buildSparklineBarSegment(
								hovered.x,
								sparklineBarWidth(layout.band, barGap),
								hovered.y,
								layout.baselineY,
								barRadius
							)}
							exit={{ opacity: 0 }}
							fill={color}
							initial={{ opacity: inactiveOpacity }}
							key={hoverIndex}
							transition={{ duration: motionDuration.normal, ease: motionEase.outPractical }}
						/>
					) : null}
				</AnimatePresence>
			</g>
			<HoverOverlay
				color={color}
				crosshair={crosshair}
				dot={dot}
				gradientId={gradientId}
				height={height}
				hoverIndex={hoverIndex}
				layout={layout}
				padding={padding}
				spring={spring}
			/>
		</>
	);
}

/** Tiny line chart — one path, no axes, minimal hover crosshair + dot. */
export const LineSparkline = memo(
	LineSparklineImpl
) as typeof LineSparklineImpl;
/** Tiny area chart — line over a gradient or solid fill. */
export const AreaSparkline = memo(
	AreaSparklineImpl
) as typeof AreaSparklineImpl;
/** Tiny bar chart — all bars drawn as a single path. */
export const BarSparkline = memo(BarSparklineImpl) as typeof BarSparklineImpl;

/**
 * Lift a sparkline's hover state so you can display the hovered value.
 * Spread `sparklineProps` onto one sparkline — or several to sync their
 * crosshairs.
 *
 * ```tsx
 * const hover = useSparklineHover<Row>();
 * <span>{hover.datum?.value ?? latest}</span>
 * <LineSparkline data={rows} dataKey="value" {...hover.sparklineProps} />
 * ```
 */
export function useSparklineHover<T>() {
	const [state, setState] = useState<{ index: number | null; datum: T | null }>(
		{ index: null, datum: null }
	);
	const onHoverChange = useCallback(
		(index: number | null, datum: T | null) => setState({ index, datum }),
		[]
	);
	const sparklineProps = useMemo(
		() => ({ hoverIndex: state.index, onHoverChange }),
		[state.index, onHoverChange]
	);
	return {
		index: state.index,
		datum: state.datum,
		isHovering: state.index !== null,
		sparklineProps,
	};
}
