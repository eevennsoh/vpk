"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Gap between a surface's right edge and the pill's left edge. */
const SURFACE_GAP = 10;
const FRAME_INSET = 20;

export interface StackPlacement {
	/**
	 * Unscaled px from the overlay's top edge to the trigger region's top edge. With the deck showing, that is the top
	 * of the deck band (a popped card rests level with the deck); with the list open the band is gone and it is the
	 * pill's top edge, so the list lines up with the pill.
	 */
	top: number;
	/** Unscaled px from the overlay's right edge to the surface's right edge (just left of the pill). */
	right: number;
	/** Room below `top` inside the frame. */
	maxHeight: number;
	/** The front deck card's top-right corner, relative to the surface's top-right corner, for the pop flight. */
	deckOffset: { x: number; y: number };
	/** Front deck card width in unscaled px: the pop starts at the thumbnail's size. */
	deckWidth: number;
}

/**
 * Measures the trigger region and the deck so overlay surfaces open just left of the pill, over the main column.
 * Surfaces render in the shell's overlay rather than a body portal so they pan and zoom with the canvas frame;
 * every measurement is divided by the frame's scale. The region grows and shrinks as the deck band comes and goes,
 * and the observer follows it frame by frame.
 */
export function useStackPlacement() {
	const overlayRef = useRef<HTMLDivElement>(null);
	const regionRef = useRef<HTMLDivElement>(null);
	const deckRef = useRef<HTMLSpanElement>(null);
	const [placement, setPlacement] = useState<StackPlacement | null>(null);
	useLayoutEffect(() => {
		const overlay = overlayRef.current;
		const region = regionRef.current;
		if (!overlay || !region) return undefined;
		const measure = () => {
			const frame = overlay.getBoundingClientRect();
			const anchor = region.getBoundingClientRect();
			const scale = frame.width / overlay.offsetWidth || 1;
			const top = (anchor.top - frame.top) / scale;
			const right = (frame.right - anchor.left) / scale + SURFACE_GAP;
			const surfaceRight = (anchor.left - frame.left) / scale - SURFACE_GAP;
			// Layout box, not the rotated cards: the deck box is the front slot's resting rectangle.
			const deckBox = deckRef.current?.getBoundingClientRect();
			const deckOffset = deckBox ? { x: (deckBox.right - frame.left) / scale - surfaceRight, y: (deckBox.top - anchor.top) / scale } : { x: 0, y: 0 };
			const deckWidth = deckBox ? deckBox.width / scale : 88;
			setPlacement({ top, right, maxHeight: overlay.offsetHeight - top - FRAME_INSET, deckOffset, deckWidth });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(overlay);
		observer.observe(region);
		// The rail scrolls independently; follow the pill when it does.
		const shell = overlay.parentElement;
		shell?.addEventListener("scroll", measure, { capture: true, passive: true });
		return () => {
			observer.disconnect();
			shell?.removeEventListener("scroll", measure, { capture: true });
		};
	}, []);
	return { overlayRef, regionRef, deckRef, placement };
}
