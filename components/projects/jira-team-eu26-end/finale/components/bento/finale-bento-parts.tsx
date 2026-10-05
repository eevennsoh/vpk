"use client";

import { FINALE_COLORS } from "@/components/projects/jira-team-eu26-end/finale/data/finale-palette";

/*
 * The Founder Keynote bento's own faces (Figma "Bento", node 10774:6028):
 * a mono label top left over a slice of the product, laid out at the 1920
 * stage and run off the tile's edge under a fade of the tile's own fill.
 * They are there in full from the moment their tiles land, so they never
 * build. Slides are a fixed brand surface, so the product UI is drawn in
 * ADS's light-mode values as literals, never theme tokens.
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

const TILE_CLEAR = `${FINALE_COLORS.tile}00`;

/** The tile's own fill rising over whatever runs off its bottom (or left) edge. */
export function BentoFade({ edge = "bottom", size }: Readonly<{ edge?: "bottom" | "left"; size: number }>) {
	const style = edge === "bottom"
		? { left: 0, right: 0, bottom: 0, height: size, backgroundImage: `linear-gradient(to top, ${FINALE_COLORS.tile}, ${TILE_CLEAR})` }
		: { top: 0, bottom: 0, left: 0, width: size, backgroundImage: `linear-gradient(to right, ${FINALE_COLORS.tile}, ${TILE_CLEAR})` };
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
