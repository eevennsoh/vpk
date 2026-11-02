"use client";

import type { Transition } from "motion/react";
import { domAnimation, LazyMotion, m } from "motion/react";
import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";
import { HSegment, VSegment } from "./funnel-segments";

// ─── Public types ───────────────────────────────────────────────────

export interface FunnelGradientStop {
	offset: string | number;
	color: string;
}

export interface FunnelStage {
	label: string;
	value: number;
	displayValue?: string;
	/** Override the chart-level color for this segment */
	color?: string;
	/**
	 * Apply a linear gradient to this segment.
	 * Provide an array of color stops, e.g. `[{ offset: "0%", color: "#8B5CF6" }, { offset: "100%", color: "#3B82F6" }]`.
	 * When set, this takes priority over the segment and chart-level `color` for the innermost ring.
	 * Outer halo rings use the first stop color as their solid color.
	 */
	gradient?: FunnelGradientStop[];
}

export interface FunnelChartProps {
	data: FunnelStage[];
	orientation?: "horizontal" | "vertical";
	color?: string;
	layers?: number;
	className?: string;
	style?: CSSProperties;
	showPercentage?: boolean;
	showValues?: boolean;
	showLabels?: boolean;
	/** Controlled hover state — index of the hovered segment */
	hoveredIndex?: number | null;
	/** Callback when hover state changes */
	onHoverChange?: (index: number | null) => void;
	formatPercentage?: (pct: number) => string;
	formatValue?: (value: number) => string;
	/** Stagger delay between segments in seconds. Default 0.12 */
	staggerDelay?: number;
	/** Framer Motion transition for segment enter animation */
	enterTransition?: Transition;
	/** Gap between segments in pixels. Default 4 */
	gap?: number;
	/**
	 * Render an SVG pattern definition. Receives a unique `id` string per segment
	 * and the resolved `color`. Return a `<PatternLines>` (or any pattern)
	 * inside an SVG `<defs>`. The component will use `fill="url(#id)"` on the
	 * innermost ring while keeping outer halo rings as solid color.
	 */
	renderPattern?: (id: string, color: string) => ReactNode;
	/** Edge style for the funnel segments. Default "curved" */
	edges?: "curved" | "straight";
	/**
	 * Controls how segment labels (value, percentage, stage name) are arranged.
	 * - "spread": Value/percentage/label are spread apart (top/center/bottom for horizontal,
	 *   left/center/right for vertical). This is the default.
	 * - "grouped": All label items stack together in a tight group.
	 *
	 * When "grouped", use `labelOrientation` and `labelAlign` for full control.
	 */
	labelLayout?: "spread" | "grouped";
	/**
	 * Stack direction of the label group. Only applies when `labelLayout="grouped"`.
	 * - "vertical": Items stack top-to-bottom. Default for horizontal funnels.
	 * - "horizontal": Items stack left-to-right. Default for vertical funnels.
	 */
	labelOrientation?: "vertical" | "horizontal";
	/**
	 * Where the label group sits within the segment cell.
	 * - "center" (default), "start", "end"
	 * For horizontal funnel: start=top, end=bottom.
	 * For vertical funnel: start=left, end=right.
	 */
	labelAlign?: "center" | "start" | "end";
	/** Grid configuration. Pass `true` for default bands + lines, or an object for fine control. */
	grid?:
		| boolean
		| {
				/** Show alternating background bands behind each segment. Default true */
				bands?: boolean;
				/** Color of the background bands. Default "var(--color-muted)" */
				bandColor?: string;
				/** Show grid lines at each gap between segments. Default true */
				lines?: boolean;
				/** Color of the grid lines. Default "var(--chart-grid)" */
				lineColor?: string;
				/** Opacity of the grid lines. Default 1 */
				lineOpacity?: number;
				/** Width of the grid lines in pixels. Default 1 */
				lineWidth?: number;
			};
}

// ─── Defaults ───────────────────────────────────────────────────────

import { intFmt } from "./chart-formatters";

const fmtPct = (p: number) => `${Math.round(p)}%`;
const fmtVal = intFmt;

