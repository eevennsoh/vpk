import { ROVO_COLOR_SWATCHES } from "@/lib/rovo-colors";

import { JIRA_TEAM_EU26_END_PRESENTERS } from "@/components/projects/jira-team-eu26-end/data/keynote-presenters";
import { CUE } from "../data/finale-cues";
import type { FinaleSlot, FinaleSlotId } from "../data/finale-stories";
import { tileFallStart, type FinalePoint, type FinaleViewport } from "./finale-card-motion";
import { EASE, lerp, progress, type Ease } from "./finale-math";

/**
 * The four presenters' multiplayer cursors. While the bento assembles, each
 * glides in from its own corner or edge of the frame, rests for a beat by one
 * of the tiles still swooping in, with a single "drop" press as if placing
 * that card, and slips back out before "Team ’26" arrives. Every value is a pure function of
 * the finale clock (and derived from `CUE`), so the finale stays scrubbable.
 */

export type FinaleCursorEntry = "top-left" | "top" | "top-right" | "bottom-left" | "bottom-right";
export type FinaleCursorId = keyof typeof JIRA_TEAM_EU26_END_PRESENTERS;

export interface FinaleCursorSpec {
	readonly id: FinaleCursorId;
	readonly label: string;
	/** Arrow and name-pill fill: one of the four Rovo colours. */
	readonly color: string;
	/** Name ink on that fill. */
	readonly ink: string;
	/** The corner or edge it comes from and goes back to. */
	readonly entry: FinaleCursorEntry;
	/** The tile it rests by, and where its tip rests, as a share of that slot. */
	readonly slot: FinaleSlotId;
	readonly rest: { readonly u: number; readonly v: number };
}

export interface FinaleCursorPose {
	/** Pointer tip, viewport px. */
	readonly x: number;
	readonly y: number;
	/** Press factor about the tip (1 at rest; the stage fit is applied by the view). */
	readonly scale: number;
	readonly opacity: number;
}

/**
 * The cursor's painted extent around its tip, in stage px (arrow, the longest
 * name pill and drop shadow). Keep in step with `FinaleTelepointer`'s markup.
 */
export const FINALE_CURSOR_BOX = { left: 4, top: 4, right: 140, bottom: 80 } as const;

const [BLUE, AMBER, PURPLE, GREEN] = ROVO_COLOR_SWATCHES;
/** Dark ink for the light fills (ADS neutral 1000); white on blue and purple. */
const DARK_INK = "#292A2E";
const LIGHT_INK = "#FFFFFF";

/**
 * In stagger order, matching the tiles' landing order (e, c, b, f), so each
 * cursor rests by its tile while that tile swoops in. Presenter colours follow
 * the earlier finale's cursor mapping (MCB green, Tamar blue, Sherif purple,
 * Taroon amber). Rest points sit by the tile's inner corner (the top middle
 * tile: its upper half), clear of the title.
 */
export const FINALE_CURSORS: readonly FinaleCursorSpec[] = [
	// The board's "MCB" goes by first name on the closing cursor.
	{ id: "mcb", label: "Mike", color: GREEN.hex, ink: DARK_INK, entry: "top-right", slot: "e", rest: { u: 0.22, v: 0.68 } },
	{ id: "tamar", label: JIRA_TEAM_EU26_END_PRESENTERS.tamar.name, color: BLUE.hex, ink: LIGHT_INK, entry: "top", slot: "c", rest: { u: 0.42, v: 0.3 } },
	{ id: "sherif", label: JIRA_TEAM_EU26_END_PRESENTERS.sherif.name, color: PURPLE.hex, ink: LIGHT_INK, entry: "bottom-left", slot: "b", rest: { u: 0.6, v: 0.26 } },
	{ id: "taroon", label: JIRA_TEAM_EU26_END_PRESENTERS.taroon.name, color: AMBER.hex, ink: DARK_INK, entry: "bottom-right", slot: "f", rest: { u: 0.22, v: 0.26 } },
];

/**
 * Shares of the cursors' window, which runs from the first tile's fall
 * (`tileFallStart(1)`) to the title (`CUE.title`), so the choreography
 * follows the cue sheet wherever it moves.
 */
const SHARE = {
	/** Each cursor starts and finishes this much after the one before it. */
	stagger: 0.08,
	/** Glide in from the corner. */
	enter: 0.3,
	/** Glide back out. */
	exit: 0.28,
	/** How much of the rest the press takes to go down (it then releases). */
	pressDown: 0.35,
	/** How far off the straight line the paths bow, as a share of their length. */
	bow: 0.12,
} as const;

