"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";
import { useId, useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { ROVO_COLOR_SWATCHES } from "@/lib/rovo-colors";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

export type RovoSparkleSize = "compact" | "default";

export interface RovoSparkleButtonProps extends Omit<ButtonProps, "children" | "size"> {
	/** Keeps the colored hover treatment active, for example while its popover is open. */
	active?: boolean;
	/** Visually hides the trigger while selected without removing it from the accessibility tree. */
	hideWhenSelected?: boolean;
	/** Compact is 24px with a 12px glyph; default is 32px with a 16px glyph. */
	size?: RovoSparkleSize;
	/** Controls the whole tile's reveal without removing the accessible trigger. */
	visible?: boolean;
}

const SPARKLE_PATH = "M8.117 1.009a.75.75 0 0 1 .588.484l1.55 4.251 4.252 1.55A.75.75 0 0 1 15 8v.002a.75.75 0 0 1-.493.704l-4.252 1.55-1.55 4.252a.75.75 0 0 1-.704.493h-.002a.75.75 0 0 1-.704-.493l-1.55-4.252-4.252-1.55A.75.75 0 0 1 1 8.001v-.002a.75.75 0 0 1 .493-.704l4.251-1.55 1.55-4.252.049-.106A.75.75 0 0 1 7.999 1h.002z";
const SPARKLE_COLOR_ENTER: Transition = { duration: 0.15, ease: motionEase.outPractical }; // duration-normal + ease-out-practical
const SPARKLE_COLOR_EXIT: Transition = { duration: 0.25, ease: motionEase.in }; // duration-slow + ease-in
const SPARKLE_VISIBILITY_EXIT: Transition = { duration: 0.1, ease: motionEase.in }; // duration-fast + ease-in
const SPARKLE_TRANSFORM_ENTER: Transition = { duration: 0.4, ease: motionEase.inOut }; // duration-slower + ease-in-out
const SPARKLE_TRANSFORM_EXIT: Transition = { duration: 0.25, ease: motionEase.in }; // duration-slow + ease-in
const SPARKLE_REDUCED: Transition = { duration: 0 };

export interface RovoSparkleMarkProps {
	/** Runs the rotate/scale flourish and swaps the glyph to the four Rovo brand quadrants. */
	active: boolean;
	/** Tints the glyph with `color.icon.selected` instead of the inverse white. */
	selected: boolean;
	/** Compact is a 12px glyph; default is 16px. */
	size: RovoSparkleSize;
}

/**
 * The bare sparkle glyph, without the surrounding button. Exported so surfaces that already
 * own a black background — for example the Omnibar's collapsed pill — can render the
 * canonical mark instead of re-declaring its path.
 */
export function RovoSparkleMark({
	active,
	selected,
	size,
}: Readonly<RovoSparkleMarkProps>) {
	const shouldReduceMotion = useReducedMotion();
	const clipId = useId().replaceAll(":", "");
	const colorActive = active && !selected;
	const colorTransition = shouldReduceMotion
		? SPARKLE_REDUCED
		: colorActive
			? SPARKLE_COLOR_ENTER
			: SPARKLE_COLOR_EXIT;
	const transformTransition = shouldReduceMotion
		? SPARKLE_REDUCED
		: active
			? SPARKLE_TRANSFORM_ENTER
			: SPARKLE_TRANSFORM_EXIT;
	const glyphSize = size === "compact" ? 12 : 16;
	const hoverScale = size === "compact" ? 16 / 12 : 20 / 16;

	return (
		<motion.span
			animate={{
				rotate: shouldReduceMotion || !active ? 0 : 180,
				scale: shouldReduceMotion || !active ? 1 : hoverScale,
			}}
			aria-hidden="true"
			className="relative inline-flex origin-center items-center justify-center"
			data-slot="rovo-sparkle-mark"
			initial={false}
			style={{ willChange: "transform" }}
			transition={{
				rotate: transformTransition,
				scale: shouldReduceMotion ? SPARKLE_REDUCED : SPARKLE_COLOR_ENTER,
			}}
		>
			<svg
				fill="none"
				height={glyphSize}
				viewBox="0 0 16 16"
				width={glyphSize}
				xmlns="http://www.w3.org/2000/svg"
			>
				<defs>
					<clipPath id={`${clipId}-top`}><path d="M0 0h16L8 8Z" /></clipPath>
					<clipPath id={`${clipId}-right`}><path d="M16 0v16L8 8Z" /></clipPath>
					<clipPath id={`${clipId}-bottom`}><path d="M16 16H0l8-8Z" /></clipPath>
					<clipPath id={`${clipId}-left`}><path d="M0 16V0l8 8Z" /></clipPath>
				</defs>
				<motion.path
					animate={{ opacity: selected || colorActive ? 0 : 1 }}
					className="text-icon-inverse!"
					d={SPARKLE_PATH}
					fill="currentColor"
					initial={false}
					style={{ willChange: "opacity" }}
					transition={colorTransition}
				/>
				<motion.g
					animate={{ opacity: colorActive ? 1 : 0 }}
					initial={false}
					style={{ willChange: "opacity" }}
					transition={colorTransition}
				>
					<path clipPath={`url(#${clipId}-top)`} d={SPARKLE_PATH} fill={ROVO_COLOR_SWATCHES[0].hex} />
					<path clipPath={`url(#${clipId}-right)`} d={SPARKLE_PATH} fill={ROVO_COLOR_SWATCHES[2].hex} />
					<path clipPath={`url(#${clipId}-bottom)`} d={SPARKLE_PATH} fill={ROVO_COLOR_SWATCHES[1].hex} />
					<path clipPath={`url(#${clipId}-left)`} d={SPARKLE_PATH} fill={ROVO_COLOR_SWATCHES[3].hex} />
				</motion.g>
				<motion.path
					animate={{ opacity: selected ? 1 : 0 }}
					className="text-icon-selected!"
					d={SPARKLE_PATH}
					fill="currentColor"
					initial={false}
					style={{ willChange: "opacity" }}
					transition={colorTransition}
				/>
			</svg>
		</motion.span>
	);
}

export function RovoSparkleButton({
	active = false,
	"aria-expanded": ariaExpanded,
	className,
	hideWhenSelected = false,
	onBlur,
	onFocus,
	onPointerEnter,
	onPointerLeave,
	size = "default",
	visible = true,
	...props
}: Readonly<RovoSparkleButtonProps>) {
	const shouldReduceMotion = useReducedMotion();
	const [focused, setFocused] = useState(false);
	const [hovered, setHovered] = useState(false);
	const selected = active || ariaExpanded === true || ariaExpanded === "true";
	const [previousSelected, setPreviousSelected] = useState(selected);
	const [interactionSuppressed, setInteractionSuppressed] = useState(false);
	if (selected !== previousSelected) {
		setPreviousSelected(selected);
		if (!selected) {
			setInteractionSuppressed(true);
		}
	}
	const interactionActive = selected || (!interactionSuppressed && (focused || hovered));
	const hiddenWhileSelected = hideWhenSelected && selected;
	const visuallyHidden = !visible || hiddenWhileSelected;
	const visibilityTransition = shouldReduceMotion
		? SPARKLE_REDUCED
		: visible
			? SPARKLE_COLOR_ENTER
			: SPARKLE_VISIBILITY_EXIT;

	return (
		<Button
			aria-expanded={ariaExpanded}
			className={cn(
				"group/rovo-sparkle overflow-hidden bg-transparent p-0 hover:bg-transparent active:bg-transparent",
				selected ? "shadow-none" : "shadow-overlay",
				hiddenWhileSelected ? "pointer-events-none opacity-0" : null,
				visuallyHidden ? "opacity-0 shadow-none" : null,
				className,
			)}
			data-hidden-when-selected={hiddenWhileSelected || undefined}
			data-size={size}
			data-slot="rovo-sparkle-button"
			onBlur={(event) => {
				setFocused(false);
				if (!selected) {
					setInteractionSuppressed(false);
				}
				onBlur?.(event);
			}}
			onFocus={(event) => {
				setFocused(true);
				onFocus?.(event);
			}}
			onPointerEnter={(event) => {
				setInteractionSuppressed(false);
				setHovered(true);
				onPointerEnter?.(event);
			}}
			onPointerLeave={(event) => {
				setHovered(false);
				if (!selected) {
					setInteractionSuppressed(false);
				}
				onPointerLeave?.(event);
			}}
			size={size === "compact" ? "icon-compact" : "icon"}
			type="button"
			variant="ghost"
			{...props}
		>
			<motion.span
				animate={{
					opacity: visible ? 1 : 0,
					transform: shouldReduceMotion || visible ? "scale(1)" : "scale(0.9)",
				}}
				className={cn(
					"inline-flex size-full items-center justify-center",
					selected
						? "bg-bg-selected group-hover/rovo-sparkle:bg-bg-selected-hovered group-active/rovo-sparkle:bg-bg-selected-pressed"
						: "bg-bg-neutral-bold group-hover/rovo-sparkle:bg-bg-neutral-bold-hovered group-active/rovo-sparkle:bg-bg-neutral-bold-pressed",
				)}
				data-active={interactionActive || undefined}
				initial={false}
				transition={visibilityTransition}
			>
				<RovoSparkleMark active={interactionActive} selected={selected} size={size} />
			</motion.span>
		</Button>
	);
}
