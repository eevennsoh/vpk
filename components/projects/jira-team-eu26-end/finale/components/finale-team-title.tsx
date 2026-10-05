"use client";

import { useRef } from "react";

import { CUE } from "../data/finale-cues";
import { FINALE_COLORS } from "../data/finale-palette";
import type { FinaleRect } from "../data/finale-stories";
import { FINALE_TITLE } from "../data/finale-title";
import { EASE, eased, lerp, progress } from "../lib/finale-math";
import { bentoTitleFlipTime, bentoTitleForm } from "../lib/finale-wall-motion";
import { FINALE_INK, FINALE_INK_BLEED, applyFinaleBuild, finaleBuildGradient } from "../lib/finale-build-style";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FINALE_TILE_RADIUS } from "./finale-tile";

/** ’20 → ’26: the year strip rolls through every edition. */
const YEARS = ["20", "21", "22", "23", "24", "25", "26"] as const;
const { fontSize: FONT_SIZE, line: LINE } = FINALE_TITLE;
/**
 * The year strip's row pitch, taller than the title's tight lines so the
 * rolling digits clear one another.
 */
const ROW = 1.1;
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
const YEAR_PAD_TOP = ROW - DIGIT_BOTTOM - DIGIT_MARGIN;
const YEAR_PAD_BOTTOM = DIGIT_TOP - DIGIT_MARGIN;
const YEAR_WINDOW = ROW + YEAR_PAD_TOP + YEAR_PAD_BOTTOM;
const YEAR_OPAQUE_FROM = (YEAR_PAD_TOP + DIGIT_TOP - DIGIT_MARGIN) / YEAR_WINDOW;
const YEAR_OPAQUE_TO = (YEAR_PAD_TOP + DIGIT_BOTTOM + DIGIT_MARGIN) / YEAR_WINDOW;
const YEAR_EDGE = `linear-gradient(to bottom, transparent 0%, #000 ${(YEAR_OPAQUE_FROM * 100).toFixed(2)}%, #000 ${(YEAR_OPAQUE_TO * 100).toFixed(2)}%, transparent 100%)`;
/**
 * A resting row's top in the year's one-line box, in em. Both centre the
 * font's ascent and descent on their leading, so only the difference in line
 * height sets it, and its digits land exactly on the box's own.
 */
const ROW_REST = (LINE - ROW) / 2;
/** "Europe" starts to build as the year arrives. */
const EUROPE_DELAY = 0.3;

/**
 * Both lines share one face, so "Team ’26" reads as a single line over
 * "Europe". The year keeps Atlassian Sans's default proportional figures: its
 * tabular figures set "26" about 0.14em wider and looser than "Team"'s spacing.
 */
const SANS = { fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: `${FINALE_TITLE.tracking}em` } as const;

/** The scale the title card's face rises from. */
const FORM_FROM = 0.9;

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
 * in. "Team" builds through the colour band while the year fades in and
 * rolls from ’20 to ’26 behind a soft mask, settling in the same ink, and
 * "Europe" builds under them. "Team ’26 Europe" then holds, at full size, to
 * the final frame.
 * As Act III begins it becomes a card of its own: a grey tile, the bento's
 * own, rises under the type. Formed, it hands over to its GL sheet, which
 * flips it end over end like paper to its black back (`finale-wall-motion.ts`).
 */
