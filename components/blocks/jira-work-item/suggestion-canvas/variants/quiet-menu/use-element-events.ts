"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

type Handlers = Partial<{ [K in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[K]) => void }>;

/**
 * Attaches native listeners to a non-interactive container (a row group or the dialog surface), where
 * React handler props would read as interactive semantics. Handlers always see the latest render.
 */
export function useElementEvents(ref: RefObject<HTMLElement | null>, handlers: Handlers) {
	const dispatch = useEffectEvent((event: Event) => {
		const handler = handlers[event.type as keyof HTMLElementEventMap] as ((event: Event) => void) | undefined;
		handler?.(event);
	});
	const types = Object.keys(handlers).sort().join(" ");
	useEffect(() => {
		const element = ref.current;
		if (!element || !types) return undefined;
		const list = types.split(" ");
		const listener = (event: Event) => dispatch(event);
		list.forEach((type) => element.addEventListener(type, listener));
		return () => list.forEach((type) => element.removeEventListener(type, listener));
	}, [ref, types]);
}
