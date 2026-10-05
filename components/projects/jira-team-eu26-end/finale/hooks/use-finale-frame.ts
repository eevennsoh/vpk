"use client";

import { createContext, use, useLayoutEffect, useRef } from "react";

export type FinaleFrameCallback = (time: number) => void;

export interface FinaleFrameRegistry {
	readonly subscribe: (callback: FinaleFrameCallback) => () => void;
}

export const FinaleFrameContext = createContext<FinaleFrameRegistry | null>(null);

/**
 * Runs `callback(musicTime)` every animation frame while the finale plays.
 * Scenes write styles straight to refs here, so React never re-renders per frame.
 */
export function useFinaleFrame(callback: FinaleFrameCallback): void {
	const registry = use(FinaleFrameContext);
	const callbackRef = useRef(callback);
	useLayoutEffect(() => {
		callbackRef.current = callback;
	});
	useLayoutEffect(() => {
		if (!registry) return undefined;
		return registry.subscribe((time) => callbackRef.current(time));
	}, [registry]);
}

/**
 * Creates a registry whose `emit` fans one clock reading out to every scene.
 * A scene that mounts after a reading (a wall column coming into view while
 * the clock is held) is given that reading at once, so it paints the current
 * frame instead of waiting for a clock that may not move.
 */
export function createFinaleFrameRegistry(): FinaleFrameRegistry & { readonly emit: FinaleFrameCallback } {
	const callbacks = new Set<FinaleFrameCallback>();
	let last: number | null = null;
	return {
		subscribe(callback) {
			callbacks.add(callback);
			if (last !== null) callback(last);
			return () => {
				callbacks.delete(callback);
			};
		},
		emit(time) {
			last = time;
			for (const callback of callbacks) callback(time);
		},
	};
}
