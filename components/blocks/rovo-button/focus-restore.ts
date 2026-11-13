/**
 * The subset of `HTMLElement` the focus restore needs, so the contract can be
 * unit-tested without a DOM.
 */
export interface FloatingRovoButtonFocusTarget {
	focus: (options?: { preventScroll?: boolean }) => void;
}

/**
 * True whenever an open card closes, whichever card it was.
 *
 * Both morphing cards share this: the insights card closes via Escape, its
 * dismiss button, or the secondary action collapsing it to the pill, and the
 * onboarding panel closes via Escape, its dismiss button, or its secondary
 * action. Every one of those is the surface's `cardOpen` going true → false,
 * which is why this takes a boolean rather than a stage — the two cards have
 * different state shapes but identical focus behaviour.
 *
 * Opening a card must leave focus alone: both panels take focus themselves via
 * `autoFocus` on their dismiss button, and restoring here would fight that.
 */
export function shouldRestoreFocusAfterCardClose(
	previousCardOpen: boolean,
	nextCardOpen: boolean,
): boolean {
	return previousCardOpen && !nextCardOpen;
}

/**
 * Hands focus back to whatever control replaced the card — the insights pill
 * after "Ask Rovo", the collapsed launcher after any other close. Without this
 * the browser drops focus to `<body>` when the card unmounts, so a keyboard
 * user who dismisses lands at the top of the document and has to traverse the
 * whole page to get back.
 *
 * `preventScroll` because the surface is `position: fixed`: scrolling the page
 * to reach it would move content the user never asked to move.
 *
 * Returns whether focus was moved, which is what makes the contract testable.
 */
export function restoreFloatingRovoButtonFocus(
	previousCardOpen: boolean,
	nextCardOpen: boolean,
	target: FloatingRovoButtonFocusTarget | null | undefined,
): boolean {
	if (!shouldRestoreFocusAfterCardClose(previousCardOpen, nextCardOpen)) {
		return false;
	}

	// The pill and the launcher are different nodes under `AnimatePresence`, so
	// the replacement can legitimately not exist yet on some paths (the surface
	// unmounts entirely when the secondary action opens chat). Nothing to focus
	// is not a failure.
	if (!target) {
		return false;
	}

	target.focus({ preventScroll: true });
	return true;
}
