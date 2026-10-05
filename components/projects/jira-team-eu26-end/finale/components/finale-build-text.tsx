"use client";

import { useRef, type CSSProperties, type RefObject } from "react";

import { CUE } from "../data/finale-cues";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FINALE_INK, FINALE_INK_BLEED, applyFinaleBuild, finaleBuildGradient } from "../lib/finale-build-style";
import { progress } from "../lib/finale-math";

/** `start` pushed back by `delay`, keeping "already built" (null) as it is. */
export function buildAfter(start: number | null, delay: number): number | null {
	return start === null ? null : start + delay;
}

/**
 * Builds `ref`'s text through the colour band from `start` (finale-clock
 * seconds) over `duration`. A null start is already built and has nothing to
 * run. It writes only when the amount moves, so a settled piece costs a
 * comparison a frame.
 */
export function useFinaleBuild(ref: RefObject<HTMLElement | null>, start: number | null, duration: number = CUE.reveal): void {
	const amountRef = useRef(Number.NaN);
	useFinaleFrame((time) => {
		const element = ref.current;
		if (!element || start === null) return;
		const amount = progress(time, start, start + duration);
		if (amount === amountRef.current) return;
		amountRef.current = amount;
		applyFinaleBuild(element, amount);
	});
}

/**
 * The build's paint: the gradient clipped to the glyphs, bled past the line
 * boxes so the clip never cuts ascenders, accents or descenders (the bleed
 * is cancelled by an equal negative margin, so nothing moves). Text that is
 * already built is plain ink, with no gradient to paint.
 */
export function finaleBuildPaint(ink: string, built: boolean, tracking = "-0.02em"): CSSProperties {
	const type: CSSProperties = { paddingBlock: FINALE_INK_BLEED, marginBlock: `calc(-1 * ${FINALE_INK_BLEED})`, letterSpacing: tracking, fontFeatureSettings: '"liga" 0, "calt" 0' };
	if (built) return { ...type, color: ink };
	return {
		...type,
		backgroundImage: finaleBuildGradient(ink),
		backgroundSize: "300% 100%",
		backgroundPosition: "100% 0",
		backgroundClip: "text",
		WebkitBackgroundClip: "text",
		color: "transparent",
	};
}

interface FinaleBuildSpanProps {
	readonly text: string;
	/** When it starts to build (finale-clock seconds); null: already built. */
	readonly start: number | null;
	readonly duration?: number;
	readonly ink?: string;
	/** Letter spacing: the finale's headings set -0.02em. */
	readonly tracking?: string;
	/** Inline-block by default, so it lifts as it builds; plain inline text builds line by line instead. */
	readonly className?: string;
	readonly style?: CSSProperties;
}

/** A run of text that builds through the colour band, in its own ink. */
export function FinaleBuildSpan({ text, start, duration, ink = FINALE_INK, tracking = "-0.02em", className = "inline-block", style }: Readonly<FinaleBuildSpanProps>) {
	const ref = useRef<HTMLSpanElement>(null);
	useFinaleBuild(ref, start, duration);
	return (
		<span ref={ref} className={className} style={{ ...finaleBuildPaint(ink, start === null, tracking), ...style }}>
			{text}
		</span>
	);
}

type FinaleBuildTextProps = Omit<FinaleBuildSpanProps, "className" | "style"> & {
	readonly className?: string;
	readonly style?: CSSProperties;
};

/**
 * A heading that builds: the paragraph owns layout (the caller's margins,
 * size and line height), the inner span the gradient.
 */
export function FinaleBuildText({ className, style, ...build }: Readonly<FinaleBuildTextProps>) {
	return (
		<p className={className} style={style}>
			<FinaleBuildSpan {...build} className="block" />
		</p>
	);
}
