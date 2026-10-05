import type { PieceId } from "@/public/1p/rovo-stage-kit/types/stage-file";

import { FINALE_SLOT_COUNT, FINALE_STORIES, finaleBentoLayout, type FinaleBentoLayout, type FinalePresenterId, type FinaleRect, type FinaleStory } from "../data/finale-stories";
import type { FinaleBrandColor } from "../data/finale-palette";
import type { FinaleShapeKind } from "../data/finale-identity-shapes";

/*
 * The mega bento: an endless wall on the bento's own rhythm, gliding left
 * once the bento has played. Its columns are the bento's columns, about a
 * third the size; each band down a column is as tall as two tall tiles, so it
 * holds two tall tiles, or two short tiles framing a title-sized one, exactly
 * like the bento. It is airy, like the reference wall: wide gutters, small
 * pieces, and here and there a slot left empty.
 *
 * Seven of its slots are gaps, scattered over the frame the wall appears in:
 * each waits, empty, for one of the bento's cards (its six tiles and the
 * "Team ’26" title), the one whose place on the slide it is nearest, so the
 * seven are thrown to seven different places. Everything else is the rest of
 * the keynote: the Done cards as printed, the featured stories' benefits,
 * Team ’26 posters, the presenters in the identity's shapes, and the
 * products on show as Rovo Stage Kit pieces.
 *
 * New cards come in at the leading edge, each waiting in the air over its
 * slot until it comes down (`lib/finale-wall-motion.ts`). The wall repeats
 * every `WALL_PERIOD` columns, and is laid out in viewport px at rest (the
 * glide is one translation of the whole track), so every slot is a pure
 * function of its column and band.
 */

/** Gap between wall tiles at the 1920 stage (it scales with the type): wide, for air. */
const WALL_GUTTER = 32;
/**
 * Columns on the wall as it appears: at this scale nine fill the frame, the
 * period's first at its left edge. The next one is the leading edge, its
 * cards waiting in the air.
 */
export const WALL_FRAME_COLUMNS = 9;
/** How much of the leading column is in the frame as the wall appears. */
const LEADING_SHARE = 0.45;
/** The bento's column at the 1920 stage. */
const BENTO_STAGE_COLUMN = finaleBentoLayout({ width: 1920, height: 1080 }, 1).slots[0].rect.width;
/**
 * How much smaller the wall's tiles are than the bento's (about a third):
 * exactly as small as lets nine columns and the leading one's share fill a
 * 1920 frame at the wall's gutters, which also leaves three whole bands a
 * margin above and below on a 16:9 or 16:10 screen.
 */
export const WALL_SCALE = (1920 - WALL_FRAME_COLUMNS * WALL_GUTTER) / (WALL_FRAME_COLUMNS + LEADING_SHARE) / BENTO_STAGE_COLUMN;
/** The bento's title, thrown with its six tiles: its order is one past theirs. */
export const WALL_TITLE_ORDER = FINALE_SLOT_COUNT;

/** A slot's height: a bento tall or short tile, the title's box, a strip, or the whole band. */
export type WallHeight = "tall" | "short" | "title" | "strip" | "band";

export type WallStatId = "presenters" | "chapters";
export type WallStripId = "presenters" | "flow";

export type WallContent =
	| { readonly kind: "story"; readonly story: FinaleStory }
	/** A featured story's benefit line, on its chapter's tint. */
	| { readonly kind: "benefit"; readonly story: FinaleStory }
	/** Done cards as printed for the finale, stacked like a column (as many as fit the slot). */
	| { readonly kind: "print"; readonly codes: readonly string[] }
	| { readonly kind: "poster"; readonly word: string; readonly fill: FinaleBrandColor; readonly ink: FinaleBrandColor }
	/** A presenter's portrait in one of the identity's shapes. */
	| { readonly kind: "shape"; readonly shape: FinaleShapeKind; readonly fill: FinaleBrandColor; readonly portrait: FinalePresenterId }
	| { readonly kind: "stat"; readonly stat: WallStatId }
	| { readonly kind: "strip"; readonly strip: WallStripId }
	/** The products on show: Rovo Stage Kit pieces, in a row on a grey tile (`lib/finale-wall-pieces.ts`). */
	| { readonly kind: "piece"; readonly pieces: readonly PieceId[] }
	/** The black "Team ’26" tile: the bento's title, a card on the wall like its tiles. */
	| { readonly kind: "title" };

