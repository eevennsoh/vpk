"use client";

import { Fragment, memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";

import { JIRA_TEAM_EU26_END_PRESENTERS } from "@/components/projects/jira-team-eu26-end/data/keynote-presenters";

import { CUE } from "../data/finale-cues";
import { FINALE_BRAND, FINALE_COLORS } from "../data/finale-palette";
import { FINALE_STORIES, type FinaleChapterId, type FinaleStory } from "../data/finale-stories";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FINALE_INK, applyFinaleBuild, buildAfter, finaleBuildPaint } from "../lib/finale-build-style";
import { EASE, progress } from "../lib/finale-math";
import {
	paintWallPrint,
	wallSlotRadius,
	wallPrintCards,
	wallPrintGap,
	wallPrintOpacity,
	wallPrintShapes,
	type WallContent,
	type WallGeometry,
	type WallPrintCard,
	type WallSlot,
	type WallStatId,
} from "../lib/finale-wall-layout";
import { FinaleBuildSpan, FinaleBuildText, useFinaleBuild } from "./finale-build-text";
import { FinaleDealt, FinaleTileLogos, FINALE_TILE_RADIUS_CSS } from "./finale-tile";
import { FinaleTileFace } from "./finale-tile-face";
import { WallLanyard } from "./finale-wall-lanyard";
import { WallPieces } from "./finale-wall-pieces";
import { FinaleTitleLockup } from "./finale-title-lockup";

/*
 * What each wall slot shows. A card that lands on the wall comes down as a
 * blank sheet of its tile's colour and builds its content once its DOM face
 * takes over (`revealStart`), in the bento's own vocabulary: logos deal in
 * with the app stack's entrance, text builds through the colour band, and
 * a poster's word only starts moving once it is there. A card
 * already on the wall when it faded in (`revealStart` null) shows built.
 */

