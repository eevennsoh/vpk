"use client";

import { useState, type ReactNode } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { ConfidenceMeter } from "./confidence-meter";
import { ProvenanceValue } from "./provenance-value";
import { SourceMark } from "./source-mark";
import { joinTitles, sourcesForSuggestion } from "./sources";
import { WhyCard } from "./why-card";

export type FocusTarget = "accept" | "undo";


/** Focuses an element once when it mounts as the intended landing spot after accept, dismiss, or undo. */
export const focusOnMount = (shouldFocus: boolean) => (element: HTMLElement | null) => {
	if (shouldFocus && element) element.focus({ preventScroll: true });
};

function RowAction({ label, onClick, children, autoFocusOnMount, variant = "ghost" }: Readonly<{ label: string; onClick: () => void; children: ReactNode; autoFocusOnMount?: boolean; variant?: "ghost" | "outline" }>) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={<Button aria-label={label} onClick={onClick} ref={focusOnMount(autoFocusOnMount === true)} size="icon-compact" type="button" variant={variant} />}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function WhyTrigger({ suggestion, onOpenChange }: Readonly<{ suggestion: WorkItemSuggestion; onOpenChange: (open: boolean) => void }>) {
	const [open, setOpen] = useState(false);
	const sources = sourcesForSuggestion(suggestion);
	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		onOpenChange(next);
	};
	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger
				className="group/why -mx-1 flex min-w-0 items-start gap-2 rounded-md px-1 py-0.5 text-left outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-border-focused aria-expanded:bg-bg-neutral-subtle-hovered"
				closeDelay={120}
				delay={280}
				openOnHover
			>
				<span aria-hidden="true" className="mt-px flex shrink-0 -space-x-1">
					{sources.map((source) => <span className="rounded-full ring-2 ring-surface" key={source.id}><SourceMark kind={source.kind} size="xxsmall" /></span>)}
				</span>
				<span className="min-w-0 text-xs/5 text-pretty text-text-subtle">
					<span className="font-medium text-text group-hover/why:underline group-hover/why:decoration-border-bold group-hover/why:underline-offset-2">Why?</span>
					{" "}From {joinTitles(sources.map((source) => source.title))}
				</span>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[22rem] p-3.5" side="bottom" sideOffset={6}>
				<WhyCard suggestion={suggestion} />
			</PopoverContent>
		</Popover>
	);
}

interface PendingRowProps {
	onWhyOpenChange: (open: boolean) => void;
	suggestion: WorkItemSuggestion;
	lit: boolean;
	dimmed: boolean;
	focusTarget: FocusTarget | null;
	onAccept: () => void;
	onDismiss: () => void;
}

export function PendingSuggestionRow({ suggestion, lit, dimmed, focusTarget, onAccept, onDismiss, onWhyOpenChange }: Readonly<PendingRowProps>) {
	return (
		<li
			aria-label={`${suggestion.label} suggestion`}
			className={cn(
				"relative flex flex-col gap-2 rounded-lg border px-3 pt-2 pb-2.5 transition-[border-color,opacity] duration-normal ease-out-practical",
				lit ? "border-border-selected bg-surface" : "border-border bg-surface",
				dimmed ? "opacity-50" : "opacity-100",
			)}
			data-prov-row={suggestion.id}
		>
			<div className="flex min-h-7 items-center gap-2">
				<h3 className="text-xs font-semibold text-text-subtle">{suggestion.label}</h3>
				<ConfidenceMeter confidence={suggestion.confidence} />
				<div className="ml-auto flex items-center gap-0.5">
					<RowAction label={`Dismiss ${suggestion.label.toLowerCase()} suggestion`} onClick={onDismiss}>
						<CrossIcon color="currentColor" label="" size="small" />
					</RowAction>
					<RowAction autoFocusOnMount={focusTarget === "accept"} label={`Accept ${suggestion.label.toLowerCase()} suggestion`} onClick={onAccept} variant="outline">
						<CheckMarkIcon color="currentColor" label="" size="small" />
					</RowAction>
				</div>
			</div>
			<ProvenanceValue value={suggestion.value} />
			<WhyTrigger onOpenChange={onWhyOpenChange} suggestion={suggestion} />
		</li>
	);
}
