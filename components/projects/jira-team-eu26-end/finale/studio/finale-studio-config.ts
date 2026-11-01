import type { PlayMode } from "@/public/1p/rovo-stage-kit/types/stage-file";
import type { AgentLanyardStickerSettings, FinalePieceStyle, FinalePieceStyles as PieceStyles } from "../data/finale-piece-catalogue";

import type { FinaleAppearance } from "../data/finale-palette";

/*
 * The finale studio's settings (`/studio`): how the mega bento's kit pieces
 * look, where its cards sit, and the wall's look. One plain object, saved in
 * one file (`data/finale-studio.json`) that the flow, the studio and the film
 * all read. The appearance is the app's own theme (`useTheme`).
 */

/** 2: the one wall, U1F's, in the flow and the film (1 had none, and its gaps were viewport px). */
export const FINALE_STUDIO_VERSION = 2;

export type { FinaleAppearance } from "../data/finale-palette";

/** One kit piece on the wall: on it or not, its card, how it plays, its size. */
export interface StudioPieceSettings extends AgentLanyardStickerSettings {
	/** True adds it where the stage file leaves it out; false takes off every card showing it. */
	readonly on?: boolean;
	/** The kit's own card behind the piece (pieces built with one). */
	readonly surface?: boolean;
	/** The wall's tile behind the piece; false sets it straight on the slide. */
	readonly tile?: boolean;
	readonly play?: PlayMode;
	/** Times the size the stage file gives it. */
	readonly scale?: number;
	/** Its tile's padding round it, across and down, in kit points; unset: the wall's. */
	readonly padding?: TilePadding;
}

/** A tile's padding round its piece in kit points: across sets its width, down its height. */
export interface TilePadding {
	readonly x: number;
	readonly y: number;
}

export type StudioDensity = "gallery" | "balanced" | "dense";

/** The wall's look in the Rovo stage's own terms, as the Team ’26 trials set them. */
export interface StudioWall {
	/** The stage's zoom over the venue's 5 m screens: under 1, more and smaller cards. */
	readonly zoom: number;
	/** The stage's packing: how small its pieces are drawn, and its spacing. */
	readonly density: StudioDensity;
	/** The loop's least length in metres of screen; longer fills with more of each card. */
	readonly length: number;
	/** The glide, in metres a second. */
	readonly pace: number;
	/** Every tile's padding round its piece, in kit points (it scales with the zoom). */
	readonly padding: TilePadding;
}

/** The wall the Team ’26 trials settled on (U1F): the one layout, in the flow and in the film. */
export const U1F_WALL: StudioWall = { zoom: 0.25, density: "dense", length: 78, pace: 0.3, padding: { x: 40, y: 40 } };

/** One of the keynote's own cards on the wall (a benefit, a poster, a board card…), by its wall key. */
export interface StudioCardSettings {
	readonly on?: boolean;
}

export interface FinaleStudioConfig {
	readonly version: typeof FINALE_STUDIO_VERSION;
	readonly pieces: Readonly<Record<string, StudioPieceSettings>>;
	readonly cards: Readonly<Record<string, StudioCardSettings>>;
	readonly wall: StudioWall;
	/** The wall's cards by key, in order (a save writes them all); null: the kit's and the keynote's cards interleaved. */
	readonly order: readonly string[] | null;
	/** A piece card showing another kit piece than its own: card key → piece id. */
	readonly swaps: Readonly<Record<string, string>>;
	/** The wall's spacing in stage points at its zoom; null: its density's own (dense: 30). */
	readonly gaps: { readonly x: number; readonly y: number } | null;
}

export const DEFAULT_FINALE_STUDIO: FinaleStudioConfig = {
	version: FINALE_STUDIO_VERSION,
	pieces: {},
	cards: {},
	wall: U1F_WALL,
	order: null,
	swaps: {},
	gaps: null,
};

export const STUDIO_PIECE_SCALE = { min: 0.5, max: 1.6 } as const;
export const STUDIO_GAP = { min: 0, max: 160 } as const;
export const STUDIO_WALL = { zoom: { min: 0.1, max: 1 }, length: { min: 10, max: 400 }, pace: { min: 0.05, max: 2 }, padding: { min: 0, max: 160 } } as const;
const DENSITIES: readonly StudioDensity[] = ["gallery", "balanced", "dense"];