const PRESENTERS = Object.values(JIRA_TEAM_EU26_END_PRESENTERS);
const SANS = { fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" } as const;
const SUBTLE = "#6B6E76";
const LOZENGE = "rounded-[6px] px-3 py-1.5 text-[24px] leading-none font-bold tracking-normal uppercase";
/** ADS's status lozenges (a fixed brand surface, like the slide). */
const STATUS = {
	todo: { background: "#DDDEE1", color: "#292A2E" },
	progress: { background: "#E9F2FE", color: "#1558BC" },
	done: { background: "#DCFFF1", color: "#216E4E" },
} as const;
/** Each chapter's tint: the 200 steps of its poster's colour in the Team ’26 palette. */
const CHAPTER_TINT: Readonly<Record<FinaleChapterId, string>> = { Context: "#DAF0AF", Collaboration: "#E9D8F8", Confidence: "#D0E1FD" };
/** A poster's word picks up its glide over this long once it has built. */
const POSTER_RAMP_S = 1.2;

interface StageBoxProps {
	readonly slot: WallSlot;
	readonly geometry: WallGeometry;
	readonly children: (size: { readonly width: number; readonly height: number }) => ReactNode;
}

/** Lays a tile out at the 1920 stage's bento size and scales it onto its wall slot. */
function StageBox({ slot, geometry, children }: Readonly<StageBoxProps>) {
	const size = { width: slot.rect.width / geometry.typeScale, height: slot.rect.height / geometry.typeScale };
	const style: CSSProperties & { "--finale-tile-radius": string } = {
		...size,
		"--finale-tile-radius": `${wallSlotRadius(slot, geometry) / geometry.typeScale}px`,
		transform: `scale(${geometry.typeScale})`,
		transformOrigin: "0 0",
	};
	return (
		<div className="absolute top-0 left-0" style={style}>
			{children(size)}
		</div>
	);
}

/**
 * How far a poster's word has glided: steadily for one that was always there;
 * for one that landed, from rest once its word has built, easing up to pace
 * (a smoothstep's integral, so it never jerks).
 */
function posterTravel(time: number, glideStart: number | null, speed: number): number {
	if (glideStart === null) return time * speed;
	const elapsed = time - glideStart;
	if (elapsed <= 0) return 0;
	if (elapsed >= POSTER_RAMP_S) return speed * (elapsed - POSTER_RAMP_S / 2);
	const x = elapsed / POSTER_RAMP_S;
	return speed * POSTER_RAMP_S * (x ** 3 - x ** 4 / 2);
}

interface PosterProps {
	readonly word: string;
	readonly fill: string;
	readonly ink: string;
	readonly width: number;
	readonly height: number;
	readonly revealStart: number | null;
}

/** A centred chapter word glides through its compact tile; landed, it builds before it glides. */
function Poster({ word, fill, ink, width, height, revealStart }: Readonly<PosterProps>) {
	const lineRef = useRef<HTMLDivElement>(null);
	const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
	const repeatRef = useRef(0);
	const builtRef = useRef(Number.NaN);
	const travelRef = useRef(Number.NaN);
	const fontSize = Math.min(width / 2.8, height * 0.5);
	const speed = fontSize * 0.16;
	// Measured before the first frame paints the glide (a held frame paints once, at mount).
	useLayoutEffect(() => {
		repeatRef.current = wordRefs.current[0]?.offsetWidth ?? 0;
		travelRef.current = Number.NaN;
	}, [word, fontSize]);
	useFinaleFrame((time) => {
		if (revealStart !== null) {
			// Every copy builds at once, so the ones gliding in later are already built.
			const amount = progress(time, revealStart, revealStart + CUE.reveal);
			if (amount !== builtRef.current) {
				builtRef.current = amount;
				for (const copy of wordRefs.current) if (copy) applyFinaleBuild(copy, amount);
			}
		}
		const line = lineRef.current;
		const repeat = repeatRef.current;
		if (!line || repeat <= 0) return;
		const travel = posterTravel(time, buildAfter(revealStart, CUE.reveal), speed) % repeat;
		if (travel === travelRef.current) return;
		travelRef.current = travel;
		// 2D: painted inside its card (only what the tile shows is rastered). As its own layer the
		// line was the full three copies wide, and the wall's posters ran the GPU out of tile memory.
		line.style.transform = `translate(${(-travel).toFixed(1)}px, 0)`;
	});
	return (
		<div className="absolute inset-0 flex items-center overflow-hidden" style={{ background: fill, borderRadius: FINALE_TILE_RADIUS_CSS }}>
			<div ref={lineRef} className="flex shrink-0 whitespace-nowrap" style={{ fontFamily: "var(--font-sans)", fontSize, lineHeight: 1, fontWeight: 600 }}>
				{[0, 1, 2].map((copy) => (
					<span key={copy} ref={(element) => { wordRefs.current[copy] = element; }} style={{ ...finaleBuildPaint(ink, revealStart === null, "-0.045em"), textBox: "trim-both cap alphabetic", paddingRight: fontSize * 0.28 }}>
						{word}
					</span>
				))}
			</div>
		</div>
	);
}

/** A featured story's benefit line, set large on its chapter's tint, its products underneath. */
function Benefit({ story, width, height, revealStart }: Readonly<{ story: FinaleStory; width: number; height: number; revealStart: number | null }>) {
	const fontSize = Math.min(80, Math.max(52, height * 0.14), width * 0.13);
	return (
		<div className="absolute inset-0 flex flex-col justify-between overflow-hidden" style={{ ...SANS, background: CHAPTER_TINT[story.chapter], borderRadius: FINALE_TILE_RADIUS_CSS, padding: 40, color: FINALE_INK }}>
			<FinaleBuildText text={story.title} start={revealStart} tracking="-0.03em" style={{ fontSize, lineHeight: 1.04, fontWeight: 500, textWrap: "balance" }} />
			<div className="flex items-center justify-between">
				<FinaleTileLogos sources={story.apps} revealStart={revealStart} className="origin-left scale-150" />
				<FinaleBuildSpan text={story.chapter} start={buildAfter(revealStart, 0.45)} duration={CUE.reveal * 0.6} className="inline-block text-[28px] leading-none" />
			</div>
		</div>
	);
}

/** The keynote in numbers: a lozenge as Jira shows status, one figure, one line. */
const STATS: Readonly<Record<WallStatId, { readonly lozenge: string; readonly tone: { readonly background: string; readonly color: string }; readonly figure: number; readonly label: string }>> = {
	presenters: { lozenge: "On stage", tone: { background: "#E9F2FE", color: "#1558BC" }, figure: PRESENTERS.length, label: "presenters, one board" },
	chapters: { lozenge: "In progress", tone: { background: "#F8EEFE", color: "#803FA5" }, figure: 3, label: "chapters: Context, Collaboration, Confidence" },
};

/**
 * A stat's figure. Landed, it counts up from 0 as it builds, the way the
 * title's year rolls on to 26; an invisible copy of the final figure holds
 * its width, so the line beside it never shifts as the digits change.
 */
function StatFigure({ figure, size, revealStart }: Readonly<{ figure: number; size: number; revealStart: number | null }>) {
	const ref = useRef<HTMLSpanElement>(null);
	const shownRef = useRef<number | null>(null);
	useFinaleBuild(ref, revealStart);
	useFinaleFrame((time) => {
		const element = ref.current;
		if (!element || revealStart === null) return;
		const shown = Math.round(figure * EASE.outBold(progress(time, revealStart, revealStart + CUE.reveal * 0.8)));
		if (shown === shownRef.current) return;
		shownRef.current = shown;
		element.textContent = String(shown);
	});
	return (
		<span className="relative" style={{ fontSize: size, lineHeight: 0.8, fontWeight: 500 }}>
			<span className={revealStart === null ? undefined : "invisible"}>{figure}</span>
			{revealStart === null ? null : <span ref={ref} className="absolute inset-0" style={finaleBuildPaint(FINALE_INK, false)} />}
		</span>
	);
}

function Stat({ stat, width, height, revealStart }: Readonly<{ stat: WallStatId; width: number; height: number; revealStart: number | null }>) {
	const { lozenge, tone, figure, label } = STATS[stat];
	const size = Math.min(height * 0.62, width * 0.36);
	return (
		<div className="absolute inset-0 flex flex-col justify-between overflow-hidden" style={{ ...SANS, background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS_CSS, padding: 36, color: FINALE_INK }}>
			<FinaleDealt start={revealStart} className="flex self-start">
				<span className="rounded-[6px] px-3 py-1 text-[26px] leading-none font-bold tracking-normal uppercase" style={tone}>{lozenge}</span>
			</FinaleDealt>
			<div className="flex items-end gap-5">
				<StatFigure figure={figure} size={size} revealStart={buildAfter(revealStart, 0.1)} />
				<FinaleBuildSpan text={label} start={buildAfter(revealStart, 0.35)} style={{ fontSize: Math.max(30, size * 0.2), lineHeight: 1.1, textWrap: "balance" }} />
			</div>
		</div>
	);
}

const FLOW = [
	{ label: "To do", tone: STATUS.todo },
	{ label: "In progress", tone: STATUS.progress },
	{ label: "Done", tone: STATUS.done },
] as const;

/** Jira's status flow, end to end, dealt in from left to right. */
function Flow({ revealStart }: Readonly<{ revealStart: number | null }>) {
	return (
		<div className="absolute inset-0 flex items-center justify-center gap-4 overflow-hidden" style={{ ...SANS, background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS_CSS, color: SUBTLE }}>
			{FLOW.map((step, index) => (
				<Fragment key={step.label}>
					{index > 0 ? <FinaleDealt start={revealStart} index={index * 2 - 1}><span className="text-[30px]">→</span></FinaleDealt> : null}
					<FinaleDealt start={revealStart} index={index * 2}><span className={LOZENGE} style={step.tone}>{step.label}</span></FinaleDealt>
				</Fragment>
			))}
		</div>
	);
}

/**
 * One of a print slot's Done cards exactly as it was printed for the finale,
 * on its own rect, painted as its GL sheet is (`paintWallPrint`) at the same
 * resolution, so the hand-over is pixel for pixel. It shows as its own sheet
 * hands over (its slot writes `wallPrintOpacity`).
 */
function PrintCard({ card, print }: Readonly<{ card: WallPrintCard; print: HTMLCanvasElement }>) {
	const ref = useRef<HTMLCanvasElement>(null);
	const { rect, index } = card;
	useLayoutEffect(() => {
		const canvas = ref.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.max(2, Math.round(rect.width * ratio));
		canvas.height = Math.max(2, Math.round(rect.height * ratio));
		paintWallPrint(context, canvas.width, canvas.height, print);
	}, [print, rect.width, rect.height]);
	return <canvas ref={ref} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, opacity: `var(${wallPrintOpacity(index)}, 1)` }} />;
}

