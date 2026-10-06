import kitPieces from "@/public/1p/rovo-stage-kit/pieces.json";
import stageFile from "@/public/1p/rovo-stage-kit/rovo-stage.json";
import type { ComposedPiece, KitPiece, PieceId, StageFile } from "@/public/1p/rovo-stage-kit/types/stage-file";

import { FINALE_STORIES, finaleBentoLayout, type FinaleBentoLayout, type FinaleChapterId, type FinaleRect, type FinaleStory } from "../data/finale-stories";
import type { FinaleBrandColor } from "../data/finale-palette";
import { FINALE_TITLE } from "../data/finale-title";
import { packWallMasonry, type MasonryItem } from "./finale-wall-masonry";
import { wallPiecesLayout } from "./finale-wall-pieces";

/** Scale of the keynote tiles and their typography after the throw. */
export const WALL_SCALE = 0.3;
export const WALL_TITLE_ORDER = 6;
/** Original entry-camera calibration, independent of tile sizing and spatial indexing. */
const WALL_ENTRY_SCALE = 68 / 231;
/**
 * Lanyard tiles a period carries, spread evenly through it, each in the
 * lanyard's own 3:4 portrait box at the 1920 stage. Their straps are cut
 * straight at the top of the box, so every one hangs from the top edge of the
 * frame (`wallLanyardRect`), never mid-wall. Three, not four: each takes the
 * space of cards that would arrive and be set down, and four dropped the
 * teammates' drags below their cadence (`finale-wall-cursors.test.js`).
 */
export const WALL_LANYARDS = { count: 3, width: 360, height: 480 } as const;
/**
 * Done cards dealt a second time each loop, where the feature-name tiles once
 * were, so teammates still have as many cards to set down (the drag cadence
 * in `finale-wall-cursors.test.js`). Eight, measured: the cadence moves with
 * the masonry's packing, and eight keeps every screen from 1024 to 2560 wide
 * over its floor, where six, seven and nine each leave one under it.
 */
export const WALL_RECYCLED_PRINTS = 8;

export type WallStatId = "presenters" | "chapters";
export type WallStripId = "flow";
export type WallPiece = Pick<KitPiece, "id" | "scale">;
export type WallContent =
	| { readonly kind: "story"; readonly story: FinaleStory }
	| { readonly kind: "print"; readonly codes: readonly [string] }
	| { readonly kind: "poster"; readonly word: FinaleChapterId; readonly fill: FinaleBrandColor; readonly ink: FinaleBrandColor }
	| { readonly kind: "stat"; readonly stat: WallStatId }
	| { readonly kind: "strip"; readonly strip: WallStripId }
	| { readonly kind: "piece"; readonly pieces: readonly WallPiece[] }
	/** `order`: its place in the wall's endless run of lanyards (each copy of the period continues it), which deals its presenter and agent. */
	| { readonly kind: "lanyard"; readonly order: number }
	| { readonly kind: "title" };

export interface WallGeometry {
	readonly gutter: number;
	readonly gutterY: number;
	/** Spatial indexing only. Items never snap to these buckets. */
	readonly bucketWidth: number;
	/** Widest original card for the arrival's leading edge, in viewport px. */
	readonly arrivalWidth: number;
	/** Original right-edge entry distance, in viewport px. */
	readonly arrivalReach: number;
	readonly maxTileWidth: number;
	readonly originX: number;
	readonly typeScale: number;
	/** One camera scale for every library piece, over its authored instance scale. */
	readonly pieceScale: number;
	readonly radius: number;
	readonly viewport: { readonly width: number; readonly height: number };
}

export interface WallSlot {
	readonly key: string;
	readonly bucket: number;
	readonly rect: FinaleRect;
	readonly seed: number;
	readonly content: WallContent;
	readonly reserved?: number;
}

export interface WallGap {
	readonly order: number;
	readonly kind: "tile" | "title";
	readonly slot: WallSlot;
}

