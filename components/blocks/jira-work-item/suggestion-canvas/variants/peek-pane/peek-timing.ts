import { motionDuration } from "@/lib/motion";

/**
 * Every interaction timer in the peek pane, in one place. Hover intent, grace periods and notice lifetimes are
 * interaction constants, not motion durations, so they are declared as plain milliseconds. Only a wait that must
 * outlast a specific animation is derived from the motion scale, and then from the token unmodified.
 */
export const PEEK_TIMING = {
	/** Resting on a row this long counts as intent, so sweeping across the list does not flash the pane open. */
	openIntentMs: 260,
	/** Once open, moving to another row follows quickly, but a diagonal pass towards the pane does not retarget it. */
	switchIntentMs: 90,
	/** Grace period for leaving the surface, so a brief overshoot does not collapse the pane. */
	closeGraceMs: 240,
	/** Arriving rows grow on the medium motion duration; scrolling waits for exactly that. */
	arrivalSettleMs: motionDuration.medium * 1000,
	/** How long a Details row stays tinted after it receives a value: long enough to notice from the popover. */
	filledHighlightMs: 1400,
	/** How long "N new found" stays in the byline before it settles back to the run time. */
	foundNoticeMs: 4800,
} as const;
