"use client";

import { useEffect, useState } from "react";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";

import { PEEK_TIMING } from "./peek-timing";

/**
 * The agent's state for the header and the caught-up line.
 * - running: a re-run is in flight.
 * - found: the last re-run added suggestions. Shown briefly, because the New rows carry it after that.
 * - nothing: the last re-run found nothing. This is a resting state that stays until the next run, so the result
 *   of a check is never a flicker.
 */
export type RunNotice = { kind: "running" } | { kind: "found"; count: number } | { kind: "nothing"; ranAt: string } | null;

export function useRunNotice(feed: Pick<SuggestionFeed, "status" | "runs">): RunNotice {
	const runCount = feed.runs.length;
	const [settledRun, setSettledRun] = useState(runCount);
	useEffect(() => {
		if (settledRun === runCount) return undefined;
		const timer = window.setTimeout(() => setSettledRun(runCount), PEEK_TIMING.foundNoticeMs);
		return () => window.clearTimeout(timer);
	}, [runCount, settledRun]);

	if (feed.status === "running") return { kind: "running" };
	const last = feed.runs.at(-1);
	if (!last || last.number === 1) return null;
	if (last.ids.length === 0) return { kind: "nothing", ranAt: last.ranAt };
	return settledRun === runCount ? null : { kind: "found", count: last.ids.length };
}

/** "Just now" reads as a clipped "now" in a byline; everything else keeps its relative form. */
export function relativeTime(ranAt: string): string {
	return ranAt === "Just now" ? "just now" : ranAt;
}
