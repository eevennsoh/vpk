"use client";

// Animated "AI Sparkle" icon. Path data is split from the ADS glyph
// (`@atlaskit/icon/core/ai-sparkle`, 16×16 grid) so the star and each plus
// can move independently. Follows the same `hovered` / `singleColor` contract
// as the icons in ./animated-icon-art.
import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";

import { ROVO_GRADIENT_CSS, type RovoIconProps } from "./animated-icon-art";

const SPARKLE_STAR =
	"M8 1c.31 0 .587.19.7.479l1.63 4.19 4.192 1.632a.75.75 0 0 1 0 1.398l-4.193 1.63-1.63 4.192a.75.75 0 0 1-1.398 0L5.67 10.33 1.479 8.7a.75.75 0 0 1 0-1.398l4.19-1.631L7.301 1.48l.05-.104A.75.75 0 0 1 8 1M6.95 6.521a.75.75 0 0 1-.429.428L3.82 8l2.702 1.05a.75.75 0 0 1 .428.429l1.05 2.7 1.05-2.7.033-.073a.75.75 0 0 1 .396-.355L12.179 8l-2.7-1.05a.75.75 0 0 1-.428-.429L8 3.82z";

// Plus colors match where each plus sits on the Rovo conic gradient
// (0% = east, clockwise), so the accents read as part of the star's sweep.
const SPARKLE_PLUSES = [
	{ d: "M3 0v1.5h1.5V3H3v1.5H1.5V3H0V1.5h1.5V0z", color: "#1868DB", delay: 0 },
	{ d: "M14.5 11.5V13H16v1.5h-1.5V16H13v-1.5h-1.5V13H13v-1.5z", color: "#FCA700", delay: 0.15 },
] as const;

const EASE_IN_OUT = [0.4, 0, 0, 1] as const; // ease-in-out (bold, in-place transform)
const ENTER = { duration: 0.6, ease: EASE_IN_OUT }; // duration-slowest
const RETURN = { duration: 0.4, ease: EASE_IN_OUT }; // duration-slower
const FADE = { duration: 0.25, ease: EASE_IN_OUT }; // duration-slow
const INSTANT = { duration: 0 };

// Motion sizes SVG transforms against the element's own box, so "center"
// pivots each shape on itself.
const PIVOT = { transformBox: "fill-box", transformOrigin: "center" } as const;
const STAR_STYLE = { ...PIVOT, willChange: "transform" } as const;
const PLUS_STYLE = { ...PIVOT, willChange: "transform, opacity" } as const;
const FADE_STYLE = { willChange: "opacity" } as const;

export function AiSparkle({
	size = 20,
	color = "var(--ds-icon, #505258)",
	hovered,
	singleColor = true,
}: RovoIconProps) {
	const starMaskId = useId();
	const reduceMotion = useReducedMotion();
	const fade = reduceMotion ? INSTANT : FADE;

	const starSpin = {
		initial: { rotate: 0, scale: 1, transition: reduceMotion ? INSTANT : RETURN },
		hovered: reduceMotion
			? { rotate: 0, scale: 1, transition: INSTANT }
			: { rotate: 90, scale: [1, 0.85, 1], transition: ENTER },
	};

	const starSolid = {
		initial: { opacity: 1, transition: fade },
		hovered: { opacity: singleColor ? 1 : 0, transition: fade },
	};

	const starGradient = {
		initial: { opacity: 0, transition: fade },
		hovered: { opacity: 1, transition: fade },
	};

	return (
		<motion.svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			overflow="visible"
			initial="initial"
			animate={hovered ? "hovered" : "initial"}
		>
			<defs>
				<mask id={starMaskId}>
					<path d={SPARKLE_STAR} fill="white" />
				</mask>
			</defs>

			<motion.g variants={starSpin} style={STAR_STYLE}>
				<motion.path d={SPARKLE_STAR} fill={color} variants={starSolid} style={FADE_STYLE} />
				{singleColor ? null : (
					<motion.g variants={starGradient} style={FADE_STYLE}>
						<foreignObject x="0.5" y="0.5" width="15" height="15" mask={`url(#${starMaskId})`}>
							<div style={{ width: "100%", height: "100%", background: ROVO_GRADIENT_CSS }} />
						</foreignObject>
					</motion.g>
				)}
			</motion.g>

			{SPARKLE_PLUSES.map((plus) => (
				<SparklePlus
					key={plus.d}
					d={plus.d}
					color={color}
					accent={singleColor ? color : plus.color}
					delay={plus.delay}
					reduceMotion={reduceMotion ?? false}
				/>
			))}
		</motion.svg>
	);
}

interface SparklePlusProps {
	d: string;
	color: string;
	accent: string;
	delay: number;
	reduceMotion: boolean;
}

// Solid plus twinkles out while the accent plus pops in — the same
// hide-then-reveal handoff the magic wand's sparkles use.
function SparklePlus({ d, color, accent, delay, reduceMotion }: Readonly<SparklePlusProps>) {
	const solid = {
		initial: { opacity: 1, scale: 1, transition: reduceMotion ? INSTANT : FADE },
		hovered: reduceMotion
			? { opacity: 0, scale: 1, transition: INSTANT }
			: { opacity: 0, scale: 0, transition: { duration: 0.15, ease: EASE_IN_OUT, delay } },
	};

	const accentVariant = {
		initial: { opacity: 0, scale: reduceMotion ? 1 : 0, transition: reduceMotion ? INSTANT : { duration: 0.2, ease: EASE_IN_OUT } },
		hovered: reduceMotion
			? { opacity: 1, scale: 1, transition: INSTANT }
			: { opacity: 1, scale: [0, 1.2, 1], transition: { duration: 0.35, ease: EASE_IN_OUT, delay: delay + 0.25 } },
	};

	return (
		<g>
			<motion.path d={d} fill={color} variants={solid} style={PLUS_STYLE} />
			<motion.path d={d} fill={accent} variants={accentVariant} style={PLUS_STYLE} />
		</g>
	);
}
