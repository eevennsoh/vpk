"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.

import { animate, motion, useMotionValue, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";
import { useLatestRef } from "@/lib/use-latest-ref";
import { useLazyRef } from "@/lib/use-lazy-ref";

const ROVO_GENERATION_GRADIENT =
	"conic-gradient(from 90deg, var(--rovo-generation-stop-orange) 0deg 73deg, var(--rovo-generation-stop-lime) 73deg 168deg, var(--rovo-generation-stop-blue) 168deg 253deg, var(--rovo-generation-stop-purple) 253deg 360deg)";
const ROVO_GENERATION_GRADIENT_TOKENS = {
	"--rovo-generation-stop-orange": "var(--color-orange-300)",
	"--rovo-generation-stop-lime": "var(--color-lime-400)",
	"--rovo-generation-stop-blue": "var(--color-blue-600)",
	"--rovo-generation-stop-purple": "var(--color-purple-500)",
} as CSSProperties;

const LINEAR_EASE: [number, number, number, number] = [0, 0, 1, 1];
const ACTIVE_ROTATION_DURATION = 1.6;
const ACTIVE_STATE_TRANSITION_DURATION = 0.24;
const INACTIVE_STATE_TRANSITION_DURATION = 0.28;

// The highlight is a faithful port of the reference "partial / hinting" perimeter
// shimmer: a comet-like rainbow band travels once around the wrapped surface, fading in
// then dissolving, to signal Rovo is available. Colors reuse the conic-gradient theme vars.
const ROVO_GENERATION_HIGHLIGHT_STOPS = [
	"var(--rovo-generation-stop-orange)",
	"var(--rovo-generation-stop-lime)",
	"var(--rovo-generation-stop-blue)",
	"var(--rovo-generation-stop-purple)",
] as const;

// Shape constants follow the reference RovoPerimeterShimmer. The longer travel time keeps
// the full perimeter lap legible on large suggestion containers.
const HIGHLIGHT_SUBSEGMENTS_PER_COLOR = 8;
const HIGHLIGHT_TOTAL_SEGMENTS = ROVO_GENERATION_HIGHLIGHT_STOPS.length * HIGHLIGHT_SUBSEGMENTS_PER_COLOR;
const HIGHLIGHT_DELAY_MS = 200; // pause before the band enters
const HIGHLIGHT_DURATION_MS = 2400; // one full 12 o'clock-to-12 o'clock perimeter lap
const HIGHLIGHT_BAND_FRAC = 0.35; // band length as a fraction of the perimeter

function highlightEaseInOut(value: number): number {
	const clamped = Math.max(0, Math.min(1, value));
	return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function highlightRoundedRectPath(width: number, height: number, radius: number): string {
	const rr = Math.max(0, Math.min(radius, width / 2, height / 2));
	if (width <= 0 || height <= 0) return "";
	return [
		`M ${width / 2} 0`,
		`L ${width - rr} 0`,
		`A ${rr} ${rr} 0 0 1 ${width} ${rr}`,
		`L ${width} ${height - rr}`,
		`A ${rr} ${rr} 0 0 1 ${width - rr} ${height}`,
		`L ${rr} ${height}`,
		`A ${rr} ${rr} 0 0 1 0 ${height - rr}`,
		`L 0 ${rr}`,
		`A ${rr} ${rr} 0 0 1 ${rr} 0`,
		`L ${width / 2} 0`,
		"Z",
	].join(" ");
}

function highlightRoundedRectPerimeter(width: number, height: number, radius: number): number {
	const rr = Math.max(0, Math.min(radius, width / 2, height / 2));
	return 2 * Math.max(0, width - 2 * rr) + 2 * Math.max(0, height - 2 * rr) + 2 * Math.PI * rr;
}

// Trapezoid envelope along the band length so the head and tail feather to 0 (comet-trail look).
function highlightSpatialEnvelope(position: number): number {
	const FADE_IN_END = 0.18;
	const FADE_OUT_START = 0.82;
	if (position < FADE_IN_END) return highlightEaseInOut(position / FADE_IN_END);
	if (position > FADE_OUT_START) {
		return highlightEaseInOut(1 - (position - FADE_OUT_START) / (1 - FADE_OUT_START));
	}
	return 1;
}

export interface RovoGenerationRootProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
	/** Width and height of the generated tile in pixels. @default 100 */
	size?: number;
	/** Rounded corner radius in pixels. @default 12 */
	radius?: number;
	/** Enable the blurred conic rainbow glow during generation. @default false */
	glow?: boolean;
	/** Enable the conic rainbow border during generation. @default false */
	border?: boolean;
	/** Whether the tile is currently generating. When omitted, enabled effects render statically. */
	generating?: boolean;
	/** Animate the rainbow layers with Motion while generating. @default true */
	animated?: boolean;
	/** Duration of the generating state in seconds. @default 4 */
	duration?: number;
	/** Called after the generating duration elapses. */
	onGenerationComplete?: () => void;
	/** Rainbow border thickness in pixels. @default 1 */
	borderWidth?: number;
	/** Glow blur radius in pixels. @default 16 */
	glowBlur?: number;
	/** Glow opacity from 0 to 1. @default 0.35 */
	glowOpacity?: number;
	/** Additional classes applied to the root element. */
	className?: string;
	/** Inline styles merged onto the root element. */
	style?: CSSProperties;
	children?: ReactNode;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function RovoGenerationGradientLayer({
	active,
	animated,
	opacity,
	className,
	style,
}: Readonly<{
	active: boolean;
	animated: boolean;
	opacity: number;
	className?: string;
	style?: CSSProperties;
}>) {
	const shouldReduceMotion = useReducedMotion();
	const shouldAnimateTransform = animated && !shouldReduceMotion;
	const shouldAnimate = active && shouldAnimateTransform;
	const rotate = useMotionValue(0);
	const fadeForwardControlsRef = useRef<ReturnType<typeof animate> | null>(null);
	const opacityTransition: Transition = {
		opacity: {
			duration: active ? ACTIVE_STATE_TRANSITION_DURATION : INACTIVE_STATE_TRANSITION_DURATION,
			ease: LINEAR_EASE,
		},
	};

	useEffect(() => {
		fadeForwardControlsRef.current?.stop();

		if (!shouldAnimate) return;

		let cancelled = false;

		async function loopRotation() {
			while (!cancelled) {
				await animate(rotate, rotate.get() + 360, {
					duration: ACTIVE_ROTATION_DURATION,
					ease: LINEAR_EASE,
				});

				if (!cancelled) {
					rotate.set(rotate.get() % 360);
				}
			}
		}

		void loopRotation();

		return () => {
			cancelled = true;
			rotate.stop();
			fadeForwardControlsRef.current?.stop();
			fadeForwardControlsRef.current = animate(
				rotate,
				rotate.get() + 360 * (INACTIVE_STATE_TRANSITION_DURATION / ACTIVE_ROTATION_DURATION),
				{
					duration: INACTIVE_STATE_TRANSITION_DURATION,
					ease: LINEAR_EASE,
				},
			);
		};
	}, [rotate, shouldAnimate]);

	return (
		<motion.div
			aria-hidden="true"
			animate={
				active
					? {
							opacity,
						}
					: {
							opacity: 0,
						}
			}
			className={cn("absolute", className)}
			initial={{ opacity: 0 }}
			style={{
				background: ROVO_GENERATION_GRADIENT,
				rotate,
				willChange: shouldAnimateTransform ? "transform" : undefined,
				...style,
			}}
			transition={opacityTransition}
		/>
	);
}

export function RovoGenerationRoot({
	size = 100,
	radius = 12,
	glow = false,
	border = false,
	generating,
	animated = true,
	duration = 4,
	onGenerationComplete,
	borderWidth = 1,
	glowBlur = 16,
	glowOpacity = 0.35,
	className,
	style,
	children,
	...props
}: Readonly<RovoGenerationRootProps>) {
	const normalizedSize = Math.max(24, size);
	const normalizedRadius = Math.max(0, radius);
	const normalizedBorderWidth = clamp(borderWidth, 1, Math.max(1, normalizedSize / 4));
	const normalizedGlowBlur = Math.max(0, glowBlur);
	const normalizedGlowOpacity = clamp(glowOpacity, 0, 1);
	const normalizedDuration = Math.max(0.5, duration);
	const effectsActive = typeof generating === "boolean" ? generating : true;

	useEffect(() => {
		if (!generating || !onGenerationComplete) return;
		const timeoutId = window.setTimeout(onGenerationComplete, normalizedDuration * 1000);
		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [generating, normalizedDuration, onGenerationComplete]);

	return (
		<div
			data-rovo-generation="root"
			data-rovo-generation-border={border ? "true" : "false"}
			data-rovo-generation-generating={effectsActive ? "true" : "false"}
			data-rovo-generation-glow={glow ? "true" : "false"}
			{...props}
			className={cn(
				"relative isolate inline-flex shrink-0 items-center justify-center overflow-visible",
				className,
			)}
			style={{
				"--rovo-generation-size": `${normalizedSize}px`,
				"--rovo-generation-radius": `${normalizedRadius}px`,
				"--rovo-generation-border-width": `${normalizedBorderWidth}px`,
				"--rovo-generation-glow-blur": `${normalizedGlowBlur}px`,
				"--rovo-generation-glow-opacity": normalizedGlowOpacity,
				...ROVO_GENERATION_GRADIENT_TOKENS,
				width: "var(--rovo-generation-size)",
				height: "var(--rovo-generation-size)",
				borderRadius: "var(--rovo-generation-radius)",
				...style,
			} as CSSProperties}
		>
			{glow ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[var(--rovo-generation-radius)]"
					style={{ filter: "blur(var(--rovo-generation-glow-blur))" }}
				>
					<RovoGenerationGradientLayer
						active={effectsActive}
						animated={animated}
						opacity={normalizedGlowOpacity}
						className="inset-0"
					/>
				</div>
			) : null}
			<div className="absolute inset-0 rounded-[var(--rovo-generation-radius)] border border-border bg-surface" />
			{border ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--rovo-generation-radius)]"
				>
					<RovoGenerationGradientLayer
						active={effectsActive}
						animated={animated}
						opacity={1}
						className="left-1/2 top-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2"
					/>
					<div className="absolute rounded-[calc(var(--rovo-generation-radius)-var(--rovo-generation-border-width))] bg-surface inset-[var(--rovo-generation-border-width)]" />
				</div>
			) : null}
			<div className="relative z-10 flex size-full items-center justify-center overflow-hidden rounded-[var(--rovo-generation-radius)]">
				{children}
			</div>
		</div>
	);
}

