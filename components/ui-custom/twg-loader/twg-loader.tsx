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

import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { motionDuration, motionEase } from "@/lib/motion";
import { cn, lerp } from "@/lib/utils";

import {
	BURST_DURATION_S,
	computeFrame,
	cubicBezierEase,
	DOT_ORDER,
	DOT_RADIUS,
	DRAW_PATTERNS,
	getDotColors,
	getDotPositions,
	getLineColor,
	getRestPattern,
	HIDDEN_DASH,
	INITIAL_REST_ROTATION,
	LINE_WIDTH,
	type TWGLoaderSize,
	MAX_LINE_COUNT,
	nextForwardAngle,
	NODE_STROKE_WIDTH,
	planForwardTurn,
	REST_RADIUS,
	REST_ROTATION_PERIOD,
	REST_ROTATION_PHASE,
	ROTATION_AMOUNT_RAD,
	type Segment,
	SIZE_PX,
	SPREAD_RADIUS,
	turnRotationAt,
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
	 * Draws the branded snake while true. When false, the rings keep turning
	 * clockwise and slow into a static square in the subtle icon color. Loading
	 * again turns them onward into the snake. Neither change turns back.
	 *
	 * @default true
	 */
	active?: boolean;
	/** Optional test id applied to the wrapping element. */
	testId?: string;
}

const REST_STROKE = "var(--color-icon-subtle)";
const STROKE_TRANSITION = "stroke var(--duration-medium) var(--ease-in-out)";
const easeInOut = cubicBezierEase(motionEase.inOut);
/** Turns into and out of rest take one loop rotation step. */
const TURN_DURATION_MS = motionDuration.slower * 1000;
/** Shortest turn into or out of rest, so a state change always reads as one forward step. */
const MIN_TURN_TRAVEL = ROTATION_AMOUNT_RAD / 2;
/** Older samples than this mean the mark was standing still. */
const VELOCITY_WINDOW_MS = 50;
const NO_LINES: readonly Segment[] = [];
const ROTOR_STYLE = { transformBox: "view-box", transformOrigin: "50% 50%" } as const satisfies CSSProperties;

/** Everything painted for one frame. `rotation` only ever grows, so the mark never turns back. */
type Pose = {
	rotation: number;
	spread: number;
	pattern: readonly Segment[];
	drawFrac: number;
	retractFrac: number;
};

type PaintedPose = Pose & { velocity: number; at: number };

/** Snake head and tail `t` of the way to fully retracted. */
function retractLines(pose: Pose, t: number): Pick<Pose, "drawFrac" | "retractFrac"> {
	if (pose.drawFrac < 0) return { drawFrac: -1, retractFrac: 0 };
	return { drawFrac: pose.drawFrac, retractFrac: lerp(pose.retractFrac, pose.drawFrac, t) };
}

function restPose(rotation: number): Pose {
	return { rotation, spread: REST_RADIUS, pattern: getRestPattern(rotation), drawFrac: 1, retractFrac: 0 };
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
	const rotorRef = useRef<SVGGElement>(null);
	const poseRef = useRef<PaintedPose | null>(null);

	useLayoutEffect(() => {
		const svg = svgRef.current;
		const rotor = rotorRef.current;
		if (!svg || !rotor) return;

		let rafId = 0;
		let cancelled = false;

		const paint = (pose: Pose, at = performance.now()) => {
			const previous = poseRef.current;
			const elapsedMs = previous ? at - previous.at : 0;
			const velocity = !previous || elapsedMs >= VELOCITY_WINDOW_MS
				? 0
				: elapsedMs > 0
					? ((pose.rotation - previous.rotation) / elapsedMs) * 1000
					: previous.velocity;
			rotor.style.transform = `rotate(${(pose.rotation * 180) / Math.PI}deg)`;
			const positions = getDotPositions(pose.spread, 0);
			updateDots(svg, positions);
			updateLines(svg, positions, pose.pattern, pose.drawFrac, pose.retractFrac);
			poseRef.current = { ...pose, velocity, at };
		};

		const loop = (baseRotation: number, initialElapsed: number) => {
			const paintAt = (elapsed: number, at?: number) => {
				const frame = computeFrame(elapsed);
				paint({
					rotation: baseRotation + frame.rotation,
					spread: frame.spread,
					pattern: DRAW_PATTERNS[frame.patternIndex] ?? DRAW_PATTERNS[0],
					drawFrac: frame.drawFrac,
					retractFrac: frame.retractFrac,
				}, at);
			};
			let startTime = 0;
			const tick = (timestamp: number) => {
				if (cancelled) return;
				if (!startTime) startTime = timestamp - initialElapsed * 1000;
				paintAt((timestamp - startTime) / 1000, timestamp);
				rafId = requestAnimationFrame(tick);
			};
			if (!poseRef.current) paintAt(initialElapsed);
			rafId = requestAnimationFrame(tick);
		};

		/** Turn clockwise from the last painted pose onto the next angle in `period` steps from `phase`. */
		const turn = (
			from: PaintedPose,
			period: number,
			phase: number,
			poseAt: (t: number, rotation: number, to: number) => Pose,
			onDone?: (rotation: number) => void,
		) => {
			const startedAt = performance.now();
			const plan = planForwardTurn({
				from: from.rotation,
				velocity: startedAt - from.at < VELOCITY_WINDOW_MS ? from.velocity : 0,
				duration: TURN_DURATION_MS / 1000,
				period,
				phase,
				minTravel: MIN_TURN_TRAVEL,
			});
			const step = (now: number) => {
				if (cancelled) return;
				const t = Math.min(1, Math.max(0, (now - startedAt) / TURN_DURATION_MS));
				paint(poseAt(t, turnRotationAt(plan, t, easeInOut), plan.to), now);
				if (t < 1) rafId = requestAnimationFrame(step);
				else onDone?.(plan.to);
			};
			rafId = requestAnimationFrame(step);
		};

		const current = poseRef.current;
		if (reducedMotion) {
			const rotation = nextForwardAngle(current?.rotation ?? INITIAL_REST_ROTATION, 0, REST_ROTATION_PERIOD, REST_ROTATION_PHASE);
			paint(active ? { ...restPose(rotation), pattern: NO_LINES, drawFrac: -1 } : restPose(rotation));
		} else if (!current) {
			if (active) loop(0, 0);
			else paint(restPose(INITIAL_REST_ROTATION));
		} else if (active) {
			turn(
				current,
				ROTATION_AMOUNT_RAD,
				0,
				(t, rotation) => ({
					rotation,
					spread: lerp(current.spread, SPREAD_RADIUS, easeInOut(t)),
					pattern: current.pattern,
					...retractLines(current, easeInOut(t)),
				}),
				(rotation) => loop(rotation, BURST_DURATION_S),
			);
		} else {
			turn(current, REST_ROTATION_PERIOD, REST_ROTATION_PHASE, (t, rotation, to) => {
				const spread = lerp(current.spread, REST_RADIUS, easeInOut(t));
				if (t < 0.5) return { rotation, spread, pattern: current.pattern, ...retractLines(current, easeInOut(t * 2)) };
				return { rotation, spread, pattern: getRestPattern(to), drawFrac: easeInOut(t * 2 - 1), retractFrac: 0 };
			});
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

				<g ref={rotorRef} data-twg-rotor="" style={ROTOR_STYLE}>
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
				</g>
			</svg>
		</output>
	);
}

export default TWGLoader;
