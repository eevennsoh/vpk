import { CUE, WALL_CUE } from "../data/finale-cues";
import { EASE, progress } from "./finale-math";

/** Shared timing only: importing the initial bento must not load the wall. */

/** Seconds into the act (negative before the bento's final frame). */
export function wallSince(time: number): number {
	return time - WALL_CUE.start;
}

/**
 * Whether the mega bento exists yet: only once the clock is past the bento's
 * final frame, which is also what reduced motion holds (so it never mounts).
 */
export function wallActive(time: number): boolean {
	return time > WALL_CUE.start;
}

/** When a landed card's DOM content starts to build, as `tileRevealStart`. */
export function landingRevealStart(touchdown: number): number {
	return touchdown + CUE.handoff + 0.05;
}

/** When a landed card's border glow is over: its content has built. */
export function landingSettled(touchdown: number): number {
	return landingRevealStart(touchdown) + CUE.reveal;
}

/** 0 → 1: a grey card, the bento tiles' own, rises under "Team ’26" on the DOM slide. */
export function bentoTitleForm(time: number): number {
	return EASE.outBold(progress(wallSince(time), WALL_CUE.titleCardAt, WALL_CUE.titleFlipAt));
}

/** When the formed title card hands over to its GL sheet and flips: from here its DOM title hides. */
export function bentoTitleFlipTime(): number {
	return WALL_CUE.start + WALL_CUE.titleFlipAt;
}

/** When the DOM bento hands its cards to their GL sheets (the DOM cards hide). */
export function bentoTossTime(): number {
	return WALL_CUE.start + WALL_CUE.tossAt;
}
