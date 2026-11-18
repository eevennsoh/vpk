"use client";

// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.

import { motion, useMotionValue, useTransform, animate, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Path interpolation helper
// ---------------------------------------------------------------------------

/**
 * Lightweight numeric interpolation for SVG path strings that share
 * identical command structure (same letters, same number count).
 * Replaces flubber by simply lerping every numeric value in the string.
 */
function lerpPaths(pathA: string, pathB: string): (t: number) => string {
	const numsA = pathA.match(/-?[\d.]+/g)?.map(Number) ?? [];
	const numsB = pathB.match(/-?[\d.]+/g)?.map(Number) ?? [];
	if (numsA.length === 0 || numsA.length !== numsB.length) {
		return () => pathA;
	}

	return (t: number) => {
		let i = 0;
		return pathA.replace(/-?[\d.]+/g, () => {
			const val = numsA[i] + (numsB[i] - numsA[i]) * t;
			i++;
			return val.toFixed(2);
		});
	};
}

// ---------------------------------------------------------------------------
// Compatible SVG paths — 6 cubic bezier segments each
// All shapes in a 32×32 viewBox, centered at (16, 16)
// Structure: M + 6×C + Z (identical command sequence)
// ---------------------------------------------------------------------------

// All shapes are normalized to a square footprint derived from an
// equidistant regular hexagon so every morph stays constrained to the same
// 1:1 ratio inside the 32×32 viewBox.
// Shared vertices are: top (16,4), TR (26.39,10), BR (26.39,22),
// bottom (16,28), BL (5.61,22), TL (5.61,10).

// Circle: 6-segment cubic bezier approximation using the shared footprint.
const circlePath =
	"M 16 4 C 20.30 4 24.12 6.15 26.39 10 C 28.67 13.85 28.67 18.15 26.39 22 C 24.12 25.85 20.30 28 16 28 C 11.70 28 7.88 25.85 5.61 22 C 3.33 18.15 3.33 13.85 5.61 10 C 7.88 6.15 11.70 4 16 4 Z";

// Square: same width as the base hexagon, but with matching height for a true square.
const squarePath =
	"M 16 5.61 C 19.46 5.61 22.93 5.61 26.39 5.61 C 26.39 12.54 26.39 19.46 26.39 26.39 C 22.93 26.39 19.46 26.39 16 26.39 C 12.54 26.39 9.07 26.39 5.61 26.39 C 5.61 19.46 5.61 12.54 5.61 5.61 C 9.07 5.61 12.54 5.61 16 5.61 Z";

// Triangle: same width as the base hexagon, but vertically balanced to avoid a spike.
const trianglePath =
	"M 16 5.61 C 17.73 9.07 19.46 12.54 21.20 16 C 22.93 19.46 24.66 22.93 26.39 26.39 C 22.93 26.39 19.46 26.39 16 26.39 C 12.54 26.39 9.07 26.39 5.61 26.39 C 7.34 22.93 9.07 19.46 10.80 16 C 12.54 12.54 14.27 9.07 16 5.61 Z";

// Hexagon: regular, equidistant hexagon used as the base geometry.
const hexagonPath =
	"M 16 4 C 19.46 6 22.93 8 26.39 10 C 26.39 14 26.39 18 26.39 22 C 22.93 24 19.46 26 16 28 C 12.54 26 9.07 24 5.61 22 C 5.61 18 5.61 14 5.61 10 C 9.07 8 12.54 6 16 4 Z";

const paths = [circlePath, squarePath, trianglePath, hexagonPath, circlePath];
const colors = ["#FCA700", "#AF59E1", "#6A9A23", "#1868DB", "#FCA700"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MorphingRovoShapeProps {
	/** Width and height in pixels. @default 32 */
	size?: number;
	/** Duration per morph step in seconds. @default 0.6 */
	duration?: number;
	/** Easing function for each morph transition. @default "easeInOut" */
	ease?: Transition["ease"];
	/** Clockwise rotation in degrees applied during each morph step. @default 180 */
	rotationPerStep?: number;
	/** Max blur radius in pixels applied at transition midpoints. 0 disables. @default 2 */
	blur?: number;
	/** Additional CSS classes applied to the wrapper. */
	className?: string;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Standalone morphing SVG shape — cycles circle → square → triangle → hexagon. */
export function MorphingRovoShape({
	size = 32,
	duration = 0.6,
	ease = "easeInOut",
	rotationPerStep = 180,
	blur = 2,
	className,
}: Readonly<MorphingRovoShapeProps>) {
	const progress = useMotionValue(0);
	const cancelledRef = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const reduced = useReducedMotion();
	const [inView, setInView] = useState(false);
	const [tabVisible, setTabVisible] = useState(
		typeof document === "undefined" ? true : document.visibilityState === "visible",
	);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => setInView(entry.isIntersecting),
			{ rootMargin: "200px" },
		);
		io.observe(el);
		const onVis = () => setTabVisible(document.visibilityState === "visible");
		document.addEventListener("visibilitychange", onVis);
		return () => {
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, []);

	const shouldAnimate = !reduced && inView && tabVisible;

	const path = useTransform(progress, [0, 1, 2, 3, 4], paths, {
		mixer: (a: string, b: string) => lerpPaths(a, b),
	});

	const color = useTransform(progress, [0, 1, 2, 3, 4], colors);
	const rotate = useTransform(progress, [0, 4], ["0deg", `${rotationPerStep * 4}deg`]);

	// Blur peaks at each transition midpoint, clears when shape is fully formed
	const blurFilter = useTransform(progress, (p) => {
		if (blur <= 0) return "none";
		const frac = p % 1;
		const intensity = 1 - Math.abs(frac * 2 - 1);
		return `blur(${intensity * blur}px)`;
	});

	useEffect(() => {
		if (!shouldAnimate) return;
		cancelledRef.current = false;
		let initialDelayTimeout: ReturnType<typeof setTimeout> | null = null;

		async function loop() {
			// Small initial delay to ensure mount is complete
			await new Promise((resolve) => {
				initialDelayTimeout = setTimeout(resolve, 50);
			});
			initialDelayTimeout = null;

			while (!cancelledRef.current) {
				for (let i = 1; i <= 4; i++) {
					if (cancelledRef.current) break;
					await animate(progress, i, {
						duration,
						ease,
					});
				}
				if (!cancelledRef.current) {
					progress.set(0);
				}
			}
		}

		loop();

		return () => {
			cancelledRef.current = true;
			if (initialDelayTimeout !== null) {
				clearTimeout(initialDelayTimeout);
			}
			progress.stop();
		};
	}, [progress, duration, ease, shouldAnimate]);

	return (
		<motion.div
			ref={containerRef}
			className={className}
			style={{
				width: size,
				height: size,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				flexShrink: 0,
				rotate,
				filter: blurFilter,
				willChange: blur > 0 ? "transform, filter" : "transform",
			}}
		>
			<svg
				viewBox="0 0 32 32"
				style={{
					width: size,
					height: size,
					display: "block",
					overflow: "visible",
				}}
			>
				<motion.path
					d={path}
					fill={color}
					strokeLinejoin="round"
					strokeLinecap="round"
				/>
			</svg>
		</motion.div>
	);
}

// ---------------------------------------------------------------------------
// Compound namespace
// ---------------------------------------------------------------------------

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const MorphingRovo = {
	/** Morphing shape that cycles through circle, square, triangle, hexagon. */
	Shape: MorphingRovoShape,
} as const;