/** Authoring tokens: gaps, benefits and prints are dealt when the wall is built. */
type Token =
	| { readonly kind: "benefit" }
	| { readonly kind: "print" }
	/**
	 * A gap: a slot one of the bento's cards is thrown into (in the first
	 * copy, empty until it lands). Every copy shows the card dealt to it (its
	 * featured story, or the title), so the card has a home in the loop.
	 */
	| { readonly kind: "gap" }
	/** Air: the slot is left empty, so the wall breathes. */
	| { readonly kind: "air" }
	| Exclude<WallContent, { kind: "story" } | { kind: "benefit" } | { kind: "print" } | { kind: "title" }>;

/** What a recipe slot deals (`air` and `gap` included); exported for the layout contract. */
export type WallTokenKind = Token["kind"];

interface Cell {
	readonly heights: readonly WallHeight[];
	readonly tokens: readonly Token[];
	/** Spans this column and the next. */
	readonly wide?: boolean;
}

/** A band cell, or the right half of the wide cell on its left. */
type CellRecipe = Cell | "covered";

const benefit: Token = { kind: "benefit" };
const print: Token = { kind: "print" };
const gap: Token = { kind: "gap" };
const air: Token = { kind: "air" };
const poster = (word: string, fill: FinaleBrandColor, ink: FinaleBrandColor): Token => ({ kind: "poster", word, fill, ink });
const portrait = (presenter: FinalePresenterId, kind: FinaleShapeKind, fill: FinaleBrandColor): Token => ({ kind: "shape", shape: kind, fill, portrait: presenter });
const stat = (id: WallStatId): Token => ({ kind: "stat", stat: id });
const strip = (id: WallStripId): Token => ({ kind: "strip", strip: id });
const piece = (...pieces: PieceId[]): Token => ({ kind: "piece", pieces });
const APP_LOGOS = piece("appJira", "appConfluence", "appLoom", "appGithub", "appFigma");

/** The band patterns: each sums, with its gutters, to exactly one band. */
const tt = (a: Token, b: Token): Cell => ({ heights: ["tall", "tall"], tokens: [a, b] });
const sxs = (a: Token, x: Token, b: Token): Cell => ({ heights: ["short", "title", "short"], tokens: [a, x, b] });
const tsr = (t: Token, s: Token, r: Token): Cell => ({ heights: ["tall", "short", "strip"], tokens: [t, s, r] });
const rst = (r: Token, s: Token, t: Token): Cell => ({ heights: ["strip", "short", "tall"], tokens: [r, s, t] });
const band = (token: Token): Cell => ({ heights: ["band"], tokens: [token] });
const wide = (cell: Cell): Cell => ({ ...cell, wide: true });
const covered = "covered" as const;

/**
 * One period of the wall, column by column, as [top, middle, bottom] bands.
 * As the wall appears, columns 0–8 fill the frame (0 at its left edge) and
 * column 9's cards wait in the air at its right edge. Strips are too thin to
 * read at these gutters, so the strip of each `tsr`/`rst` cell is air, and
 * the strip tiles sit in the title-sized boxes instead.
 *
 * The seven gaps zigzag across columns 1–7, one a column, over all three
 * bands, each near the bento card it waits for (`finaleBentoLayout` lands a,
 * e, c, b, f, d, then the title): a top left (column 1), b bottom left (2),
 * c up the middle (3), the title in the middle (4), d down the middle (5), e
 * top right (6), f bottom right (7). None is in the frame's last two columns,
 * so each is on the wall as it appears. Each story shows once a period and
 * in one form: the six featured ones in the gaps and on their benefit lines,
 * the other nineteen as their Done cards. Three more bands of prints after
 * the opening frame hold the expanded board at the same card scale.
 */
