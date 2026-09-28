"use client";

import { createContext, use, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

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

interface FinaleSceneProps {
	readonly from: number;
	readonly to: number;
	readonly children: ReactNode;
	readonly className?: string;
	readonly style?: CSSProperties;
}

/**
 * Full-stage layer that only renders (display) inside its music window, so
 * off-screen scenes cost no compositing.
 */
export function FinaleScene({ from, to, children, className, style }: Readonly<FinaleSceneProps>) {
	const ref = useRef<HTMLDivElement>(null);
	useFinaleFrame((time) => {
		const element = ref.current;
		if (!element) return;
		const visible = time >= from && time < to;
		const display = visible ? "block" : "none";
		if (element.style.display !== display) element.style.display = display;
	});
	return (
		<div
			ref={ref}
			className={className}
			style={{ position: "absolute", inset: 0, display: "none", ...style }}
		>
			{children}
		</div>
	);
}