export interface FinaleWall {
	readonly geometry: WallGeometry;
	readonly periodWidth: number;
	readonly periodBuckets: number;
	readonly items: readonly WallSlot[];
	readonly bucket: (index: number) => readonly WallSlot[];
	readonly gaps: readonly WallGap[];
}

export function wrap(value: number, period: number): number {
	return ((value % period) + period) % period;
}

type WallStagePiece = Pick<ComposedPiece, "key" | "scale"> & { readonly id: string };
type WallStageSource = {
	readonly composition: { readonly pieces: readonly WallStagePiece[] } | null;
	readonly board: { readonly cells: { readonly a: Pick<StageFile["board"]["cells"]["a"], "options"> } };
};

/** Explicit instances keep their scales; automatic stages use the enabled catalogue and density. */
export function resolveWallStagePieces(stage: WallStageSource): readonly WallStagePiece[] {
	if (stage.composition !== null) return stage.composition.pieces;
	const options = stage.board.cells.a.options ?? {};
	const density = options.density === "gallery" ? 1 : options.density === "dense" ? 0.76 : 0.88;
	const enabled = kitPieces.filter((piece) => {
		const shown = options[`show${piece.group[0].toUpperCase()}${piece.group.slice(1)}`];
		return typeof shown === "boolean" ? shown : piece.group !== "apps";
	});
	const groups = [...new Set(enabled.map((piece) => piece.group))].map((group) => enabled.filter((piece) => piece.group === group));
	const ordered: typeof kitPieces = [];
	for (let index = 0; index < Math.max(0, ...groups.map((group) => group.length)); index += 1) {
		for (const group of groups) {
			const piece = group[index];
			if (piece) ordered.push(piece);
		}
	}
	return ordered.map((piece) => ({
		key: `library-${piece.id}`,
		id: piece.id,
		scale: piece.scale * density,
	}));
}

function wallStageGap(option: string | boolean | undefined): number {
	const value = typeof option === "string" ? Number(option) : Number.NaN;
	return Number.isFinite(value) ? Math.min(160, Math.max(0, value)) : 28;
}

export function wallGeometry(fitScale: number, viewport: { readonly width: number; readonly height: number }): WallGeometry {
	const referenceWidth = finaleBentoLayout(viewport, fitScale).slots[0].rect.width * WALL_ENTRY_SCALE;
	// The exported zoom frames the kit; a shared 1.25 enlargement makes its animated UI readable.
	const pieceScale = fitScale * stageFile.board.cells.a.zoom * 1.25;
	const maxPieceWidth = Math.max(...resolveWallStagePieces(stageFile).map((placed) => {
		const piece = kitPieces.find((each) => each.id === placed.id);
		return piece ? (piece.w * placed.scale + 80) * pieceScale : 0;
	}));
	return {
		gutter: wallStageGap(stageFile.board.cells.a.options.masonryGapX) * fitScale,
		gutterY: wallStageGap(stageFile.board.cells.a.options.masonryGapY) * fitScale,
		bucketWidth: 256 * fitScale,
		arrivalWidth: referenceWidth * 2 + 32 * fitScale,
		arrivalReach: referenceWidth + 32 * fitScale,
		maxTileWidth: Math.max(maxPieceWidth, 480 * fitScale),
		originX: 0,
		typeScale: fitScale * WALL_SCALE,
		pieceScale,
		radius: 20,
		viewport,
	};
}

/** Every wall container keeps its corners in viewport pixels, including custom coloured tiles. */
export function wallSlotRadius(_slot: WallSlot, geometry: WallGeometry): number {
	return geometry.radius;
}

interface WallItem extends MasonryItem {
	readonly content: WallContent;
}

function isPieceId(id: string): id is PieceId {
	return kitPieces.some((piece) => piece.id === id);
}

