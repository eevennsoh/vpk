import kitPieces from "@/public/1p/rovo-stage-kit/pieces.json";
import stageFile from "@/public/1p/rovo-stage-kit/rovo-stage.json";
import type { KitPiece, PieceId } from "@/public/1p/rovo-stage-kit/types/stage-file";

import { FINALE_STORIES, finaleBentoLayout, type FinaleBentoLayout, type FinalePresenterId, type FinaleRect, type FinaleStory } from "../data/finale-stories";
import type { FinaleBrandColor } from "../data/finale-palette";
import type { FinaleShapeKind } from "../data/finale-identity-shapes";
import { packWallMasonry } from "./finale-wall-masonry";
import { wallPiecesLayout } from "./finale-wall-pieces";

/** Scale of the keynote tiles and their typography after the throw. */
export const WALL_SCALE = 0.3;
export const WALL_TITLE_ORDER = 6;
/** Original entry-camera calibration, independent of tile sizing and spatial indexing. */
const WALL_ENTRY_SCALE = 68 / 231;

export type WallStatId = "presenters" | "chapters";
export type WallStripId = "presenters" | "flow";
export type WallPiece = Pick<KitPiece, "id" | "scale">;
export type WallContent =
	| { readonly kind: "story"; readonly story: FinaleStory }
	| { readonly kind: "benefit"; readonly story: FinaleStory }
	| { readonly kind: "print"; readonly codes: readonly string[] }
	| { readonly kind: "poster"; readonly word: string; readonly fill: FinaleBrandColor; readonly ink: FinaleBrandColor }
	| { readonly kind: "shape"; readonly shape: FinaleShapeKind; readonly fill: FinaleBrandColor; readonly portrait: FinalePresenterId }
	| { readonly kind: "stat"; readonly stat: WallStatId }
	| { readonly kind: "strip"; readonly strip: WallStripId }
	| { readonly kind: "piece"; readonly pieces: readonly WallPiece[] }
	| { readonly kind: "title" };

