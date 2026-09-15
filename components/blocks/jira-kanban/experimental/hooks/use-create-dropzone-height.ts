"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Measure unused column space without resizing the card scrollport. */
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
			const lastCard = list.lastElementChild;
			// Attachment chrome expands on hover; it must not push the create
			// target away from a pointer that is already entering the free space.
			const chinHeight = lastCard?.querySelector('[data-slot="jira-issue-attach-chin"]')
				?.getBoundingClientRect().height ?? 0;
			const listStyle = getComputedStyle(list);
			const gap = Math.max(parseFloat(listStyle.rowGap) || 0, parseFloat(listStyle.paddingBottom) || 0);
			const contentBottom = Math.max(listRect.top, (lastCard?.getBoundingClientRect().bottom ?? listRect.top) - chinHeight);
			const available = placement === "top"
				? listRect.bottom - anchorRect.top
				: anchorRect.bottom - contentBottom - gap;
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
