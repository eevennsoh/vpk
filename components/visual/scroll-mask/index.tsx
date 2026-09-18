"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	buildScrollMaskBlurLayerStyles,
	buildScrollMaskOverlayStyle,
	buildScrollMaskStyle,
	resolveFadeSize,
	resolveTopFadeSize,
	type ScrollMaskOverlayEdge,
} from "./lib";

// Progressive-blur layer stacks are static per edge, so build them once at module scope and
// share the style objects across every instance and render (no per-render allocation).
const TOP_BLUR_LAYERS = buildScrollMaskBlurLayerStyles("top");
const BOTTOM_BLUR_LAYERS = buildScrollMaskBlurLayerStyles("bottom");

export interface ScrollMaskProps
	extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
	children: ReactNode;
	header?: ReactNode;
	footer?: ReactNode;
	viewportClassName?: string;
	viewportStyle?: CSSProperties;
	headerClassName?: string;
	footerClassName?: string;
	/** Bottom fade depth. The top fade and blur bands are always half as deep. */
	fadeSize?: number | string;
	scrollbarWidth?: number | string;
	/**
	 * Layer a progressive (variable) backdrop blur over the top and bottom fade bands so
	 * overflow content softly blurs out toward the edges instead of only fading. Off by default.
	 */
	edgeBlur?: boolean;
}

/**
 * Pointer-events-none edge fade. Gate scrollport edges on real overflow, or
 * place one beside an overlapping pinned surface so it softens the underlap.
 */
export function ScrollMaskEdgeOverlay({
	className,
	color,
	edge,
	fadeSize,
	style,
	...props
}: Readonly<
	Omit<ComponentPropsWithoutRef<"div">, "children"> & {
		color?: string;
		edge: ScrollMaskOverlayEdge;
		fadeSize?: number | string;
	}
>) {
	const isHorizontal = edge === "left" || edge === "right";
	const edgePositionClassName = {
		top: "top-0",
		right: "right-0",
		bottom: "bottom-0",
		left: "left-0",
	}[edge];

	return (
		<div
			{...props}
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute",
				isHorizontal ? "inset-y-0" : "inset-x-0",
				edgePositionClassName,
				className,
			)}
			data-scroll-mask-overlay={edge}
			style={{ ...buildScrollMaskOverlayStyle({ color, edge, fadeSize }), ...style }}
		/>
	);
}

/** Standard top-edge fade used directly below a sticky row while it is pinned. */
export function StickyRowScrollFade({
	className,
	...props
}: Readonly<Omit<ComponentPropsWithoutRef<"div">, "children">>) {
	return (
		<div
			{...props}
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-x-0 top-full h-4 opacity-0",
				className,
			)}
			data-sticky-row-scroll-fade=""
		>
			<div className="absolute inset-0 bg-linear-to-b from-surface-overlay to-transparent" />
		</div>
	);
}

export function ScrollMask({
	children,
	header,
	footer,
	className,
	viewportClassName,
	viewportStyle,
	headerClassName,
	footerClassName,
	fadeSize,
	scrollbarWidth,
	edgeBlur = false,
	style,
	...props
}: Readonly<ScrollMaskProps>) {
	// Track real overflow + scroll position so an edge only fades/blurs when there is
	// actually content hidden past it — a menu at rest (or one that fits) shows no effect.
	const { ref: viewportRef, showTopScrollMask, showBottomScrollMask } =
		useHasVerticalOverflow<HTMLDivElement>();
	const maskStyle = buildScrollMaskStyle({
		fadeSize,
		scrollbarWidth,
		fadeTop: showTopScrollMask,
		fadeBottom: showBottomScrollMask,
	});
	const resolvedFadeSize = resolveFadeSize(fadeSize);
	const resolvedTopFadeSize = resolveTopFadeSize(fadeSize);

	return (
		<div
			data-slot="scroll-mask"
			className={cn(
				"flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-text",
				className,
			)}
			style={{ maxHeight: `calc(${token("space.600")} * 8)`, ...style }}
			{...props}
		>
			{header ? (
				<div
					data-slot="scroll-mask-header"
					className={cn("shrink-0 bg-surface px-4 py-3", headerClassName)}
				>
					{header}
				</div>
			) : null}
			{/* When edgeBlur is off this wrapper is display:contents, so the viewport keeps its
			    original flex sizing against the outer surface — layout is unchanged for consumers. */}
			<div
				data-slot={edgeBlur ? "scroll-mask-blur-region" : undefined}
				className={edgeBlur ? "relative flex min-h-0 flex-1 flex-col" : "contents"}
			>
				<div
					ref={viewportRef}
					data-slot="scroll-mask-viewport"
					className={cn(
						"min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]",
						viewportClassName,
					)}
					style={{ ...maskStyle, ...viewportStyle }}
				>
					<div data-slot="scroll-mask-content" className="py-1">
						{children}
					</div>
				</div>
				{edgeBlur && showTopScrollMask ? (
					<div
						aria-hidden
						data-slot="scroll-mask-blur"
						data-edge="top"
						className="pointer-events-none absolute inset-x-0 top-0"
						style={{ height: resolvedTopFadeSize }}
					>
						{TOP_BLUR_LAYERS.map((layerStyle, index) => (
							<div key={index} style={layerStyle} />
						))}
					</div>
				) : null}
				{edgeBlur && showBottomScrollMask ? (
					<div
						aria-hidden
						data-slot="scroll-mask-blur"
						data-edge="bottom"
						className="pointer-events-none absolute inset-x-0 bottom-0"
						style={{ height: resolvedFadeSize }}
					>
						{BOTTOM_BLUR_LAYERS.map((layerStyle, index) => (
							<div key={index} style={layerStyle} />
						))}
					</div>
				) : null}
			</div>
			{footer ? (
				<div
					data-slot="scroll-mask-footer"
					className={cn("shrink-0 bg-surface px-4 py-3", footerClassName)}
				>
					{footer}
				</div>
			) : null}
		</div>
	);
}

export default ScrollMask;
