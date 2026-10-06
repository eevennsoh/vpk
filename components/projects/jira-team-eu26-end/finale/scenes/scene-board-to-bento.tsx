"use client";

import { useMemo, useRef } from "react";

import { FinaleCardSpaceGl, type FinaleGlCard } from "../components/finale-card-space-gl";
import { FinaleColumnFlash } from "../components/finale-column-flash";
import { FinaleCursors } from "../components/finale-cursor";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FinaleTeamTitle } from "../components/finale-team-title";
import { FinaleBentoTile } from "../components/finale-bento-tile";
import { FINALE_TILE_RADIUS } from "../components/finale-tile";
import { FinaleTileGlow } from "../components/finale-tile-glow";
import { FinaleWall } from "../components/finale-wall";
import { FinaleWallAccents } from "../components/finale-wall-accents";
import { FinaleWallGl } from "../components/finale-wall-gl";
import { finaleBentoLayout, type FinaleRect, type FinaleStory } from "../data/finale-stories";
import { useFinaleBoardExit } from "../hooks/use-finale-board-exit";
import { finaleFacePrintKey } from "../hooks/use-finale-face-prints";
import type { FinaleHandoffSnapshot } from "../lib/capture-done-column";
import {
	tileHandoff,
	type FinaleCardRole,
	type FinaleFit,
	type FinaleViewport,
} from "../lib/finale-card-motion";
import { buildFinaleWall, wallGeometry, wallPrintShapes } from "../lib/finale-wall-layout";
import { bentoDrops, bentoTossTime } from "../lib/finale-wall-motion";
import { handoverFaceOpacity } from "../lib/finale-math";

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
	/** The bento tiles' faces as printed ahead of the finale (`finaleFacePrintKey`): each landing sheet turns into its own. */
	readonly facePrint: (key: string) => HTMLCanvasElement | undefined;
	/** The Done column as printed at the hand-off, which the flash's column pass renders. */
	readonly columnPrint?: HTMLCanvasElement;
}

/** Field cards: the Done cards in drag order (each with its finale role), then the echoes. */
function buildField(input: Pick<FinaleSceneInput, "snapshot" | "dragOrder" | "features" | "cardPrint">, column: FinaleRect, slotRects: readonly FinaleRect[]): FinaleGlCard[] {
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
			faceKey: order >= 0 ? finaleFacePrintKey(order) : undefined,
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

interface SceneBoardToBentoProps extends FinaleSceneInput {
	readonly fit: FinaleFit;
	readonly viewport: FinaleViewport;
	/** Reduced motion rests on the bento: the mega bento never mounts, nor its WebGL context. */
	readonly reducedMotion: boolean;
}

/**
 * The finale as one continuous take. Every card is a single shared layer: the
 * DOM card in Done becomes a printed GL sheet that bursts out of the column
 * into the field; the camera sweeps it and rushes in to the hero (Agent
 * Session Tracking, the bento's first feature), and each chosen sheet swoops
 * onto the page with Peel's paper wave before handing over to its DOM tile.
 * Then Act III: "Team ’26" becomes a card, and the bento's seven cards are
 * thrown, faces and all, as GL sheets carrying prints of them, to land in gaps
 * across the mega bento as it appears around them.
 */
export function SceneBoardToBento({ fit, viewport, snapshot, dragOrder, features, cardPrint, facePrint, columnPrint, reducedMotion }: Readonly<SceneBoardToBentoProps>) {
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
	// Act III: the mega bento, and the gap each bento card is thrown into.
	const geometry = useMemo(() => wallGeometry(fit.scale, viewport), [fit.scale, viewport]);
	const wall = useMemo(() => buildFinaleWall(geometry, bento, features, dragOrder), [geometry, bento, features, dragOrder]);
	const drops = useMemo(() => bentoDrops(wall, slotRects, bento.title), [wall, slotRects, bento.title]);
	// The Done cards' print shapes: a print slot's cards land, show and glow each on its own rect.
	const prints = useMemo(() => wallPrintShapes(cardPrint), [cardPrint]);
	// The camera frames the hero (the bento's first feature) for the long zoom.
	const subject = useMemo(() => cards.find((card) => card.input.role.kind === "hero")?.input.rect ?? column, [cards, column]);

	useFinaleBoardExit(slideRef);
	useFinaleFrame((time) => {
		// At the throw each tile's GL sheet, printed with its face and in place, takes over: a clean cut.
		const tossed = time >= bentoTossTime();
		tileRefs.current.forEach((tile, order) => {
			if (!tile) return;
			const shown = tossed ? 0 : handoverFaceOpacity(tileHandoff(time, order));
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
			{/* Act III: the mega bento's DOM cards (its sheets and accents are drawn over the bento, below). */}
			{reducedMotion ? null : <FinaleWall wall={wall} drops={drops} cardPrint={cardPrint} prints={prints} />}
			<FinaleTeamTitle rect={bento.title} scale={fit.scale} />
			<FinaleCardSpaceGl cards={cards} facePrint={facePrint} clip={clip} subject={subject} viewport={viewport} tileRadius={FINALE_TILE_RADIUS * fit.scale} />
			{/* The column "completes" in a sweep of light before its cards are tossed. */}
			<FinaleColumnFlash column={column} print={columnPrint} occluders={snapshot?.occluders} />
			{/* Each tile is there in full from its hand-off: its sheet landed as its face's print. */}
			{features.map((story, order) => (
				<FinaleBentoTile
					key={story.code}
					ref={(element) => { tileRefs.current[order] = element; }}
					story={story}
					slot={bento.slots[order]}
					scale={fit.scale}
					className="absolute"
					style={{ left: slotRects[order].x, top: slotRects[order].y, opacity: 0, visibility: "hidden" }}
				/>
			))}
			{/* One shared WebGL layer: each tile's whole border glows once, Pulsing Border style, as it settles. */}
			<FinaleTileGlow tiles={slotRects} radius={FINALE_TILE_RADIUS * fit.scale} scale={fit.scale} viewport={viewport} />
			{/* Act III's sheets and landing accents, over the bento's tiles: the title card hops over its neighbours as it flips. */}
			{reducedMotion ? null : (
				<>
					<FinaleWallGl wall={wall} drops={drops} viewport={viewport} fit={fit} cardPrint={cardPrint} prints={prints} facePrint={facePrint} />
					<FinaleWallAccents wall={wall} drops={drops} fit={fit} viewport={viewport} prints={prints} />
				</>
			)}
			{/* Topmost: the presenters' cursors placing the final cards. */}
			<FinaleCursors slots={bento.slots} viewport={viewport} scale={fit.scale} />
		</div>
	);
}
