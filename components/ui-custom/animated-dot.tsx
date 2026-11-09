"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

export type AnimatedDotVariant = "neutral" | "color";

const COLOR_VARIANT_COLORS = ["#1868db", "#bf63f3", "#fca700"] as const;
const NEUTRAL_DOT_COLORS = [undefined, undefined, undefined] as const;
const DEFAULT_DURATION = 1.2;
const DEFAULT_STAGGER_DELAY = 0.2;

export interface AnimatedDotProps {
	/**
	 * `"neutral"` (default) inherits the surrounding text colour so dots match
	 * the label they sit beside. Pair with `text-text-subtlest` when no parent
	 * colour is set. `"color"` uses the Rovo palette (or `colors` when provided).
	 */
	variant?: AnimatedDotVariant;
	colors?: readonly string[];
	duration?: number;
	staggerDelay?: number;
	className?: string;
}

function resolveVariant(
	variant: AnimatedDotVariant,
	colors: readonly string[] | undefined,
): AnimatedDotVariant {
	return colors != null ? "color" : variant;
}

function resolveDotColors(
	variant: AnimatedDotVariant,
	colors: readonly string[] | undefined,
): readonly (string | undefined)[] {
	switch (variant) {
		case "neutral":
			return NEUTRAL_DOT_COLORS;
		case "color":
			return colors ?? COLOR_VARIANT_COLORS;
		default: {
			const exhaustive: never = variant;
			throw new Error(`Unhandled AnimatedDot variant: ${exhaustive}`);
		}
	}
}

export const AnimatedDot = memo(
	({
		variant = "neutral",
		colors,
		duration = DEFAULT_DURATION,
		staggerDelay = DEFAULT_STAGGER_DELAY,
		className,
	}: Readonly<AnimatedDotProps>) => {
		const resolvedVariant = resolveVariant(variant, colors);
		const dotColors = resolveDotColors(resolvedVariant, colors);

		return (
			<span
				className={cn("shrink-0 inline-flex items-baseline", className)}
				aria-hidden="true"
			>
				{dotColors.map((color, i) => (
					<span
						key={i}
						className="text-sm leading-none motion-reduce:animate-none"
						style={{
							animation: `dot-reveal ${duration}s ease-in-out infinite`,
							animationDelay: `${i * staggerDelay}s`,
							color,
						}}
					>
						.
					</span>
				))}
			</span>
		);
	}
);

AnimatedDot.displayName = "AnimatedDot";