const PERIOD: readonly (readonly [CellRecipe, CellRecipe, CellRecipe])[] = [
	[tt(piece("stampShapes"), benefit), wide(tt(poster("Context", "lime", "black"), print)), rst(air, stat("presenters"), piece("rovoDevCli"))],
	[tt(air, gap), covered, sxs(piece("governance"), APP_LOGOS, piece("composer"))],
	[band(portrait("tamar", "arch", "purple")), tt(print, piece("agentPresence")), tt(gap, poster("Done", "saffron", "black"))],
	[tsr(piece("stampSparkle"), gap, air), tt(piece("skills"), air), wide(tt(piece("codeCard"), poster("Collaboration", "purple", "black")))],
	[sxs(piece("stampShield"), piece("switch"), air), rst(air, gap, piece("statTokens")), covered],
	[tt(poster("Loom", "purple", "black"), benefit), band(print), rst(air, gap, piece("governance"))],
	[tt(portrait("sherif", "circle", "purple"), gap), tsr(benefit, piece("hold"), air), tt(piece("scheduledTask"), piece("stampShapes"))],
	[tt(piece("stampShield"), benefit), sxs(piece("rovoDevCli"), strip("flow"), air), tt(gap, poster("Jira", "blue", "white"))],
	[sxs(stat("chapters"), poster("DX", "purple", "black"), piece("bubbles")), tt(poster("Guard", "saffron", "black"), piece("stampShapes")), tt(air, poster("Agents", "saffron", "black"))],
	[tt(portrait("mcb", "shield", "blue"), benefit), tt(poster("Rovo", "black", "lime"), piece("stampSparkle")), sxs(piece("governance"), poster("Shipped", "lime", "black"), air)],
	[wide(band(poster("Confidence", "blue", "white"))), tt(portrait("taroon", "hexagon", "blue"), benefit), tt(piece("codeCard"), piece("badgeRovo"))],
	[covered, sxs(air, strip("presenters"), piece("stampShapes")), band(poster("Done", "lime", "black"))],
	[band(print), tt(poster("Context", "lime", "black"), piece("stampSparkle")), tt(air, piece("stampShield"))],
	[tt(piece("stampShapes"), air), band(print), tt(poster("Collaboration", "purple", "black"), piece("governance"))],
	[tt(poster("Confidence", "blue", "white"), piece("stampSparkle")), tt(piece("stampShield"), air), band(print)],
];

/** Columns before the wall repeats. */
export const WALL_PERIOD = PERIOD.length;

/**
 * How many printed cards stack in a slot: one across a wide slot, two down a
 * tall one, four down a whole band (a Done card is about twice as wide as it
 * is tall). Fixed by the slot's shape, not the screen's, so every card is
 * dealt exactly once on any display; the stack shrinks to fit where needed.
 */
export function cardsPerSlot(height: WallHeight, wide: boolean): number {
	if (wide) return 1;
	return height === "band" ? 4 : height === "tall" ? 2 : 1;
}

export interface WallGeometry {
	/** Viewport px. */
	readonly columnWidth: number;
	readonly gutter: number;
	readonly pitch: number;
	readonly bandHeight: number;
	readonly bandPitch: number;
	/** The middle band's top, in viewport px. */
	readonly bandTop: number;
	/** Where column 0's left edge sits on screen before the wall moves. */
	readonly originX: number;
	readonly heights: Readonly<Record<WallHeight, number>>;
	/** The stage-to-wall type scale: a wall tile is laid out at its size ÷ this, then scaled by it. */
	readonly typeScale: number;
	readonly radius: number;
	readonly viewport: { readonly width: number; readonly height: number };
}