function libraryItems(geometry: WallGeometry): readonly WallItem[] {
	return resolveWallStagePieces(stageFile).flatMap((placed) => {
		if (!isPieceId(placed.id)) return [];
		const piece = kitPieces.find((each) => each.id === placed.id);
		if (!piece) return [];
		const layout = wallPiecesLayout([{ ...piece, id: placed.id, scale: placed.scale }], geometry.pieceScale);
		return [{ key: placed.key, width: layout.width, height: layout.height, content: { kind: "piece" as const, pieces: [{ id: placed.id, scale: placed.scale }] } }];
	});
}

function keynoteItems(geometry: WallGeometry, features: readonly FinaleStory[], dragOrder: readonly string[]): readonly WallItem[] {
	const scale = geometry.typeScale / WALL_SCALE;
	const item = (key: string, width: number, height: number, content: WallContent): WallItem => ({ key, width: width * scale, height: height * scale, content, ...(content.kind === "poster" ? { group: "chapter" } : {}) });
	const featured = new Set(features.map((story) => story.code));
	const remaining = FINALE_STORIES.map((story) => story.code).filter((code) => !featured.has(code));
	const ordered = [...dragOrder.filter((code) => remaining.includes(code)), ...remaining.filter((code) => !dragOrder.includes(code))];
	const print = (key: string, code: string) => item(key, 260, 140, { kind: "print", codes: [code] });
	// The run's last cards come round again first, so a card's two copies sit far apart on the wall.
	const extras: WallItem[] = ordered.slice(-WALL_RECYCLED_PRINTS).map((code, index) => print(`print-again-${index}`, code));
	const posters = [
		{ word: "Context", width: 300, height: 160, fill: "lime", ink: "black" },
		{ word: "Collaboration", width: 360, height: 200, fill: "purple", ink: "black" },
		{ word: "Confidence", width: 280, height: 220, fill: "blue", ink: "white" },
	] satisfies readonly { word: FinaleChapterId; width: number; height: number; fill: FinaleBrandColor; ink: FinaleBrandColor }[];
	posters.forEach(({ word, width, height, fill, ink }, index) => extras.push(item(`poster-${index}`, width, height, { kind: "poster", word, fill, ink })));
	ordered.forEach((code, index) => extras.push(print(`print-${index}`, code)));
	extras.push(item("chapters", 180, 125, { kind: "stat", stat: "chapters" }), item("flow", 330, 65, { kind: "strip", strip: "flow" }));
	return extras;
}

/**
 * Lanyard tile `index` of a period `spacing` apart (`finale-wall-lanyard.ts`):
 * reserved before the masonry packs, like the keynote gaps, stuck to the top
 * of the frame with its top corners just above it, so the strap's straight cut
 * is the frame's own edge. The first waits just past the opening frame, clear
 * of the keynote gaps, and glides in with the wall.
 */
function wallLanyardRect(geometry: WallGeometry, index: number, spacing: number): FinaleRect {
	const scale = geometry.typeScale / WALL_SCALE;
	return { x: geometry.viewport.width + geometry.gutter + index * spacing, y: -geometry.radius, width: WALL_LANYARDS.width * scale, height: WALL_LANYARDS.height * scale };
}