const PRESS_DEPTH = 0.1;

/** When the cursors can be on screen: from the first tile's fall until the title. */
export function cursorsWindow(): { readonly start: number; readonly end: number } {
	return { start: tileFallStart(1), end: CUE.title };
}

interface CursorBeats {
	readonly start: number;
	readonly arrive: number;
	readonly leave: number;
	readonly end: number;
}

function beats(index: number): CursorBeats {
	const { start, end } = cursorsWindow();
	const span = Math.max(0, end - start);
	const last = FINALE_CURSORS.length - 1;
	const begin = start + index * SHARE.stagger * span;
	const finish = end - (last - index) * SHARE.stagger * span;
	return { start: begin, arrive: begin + SHARE.enter * span, leave: finish - SHARE.exit * span, end: finish };
}

export function cursorWindow(index: number): { readonly start: number; readonly end: number } {
	const { start, end } = beats(index);
	return { start, end };
}

/** The moment the cursor's press bottoms out: its "drop". */
export function cursorDropTime(index: number): number {
	const { arrive, leave } = beats(index);
	return lerp(arrive, leave, SHARE.pressDown);
}

export function cursorRestPoint(spec: FinaleCursorSpec, slots: readonly FinaleSlot[]): FinalePoint | null {
	const slot = slots.find((candidate) => candidate.id === spec.slot);
	if (!slot) return null;
	return { x: slot.rect.x + slot.rect.width * spec.rest.u, y: slot.rect.y + slot.rect.height * spec.rest.v };
}

/** Just past the frame corner or edge, far enough that the whole cursor is out of view. */
function offFrame(entry: FinaleCursorEntry, rest: FinalePoint, viewport: FinaleViewport, scale: number): FinalePoint {
	const gap = 8;
	const top = entry.startsWith("top");
	const y = top ? -(FINALE_CURSOR_BOX.bottom + gap) * scale : viewport.height + (FINALE_CURSOR_BOX.top + gap) * scale;
	// From the top edge it drops in from a little left of its rest point.
	if (entry === "top") return { x: rest.x - viewport.width * 0.05, y };
	const left = entry.endsWith("left");
	return { x: left ? -(FINALE_CURSOR_BOX.right + gap) * scale : viewport.width + (FINALE_CURSOR_BOX.left + gap) * scale, y };
}

/** A gently bowed move: a quadratic curve whose control sits off the chord's midpoint. */
function bowed(from: FinalePoint, to: FinalePoint, amount: number, bend: number): FinalePoint {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const control = { x: (from.x + to.x) / 2 - dy * bend, y: (from.y + to.y) / 2 + dx * bend };
	return {
		x: lerp(lerp(from.x, control.x, amount), lerp(control.x, to.x, amount), amount),
		y: lerp(lerp(from.y, control.y, amount), lerp(control.y, to.y, amount), amount),
	};
}

function move(time: number, start: number, end: number, from: FinalePoint, to: FinalePoint, ease: Ease, bend: number): FinalePoint {
	return bowed(from, to, ease(progress(time, start, end)), bend);
}

/**
 * Cursor `index` of `FINALE_CURSORS` at `time`: its tip in viewport px plus
 * the press factor, or null outside its window (so the cursors are always gone
 * by the title and on the reduced-motion rest frame). `slots` is the bento
 * layout; `scale` is the stage fit.
 */
export function cursorPose(time: number, index: number, slots: readonly FinaleSlot[], viewport: FinaleViewport, scale = 1): FinaleCursorPose | null {
	const spec = FINALE_CURSORS[index];
	const rest = spec ? cursorRestPoint(spec, slots) : null;
	if (!spec || !rest) return null;
	const beat = beats(index);
	if (beat.end <= beat.start || time < beat.start || time > beat.end) return null;

	const outside = offFrame(spec.entry, rest, viewport, scale);
	// In on one side of the chord and out on the other, so it never retraces.
	const tip = time < beat.arrive
		? move(time, beat.start, beat.arrive, outside, rest, EASE.outPractical, SHARE.bow)
		: time > beat.leave
			? move(time, beat.leave, beat.end, rest, outside, EASE.in, SHARE.bow)
			: rest;

	const drop = cursorDropTime(index);
	const pressed = time < drop
		? EASE.outPractical(progress(time, beat.arrive, drop))
		: 1 - EASE.outPractical(progress(time, drop, beat.leave));

	return { x: tip.x, y: tip.y, scale: 1 - PRESS_DEPTH * pressed, opacity: 1 };
}
