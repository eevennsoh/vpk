import { FINALE_PIECES as kitPieces, STAGE_KIT_PIECES, type FinalePiece as KitPiece, type FinalePieceId as PieceId } from "../data/finale-piece-catalogue";
import stageFile from "@/public/1p/rovo-stage-kit/rovo-stage.json";
import type { ComposedPiece, StageFile } from "@/public/1p/rovo-stage-kit/types/stage-file";

import { FINALE_STORIES, finaleBentoLayout, type FinaleBentoLayout, type FinaleChapterId, type FinaleRect, type FinaleStory } from "../data/finale-stories";
import type { FinaleBrandColor } from "../data/finale-palette";
import { repeatKey } from "../studio/studio-inventory";
import { DEFAULT_FINALE_STUDIO, orderedByStudio, studioCardOn, studioPieceFor, studioPieceOn, studioPiecePadding, studioPieceScale, studioPieceTile, type FinaleStudioConfig } from "../studio/finale-studio-config";
import { FINALE_TITLE } from "../data/finale-title";
import { packWallMasonry, type MasonryItem } from "./finale-wall-masonry";
import { wallPiecesLayout } from "./finale-wall-pieces";

/** Scale of the keynote tiles and their typography after the throw. */
export const WALL_SCALE = 0.3;
/** A venue screen's height in metres: the studio's lengths and pace are in metres of it. */
export const VENUE_SCREEN_M = 5;
/** A stage wall point at zoom 1, as a share of the screen's height (the Rovo stage on the Team ’26 board). */
const STAGE_POINT = 2.64 / 900;
/** The stage's packing per density: how small its pieces are drawn, and its gap in wall points. */
const STAGE_DENSITY = { gallery: { scale: 1, gap: 112 }, balanced: { scale: 0.88, gap: 64 }, dense: { scale: 0.76, gap: 30 } } as const;
export const WALL_TITLE_ORDER = 6;
/** Original entry-camera calibration, independent of tile sizing and spatial indexing. */
const WALL_ENTRY_SCALE = 68 / 231;
export const WALL_LANYARDS = { count: 3, width: 360, height: 480 } as const;

export type WallStatId = "presenters" | "chapters";
export type WallStripId = "flow";
export type WallPiece = Pick<KitPiece, "id" | "scale">;
export type WallContent =
	| { readonly kind: "story"; readonly story: FinaleStory }
	| { readonly kind: "benefit"; readonly story: FinaleStory }
	| { readonly kind: "print"; readonly codes: readonly [string] }
	| { readonly kind: "poster"; readonly word: FinaleChapterId; readonly fill: FinaleBrandColor; readonly ink: FinaleBrandColor }
	| { readonly kind: "stat"; readonly stat: WallStatId }
	| { readonly kind: "strip"; readonly strip: WallStripId }
	/** `bare`: no wall tile behind it, the piece straight on the slide; `padding`: its tile round it, across and down in kit points. */
	| { readonly kind: "piece"; readonly pieces: readonly WallPiece[]; readonly padding: { readonly x: number; readonly y: number }; readonly bare?: boolean }
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
	/** The glide, in viewport px a second. */
	readonly speed: number;
	/** The loop's least length in viewport px: a longer wall is dealt again. */
	readonly length: number;
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
	/** The movable cards' keys in packing order (the studio's Composer reorders these). */
	readonly order: readonly string[];
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

/** The wall's density: how much smaller than its catalogue size a piece is drawn (an explicit composition keeps its own). */
function stageDensity(stage: WallStageSource, studio: FinaleStudioConfig): number {
	return stage.composition !== null ? 1 : STAGE_DENSITY[studio.wall.density].scale;
}

