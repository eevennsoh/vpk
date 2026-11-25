"use client";

import type { Transition } from "motion/react";
import type { CSSProperties, ElementType } from "react";

import { resolveWaveHighlightColor } from "@/components/ui-custom/lib/shimmer-colors";
import { getShimmerWaveCharacterDelay } from "@/components/ui-custom/lib/shimmer-wave-timing";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { memo, useMemo } from "react";

const WAVE_REPEAT_DELAY_FACTOR = 0.05;
const DEFAULT_WAVE_DURATION = 1;
const DEFAULT_WAVE_SPREAD = 1;
const DEFAULT_WAVE_Z_DISTANCE = 10;
const DEFAULT_WAVE_X_DISTANCE = 2;
const DEFAULT_WAVE_Y_DISTANCE = -2;
const DEFAULT_WAVE_SCALE_DISTANCE = 1.1;
const DEFAULT_WAVE_ROTATE_Y_DISTANCE = 10;
const DEFAULT_WAVE_HIGHLIGHT_OPACITY = 0.88;
const DEFAULT_WAVE_BLUR_DISTANCE = 0;

export interface ShimmerWaveProps {
	children: string;
	as?: ElementType;
	className?: string;
	duration?: number;
	spread?: number;
	zDistance?: number;
	xDistance?: number;
	yDistance?: number;
	scaleDistance?: number;
	rotateYDistance?: number;
	/** Peak blur in px as the wave passes each character, which then comes back into focus. 0 (default) keeps it sharp. */
	blurDistance?: number;
	transition?: Transition;
	baseColor?: string;
	baseGradientColor?: string | readonly string[];
}

/**
 * Per-character 3D wave. Each glyph translates, scales, and rotates on a
 * staggered delay while a second absolutely-positioned copy fades the highlight
 * colour in and out over it.
 *
 * This is a sibling of `Shimmer`, not a mode of it: the two share no rendering.
 * `Shimmer` paints a gradient sweep through `background-clip: text`; this paints
 * per-glyph motion in plain text colour. They were one component behind a `wave`
 * boolean until the branches were separated.
 */
const ShimmerWaveComponent = ({
	children,
	as: Component = "p",
	className,
	duration,
	spread,
	zDistance = DEFAULT_WAVE_Z_DISTANCE,
	xDistance = DEFAULT_WAVE_X_DISTANCE,
	yDistance = DEFAULT_WAVE_Y_DISTANCE,
	scaleDistance = DEFAULT_WAVE_SCALE_DISTANCE,
	rotateYDistance = DEFAULT_WAVE_ROTATE_Y_DISTANCE,
	blurDistance = DEFAULT_WAVE_BLUR_DISTANCE,
	transition,
	baseColor,
	baseGradientColor,
}: ShimmerWaveProps) => {
	const shouldReduceMotion = useReducedMotion();
	const isWaveEnabled = !shouldReduceMotion && children.length > 0;
	const resolvedDuration = duration ?? DEFAULT_WAVE_DURATION;
	const resolvedSpread = spread ?? DEFAULT_WAVE_SPREAD;
	const characters = useMemo(
		() => (isWaveEnabled ? children.split("") : []),
		[children, isWaveEnabled]
	);
	const repeatDelay = useMemo(
		() =>
			(characters.length * WAVE_REPEAT_DELAY_FACTOR) /
			Math.max(resolvedSpread, 1),
		[characters.length, resolvedSpread]
	);
	const blurs = blurDistance > 0;
	const resolvedBaseColor = baseColor ?? "var(--color-muted-foreground)";
	const resolvedBaseGradientColor = useMemo(
		() =>
			characters.map((_, index) =>
				resolveWaveHighlightColor(baseGradientColor, index, characters.length)
			),
		[baseGradientColor, characters]
	);

	if (!isWaveEnabled) {
		return (
			<Component
				className={cn(
					"relative inline-block [color:var(--color-muted-foreground)]",
					className
				)}
			>
				{children}
			</Component>
		);
	}

	return (
		<Component
			className={cn(
				"relative inline-block overflow-visible [perspective:500px]",
				className,
				"overflow-visible"
			)}
			style={
				{
					"--base-color": resolvedBaseColor,
					"--base-gradient-color": resolveWaveHighlightColor(
						baseGradientColor,
						0,
						Math.max(characters.length, 1)
					),
				} as CSSProperties
			}
		>
			<span className="inline-flex items-baseline whitespace-pre [transform-style:preserve-3d]">
				{characters.map((character, index) => {
					const delay = getShimmerWaveCharacterDelay(index, characters.length, resolvedDuration, resolvedSpread);
					const renderedCharacter = character === " " ? "\u00A0" : character;
					if (character === " ") {
						return (
							<span
								key={`${character}-${index}`}
								className="inline-block whitespace-pre [color:var(--base-color)]"
							>
								{renderedCharacter}
							</span>
						);
					}
					const waveTransition = {
						delay,
						duration: resolvedDuration,
						ease: "easeInOut",
						repeat: Number.POSITIVE_INFINITY,
						repeatDelay,
						...transition,
					} satisfies Transition;

					return (
						<motion.span
							key={`${character}-${index}`}
							animate={{
								rotateY: [0, rotateYDistance, 0],
								scale: [1, scaleDistance, 1],
								translateX: [0, xDistance, 0],
								translateY: [0, yDistance, 0],
								translateZ: [0, zDistance, 0],
								...(blurs ? { filter: ["blur(0px)", `blur(${blurDistance}px)`, "blur(0px)"] } : null),
							}}
							className={cn(
								"relative inline-block whitespace-pre transform-gpu [backface-visibility:hidden] [transform-origin:50%_100%] [transform-style:preserve-3d]",
								blurs ? "[will-change:transform,filter]" : "[will-change:transform]",
							)}
							initial={{
								rotateY: 0,
								scale: 1,
								translateX: 0,
								translateY: 0,
								translateZ: 0,
							}}
							transition={waveTransition}
						>
							<span className="[color:var(--base-color)]">
								{renderedCharacter}
							</span>
							<motion.span
								aria-hidden="true"
								animate={{ opacity: [0, DEFAULT_WAVE_HIGHLIGHT_OPACITY, 0] }}
								className="pointer-events-none absolute inset-0 whitespace-pre"
								initial={{
									opacity: 0,
								}}
								style={{
									color:
										resolvedBaseGradientColor[index] ??
										"var(--base-gradient-color)",
								}}
								transition={waveTransition}
							>
								{renderedCharacter}
							</motion.span>
						</motion.span>
					);
				})}
			</span>
		</Component>
	);
};

export const ShimmerWave = memo(ShimmerWaveComponent);