// ─── SVG helpers ────────────────────────────────────────────────────

// ─── Label overlay ──────────────────────────────────────────────────

function SegmentLabel({
	stage,
	pct,
	isHorizontal,
	showValues,
	showPercentage,
	showLabels,
	formatPercentage,
	formatValue,
	index,
	staggerDelay,
	layout = "spread",
	orientation,
	align = "center",
}: {
	stage: FunnelStage;
	pct: number;
	isHorizontal: boolean;
	showValues: boolean;
	showPercentage: boolean;
	showLabels: boolean;
	formatPercentage: (p: number) => string;
	formatValue: (v: number) => string;
	index: number;
	staggerDelay: number;
	layout?: "spread" | "grouped";
	orientation?: "vertical" | "horizontal";
	align?: "center" | "start" | "end";
}) {
	const display = stage.displayValue ?? formatValue(stage.value);

	const valueEl = showValues && (
		<span className="whitespace-nowrap font-semibold text-foreground text-sm">
			{display}
		</span>
	);
	const pctEl = showPercentage && (
		<span className="rounded-full bg-foreground px-3 py-1 font-bold text-background text-xs shadow-sm">
			{formatPercentage(pct)}
		</span>
	);
	const labelEl = showLabels && (
		<span className="whitespace-nowrap font-medium text-muted-foreground text-xs">
			{stage.label}
		</span>
	);

	// ── Spread layout (default): items pushed to edges with center element ──
	if (layout === "spread") {
		return (
			<m.div
				animate={{ opacity: 1 }}
				className={cn(
					"absolute inset-0 flex",
					isHorizontal ? "flex-col items-center" : "flex-row items-center"
				)}
				initial={{ opacity: 0 }}
				transition={{
					delay: index * staggerDelay + 0.25,
					duration: 0.35,
					ease: "easeOut",
				}}
			>
				{isHorizontal ? (
					<>
						<div className="flex h-[16%] items-end justify-center pb-1">
							{valueEl}
						</div>
						<div className="flex flex-1 items-center justify-center">
							{pctEl}
						</div>
						<div className="flex h-[16%] items-start justify-center pt-1">
							{labelEl}
						</div>
					</>
				) : (
					<>
						<div className="flex w-[16%] items-center justify-end pr-2">
							{valueEl}
						</div>
						<div className="flex flex-1 items-center justify-center">
							{pctEl}
						</div>
						<div className="flex w-[16%] items-center justify-start pl-2">
							{labelEl}
						</div>
					</>
				)}
			</m.div>
		);
	}

	// ── Grouped layout: items stacked tightly together ──
	const resolvedOrientation =
		orientation ?? (isHorizontal ? "vertical" : "horizontal");
	const isVerticalStack = resolvedOrientation === "vertical";

	// Map align to flexbox alignment on the cross axes
	const justifyMap = {
		start: "justify-start",
		center: "justify-center",
		end: "justify-end",
	} as const;
	const itemsMap = {
		start: "items-start",
		center: "items-center",
		end: "items-end",
	} as const;

	// The outer container uses the chart orientation to position the group,
	// and the inner group uses the label orientation for stacking.
	return (
		<m.div
			animate={{ opacity: 1 }}
			className={cn(
				"absolute inset-0 flex",
				// For horizontal funnel, align controls vertical placement
				// For vertical funnel, align controls horizontal placement
				isHorizontal
					? cn("flex-col items-center", justifyMap[align])
					: cn("flex-row items-center", justifyMap[align])
			)}
			initial={{ opacity: 0 }}
			style={{
				padding: isHorizontal ? "8% 0" : "0 8%",
			}}
			transition={{
				delay: index * staggerDelay + 0.25,
				duration: 0.35,
				ease: "easeOut",
			}}
		>
			<div
				className={cn(
					"flex gap-1.5",
					isVerticalStack
						? cn("flex-col", itemsMap[isHorizontal ? "center" : align])
						: cn("flex-row", itemsMap.center)
				)}
			>
				{valueEl}
				{pctEl}
				{labelEl}
			</div>
		</m.div>
	);
}

// ─── Main Component ─────────────────────────────────────────────────

