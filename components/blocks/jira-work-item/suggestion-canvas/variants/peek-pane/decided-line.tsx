"use client";

import type { MouseEvent } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { cn } from "@/lib/utils";

export type Decided = Exclude<SuggestionDecision, "pending">;

/**
 * Where an accepted value lands. Details rows sit beside the popover, so "Added" is enough; the description lands in
 * the main column underneath the popover, so the status names it.
 */
function addedLabel(id: SuggestionFieldId): string {
	return id === "description" ? "Added to description" : "Added";
}

/** The status word, in its own tone: green with a check for added, the quietest grey for dismissed. */
function DecidedStatus({ id, decision }: Readonly<{ id: SuggestionFieldId; decision: Decided }>) {
	return decision === "accepted" ? (
		<span className="inline-flex items-center gap-0.5 text-xs leading-4 text-text-success">
			<CheckMarkIcon color="currentColor" label="" size="small" />
			{addedLabel(id)}
		</span>
	) : (
		<span className="text-xs leading-4 text-text-subtlest">Dismissed</span>
	);
}

export interface DecidedLineProps {
	id: SuggestionFieldId;
	label: string;
	decision: Decided;
	/** Part of the latest decision: its Undo sits a step brighter than older ones. Every row keeps Undo on screen. */
	recent: boolean;
	/** `keyboard` is true when Undo was pressed from a key, so focus only moves for keyboard users. */
	onUndo: (keyboard: boolean) => void;
}

/**
 * A decided suggestion folded to one line, set in three columns: the field label on the left in the body tone, the
 * status in its own tone, then Undo flush with the action column. Every row has the same Undo, so every status shares
 * one right edge.
 */
export function DecidedLine({ id, label, decision, recent, onUndo }: Readonly<DecidedLineProps>) {
	return (
		<div className="flex min-h-6 items-center gap-2">
			<span className="min-w-0 flex-1 text-xs leading-4 text-pretty text-text-subtle">{label}</span>
			<DecidedStatus decision={decision} id={id} />
			<button
				aria-label={`Undo ${label} ${decision === "accepted" ? "accept" : "dismiss"}`}
				className={cn(
					"-mr-1.5 inline-flex h-6 shrink-0 items-center rounded-md px-1.5 text-xs font-medium outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring",
					recent ? "text-text-subtle" : "text-text-subtlest",
				)}
				data-peek-focus="undo"
				onClick={(event: MouseEvent<HTMLButtonElement>) => onUndo(event.detail === 0)}
				type="button"
			>
				Undo
			</button>
		</div>
	);
}