/**
 * Done cards exactly as they were printed for the finale, stacked down the
 * slot like a column, each a card of its own (`wallPrintCards`): the GL
 * sheets they land as, their shadows and their landing accents are on the
 * same rects, so nothing shows round them or in the gaps between them. A
 * card not yet printed is left out.
 */
function Prints({ slot, codes, prints, gap }: Readonly<{ slot: WallSlot; codes: readonly string[]; prints: readonly (HTMLCanvasElement | undefined)[]; gap: number }>) {
	const cards = useMemo(() => wallPrintCards(slot.rect, codes, wallPrintShapes((code) => prints[codes.indexOf(code)]), gap), [codes, gap, prints, slot.rect]);
	return cards.map((card) => {
		const print = prints[card.index];
		return print ? <PrintCard key={card.index} card={card} print={print} /> : null;
	});
}

/**
 * A print slot's cards, resolved as their prints arrive: a card printed after
 * its slot mounted (a rehearsal opened before every print was ready) swaps
 * in on the next frame. Until one exists, the first card's story stands in.
 * The GL sheet a print slot lands on already carries the prints, so its DOM
 * face shows them at once rather than building them.
 */
function WallPrints({ slot, geometry, codes, cardPrint, revealStart }: Readonly<WallTileContentProps & { codes: readonly string[] }>) {
	const [prints, setPrints] = useState(() => codes.map((code) => cardPrint(code)));
	// One stand-in per slot, so the memoised tile behind it is not redrawn on every render.
	const standIn = useMemo((): WallSlot | null => {
		const story = FINALE_STORIES.find((each) => each.code === codes[0]);
		return story ? { ...slot, content: { kind: "story", story } } : null;
	}, [codes, slot]);
	useFinaleFrame(() => {
		if (prints.every(Boolean)) return;
		const next = codes.map((code) => cardPrint(code));
		if (next.some((print, index) => print !== prints[index])) setPrints(next);
	});
	if (prints.some(Boolean)) return <Prints slot={slot} codes={codes} prints={prints} gap={wallPrintGap(geometry)} />;
	if (!standIn) return null;
	return <FinaleWallTileContent slot={standIn} geometry={geometry} cardPrint={cardPrint} revealStart={revealStart} />;
}

