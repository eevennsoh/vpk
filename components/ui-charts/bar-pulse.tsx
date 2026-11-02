"use client";

import { m, useReducedMotion } from "motion/react";
import { useId, useMemo } from "react";
import { type BarDepthEntry, useBarDepthEntries } from "./bar-depth-context";
import { useChartHover, useChartStable } from "./chart-context";

const BAR_FADED_OPACITY = 0.3;
const BAR_HOVER_TRANSITION = { duration: 0.15, ease: "easeOut" as const };
const PULSE_WAVE_HEIGHT_RATIO = 0.55;
const PULSE_WAVE_HEIGHT_MIN_PX = 36;
const PULSE_WAVE_DURATION_S = 2.4;
const PULSE_WAVE_PEAK_OPACITY = 0.85;

function buildBarSilhouettePath(e: BarDepthEntry): string {
	const {
		bandX,
		bandWidth,
		topY,
		bottomY,
		depth,
		perspectiveRise,
		isRightOfCenter,
	} = e;
	if (depth <= 0) {
		return [
			`M ${bandX} ${topY}`,
			`L ${bandX + bandWidth} ${topY}`,
			`L ${bandX + bandWidth} ${bottomY}`,
			`L ${bandX} ${bottomY}`,
			"Z",
		].join(" ");
	}
	if (isRightOfCenter) {
		// Side face on LEFT — back shifted (-depth, -perspectiveRise).
		return [
			`M ${bandX - depth} ${topY - perspectiveRise}`,
			`L ${bandX + bandWidth - depth} ${topY - perspectiveRise}`,
			`L ${bandX + bandWidth} ${topY}`,
			`L ${bandX + bandWidth} ${bottomY}`,
			`L ${bandX} ${bottomY}`,
			`L ${bandX - depth} ${bottomY - perspectiveRise}`,
			"Z",
		].join(" ");
	}
	// Side face on RIGHT — back shifted (+depth, -perspectiveRise).
	return [
		`M ${bandX} ${topY}`,
		`L ${bandX + depth} ${topY - perspectiveRise}`,
		`L ${bandX + bandWidth + depth} ${topY - perspectiveRise}`,
		`L ${bandX + bandWidth + depth} ${bottomY - perspectiveRise}`,
		`L ${bandX + bandWidth} ${bottomY}`,
		`L ${bandX} ${bottomY}`,
		"Z",
	].join(" ");
}

export interface BarPulseProps {
	/** Key in data for the bar value. Match the sibling `<Bar dataKey>`. */
	dataKey: string;
	/** Index (in the data array) of the bar to pulse. */
	activeIndex?: number;
	/** Suppress the sweep while keeping the bar's 3D + glass treatment. */
	pulsePaused?: boolean;
}

/**
 * Vertical wave that sweeps from a bar's root (baseline) toward its tip on a
 * continuous loop, painted across the bar's full 3D silhouette (front face +
 * lid + visible side). Reads as a heartbeat pulse flowing up the column for
 * positive bars and down for negative bars — useful for marking a live or
 * in-progress value without adding any fixed element.
 *
 * Select the bar via `activeIndex`. Set `pulsePaused` to freeze it. Place
 * AFTER `<BarDepthFront />` so the wave brightens on top of the glass.
 *
 * Performance: at most one clipped `<m.rect>` with a single Y translate
 * per frame (no per-frame paint of gradient stops, no SVG filters).
 */
