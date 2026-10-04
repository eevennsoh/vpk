"use client";

import { useMemo, useRef } from "react";

import { FinaleCardSpaceGl, type FinaleGlCard } from "../components/finale-card-space-gl";
import { FinaleColumnFlash } from "../components/finale-column-flash";
import { FinaleCursors } from "../components/finale-cursor";
import { FinaleDotField } from "../components/finale-dot-field";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FinaleTeamTitle } from "../components/finale-team-title";
import { FINALE_TILE_RADIUS, FinaleTileFace } from "../components/finale-tile";
import { FinaleTileGlow } from "../components/finale-tile-glow";
import { finaleBentoLayout, type FinaleRect, type FinaleStory } from "../data/finale-stories";
import { useFinaleBoardExit } from "../hooks/use-finale-board-exit";
import type { FinaleHandoffSnapshot } from "../lib/capture-done-column";
import {
	fieldRipples,
	tileHandoff,
	tileRevealStart,
	type FinaleCardRole,
	type FinaleFit,
	type FinaleViewport,
} from "../lib/finale-card-motion";

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

interface SceneBoardToBentoProps extends FinaleSceneInput {
	readonly fit: FinaleFit;
	readonly viewport: FinaleViewport;
}

/**
 * The finale as one continuous take. Every card is a single shared layer: the
 * DOM card in Done becomes a printed GL sheet that bursts out of the column
 * into the field; the camera sweeps it and rushes in to the first card MCB
 * dragged, and each chosen sheet swoops
 * onto the page with Peel's paper wave before handing over to its DOM tile.
 */
export function SceneBoardToBento({ fit, viewport, snapshot, dragOrder, features, cardPrint, columnPrint }: Readonly<SceneBoardToBentoProps>) {
	const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
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
	// The camera frames the hero (the first card MCB dragged) for the long zoom.
	const subject = useMemo(() => cards.find((card) => card.input.role.kind === "hero")?.input.rect ?? column, [cards, column]);

	useFinaleBoardExit(slideRef);
	useFinaleFrame((time) => {
		tileRefs.current.forEach((tile, order) => {
			if (!tile) return;
			const shown = tileHandoff(time, order);
			tile.style.opacity = String(shown);
			tile.style.visibility = shown > 0 ? "visible" : "hidden";
		});
	});

	return (
		<div aria-hidden className="absolute inset-0">
			{/* The live board shows through while light sweeps its Done column; on the toss it blurs and fades out under the slide. */}
			<div ref={slideRef} className="absolute inset-0" style={{ visibility: "hidden" }} />
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
