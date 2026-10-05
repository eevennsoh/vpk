"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from "react";

import { FinaleCardSpaceGl, type FinaleGlCard } from "../components/finale-card-space-gl";
import { FinaleColumnFlash } from "../components/finale-column-flash";
import { FinaleCursors } from "../components/finale-cursor";
import { FinaleDotField } from "../components/finale-dot-field";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FinaleTeamTitle } from "../components/finale-team-title";
import { FINALE_TILE_RADIUS, FinaleTileFace } from "../components/finale-tile";
import { FinaleTileGlow } from "../components/finale-tile-glow";
import { FinaleWall } from "../components/finale-wall";
import { FinaleWallAccents } from "../components/finale-wall-accents";
import { FinaleWallGl } from "../components/finale-wall-gl";
import { CUE } from "../data/finale-cues";
import { FINALE_SLOT_COUNT, finaleBentoLayout, type FinaleBentoLayout, type FinaleRect, type FinaleStory } from "../data/finale-stories";
import { useFinaleBoardExit } from "../hooks/use-finale-board-exit";
import { printFinaleElement } from "../hooks/use-finale-prints";
import type { FinaleHandoffSnapshot } from "../lib/capture-done-column";
import {
	fieldRipples,
	tileHandoff,
	tileRevealStart,
	type FinaleCardRole,
	type FinaleFit,
	type FinaleViewport,
} from "../lib/finale-card-motion";
import { buildFinaleWall, wallGeometry } from "../lib/finale-wall-layout";
import { bentoDrops, bentoTossTime } from "../lib/finale-wall-motion";

/** The field always carries a full board, padding with blank sheets in rehearsal. */
const FIELD_SIZE = 13;
/** Deep-field copies of the cards that give the space its scale. */
const ECHO_COUNT = 26;

export interface FinaleSceneInput {
	readonly snapshot: FinaleHandoffSnapshot | null;
	/** Codes in the order MCB dragged them into Done. */
	readonly dragOrder: readonly string[];
	/** Bento tiles in landing order; the first is the hero the camera dives into. */
	readonly features: readonly FinaleStory[];
	readonly cardPrint: (code: string) => HTMLCanvasElement | undefined;
	/** The Done column as printed at the hand-off, which the flash's column pass renders. */
	readonly columnPrint?: HTMLCanvasElement;
}

/** Field cards: the Done cards in drag order (each with its finale role), then the echoes. */
function buildField(input: FinaleSceneInput, column: FinaleRect, slotRects: readonly FinaleRect[]): FinaleGlCard[] {
	const captured = input.snapshot?.cards ?? [];
	const byCode = new Map(captured.map((card) => [card.code, card]));
	const ordered = [
		...input.dragOrder.filter((code) => byCode.has(code)),
		...captured.map((card) => card.code).filter((code) => !input.dragOrder.includes(code)),
	];
	for (const story of input.features) if (!ordered.includes(story.code)) ordered.push(story.code);
	while (ordered.length < FIELD_SIZE) ordered.push(`rehearsal-${ordered.length}`);
	const placeholder = (index: number): FinaleRect => ({ x: column.x + 8, y: column.y + 48 + (index % 6) * 14, width: Math.max(160, column.width - 16), height: 168 });
	const rects = ordered.map((code, index) => byCode.get(code)?.rect ?? placeholder(index));
	// The column empties from the top down.
	const byHeight = rects.map((rect, index) => ({ y: rect.y, index })).sort((a, b) => a.y - b.y);
	const burstIndex = new Map(byHeight.map((entry, rank) => [entry.index, rank]));

	const cards = ordered.map((code, dragIndex): FinaleGlCard => {
		const order = input.features.findIndex((story) => story.code === code);
		const role: FinaleCardRole = order === 0
			? { kind: "hero", slot: slotRects[0] }
			: order > 0 ? { kind: "tile", order, slot: slotRects[order] } : { kind: "extra" };
		return {
			key: `${code}-${dragIndex}`,
			input: { rect: rects[dragIndex], fieldIndex: dragIndex, fieldCount: ordered.length, burstIndex: burstIndex.get(dragIndex) ?? dragIndex, role },
			printKey: code,
			print: input.cardPrint(code),
			resolvePrint: () => input.cardPrint(code),
			tileOrder: order >= 0 ? order : undefined,
		};
	});
	const echoes = Array.from({ length: ECHO_COUNT }, (_, index): FinaleGlCard => {
		const donor = cards[index % cards.length];
		return {
			key: `echo-${index}`,
			input: { rect: donor.input.rect, fieldIndex: index, fieldCount: ECHO_COUNT, burstIndex: 0, role: { kind: "echo" } },
			printKey: donor.printKey,
			print: donor.print,
			resolvePrint: donor.resolvePrint,
		};
	});
	return [...echoes, ...cards];
}

