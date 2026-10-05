/**
 * Tracks the order cards arrive in Done. Arrivals append; a card dragged back
 * out leaves the order, and returns at the end if it is dragged in again.
 */
export function nextFinaleDragOrder(previous: readonly string[], doneCodes: readonly string[]): readonly string[] {
	const done = new Set(doneCodes);
	const kept = previous.filter((code) => done.has(code));
	const seen = new Set(kept);
	const arrived = doneCodes.filter((code) => !seen.has(code));
	if (arrived.length === 0 && kept.length === previous.length) return previous;
	return [...kept, ...arrived];
}

/** The cards one drop brought into Done (a bulk drag brings several at once). */
export function finaleArrivals(previous: readonly string[], next: readonly string[]): readonly string[] {
	const known = new Set(previous);
	return next.filter((code) => !known.has(code));
}

/**
 * Whether a drop earns the small celebration: cards into Done, one or a
 * bulk drag of several, short of the drop that completes the board (that one
 * opens the finale and its full burst instead).
 */
export function finaleSmallConfettiDue(arrived: readonly string[], boardComplete: boolean): boolean {
	return arrived.length > 0 && !boardComplete;
}
