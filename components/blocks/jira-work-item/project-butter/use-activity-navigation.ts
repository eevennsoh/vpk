"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JiraActivityEntry } from "@/components/blocks/jira-activity";

function scrollActivityRow(feed: HTMLDivElement | null, id: string) {
	const row = [...(feed?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === id);
	const scrollport = activityScrollport(feed);
	if (row && scrollport) scrollport.scrollTo({ top: scrollport.scrollTop + row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top - 64, behavior: "auto" });
}

export function activityScrollport(feed: HTMLElement | null): HTMLElement | null {
	let parent = feed?.parentElement ?? null;
	while (parent && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
	return parent;
}

export function useProjectButterActivityNavigation(entries: readonly JiraActivityEntry[], sidePanel: boolean, focusId: string | null) {
	const feedRef = useRef<HTMLDivElement>(null);
	const [visibleId, setVisibleId] = useState<string | null>(null);
	const scrollToEntry = useCallback((id: string) => {
		scrollActivityRow(feedRef.current, id);
		setVisibleId(id);
	}, []);
	useEffect(() => { if (focusId) scrollActivityRow(feedRef.current, focusId); }, [focusId]);
	useEffect(() => {
		const feed = feedRef.current;
		if (!feed) return;
		const scrollport = activityScrollport(feed);
		if (!scrollport) return;
		const root = scrollport;
		let frame = 0;
		function update() {
			frame = 0;
			const top = root.getBoundingClientRect().top + 64;
			const rows = [...(feed?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])];
			const nearest = rows.reduce<HTMLElement | null>((best, row) => !best || Math.abs(row.getBoundingClientRect().top - top) < Math.abs(best.getBoundingClientRect().top - top) ? row : best, null);
			if (nearest) setVisibleId(nearest.dataset.jiraActivityEntryId ?? null);
		}
		function onScroll() { if (!frame) frame = requestAnimationFrame(update); }
		root.addEventListener("scroll", onScroll, { passive: true });
		const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onScroll);
		resize?.observe(feed);
		return () => { root.removeEventListener("scroll", onScroll); resize?.disconnect(); if (frame) cancelAnimationFrame(frame); };
	}, [entries, sidePanel]);
	return { feedRef, scrollToEntry, visibleId };
}