export function FinaleTeamTitle({ rect, scale }: Readonly<{ rect: FinaleRect; scale: number }>) {
	const teamRef = useRef<HTMLSpanElement>(null);
	const yearRef = useRef<HTMLSpanElement>(null);
	const stripRef = useRef<HTMLSpanElement>(null);
	const europeRef = useRef<HTMLSpanElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const faceRef = useRef<HTMLDivElement>(null);
	const formRef = useRef(Number.NaN);
	const lineHeight = FONT_SIZE * LINE;
	const rowHeight = FONT_SIZE * ROW;
	const yearPad = FONT_SIZE * YEAR_PAD_TOP;

	useFinaleFrame((time) => {
		// Nothing is labelled until the bento is nearly assembled, and from its flip its GL sheet carries it.
		const root = rootRef.current;
		const flipped = time >= bentoTitleFlipTime();
		const visibility = time >= CUE.title && !flipped ? "visible" : "hidden";
		if (root && root.style.visibility !== visibility) root.style.visibility = visibility;
		// Through the flip and the wall's glide there is nothing left to write.
		if (flipped) return;
		const team = teamRef.current;
		if (team) applyFinaleBuild(team, progress(time, CUE.title, CUE.title + 1.2));
		const europe = europeRef.current;
		if (europe) applyFinaleBuild(europe, progress(time, CUE.title + EUROPE_DELAY, CUE.title + EUROPE_DELAY + 1.2));

		const year = yearRef.current;
		const strip = stripRef.current;
		if (year && strip) {
			year.style.opacity = String(progress(time, CUE.yearStart - 0.15, CUE.yearStart + 0.1));
			const roll = eased(time, CUE.yearStart, CUE.yearLand, EASE.inOut);
			const steps = (YEARS.length - 1) * roll;
			const speed = Math.sin(roll * Math.PI);
			strip.style.transform = `translate3d(0, ${(yearPad - steps * rowHeight).toFixed(2)}px, 0)`;
			strip.style.filter = `blur(${(speed * 3).toFixed(2)}px)`;
		}

		// The title card: a grey tile forms under the type, flat on the slide, as its GL sheet will take it.
		const form = bentoTitleForm(time);
		if (form === formRef.current) return;
		formRef.current = form;
		if (faceRef.current) {
			faceRef.current.style.opacity = form.toFixed(3);
			faceRef.current.style.transform = `translate(-50%, -50%) scale(${lerp(FORM_FROM, 1, form).toFixed(4)})`;
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
			{/* The card's grey face: the title's own box at stage size (the root is scaled), with the bento tiles' corner. */}
			<div
				ref={faceRef}
				className="absolute top-1/2 left-1/2 -z-10"
				style={{ width: rect.width / scale, height: rect.height / scale, borderRadius: FINALE_TILE_RADIUS, background: FINALE_COLORS.tile, opacity: 0, transform: "translate(-50%, -50%)" }}
			/>
			{/* The type sits a little above the card's centre, as the Figma sets it. */}
			<div className="relative" style={{ ...SANS, top: -FINALE_TITLE.lift }}>
				<div style={{ height: lineHeight, marginBottom: FONT_SIZE * FINALE_TITLE.gap }}>
					<span ref={teamRef} className="inline-block" style={GRADIENT_TEXT}>Team</span>
					<span ref={yearRef} style={{ opacity: 0 }}>
						{" ’"}
						{/*
						 * An invisible "26" sets the year's one-line box and its
						 * baseline. The rolling strip is an overlay of taller rows
						 * placed so a resting row's glyphs land exactly on the
						 * placeholder's. Proportional years differ in width, so the
						 * window shrinks to the widest year and rows start at the
						 * shared leading "2": nothing clips and the "2" stays put
						 * while only the last digit rolls.
						 */}
						<span className="relative inline-block">
							<span className="invisible">{YEARS[YEARS.length - 1]}</span>
							<span
								className="absolute left-0 overflow-hidden text-left"
								style={{ top: FONT_SIZE * ROW_REST - yearPad, height: FONT_SIZE * YEAR_WINDOW, maskImage: YEAR_EDGE, WebkitMaskImage: YEAR_EDGE }}
							>
								<span ref={stripRef} className="flex flex-col" style={{ lineHeight: ROW, transform: `translate3d(0, ${yearPad}px, 0)`, willChange: "transform, filter" }}>
									{YEARS.map((year) => <span key={year} style={{ height: rowHeight }}>{year}</span>)}
								</span>
							</span>
						</span>
					</span>
				</div>
				<div style={{ height: lineHeight }}>
					<span ref={europeRef} className="inline-block" style={GRADIENT_TEXT}>Europe</span>
				</div>
			</div>
		</div>
	);
}
