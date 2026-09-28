"use client";

import { useRef, type CSSProperties } from "react";

import { CUE } from "../data/finale-cues";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FINALE_INK, FINALE_INK_BLEED, applyFinaleBuild, finaleBuildGradient } from "../lib/finale-build-style";
import { progress } from "../lib/finale-math";

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