export interface RovoGenerationHighlightProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
	/** Plays one hinting lap when true. Toggle false → true (or remount via key) to replay. @default true */
	active?: boolean;
	/** Corner radius in pixels. When omitted, inferred from the wrapped child's computed border-radius. */
	radius?: number;
	/** Rainbow stroke thickness in pixels. @default 1 */
	strokeWidth?: number;
	/** Perimeter lap duration in seconds. Larger surfaces default to 2.4 seconds. */
	duration?: number;
	/** Delay before the perimeter lap, in seconds. @default 0.2 */
	delay?: number;
	/** Change this token to retrace without remounting the wrapped content. */
	playToken?: number;
	/** Called once the band finishes traveling and dissolves. */
	onHighlightComplete?: () => void;
	/** Additional classes applied to the wrapper element. */
	className?: string;
	children?: ReactNode;
}

function useAutoRadius(ref: RefObject<HTMLElement | null>, radiusProp: number | undefined): number {
	const [autoRadius, setAutoRadius] = useState<number>(radiusProp ?? 12);

	useLayoutEffect(() => {
		if (radiusProp !== undefined) {
			setAutoRadius(radiusProp);
			return;
		}
		const firstChild = ref.current?.firstElementChild as HTMLElement | null;
		if (!firstChild) return;
		const parsed = Number.parseFloat(window.getComputedStyle(firstChild).borderRadius);
		if (!Number.isNaN(parsed)) setAutoRadius(parsed);
	}, [radiusProp, ref]);

	return radiusProp ?? autoRadius;
}

