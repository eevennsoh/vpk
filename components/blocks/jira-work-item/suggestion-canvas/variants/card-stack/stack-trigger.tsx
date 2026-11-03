"use client";

import { useId, type Ref } from "react";

import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
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

function TriggerLabel({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	if (feed.status === "running") return <span className="text-text-subtle">Checking for suggestions…</span>;
	const pending = feed.review.pending.length;
	if (pending === 0) return <span className="text-text-subtle">All caught up</span>;
	const fresh = feed.newIds.size;
	return (
		<>
			{pending} {pending === 1 ? "suggestion" : "suggestions"}
			{fresh > 0 ? (
				<>
					<span className="sr-only">, </span>
					<span className="ml-1.5 text-xs font-medium text-text-discovery">{fresh} new</span>
				</>
			) : null}
		</>
	);
}

export interface StackTriggerProps {
	feed: SuggestionFeed;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	triggerRef: Ref<HTMLButtonElement>;
}

/**
 * The live "N suggestions" banner above Details, matching the Ledger's. Its accessible name is its visible label
 * (the live count or run state), so what a screen reader announces matches what is shown. The graph mark is decorative and animates while the agent re-runs.
 */
export function StackTrigger({ feed, open, panelId, onToggle, triggerRef }: Readonly<StackTriggerProps>) {
	const labelId = useId();
	return (
		<div
			className={cn(
				"relative flex w-full shrink-0 items-center gap-3 overflow-hidden rounded-xl border bg-surface-sunken p-1.5 pr-2 text-left transition-[background-color,border-color] duration-xxshort ease-out-practical has-[button:hover]:bg-surface-raised-hovered has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50",
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
			<Tile aria-hidden className="relative z-10 bg-surface" hasBorder label="Teamwork Graph" size="large" variant="transparent">
				<TWGLoader active={feed.status === "running"} label="" size="small" />
			</Tile>
			<span aria-live="polite" className="relative z-10 min-w-0 flex-1 text-sm text-text" id={labelId}><TriggerLabel feed={feed} /></span>
			<TwgToolSourceStack className="relative z-10 shrink-0" sources={SUGGESTION_SOURCES} />
		</div>
	);
}