export interface WallGeometry {
	readonly gutter: number;
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

export function wallGeometry(fitScale: number, viewport: { readonly width: number; readonly height: number }): WallGeometry {
	const referenceWidth = finaleBentoLayout(viewport, fitScale).slots[0].rect.width * WALL_ENTRY_SCALE;
	// The exported zoom frames the kit; a shared 1.25 enlargement makes its animated UI readable.
	const pieceScale = fitScale * stageFile.board.cells.a.zoom * 1.25;
	const maxPieceWidth = Math.max(...stageFile.composition.pieces.map((placed) => {
		const piece = kitPieces.find((each) => each.id === placed.id);
		return piece ? (piece.w * placed.scale + 80) * pieceScale : 0;
	}));
	return {
		gutter: 24 * fitScale,
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

/** Grey containers have viewport-pixel corners; coloured tiles retain their stage-scaled corners. */
export function wallSlotRadius(slot: WallSlot, geometry: WallGeometry): number {
	const kind = slot.content.kind;
	return kind === "poster" || kind === "benefit" || kind === "title" ? geometry.radius * geometry.typeScale : geometry.radius;
}

interface WallItem {
	readonly key: string;
	readonly width: number;
	readonly height: number;
	readonly content: WallContent;
}

function isPieceId(id: string): id is PieceId {
	return kitPieces.some((piece) => piece.id === id);
}

function libraryItems(geometry: WallGeometry): readonly WallItem[] {
	return stageFile.composition.pieces.flatMap((placed) => {
		if (!isPieceId(placed.id)) return [];
		const piece = kitPieces.find((each) => each.id === placed.id);
		if (!piece) return [];
		const layout = wallPiecesLayout([{ ...piece, id: placed.id, scale: placed.scale }], geometry.pieceScale);
		return [{ key: placed.key, width: layout.width, height: layout.height, content: { kind: "piece" as const, pieces: [{ id: placed.id, scale: placed.scale }] } }];
	});
}

function keynoteItems(geometry: WallGeometry, features: readonly FinaleStory[], dragOrder: readonly string[]): readonly WallItem[] {
	const scale = geometry.typeScale / WALL_SCALE;
	const item = (key: string, width: number, height: number, content: WallContent): WallItem => ({ key, width: width * scale, height: height * scale, content });
	const featured = new Set(features.map((story) => story.code));
	const remaining = FINALE_STORIES.map((story) => story.code).filter((code) => !featured.has(code));
	const ordered = [...dragOrder.filter((code) => remaining.includes(code)), ...remaining.filter((code) => !dragOrder.includes(code))];
	const extras: WallItem[] = features.map((story, index) => item(`benefit-${index}`, 240 + (index % 3) * 55, 155 + (index % 2) * 55, { kind: "benefit", story }));
	const portraits: readonly [FinalePresenterId, FinaleShapeKind, FinaleBrandColor][] = [["tamar", "arch", "purple"], ["sherif", "circle", "purple"], ["mcb", "shield", "blue"], ["taroon", "hexagon", "blue"]];
	portraits.forEach(([portrait, shape, fill], index) => extras.push(item(`portrait-${portrait}`, 160 + index * 18, index % 2 === 0 ? 310 : 185, { kind: "shape", portrait, shape, fill })));
	const posters: readonly [string, FinaleBrandColor, FinaleBrandColor][] = [["Context", "lime", "black"], ["Collaboration", "purple", "black"], ["Confidence", "blue", "white"], ["Loom", "purple", "black"], ["Jira", "blue", "white"], ["Guard", "saffron", "black"]];
	posters.forEach(([word, fill, ink], index) => extras.push(item(`poster-${index}`, index % 2 === 0 ? 420 : 215, index % 3 === 0 ? 160 : 245, { kind: "poster", word, fill, ink })));
	let dealt = 0;
	while (dealt < ordered.length) {
		const remaining = ordered.length - dealt;
		const count = Math.min(dealt < 8 ? 4 : 2, remaining === 2 ? 1 : remaining);
		const codes = ordered.slice(dealt, dealt + count);
		if (codes.length > 0) extras.push(item(`print-${dealt}`, 260, codes.length * 115 + (codes.length - 1) * 8, { kind: "print", codes }));
		dealt += count;
	}
	extras.push(item("presenters", 240, 180, { kind: "stat", stat: "presenters" }), item("chapters", 180, 125, { kind: "stat", stat: "chapters" }), item("flow", 330, 65, { kind: "strip", strip: "flow" }));
	return extras;
}

/** Intrinsic rectangles packed edge to edge, with the keynote landing spaces reserved first. */
export function buildFinaleWall(geometry: WallGeometry, bento: FinaleBentoLayout, features: readonly FinaleStory[], dragOrder: readonly string[]): FinaleWall {
	const { gutter, bucketWidth, viewport } = geometry;
	const anchors = [...bento.slots.slice(0, features.length).map((slot, order) => ({ order, rect: slot.rect, content: { kind: "story" as const, story: features[order] } })), { order: WALL_TITLE_ORDER, rect: bento.title, content: { kind: "title" as const } }];
	const reserved = anchors.map(({ order, rect }) => ({
		x: rect.x + rect.width * (1 - WALL_SCALE) / 2 - (order === WALL_TITLE_ORDER ? viewport.width * 0.12 : 0),
		y: rect.y + rect.height * (1 - WALL_SCALE) / 2,
		width: rect.width * WALL_SCALE,
		height: rect.height * WALL_SCALE,
	}));
	const library = libraryItems(geometry);
	const extras = keynoteItems(geometry, features, dragOrder);
	const items: WallItem[] = [];
	for (let index = 0; index < Math.max(library.length, extras.length); index += 1) {
		if (library[index]) items.push(library[index]);
		if (extras[index]) items.push(extras[index]);
	}
	const rects = packWallMasonry(items, reserved, viewport.height, gutter);
	const base = anchors.map(({ order, content }, index): WallSlot => ({ key: `gap-${order}`, bucket: 0, rect: reserved[index], content, seed: order * 31, reserved: order }));
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
