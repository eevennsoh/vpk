"use client";

import { useEffect, type RefObject } from "react";

import type { SuggestionRun } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";

import { PEEK_TIMING } from "./peek-timing";

/**
 * When a re-run adds suggestions, bring the first one into view inside the list, landing on its row boundary
 * so its label sits just under the header. Scrolls the list itself rather than calling scrollIntoView, which
 * would also move the pan/zoom canvas around the preview.
 */
export function useNewArrivalScroll(scrollRef: RefObject<HTMLDivElement | null>, lastRun: SuggestionRun | undefined) {
	const runNumber = lastRun?.number ?? 0;
	const firstNew = lastRun && lastRun.number > 1 ? lastRun.ids[0] : undefined;
	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller || firstNew == null) return undefined;
		// Wait for the arriving rows to finish growing, otherwise the list is not yet tall enough to scroll to them.
		const timer = window.setTimeout(() => {
			const row = scroller.querySelector<HTMLElement>(`[data-peek-row="${firstNew}"]`);
			if (!row) return;
			const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			const rowTop = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
			const paddingTop = Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
			scroller.scrollTo({ top: Math.max(0, rowTop - paddingTop), behavior: reduce ? "auto" : "smooth" });
		}, PEEK_TIMING.arrivalSettleMs);
		return () => window.clearTimeout(timer);
	}, [firstNew, runNumber, scrollRef]);
}
