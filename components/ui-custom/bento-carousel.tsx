"use client";

import { type CSSProperties, type ReactNode, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { useHasHorizontalOverflow } from "@/components/hooks/use-has-horizontal-overflow";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

// Below `lg` (<1024px) the bento switches from its desktop grid to a horizontal
// scroll carousel: equal-size cards (~2 visible + a peek), reactive edge fades, a
// constant bottom fade (so cards dissolve into the page edge rather than ending on
// a hard border — mirrors the desktop grid's `bento-fade-bottom`), and prev/next
// arrows. The horizontal + bottom gradients are two layers of one mask composited
// with `intersect`: a pixel survives only where BOTH are opaque, so the top-center
// stays solid while the left/right (when scrollable) and bottom edges fade. At
// `lg:`+ these `max-lg:` rules go inert and the existing grid (moved to `lg:`)
// takes over. Shared by both bentos so they stay aligned.
export const BENTO_CAROUSEL_CONTAINER_CLASS =
	"mx-auto w-full gap-3 max-lg:flex max-lg:snap-x max-lg:snap-proximity max-lg:scroll-px-2 max-lg:overflow-x-auto max-lg:overflow-y-hidden max-lg:px-2 max-lg:pt-2 max-lg:pb-0 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden max-lg:[mask-image:var(--bento-edge-mask)] max-lg:[-webkit-mask-image:var(--bento-edge-mask)] max-lg:[mask-composite:intersect] max-lg:[-webkit-mask-composite:source-in] lg:grid lg:grid-cols-5 lg:auto-rows-[144px]";

// Per card: equal height (taller than the desktop `auto-rows-[144px]` so the
// constant bottom fade has room to read as the card bleeding off the edge) and
// equal width sized so two cards show fully with the third peeking. Width =
// (track − the two 12px inter-card gaps) / 2.25 → exactly 2 cards + 2 gaps + a
// quarter-card peek.
export const BENTO_CAROUSEL_TILE_CLASS =
	"max-lg:h-48 max-lg:w-[calc((100%_-_24px)/2.25)] max-lg:shrink-0 max-lg:snap-start";

const EDGE_FADE = "48px";
// Bottom dissolve distance for the carousel. Matches the spirit of the desktop
// grid's 96px `bento-fade-bottom` but shorter, since these are single-row tiles
// rather than a multi-row grid whose last row is being teased.
const BOTTOM_FADE = "64px";
const CAROUSEL_ARROW_TRANSITION = { type: "spring", bounce: 0, visualDuration: 0.2 } as const;

type BentoEdgeMaskStyle = CSSProperties & Record<"--bento-edge-mask", string>;

/**
 * Build the carousel mask: a reactive horizontal edge fade (fading only the
 * side[s] with more content) plus a constant bottom fade, as two comma-separated
 * gradient layers. Consumed via the `--bento-edge-mask` var by the
 * `max-lg:[mask-image:var(--bento-edge-mask)]` + `[mask-composite:intersect]`
 * classes (base only). The horizontal "none" state is fully opaque so SSR /
 * no-overflow renders without a side flash; the bottom layer is always present so
 * cards consistently dissolve at the bottom edge.
 */
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function buildHorizontalEdgeMask(canScrollLeft: boolean, canScrollRight: boolean): string {
	const left = canScrollLeft ? `transparent 0, #000 ${EDGE_FADE}` : "#000 0";
	const right = canScrollRight ? `#000 calc(100% - ${EDGE_FADE}), transparent 100%` : "#000 100%";
	const horizontal = `linear-gradient(to right, ${left}, ${right})`;
	const bottom = `linear-gradient(to bottom, #000 calc(100% - ${BOTTOM_FADE}), transparent)`;
	return `${horizontal}, ${bottom}`;
}

/** Inline `style` carrying the edge-mask var; apply to the scroll container. */
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getBentoEdgeMaskStyle(canScrollLeft: boolean, canScrollRight: boolean): BentoEdgeMaskStyle {
	return { "--bento-edge-mask": buildHorizontalEdgeMask(canScrollLeft, canScrollRight) };
}

export interface CarouselArrowProps {
	direction: "previous" | "next";
	onClick: () => void;
	/** Accessible label; defaults to a generic "Show previous/next". */
	label?: string;
	className?: string;
}

/**
 * Floating prev/next control for the small-screen carousel. Mirrors the
 * agent-template directory carousel control. Render inside an `AnimatePresence`
 * and only when that side can scroll, so the spring runs on mount/unmount. Hidden
 * at `sm:`+ (the desktop grid has no horizontal scroll).
 */
export function CarouselArrow({ direction, onClick, label, className }: Readonly<CarouselArrowProps>) {
	const shouldReduceMotion = useReducedMotion();
	const isPrevious = direction === "previous";
	const offset = shouldReduceMotion ? "0px" : isPrevious ? "-8px" : "8px";
	const scale = shouldReduceMotion ? "1" : "0.96";
	const hiddenTransform = `translateY(-50%) translateX(${offset}) scale(${scale})`;

	return (
		<motion.div
			animate={{ opacity: 1, transform: "translateY(-50%) translateX(0px) scale(1)" }}
			className={cn("absolute top-1/2 z-10 lg:hidden", isPrevious ? "left-3" : "right-3", className)}
			exit={{ opacity: 0, transform: hiddenTransform }}
			initial={{ opacity: 0, transform: hiddenTransform }}
			transition={shouldReduceMotion ? { duration: 0.1 } : CAROUSEL_ARROW_TRANSITION}
		>
			<Button
				aria-label={label ?? (isPrevious ? "Show previous" : "Show next")}
				className="border-0 bg-surface-overlay text-icon-subtle opacity-100 hover:bg-surface-overlay-hovered active:bg-surface-overlay-pressed focus-visible:border-0"
				onClick={onClick}
				size="icon"
				style={{ boxShadow: token("elevation.shadow.overlay") }}
				type="button"
				variant="ghost"
			>
				<Icon
					className="pointer-events-none [&_*]:pointer-events-none"
					render={
						isPrevious ? (
							<ChevronLeftIcon label="" color="currentColor" />
						) : (
							<ChevronRightIcon label="" color="currentColor" />
						)
					}
				/>
			</Button>
		</motion.div>
	);
}

export interface BentoCarouselProps {
	children: ReactNode;
	/** Per-bento extra classes for the scroll/grid element (e.g. `max-w-[1280px]`). */
	gridClassName?: string;
	/** When this changes, the carousel resets to the start (e.g. category swap). */
	resetKey?: string | number;
	arrowLabels?: { previous: string; next: string };
	/** Extra classes for the relative arrow host. */
	className?: string;
}

/**
 * Drop-in carousel for a static bento tile list (used by the agent-config bento).
 * Owns the scroll container, reactive edge fade, and prev/next arrows; renders the
 * tiles as children (each must carry `BENTO_CAROUSEL_TILE_CLASS`). The studio
 * bento composes the primitives directly instead, because its grid is a keyed
 * `motion.div` that remounts on category cycling.
 */
export function BentoCarousel({ children, gridClassName, resetKey, arrowLabels, className }: Readonly<BentoCarouselProps>) {
	const shouldReduceMotion = useReducedMotion();
	const { ref, canScrollLeft, canScrollRight, scrollByDir, scrollToStart } =
		useHasHorizontalOverflow<HTMLDivElement>({ reduceMotion: shouldReduceMotion ?? false });

	useEffect(() => {
		scrollToStart();
	}, [resetKey, scrollToStart]);

	return (
		<div className={cn("relative", className)}>
			<div
				className={cn(BENTO_CAROUSEL_CONTAINER_CLASS, gridClassName)}
				ref={ref}
				style={getBentoEdgeMaskStyle(canScrollLeft, canScrollRight)}
			>
				{children}
			</div>
			<AnimatePresence initial={false}>
				{canScrollLeft ? (
					<CarouselArrow
						direction="previous"
						key="previous"
						label={arrowLabels?.previous}
						onClick={() => scrollByDir(-1)}
					/>
				) : null}
				{canScrollRight ? (
					<CarouselArrow
						direction="next"
						key="next"
						label={arrowLabels?.next}
						onClick={() => scrollByDir(1)}
					/>
				) : null}
			</AnimatePresence>
		</div>
	);
}
