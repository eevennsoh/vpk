"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** How far content fades out as it scrolls under an edge. */
const FADE_PX = 20;

export interface ScrollEdges {
	/** Content is hidden above the visible area. */
	top: boolean;
	/** Content is hidden below the visible area. */
	bottom: boolean;
}

/**
 * Tracks whether a scroller has content hidden past either edge, so the edge can fade
 * and show there is more. Edges stay crisp when nothing is cut off.
 */
export function useScrollEdges(scrollRef: RefObject<HTMLElement | null>): ScrollEdges {
	const [edges, setEdges] = useState<ScrollEdges>({ top: false, bottom: false });
	useLayoutEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return undefined;
		const measure = () => {
			const top = scroller.scrollTop > 1;
			const bottom = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
			setEdges((current) => (current.top === top && current.bottom === bottom ? current : { top, bottom }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		for (const child of Array.from(scroller.children)) observer.observe(child);
		const mutations = new MutationObserver(measure);
		mutations.observe(scroller, { childList: true, subtree: true });
		scroller.addEventListener("scroll", measure, { passive: true });
		return () => {
			observer.disconnect();
			mutations.disconnect();
			scroller.removeEventListener("scroll", measure);
		};
	}, [scrollRef]);
	return edges;
}

/** A mask that fades only the edges with hidden content. */
export function edgeFadeStyle({ top, bottom }: ScrollEdges): CSSProperties | undefined {
	if (!top && !bottom) return undefined;
	const mask = `linear-gradient(to bottom, ${top ? "transparent" : "black"}, black ${top ? FADE_PX : 0}px, black calc(100% - ${bottom ? FADE_PX : 0}px), ${bottom ? "transparent" : "black"})`;
	return { maskImage: mask, WebkitMaskImage: mask };
}
