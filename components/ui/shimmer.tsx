"use client"

import { memo, type CSSProperties, type ElementType, type HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export interface ShimmerProps
	extends Omit<HTMLAttributes<HTMLElement>, "children"> {
	children: string
	as?: ElementType
	className?: string
	/** Seconds for one sweep. Omit to use the utility default (2s). */
	duration?: number
	/**
	 * Highlight band width, as a multiplier of the text length (the resolved
	 * width is `children.length * spread` pixels). Omit to use the utility
	 * default (`3ch + 40px`).
	 */
	spread?: number
	/**
	 * Resting text colour. The utility derives both the gradient base and its
	 * highlight from `currentColor`, so this sets `color` rather than a bespoke
	 * variable. Defaults to `text-muted-foreground`.
	 */
	baseColor?: string
}

/**
 * Gradient sweep across text, for loading and in-progress states.
 *
 * Rendering is the `shimmer` utility from `shadcn/tailwind.css` — pure CSS, no
 * Motion. `duration`, `spread`, and `baseColor` are overrides: pass none and the
 * utility's own defaults apply, which also leaves the class modifiers free.
 * Anything the utility exposes can be layered through `className`:
 *
 * ```tsx
 * <Shimmer className="shimmer-color-blue-500/60">Generating…</Shimmer>
 * <Shimmer className="shimmer-angle-45 shimmer-once">Done.</Shimmer>
 * <Shimmer className="md:shimmer-none">Quiet on desktop</Shimmer>
 * ```
 *
 * Reduced motion is handled by the utility itself, which drops the animation
 * and restores the text fill — no guard needed at the call site.
 *
 * For the per-character 3D wave, use `ShimmerWave`. It is a separate component,
 * not a mode of this one; the two share no rendering.
 */
function ShimmerComponent({
	children,
	as: Component = "p",
	className,
	duration,
	spread,
	baseColor,
	style: styleProp,
	...props
}: Readonly<ShimmerProps>) {
	const style: CSSProperties & Record<`--${string}`, string> = { ...styleProp }

	if (duration !== undefined) {
		style["--shimmer-duration"] = `${duration}s`
	}

	if (spread !== undefined) {
		style["--shimmer-spread"] = `${children.length * spread}px`
	}

	if (baseColor !== undefined) {
		style.color = baseColor
	}

	const PolymorphicShimmer = Component as ElementType<
		HTMLAttributes<HTMLElement>
	>

	return (
		<PolymorphicShimmer
			data-slot="shimmer"
			className={cn("shimmer relative inline-block text-muted-foreground", className)}
			style={style}
			{...props}
		>
			{children}
		</PolymorphicShimmer>
	)
}

export const Shimmer = memo(ShimmerComponent)
