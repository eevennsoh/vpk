"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMotionValue } from "motion/react";
import type { JiraActivityEntry } from "@/components/blocks/jira-activity";

// h-16: the header owns headroom for the timeline hover label above its dots.
const HEADER_HEIGHT = 64;
const FEED_CLEARANCE = 12;

/** A scroll position paired with the fractional row index it reads as. */
type Knot = Readonly<{ scroll: number; index: number }>;

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

/** Evenly spaced stop for row `index`, so every row is one equal target (`scrubber-entries`). */
export function activityStopOffset(index: number, count: number): number {
	return count < 2 ? 0 : index / (count - 1);
}

/** Scroll positions where each row reaches the reading line, so the playhead sweeps every dot in order. */
function measureKnots(feed: HTMLElement, root: HTMLElement, offset: number): { knots: Knot[]; ids: string[] } {
	const viewport = root.getBoundingClientRect();
	const rows = [...feed.querySelectorAll<HTMLElement>("[data-jira-activity-entry-id]")];
	const ids = rows.map((row) => row.dataset.jiraActivityEntryId ?? "");
	const end = root.scrollTop + feed.getBoundingClientRect().bottom - viewport.bottom;
	const targets = rows.map((row) => root.scrollTop + row.getBoundingClientRect().top - viewport.top - offset);
	const first = targets[0] ?? 0;
	const last = targets.at(-1) ?? first;
	// Rows the feed can't lift to the reading line are rescaled into the scroll that exists,
	// keeping their proportions and landing the last row exactly at the bottom.
	const scale = last > end && last > first ? Math.max(0, end - first) / (last - first) : 1;
	const knots: Knot[] = [];
	for (const [index, target] of targets.entries()) {
		const scroll = first + (target - first) * scale;
		if (knots.length === 0 || scroll > knots.at(-1)!.scroll) knots.push({ scroll, index });
	}
	return { knots, ids };
}

function interpolate(knots: readonly Knot[], value: number, from: "scroll" | "index", to: "scroll" | "index"): number {
	const first = knots[0];
	const last = knots.at(-1);
	if (!first || !last) return 0;
	if (value <= first[from]) return first[to];
	if (value >= last[from]) return last[to];
	const next = knots.findIndex((knot) => knot[from] > value);
	const a = knots[next - 1]!;
	const b = knots[next]!;
	return a[to] + ((value - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
}

export function useProjectButterActivityNavigation(entries: readonly JiraActivityEntry[], sidePanel: boolean, focusId: string | null, view: "Activity" | "Audit" = "Activity") {
	const feedRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const progress = useMotionValue(0);
	const seekFrame = useRef(0);
	const seekPosition = useRef(0);
	const sticky = useRef(false);
	// A clicked stop stays selected until the feed scrolls somewhere else.
	const pinned = useRef<{ id: string; scroll: number } | null>(null);
	const previousView = useRef(view);
	const [visibleId, setVisibleId] = useState<string | null>(null);
	const [stuck, setStuck] = useState(false);
	const readingOffset = useCallback(() => (headerRef.current?.getBoundingClientRect().height || HEADER_HEIGHT) + FEED_CLEARANCE, []);
	const scrollToEntry = useCallback((id: string) => {
		const index = entries.findIndex((entry) => entry.id === id);
		scrollActivityRow(feedRef.current, id, readingOffset());
		const root = activityScrollport(feedRef.current);
		pinned.current = root ? { id, scroll: root.scrollTop } : null;
		progress.set(activityStopOffset(Math.max(0, index), entries.length));
		setVisibleId(id);
	}, [entries, progress, readingOffset]);
	const seekToProgress = useCallback((value: number) => {
		seekPosition.current = Math.min(1, Math.max(0, value));
		progress.set(seekPosition.current);
		if (seekFrame.current) return;
		seekFrame.current = requestAnimationFrame(() => {
			seekFrame.current = 0;
			const feed = feedRef.current;
			const root = activityScrollport(feed);
			if (!feed || !root) return;
			const { knots, ids } = measureKnots(feed, root, readingOffset());
			pinned.current = null;
			root.scrollTo({ top: interpolate(knots, seekPosition.current * Math.max(0, ids.length - 1), "index", "scroll"), behavior: "auto" });
		});
	}, [progress, readingOffset]);

	useLayoutEffect(() => {
		const changed = previousView.current !== view;
		previousView.current = view;
		const feed = feedRef.current;
		const root = activityScrollport(feed);
		const header = headerRef.current;
		if (!changed || !sticky.current || entries.length === 0 || !feed || !root || !header) return;
		root.scrollTop += header.getBoundingClientRect().top - root.getBoundingClientRect().top;
	}, [entries.length, view]);

	const focusVisible = entries.some((entry) => entry.id === focusId);
	useEffect(() => { if (focusId && focusVisible) scrollActivityRow(feedRef.current, focusId, readingOffset()); }, [focusId, focusVisible, readingOffset]);
	useEffect(() => {
		const feed = feedRef.current;
		const root = activityScrollport(feed);
		if (!feed || !root || entries.length === 0) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			const viewport = root.getBoundingClientRect();
			if (viewport.height === 0 || feed.getBoundingClientRect().height === 0) return;
			const headerTop = headerRef.current?.getBoundingClientRect().top ?? Infinity;
			sticky.current = Math.abs(headerTop - viewport.top) <= 1;
			setStuck(sticky.current);
			if (pinned.current && Math.abs(root.scrollTop - pinned.current.scroll) < 1) return;
			pinned.current = null;
			const { knots, ids } = measureKnots(feed, root, readingOffset());
			const index = interpolate(knots, root.scrollTop, "scroll", "index");
			progress.set(ids.length < 2 ? 0 : index / (ids.length - 1));
			setVisibleId(ids[Math.floor(index + 1e-6)] || null);
		};
		function schedule() { if (!frame) frame = requestAnimationFrame(update); }
		root.addEventListener("scroll", schedule, { passive: true });
		const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
		for (const element of [root, feed, headerRef.current]) {
			if (element) resize?.observe(element);
		}
		schedule();
		return () => { root.removeEventListener("scroll", schedule); resize?.disconnect(); if (frame) cancelAnimationFrame(frame); if (seekFrame.current) cancelAnimationFrame(seekFrame.current); seekFrame.current = 0; };
	}, [entries, sidePanel, progress, readingOffset]);
	return { feedRef, headerRef, progress, scrollToEntry, seekToProgress, stuck, visibleId };
}
