"use client";

/**
 * Pixel Loader — a 3x3 grid of pulsing cells for long-running work.
 *
 * Each cell runs the same `pixel-loader-pulse` keyframe; the pattern's
 * per-cell `animation-delay` is what makes the grid read as a wavefront moving
 * in a direction. See `./patterns.ts` for the 51 patterns and their provenance.
 *
 * Optionally pairs the grid with a shimmering label and a live elapsed timer in
 * mono tabular figures — the full "loading experience" in one component.
 */

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import {
	DEFAULT_PIXEL_LOADER_PATTERN,
	PIXEL_LOADER_PATTERNS,
	type PixelLoaderPattern,
	resolveRovoColors,
} from "./patterns";
import { useElapsed, usePrefersReducedMotion } from "./use-pixel-loader";

/**
 * Resting opacity of a lit cell. Must match the 0%/100% stop of the
 * `pixel-loader-pulse` keyframe in `app/tailwind-theme.css`.
 */
const DIM_OPACITY = 0.15;

/**
 * Cells the active pattern never lights. Ghosted rather than removed so the
 * 3x3 silhouette holds steady when switching between patterns.
 */
const GHOST_OPACITY = 0.07;

/** Sizes mirror `TWGLoader` so the two loaders are interchangeable at call sites. */
const SIZES = {
	small: { cell: "3px", gap: "1px", label: "text-xs" },
	medium: { cell: "4px", gap: "1.5px", label: "text-[13px]" },
	large: { cell: "6px", gap: "2px", label: "text-sm" },
	xlarge: { cell: "9px", gap: "3px", label: "text-base" },
} as const;

export type PixelLoaderSize = keyof typeof SIZES;
export type PixelLoaderShape = "square" | "dot";
export type PixelLoaderColor = "default" | "rovo";

export interface PixelLoaderProps {
	/**
	 * Which of the 51 stagger patterns to run.
	 *
	 * @default 'chevron'
	 */
	pattern?: PixelLoaderPattern;
	/**
	 * Cell geometry — hard pixels or soft dots.
	 *
	 * @default 'square'
	 */
	shape?: PixelLoaderShape;
	/**
	 * Visual size (3 / 4 / 6 / 9px cells). Mirrors `@atlaskit/spinner`.
	 *
	 * @default 'medium'
	 */
	size?: PixelLoaderSize;
	/**
	 * `'default'` inherits the surrounding text colour and flips with the theme.
	 * `'rovo'` paints the wavefront in the four Rovo spot colours, identical in
	 * light and dark.
	 *
	 * @default 'default'
	 */
	color?: PixelLoaderColor;
	/** Optional shimmering caption rendered beside the grid. */
	label?: string;
	/**
	 * Show a live elapsed timer. Keeps ticking under reduced motion — it
	 * carries information rather than decoration.
	 *
	 * @default false
	 */
	showElapsed?: boolean;
	/** Additional classes applied to the wrapping element. */
	className?: string;
	/** Optional test id applied to the wrapping element. */
	testId?: string;
}

function PixelLoaderElapsed() {
	const elapsed = useElapsed();

	return (
		// Hidden from the live region: a 10Hz readout would flood a screen reader.
		<span aria-hidden="true" className="font-mono text-xs text-text-subtlest tabular-nums">
			{elapsed}
		</span>
	);
}

export function PixelLoader({
	pattern = DEFAULT_PIXEL_LOADER_PATTERN,
	shape = "square",
	size = "medium",
	color = "default",
	label,
	showElapsed = false,
	className,
	testId,
}: Readonly<PixelLoaderProps>) {
	const reducedMotion = usePrefersReducedMotion();

	const { duration, delays } = PIXEL_LOADER_PATTERNS[pattern];
	const { cell, gap, label: labelSize } = SIZES[size];
	const rovoColors = color === "rovo" ? resolveRovoColors(delays) : null;

	return (
		<output
			data-slot="pixel-loader"
			data-testid={testId}
			aria-label={label ?? "Loading"}
			// No text colour of its own: cells (`bg-current`) and the label
			// (a `currentColor` gradient) inherit from the surface, so the
			// loader is theme-correct by default and can be recoloured by any
			// ancestor without an override prop.
			className={cn("inline-flex w-fit items-center gap-2.5", className)}
			style={
				{
					"--pixel-loader-cell": cell,
					"--pixel-loader-gap": gap,
				} as CSSProperties
			}
		>
			<span
				aria-hidden="true"
				className="grid grid-cols-[repeat(3,var(--pixel-loader-cell))] gap-[var(--pixel-loader-gap)]"
			>
				{delays.map((delay, index) => (
					<span
						key={index}
						className={cn(
							"size-[var(--pixel-loader-cell)] bg-current",
							shape === "dot" ? "rounded-full" : "rounded-none",
						)}
						style={{
							opacity: delay === null ? GHOST_OPACITY : DIM_OPACITY,
							// `undefined` falls through to `bg-current`, which is what
							// unlit cells and the default colour mode both want.
							backgroundColor: rovoColors?.[index] ?? undefined,
							animation:
								delay === null || reducedMotion
									? undefined
									: `pixel-loader-pulse ${duration}ms var(--ease-linear) ${delay}ms infinite`,
						}}
					/>
				))}
			</span>

			{label ? (
				<span
					className={cn(
						"pixel-loader-shimmer font-medium motion-reduce:animate-none motion-reduce:mask-none",
						labelSize,
					)}
				>
					{label}
				</span>
			) : null}

			{showElapsed ? <PixelLoaderElapsed /> : null}
		</output>
	);
}

export default PixelLoader;
