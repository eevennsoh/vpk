"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { CardReason } from "./card-reason";
import { CardValue } from "./card-value";

export const QUIET_BUTTON = "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text active:bg-bg-neutral-subtle-pressed focus-visible:ring-2 focus-visible:ring-ring";
export const ICON_BUTTON = "flex size-7 items-center justify-center rounded-md text-icon-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed focus-visible:ring-2 focus-visible:ring-ring";
const PAIR_BUTTON = "flex size-7 items-center justify-center rounded-md outline-none transition-colors duration-xxshort ease-out-practical focus-visible:ring-2 focus-visible:ring-ring";

/** The Jira Triage Agent's hexagon avatar, used wherever a card says who suggested it. */
export function AgentMark() {
	return (
		<Avatar animate={false} shape="hexagon" size="xs">
			<span className="flex size-full items-center justify-center bg-blue-700">
				<Image alt="" className="size-2.5!" height={10} src="/1p/agent-lanyard/glyph-jira-triage.svg" width={10} />
			</span>
		</Avatar>
	);
}

export function NewMark() {
	return (
		<span className="inline-flex items-center gap-1 text-xs font-medium text-text-brand">
			<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-brand" />
			New
		</span>
	);
}

/**
 * Compact ✕|✓ pair. Accept is the primary action, so it carries the success colour at rest; with `emphasis` (the
 * popped card) it also sits on a soft success tint, while Dismiss stays quiet.
 */
export function DecisionPair({ label, emphasis = false, onAccept, onDismiss }: Readonly<{ label: string; emphasis?: boolean; onAccept: () => void; onDismiss: () => void }>) {
	return (
		<div aria-label={`${label} decision`} className="-my-1 -mr-1.5 flex shrink-0 items-center gap-px" role="group">
			<Tooltip>
				<TooltipTrigger render={<button aria-label={`Dismiss ${label} suggestion`} className={cn(PAIR_BUTTON, "text-icon-subtlest hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed")} onClick={onDismiss} type="button" />}>
					<CrossIcon color="currentColor" label="" size="small" />
				</TooltipTrigger>
				<TooltipContent>Dismiss</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger render={<button aria-label={`Accept ${label} suggestion`} className={cn(PAIR_BUTTON, "text-icon-success hover:bg-bg-success-subtler active:bg-bg-success-subtler-hovered", emphasis ? "bg-bg-success-subtler/60" : null)} onClick={onAccept} type="button" />}>
					<CheckMarkIcon color="currentColor" label="" size="small" />
				</TooltipTrigger>
				<TooltipContent>Accept</TooltipContent>
			</Tooltip>
		</div>
	);
}

export function DecidedStatus({ decision }: Readonly<{ decision: Exclude<SuggestionDecision, "pending"> }>) {
	return decision === "accepted" ? (
		<span className="inline-flex items-center gap-1 text-xs text-text-success">
			<CheckMarkIcon color="currentColor" label="" size="small" />
			Accepted
		</span>
	) : (
		<span className="text-xs text-text-subtlest">Dismissed</span>
	);
}

/**
 * Moves focus to the decided state's Undo once the decision that removed the focused button lands,
 * so keyboard users are never dropped onto the document body.
 */
export function useUndoFocus(decision: SuggestionDecision) {
	const undoRef = useRef<HTMLButtonElement>(null);
	const pendingFocus = useRef(false);
	useEffect(() => {
		if (decision !== "pending" && pendingFocus.current) undoRef.current?.focus();
		pendingFocus.current = false;
	}, [decision]);
	const markDeciding = () => {
		pendingFocus.current = true;
	};
	return { undoRef, markDeciding };
}

export interface SuggestionCardBodyProps {
	suggestion: WorkItemSuggestion;
	/** "card" shows the source chips on the card; "row" keeps the list to one quiet reason line. */
	layout: "card" | "row";
	whyAnchor: RefObject<HTMLElement | null>;
	whyMaxHeight?: number;
	/** Lets a popped card hold its auto-tuck timer while the reasoning is being read. */
	onWhyOpenChange?: (open: boolean) => void;
}

/** Value then reason: the part every card shares, popped or listed. */
export function SuggestionCardBody({ suggestion, layout, whyAnchor, whyMaxHeight, onWhyOpenChange }: Readonly<SuggestionCardBodyProps>) {
	const [whyOpen, setWhyOpenState] = useState(false);
	const setWhyOpen = (open: boolean) => {
		setWhyOpenState(open);
		onWhyOpenChange?.(open);
	};
	return (
		<>
			<CardValue value={suggestion.value} />
			<CardReason anchor={whyAnchor} layout={layout} maxHeight={whyMaxHeight} onOpenChange={setWhyOpen} open={whyOpen} suggestion={suggestion} />
		</>
	);
}
