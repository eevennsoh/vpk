/**
 * How the live Jira board leaves as its Done column is tossed into the field.
 *
 * Through the flash the finale is transparent: the board, its chrome and the
 * sweeping light stay exactly as they are. On the toss the whole board (nav,
 * tabs, toolbar, every column) blurs and washes out under the grey slide
 * together, over one full-viewport layer, so nothing snaps and nothing is
 * column-shaped. The GL sheets fly above that layer and stay crisp.
 *
 * The Done column's own DOM cards leave with their sheets instead: at
 * `CUE.burst` every sheet still sits exactly on its DOM original, so hiding
 * the originals then is seamless, and the lifting sheets never uncover a
 * ghost copy of themselves in the blurring board.
 *
 * Recipe (`.agents/rules/motion-decisions.md`): a full-screen exit, so fade +
 * blur (two properties), `duration-slowest` (0.6s), one shared curve. The
 * curve is `ease-in-out` (bold) rather than the practical `ease-in`: the slide
 * replaces the board in place, like a blanket, and `ease-in`'s late surge
 * would crowd the change into the last few frames and read as a delayed cut,
 * while `ease-in-out` answers the toss at once and lands without a snap.
 *
 * Reduced motion: the finale renders only its rest frame (see
 * `finale-overlay.tsx`), where the exit is fully resolved: opaque slide, no
 * blur, originals hidden; the dialog's own short fade carries the change.
 */

import { CUE } from "../data/finale-cues";
import { EASE, progress } from "./finale-math";

export const BOARD_EXIT = {
	/** The exit starts with the toss: the flash is spent by then and the slide was clear through it. */
	start: CUE.burst,
	/** `duration-slowest`. */
	duration: 0.6,
	/** Backdrop blur (px) the board reaches as the slide covers it. */
	blur: 16,
	ease: EASE.inOut,
} as const;

export function boardExitEnd(): number {
	return BOARD_EXIT.start + BOARD_EXIT.duration;
}

/** Eased 0 → 1 through the exit; exactly 0 through the flash and exactly 1 once it has landed. */
export function boardExitProgress(time: number): number {
	if (time <= BOARD_EXIT.start) return 0;
	if (time >= boardExitEnd()) return 1;
	return BOARD_EXIT.ease(progress(time, BOARD_EXIT.start, boardExitEnd()));
}

/** The grey slide's opacity over the board. */
export function boardExitSlideOpacity(time: number): number {
	return boardExitProgress(time);
}

/**
 * Backdrop blur (px) on the board, ramping with the slide. Once the slide is
 * opaque it hides the board entirely, so the blur is dropped (exactly 0) and
 * later scenes pay nothing for it.
 */
export function boardExitBlur(time: number): number {
	const amount = boardExitProgress(time);
	return amount >= 1 ? 0 : BOARD_EXIT.blur * amount;
}

/** Whether the Done column's DOM cards are hidden: from the toss on, when their sheets lift off them. */
export function boardDoneCardsHidden(time: number): boolean {
	return time >= CUE.burst;
}

export interface BoardExitStyle {
	readonly visibility: "hidden" | "visible";
	/** The slide colour's alpha, painted over the blurred board. */
	readonly opacity: number;
	/** CSS `backdrop-filter`, or "none" outside the ramp. */
	readonly backdropFilter: string;
}

/** The exit layer's style at `time`. Hidden (pixel-identical board) through the flash; a plain opaque slide after. */
export function boardExitStyle(time: number): BoardExitStyle {
	const opacity = boardExitSlideOpacity(time);
	const blur = boardExitBlur(time);
	return {
		visibility: opacity > 0 ? "visible" : "hidden",
		opacity,
		backdropFilter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : "none",
	};
}