/** Intrinsic rectangles packed edge to edge, with the keynote landing spaces reserved first. */
export function buildFinaleWall(geometry: WallGeometry, bento: FinaleBentoLayout, features: readonly FinaleStory[], dragOrder: readonly string[]): FinaleWall {
	const { gutter, gutterY, bucketWidth, viewport } = geometry;
	const anchors = [...bento.slots.slice(0, features.length).map((slot, order) => ({ order, rect: slot.rect, content: { kind: "story" as const, story: features[order] } })), { order: WALL_TITLE_ORDER, rect: bento.title, content: { kind: "title" as const } }];
	const reserved = anchors.map(({ order, rect }) => {
		const width = rect.width * WALL_SCALE;
		const height = order === WALL_TITLE_ORDER
			? width - (FINALE_TITLE.inkWidth - FINALE_TITLE.inkHeight) * geometry.typeScale
			: rect.height * WALL_SCALE;
		return {
			x: rect.x + (rect.width - width) / 2 - (order === WALL_TITLE_ORDER ? viewport.width * 0.12 : 0),
			y: rect.y + (rect.height - height) / 2,
			width,
			height,
		};
	});
	const library = libraryItems(geometry);
	const extras = keynoteItems(geometry, features, dragOrder);
	const items: WallItem[] = [];
	for (let index = 0; index < Math.max(library.length, extras.length); index += 1) {
		if (library[index]) items.push(library[index]);
		if (extras[index]) items.push(extras[index]);
	}
	const groupGap = 900 * geometry.typeScale / WALL_SCALE;
	// The period is only known once packed, so pack once without the lanyards to space them evenly round it, then for real.
	const unhung = packWallMasonry(items, reserved, viewport.height, gutter, gutterY, groupGap);
	const lanyardWidth = wallLanyardRect(geometry, 0, 0).width + gutter;
	const spacing = (Math.max(...[...reserved, ...unhung].map((rect) => rect.x + rect.width)) + gutter + WALL_LANYARDS.count * lanyardWidth) / WALL_LANYARDS.count;
	const lanyards = Array.from({ length: WALL_LANYARDS.count }, (_, index) => wallLanyardRect(geometry, index, spacing));
	const rects = packWallMasonry(items, [...reserved, ...lanyards], viewport.height, gutter, gutterY, groupGap);
	const base = anchors.map(({ order, content }, index): WallSlot => ({ key: `gap-${order}`, bucket: 0, rect: reserved[index], content, seed: order * 31, reserved: order }));
	lanyards.forEach((rect, index) => base.push({ key: `lanyard-${index}`, bucket: 0, rect, content: { kind: "lanyard", order: index }, seed: 977 + index * 53 }));
	items.forEach((item, index) => base.push({ key: item.key, bucket: 0, rect: rects[index], content: item.content, seed: 211 + index * 37 }));
	const periodBuckets = Math.ceil((Math.max(...base.map((slot) => slot.rect.x + slot.rect.width)) + gutter) / bucketWidth);
	const periodWidth = periodBuckets * bucketWidth;
	const indexed = base.map((slot) => ({ ...slot, bucket: Math.floor(slot.rect.x / bucketWidth) }));
	const buckets = new Map<number, readonly WallSlot[]>();
	const bucket = (index: number): readonly WallSlot[] => {
		const existing = buckets.get(index);
		if (existing) return existing;
		const copy = Math.floor(index / periodBuckets);
		const local = wrap(index, periodBuckets);
		const slots = indexed.filter((slot) => slot.bucket === local).map(({ reserved: order, ...slot }): WallSlot => ({
			...slot,
			key: `${index}:${slot.key}`,
			bucket: index,
			rect: { ...slot.rect, x: slot.rect.x + copy * periodWidth },
			// Each copy's lanyards carry on the run, so the next one along is always a new lanyard.
			...(slot.content.kind === "lanyard" ? { content: { kind: "lanyard", order: copy * WALL_LANYARDS.count + slot.content.order } } : {}),
			...(copy === 0 && order !== undefined ? { reserved: order } : {}),
		}));
		if (buckets.size >= 96) {
			const oldest = buckets.keys().next().value;
			if (oldest !== undefined) buckets.delete(oldest);
		}
		buckets.set(index, slots);
		return slots;
	};
	const first = Array.from({ length: periodBuckets }, (_, index) => bucket(index)).flat();
	const gaps = anchors.map(({ order }): WallGap => {
		const slot = first.find((each) => each.reserved === order);
		if (!slot) throw new Error(`Missing keynote landing ${order}`);
		return { order, kind: order === WALL_TITLE_ORDER ? "title" : "tile", slot };
	});
	return { geometry, periodWidth, periodBuckets, bucket, items: first, gaps };
}

