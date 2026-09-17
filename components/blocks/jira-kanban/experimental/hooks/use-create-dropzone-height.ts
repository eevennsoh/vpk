"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cancelFrame, frame } from "motion/react";
import { token } from "@/lib/tokens";

import { MAGNETIC_PROXIMITY_DISTANCE } from "@/components/ui-custom/hooks/use-magnetic-proximity";

/** Measure spare space from issue content; independent of the footer's reserved height. */
export function useCreateDropzoneHeight(active: boolean, placement: "top" | "bottom", columnSizing: "fill" | "content" = "fill") {
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
			if (columnSizing === "content") {
				const columnRect = column.getBoundingClientRect();
				const columnStyle = getComputedStyle(column);
				const bottom = columnRect.bottom - (parseFloat(columnStyle.borderBottomWidth) || 0) - 8;
				setMinimumHeight(Math.max(0, Math.floor(bottom - anchorRect.top)));
				return;
			}
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
	}, [active, placement, columnSizing]);

	// Keep the last drag's size during receipt playback; the new card must not
	// move the landing target while sessions are still flying into it.
	return { anchorRef, minimumHeight };
}

/** Follow the rendered shape after layout projection, without animating a second clock. */
export function useCreateDropzoneBackdrop(targetRef: RefObject<HTMLDivElement | null>, columnSizing: "fill" | "content") {
	const syncBackdrop = useCallback(() => {
		if (columnSizing !== "content") return;
		const target = targetRef.current;
		const column = target?.closest<HTMLElement>("[data-jira-kanban-column]");
		const backdrop = column?.querySelector<HTMLElement>("[data-jira-kanban-column-backdrop]");
		const content = column?.querySelector<HTMLElement>("[data-jira-kanban-column-content]");
		const button = target?.querySelector<HTMLElement>("[data-jira-dropzone-control]");
		if (!backdrop || !content || !button) return;
		// Finish all geometry reads before the compositor-only clip write.
		const backdropRect = backdrop.getBoundingClientRect();
		const contentRect = content.getBoundingClientRect();
		const shapeRect = button.getBoundingClientRect();
		const targetRect = target!.getBoundingClientRect();
		const inset = Math.max(0, targetRect.left - contentRect.left);
		const extent = Math.max(contentRect.height, shapeRect.bottom - backdropRect.top + inset);
		const bottom = Math.max(0, backdropRect.height - extent);
		backdrop.style.clipPath = `inset(0 0 ${bottom}px 0 round ${token("radius.xlarge")})`;
	}, [columnSizing, targetRef]);
	const startBackdrop = useCallback(() => {
		if (columnSizing === "content") frame.postRender(syncBackdrop, true);
	}, [columnSizing, syncBackdrop]);
	const finishBackdrop = useCallback(() => {
		cancelFrame(syncBackdrop);
		frame.postRender(syncBackdrop);
	}, [syncBackdrop]);
	useLayoutEffect(() => {
		const target = targetRef.current;
		const column = target?.closest<HTMLElement>("[data-jira-kanban-column]");
		const content = column?.querySelector<HTMLElement>("[data-jira-kanban-column-content]");
		if (columnSizing !== "content" || !target || !column || !content) return;
		syncBackdrop();
		const resize = new ResizeObserver(() => frame.postRender(syncBackdrop));
		resize.observe(target);
		resize.observe(column);
		resize.observe(content);
		return () => {
			resize.disconnect();
			cancelFrame(syncBackdrop);
		};
	}, [columnSizing, syncBackdrop, targetRef]);
	return { startBackdrop, finishBackdrop };
}
