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