export function FunnelChart({
	data,
	orientation = "horizontal",
	color = "var(--chart-1)",
	layers = 3,
	className,
	style,
	showPercentage = true,
	showValues = true,
	showLabels = true,
	hoveredIndex: hoveredIndexProp,
	onHoverChange,
	formatPercentage = fmtPct,
	formatValue = fmtVal,
	staggerDelay = 0.12,
	enterTransition,
	gap = 4,
	renderPattern,
	edges = "curved",
	labelLayout = "spread",
	labelOrientation,
	labelAlign = "center",
	grid: gridProp = false,
}: FunnelChartProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [sz, setSz] = useState({ w: 0, h: 0 });
	const [internalHoveredIndex, setInternalHoveredIndex] = useState<
		number | null
	>(null);

	const isControlled = hoveredIndexProp !== undefined;
	const hoveredIndex = isControlled ? hoveredIndexProp : internalHoveredIndex;
	const setHoveredIndex = useCallback(
		(index: number | null) => {
			if (isControlled) {
				onHoverChange?.(index);
			} else {
				setInternalHoveredIndex(index);
			}
		},
		[isControlled, onHoverChange]
	);

	const measure = useCallback(() => {
		if (!ref.current) {
			return;
		}
		const { width: w, height: h } = ref.current.getBoundingClientRect();
		if (w > 0 && h > 0) {
			setSz({ w, h });
		}
	}, []);

	useEffect(() => {
		measure();
		const ro = new ResizeObserver(measure);
		if (ref.current) {
			ro.observe(ref.current);
		}
		return () => ro.disconnect();
	}, [measure]);

	if (!data.length) {
		return null;
	}

	const first = data[0];
	if (!first) {
		return null;
	}
	const max = first.value;
	const n = data.length;
	const norms = data.map((d) => d.value / max);
	const horiz = orientation === "horizontal";
	const { w: W, h: H } = sz;

	const totalGap = gap * (n - 1);
	const segW = (W - (horiz ? totalGap : 0)) / n;
	const segH = (H - (horiz ? 0 : totalGap)) / n;

	// Resolve grid config
	const gridEnabled = gridProp !== false;
	const gridCfg = typeof gridProp === "object" ? gridProp : {};
	const showBands = gridEnabled && (gridCfg.bands ?? true);
	const bandColor = gridCfg.bandColor ?? "var(--color-muted)";
	const showGridLines = gridEnabled && (gridCfg.lines ?? true);
	const gridLineColor = gridCfg.lineColor ?? "var(--chart-grid)";
	const gridLineOpacity = gridCfg.lineOpacity ?? 1;
	const gridLineWidth = gridCfg.lineWidth ?? 1;

	return (
		<LazyMotion features={domAnimation}>
			<div
				className={cn(
					"relative w-full select-none overflow-visible",
					className
				)}
				ref={ref}
				style={{
					aspectRatio: horiz ? "2.2 / 1" : "1 / 1.8",
					...style,
				}}
			>
				{W > 0 && H > 0 ? (
					<>
						{/* Grid layer: background bands + grid lines */}
						{gridEnabled ? (
							<svg
								aria-hidden="true"
								className="pointer-events-none absolute inset-0 h-full w-full"
								preserveAspectRatio="none"
								role="presentation"
								viewBox={`0 0 ${W} ${H}`}
							>
								{/* Background bands — alternating on even segments */}
								{showBands ? data.map((stage, i) => {
										if (i % 2 !== 0) {
											return null;
										}
										if (horiz) {
											const x = (segW + gap) * i;
											return (
												<rect
													fill={bandColor}
													height={H}
													key={`band-${stage.label}`}
													width={segW}
													x={x}
													y={0}
												/>
											);
										}
										const y = (segH + gap) * i;
										return (
											<rect
												fill={bandColor}
												height={segH}
												key={`band-${stage.label}`}
												width={W}
												x={0}
												y={y}
											/>
										);
									}) : null}
							</svg>
						) : null}

						{/* Segments container — overflow-visible so hover scale is not clipped */}
						<div
							className={cn(
								"absolute inset-0 flex overflow-visible",
								horiz ? "flex-row" : "flex-col"
							)}
							style={{ gap }}
						>
							{data.map((stage, i) => {
								const normStart = norms[i] ?? 0;
								const normEnd = norms[Math.min(i + 1, n - 1)] ?? 0;
								const firstStop = stage.gradient?.[0];
								const segColor = firstStop
									? firstStop.color
									: (stage.color ?? color);

								return horiz ? (
									<HSegment
										color={segColor}
										dimmed={hoveredIndex !== null && hoveredIndex !== i}
										enterTransition={enterTransition}
										fullH={H}
										gradientStops={stage.gradient}
										hovered={hoveredIndex === i}
										index={i}
										key={stage.label}
										layers={layers}
										normEnd={normEnd}
										normStart={normStart}
										renderPattern={renderPattern}
										segW={segW}
										staggerDelay={staggerDelay}
										straight={edges === "straight"}
									/>
								) : (
									<VSegment
										color={segColor}
										dimmed={hoveredIndex !== null && hoveredIndex !== i}
										enterTransition={enterTransition}
										fullW={W}
										gradientStops={stage.gradient}
										hovered={hoveredIndex === i}
										index={i}
										key={stage.label}
										layers={layers}
										normEnd={normEnd}
										normStart={normStart}
										renderPattern={renderPattern}
										segH={segH}
										staggerDelay={staggerDelay}
										straight={edges === "straight"}
									/>
								);
							})}
						</div>

						{/* Grid lines — rendered above segments so they're visible */}
						{gridEnabled && showGridLines ? (
							<svg
								aria-hidden="true"
								className="pointer-events-none absolute inset-0 h-full w-full"
								preserveAspectRatio="none"
								role="presentation"
								viewBox={`0 0 ${W} ${H}`}
							>
								{Array.from({ length: n - 1 }, (_, i) => {
									const idx = i + 1;
									const gridKey = `grid-${idx}`;
									if (horiz) {
										const x = segW * idx + gap * i + gap / 2;
										return (
											<line
												key={gridKey}
												stroke={gridLineColor}
												strokeOpacity={gridLineOpacity}
												strokeWidth={gridLineWidth}
												x1={x}
												x2={x}
												y1={0}
												y2={H}
											/>
										);
									}
									const y = segH * idx + gap * i + gap / 2;
									return (
										<line
											key={gridKey}
											stroke={gridLineColor}
											strokeOpacity={gridLineOpacity}
											strokeWidth={gridLineWidth}
											x1={0}
											x2={W}
											y1={y}
											y2={y}
										/>
									);
								})}
							</svg>
						) : null}

						{/* Label overlays — one per segment, positioned over each segment cell.
							These are the hover triggers for each segment. */}
						{data.map((stage, i) => {
							const pct = (stage.value / max) * 100;
							const posStyle: CSSProperties = horiz
								? {
										left: (segW + gap) * i,
										width: segW,
										top: 0,
										height: H,
									}
								: {
										top: (segH + gap) * i,
										height: segH,
										left: 0,
										width: W,
									};

							const isDimmed = hoveredIndex !== null && hoveredIndex !== i;

							return (
								<m.div
									animate={{ opacity: isDimmed ? 0.4 : 1 }}
									className="absolute cursor-pointer"
									key={`lbl-${stage.label}`}
									onMouseEnter={() => setHoveredIndex(i)}
									onMouseLeave={() => setHoveredIndex(null)}
									style={{ ...posStyle, zIndex: 20 }}
									transition={{ type: "spring", stiffness: 300, damping: 24 }}
								>
									<SegmentLabel
										align={labelAlign}
										formatPercentage={formatPercentage}
										formatValue={formatValue}
										index={i}
										isHorizontal={horiz}
										layout={labelLayout}
										orientation={labelOrientation}
										pct={pct}
										showLabels={showLabels}
										showPercentage={showPercentage}
										showValues={showValues}
										stage={stage}
										staggerDelay={staggerDelay}
									/>
								</m.div>
							);
						})}
					</>
				) : null}
			</div>
		</LazyMotion>
	);
}
