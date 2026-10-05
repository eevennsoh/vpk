import { FINALE_SLOT_COUNT, FINALE_STORIES, type FinaleBentoLayout, type FinalePresenterId, type FinaleRect, type FinaleStory } from "../data/finale-stories";
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
 * Team ’26 posters, the identity's shapes and the products on show.
 *
 * New cards come in at the leading edge, each waiting in the air over its
 * slot until it comes down (`lib/finale-wall-motion.ts`). The wall repeats
 * every `WALL_PERIOD` columns, and is laid out in viewport px at rest (the
 * glide is one translation of the whole track), so every slot is a pure
 * function of its column and band.
 */

/**
 * How much smaller the wall's tiles are than the bento's: small enough that
 * three whole bands, with their wide gutters, leave a margin above and below
 * on a 16:9 or 16:10 screen.
 */
export const WALL_SCALE = 0.3;
/** Gap between wall tiles at the 1920 stage (it scales with the type): wide, for air. */
const WALL_GUTTER = 32;
/** Columns before the wall repeats. */
export const WALL_PERIOD = 12;
/**
 * Columns on the wall as it appears: at this scale nine fill the frame, the
 * period's first at its left edge. The next one is the leading edge, its
 * cards waiting in the air.
 */
export const WALL_FRAME_COLUMNS = 9;
/** How much of the leading column is in the frame as the wall appears. */
const LEADING_SHARE = 0.45;
/** The bento's title, thrown with its six tiles: its order is one past theirs. */
export const WALL_TITLE_ORDER = FINALE_SLOT_COUNT;

/** A slot's height: a bento tall or short tile, the title's box, a strip, or the whole band. */
export type WallHeight = "tall" | "short" | "title" | "strip" | "band";

export type WallStatId = "shipped" | "presenters" | "chapters";
export type WallStripId = "apps" | "presenters" | "flow" | "search";
/** The agents on the keynote board's header (`JIRA_TEAM_EU26_HEADER_AGENT_ASSIGNEES`). */
export type WallAgentId = "claude-code" | "review-agent" | "test-agent";

export type WallContent =
	| { readonly kind: "story"; readonly story: FinaleStory }
	/** A featured story's benefit line, on its chapter's tint. */
	| { readonly kind: "benefit"; readonly story: FinaleStory }
	/** Done cards as printed for the finale, stacked like a column (as many as fit the slot). */
	| { readonly kind: "print"; readonly codes: readonly string[] }
	| { readonly kind: "poster"; readonly word: string; readonly fill: FinaleBrandColor; readonly ink: FinaleBrandColor }
	| { readonly kind: "shape"; readonly shape: FinaleShapeKind; readonly fill: FinaleBrandColor; readonly portrait?: FinalePresenterId }
	| { readonly kind: "stat"; readonly stat: WallStatId }
	| { readonly kind: "strip"; readonly strip: WallStripId }
	/** A few lines of the keynote's Claude session, in its terminal. */
	| { readonly kind: "terminal"; readonly script: number }
	| { readonly kind: "agent"; readonly agent: WallAgentId }
	/** Rovo's chat composer, mid-question. */
	| { readonly kind: "composer"; readonly prompt: number }
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
const shape = (kind: FinaleShapeKind, fill: FinaleBrandColor): Token => ({ kind: "shape", shape: kind, fill });
const portrait = (presenter: FinalePresenterId, kind: FinaleShapeKind, fill: FinaleBrandColor): Token => ({ kind: "shape", shape: kind, fill, portrait: presenter });
const stat = (id: WallStatId): Token => ({ kind: "stat", stat: id });
const strip = (id: WallStripId): Token => ({ kind: "strip", strip: id });
const terminal = (script: number): Token => ({ kind: "terminal", script });
const agent = (id: WallAgentId): Token => ({ kind: "agent", agent: id });
const composer = (prompt: number): Token => ({ kind: "composer", prompt });

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
 * the other seven as their Done cards (1 + 2 + 4 prints).
 */
const PERIOD: readonly (readonly [CellRecipe, CellRecipe, CellRecipe])[] = [
	[tt(shape("banner", "lime"), benefit), wide(tt(poster("Context", "lime", "black"), print)), rst(air, stat("presenters"), terminal(0))],
	[tt(air, gap), covered, sxs(shape("circle", "lime"), strip("apps"), composer(0))],
	[band(portrait("tamar", "arch", "purple")), tt(print, agent("claude-code")), tt(gap, poster("Done", "saffron", "black"))],
	[tsr(shape("star", "purple"), gap, air), tt(composer(1), air), wide(tt(terminal(1), poster("Collaboration", "purple", "black")))],
	[sxs(shape("hexagon", "blue"), strip("search"), air), rst(air, gap, stat("shipped")), covered],
	[tt(poster("Loom", "purple", "black"), benefit), band(print), rst(air, gap, shape("shield", "blue"))],
	[tt(portrait("sherif", "circle", "purple"), gap), tsr(benefit, composer(2), air), tt(agent("review-agent"), shape("circle", "saffron"))],
	[tt(shape("hexagon", "saffron"), benefit), sxs(terminal(2), strip("flow"), air), tt(gap, poster("Jira", "blue", "white"))],
	[sxs(stat("chapters"), poster("DX", "purple", "black"), composer(3)), tt(poster("Guard", "saffron", "black"), shape("arch", "blue")), tt(air, poster("Agents", "saffron", "black"))],
	[tt(portrait("mcb", "shield", "blue"), benefit), tt(poster("Rovo", "black", "lime"), shape("star", "lime")), sxs(shape("banner", "blue"), poster("Shipped", "lime", "black"), air)],
	[wide(band(poster("Confidence", "blue", "white"))), tt(portrait("taroon", "hexagon", "blue"), benefit), tt(terminal(3), agent("test-agent"))],
	[covered, sxs(air, strip("presenters"), shape("circle", "purple")), band(poster("Done", "lime", "black"))],
];

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
