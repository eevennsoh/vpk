"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const PANEL_GAP = 8;
const FRAME_INSET = 24;

/**
 * Places the deck popover to the left of its trigger, top-aligned with it, over the main column.
 * It renders in the shell's overlay rather than a body portal so it pans and zooms with its canvas frame.
 */
export function useOverlayPlacement(open: boolean) {
	const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
	const anchorRef = useRef<HTMLDivElement>(null);
	const [style, setStyle] = useState<CSSProperties | null>(null);
	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		if (!open || !overlay || !anchor) return undefined;
		const measure = () => {
			const frame = overlay.getBoundingClientRect();
			const trigger = anchor.getBoundingClientRect();
			const scale = frame.width / overlay.offsetWidth || 1;
			const top = (trigger.top - frame.top) / scale;
			setStyle({ top, right: (frame.right - trigger.left) / scale + PANEL_GAP, maxHeight: overlay.offsetHeight - top - FRAME_INSET });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(overlay);
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [open, overlay]);
	/** `overlayRef` is a callback ref; `overlay` is the element, for portals that render into it. */
	return { overlayRef: setOverlay, overlay, anchorRef, style };
}