const PLAY_MODES: readonly PlayMode[] = ["once", "loop", "live"];
const ORDER_LIMIT = 600;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rangeOrNull = (value: unknown, range: { readonly min: number; readonly max: number }) => (typeof value === "number" && Number.isFinite(value) ? clamp(value, range.min, range.max) : null);
const paddingOrNull = (value: unknown): TilePadding | null => {
	if (!isRecord(value)) return null;
	const x = rangeOrNull(value.x, STUDIO_WALL.padding);
	const y = rangeOrNull(value.y, STUDIO_WALL.padding);
	return x === null || y === null ? null : { x: Math.round(x), y: Math.round(y) };
};

function normalizePiece(raw: unknown): StudioPieceSettings | null {
	if (!isRecord(raw)) return null;
	const piece: { -readonly [Key in keyof StudioPieceSettings]: StudioPieceSettings[Key] } = {};
	if (typeof raw.on === "boolean") piece.on = raw.on;
	if (typeof raw.surface === "boolean") piece.surface = raw.surface;
	if (raw.tile === false) piece.tile = false;
	if (typeof raw.play === "string" && PLAY_MODES.includes(raw.play as PlayMode)) piece.play = raw.play as PlayMode;
	if (typeof raw.scale === "number" && Number.isFinite(raw.scale)) piece.scale = clamp(raw.scale, STUDIO_PIECE_SCALE.min, STUDIO_PIECE_SCALE.max);
	const padding = paddingOrNull(raw.padding);
	if (padding) piece.padding = padding;
	if (typeof raw.agentId === "string" && /^[a-z0-9-]{1,80}$/.test(raw.agentId)) piece.agentId = raw.agentId;
	if (typeof raw.avatarId === "string" && /^[a-z0-9-]{1,80}$/.test(raw.avatarId)) piece.avatarId = raw.avatarId;
	if (typeof raw.agentName === "string" && raw.agentName.trim()) piece.agentName = raw.agentName.trim().slice(0, 80);
	if (typeof raw.animateGrid === "boolean") piece.animateGrid = raw.animateGrid;
	if (typeof raw.pulseInterval === "number" && Number.isFinite(raw.pulseInterval)) piece.pulseInterval = clamp(raw.pulseInterval, 2, 12);
	return Object.keys(piece).length > 0 ? piece : null;
}

/** Any settings (a pasted file, an old browser copy) as a valid config; what it cannot read is left at its default. */
export function normalizeFinaleStudio(raw: unknown): FinaleStudioConfig {
	if (!isRecord(raw)) return DEFAULT_FINALE_STUDIO;
	const pieces: Record<string, StudioPieceSettings> = {};
	if (isRecord(raw.pieces)) {
		for (const [id, value] of Object.entries(raw.pieces)) {
			const piece = normalizePiece(value);
			if (piece) pieces[id] = piece;
		}
	}
	const cards: Record<string, StudioCardSettings> = {};
	if (isRecord(raw.cards)) {
		for (const [key, value] of Object.entries(raw.cards)) if (isRecord(value) && typeof value.on === "boolean") cards[key] = { on: value.on };
	}
	// An older copy (a browser's, a pasted file) had no wall of its own: it takes U1F's.
	const current = raw.version === FINALE_STUDIO_VERSION;
	const rawWall = current && isRecord(raw.wall) ? raw.wall : {};
	const wall: StudioWall = {
		zoom: rangeOrNull(rawWall.zoom, STUDIO_WALL.zoom) ?? U1F_WALL.zoom,
		density: DENSITIES.includes(rawWall.density as StudioDensity) ? (rawWall.density as StudioDensity) : U1F_WALL.density,
		length: rangeOrNull(rawWall.length, STUDIO_WALL.length) ?? U1F_WALL.length,
		pace: rangeOrNull(rawWall.pace, STUDIO_WALL.pace) ?? U1F_WALL.pace,
		padding: paddingOrNull(rawWall.padding) ?? U1F_WALL.padding,
	};
	const order = Array.isArray(raw.order) ? [...new Set(raw.order.filter((key): key is string => typeof key === "string"))].slice(0, ORDER_LIMIT) : null;
	const swaps: Record<string, string> = {};
	if (isRecord(raw.swaps)) {
		for (const [key, id] of Object.entries(raw.swaps)) if (typeof id === "string" && id) swaps[key] = id;
	}
	const gaps = current && isRecord(raw.gaps) && typeof raw.gaps.x === "number" && typeof raw.gaps.y === "number"
		? { x: clamp(raw.gaps.x, STUDIO_GAP.min, STUDIO_GAP.max), y: clamp(raw.gaps.y, STUDIO_GAP.min, STUDIO_GAP.max) }
		: null;
	return {
		version: FINALE_STUDIO_VERSION,
		pieces,
		cards,
		wall,
		order: order && order.length > 0 ? order : null,
		swaps,
		gaps,
	};
}