/** Explicit instances keep their scales; automatic stages use the enabled catalogue and density. */
export function resolveWallStagePieces(stage: WallStageSource, studio: FinaleStudioConfig = DEFAULT_FINALE_STUDIO): readonly WallStagePiece[] {
	if (stage.composition !== null) return stage.composition.pieces;
	const options = stage.board.cells.a.options ?? {};
	const density = stageDensity(stage, studio);
	// Local additions enter the Library first; only an explicit on setting adds them to the wall.
	const enabled = STAGE_KIT_PIECES.filter((piece) => {
		const shown = options[`show${piece.group[0].toUpperCase()}${piece.group.slice(1)}`];
		return typeof shown === "boolean" ? shown : piece.group !== "apps";
	});
	const groups = [...new Set(enabled.map((piece) => piece.group))].map((group) => enabled.filter((piece) => piece.group === group));
	const ordered: KitPiece[] = [];
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

/** The scale the wall draws a kit piece at, in kit points: its catalogue scale, the wall's density, its own size. */
export function wallPieceScale(studio: FinaleStudioConfig, id: string): number {
	const piece = kitPieces.find((each) => each.id === id);
	return piece ? piece.scale * stageDensity(stageFile, studio) * studioPieceScale(studio, id) : 1;
}

/** The stage file's pieces as the studio sets them: swapped, turned off, resized. */
export function studioWallPieces(studio: FinaleStudioConfig = DEFAULT_FINALE_STUDIO): readonly WallStagePiece[] {
	const placed = resolveWallStagePieces(stageFile, studio).flatMap((each) => {
		const id = studioPieceFor(studio, each.key, each.id);
		if (!studioPieceOn(studio, id)) return [];
		const own = kitPieces.find((piece) => piece.id === each.id);
		const shown = kitPieces.find((piece) => piece.id === id);
		// A swapped-in piece keeps the slot's density, at its own catalogue size.
		const scale = own && shown && own !== shown ? (each.scale / own.scale) * shown.scale : each.scale;
		return [{ ...each, id, scale: scale * studioPieceScale(studio, id) }];
	});
	// Pieces the studio put on the wall where the stage file leaves them out, at the stage's density.
	const keys = new Set(placed.map((each) => each.key));
	const added = kitPieces.filter((piece) => studio.pieces[piece.id]?.on === true && !placed.some((each) => each.id === piece.id)).map((piece) => {
		const key = keys.has(`library-${piece.id}`) ? `library-${piece.id}-added` : `library-${piece.id}`;
		return { key, id: piece.id, scale: piece.scale * stageDensity(stageFile, studio) * studioPieceScale(studio, piece.id) };
	});
	return [...placed, ...added];
}

export function wallGeometry(fitScale: number, viewport: { readonly width: number; readonly height: number }, studio: FinaleStudioConfig = DEFAULT_FINALE_STUDIO): WallGeometry {
	const referenceWidth = finaleBentoLayout(viewport, fitScale).slots[0].rect.width * WALL_ENTRY_SCALE;
	// The wall's zoom draws a stage point as the Team ’26 board did, against the screen's height.
	// A portrait frame measures it no taller than it is wide, so its cards stay in proportion to the frame (and teammates can hold them).
	const screen = Math.min(viewport.height, viewport.width);
	const { zoom, density, pace, length } = studio.wall;
	const pieceScale = screen * STAGE_POINT * zoom;
	// The keynote's cards were drawn beside the kit at the stage file's framing (its zoom, enlarged 1.25): they keep that ratio.
	const designPieceScale = fitScale * stageFile.board.cells.a.zoom * 1.25;
	const gap = STAGE_DENSITY[density].gap;
	const maxPieceWidth = Math.max(0, ...studioWallPieces(studio).map((placed) => {
		const piece = kitPieces.find((each) => each.id === placed.id);
		return piece ? (piece.w * placed.scale + 80) * pieceScale : 0;
	}));
	return {
		gutter: (studio.gaps?.x ?? gap) * pieceScale,
		gutterY: (studio.gaps?.y ?? gap) * pieceScale,
		bucketWidth: 256 * fitScale,
		arrivalWidth: referenceWidth * 2 + 32 * fitScale,
		arrivalReach: referenceWidth + 32 * fitScale,
		maxTileWidth: Math.max(maxPieceWidth, 480 * fitScale),
		originX: 0,
		typeScale: fitScale * WALL_SCALE * (pieceScale / designPieceScale),
		pieceScale,
		speed: (pace * screen) / VENUE_SCREEN_M,
		length: (length * screen) / VENUE_SCREEN_M,
		radius: 20,
		viewport,
	};
}

/** Every wall container keeps its corners in viewport pixels, including custom coloured tiles. */
export function wallSlotRadius(_slot: WallSlot, geometry: WallGeometry): number {
	return geometry.radius;
}

export interface WallItem extends MasonryItem {
	readonly content: WallContent;
}

function isPieceId(id: string): id is PieceId {
	return kitPieces.some((piece) => piece.id === id);
}

function libraryItems(geometry: WallGeometry, studio: FinaleStudioConfig): readonly WallItem[] {
	return studioWallPieces(studio).flatMap((placed) => {
		if (!isPieceId(placed.id)) return [];
		const piece = kitPieces.find((each) => each.id === placed.id);
		if (!piece) return [];
		const padding = studioPiecePadding(studio, placed.id);
		const layout = wallPiecesLayout([{ ...piece, id: placed.id, scale: placed.scale }], geometry.pieceScale, padding);
		const bare = !studioPieceTile(studio, placed.id);
		return [{ key: placed.key, width: layout.width, height: layout.height, content: { kind: "piece" as const, pieces: [{ id: placed.id, scale: placed.scale }], padding, ...(bare ? { bare } : {}) } }];
	});
}

/** Every card of the keynote's own the wall can show, on it or not (the studio's Library lists them all). */
export function keynoteItems(geometry: WallGeometry, features: readonly FinaleStory[], dragOrder: readonly string[]): readonly WallItem[] {
	const scale = geometry.typeScale / WALL_SCALE;
	const item = (key: string, width: number, height: number, content: WallContent): WallItem => ({ key, width: width * scale, height: height * scale, content, ...(content.kind === "poster" ? { group: "chapter" } : {}) });
	const featured = new Set(features.map((story) => story.code));
	const remaining = FINALE_STORIES.map((story) => story.code).filter((code) => !featured.has(code));
	const ordered = [...dragOrder.filter((code) => remaining.includes(code)), ...remaining.filter((code) => !dragOrder.includes(code))];
	const extras: WallItem[] = features.map((story, index) => item(`benefit-${index}`, 240 + (index % 3) * 55, 155 + (index % 2) * 55, { kind: "benefit", story }));
	const posters = [
		{ word: "Context", width: 300, height: 160, fill: "lime", ink: "black" },
		{ word: "Collaboration", width: 360, height: 200, fill: "purple", ink: "black" },
		{ word: "Confidence", width: 280, height: 220, fill: "blue", ink: "white" },
	] satisfies readonly { word: FinaleChapterId; width: number; height: number; fill: FinaleBrandColor; ink: FinaleBrandColor }[];
	posters.forEach(({ word, width, height, fill, ink }, index) => extras.push(item(`poster-${index}`, width, height, { kind: "poster", word, fill, ink })));
	ordered.forEach((code, index) => extras.push(item(`print-${index}`, 260, 140, { kind: "print", codes: [code] })));
	extras.push(item("chapters", 180, 125, { kind: "stat", stat: "chapters" }), item("flow", 330, 65, { kind: "strip", strip: "flow" }));
	for (let order = 0; order < WALL_LANYARDS.count; order++) {
		extras.push(item(`lanyard-${order}`, WALL_LANYARDS.width, WALL_LANYARDS.height, { kind: "lanyard", order }));
	}
	return extras;
}

/** The wall's cards in packing order: the kit's pieces and the keynote's cards interleaved, or the composer's order. */
function wallItems(geometry: WallGeometry, features: readonly FinaleStory[], dragOrder: readonly string[], studio: FinaleStudioConfig): readonly WallItem[] {
	const library = libraryItems(geometry, studio);
	const extras = keynoteItems(geometry, features, dragOrder).filter((item) => item.content.kind !== "lanyard" && studioCardOn(studio, item.key));
	const interleaved: WallItem[] = [];
	for (let index = 0; index < Math.max(library.length, extras.length); index += 1) {
		if (library[index]) interleaved.push(library[index]);
		if (extras[index]) interleaved.push(extras[index]);
	}
	return orderedByStudio(interleaved, studio.order);
}

function wallLanyardRect(geometry: WallGeometry, index: number, spacing: number): FinaleRect {
	const scale = geometry.typeScale / WALL_SCALE;
	return { x: geometry.viewport.width + geometry.gutter + index * spacing, y: -geometry.radius, width: WALL_LANYARDS.width * scale, height: WALL_LANYARDS.height * scale };
}

/** Cards `from`… of the passes after the first: each pass starts half a pass on, so a card's copies stay apart. */
function dealtAgain(first: readonly WallItem[], from: number, count: number): readonly WallItem[] {
	const half = Math.floor(first.length / 2);
	return Array.from({ length: count }, (_, step) => {
		const index = from + step;
		const pass = Math.floor(index / first.length) + 2;
		const item = first[(index % first.length + (pass - 1) * half) % first.length];
		return { ...item, key: repeatKey(item.key, pass) };
	});
}

/** The cards dealt again until the packed wall reaches `length` (a few packs: the masonry's holes vary). */
function filledToLength(first: readonly WallItem[], firstRects: readonly FinaleRect[], length: number, pack: (items: readonly WallItem[]) => readonly FinaleRect[], order: readonly string[] | null): { readonly items: readonly WallItem[]; readonly rects: readonly FinaleRect[] } {
	const reach = (rects: readonly FinaleRect[]) => Math.max(0, ...rects.map((rect) => rect.x + rect.width));
	let items = first;
	let rects = firstRects;
	for (let attempt = 0; attempt < 4 && first.length > 0 && reach(rects) < length; attempt += 1) {
		const width = Math.max(1, reach(rects));
		const more = Math.ceil((items.length * (length - width)) / width) + 1;
		items = orderedByStudio([...items, ...dealtAgain(first, items.length - first.length, more)], order);
		rects = pack(items);
	}
	return { items, rects };
}

/** Intrinsic rectangles packed edge to edge, with the keynote landing spaces reserved first. */
export function buildFinaleWall(geometry: WallGeometry, bento: FinaleBentoLayout, features: readonly FinaleStory[], dragOrder: readonly string[], studio: FinaleStudioConfig = DEFAULT_FINALE_STUDIO): FinaleWall {
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
	const groupGap = 900 * geometry.typeScale / WALL_SCALE;
	const pack = (list: readonly WallItem[], blocked = reserved) => packWallMasonry(list, blocked, viewport.height, gutter, gutterY, groupGap);
	const first = wallItems(geometry, features, dragOrder, studio);
	const unhung = pack(first);
	const lanyardWidth = wallLanyardRect(geometry, 0, 0).width + gutter;
	const spacing = (Math.max(...[...reserved, ...unhung].map((rect) => rect.x + rect.width)) + gutter + WALL_LANYARDS.count * lanyardWidth) / WALL_LANYARDS.count;
	const lanyards = Array.from({ length: WALL_LANYARDS.count }, (_, index): WallSlot => ({
		key: `lanyard-${index}`, bucket: 0, rect: wallLanyardRect(geometry, index, spacing),
		content: { kind: "lanyard", order: index }, seed: 977 + index * 53,
	})).filter((slot) => studioCardOn(studio, slot.key));
	const packWithLanyards = (list: readonly WallItem[]) => pack(list, [...reserved, ...lanyards.map((slot) => slot.rect)]);
	const firstRects = packWithLanyards(first);
	// A longer wall deals its cards again, as the stage's own fill does.
	const { items, rects } = filledToLength(first, firstRects, geometry.length, packWithLanyards, studio.order);
	const base = anchors.map(({ order, content }, index): WallSlot => ({ key: `gap-${order}`, bucket: 0, rect: reserved[index], content, seed: order * 31, reserved: order }));
	base.push(...lanyards);
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
			...(slot.content.kind === "lanyard" ? { content: { ...slot.content, order: copy * WALL_LANYARDS.count + slot.content.order } } : {}),
			...(copy === 0 && order !== undefined ? { reserved: order } : {}),
		}));
		if (buckets.size >= 96) {
			const oldest = buckets.keys().next().value;
			if (oldest !== undefined) buckets.delete(oldest);
		}
		buckets.set(index, slots);
		return slots;
	};
	const firstPeriod = Array.from({ length: periodBuckets }, (_, index) => bucket(index)).flat();
	const gaps = anchors.map(({ order }): WallGap => {
		const slot = firstPeriod.find((each) => each.reserved === order);
		if (!slot) throw new Error(`Missing keynote landing ${order}`);
		return { order, kind: order === WALL_TITLE_ORDER ? "title" : "tile", slot };
	});
	return { geometry, order: items.map((item) => item.key), periodWidth, periodBuckets, bucket, items: firstPeriod, gaps };
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