export interface WallSlot {
	/** Unique across the whole wall. */
	readonly key: string;
	readonly column: number;
	readonly band: number;
	/** In the wall at rest (viewport px); the track's translation moves it. */
	readonly rect: FinaleRect;
	readonly height: WallHeight;
	/** The same in every copy of the period, so each pass of the loop moves exactly alike. */
	readonly seed: number;
	/** What the slot holds. */
	readonly content: WallContent;
	/** In the first copy only: the bento card (`WallGap.order`) this gap waits for, empty until it lands. */
	readonly reserved?: number;
}

/** A bento card's gap in the wall: the copy-0 slot it is thrown into, of its own shape. */
export interface WallGap {
	/** The tile's landing order (0–5), or `WALL_TITLE_ORDER` for the title. */
	readonly order: number;
	readonly kind: "tile" | "title";
	readonly slot: WallSlot;
}

export interface FinaleWall {
	readonly geometry: WallGeometry;
	/** The slots of a column (a wide cell belongs to its left column), top to bottom. */
	readonly column: (column: number) => readonly WallSlot[];
	/** The bento's cards' gaps: its six tiles in landing order, then its title. */
	readonly gaps: readonly WallGap[];
	/** The bands the wall is made of: those at least half in the frame, top to bottom. */
	readonly bands: readonly number[];
}

/** Euclidean modulo: the period index of any column, negative ones included. */
export function wrap(value: number, period: number): number {
	return ((value % period) + period) % period;
}

/** The wall's sizes for a viewport: the bento's columns and tiles, scaled down, at the bento's rhythm. */
export function wallGeometry(bento: FinaleBentoLayout, fitScale: number, viewport: { readonly width: number; readonly height: number }): WallGeometry {
	const tallSlot = bento.slots.find((slot) => !slot.short)?.rect ?? bento.slots[0].rect;
	const shortSlot = bento.slots.find((slot) => slot.short)?.rect ?? tallSlot;
	const columnWidth = tallSlot.width * WALL_SCALE;
	const gutter = WALL_GUTTER * fitScale;
	const tall = tallSlot.height * WALL_SCALE;
	const short = shortSlot.height * WALL_SCALE;
	const bandHeight = tall * 2 + gutter;
	const heights: Record<WallHeight, number> = {
		tall,
		short,
		title: bandHeight - short * 2 - gutter * 2,
		strip: tall - short - gutter,
		band: bandHeight,
	};
	const pitch = columnWidth + gutter;
	return {
		columnWidth,
		gutter,
		pitch,
		bandHeight,
		bandPitch: bandHeight + gutter,
		bandTop: viewport.height / 2 - bandHeight / 2,
		// Anchored on the right, as the arrivals are, so on any screen the same cards wait in the air.
		originX: viewport.width - columnWidth * LEADING_SHARE - WALL_FRAME_COLUMNS * pitch,
		heights,
		typeScale: fitScale * WALL_SCALE,
		radius: 20 * fitScale * WALL_SCALE,
		viewport,
	};
}

/* ─── A print slot's Done cards ───────────────────────────────────────── */

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

/**
 * The bands the wall is made of: those at least half in the frame. A band
 * that would only show a sliver at the top or bottom is left out, so the
 * frame keeps its margins.
 */
function bandsIn(geometry: WallGeometry): number[] {
	const reach = Math.floor(geometry.viewport.height / 2 / geometry.bandPitch);
	return Array.from({ length: reach * 2 + 1 }, (_, index) => index - reach);
}

/** Which period row a band shows: the middle band is row 1. */
const rowOf = (band: number) => wrap(band + 1, 3);

/** An item's offset down its band. */
function itemTop(cell: Cell, item: number, geometry: WallGeometry): number {
	let y = 0;
	for (let index = 0; index < item; index += 1) y += geometry.heights[cell.heights[index]] + geometry.gutter;
	return y;
}