/** Gap between a print slot's stacked Done cards at the 1920 stage (it scales with the type). */
const WALL_PRINT_GAP = 8;
/** A Done card's corner as a share of its width, for a print that does not say (the board's 8px card, ~390px wide). */
const WALL_PRINT_CORNER = 0.02;

/** A Done card's print as the wall fits it: its width ÷ height, and its corner radius as a share of its width. */
export interface WallPrintShape {
	readonly aspect: number;
	readonly corner: number;
}

/** A Done card's print shape by code; undefined until it is printed. */
export type WallPrintShapes = (code: string) => WallPrintShape | undefined;

/** What a print's shape is read from: its canvas, with the corner share `useFinaleCardPrints` records on it (`data-finale-corner`). */
export interface WallPrintSource {
	readonly width: number;
	readonly height: number;
	readonly dataset?: Readonly<Record<string, string | undefined>>;
}

/** The shapes of the prints `print` finds: as wide and tall as their canvases, rounded as their cards were. */
export function wallPrintShapes(print: (code: string) => WallPrintSource | undefined): WallPrintShapes {
	return (code) => {
		const source = print(code);
		if (!source || source.width <= 0 || source.height <= 0) return undefined;
		const corner = Number(source.dataset?.finaleCorner);
		return { aspect: source.width / source.height, corner: Number.isFinite(corner) && corner >= 0 ? corner : WALL_PRINT_CORNER };
	};
}

/** One of a print slot's Done cards, where it shows in the slot. */
export interface WallPrintCard {
	/** Its place in the slot's `codes`. */
	readonly index: number;
	readonly code: string;
	/** In the slot: px from its top left. */
	readonly rect: FinaleRect;
	/** Its corner radius, px. */
	readonly radius: number;
}

/** The gap between a print slot's stacked cards, in viewport px. */
export function wallPrintGap(geometry: WallGeometry): number {
	return (WALL_PRINT_GAP * geometry.typeScale) / WALL_SCALE;
}

/**
 * A print slot's Done cards, stacked down it like a column: each fitted to the
 * slot's width or its share of the height (every card dealt to the slot keeps
 * its share), the stack centred, a card not yet printed left out. Each is a
 * card of its own: the DOM paints it on this rect, its GL sheet is this rect,
 * and its shadow and landing accents trace it, so nothing is drawn round the
 * cards or in the gaps between them.
 */
export function wallPrintCards(size: { readonly width: number; readonly height: number }, codes: readonly string[], shapes: WallPrintShapes, gap: number): readonly WallPrintCard[] {
	if (codes.length === 0) return [];
	const share = (size.height - gap * (codes.length - 1)) / codes.length;
	const fitted = codes.flatMap((code, index) => {
		const shape = shapes(code);
		if (!shape) return [];
		const width = Math.min(size.width, share * shape.aspect);
		return [{ index, code, width, height: width / shape.aspect, radius: shape.corner * width }];
	});
	const total = fitted.reduce((sum, card) => sum + card.height, 0) + gap * Math.max(0, fitted.length - 1);
	let y = (size.height - total) / 2;
	return fitted.map(({ index, code, width, height, radius }) => {
		const rect = { x: (size.width - width) / 2, y, width, height };
		y += height + gap;
		return { index, code, rect, radius };
	});
}

/** The custom property a print slot's card `index` takes its opacity from (its slot writes it as the card lands). */
export function wallPrintOpacity(index: number): string {
	return `--wall-print-${index}`;
}

/**
 * A Done card's print on a canvas of its card's size, as both its DOM card and
 * its GL sheet paint it, so the hand-over between them is pixel for pixel.
 */
export function paintWallPrint(context: CanvasRenderingContext2D, width: number, height: number, print: CanvasImageSource & { readonly width: number; readonly height: number }): void {
	context.clearRect(0, 0, width, height);
	if (print.width <= 0 || print.height <= 0) return;
	const fit = Math.min(width / print.width, height / print.height);
	const drawWidth = print.width * fit;
	const drawHeight = print.height * fit;
	context.drawImage(print, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}
