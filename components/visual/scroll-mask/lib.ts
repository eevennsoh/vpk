import type { CSSProperties } from "react";

export const SCROLL_MASK_DEFAULT_FADE_SIZE = "var(--ds-space-400)";
export const SCROLL_MASK_DEFAULT_SCROLLBAR_WIDTH = "10px";

export interface ScrollMaskStyleOptions {
	fadeSize?: number | string;
	scrollbarWidth?: number | string;
	fadeTop?: boolean;
	fadeBottom?: boolean;
}

export interface HorizontalScrollMaskStyleOptions {
	edge?: "start" | "end" | "both";
	endGutterWidth?: number | string;
	fadeSize?: number | string;
}

type ScrollMaskCssProperties = CSSProperties & {
	"--scroll-mask-fade-size": string;
	"--scroll-mask-end-gutter-width"?: string;
};

type VerticalScrollMaskCssProperties = ScrollMaskCssProperties & {
	"--scroll-mask-scrollbar-width": string;
};

function toCssLength(value: number | string): string {
	return typeof value === "number" ? `${value}px` : value;
}

export function resolveFadeSize(fadeSize: number | string = SCROLL_MASK_DEFAULT_FADE_SIZE): string {
	return toCssLength(fadeSize);
}

// Stacked, feathered backdrop-blur layers = progressive (variable) blur. Each layer blurs
// a little more but is masked to a progressively narrower band near the edge, so the layers
// compound toward the edge and taper to zero inward — no hard blur cutoff. Blur radii are kept
// gentle because stacked backdrop-filters compound.
const SCROLL_MASK_BLUR_LAYERS = [
	{ blur: 0.5, mid: 68, end: 100 },
	{ blur: 1, mid: 52, end: 82 },
	{ blur: 2, mid: 38, end: 62 },
	{ blur: 3.5, mid: 24, end: 44 },
	{ blur: 6, mid: 10, end: 26 },
] as const;

// Each edge's gradient runs from the edge (#000) toward the interior (transparent), so the
// strongest blur sits AT the edge and tapers inward. Vertical edges (top/bottom) drive the
// ScrollMask overlay; horizontal edges (left/right) are the same ramp rotated onto the x-axis
// for horizontal scrollers such as the gallery dock.
const SCROLL_MASK_BLUR_DIRECTION = {
	top: "to bottom",
	bottom: "to top",
	left: "to right",
	right: "to left",
} as const;

export type ScrollMaskBlurEdge = keyof typeof SCROLL_MASK_BLUR_DIRECTION;

export function buildScrollMaskBlurLayerStyles(edge: ScrollMaskBlurEdge): CSSProperties[] {
	const direction = SCROLL_MASK_BLUR_DIRECTION[edge];
	return SCROLL_MASK_BLUR_LAYERS.map(({ blur, mid, end }) => {
		const maskImage = `linear-gradient(${direction}, #000 0%, #000 ${mid}%, transparent ${end}%)`;
		const backdropFilter = `blur(${blur}px)`;
		return {
			position: "absolute",
			inset: 0,
			backdropFilter,
			WebkitBackdropFilter: backdropFilter,
			maskImage,
			WebkitMaskImage: maskImage,
		};
	});
}

export type ScrollMaskOverlayEdge = "top" | "right" | "bottom" | "left";

export interface ScrollMaskOverlayStyleOptions {
	edge: ScrollMaskOverlayEdge;
	fadeSize?: number | string;
	/**
	 * Fade color. Defaults to the page surface so overlays match a `bg-surface`
	 * parent. Pass the parent backdrop token when the scrollport sits on a
	 * different fill (for example `var(--color-bg-accent-gray-subtlest)`).
	 */
	color?: string;
}

const SCROLL_MASK_OVERLAY_DEFAULT_COLOR = "var(--color-surface)";

/**
 * Visual-only edge fade. Use this instead of `fadeTop` on `buildScrollMaskStyle`
 * when controls sit at the start of the scrollport: CSS `mask-image` clips
 * hit-testing in some browsers, so a top mask would swallow clicks on a header
 * pinned to `align: "start"`.
 */
export function buildScrollMaskOverlayStyle({
	edge,
	fadeSize = SCROLL_MASK_DEFAULT_FADE_SIZE,
	color = SCROLL_MASK_OVERLAY_DEFAULT_COLOR,
}: ScrollMaskOverlayStyleOptions): ScrollMaskCssProperties {
	const resolvedFadeSize = toCssLength(fadeSize);
	const gradientDirection = {
		top: "to bottom",
		right: "to left",
		bottom: "to top",
		left: "to right",
	}[edge];
	const isHorizontal = edge === "left" || edge === "right";

	return {
		"--scroll-mask-fade-size": resolvedFadeSize,
		backgroundImage: `linear-gradient(${gradientDirection}, ${color} 0, transparent 100%)`,
		...(isHorizontal ? { width: resolvedFadeSize } : { height: resolvedFadeSize }),
		pointerEvents: "none",
	};
}

