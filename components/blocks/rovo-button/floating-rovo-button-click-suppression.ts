/**
 * Pure state machine for the floating Rovo button's drag-click suppression.
 *
 * The browser fires exactly one synthetic `click` at the end of a drag gesture.
 * We want to swallow that single click (so a drag does not accidentally open the
 * chat) while making sure the *next* click always works.
 *
 * Regression context: an earlier implementation re-armed a reset timer on every
 * intercepted click. Because a frustrated user clicks repeatedly when nothing
 * happens, each click pushed the reset further into the future and suppression
 * never cleared — so a dragged button could never be opened. The invariant
 * encoded here is that suppression is *consumed once* and is never extended by
 * subsequent clicks.
 */

export type FloatingRovoButtonClickSuppressionState = {
	/** Whether the next click should be swallowed instead of acted on. */
	readonly active: boolean;
};

export function createInitialClickSuppressionState(): FloatingRovoButtonClickSuppressionState {
	return { active: false };
}

/** Arm suppression — called when a drag actually moves the button. */
export function armClickSuppression(): FloatingRovoButtonClickSuppressionState {
	return { active: true };
}

export type FloatingRovoButtonClickDecision = {
	/** Whether this click should be swallowed (prevented + not acted on). */
	readonly suppress: boolean;
	/** The suppression state after handling this click. */
	readonly next: FloatingRovoButtonClickSuppressionState;
};

/**
 * Decide what to do with a click given the current suppression state.
 *
 * - If suppression is active, this one click is swallowed and suppression is
 *   immediately cleared (one-shot). It is NOT re-armed, so the following click
 *   passes through.
 * - If suppression is inactive, the click passes through untouched.
 */
export function handleClickWithSuppression(
	state: FloatingRovoButtonClickSuppressionState,
): FloatingRovoButtonClickDecision {
	if (state.active) {
		return { suppress: true, next: { active: false } };
	}

	return { suppress: false, next: state };
}
