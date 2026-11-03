"use client";

import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import UndoIcon from "@atlaskit/icon/core/undo";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { LedgerValue } from "./ledger-value";
import { WhyCardBody } from "./why-card";

export interface LedgerRowProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	whyOpen: boolean;
	onWhyOpenChange: (open: boolean) => void;
	/** The ledger surface: every why card opens beside it, top-aligned, so the cards never jump between rows. */
	whyAnchor: RefObject<HTMLElement | null>;
	whyMaxHeight?: number;
	onAccept: () => void;
	onDismiss: () => void;
	onUndo: () => void;
}

const COLLAPSE = { duration: motionDuration.medium, ease: motionEase.inOut };

function DecisionPair({ label, onAccept, onDismiss }: Readonly<{ label: string; onAccept: () => void; onDismiss: () => void }>) {
	return (
		<div className="flex shrink-0 items-center rounded-md border border-border bg-surface p-px" role="group" aria-label={`${label} decision`}>
			<Tooltip>
				<TooltipTrigger render={<Button aria-label={`Dismiss ${label} suggestion`} className="rounded-[5px]! hover:[&_svg]:text-icon" onClick={onDismiss} size="icon-compact" type="button" variant="ghost" />}>
					<CrossIcon color="currentColor" label="" size="small" />
				</TooltipTrigger>
				<TooltipContent>Dismiss</TooltipContent>
			</Tooltip>
			<span aria-hidden="true" className="mx-px h-3.5 w-px bg-border" />
			<Tooltip>
				<TooltipTrigger render={<Button aria-label={`Accept ${label} suggestion`} className="rounded-[5px]! hover:bg-bg-success-subtler hover:[&_svg]:text-icon-success active:bg-bg-success-subtler" onClick={onAccept} size="icon-compact" type="button" variant="ghost" />}>
					<CheckMarkIcon color="currentColor" label="" size="small" />
				</TooltipTrigger>
				<TooltipContent>Accept</TooltipContent>
			</Tooltip>
		</div>
	);
}

function WhyTrigger({ suggestion, open, onOpenChange, anchor, maxHeight }: Readonly<{ suggestion: WorkItemSuggestion; open: boolean; onOpenChange: (open: boolean) => void; anchor: RefObject<HTMLElement | null>; maxHeight?: number }>) {
	return (
		<Popover onOpenChange={onOpenChange} open={open}>
			<PopoverTrigger
				aria-label={`Why ${suggestion.label} was suggested`}
				className={cn(
					"inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-text-subtlest outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring group-hover/row:text-text-subtle data-popup-open:bg-bg-selected data-popup-open:text-text-selected",
				)}
				closeDelay={120}
				delay={220}
				openOnHover
				type="button"
			>
				<LightbulbIcon color="currentColor" label="" size="small" />
				Why
			</PopoverTrigger>
			<PopoverContent
				align="start"
				anchor={anchor}
				className="flex max-h-(--available-height) w-[344px] flex-col gap-0 overflow-hidden p-0"
				side="right"
				sideOffset={8}
				style={maxHeight ? { maxHeight } : undefined}
			>
				<WhyCardBody suggestion={suggestion} />
			</PopoverContent>
		</Popover>
	);
}

function DecidedStatus({ decision }: Readonly<{ decision: Exclude<SuggestionDecision, "pending"> }>) {
	return decision === "accepted" ? (
		<span className="inline-flex items-center gap-1 text-xs font-medium text-text-success">
			<CheckMarkIcon color="currentColor" label="" size="small" />
			Accepted
		</span>
	) : (
		<span className="inline-flex items-center gap-1 text-xs text-text-subtlest">
			<CrossIcon color="currentColor" label="" size="small" />
			Dismissed
		</span>
	);
}

export function LedgerRow({ suggestion, decision, whyOpen, onWhyOpenChange, whyAnchor, whyMaxHeight, onAccept, onDismiss, onUndo }: Readonly<LedgerRowProps>) {
	const pending = decision === "pending";
	return (
		<li
			aria-label={`${suggestion.label}: ${suggestion.valueText}`}
			className={cn(
				"group/row relative px-3 first:rounded-t-[7px] last:rounded-b-[7px] transition-colors duration-xxshort ease-out-practical",
				pending ? "py-2.5 hover:bg-bg-neutral-subtle-hovered" : "py-1.5",
				whyOpen ? "bg-bg-neutral-subtle-hovered" : null,
			)}
			data-decision={decision}
		>
			<div className="flex min-h-7 items-center gap-2">
				<span className={cn("text-xs font-medium", pending ? "text-text-subtle" : "text-text-subtlest")}>{suggestion.label}</span>
				{pending ? null : <DecidedStatus decision={decision} />}
				<span className="flex-1" />
				{pending ? (
					<>
						<WhyTrigger anchor={whyAnchor} maxHeight={whyMaxHeight} onOpenChange={onWhyOpenChange} open={whyOpen} suggestion={suggestion} />
						<DecisionPair label={suggestion.label} onAccept={onAccept} onDismiss={onDismiss} />
					</>
				) : (
					<Button aria-label={`Undo ${suggestion.label} ${decision === "accepted" ? "accept" : "dismiss"}`} onClick={onUndo} size="compact" type="button" variant="ghost" className="px-2">
						<UndoIcon color="currentColor" label="" size="small" />
						Undo
					</Button>
				)}
			</div>
			<AnimatePresence initial={false}>
				{pending ? (
					<motion.div
						animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
						exit={{ height: 0, opacity: 0, overflow: "hidden", transition: { duration: motionDuration.normal, ease: motionEase.in } }}
						initial={{ height: 0, opacity: 0, overflow: "hidden" }}
						key="value"
						transition={COLLAPSE}
					>
						<div className="pt-1 pb-0.5"><LedgerValue value={suggestion.value} /></div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</li>
	);
}
