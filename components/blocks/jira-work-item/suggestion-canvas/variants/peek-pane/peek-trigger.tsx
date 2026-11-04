"use client";

import { useId, type Ref } from "react";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Tile } from "@/components/ui/tile";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { TwgToolBannerBackground, TwgToolSourceStack, type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { cn } from "@/lib/utils";

/** The products the agent read, matching the evidence kinds behind the suggestions. */
const SUGGESTION_SOURCES = [
	{ id: "twg", label: "Teamwork Graph", provider: "twg" },
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "loom", label: "Loom", provider: "loom" },
] as const satisfies readonly TwgToolSource[];

function countLabel(feed: SuggestionFeed): string {
	const pending = feed.review.pending.length;
	if (pending > 0) return `${pending} ${pending === 1 ? "Suggestion" : "Suggestions"}`;
	return "All caught up";
}

export interface PeekTriggerProps {
	feed: SuggestionFeed;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	triggerRef: Ref<HTMLButtonElement>;
}

/**
 * The "N Suggestions" banner above Details. It carries the live count, the running state and unseen arrivals.
 * A run replaces the label rather than appending to it, so it never reads "All caught up · Checking…".
 */
export function PeekTrigger({ feed, open, panelId, onToggle, triggerRef }: Readonly<PeekTriggerProps>) {
	const labelId = useId();
	const running = feed.status === "running";
	const fresh = feed.newIds.size;
	return (
		<div
			className={cn(
				"relative flex w-full shrink-0 items-center gap-3 overflow-hidden rounded-2xl border bg-surface-sunken p-1.5 pr-2 text-left transition-[background-color,border-color] duration-xxshort ease-out-practical has-[button:hover]:bg-surface-raised-hovered has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50",
				open ? "border-border-bold/60" : "border-border",
			)}
		>
			<button
				aria-controls={open ? panelId : undefined}
				aria-expanded={open}
				aria-labelledby={labelId}
				className="absolute inset-0 z-20 rounded-[inherit] outline-none"
				onClick={onToggle}
				ref={triggerRef}
				type="button"
			/>
			<TwgToolBannerBackground />
			<Tile className="relative z-10 bg-surface" hasBorder label="Teamwork Graph" size="large" variant="transparent">
				<TWGLoader active={running} label={running ? "Checking for suggestions" : "Teamwork Graph"} size="small" />
			</Tile>
			<span aria-live="polite" className="relative z-10 flex min-w-0 flex-1 items-center gap-2 text-sm text-text" id={labelId}>
				{running ? <Shimmer as="span">Checking for suggestions…</Shimmer> : countLabel(feed)}
				{fresh > 0 && !running ? (
					<span className="inline-flex items-center gap-1 text-xs font-medium text-text-discovery">
						<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-discovery" />
						{fresh} new
					</span>
				) : null}
			</span>
			<TwgToolSourceStack className="relative z-10 shrink-0" sources={SUGGESTION_SOURCES} />
		</div>
	);
}