/** A dealt token's place in the period: `column:row:item`. */
interface PeriodSite {
	readonly at: string;
	readonly column: number;
	readonly row: number;
	readonly item: number;
	readonly cell: Cell;
}

function sitesOf(kind: WallTokenKind): readonly PeriodSite[] {
	return PERIOD.flatMap((recipe, column) =>
		recipe.flatMap((cell, row) => (cell === covered ? [] : cell.tokens.flatMap((token, item) => (token.kind === kind ? [{ at: `${column}:${row}:${item}`, column, row, item, cell }] : [])))),
	);
}

const GAP_SITES = sitesOf("gap");
const BENEFIT_SITES = sitesOf("benefit");

/** Where each print slot starts in the deck, dealt once over the period in reading order. */
const PRINT_INDICES = (() => {
	const indices = new Map<string, number>();
	let count = 0;
	for (const site of sitesOf("print")) {
		indices.set(site.at, count);
		count += cardsPerSlot(site.cell.heights[site.item], Boolean(site.cell.wide));
	}
	return indices;
})();

/**
 * The cheapest way to give each of `rows` things its own one of `columns`
 * (`rows <= columns`): a small exhaustive search, pruned by the best so far.
 * Ties go to the first found, so the wall is the same on every build.
 */
function cheapestAssignment(rows: number, columns: number, cost: (row: number, column: number) => number): number[] {
	let best: number[] = [];
	let bestCost = Number.POSITIVE_INFINITY;
	const picked: number[] = [];
	const used = new Set<number>();
	const visit = (row: number, total: number) => {
		if (total >= bestCost) return;
		if (row === rows) {
			best = [...picked];
			bestCost = total;
			return;
		}
		for (let column = 0; column < columns; column += 1) {
			if (used.has(column)) continue;
			used.add(column);
			picked.push(column);
			visit(row + 1, total + cost(row, column));
			picked.pop();
			used.delete(column);
		}
	};
	visit(0, 0);
	return best;
}

/** A gap dealt to a bento card: the card, and the band whose copy-0 slot waits for it. */
interface DealtGap {
	readonly order: number;
	readonly band: number;
}

/** A bento card thrown into the wall: from its place on the slide, into a gap of its shape. */
interface ThrownCard {
	readonly order: number;
	readonly rect: FinaleRect;
	readonly shape: WallHeight;
}

/** Steep enough that a card only takes a gap of another shape, or one cut by the frame, if it must. */
const WRONG_SHAPE = 1e6;
const OUT_OF_FRAME = 1e5;

/**
 * Deals the bento's cards (its tiles in landing order, then its title, which
 * is shaped like a short tile) to the period's gaps, each to one of its own
 * shape, so that together they travel least: every card lands near its place
 * on the slide, and no two share a gap. A gap shows in every band of its
 * row; its card takes the copy in the frame nearest it.
 */
