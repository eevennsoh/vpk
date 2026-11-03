"use client";

import type { ReactNode } from "react";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { cn } from "@/lib/utils";

import { CardValue } from "./card-value";

/**
 * One paper for every card and sheet, identical in every role and every frame, so the morph between stack and list
 * never changes material. Dark theme steps up one surface from the popover and adds a hairline edge, since the
 * overlay shadow barely registers on a dark popover and the fanned sheets would otherwise read as one card. The shadow is the overlay elevation (`shadow-2xl` maps to
 * --ds-shadow-overlay) as a class: Motion cannot scale-correct a var() shadow and would drop it mid-morph. The radius
 * is an inline style so Motion keeps it undistorted while a card's size morphs.
 */
export const CARD_PAPER = "bg-surface shadow-2xl dark:bg-surface-overlay-hovered dark:ring-1 dark:ring-border";
export const CARD_PAPER_STYLE = { borderRadius: 8 } as const;

/** A quiet discovery mark for a suggestion the latest re-run found. */
export function NewTag() {
	return (
		<span className="inline-flex h-4 shrink-0 items-center gap-1 rounded-sm bg-bg-discovery px-1 text-xs leading-4 font-semibold text-text-discovery">
			<span aria-hidden="true" className="size-1 rounded-full bg-icon-discovery" />
			New
		</span>
	);
}

export interface CardFaceProps {
	suggestion: WorkItemSuggestion;
	/** Found by the latest re-run and not yet seen. */
	isNew: boolean;
	/** The label slot. Defaults to the field label; the top card swaps in its swipe hints here. */
	label?: ReactNode;
	/** Controls at the end of the label row (the list card's lightbulb, ✕ and ✓). */
	actions?: ReactNode;
	/** A row under the value (the top card's Why line). */
	footer?: ReactNode;
	className?: string;
}

/** A card's content: the field label (with a New mark for fresh finds), then the full value, never cut short. */
export function CardFace({ suggestion, isNew, label, actions, footer, className }: Readonly<CardFaceProps>) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<div className="flex min-h-6 items-center gap-2 text-xs font-medium">
				<span className="grid min-w-0 items-center">{label ?? <span className="text-text-subtle">{suggestion.label}</span>}</span>
				{isNew ? <NewTag /> : null}
				{actions ? <span className="-my-1 -mr-1.5 ml-auto flex shrink-0 items-center gap-0.5">{actions}</span> : null}
			</div>
			<CardValue value={suggestion.value} />
			{footer}
		</div>
	);
}