/** The bento's static hold: every tile has built, so a print now costs a frame nobody is watching. */
const BENTO_FACES_BUILT = tileRevealStart(FINALE_SLOT_COUNT - 1) + CUE.reveal;

/** A detached copy of a tile wrapper as it rests: shown, unmoved, at its own origin. */
function settleTileCopy(copy: HTMLElement): void {
	copy.style.opacity = "1";
	copy.style.visibility = "visible";
	copy.style.transform = "none";
	copy.style.left = "0px";
	copy.style.top = "0px";
}

interface FacePrintRun {
	cancelled: boolean;
	started: boolean;
}

/**
 * Prints of the bento's tile faces (`bento-<order>`) for the GL sheets that
 * carry them into the mega bento: taken once in the bento's static hold, one
 * after another, or at once if the scene mounts past it (a seek, a held
 * frame). Each prints a detached copy forced visible, so a tile already handed
 * to its sheet still prints. A new layout reprints, the old prints standing in
 * until then; unmounting stops a run.
 */
function useBentoFacePrints(tileRefs: RefObject<(HTMLDivElement | null)[]>, bento: FinaleBentoLayout): (key: string) => HTMLCanvasElement | undefined {
	const printsRef = useRef(new Map<string, HTMLCanvasElement>());
	const runRef = useRef<FacePrintRun | null>(null);
	const lastTimeRef = useRef<number | null>(null);

	const print = useCallback((run: FacePrintRun) => {
		run.started = true;
		void (async () => {
			for (const [order, tile] of [...tileRefs.current.entries()]) {
				if (run.cancelled) return;
				if (!tile) continue;
				const face = await printFinaleElement(tile, { detach: true, prepare: settleTileCopy }).catch(() => undefined);
				if (run.cancelled) return;
				if (face) printsRef.current.set(`bento-${order}`, face);
			}
		})();
	}, [tileRefs]);

	// Before the frame below subscribes, so a scene mounted on a held frame past the hold prints at once.
	useLayoutEffect(() => {
		const run: FacePrintRun = { cancelled: false, started: false };
		runRef.current = run;
		if ((lastTimeRef.current ?? Number.NEGATIVE_INFINITY) >= BENTO_FACES_BUILT) print(run);
		return () => {
			run.cancelled = true;
		};
	}, [bento, print]);

	useFinaleFrame((time) => {
		lastTimeRef.current = time;
		const run = runRef.current;
		if (run && !run.started && time >= BENTO_FACES_BUILT) print(run);
	});

	return useCallback((key: string) => printsRef.current.get(key), []);
}

interface SceneBoardToBentoProps extends FinaleSceneInput {
	readonly fit: FinaleFit;
	readonly viewport: FinaleViewport;
	/** Reduced motion rests on the bento: the mega bento never mounts, nor its WebGL context. */
	readonly reducedMotion: boolean;
}

/**
 * The finale as one continuous take. Every card is a single shared layer: the
 * DOM card in Done becomes a printed GL sheet that bursts out of the column
 * into the field; the camera sweeps it and rushes in to the first card MCB
 * dragged, and each chosen sheet swoops
 * onto the page with Peel's paper wave before handing over to its DOM tile.
 * Then Act III: "Team ’26" becomes a card, and the bento's seven cards are
 * thrown, faces and all, as GL sheets carrying prints of them, to land in gaps
 * across the mega bento as it appears around them.
 */