export function RovoGenerationHighlight({
	active = true,
	radius,
	strokeWidth = 1,
	duration = HIGHLIGHT_DURATION_MS / 1000,
	delay = HIGHLIGHT_DELAY_MS / 1000,
	playToken,
	onHighlightComplete,
	className,
	style,
	children,
	...props
}: Readonly<RovoGenerationHighlightProps>) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const resolvedRadius = useAutoRadius(wrapperRef, radius);
	const shouldReduceMotion = useReducedMotion() ?? false;
	const pathRefs = useLazyRef<(SVGPathElement | null)[]>(
		() => Array.from({ length: HIGHLIGHT_TOTAL_SEGMENTS }, () => null),
	);
	const onCompleteRef = useLatestRef(onHighlightComplete);

	const normalizedStroke = Math.max(0.5, strokeWidth);
	const normalizedDurationMs = Math.max(0.001, duration) * 1000;
	const normalizedDelayMs = Math.max(0, delay) * 1000;

	// Imperative rAF loop ported from the reference RovoPerimeterShimmer: a single rainbow
	// band sweeps once around the perimeter, fading in then dissolving. Driving the 32 path
	// slices via setAttribute keeps it off the React render path (no per-frame re-render).
	useEffect(() => {
		const wrapper = wrapperRef.current;
		if (!active || !wrapper) return;

		const paths = pathRefs.current;

		if (shouldReduceMotion) {
			for (const path of paths) path?.setAttribute("opacity", "0");
			onCompleteRef.current?.();
			return;
		}

		let raf = 0;
		let startTime = 0;

		const tick = (now: number) => {
			if (!startTime) startTime = now;

			const stroke = normalizedStroke;
			const width = Math.max(0, wrapper.offsetWidth - stroke);
			const height = Math.max(0, wrapper.offsetHeight - stroke);
			const cornerRadius = Math.max(0, Math.min(resolvedRadius - stroke / 2, width / 2, height / 2));
			const pathData = highlightRoundedRectPath(width, height, cornerRadius);
			const perimeter = highlightRoundedRectPerimeter(width, height, cornerRadius);

			for (const path of paths) path?.setAttribute("d", pathData);

			const elapsed = now - startTime - normalizedDelayMs;
			if (elapsed < 0) {
				for (const path of paths) path?.setAttribute("opacity", "0");
				raf = requestAnimationFrame(tick);
				return;
			}

			const progress = Math.min(1, elapsed / normalizedDurationMs);
			const eased = highlightEaseInOut(progress);

			const bandWidth = perimeter * HIGHLIGHT_BAND_FRAC;
			const head = -bandWidth + eased * (perimeter + bandWidth);
			const visStart = Math.max(0, head);
			const visEnd = Math.min(perimeter, head + bandWidth);
			const visLen = Math.max(0, visEnd - visStart);

			// Temporal envelope: fade the whole band in over the first 14% and out over the last 14%.
			const FADE_IN_END = 0.14;
			const FADE_OUT_START = 0.86;
			let timeEnv = 1;
			if (progress < FADE_IN_END) timeEnv = highlightEaseInOut(progress / FADE_IN_END);
			else if (progress > FADE_OUT_START) {
				timeEnv = highlightEaseInOut(1 - (progress - FADE_OUT_START) / (1 - FADE_OUT_START));
			}

			const subSegLen = visLen / HIGHLIGHT_TOTAL_SEGMENTS;
			const gap = perimeter + 1;

			for (let k = 0; k < HIGHLIGHT_TOTAL_SEGMENTS; k++) {
				const path = paths[k];
				if (!path) continue;
				const segStart = visStart + (k / HIGHLIGHT_TOTAL_SEGMENTS) * visLen;
				const segCentre = (k + 0.5) / HIGHLIGHT_TOTAL_SEGMENTS;
				const spatialEnv = highlightSpatialEnvelope(segCentre);
				path.setAttribute("stroke-dasharray", `${subSegLen.toFixed(3)} ${gap.toFixed(1)}`);
				path.setAttribute("stroke-dashoffset", `${(-segStart).toFixed(3)}`);
				path.setAttribute("opacity", visLen > 0.01 ? (timeEnv * spatialEnv).toFixed(3) : "0");
			}

			if (progress < 1) {
				raf = requestAnimationFrame(tick);
			} else {
				for (const path of paths) path?.setAttribute("opacity", "0");
				onCompleteRef.current?.();
			}
		};

		raf = requestAnimationFrame(tick);
		return () => {
			if (raf) cancelAnimationFrame(raf);
		};
	}, [active, normalizedDelayMs, normalizedDurationMs, normalizedStroke, onCompleteRef, pathRefs, playToken, resolvedRadius, shouldReduceMotion]);

	return (
		<div
			data-rovo-generation="highlight"
			data-rovo-generation-active={active ? "true" : "false"}
			{...props}
			ref={wrapperRef}
			className={cn("relative inline-block", className)}
			style={{ ...ROVO_GENERATION_GRADIENT_TOKENS, ...style }}
		>
			{children}
			{active ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0"
					style={{ overflow: "visible" }}
				>
					<svg
						width="100%"
						height="100%"
						style={{
							position: "absolute",
							left: 0,
							top: 0,
							overflow: "visible",
							transform: `translate(${normalizedStroke / 2}px, ${normalizedStroke / 2}px)`,
						}}
					>
						{Array.from({ length: HIGHLIGHT_TOTAL_SEGMENTS }).map((_, k) => {
							const colorIndex = Math.floor(k / HIGHLIGHT_SUBSEGMENTS_PER_COLOR);
							return (
								<path
									key={k}
									ref={(element) => {
										pathRefs.current[k] = element;
									}}
									fill="none"
									opacity={0}
									stroke={ROVO_GENERATION_HIGHLIGHT_STOPS[colorIndex]}
									strokeLinecap="butt"
									strokeLinejoin="round"
									strokeWidth={normalizedStroke}
								/>
							);
						})}
					</svg>
				</div>
			) : null}
		</div>
	);
}
