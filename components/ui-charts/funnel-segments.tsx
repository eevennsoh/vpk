"use client";

import type { Transition } from "motion/react";
import { m, useTransform } from "motion/react";
import type { ReactNode } from "react";
import type { FunnelGradientStop } from "./funnel-chart";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";

/**
 * Builds a single segment path for one stage in the funnel.
 * Each segment is a smooth trapezoid-like shape transitioning from
 * the height of the current norm to the next norm.
 */
function hSegmentPath(
	normStart: number,
	normEnd: number,
	segW: number,
	H: number,
	layerScale: number,
	straight = false
) {
	const my = H / 2;
	const h0 = normStart * H * 0.44 * layerScale;
	const h1 = normEnd * H * 0.44 * layerScale;

	if (straight) {
		return `M 0 ${my - h0} L ${segW} ${my - h1} L ${segW} ${my + h1} L 0 ${my + h0} Z`;
	}

	const cx = segW * 0.55;
	const top = `M 0 ${my - h0} C ${cx} ${my - h0}, ${segW - cx} ${my - h1}, ${segW} ${my - h1}`;
	const bot = `L ${segW} ${my + h1} C ${segW - cx} ${my + h1}, ${cx} ${my + h0}, 0 ${my + h0}`;
	return `${top} ${bot} Z`;
}

function vSegmentPath(
	normStart: number,
	normEnd: number,
	segH: number,
	W: number,
	layerScale: number,
	straight = false
) {
	const mx = W / 2;
	const w0 = normStart * W * 0.44 * layerScale;
	const w1 = normEnd * W * 0.44 * layerScale;

	if (straight) {
		return `M ${mx - w0} 0 L ${mx - w1} ${segH} L ${mx + w1} ${segH} L ${mx + w0} 0 Z`;
	}

	const cy = segH * 0.55;
	const left = `M ${mx - w0} 0 C ${mx - w0} ${cy}, ${mx - w1} ${segH - cy}, ${mx - w1} ${segH}`;
	const right = `L ${mx + w1} ${segH} C ${mx + w1} ${segH - cy}, ${mx + w0} ${cy}, ${mx + w0} 0`;
	return `${left} ${right} Z`;
}

// ─── Animated Segment ───────────────────────────────────────────────

function HRing({
	d,
	color,
	fill,
	opacity,
	hovered,
	ringIndex,
	totalRings,
}: {
	d: string;
	color: string;
	fill?: string;
	opacity: number;
	hovered: boolean;
	ringIndex: number;
	totalRings: number;
}) {
	const extraScale = 1 + (ringIndex / Math.max(totalRings - 1, 1)) * 0.12;

	return (
		<m.path
			animate={{ scaleY: hovered ? extraScale : 1 }}
			d={d}
			fill={fill ?? color}
			opacity={opacity}
			style={{ transformOrigin: "center center" }}
			transition={{
				type: "spring",
				stiffness: 300 - ringIndex * 60,
				damping: 24 - ringIndex * 3,
			}}
		/>
	);
}