export function SceneBoardToBento({ fit, viewport, snapshot, dragOrder, features, cardPrint, columnPrint, reducedMotion }: Readonly<SceneBoardToBentoProps>) {
	const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
	const writtenRefs = useRef<number[]>([]);
	const slideRef = useRef<HTMLDivElement>(null);
	const column = useMemo(
		() => snapshot?.column ?? { x: viewport.width / 2 - 150, y: 80, width: 300, height: viewport.height - 160 },
		[snapshot, viewport],
	);
	// Only the scroll viewport's height clips; cards never overhang the column sideways.
	const clip = useMemo(() => {
		const list = snapshot?.list ?? column;
		return { x: column.x, y: list.y, width: column.width, height: list.height };
	}, [column, snapshot]);
	const bento = useMemo(() => finaleBentoLayout(viewport, fit.scale), [fit.scale, viewport]);
	const slotRects = useMemo(() => bento.slots.map((slot) => slot.rect), [bento]);
	// Stable identity: the GL scene rebuilds only when its inputs change.
	const cards = useMemo(
		() => buildField({ snapshot, dragOrder, features, cardPrint }, column, slotRects),
		[snapshot, dragOrder, features, cardPrint, column, slotRects],
	);
	const ripples = useMemo(() => fieldRipples(slotRects), [slotRects]);
	// Act III: the mega bento, and the gap each bento card is thrown into.
	const geometry = useMemo(() => wallGeometry(bento, fit.scale, viewport), [bento, fit.scale, viewport]);
	const wall = useMemo(() => buildFinaleWall(geometry, bento, features, dragOrder), [geometry, bento, features, dragOrder]);
	const drops = useMemo(() => bentoDrops(wall, slotRects, bento.title), [wall, slotRects, bento.title]);
	// The camera frames the hero (the first card MCB dragged) for the long zoom.
	const subject = useMemo(() => cards.find((card) => card.input.role.kind === "hero")?.input.rect ?? column, [cards, column]);

	useFinaleBoardExit(slideRef);
	const facePrint = useBentoFacePrints(tileRefs, bento);
	useFinaleFrame((time) => {
		// At the throw each tile's GL sheet, printed with its face and in place, takes over: a clean cut.
		const tossed = time >= bentoTossTime();
		tileRefs.current.forEach((tile, order) => {
			if (!tile) return;
			const shown = tossed ? 0 : tileHandoff(time, order);
			if (writtenRefs.current[order] === shown) return;
			writtenRefs.current[order] = shown;
			tile.style.opacity = String(shown);
			tile.style.visibility = shown > 0 ? "visible" : "hidden";
		});
	});

	return (
		<div aria-hidden className="absolute inset-0">
			{/* The live board shows through while light sweeps its Done column; on the toss it blurs and fades out under the slide. */}
			<div ref={slideRef} className="absolute inset-0" style={{ visibility: "hidden" }} />
			{/* Act III: the mega bento's DOM cards, the sheets landing on it, and the accents of each landing. */}
			{reducedMotion ? null : (
				<>
					<FinaleWall wall={wall} drops={drops} cardPrint={cardPrint} />
					<FinaleWallGl wall={wall} drops={drops} viewport={viewport} fit={fit} cardPrint={cardPrint} facePrint={facePrint} />
					<FinaleWallAccents wall={wall} drops={drops} fit={fit} viewport={viewport} />
				</>
			)}
			<FinaleTeamTitle rect={bento.title} scale={fit.scale} />
			<FinaleCardSpaceGl cards={cards} clip={clip} subject={subject} viewport={viewport} tileRadius={FINALE_TILE_RADIUS * fit.scale} />
			{/* The column "completes" in a sweep of light before its cards are tossed. */}
			<FinaleColumnFlash column={column} print={columnPrint} occluders={snapshot?.occluders} />
			{features.map((story, order) => {
				const rect = slotRects[order];
				return (
					<div
						key={story.code}
						ref={(element) => { tileRefs.current[order] = element; }}
						className="absolute"
						style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, opacity: 0, visibility: "hidden" }}
					>
						<div style={{ transform: `scale(${fit.scale})`, transformOrigin: "0 0" }}>
							<FinaleTileFace story={story} slot={bento.slots[order]} scale={fit.scale} revealStart={tileRevealStart(order)} />
						</div>
					</div>
				);
			})}
			{/* One shared WebGL layer: each tile's whole border glows once, Pulsing Border style, as it settles. */}
			<FinaleTileGlow tiles={slotRects} radius={FINALE_TILE_RADIUS * fit.scale} scale={fit.scale} viewport={viewport} />
			{/* Above the tiles: each touchdown pulses a dot lattice inside its own tile. */}
			<FinaleDotField fit={fit} viewport={viewport} ripples={ripples} radius={FINALE_TILE_RADIUS * fit.scale} />
			{/* Topmost: the presenters' cursors placing the final cards. */}
			<FinaleCursors slots={bento.slots} viewport={viewport} scale={fit.scale} />
		</div>
	);
}
