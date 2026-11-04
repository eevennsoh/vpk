"use client";

import { useId, type Ref } from "react";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Tile } from "@/components/ui/tile";
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

function triggerLabel(feed: SuggestionFeed, allNew: boolean): string {
	const pending = feed.review.pending.length;
	if (allNew) return `${pending} new ${pending === 1 ? "suggestion" : "suggestions"}`;
	if (pending > 0) return `${pending} ${pending === 1 ? "suggestion" : "suggestions"}`;
	const applied = feed.review.accepted.length;
	return applied === 0 ? "All caught up" : `${applied} ${applied === 1 ? "field" : "fields"} updated`;
}

export interface TimelineTriggerProps {
	feed: SuggestionFeed;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	triggerRef: Ref<HTMLButtonElement>;
}

/**
 * The "N suggestions" banner above Details, in sentence case like every line in the panel.
 * The count stays live in every state; while the agent re-checks,
 * only the Teamwork Graph loader moves, and unseen arrivals add a quiet "N new".
 */
export function TimelineTrigger({ feed, open, panelId, onToggle, triggerRef }: Readonly<TimelineTriggerProps>) {
	const labelId = useId();
	const running = feed.status === "running";
	const fresh = feed.newIds.size;
	// When everything waiting is new, say it once: "2 new suggestions", not "2 suggestions • 2 new".
	const allNew = !running && fresh > 0 && feed.review.pending.length > 0 && feed.review.pending.every((suggestion) => feed.newIds.has(suggestion.id));
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
				<TWGLoader active={running} label="Teamwork Graph" size="small" />
			</Tile>
			<span aria-live="polite" className="relative z-10 flex min-w-0 flex-1 items-center gap-2 text-sm text-text" id={labelId}>
				<span>{triggerLabel(feed, allNew)}</span>
				{fresh > 0 && !running && !allNew ? (
					<span className="inline-flex items-center gap-1 text-xs font-medium text-text-information">
						<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-information" />
						{fresh} new
					</span>
				) : null}
			</span>
			<TwgToolSourceStack className="relative z-10 shrink-0" sources={SUGGESTION_SOURCES} />
		</div>
	);
}
