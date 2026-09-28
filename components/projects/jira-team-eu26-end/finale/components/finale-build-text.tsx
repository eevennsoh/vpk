"use client";

import { useRef, type CSSProperties } from "react";

import { CUE } from "../data/finale-cues";
import { clamp, progress } from "../lib/finale-math";
import { useFinaleFrame } from "./finale-frame";

export const FINALE_INK = "#101214";

/**
 * How far the gradient's painting box reaches past the line boxes, above and
 * below. `background-clip: text` only paints glyph ink inside the element's
 * border box, and at the finale's tight line heights (1.05–1.1) accented caps
 * rise ~0.11em above the first line box and descenders drop ~0.06em below the
 * last one, so "g", "y", "É" were cut off. The padding is cancelled by an equal
 * negative margin, so the text itself does not move.
 */
export const FINALE_INK_BLEED = "0.25em";

/**
 * Figma "Type behavior": while building, a blue → purple → amber → green band
 * trails the reveal edge; after building, the line settles to solid ink.
 * The gradient spans 300% of the text box and slides from right to left, so
 * ink enters from the left and the unrevealed right third stays transparent.
 */
export function finaleBuildGradient(ink: string): string {
	return [
		"linear-gradient(90deg",
		`${ink} 0%`,
		// A settled word shows the first third (0–33.3%): it must be solid ink.
		`${ink} 34%`,
		"rgb(31, 105, 218) 41%",
		"rgb(193, 108, 212) 48%",
		"rgb(245, 161, 23) 55%",
		"rgba(121, 174, 68, 0.85) 61%",
		"rgba(121, 174, 68, 0) 66.6%",
		"transparent 100%)",
	].join(", ");
}

/**
 * Writes the build state for progress `amount` (0 hidden → 1 settled ink).
 * The sweep is an even smoothstep rather than a bold ease-out: a bold curve
 * spends its first frames racing, so the colour band flashed past unseen.
 */
export function applyFinaleBuild(element: HTMLElement, amount: number, lift = 0.12): void {
	const x = clamp(amount);
	const eased = x * x * (3 - 2 * x);
	element.style.backgroundPosition = `${(100 - eased * 100).toFixed(2)}% 0`;
	element.style.transform = `translate3d(0, ${((1 - eased) * lift).toFixed(3)}em, 0)`;
}

interface FinaleBuildTextProps {
	readonly text: string;
	readonly start: number;
	readonly duration?: number;
	readonly ink?: string;
	readonly className?: string;
	readonly style?: CSSProperties;
}

export function FinaleBuildText({
	text,
	start,
	duration = CUE.reveal,
	ink = FINALE_INK,
	className,
	style,
}: Readonly<FinaleBuildTextProps>) {
	const ref = useRef<HTMLSpanElement>(null);
	useFinaleFrame((time) => {
		const element = ref.current;
		if (!element) return;
		applyFinaleBuild(element, progress(time, start, start + duration));
	});
	// The paragraph owns layout (the caller's margins, size and line height);
	// the inner span owns the gradient, bleeding past the line boxes so the
	// clip never cuts ascenders, accents or descenders.
	return (
		<p className={className} style={style}>
			<span
				ref={ref}
				className="block"
				style={{
					paddingBlock: FINALE_INK_BLEED,
					marginBlock: `calc(-1 * ${FINALE_INK_BLEED})`,
					backgroundImage: finaleBuildGradient(ink),
					backgroundSize: "300% 100%",
					backgroundPosition: "100% 0",
					backgroundClip: "text",
					WebkitBackgroundClip: "text",
					color: "transparent",
					letterSpacing: "-0.02em",
					fontFeatureSettings: '"liga" 0, "calt" 0',
					willChange: "background-position, transform",
				}}
			>
				{text}
			</span>
		</p>
	);
}
