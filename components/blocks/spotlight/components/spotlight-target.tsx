"use client";

import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import {
	SPOTLIGHT_PLACEMENT_CONFIG,
	type SpotlightAlign as Align,
	type SpotlightPlacement,
	type SpotlightSide as Side,
} from "@/components/blocks/spotlight/spotlight-placement";

export type { SpotlightPlacement } from "@/components/blocks/spotlight/spotlight-placement";

// ---------------------------------------------------------------------------
// Placement — ADS-style names mapped to base-ui side/align
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pulse — animated highlight glow drawn around the target element
// ---------------------------------------------------------------------------

export interface SpotlightPulseProps {
	/** Match the target's corner style. @default "rounded" */
	shape?: "rounded" | "circle";
	className?: string;
}

function SpotlightPulse({ shape = "rounded", className }: Readonly<SpotlightPulseProps>) {
	const radius = shape === "circle" ? "rounded-full" : "rounded-lg";
	return (
		<span aria-hidden className={cn("pointer-events-none absolute -inset-1", className)}>
			{/* Soft glow halo that gently pulses behind the target — no ring outline. */}
			<span
				className={cn(
					"absolute inset-0 animate-pulse bg-primary/25 blur-md [animation-duration:1.8s] motion-reduce:hidden",
					radius,
				)}
			/>
		</span>
	);
}

// ---------------------------------------------------------------------------
// Target — anchors a spotlight card to a real element with a notch + pulse
// ---------------------------------------------------------------------------

export interface SpotlightTargetProps {
	/**
	 * The single interactive element to highlight; it becomes the popover
	 * trigger. Optional when `anchor` is supplied (the spotlight then attaches to
	 * an element it does not own).
	 */
	children?: ReactElement;
	/**
	 * Attach the spotlight to an external element the component does not render
	 * (an element, a ref, or a getter). When set, `children` and the wrapping
	 * pulse are skipped — highlight the live element yourself (e.g. a glow
	 * utility toggled by the caller). Useful for tours that point at existing UI.
	 */
	anchor?: PopoverPrimitive.Positioner.Props["anchor"];
	/** The spotlight card (or any node) rendered in the anchored popover. */
	content: ReactNode;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: PopoverPrimitive.Root.Props["onOpenChange"];
	/** ADS-style placement. Overrides `side`/`align` when set. */
	placement?: SpotlightPlacement;
	/** base-ui side, used when `placement` is not provided. @default "bottom" */
	side?: Side;
	align?: Align;
	sideOffset?: number;
	/** Render the animated pulse glow around the target. @default true */
	pulse?: boolean;
	/** Corner style for the pulse glow. @default "rounded" */
	shape?: "rounded" | "circle";
}

function SpotlightTarget({
	children,
	anchor,
	content,
	open,
	defaultOpen,
	onOpenChange,
	placement,
	side = "bottom",
	align = "center",
	sideOffset = 8,
	pulse = true,
	shape = "rounded",
}: Readonly<SpotlightTargetProps>) {
	const resolved = placement ? SPOTLIGHT_PLACEMENT_CONFIG[placement] : { side, align };

	// Mirror the popover's open state so the pulse matches the popup even in
	// uncontrolled usage (when `open` is omitted, base-ui owns the real state).
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
	const isOpen = open ?? uncontrolledOpen;
	const handleOpenChange: NonNullable<PopoverPrimitive.Root.Props["onOpenChange"]> = (next, details) => {
		if (open === undefined) {
			setUncontrolledOpen(next);
		}
		onOpenChange?.(next, details);
	};

	return (
		<PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={handleOpenChange}>
			{/* External-anchor mode skips the trigger/pulse wrapper: the spotlight
			    points at an element it does not render. */}
			{anchor ? null : (
				<span className="relative inline-flex">
					{children ? <PopoverPrimitive.Trigger render={children} /> : null}
					{pulse && isOpen ? <SpotlightPulse shape={shape} /> : null}
				</span>
			)}
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					anchor={anchor}
					side={resolved.side}
					align={resolved.align}
					sideOffset={sideOffset}
					// Keep the notch off the card's rounded corners. The card uses
					// `rounded-lg` (8px) and the rotated-square notch is 12px (≈17px on the
					// diagonal); the default 5px padding lets the notch ride onto the
					// rounded corner when a tall/off-center anchor clamps it toward an end,
					// where the negative-z tuck can't cover its inner half and it reads as a
					// detached diamond. 16px keeps the whole notch on the straight edge.
					arrowPadding={16}
					className="isolate z-[200]"
				>
					<PopoverPrimitive.Popup
						data-slot="spotlight-popup"
						className="relative origin-(--transform-origin) outline-hidden transition-[opacity,scale] duration-slow ease-in-out motion-reduce:transition-none data-ending-style:duration-medium data-ending-style:ease-in data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
					>
						{content}
						{/* Notch: a rotated square sat ON the card edge and tucked behind it (negative z),
						    so only a triangle pokes toward the anchor. base-ui centers it on the cross axis;
						    we set the main-axis edge per side. */}
						<PopoverPrimitive.Arrow
							className={cn(
								"z-[-1] size-3",
								"data-[side=bottom]:top-0 data-[side=bottom]:-translate-y-1/2",
								"data-[side=top]:bottom-0 data-[side=top]:translate-y-1/2",
								"data-[side=left]:right-0 data-[side=left]:translate-x-1/2",
								"data-[side=right]:left-0 data-[side=right]:-translate-x-1/2",
							)}
						>
							<span className="block size-3 rotate-45 rounded-xs bg-bg-neutral-bold" />
						</PopoverPrimitive.Arrow>
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

export { SpotlightPulse, SpotlightTarget };
