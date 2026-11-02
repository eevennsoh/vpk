"use client";

// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.

/**
 * TWG Loader — Teamwork Graph branded loading indicator.
 *
 * A four-dot logo that bursts out from the center, then continuously draws a
 * multi-color "snake" between the dots, rotating between patterns. Mirrors the
 * public size API of `@atlaskit/spinner` so it can be a drop-in replacement at
 * existing call sites.
 *
 * Ported from the Atlassian Teamwork Graph microsite `LoadingSpinner`. The SVG
 * is rendered once and updated imperatively from a `requestAnimationFrame` loop
 * to avoid re-rendering React 60 times/sec.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import {
	BURST_DURATION_S,
	computeFrame,
	computeStaticFrame,
	DOT_ORDER,
	DOT_RADIUS,
	DRAW_PATTERNS,
	type DotPosition,
	type FrameState,
	getDotColors,
	getDotPositions,
	getLineColor,
	getRestPositions,
	HIDDEN_DASH,
	LINE_WIDTH,
	type TWGLoaderSize,
	MAX_LINE_COUNT,
	NODE_STROKE_WIDTH,
	REST_PATTERN,
	type Segment,
	SIZE_PX,
	SPREAD_RADIUS,
	updateDots,
	updateLines,
	VIEWBOX_SIZE,
} from "./utils";

export type { TWGLoaderSize } from "./utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** SSR-safe `prefers-reduced-motion: reduce` media query hook. */
function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);

	useEffect(() => {
		const mql = window.matchMedia(REDUCED_MOTION_QUERY);
		const update = () => setReduced(mql.matches);
		update();
		mql.addEventListener("change", update);
		return () => mql.removeEventListener("change", update);
	}, []);

	return reduced;
}

export interface TWGLoaderProps {
	/**
	 * Visual size. Mirrors `@atlaskit/spinner`.
	 *
	 * @default 'medium'
	 */
	size?: TWGLoaderSize;
	/**
	 * Accessible label announced to assistive technology while the logo is
	 * spinning.
	 *
	 * @default 'Loading'
	 */
	label?: string;
	/** Additional classes applied to the wrapping element. */
	className?: string;
	/**
	 * Draws the branded snake while true. When false, the rings ease into a
	 * static graph in the subtle icon color and the loop stops. Loading again
	 * eases them back into the snake.
	 *
	 * @default true
	 */
	active?: boolean;
	/** Optional test id applied to the wrapping element. */
	testId?: string;
}

const REST_STROKE = "var(--color-icon-subtle)";
const STROKE_TRANSITION = "stroke var(--duration-medium) var(--ease-in-out)";

/** `motionEase.inOut` sampled at `t`. Position morphs use the same curve as the stroke. */
function easeInOut(t: number): number {
	const [x1, y1, x2, y2] = motionEase.inOut;
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
	const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
	const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
	let u = t;
	for (let i = 0; i < 6; i += 1) {
		const dx = slopeX(u);
		if (Math.abs(dx) < 1e-6) break;
		u -= (sampleX(u) - t) / dx;
	}
	return sampleY(Math.min(1, Math.max(0, u)));
}

