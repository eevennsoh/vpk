"use client";

import type { ReactNode, Ref } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { cn } from "@/lib/utils";

import { DECK_BAND, PeekingDeck } from "./peeking-deck";
import { lastRunFoundNothing } from "./stack-order";

export interface StackTriggerProps {
	feed: SuggestionFeed;
	/** Pending cards still in the stack, front first (the popped card is out of it). */
	deck: readonly WorkItemSuggestion[];
	/** Keep the band above the pill even with an empty deck (a card or its receipt is out over the work item). */
	holdBand: boolean;
	/** Reduced motion: no autonomous pop, so the deck shows a static count. */
	autonomous: boolean;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	/** Sits in the band above the pill, in place of the deck: the receipt of the decision just made. */
	receipt: ReactNode;
	receiptShown: boolean;
	regionRef: Ref<HTMLDivElement>;
	triggerRef: Ref<HTMLButtonElement>;
	deckRef: Ref<HTMLSpanElement>;
}

function triggerName(feed: SuggestionFeed): string {
	if (feed.status === "running") return "Work item suggestions, checking for new suggestions";
	const pending = feed.review.pending.length;
	if (pending === 0) return `Work item suggestions, all caught up${lastRunFoundNothing(feed) ? ", checked just now, nothing new" : ""}`;
	const fresh = feed.newIds.size;
	return `Work item suggestions, ${pending} to review${fresh > 0 ? `, ${fresh} new` : ""}`;
}

function TriggerMark({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	if (feed.status === "running") return <TWGLoader active label="" size="small" />;
	if (feed.review.pending.length === 0) return <span className="flex size-4 items-center justify-center text-icon-success"><CheckMarkIcon color="currentColor" label="" size="small" /></span>;
	return <TeamworkGraphMark className="size-4" />;
}

function TriggerLabel({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	if (feed.status === "running") return <Shimmer as="span" className="text-sm text-text-subtle">Checking for new…</Shimmer>;
	const pending = feed.review.pending.length;
	if (pending === 0) {
		return (
			<span className="inline-flex items-baseline gap-1.5 text-sm text-text-subtle">
				All caught up
				{lastRunFoundNothing(feed) ? <span className="text-xs text-text-subtlest">· nothing new</span> : null}
			</span>
		);
	}
	const fresh = feed.newIds.size;
	return (
		<span className="inline-flex items-baseline gap-2 text-sm text-text">
			<span className="tabular-nums">{pending} {pending === 1 ? "suggestion" : "suggestions"}</span>
			{fresh > 0 ? <span className="text-xs font-medium text-text-brand tabular-nums">{fresh} new</span> : null}
		</span>
	);
}

/**
 * The slim "N suggestions" pill above Details, with the deck of cards peeking out of its right end like a pocket.
 * The band above the pill exists only while the deck holds something, and it is not a target: the button is the pill,
 * and the deck cards poke out of it, so the hit area is exactly what is visible. The pill keeps one width in every
 * state so the chevron and deck never shift as the agent re-runs.
 */
export function StackTrigger({ feed, deck, holdBand, autonomous, open, panelId, onToggle, receipt, receiptShown, regionRef, triggerRef, deckRef }: Readonly<StackTriggerProps>) {
	const pending = feed.review.pending.length;
	const band = !open && (deck.length > 0 || holdBand);
	return (
		<div
			className="relative shrink-0 self-start transition-[padding-top] duration-medium ease-in-out"
			ref={regionRef}
			style={{ paddingTop: band ? DECK_BAND : 0 }}
		>
			{receipt}
			<button
				aria-controls={open ? panelId : undefined}
				aria-expanded={open}
				aria-label={triggerName(feed)}
				className="group/trigger relative flex h-9 w-60 items-center gap-2 rounded-lg pr-2.5 pl-3 text-left outline-none"
				onClick={onToggle}
				onKeyDown={(event) => {
					if (event.key === "Escape" && open) onToggle();
				}}
				ref={triggerRef}
				type="button"
			>
				<PeekingDeck
					cards={open || receiptShown ? [] : deck}
					deckRef={deckRef}
					newIds={feed.newIds}
					running={feed.status === "running"}
					staticCount={!autonomous && pending > 0 ? pending : null}
				/>
				{/* The pill face (border, fill, focus ring) sits above the deck so the cards read as tucked behind it. */}
				<span
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-0 z-10 rounded-lg border border-border bg-surface transition-colors duration-xxshort ease-out-practical",
						"group-hover/trigger:bg-surface-hovered group-active/trigger:bg-surface-pressed group-focus-visible/trigger:ring-2 group-focus-visible/trigger:ring-ring group-aria-expanded/trigger:border-border-bold group-aria-expanded/trigger:bg-surface",
					)}
				/>
				<span aria-hidden="true" className="relative z-10 flex shrink-0"><TriggerMark feed={feed} /></span>
				<span className="relative z-10 min-w-0"><TriggerLabel feed={feed} /></span>
				<span className="min-w-2 flex-1" />
				<span aria-hidden="true" className="relative z-10 flex shrink-0 text-icon-subtle transition-transform duration-normal ease-out-practical group-aria-expanded/trigger:rotate-180">
					<ChevronDownIcon color="currentColor" label="" size="small" />
				</span>
			</button>
		</div>
	);
}
