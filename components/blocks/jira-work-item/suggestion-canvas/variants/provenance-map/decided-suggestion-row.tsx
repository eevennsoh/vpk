"use client";

import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { focusOnMount } from "./pending-suggestion-row";

interface DecidedRowProps {
	suggestion: WorkItemSuggestion;
	decision: "accepted" | "dismissed";
	autoFocus: boolean;
	onUndo: () => void;
}

/** A reviewed suggestion folds to one line: what happened and how to take it back. */
export function DecidedSuggestionRow({ suggestion, decision, autoFocus, onUndo }: Readonly<DecidedRowProps>) {
	const accepted = decision === "accepted";
	const destination = suggestion.id === "description" ? "Added to description" : "Added to Details";
	return (
		<li
			aria-label={`${suggestion.label} suggestion, ${accepted ? "accepted" : "dismissed"}`}
			className="flex min-h-10 items-center gap-2.5 rounded-lg bg-bg-neutral-subtle px-3 py-1.5 transition-opacity duration-normal ease-out-practical starting:opacity-0"
		>
			<span className={cn("shrink-0", accepted ? "text-icon-success" : "text-icon-subtlest")}>
				{accepted ? <CheckCircleIcon color="currentColor" label="" size="small" /> : <CrossCircleIcon color="currentColor" label="" size="small" />}
			</span>
			<span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
				<span className={cn("text-sm font-medium", accepted ? "text-text" : "text-text-subtlest line-through decoration-border-bold")}>{suggestion.label}</span>
				<span className="text-xs text-text-subtlest">{accepted ? destination : "Dismissed"}</span>
			</span>
			<Button
				aria-label={`Undo ${suggestion.label.toLowerCase()} ${accepted ? "accept" : "dismiss"}`}
				className="shrink-0"
				onClick={onUndo}
				ref={focusOnMount(autoFocus)}
				size="compact"
				type="button"
				variant="ghost"
			>
				<UndoIcon color="currentColor" label="" size="small" />
				Undo
			</Button>
		</li>
	);
}
