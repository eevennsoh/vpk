"use client";

import type { ReactNode } from "react";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { cn } from "@/lib/utils";

import { CardValue } from "./card-value";

/**
 * Shared paper for cards and sheets. The stack uses overlay elevation; list rows override it with raised elevation.
 * Shadows remain classes because Motion cannot scale-correct a var() shadow. The inline radius stays undistorted
 * during the size morph; the dark surface and hairline keep overlapping sheets distinct.
 */
export const CARD_PAPER = "bg-surface shadow-2xl dark:bg-surface-overlay-hovered dark:ring-1 dark:ring-border";
export const CARD_PAPER_STYLE = { borderRadius: 8 } as const;
export const CARD_ACTION_REVEAL = "opacity-0 group-hover/suggestion-card:opacity-100 group-has-[:focus-visible]/suggestion-card:opacity-100 [@media(hover:none)]:opacity-100";

export interface CardFaceProps {
	suggestion: WorkItemSuggestion;
	/** The label slot. Defaults to the field label; the top card swaps in its swipe hints here. */
	label?: ReactNode;
	/** Controls at the end of the label row (the list card's lightbulb, ✕ and ✓). */
	actions?: ReactNode;
	/** A row under the value (the top card's Why line). */
	footer?: ReactNode;
	className?: string;
}

/** A card's content: the field label, then the full value, never cut short. */
export function CardFace({ suggestion, label, actions, footer, className }: Readonly<CardFaceProps>) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<div className="flex min-h-6 items-center gap-2 text-xs font-medium">
				<span className="grid min-w-0 items-center">{label ?? <span className="text-text-subtle">{suggestion.label}</span>}</span>
				{actions ? <span className={cn("-my-1 -mr-1.5 ml-auto flex shrink-0 items-center gap-0.5 has-[[data-popup-open]]:opacity-100", CARD_ACTION_REVEAL)}>{actions}</span> : null}
			</div>
			<CardValue value={suggestion.value} />
			{footer}
		</div>
	);
}
