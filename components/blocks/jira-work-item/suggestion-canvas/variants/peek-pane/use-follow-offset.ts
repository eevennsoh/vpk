"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The drawer's label line sits this far below its top edge, and the row's label line this far below the row's top.
 * Offsetting by the difference lines the two labels up on one baseline.
 */
const LABEL_ALIGN = 14 - 8;

export interface FollowPosition {
	/** The drawer's distance below the popover's top. */
	offset: number;
	/** The explained row's top, in the popover's layout pixels. */
	rowTop: number;
}

/**
 * Where the peek drawer should sit so it reads beside the row it explains: its label level with the row's label,
 * clamped so the drawer never pokes above or below the popover. Re-measures when the row, the drawer's height or the
 * list's scroll position or layout change, coalesced to one frame.
 */
export function useFollowOffset({
	popoverRef,
	scrollRef,
	rowId,
	drawerHeight,
	popoverHeight,
}: Readonly<{
	popoverRef: RefObject<HTMLElement | null>;
	scrollRef: RefObject<HTMLElement | null>;
	rowId: string | null;
	drawerHeight: number | null;
	popoverHeight: number | null;
}>): FollowPosition {
	const [position, setPosition] = useState<FollowPosition>({ offset: 0, rowTop: 0 });
	useLayoutEffect(() => {
		const popover = popoverRef.current;
		const scroller = scrollRef.current;
		if (!popover || !scroller || rowId == null) return undefined;
		const measure = () => {
			const anchor = scroller.querySelector<HTMLElement>(`[data-peek-row="${rowId}"] [data-peek-anchor]`);
			if (!anchor) return;
			const box = popover.getBoundingClientRect();
			// The preview sits in a pan/zoom canvas, so convert screen pixels back to layout pixels.
			const scale = box.height / popover.offsetHeight || 1;
			const rowTop = (anchor.getBoundingClientRect().top - box.top) / scale;
			const room = Math.max(0, (popoverHeight ?? popover.offsetHeight) - (drawerHeight ?? 0));
			const offset = Math.round(Math.min(Math.max(rowTop - LABEL_ALIGN, 0), room));
			const top = Math.round(rowTop);
			setPosition((current) => (current.offset === offset && current.rowTop === top ? current : { offset, rowTop: top }));
		};
		measure();
		let frame = 0;
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		};
		// Rows above can fold or arrive while the pane is open, which moves this row without a scroll.
		const observer = new ResizeObserver(schedule);
		for (const child of Array.from(scroller.children)) observer.observe(child);
		scroller.addEventListener("scroll", schedule, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			scroller.removeEventListener("scroll", schedule);
		};
	}, [drawerHeight, popoverHeight, popoverRef, rowId, scrollRef]);
	return position;
}
