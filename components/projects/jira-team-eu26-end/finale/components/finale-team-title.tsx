"use client";

import { useRef } from "react";

import { CUE } from "../data/finale-cues";
import type { FinaleRect } from "../data/finale-stories";
import { EASE, eased, progress } from "../lib/finale-math";
import { FINALE_INK, FINALE_INK_BLEED, applyFinaleBuild, finaleBuildGradient } from "./finale-build-text";
import { useFinaleFrame } from "./finale-frame";

/** Team 20 → Team 26: the year strip rolls through every edition. */
const YEARS = ["20", "21", "22", "23", "24", "25", "26"] as const;
const FONT_SIZE = 112;
const LINE = 1.1;
/**
 * Where Atlassian Sans digit ink sits inside one 1.1em row, in em from the row
 * top (ascent 0.973em and descent 0.241em put the baseline at 0.916em; round
 * digits reach 0.739em above it and overshoot 0.012em below).
 */
const DIGIT_TOP = 0.176;
const DIGIT_BOTTOM = 0.928;
/** Safety margin so anti-aliased neighbour ink stays outside the window. */
const DIGIT_MARGIN = 0.02;
/**
 * The year window spans the whole gap between neighbouring digits: its edges
 * sit just inside the previous digit's bottom and the next digit's top, and the
 * mask ramps across those gaps. Digits fade in and out as they roll, yet at
 * rest no neighbour ink falls inside the window at all.
 */
const YEAR_PAD_TOP = LINE - DIGIT_BOTTOM - DIGIT_MARGIN;
const YEAR_PAD_BOTTOM = DIGIT_TOP - DIGIT_MARGIN;
const YEAR_WINDOW = LINE + YEAR_PAD_TOP + YEAR_PAD_BOTTOM;
const YEAR_OPAQUE_FROM = (YEAR_PAD_TOP + DIGIT_TOP - DIGIT_MARGIN) / YEAR_WINDOW;
const YEAR_OPAQUE_TO = (YEAR_PAD_TOP + DIGIT_BOTTOM + DIGIT_MARGIN) / YEAR_WINDOW;
const YEAR_EDGE = `linear-gradient(to bottom, transparent 0%, #000 ${(YEAR_OPAQUE_FROM * 100).toFixed(2)}%, #000 ${(YEAR_OPAQUE_TO * 100).toFixed(2)}%, transparent 100%)`;

/**
 * "Team" and the year share one face so "Team 26" reads as a single line. The
 * year keeps Atlassian Sans's default proportional figures: its tabular figures
 * set "26" about 0.14em wider and looser than "Team"'s spacing.
 */
const SANS = { fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: "-0.02em" } as const;

const GRADIENT_TEXT = {
	backgroundImage: finaleBuildGradient(FINALE_INK),
	backgroundSize: "300% 100%",
	backgroundPosition: "100% 0",
	backgroundClip: "text",
	WebkitBackgroundClip: "text",
	color: "transparent",
	// Text-clipped backgrounds only paint inside the box: bleed it so ascenders
	// and descenders never clip at this tight line height (layout-neutral).
	paddingBlock: FINALE_INK_BLEED,
	marginBlock: `calc(-1 * ${FINALE_INK_BLEED})`,
} as const;

/**
 * Title in the middle of the bento, held back until the tiles are nearly all
 * in. "Team" and the year share the Atlassian Sans headline style; "Team"
 * builds through the colour band while the year fades in and rolls from 20 to
 * 26 behind a soft mask, settling in the same ink. "Team 26" then holds, centred at full size, to the final frame.
 */
export function FinaleTeamTitle({ rect, scale }: Readonly<{ rect: FinaleRect; scale: number }>) {
	const teamRef = useRef<HTMLSpanElement>(null);
	const yearRef = useRef<HTMLSpanElement>(null);
	const stripRef = useRef<HTMLSpanElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const lineHeight = FONT_SIZE * LINE;
	const yearPad = FONT_SIZE * YEAR_PAD_TOP;

	useFinaleFrame((time) => {
		// Nothing is labelled until the bento is nearly assembled.
		const root = rootRef.current;
		if (root) root.style.visibility = time >= CUE.title ? "visible" : "hidden";
		const team = teamRef.current;
		if (team) applyFinaleBuild(team, progress(time, CUE.title, CUE.title + 1.2));

		const year = yearRef.current;
		const strip = stripRef.current;
		if (year && strip) {
			year.style.opacity = String(progress(time, CUE.yearStart - 0.15, CUE.yearStart + 0.1));
			const roll = eased(time, CUE.yearStart, CUE.yearLand, EASE.inOut);
			const steps = (YEARS.length - 1) * roll;
			const speed = Math.sin(roll * Math.PI);
			strip.style.transform = `translate3d(0, ${(yearPad - steps * lineHeight).toFixed(2)}px, 0)`;
			strip.style.filter = `blur(${(speed * 3).toFixed(2)}px)`;
		}
	});

	return (
		<div
			ref={rootRef}
			aria-hidden
			className="absolute whitespace-nowrap text-center"
			style={{
				left: rect.x + rect.width / 2,
				top: rect.y + rect.height / 2,
				fontSize: FONT_SIZE,
				lineHeight: LINE,
				color: FINALE_INK,
				transform: `translate(-50%, -50%) scale(${scale})`,
				transformOrigin: "50% 50%",
				visibility: "hidden",
			}}
		>
			<div className="flex items-baseline justify-center gap-[0.22em]" style={{ height: lineHeight }}>
				<span ref={teamRef} style={{ ...SANS, ...GRADIENT_TEXT }}>Team</span>
				<span ref={yearRef} className="inline-flex items-baseline" style={{ ...SANS, opacity: 0 }}>
					{/*
					 * An invisible "26" in normal flow gives this item a real text
					 * baseline, so it shares "Team"'s baseline. The rolling strip is
					 * an overlay whose rows are the same one-line boxes, so a resting
					 * row's glyphs land exactly on the placeholder's. Proportional
					 * years differ in width, so the window shrinks to the widest year
					 * and rows start at the shared leading "2": nothing clips and the
					 * "2" stays put while only the last digit rolls.
					 */}
					<span className="relative">
						<span className="invisible">{YEARS[YEARS.length - 1]}</span>
						<span
							className="absolute left-0 overflow-hidden text-left"
							style={{ top: -yearPad, height: FONT_SIZE * YEAR_WINDOW, maskImage: YEAR_EDGE, WebkitMaskImage: YEAR_EDGE }}
						>
							<span ref={stripRef} className="flex flex-col" style={{ transform: `translate3d(0, ${yearPad}px, 0)`, willChange: "transform, filter" }}>
								{YEARS.map((year) => <span key={year} style={{ height: lineHeight }}>{year}</span>)}
							</span>
						</span>
					</span>
				</span>
			</div>
		</div>
	);
}
