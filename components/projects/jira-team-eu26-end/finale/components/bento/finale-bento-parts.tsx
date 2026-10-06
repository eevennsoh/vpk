"use client";

import type { ReactNode } from "react";

import { FINALE_COLORS } from "@/components/projects/jira-team-eu26-end/finale/data/finale-palette";
import { cn } from "@/lib/utils";

/*
 * The Founder Keynote bento's own faces (Figma "Bento", node 10774:6028):
 * a mono label top left over a slice of the product, laid out at the 1920
 * stage and run off the tile's edge under a fade of the tile's own fill.
 * They are there in full from the moment their tiles land, so they never
 * build. Slides are a fixed brand surface, so the product UI is drawn in
 * ADS's light-mode values as literals, never theme tokens. That includes
 * white and black: VPK's `bg-white` and `text-black` follow the theme, so
 * write `bg-[#FFFFFF]` (`finale-bento-tile.behavior.test.js` holds this).
 */

/** ADS `color.text.disabled` in light mode, as the Figma labels set it. */
const LABEL_INK = "rgba(8, 15, 33, 0.29)";

/** The tile's label, top left. */
export function BentoLabel({ text }: Readonly<{ text: string }>) {
	return (
		<p className="absolute top-[25px] left-[32px] font-mono text-[24px] leading-[normal] tracking-[-0.02em] whitespace-nowrap uppercase" style={{ color: LABEL_INK }}>
			{text}
		</p>
	);
}

/** A panel chart's title. */
export const BENTO_PANEL_HEADING = "text-[15px] leading-[19.98px] font-bold whitespace-nowrap text-[#292A2E]";

/**
 * Figma's "❖ Panel": a white dashboard panel, far taller than its tile, run
 * off the tile's foot. `className` places it.
 */
export function BentoPanel({ className, children }: Readonly<{ className: string; children: ReactNode }>) {
	return (
		<div className={cn("absolute flex h-[1057.691px] w-[499.5px] flex-col rounded-[16px] border-[0.45px] border-[#DDDEE1] bg-[#FFFFFF] pt-[24px] pr-[29.97px] pl-[24px] drop-shadow-[0_4.5px_13.5px_rgba(0,0,0,0.05)]", className)}>
			<div className="flex flex-col overflow-hidden">{children}</div>
		</div>
	);
}

const TILE_CLEAR = `${FINALE_COLORS.tile}00`;

const FADE_TOWARD = { bottom: "to top", top: "to bottom", left: "to right" } as const;

interface BentoFadeProps {
	readonly edge?: keyof typeof FADE_TOWARD;
	/** Px, or a CSS length for a fade that grows with the tile. */
	readonly size: number | string;
	/** How much of the fade, from the edge in, stays solid before it clears: a share of `size`, or a CSS length. */
	readonly hold?: number | string;
}

/** The tile's own fill rising over whatever runs off one of its edges. */
export function BentoFade({ edge = "bottom", size, hold = 0 }: Readonly<BentoFadeProps>) {
	const solid = typeof hold === "number" ? `${(hold * 100).toFixed(3)}%` : hold;
	const backgroundImage = `linear-gradient(${FADE_TOWARD[edge]}, ${FINALE_COLORS.tile} ${solid}, ${TILE_CLEAR})`;
	const style = edge === "left"
		? { top: 0, bottom: 0, left: 0, width: size, backgroundImage }
		: { left: 0, right: 0, height: size, backgroundImage, ...(edge === "top" ? { top: 0 } : { bottom: 0 }) };
	return <div className="absolute" style={style} />;
}

/**
 * Figma's "✦ Generative Glow - Base": Rovo's four brand hues swept round a
 * conic gradient, skewed across its box by `matrix` (Figma's own transform),
 * to be blurred into a halo by the caller.
 */
export function bentoGenerativeGlow(width: number, height: number, matrix: string): string {
	const conic = "conic-gradient(from 90deg, rgb(252, 167, 0) 0%, rgb(252, 167, 0) 20.192%, rgb(106, 154, 35) 20.202%, rgb(106, 154, 35) 46.637%, rgb(24, 104, 219) 46.647%, rgb(24, 104, 219) 70.185%, rgb(175, 89, 224) 70.195%, rgb(175, 89, 224) 100%)";
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}' preserveAspectRatio='none'><g transform='matrix(${matrix})'><foreignObject x='-166.63' y='-166.63' width='333.25' height='333.25'><div xmlns='http://www.w3.org/1999/xhtml' style='background-image: ${conic}; height: 100%; width: 100%;'></div></foreignObject></g></svg>`;
	return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
