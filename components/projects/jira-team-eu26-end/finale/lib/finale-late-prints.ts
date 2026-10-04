/** The print-related fields of a GL card sheet. */
export interface FinalePrintSource {
	readonly printKey: string;
	readonly print?: unknown;
	readonly resolvePrint?: () => HTMLCanvasElement | undefined;
}

/**
 * Print keys that start on a stand-in texture and can still swap in a late
 * print, mapped to a resolver. Sheets share one texture per print key, and the
 * first sheet to claim a key (often an echo) may not carry a resolver, so the
 * resolver is taken from any sheet with that key.
 */
export function latePrintResolvers(cards: readonly FinalePrintSource[]): Map<string, () => HTMLCanvasElement | undefined> {
	const printed = new Set(cards.filter((card) => card.print).map((card) => card.printKey));
	const resolvers = new Map<string, () => HTMLCanvasElement | undefined>();
	for (const card of cards) {
		if (printed.has(card.printKey) || !card.resolvePrint || resolvers.has(card.printKey)) continue;
		resolvers.set(card.printKey, card.resolvePrint);
	}
	return resolvers;
}