function planGaps(geometry: WallGeometry, bento: FinaleBentoLayout, count: number, bands: readonly number[]): ReadonlyMap<string, DealtGap> {
	const tiles = bento.slots.slice(0, Math.min(count, FINALE_SLOT_COUNT)).map((slot, order): ThrownCard => ({ order, rect: slot.rect, shape: slot.short ? "short" : "tall" }));
	const title: ThrownCard = { order: WALL_TITLE_ORDER, rect: bento.title, shape: "short" };
	const cards = [...tiles, title].slice(0, GAP_SITES.length);
	const { viewport, gutter } = geometry;
	const options = GAP_SITES.map((site) => {
		const height = site.cell.heights[site.item];
		return bands.filter((each) => rowOf(each) === site.row).map((each) => {
			const x = geometry.originX + site.column * geometry.pitch;
			const y = geometry.bandTop + each * geometry.bandPitch + itemTop(site.cell, site.item, geometry);
			const size = geometry.heights[height];
			const inFrame = x >= gutter && y >= gutter && x + geometry.columnWidth <= viewport.width - gutter && y + size <= viewport.height - gutter;
			return { band: each, height, centre: { x: x + geometry.columnWidth / 2, y: y + size / 2 }, inFrame };
		});
	});
	const choice = (card: number, site: number) => {
		const { rect, shape } = cards[card];
		const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
		let best = { band: 0, cost: Number.POSITIVE_INFINITY };
		for (const option of options[site]) {
			const cost = Math.hypot(option.centre.x - centre.x, option.centre.y - centre.y) + (option.height === shape ? 0 : WRONG_SHAPE) + (option.inFrame ? 0 : OUT_OF_FRAME);
			if (cost < best.cost) best = { band: option.band, cost };
		}
		return best;
	};
	const choices = cards.map((_, card) => GAP_SITES.map((_, site) => choice(card, site)));
	const dealt = new Map<string, DealtGap>();
	const assignment = cheapestAssignment(cards.length, GAP_SITES.length, (card, site) => choices[card][site].cost);
	assignment.forEach((site, card) => {
		const { band, cost } = choices[card][site];
		if (Number.isFinite(cost)) dealt.set(GAP_SITES[site].at, { order: cards[card].order, band });
	});
	return dealt;
}

/** How many columns at least a benefit line sits from its own story's tile, where the deal allows. */
const BENEFIT_APART = 3;
/** Steep enough that only a deal with no other way puts a benefit nearer its tile than that. */
const TOO_NEAR = 1e4;

/**
 * Deals the featured stories' benefit lines so each sits well away from its
 * own story's gap: a story is met twice a period, not twice in one place.
 */
function planBenefits(gaps: ReadonlyMap<string, DealtGap>, count: number): ReadonlyMap<string, number> {
	const gapColumn = new Map<number, number>();
	for (const site of GAP_SITES) {
		const dealt = gaps.get(site.at);
		if (dealt) gapColumn.set(dealt.order, site.column);
	}
	const closeness = (benefitSite: number, story: number) => {
		const column = gapColumn.get(story);
		if (column === undefined) return 0;
		const apart = Math.abs(BENEFIT_SITES[benefitSite].column - column);
		const around = Math.min(apart, WALL_PERIOD - apart);
		return (around < BENEFIT_APART ? TOO_NEAR : 0) + (WALL_PERIOD / 2 - around) ** 2;
	};
	const dealt = new Map<string, number>();
	if (count === 0) return dealt;
	// With fewer stories than benefit slots, the deck goes round again.
	const deals = Math.min(count, BENEFIT_SITES.length);
	const picks = cheapestAssignment(deals, BENEFIT_SITES.length, (story, site) => closeness(site, story));
	picks.forEach((site, story) => dealt.set(BENEFIT_SITES[site].at, story));
	BENEFIT_SITES.forEach((site, index) => {
		if (!dealt.has(site.at)) dealt.set(site.at, index % count);
	});
	return dealt;
}

/**
 * The wall for one scene: the featured stories and the title in the gaps,
 * the stories on their benefit tiles too; every other keynote card as
 * printed, in the order the cards reached Done.
 */