interface WallTileContentProps {
	readonly slot: WallSlot;
	readonly geometry: WallGeometry;
	readonly cardPrint: (code: string) => HTMLCanvasElement | undefined;
	/** When its content builds (it landed blank), or null: it was on the wall all along, built. */
	readonly revealStart: number | null;
}

/** What a wall slot shows, by kind. */
export const FinaleWallTileContent = memo(function FinaleWallTileContent({ slot, geometry, cardPrint, revealStart }: Readonly<WallTileContentProps>) {
	const content: WallContent = slot.content;
	if (content.kind === "print") return <WallPrints slot={slot} geometry={geometry} codes={content.codes} cardPrint={cardPrint} revealStart={revealStart} />;
	// Drawn at the slot's own pixels, not the stage box's scale, so the canvas stays sharp. It never lands, so never builds.
	if (content.kind === "lanyard") return <WallLanyard slot={slot} geometry={geometry} />;
	return (
		<StageBox slot={slot} geometry={geometry}>
			{(size) => {
				switch (content.kind) {
					case "story":
						return <FinaleTileFace story={content.story} slot={{ rect: { x: 0, y: 0, ...size }, short: slot.rect.height < slot.rect.width }} scale={1} revealStart={revealStart} />;
					case "benefit":
						return <Benefit story={content.story} {...size} revealStart={revealStart} />;
					case "poster":
						return <Poster word={content.word} fill={FINALE_BRAND[content.fill]} ink={FINALE_BRAND[content.ink]} {...size} revealStart={revealStart} />;
					case "stat":
						return <Stat stat={content.stat} {...size} revealStart={revealStart} />;
					case "strip":
						return <Flow revealStart={revealStart} />;
					case "piece":
						return <WallPieces slot={slot} geometry={geometry} pieces={content.pieces} revealStart={revealStart} />;
					case "title":
						// "Team ’26" as a card, as the bento's title became one at the throw.
						return (
							<div className="absolute inset-0 flex items-center justify-center" style={{ background: FINALE_BRAND.black, borderRadius: FINALE_TILE_RADIUS_CSS }}>
								<FinaleTitleLockup ink={FINALE_BRAND.white} revealStart={revealStart} />
							</div>
						);
					default:
						return null;
				}
			}}
		</StageBox>
	);
});
