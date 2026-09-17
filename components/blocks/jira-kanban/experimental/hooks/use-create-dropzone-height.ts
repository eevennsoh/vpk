"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { MAGNETIC_PROXIMITY_DISTANCE } from "@/components/ui-custom/hooks/use-magnetic-proximity";

/** Measure spare space from issue content; independent of the footer's reserved height. */
export function useCreateDropzoneHeight(active: boolean, placement: "top" | "bottom") {
	const anchorRef = useRef<HTMLDivElement>(null);
	const [minimumHeight, setMinimumHeight] = useState(0);

	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		const column = anchor?.closest<HTMLElement>("[data-jira-kanban-column]");
		const list = column?.querySelector<HTMLElement>("[data-jira-kanban-card-list]");
		if (!active || !anchor || !column || !list) return;

		let frame = 0;
		const measure = () => {
			frame = 0;
			const anchorRect = anchor.getBoundingClientRect();
			const listRect = list.getBoundingClientRect();
			const cards = list.querySelectorAll<HTMLElement>("[data-issue-key]");
			const lastCard = cards[cards.length - 1];
			const listStyle = getComputedStyle(list);
			const contentTop = listRect.top + (parseFloat(listStyle.paddingTop) || 0);
			// Protect actual issues, including their agent footers, and fill an empty list.
			const contentBottom = Math.max(contentTop, lastCard?.getBoundingClientRect().bottom ?? contentTop);
			const clearance = lastCard
				? Math.max(parseFloat(listStyle.rowGap) || 0, parseFloat(listStyle.paddingBottom) || 0) + MAGNETIC_PROXIMITY_DISTANCE
				// Even an empty scrollport retains its padding when the footer grows.
				: (parseFloat(listStyle.paddingBottom) || 0) + 8;
			const available = placement === "top"
				? listRect.bottom - anchorRect.top
				// Leave room for the bounded magnetic lean without covering a card.
				: anchorRect.bottom - contentBottom - clearance;
			setMinimumHeight(Math.max(0, Math.floor(available)));
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		const resize = new ResizeObserver(schedule);
		const observeSizes = () => {
			resize.disconnect();
			resize.observe(column);
			resize.observe(list);
			for (const child of list.children) resize.observe(child);
		};
		const mutations = new MutationObserver(() => {
			observeSizes();
			schedule();
		});
		mutations.observe(list, { childList: true, subtree: true });
		list.addEventListener("scroll", schedule, { passive: true });
		observeSizes();
		measure();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			mutations.disconnect();
			list.removeEventListener("scroll", schedule);
		};
	}, [active, placement]);

	// Keep the last drag's size during receipt playback; the new card must not
	// move the landing target while sessions are still flying into it.
	return { anchorRef, minimumHeight };
}