export function buildFinaleWall(geometry: WallGeometry, bento: FinaleBentoLayout, features: readonly FinaleStory[], dragOrder: readonly string[]): FinaleWall {
	const featured = new Set(features.map((feature) => feature.code));
	const rest = FINALE_STORIES.map((each) => each.code).filter((code) => !featured.has(code));
	const ordered = [...dragOrder.filter((code) => rest.includes(code)), ...rest.filter((code) => !dragOrder.includes(code))];
	const prints = ordered.length > 0 ? ordered : FINALE_STORIES.map((each) => each.code);
	const bands = bandsIn(geometry);
	const gapPlan = planGaps(geometry, bento, features.length, bands);
	const benefitPlan = planBenefits(gapPlan, features.length);
	const columns = new Map<number, readonly WallSlot[]>();

	const contentOf = (token: Token, at: string, height: WallHeight, isWide: boolean): WallContent | null => {
		switch (token.kind) {
			case "air":
				return null;
			case "gap": {
				// A gap no card was dealt (a short feature list) is left as air rather than repeat a story.
				const dealt = gapPlan.get(at);
				if (!dealt) return null;
				return dealt.order === WALL_TITLE_ORDER ? { kind: "title" } : { kind: "story", story: features[dealt.order] };
			}
			case "benefit": {
				const story = benefitPlan.get(at);
				return story === undefined ? null : { kind: "benefit", story: features[story] };
			}
			case "print": {
				const first = PRINT_INDICES.get(at) ?? 0;
				return { kind: "print", codes: Array.from({ length: cardsPerSlot(height, isWide) }, (_, index) => prints[(first + index) % prints.length]) };
			}
			default:
				return token;
		}
	};

	const column = (index: number): readonly WallSlot[] => {
		const known = columns.get(index);
		if (known) return known;
		const periodColumn = wrap(index, WALL_PERIOD);
		const firstCopy = index >= 0 && index < WALL_PERIOD;
		const slots: WallSlot[] = [];
		const x = index * geometry.pitch;
		for (const bandIndex of bands) {
			const row = rowOf(bandIndex);
			const cell = PERIOD[periodColumn][row];
			if (cell === covered) continue;
			const width = cell.wide ? geometry.columnWidth * 2 + geometry.gutter : geometry.columnWidth;
			const top = geometry.bandTop + bandIndex * geometry.bandPitch;
			cell.tokens.forEach((token, item) => {
				const height = cell.heights[item];
				const at = `${periodColumn}:${row}:${item}`;
				const content = contentOf(token, at, height, Boolean(cell.wide));
				if (!content) return;
				const dealt = token.kind === "gap" ? gapPlan.get(at) : undefined;
				// In the first copy, the dealt gap waits, empty, for its bento card.
				const reserved = dealt && firstCopy && dealt.band === bandIndex ? dealt.order : undefined;
				slots.push({
					key: `${index}:${bandIndex}:${item}`,
					column: index,
					band: bandIndex,
					rect: { x, y: top + itemTop(cell, item, geometry), width, height: geometry.heights[height] },
					height,
					seed: periodColumn * 31 + bandIndex * 7 + item,
					content,
					...(reserved === undefined ? {} : { reserved }),
				});
			});
		}
		columns.set(index, slots);
		return slots;
	};

	const gaps: WallGap[] = [];
	for (const site of GAP_SITES) {
		const dealt = gapPlan.get(site.at);
		const slot = dealt ? column(site.column).find((each) => each.reserved === dealt.order) : undefined;
		if (dealt && slot) gaps.push({ order: dealt.order, kind: dealt.order === WALL_TITLE_ORDER ? "title" : "tile", slot });
	}
	gaps.sort((a, b) => a.order - b.order);

	return { geometry, column, gaps, bands };
}

/** Every recipe cell, with what it deals; exported for the layout contract (each sums to one band). */
export function wallPeriodCells(): readonly { readonly column: number; readonly row: number; readonly heights: readonly WallHeight[]; readonly wide: boolean; readonly kinds: readonly WallTokenKind[] }[] {
	return PERIOD.flatMap((recipe, column) =>
		recipe.flatMap((cell, row) => (cell === covered ? [] : [{ column, row, heights: cell.heights, wide: Boolean(cell.wide), kinds: cell.tokens.map((token) => token.kind) }])),
	);
}

/** Whether a wide cell's right half is covered (and nothing else is). */
export function wallPeriodCovers(): readonly { readonly column: number; readonly row: number; readonly covered: boolean }[] {
	return PERIOD.flatMap((recipe, column) => recipe.map((cell, row) => ({ column, row, covered: cell === covered })));
}
