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

/** Creates a registry whose `emit` fans one clock reading out to every scene. */
export function createFinaleFrameRegistry(): FinaleFrameRegistry & { readonly emit: FinaleFrameCallback } {
	const callbacks = new Set<FinaleFrameCallback>();
	return {
		subscribe(callback) {
			callbacks.add(callback);
			return () => {
				callbacks.delete(callback);
			};
		},
		emit(time) {
			for (const callback of callbacks) callback(time);
		},
	};
}