export function BarPulse({ dataKey, activeIndex, pulsePaused }: BarPulseProps) {
	const reduceMotion = useReducedMotion();
	const { isLoaded } = useChartStable();
	const { hoveredBarIndex } = useChartHover();
	const entries = useBarDepthEntries(dataKey, activeIndex);
	const idPrefix = useId().replace(/[^a-z0-9]/gi, "_");
	const activeEntries = useMemo(
		() => entries.filter((e) => e.isActive),
		[entries]
	);

	if (activeEntries.length === 0 || pulsePaused || reduceMotion) {
		return null;
	}
	// Hold the wave until bars finish growing — the silhouette clip is computed
	// at the final geometry, so painting it mid-grow would reveal a wave inside
	// an area the bar hasn't reached yet.
	if (!isLoaded) {
		return null;
	}

	return (
		<g className="bar-pulse" pointerEvents="none">
			<defs>
				{activeEntries.flatMap((e) => {
					const safeId = e.label.replace(/[^a-z0-9]/gi, "_");
					const clipId = `bar-pulse-clip-${idPrefix}-${safeId}`;
					const gradId = `bar-pulse-grad-${idPrefix}-${safeId}`;
					return [
						<clipPath id={clipId} key={`clip-${safeId}`}>
							<path d={buildBarSilhouettePath(e)} />
						</clipPath>,
						// Vertical gradient with a centered bright band shaped into a soft
						// bell curve. y1=1, y2=0 makes offset 50% the rect's center, so the
						// brightest pixel sits mid-rect during travel.
						<linearGradient
							id={gradId}
							key={`grad-${safeId}`}
							x1="0"
							x2="0"
							y1="1"
							y2="0"
						>
							<stop offset="0%" stopColor="white" stopOpacity="0" />
							<stop offset="10%" stopColor="white" stopOpacity="0" />
							<stop
								offset="22%"
								stopColor="white"
								stopOpacity={PULSE_WAVE_PEAK_OPACITY * 0.18}
							/>
							<stop
								offset="34%"
								stopColor="white"
								stopOpacity={PULSE_WAVE_PEAK_OPACITY * 0.5}
							/>
							<stop
								offset="44%"
								stopColor="white"
								stopOpacity={PULSE_WAVE_PEAK_OPACITY * 0.85}
							/>
							<stop
								offset="50%"
								stopColor="white"
								stopOpacity={PULSE_WAVE_PEAK_OPACITY}
							/>
							<stop
								offset="56%"
								stopColor="white"
								stopOpacity={PULSE_WAVE_PEAK_OPACITY * 0.85}
							/>
							<stop
								offset="66%"
								stopColor="white"
								stopOpacity={PULSE_WAVE_PEAK_OPACITY * 0.5}
							/>
							<stop
								offset="78%"
								stopColor="white"
								stopOpacity={PULSE_WAVE_PEAK_OPACITY * 0.18}
							/>
							<stop offset="90%" stopColor="white" stopOpacity="0" />
							<stop offset="100%" stopColor="white" stopOpacity="0" />
						</linearGradient>,
					];
				})}
			</defs>

			{activeEntries.map((e) => {
				const safeId = e.label.replace(/[^a-z0-9]/gi, "_");
				const clipId = `bar-pulse-clip-${idPrefix}-${safeId}`;
				const gradId = `bar-pulse-grad-${idPrefix}-${safeId}`;

				const waveHeight = Math.max(
					e.barHeight * PULSE_WAVE_HEIGHT_RATIO,
					PULSE_WAVE_HEIGHT_MIN_PX
				);
				// Travel always flows root → tip. Positive bars sweep up (root =
				// bottomY); negative bars sweep down (root = topY, the baseline). The
				// gradient is symmetric, so reversing the endpoints reverses direction.
				const yAboveLid = e.topY - e.perspectiveRise - waveHeight;
				const yBelowFloor = e.bottomY;
				const yStart = e.isNegative ? yAboveLid : yBelowFloor;
				const yEnd = e.isNegative ? yBelowFloor : yAboveLid;

				const isFaded =
					hoveredBarIndex != null && hoveredBarIndex !== e.dataIndex;

				return (
					<m.g
						animate={{ opacity: isFaded ? BAR_FADED_OPACITY : 1 }}
						clipPath={`url(#${clipId})`}
						initial={false}
						key={e.label}
						transition={BAR_HOVER_TRANSITION}
					>
						<m.rect
							animate={{ y: yEnd }}
							fill={`url(#${gradId})`}
							height={waveHeight}
							initial={{ y: yStart }}
							transition={{
								duration: PULSE_WAVE_DURATION_S,
								ease: "easeInOut",
								repeat: Number.POSITIVE_INFINITY,
								repeatType: "loop",
							}}
							// Span wide enough to cover the bar plus its depth on either
							// side; the clipPath crops anything outside the silhouette.
							width={e.bandWidth + 2 * e.depth + 2}
							x={e.bandX - e.depth - 1}
						/>
					</m.g>
				);
			})}
		</g>
	);
}

BarPulse.displayName = "BarPulse";
(BarPulse as { __isBarDepthLayer?: boolean }).__isBarDepthLayer = true;
