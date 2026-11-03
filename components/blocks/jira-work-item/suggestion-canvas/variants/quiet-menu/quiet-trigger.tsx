"use client";

import type { Ref } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { cn } from "@/lib/utils";

import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { RUNNING_COPY } from "./menu-chrome";

export interface QuietTriggerProps {
	feed: SuggestionFeed;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	triggerRef: Ref<HTMLButtonElement>;
}

/**
 * The live "N suggestions" trigger above Details. The count never leaves: a re-run only animates the
 * Teamwork Graph mark beside it, and new arrivals add a discovery tag. The chevron turns toward the open menu.
 */
export function QuietTrigger({ feed, open, panelId, onToggle, triggerRef }: Readonly<QuietTriggerProps>) {
	const pending = feed.review.pending.length;
	const running = feed.status === "running";
	const fresh = feed.newIds.size;
	const accepted = feed.review.accepted.length;
	const label = pending > 0 ? `${pending} ${pending === 1 ? "suggestion" : "suggestions"}` : "All caught up";

	return (
		<button
			aria-controls={open ? panelId : undefined}
			aria-expanded={open}
			aria-haspopup="dialog"
			className={cn(
				"group/trigger flex h-9 w-full shrink-0 items-center gap-2.5 rounded-lg pr-2 pl-3 text-left outline-none transition-colors duration-xxshort ease-out-practical focus-visible:ring-2 focus-visible:ring-ring",
				"bg-bg-neutral hover:bg-bg-neutral-hovered active:bg-bg-neutral-pressed",
			)}
			onClick={onToggle}
			ref={triggerRef}
			type="button"
		>
			<span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
				<TWGLoader active={running} label="Teamwork Graph" size="small" />
			</span>
			<span className="min-w-0 flex-1 text-sm leading-5 text-text tabular-nums">
				{label}
				{pending === 0 && accepted > 0 ? <span className="ml-1.5 text-text-subtlest"><span className="sr-only">, </span>{accepted} added</span> : null}
			</span>
			{fresh > 0 && !running ? (
				<span className="flex shrink-0 items-center gap-1.5 text-xs leading-4 font-medium text-text-discovery tabular-nums">
					<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-discovery" />
					{fresh} new
				</span>
			) : null}
			<span aria-hidden="true" className={cn("flex size-5 shrink-0 items-center justify-center text-icon-subtle transition-transform duration-normal ease-out-practical", open ? "rotate-90" : null)}>
				<ChevronDownIcon color="currentColor" label="" size="small" />
			</span>
			<span aria-live="polite" className="sr-only">{running && !open ? RUNNING_COPY : ""}</span>
		</button>
	);
}
