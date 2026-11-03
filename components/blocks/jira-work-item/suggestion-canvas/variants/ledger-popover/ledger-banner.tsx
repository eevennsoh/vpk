"use client";

import { useId, type Ref } from "react";

import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
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

function bannerLabel(review: SuggestionReview): string {
	const pending = review.pending.length;
	if (pending > 0) return `${pending} ${pending === 1 ? "Suggestion" : "Suggestions"}`;
	const applied = review.accepted.length;
	return applied === 0 ? "Suggestions dismissed" : `${applied} ${applied === 1 ? "field" : "fields"} updated`;
}

export interface LedgerBannerProps {
	review: SuggestionReview;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	triggerRef: Ref<HTMLButtonElement>;
}

/** The "N Suggestions" banner above Details. The whole banner toggles the ledger, which opens to its left. */
export function LedgerBanner({ review, open, panelId, onToggle, triggerRef }: Readonly<LedgerBannerProps>) {
	const labelId = useId();
	return (
		<div
			className={cn(
				"relative flex w-full shrink-0 items-center gap-3 overflow-hidden rounded-[calc(0.25*2.5rem+0.375rem+1px)] border bg-surface-sunken p-1.5 pr-2 text-left transition-[background-color,border-color] duration-xxshort ease-out-practical has-[button:hover]:bg-surface-raised-hovered has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50",
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
				<TWGLoader active={false} label="Teamwork Graph" size="small" />
			</Tile>
			<span aria-live="polite" className="relative z-10 min-w-0 flex-1 text-sm text-text" id={labelId}>{bannerLabel(review)}</span>
			<TwgToolSourceStack className="relative z-10 shrink-0" sources={SUGGESTION_SOURCES} />
		</div>
	);
}
