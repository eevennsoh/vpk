"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMotionValue } from "motion/react";
import type { JiraActivityEntry } from "@/components/blocks/jira-activity";

const HEADER_HEIGHT = 56;
const TIMELINE_HEIGHT = 44;
const FEED_CLEARANCE = 12;

export function activityScrollport(feed: HTMLElement | null): HTMLElement | null {
	let parent = feed?.parentElement ?? null;
	while (parent && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
	return parent;
}

function scrollActivityRow(feed: HTMLDivElement | null, id: string, offset: number) {
	const row = [...(feed?.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]") ?? [])].find((node) => node.dataset.jiraActivityEntryId === id);
	const scrollport = activityScrollport(feed);
	if (row && scrollport) scrollport.scrollTo({ top: scrollport.scrollTop + row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top - offset, behavior: "auto" });
}

export function useProjectButterActivityNavigation(entries: readonly JiraActivityEntry[], sidePanel: boolean, focusId: string | null, active = true, view: "Activity" | "Audit" = "Activity") {
	const feedRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const timelineRef = useRef<HTMLDivElement>(null);
	const progress = useMotionValue(0);
	const seekFrame = useRef(0);
	const seekPosition = useRef(0);
	const sticky = useRef(false);
	const previousView = useRef(view);
	const [visibleId, setVisibleId] = useState<string | null>(null);
	const [entryOffsets, setEntryOffsets] = useState<Readonly<Record<string, number>>>({});
	const readingOffset = useCallback(() => (headerRef.current?.getBoundingClientRect().height || HEADER_HEIGHT) + (timelineRef.current?.getBoundingClientRect().height || TIMELINE_HEIGHT) + FEED_CLEARANCE, []);
	const scrollToEntry = useCallback((id: string) => {
		scrollActivityRow(feedRef.current, id, readingOffset());
		progress.set(entryOffsets[id] ?? 0);
		setVisibleId(id);
	}, [entryOffsets, progress, readingOffset]);
	const seekToProgress = useCallback((value: number) => {
		seekPosition.current = Math.min(1, Math.max(0, value));
		progress.set(seekPosition.current);
		if (seekFrame.current) return;
		seekFrame.current = requestAnimationFrame(() => {
			seekFrame.current = 0;
			const feed = feedRef.current;
			const root = activityScrollport(feed);
			if (!feed || !root) return;
			const viewport = root.getBoundingClientRect();
			const bounds = feed.getBoundingClientRect();
			const first = feed.querySelector<HTMLElement>("[data-jira-activity-entry-id]")?.getBoundingClientRect();
			const start = root.scrollTop + (first?.top ?? bounds.top) - viewport.top - readingOffset();
			const end = root.scrollTop + bounds.bottom - viewport.bottom;
			root.scrollTo({ top: start + Math.max(0, end - start) * seekPosition.current, behavior: "auto" });
		});
	}, [progress, readingOffset]);

	useLayoutEffect(() => {
		const changed = previousView.current !== view;
		previousView.current = view;
		const feed = feedRef.current;
		const root = activityScrollport(feed);
		const header = headerRef.current;
		if (!changed || !sticky.current || !active || entries.length === 0 || !feed || !root || !header) return;
		feed.style.minHeight = `${Math.max(0, root.clientHeight - (header.getBoundingClientRect().height || HEADER_HEIGHT))}px`;
		root.scrollTop += header.getBoundingClientRect().top - root.getBoundingClientRect().top;
	}, [active, entries.length, view]);

	const focusVisible = entries.some((entry) => entry.id === focusId);
	useEffect(() => { if (active && focusId && focusVisible) scrollActivityRow(feedRef.current, focusId, readingOffset()); }, [active, focusId, focusVisible, readingOffset]);
	useEffect(() => {
		const feed = feedRef.current;
		const root = activityScrollport(feed);
		if (!feed || !root || !active || entries.length === 0) return;
		let frame = 0;
		const previousMinHeight = feed.style.minHeight;
		const update = () => {
			frame = 0;
			const viewport = root.getBoundingClientRect();
			const bounds = feed.getBoundingClientRect();
			if (viewport.height === 0 || bounds.height === 0) return;
			const offset = readingOffset();
			const rows = [...feed.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]")].map((row) => ({ id: row.dataset.jiraActivityEntryId ?? null, bounds: row.getBoundingClientRect() }));
			const readingLine = viewport.top + offset;
			sticky.current = (headerRef.current?.getBoundingClientRect().top ?? Infinity) <= viewport.top + 1;
			const visible = rows.find((row) => row.bounds.bottom > readingLine) ?? rows.at(-1);
			const firstTop = rows[0]?.bounds.top ?? bounds.top;
			const start = root.scrollTop + firstTop - viewport.top - offset;
			const end = root.scrollTop + bounds.bottom - viewport.bottom;
			const nextProgress = Math.min(1, Math.max(0, (root.scrollTop - start) / Math.max(1, end - start)));
			const nextOffsets = Object.fromEntries(rows.flatMap((row) => row.id ? [[row.id, Math.min(1, Math.max(0, (row.bounds.top - firstTop) / Math.max(1, end - start)))]] : []));
			const minHeight = `${Math.max(0, root.clientHeight - (headerRef.current?.getBoundingClientRect().height || HEADER_HEIGHT))}px`;
			if (feed.style.minHeight !== minHeight) feed.style.minHeight = minHeight;
			progress.set(nextProgress);
			setEntryOffsets((previous) => Object.keys(previous).length === rows.length && Object.entries(nextOffsets).every(([id, value]) => Math.abs((previous[id] ?? -1) - value) < 0.0001) ? previous : nextOffsets);
			setVisibleId((nextProgress === 1 ? rows.at(-1) : visible)?.id ?? null);
		};
		function schedule() { if (!frame) frame = requestAnimationFrame(update); }
		root.addEventListener("scroll", schedule, { passive: true });
		const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
		for (const element of [root, feed, headerRef.current, timelineRef.current]) {
			if (element) resize?.observe(element);
		}
		schedule();
		return () => { root.removeEventListener("scroll", schedule); resize?.disconnect(); if (frame) cancelAnimationFrame(frame); if (seekFrame.current) cancelAnimationFrame(seekFrame.current); seekFrame.current = 0; feed.style.minHeight = previousMinHeight; };
	}, [active, entries, sidePanel, progress, readingOffset]);
	return { feedRef, headerRef, timelineRef, progress, entryOffsets, scrollToEntry, seekToProgress, visibleId };
}
