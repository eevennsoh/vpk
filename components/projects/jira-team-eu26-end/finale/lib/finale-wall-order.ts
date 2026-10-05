import { bentoTouchdown, type BentoDrop, type WallSheet } from "./finale-wall-motion";

/**
 * The wall GL layer's draw order (three.js `renderOrder`). Its sheets draw
 * with no depth test, so a later draw paints over an earlier one: far to near
 * from the lens in px buckets; in a bucket, the shadows under the sheets, the
 * title's ink just over its plate.
 */
const ORDER_BUCKET = 1 << 12;
const SHEET_ORDER = 1 << 11;
const SHADOW_DROP = 1 << 10;
/**
 * The bucket in front of the lens (depth −1 px), where no sheet can be: the
 * lifted title's, so it, its shadow and its ink draw over every other sheet.
 */
const LIFTED_ORDER = ORDER_BUCKET + SHEET_ORDER;

/** One sheet's draw order: its plate, its cast shadow, and (the title's) ink. */
export interface WallDrawOrder {
	sheet: number;
	shadow: number;
	ink: number;
}

/**
 * Whether `sheet` draws over every other sheet: the title card, from its flip
 * until it touches down in its gap. Its hop and bow make it bigger than its
 * box mid-flip, and the bento's thrown cards start nearer the lens than it
 * (each seen exactly on its own tile), so by depth alone its neighbours would
 * cut it along their edges. Once down it sorts by depth again, flat on the wall.
 */
export function wallSheetLifted(sheet: WallSheet, time: number, drops: readonly BentoDrop[]): boolean {
	if (sheet.texture !== "title") return false;
	const title = drops.find((drop) => drop.kind === "title");
	return title !== undefined && time < bentoTouchdown(title, drops);
}

/**
 * Sheet `index`'s draw order this frame, written into `into` (the frame loop
 * reuses one): by its `depth` from the lens (px), or over everything when
 * `lifted` (`wallSheetLifted`).
 */
export function wallDrawOrder(depth: number, index: number, lifted: boolean, into: WallDrawOrder): WallDrawOrder {
	const sheet = lifted ? LIFTED_ORDER : -Math.round(depth) * ORDER_BUCKET + SHEET_ORDER + index * 2;
	into.sheet = sheet;
	into.shadow = sheet - SHADOW_DROP;
	into.ink = sheet + 1;
	return into;
}