export function HSegment({
	index,
	normStart,
	normEnd,
	segW,
	fullH,
	color,
	layers,
	staggerDelay,
	enterTransition,
	hovered,
	dimmed,
	renderPattern,
	straight,
	gradientStops,
}: {
	index: number;
	normStart: number;
	normEnd: number;
	segW: number;
	fullH: number;
	color: string;
	layers: number;
	staggerDelay: number;
	enterTransition?: Transition;
	hovered: boolean;
	dimmed: boolean;
	renderPattern?: (id: string, color: string) => ReactNode;
	straight: boolean;
	gradientStops?: FunnelGradientStop[];
}) {
	const patternId = `funnel-h-pattern-${index}`;
	const gradientId = `funnel-h-grad-${index}`;
	const mountProgress = useMountProgress(
		enterTransition,
		index * staggerDelay,
		index
	);
	const enterComplete = useEnterComplete(mountProgress);
	const entranceScaleX = useTransform(mountProgress, [0, 1], [0, 1]);
	const entranceScaleY = useTransform(mountProgress, [0, 1], [0, 1]);

	const rings = Array.from({ length: layers }, (_, l) => {
		const scale = 1 - (l / layers) * 0.35;
		const opacity = 0.18 + (l / (layers - 1 || 1)) * 0.65;
		return {
			d: hSegmentPath(normStart, normEnd, segW, fullH, scale, straight),
			opacity,
		};
	});

	return (
		<m.div
			animate={{ opacity: dimmed ? 0.4 : 1 }}
			className="pointer-events-none relative shrink-0 overflow-visible"
			style={{
				width: segW,
				height: fullH,
				zIndex: hovered ? 10 : 1,
			}}
			transition={{ opacity: { duration: 0.15 } }}
		>
			{enterComplete ? (
				<div className="absolute inset-0 overflow-visible">
					<svg
						aria-hidden="true"
						className="absolute inset-0 h-full w-full overflow-visible"
						preserveAspectRatio="none"
						role="presentation"
						viewBox={`0 0 ${segW} ${fullH}`}
					>
						<defs>
							{gradientStops ? (
								<linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
									{gradientStops.map((stop) => (
										<stop
											key={`${stop.offset}-${stop.color}`}
											offset={
												typeof stop.offset === "number"
													? `${stop.offset * 100}%`
													: stop.offset
											}
											stopColor={stop.color}
										/>
									))}
								</linearGradient>
							) : null}
							{renderPattern?.(patternId, color)}
						</defs>
						{rings.map((r, i) => {
							const isInnermost = i === rings.length - 1;
							let ringFill: string | undefined;
							if (isInnermost && renderPattern) {
								ringFill = `url(#${patternId})`;
							} else if (isInnermost && gradientStops) {
								ringFill = `url(#${gradientId})`;
							}
							const ringKey = `h-ring-${r.opacity.toFixed(2)}`;
							return (
								<HRing
									color={color}
									d={r.d}
									fill={ringFill}
									hovered={hovered}
									key={ringKey}
									opacity={r.opacity}
									ringIndex={i}
									totalRings={layers}
								/>
							);
						})}
					</svg>
				</div>
			) : (
				<m.div
					className="absolute inset-0 overflow-visible"
					style={{
						scaleX: entranceScaleX,
						scaleY: entranceScaleY,
						transformOrigin: "left center",
					}}
				>
					<svg
						aria-hidden="true"
						className="absolute inset-0 h-full w-full overflow-visible"
						preserveAspectRatio="none"
						role="presentation"
						viewBox={`0 0 ${segW} ${fullH}`}
					>
						<defs>
							{gradientStops ? (
								<linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
									{gradientStops.map((stop) => (
										<stop
											key={`${stop.offset}-${stop.color}`}
											offset={
												typeof stop.offset === "number"
													? `${stop.offset * 100}%`
													: stop.offset
											}
											stopColor={stop.color}
										/>
									))}
								</linearGradient>
							) : null}
							{renderPattern?.(patternId, color)}
						</defs>
						{rings.map((r, i) => {
							const isInnermost = i === rings.length - 1;
							let ringFill: string | undefined;
							if (isInnermost && renderPattern) {
								ringFill = `url(#${patternId})`;
							} else if (isInnermost && gradientStops) {
								ringFill = `url(#${gradientId})`;
							}
							const ringKey = `h-ring-${r.opacity.toFixed(2)}`;
							return (
								<HRing
									color={color}
									d={r.d}
									fill={ringFill}
									hovered={hovered}
									key={ringKey}
									opacity={r.opacity}
									ringIndex={i}
									totalRings={layers}
								/>
							);
						})}
					</svg>
				</m.div>
			)}
		</m.div>
	);
}

function VRing({
	d,
	color,
	fill,
	opacity,
	hovered,
	ringIndex,
	totalRings,
}: {
	d: string;
	color: string;
	fill?: string;
	opacity: number;
	hovered: boolean;
	ringIndex: number;
	totalRings: number;
}) {
	const extraScale = 1 + (ringIndex / Math.max(totalRings - 1, 1)) * 0.12;

	return (
		<m.path
			animate={{ scaleX: hovered ? extraScale : 1 }}
			d={d}
			fill={fill ?? color}
			opacity={opacity}
			style={{ transformOrigin: "center center" }}
			transition={{
				type: "spring",
				stiffness: 300 - ringIndex * 60,
				damping: 24 - ringIndex * 3,
			}}
		/>
	);
}

