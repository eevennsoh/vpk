"use client";

import { useCallback, useMemo, useState } from "react";

export interface ScreenNavigatorController {
	index: number;
	count: number;
	/** True while there is a previous screen to step back to. */
	canPrev: boolean;
	/** True while there is a next screen to step forward to. */
	canNext: boolean;
	next: () => void;
	prev: () => void;
	goTo: (index: number) => void;
	/** Rewind to the first screen (wired to the gallery Reset control). */
	reset: () => void;
}

/**
 * Clamped left/right navigation over a fixed set of screens. Mirrors the
 * terminal demo's beat stepping (see `useTerminalDemo`) but for a static screen
 * carousel: prev/next move one screen and clamp at the ends (no wrap), so the
 * gallery top-bar arrows disable at the boundaries.
 *
 * The returned controller is memoized so its identity is stable between renders
 * where `index`/`count` are unchanged — the callers hoist it and pass it to both
 * the top-bar controls and the stage, and depend on the stable `next`/`prev`
 * callbacks for their keyboard handler.
 */
export function useScreenNavigator(count: number): ScreenNavigatorController {
	const [index, setIndex] = useState(0);

	const clamp = useCallback(
		(value: number) => Math.min(Math.max(value, 0), Math.max(count - 1, 0)),
		[count],
	);
	const goTo = useCallback((next: number) => setIndex(() => clamp(next)), [clamp]);
	const next = useCallback(() => setIndex((current) => clamp(current + 1)), [clamp]);
	const prev = useCallback(() => setIndex((current) => clamp(current - 1)), [clamp]);
	const reset = useCallback(() => setIndex(0), []);

	return useMemo(
		() => ({
			index,
			count,
			canPrev: index > 0,
			canNext: index < count - 1,
			next,
			prev,
			goTo,
			reset,
		}),
		[index, count, next, prev, goTo, reset],
	);
}