/** The kit piece a piece card shows: its own, or the one the studio swapped in. */
export function studioPieceFor(studio: FinaleStudioConfig, key: string, id: string): string {
	return studio.swaps[key] ?? id;
}

/** Whether a kit piece is on the wall (every piece is, unless turned off). */
export function studioPieceOn(studio: FinaleStudioConfig, id: string): boolean {
	return studio.pieces[id]?.on !== false;
}

/** Whether the wall is U1F's as it stands: its look and its density's own spacing. */
export function studioWallIsU1F(studio: FinaleStudioConfig): boolean {
	const { wall, gaps } = studio;
	const spacing = gaps === null || (gaps.x === 30 && gaps.y === 30);
	const padding = wall.padding.x === U1F_WALL.padding.x && wall.padding.y === U1F_WALL.padding.y;
	return wall.zoom === U1F_WALL.zoom && wall.density === U1F_WALL.density && wall.length === U1F_WALL.length && wall.pace === U1F_WALL.pace && padding && spacing;
}

/** Whether one of the keynote's cards is on the wall (every one is, unless turned off). */
export function studioCardOn(studio: FinaleStudioConfig, key: string): boolean {
	return studio.cards[key]?.on !== false;
}

/** The config with a keynote card turned on (back to its default) or off. */
export function studioWithCard(studio: FinaleStudioConfig, key: string, on: boolean): FinaleStudioConfig {
	const cards = { ...studio.cards };
	if (on) delete cards[key];
	else cards[key] = { on: false };
	return { ...studio, cards };
}

/** Whether the wall draws its tile behind a kit piece (it does, unless turned off). */
export function studioPieceTile(studio: FinaleStudioConfig, id: string): boolean {
	return studio.pieces[id]?.tile !== false;
}

/** A kit piece's tile padding, across and down in kit points: its own, else the wall's. */
export function studioPiecePadding(studio: FinaleStudioConfig, id: string): TilePadding {
	return studio.pieces[id]?.padding ?? studio.wall.padding;
}

/** How much larger than the stage file's size the wall draws a piece. */
export function studioPieceScale(studio: FinaleStudioConfig, id: string): number {
	return studio.pieces[id]?.scale ?? 1;
}

/** The kit's piece styles with the studio's cards and play modes over them. */
export function finaleStudioPieceStyles(base: PieceStyles, studio: FinaleStudioConfig): PieceStyles {
	const styles: Record<string, FinalePieceStyle> = { ...base };
	for (const [id, piece] of Object.entries(studio.pieces)) {
		const { agentId, avatarId, agentName, animateGrid, pulseInterval } = piece;
		const lanyard = id === "agentLanyard" ? { agentId, avatarId, agentName, animateGrid, pulseInterval } : {};
		if (piece.surface === undefined && piece.play === undefined && Object.values(lanyard).every((value) => value === undefined)) continue;
		styles[id] = {
			...styles[id],
			...Object.fromEntries(Object.entries(lanyard).filter(([, value]) => value !== undefined)),
			...(piece.surface === undefined ? {} : { surface: piece.surface }),
			...(piece.play === undefined ? {} : { play: piece.play }),
		};
	}
	return styles as PieceStyles;
}

/** `items` in the studio's order: the keys it names first, in its order, then the rest in their own. */
export function orderedByStudio<T extends { readonly key: string }>(items: readonly T[], order: readonly string[] | null): readonly T[] {
	if (!order) return items;
	const rank = new Map(order.map((key, index) => [key, index]));
	const named = items.filter((item) => rank.has(item.key)).sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
	return [...named, ...items.filter((item) => !rank.has(item.key))];
}

/** The config with one piece's settings changed (a setting given as undefined goes back to its default). */
export function studioWithPiece(studio: FinaleStudioConfig, id: string, patch: StudioPieceSettings): FinaleStudioConfig {
	const merged = normalizePiece({ ...studio.pieces[id], ...patch }) ?? {};
	const pieces = { ...studio.pieces };
	if (Object.keys(merged).length === 0) delete pieces[id];
	else pieces[id] = merged;
	return { ...studio, pieces };
}

/** The theme a page address asks for (`?appearance=dark`), applied once on load. */
export function finaleAppearanceFromSearch(search: string): FinaleAppearance | null {
	const appearance = new URLSearchParams(search).get("appearance");
	return appearance === "dark" || appearance === "light" ? appearance : null;
}
