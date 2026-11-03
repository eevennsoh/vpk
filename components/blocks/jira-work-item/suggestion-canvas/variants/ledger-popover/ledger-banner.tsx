"use client";

import { useEffect, useId, useState, type Ref } from "react";

import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { Tile } from "@/components/ui/tile";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { TwgToolBannerBackground, TwgToolSourceStack, type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { motionDuration } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { lastRunFoundNothing } from "./ledger-status";

/** The products the agent read, matching the evidence kinds. The tile already stands for Teamwork Graph itself. */
const SUGGESTION_SOURCES = [
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "loom", label: "Loom", provider: "loom" },
] as const satisfies readonly TwgToolSource[];

/** How long the banner echoes an empty check before settling back: four of the slowest motion beats. */
const NOTHING_NEW_ECHO_MS = motionDuration.slowest * 4 * 1000;

/** True for a short beat after a re-run that found nothing, keyed to that run. */
function useNothingNewEcho(feed: SuggestionFeed): boolean {
	const run = feed.runs.length;
	const empty = lastRunFoundNothing(feed) && feed.status === "idle";
	const [settledRun, setSettledRun] = useState(0);
	useEffect(() => {
		if (!empty) return undefined;
		const timer = window.setTimeout(() => setSettledRun(run), NOTHING_NEW_ECHO_MS);
		return () => window.clearTimeout(timer);
	}, [empty, run]);
	return empty && settledRun !== run;
}

function BannerLabel({ feed, echo }: Readonly<{ feed: SuggestionFeed; echo: boolean }>) {
	if (echo) return <span className="text-text-subtle">No new suggestions</span>;
	const pending = feed.review.pending.length;
	if (pending === 0) return <span className="text-text-subtle">All caught up</span>;
	const fresh = feed.newIds.size;
	return (
		<>
			{pending} {pending === 1 ? "suggestion" : "suggestions"}
			{fresh > 0 ? <span className="ml-1.5 text-xs font-medium text-text-brand">{fresh} new</span> : null}
		</>
	);
}

export interface LedgerBannerProps {
	feed: SuggestionFeed;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	triggerRef: Ref<HTMLButtonElement>;
}

/**
 * The "N suggestions" banner above Details. The whole banner toggles the ledger, which opens to its left.
 * Its name stays "Suggestions"; the live count or state is its description. While the agent re-runs,
 * the count holds and only the graph mark animates.
 */
export function LedgerBanner({ feed, open, panelId, onToggle, triggerRef }: Readonly<LedgerBannerProps>) {
	const labelId = useId();
	const echo = useNothingNewEcho(feed);
	return (
		<div
			className={cn(
				"relative flex w-full shrink-0 items-center gap-3 overflow-hidden rounded-[calc(0.25*2.5rem+0.375rem+1px)] border bg-surface-sunken p-1.5 pr-2 text-left transition-[background-color,border-color] duration-xxshort ease-out-practical has-[button:hover]:bg-surface-raised-hovered has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50",
				open ? "border-border-bold/60" : "border-border",
			)}
		>
			<button
				aria-controls={open ? panelId : undefined}
				aria-describedby={labelId}
				aria-expanded={open}
				aria-label="Suggestions"
				className="absolute inset-0 z-20 rounded-[inherit] outline-none"
				onClick={onToggle}
				ref={triggerRef}
				type="button"
			/>
			<TwgToolBannerBackground />
			<Tile className="relative z-10 bg-surface" hasBorder label="Teamwork Graph" size="large" variant="transparent">
				<TWGLoader active={feed.status === "running"} label="Teamwork Graph" size="small" />
			</Tile>
			<span aria-live="polite" className="relative z-10 min-w-0 flex-1 text-sm text-text" id={labelId}><BannerLabel echo={echo} feed={feed} /></span>
			<TwgToolSourceStack className="relative z-10 shrink-0" sources={SUGGESTION_SOURCES} />
		</div>
	);
}
