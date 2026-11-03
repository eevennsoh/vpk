import { motionDuration, motionEase } from "@/lib/motion";

/** Cards visible at once: the top card plus two peeking behind it. */
export const VISIBLE_CARDS = 3;
/** Each card behind the top one sits this much lower, so its bottom edge peeks out as a card, not a hairline. */
export const PEEK_STEP = 12;
/** …and this much narrower, so the stack reads as depth rather than a second outline. */
export const SCALE_STEP = 0.05;
/** Space between the stack and the ✕ / ✓ row, and that row's height. */
export const CONTROLS_GAP = 16;
export const CONTROLS_HEIGHT = 40;
/** A ghost alone in an empty deck sketches a short card: label, two lines, the Why row. */
export const GHOST_HEIGHT = 140;
/** Extra room under the peeks while the "N new" note shows, so it never crowds the controls. */
export const ARRIVAL_ROOM = 16;

/** Release past this distance (in unscaled px) commits the swipe. */
export const COMMIT_DISTANCE = 96;
/** A quick flick commits from a shorter distance. */
export const FLICK_VELOCITY = 0.55;
export const FLICK_MIN_DISTANCE = 24;
/** How far a decided card travels as it leaves; it fades out along the way. */
export const FLY_DISTANCE = 360;
/** The card starts fading once it is clearly on its way out. */
export const FADE_START = 140;

/** Hover intent for the why card: long enough to skim past, short enough to feel immediate. */
export const WHY_OPEN_DELAY = motionDuration.slow * 1000;
export const WHY_CLOSE_DELAY = motionDuration.fast * 1000;

/** How long a decision's receipt replaces the progress line in the footer: four of the slowest beats. */
export const RECEIPT_MS = motionDuration.slowest * 4 * 1000;
/** How long the "N new" note waits on the stack after a re-run lands: three receipts long, since it offers a choice. */
export const ARRIVAL_MS = RECEIPT_MS * 3;
/** How long a Details row stays tinted after it is filled: two of the slowest beats plus a medium one to settle. */
export const HIGHLIGHT_MS = (motionDuration.slowest * 2 + motionDuration.medium) * 1000;

export const SETTLE = { duration: motionDuration.slow, ease: motionEase.inOut };
export const LEAVE = { duration: motionDuration.medium, ease: motionEase.in };
export const SPRING_BACK = { type: "spring", visualDuration: motionDuration.slow, bounce: 0.2 } as const;
export const FADE = { duration: motionDuration.normal, ease: motionEase.outPractical };