export function VSegment({
	index,
	normStart,
	normEnd,
	segH,
	fullW,
	color,
	layers,
	staggerDelay,
	enterTransition,
	hovered,
	dimmed,
	renderPattern,
	straight,
	gradientStops,
}: {
	index: number;
	normStart: number;
	normEnd: number;
	segH: number;
	fullW: number;
	color: string;
	layers: number;
	staggerDelay: number;
	enterTransition?: Transition;
	hovered: boolean;
	dimmed: boolean;
	renderPattern?: (id: string, color: string) => ReactNode;
	straight: boolean;
	gradientStops?: FunnelGradientStop[];
}) {
	const patternId = `funnel-v-pattern-${index}`;
	const gradientId = `funnel-v-grad-${index}`;
	const mountProgress = useMountProgress(
		enterTransition,
		index * staggerDelay,
		index
	);
	const enterComplete = useEnterComplete(mountProgress);
	const entranceScaleY = useTransform(mountProgress, [0, 1], [0, 1]);
	const entranceScaleX = useTransform(mountProgress, [0, 1], [0, 1]);

	const rings = Array.from({ length: layers }, (_, l) => {
		const scale = 1 - (l / layers) * 0.35;
		const opacity = 0.18 + (l / (layers - 1 || 1)) * 0.65;
		return {
			d: vSegmentPath(normStart, normEnd, segH, fullW, scale, straight),
			opacity,
		};
	});

	return (
		<m.div
			animate={{ opacity: dimmed ? 0.4 : 1 }}
			className="pointer-events-none relative shrink-0 overflow-visible"
			style={{
				width: fullW,
				height: segH,
				zIndex: hovered ? 10 : 1,
			}}
			transition={{ opacity: { duration: 0.15 } }}
		>
			{enterComplete ? (
				<div className="absolute inset-0 overflow-visible">
					<svg
						aria-hidden="true"
						className="absolute inset-0 h-full w-full overflow-visible"
						preserveAspectRatio="none"
						role="presentation"
						viewBox={`0 0 ${fullW} ${segH}`}
					>
						<defs>
							{gradientStops ? (
								<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
									{gradientStops.map((stop) => (
										<stop
											key={`${stop.offset}-${stop.color}`}
											offset={
												typeof stop.offset === "number"
													? `${stop.offset * 100}%`
													: stop.offset
											}
											stopColor={stop.color}
										/>
									))}
								</linearGradient>
							) : null}
							{renderPattern?.(patternId, color)}
						</defs>
						{rings.map((r, i) => {
							const isInnermost = i === rings.length - 1;
							let ringFill: string | undefined;
							if (isInnermost && renderPattern) {
								ringFill = `url(#${patternId})`;
							} else if (isInnermost && gradientStops) {
								ringFill = `url(#${gradientId})`;
							}
							const ringKey = `v-ring-${r.opacity.toFixed(2)}`;
							return (
								<VRing
									color={color}
									d={r.d}
									fill={ringFill}
									hovered={hovered}
									key={ringKey}
									opacity={r.opacity}
									ringIndex={i}
									totalRings={layers}
								/>
							);
						})}
					</svg>
				</div>
			) : (
				<m.div
					className="absolute inset-0 overflow-visible"
					style={{
						scaleY: entranceScaleY,
						scaleX: entranceScaleX,
						transformOrigin: "center top",
					}}
				>
					<svg
						aria-hidden="true"
						className="absolute inset-0 h-full w-full overflow-visible"
						preserveAspectRatio="none"
						role="presentation"
						viewBox={`0 0 ${fullW} ${segH}`}
					>
						<defs>
							{gradientStops ? (
								<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
									{gradientStops.map((stop) => (
										<stop
											key={`${stop.offset}-${stop.color}`}
											offset={
												typeof stop.offset === "number"
													? `${stop.offset * 100}%`
													: stop.offset
											}
											stopColor={stop.color}
										/>
									))}
								</linearGradient>
							) : null}
							{renderPattern?.(patternId, color)}
						</defs>
						{rings.map((r, i) => {
							const isInnermost = i === rings.length - 1;
							let ringFill: string | undefined;
							if (isInnermost && renderPattern) {
								ringFill = `url(#${patternId})`;
							} else if (isInnermost && gradientStops) {
								ringFill = `url(#${gradientId})`;
							}
							const ringKey = `v-ring-${r.opacity.toFixed(2)}`;
							return (
								<VRing
									color={color}
									d={r.d}
									fill={ringFill}
									hovered={hovered}
									key={ringKey}
									opacity={r.opacity}
									ringIndex={i}
									totalRings={layers}
								/>
							);
						})}
					</svg>
				</m.div>
			)}
		</m.div>
	);
}