export function TWGLoader({
	size = "medium",
	label = "Loading",
	className,
	active = true,
	testId,
}: Readonly<TWGLoaderProps>) {
	const sizePx = SIZE_PX[size];
	const reducedMotion = usePrefersReducedMotion();
	const instanceId = useId().replaceAll(":", "");
	const holesMaskId = `twg-loader-holes-${instanceId}`;

	// Dot ring colors render as CSS variables with fallbacks so SSR and client
	// hydration see the same attribute strings while the browser resolves theme.
	const dotColors = getDotColors();
	const lineColor = getLineColor();

	const svgRef = useRef<SVGSVGElement>(null);
	const positionsRef = useRef<DotPosition[] | null>(null);

	useLayoutEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;

		let rafId = 0;
		let cancelled = false;

		const paint = (
			positions: readonly DotPosition[],
			pattern: readonly Segment[],
			drawFrac: number,
			retractFrac: number,
		) => {
			updateDots(svg, positions);
			updateLines(svg, positions, pattern, drawFrac, retractFrac);
			positionsRef.current = positions.map((position) => ({ ...position }));
		};

		const paintFrame = ({ positions, drawFrac, retractFrac, patternIndex }: FrameState) => {
			paint(positions, DRAW_PATTERNS[patternIndex] ?? DRAW_PATTERNS[0], drawFrac, retractFrac);
		};

		const settle = (
			to: readonly DotPosition[],
			pattern: readonly Segment[],
			drawFrac: number,
			onDone?: () => void,
		) => {
			const from = positionsRef.current ?? getDotPositions(0, 0);
			if (reducedMotion) {
				paint(to, pattern, drawFrac, 0);
				onDone?.();
				return;
			}
			const started = performance.now();
			const duration = motionDuration.medium * 1000;
			const step = (now: number) => {
				if (cancelled) return;
				const raw = Math.min(1, (now - started) / duration);
				const progress = easeInOut(raw);
				paint(
					from.map((position, index) => ({
						x: position.x + ((to[index]?.x ?? position.x) - position.x) * progress,
						y: position.y + ((to[index]?.y ?? position.y) - position.y) * progress,
					})),
					pattern,
					drawFrac,
					0,
				);
				if (raw < 1) rafId = requestAnimationFrame(step);
				else onDone?.();
			};
			rafId = requestAnimationFrame(step);
		};

		const loop = (initialElapsed: number) => {
			if (reducedMotion) {
				paintFrame(computeStaticFrame());
				return;
			}
			let startTime = 0;
			const tick = (timestamp: number) => {
				if (cancelled) return;
				if (!startTime) startTime = timestamp - initialElapsed * 1000;
				paintFrame(computeFrame((timestamp - startTime) / 1000));
				rafId = requestAnimationFrame(tick);
			};
			rafId = requestAnimationFrame(tick);
		};

		if (!active) {
			if (positionsRef.current && !reducedMotion) settle(getRestPositions(), REST_PATTERN, 1);
			else paint(getRestPositions(), REST_PATTERN, 1, 0);
		} else if (positionsRef.current && !reducedMotion) {
			settle(getDotPositions(SPREAD_RADIUS, 0), REST_PATTERN, 1, () => {
				if (!cancelled) loop(BURST_DURATION_S);
			});
		} else {
			loop(0);
		}

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
		};
	}, [active, reducedMotion]);

	return (
		<output
			data-slot="twg-loader"
			data-state={active ? "loading" : "resting"}
			aria-label={label}
			data-testid={testId}
			className={cn("inline-flex leading-[0]", className)}
		>
			<svg
				ref={svgRef}
				width={sizePx}
				height={sizePx}
				viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
				fill="none"
				aria-hidden="true"
				focusable="false"
			>
				<defs>
					<mask
						id={holesMaskId}
						maskUnits="userSpaceOnUse"
						x="0"
						y="0"
						width={VIEWBOX_SIZE}
						height={VIEWBOX_SIZE}
					>
						<rect
							width={VIEWBOX_SIZE}
							height={VIEWBOX_SIZE}
							fill="white"
						/>
						{DOT_ORDER.map((i) => (
							<circle
								key={`mask-${i}`}
								data-type="mask"
								data-idx={i}
								r={DOT_RADIUS}
								fill="black"
							/>
						))}
					</mask>
				</defs>

				{/* Snake / connector lines. Masked so they stop at each ring. */}
				<g mask={`url(#${holesMaskId})`}>
					{Array.from({ length: MAX_LINE_COUNT }, (_, i) => (
						<path
							key={`line-${i}`}
							id={`line-${i}`}
							stroke={lineColor}
							strokeWidth={LINE_WIDTH}
							strokeLinecap="butt"
							fill="none"
							strokeDasharray={HIDDEN_DASH}
							style={{
								stroke: active ? lineColor : REST_STROKE,
								transition: reducedMotion ? undefined : STROKE_TRANSITION,
							}}
						/>
					))}
				</g>

				{/* Dot rings — stroke only, interiors stay transparent. */}
				<g>
					{DOT_ORDER.map((i) => (
						<circle
							key={`dot-${i}`}
							data-type="dot"
							data-idx={i}
							r={DOT_RADIUS}
							fill="none"
							stroke={dotColors[i]}
							strokeWidth={NODE_STROKE_WIDTH}
							style={{
								stroke: active ? dotColors[i] : REST_STROKE,
								transition: reducedMotion ? undefined : STROKE_TRANSITION,
							}}
						/>
					))}
				</g>
			</svg>
		</output>
	);
}

export default TWGLoader;