export function buildScrollMaskStyle({
	fadeSize = SCROLL_MASK_DEFAULT_FADE_SIZE,
	scrollbarWidth = SCROLL_MASK_DEFAULT_SCROLLBAR_WIDTH,
	fadeTop = true,
	fadeBottom = true,
}: ScrollMaskStyleOptions = {}): VerticalScrollMaskCssProperties {
	const resolvedFadeSize = toCssLength(fadeSize);
	const resolvedScrollbarWidth = toCssLength(scrollbarWidth);
	if (!fadeTop && !fadeBottom) {
		return {
			"--scroll-mask-fade-size": resolvedFadeSize,
			"--scroll-mask-scrollbar-width": resolvedScrollbarWidth,
			maskImage: "none",
			WebkitMaskImage: "none",
		};
	}
	const preservesScrollbarTrack = resolvedScrollbarWidth !== "0px";
	// Only fade an edge that has content scrolled past it, so a menu at rest (or one that
	// does not overflow) shows no fade. Both default true to preserve the full both-edge mask.
	// `fadeTop` uses mask-image and can clip hit-testing; prefer
	// `buildScrollMaskOverlayStyle` when the faded band contains controls.
	const topStops = fadeTop ? "transparent 0, black var(--scroll-mask-fade-size)" : "black 0";
	const bottomStops = fadeBottom
		? "black calc(100% - var(--scroll-mask-fade-size)), transparent 100%"
		: "black 100%";
	const fadeMaskImage = `linear-gradient(to bottom, ${topStops}, ${bottomStops})`;
	const maskImage = preservesScrollbarTrack
		? [fadeMaskImage, "linear-gradient(black, black)"].join(", ")
		: fadeMaskImage;
	const maskPosition = preservesScrollbarTrack ? "0 0, 100% 0" : "0 0";
	const maskRepeat = preservesScrollbarTrack ? "no-repeat, no-repeat" : "no-repeat";
	const maskSize = preservesScrollbarTrack
		? `calc(100% - ${resolvedScrollbarWidth}) 100%, ${resolvedScrollbarWidth} 100%`
		: "100% 100%";

	return {
		"--scroll-mask-fade-size": resolvedFadeSize,
		"--scroll-mask-scrollbar-width": resolvedScrollbarWidth,
		maskImage,
		WebkitMaskImage: maskImage,
		maskPosition,
		WebkitMaskPosition: maskPosition,
		maskRepeat,
		WebkitMaskRepeat: maskRepeat,
		maskSize,
		WebkitMaskSize: maskSize,
	};
}

export function buildHorizontalScrollMaskStyle({
	edge = "both",
	endGutterWidth,
	fadeSize = SCROLL_MASK_DEFAULT_FADE_SIZE,
}: HorizontalScrollMaskStyleOptions = {}): ScrollMaskCssProperties {
	const resolvedFadeSize = toCssLength(fadeSize);
	const resolvedEndGutterWidth = endGutterWidth === undefined ? undefined : toCssLength(endGutterWidth);
	const maskImageByEdge = {
		both: "linear-gradient(to right, transparent 0, black var(--scroll-mask-fade-size), black calc(100% - var(--scroll-mask-fade-size)), transparent 100%)",
		end: "linear-gradient(to right, black 0, black calc(100% - var(--scroll-mask-fade-size)), transparent 100%)",
		start: "linear-gradient(to right, transparent 0, black var(--scroll-mask-fade-size), black 100%)",
	} satisfies Record<NonNullable<HorizontalScrollMaskStyleOptions["edge"]>, string>;
	const maskImage = resolvedEndGutterWidth
		? [maskImageByEdge[edge], "linear-gradient(black, black)"].join(", ")
		: maskImageByEdge[edge];
	const maskPosition = resolvedEndGutterWidth ? "0 0, 100% 0" : "0 0";
	const maskRepeat = resolvedEndGutterWidth ? "no-repeat, no-repeat" : "no-repeat";
	const maskSize = resolvedEndGutterWidth
		? `calc(100% - ${resolvedEndGutterWidth}) 100%, ${resolvedEndGutterWidth} 100%`
		: "100% 100%";

	return {
		"--scroll-mask-fade-size": resolvedFadeSize,
		...(resolvedEndGutterWidth ? { "--scroll-mask-end-gutter-width": resolvedEndGutterWidth } : {}),
		maskImage,
		WebkitMaskImage: maskImage,
		maskPosition,
		WebkitMaskPosition: maskPosition,
		maskRepeat,
		WebkitMaskRepeat: maskRepeat,
		maskSize,
		WebkitMaskSize: maskSize,
	};
}
