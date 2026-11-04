"use client";

import { useId, useRef, type MouseEvent, type RefObject } from "react";
import { motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { LedgerValue } from "../ledger-popover/ledger-value";
import { Receipt } from "./receipt";
import type { ViewportRect } from "./use-overlay-placement";
import { WhyPopover } from "./why-popover";

const GROW = { duration: motionDuration.medium, ease: motionEase.inOut };
const SHRINK = { duration: motionDuration.normal, ease: motionEase.in };
/** A new row holds its arrival tint for a beat, then lets it go. One property: opacity. */
const ARRIVAL = { duration: motionDuration.slowest, ease: motionEase.in, delay: motionDuration.slower };
/**
 * Rows fold open and shut in place: a decided suggestion folds out of the pending group while its receipt folds in
 * below, so the list's height eases between the two and nothing jumps. Two properties: height and opacity.
 */
const FOLD = {
	animate: { height: "auto", opacity: 1 },
	exit: { height: 0, opacity: 0, transition: SHRINK },
	initial: { height: 0, opacity: 0 },
	transition: GROW,
} as const;
/**
 * Rows clip at rest, so an interrupted fold can never spill. The row's 6px inset lives inside the clip,
 * which gives every control (pulled out by 4px) room for its 2px focus ring and hover tint.
 */
const ROW_CLASS = "group/row relative mr-3.5 ml-9 overflow-hidden rounded-lg";

/** Quiet icon buttons that wake up when their row is hovered or holds focus. */
const DECISION_BUTTON = "flex size-7 items-center justify-center rounded-md text-icon-subtlest outline-none transition-colors duration-xxshort ease-out-practical group-hover/row:text-icon-subtle group-focus-within/row:text-icon-subtle pointer-coarse:text-icon-subtle focus-visible:ring-2 focus-visible:ring-ring";
/**
 * ✕ and ✓ name themselves only after a deliberate rest. When a decided row folds away, the next row's ✓ slides
 * under a still pointer; an instant "Accept" label there would read as an action about to fire.
 */
const HINT_DELAY_MS = motionDuration.slowest * 1000;

type DecisionHandler = (event: MouseEvent<HTMLButtonElement>) => void;

function DecisionPair({ label, onAccept, onDismiss }: Readonly<{ label: string; onAccept: DecisionHandler; onDismiss: DecisionHandler }>) {
	return (
		<div aria-label={`${label} decision`} className="-my-0.5 -mr-1 flex shrink-0 items-center gap-px" role="group">
			<Tooltip>
				<TooltipTrigger delay={HINT_DELAY_MS} render={<button aria-label={`Dismiss ${label} suggestion`} className={cn(DECISION_BUTTON, "hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed")} onClick={onDismiss} type="button" />}>
					<CrossIcon color="currentColor" label="" size="small" />
				</TooltipTrigger>
				<TooltipContent>Dismiss</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger delay={HINT_DELAY_MS} render={<button aria-label={`Accept ${label} suggestion`} className={cn(DECISION_BUTTON, "hover:bg-bg-success-subtler hover:text-icon-success active:bg-bg-success-subtler-hovered")} data-accept="" onClick={onAccept} type="button" />}>
					<CheckMarkIcon color="currentColor" label="" size="small" />
				</TooltipTrigger>
				<TooltipContent>Accept</TooltipContent>
			</Tooltip>
		</div>
	);
}

/** "New" sits beside the label, inside the content column, so the thread on the left only ever marks runs. */
function NewMark({ id }: Readonly<{ id: string }>) {
	return (
		<span className="inline-flex items-center gap-1 text-xs leading-4 font-medium text-text-information" id={id}>
			<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-information" />
			New
		</span>
	);
}

export interface PendingRowProps {
	suggestion: WorkItemSuggestion;
	isNew: boolean;
	whyOpen: boolean;
	onWhyOpenChange: (open: boolean) => void;
	panelRef: RefObject<HTMLElement | null>;
	getWhyBoundary: () => ViewportRect | undefined;
	onAccept: DecisionHandler;
	onDismiss: DecisionHandler;
}

/**
 * A suggestion still waiting on you: label, the full value, Why and the ✕|✓ pair.
 * It is named by its label and value together, so browsing the list by item says what is being suggested.
 */
export function PendingRow({ suggestion, isNew, whyOpen, onWhyOpenChange, panelRef, getWhyBoundary, onAccept, onDismiss }: Readonly<PendingRowProps>) {
	const rowRef = useRef<HTMLLIElement>(null);
	const labelId = useId();
	const newId = useId();
	const valueId = useId();
	return (
		<motion.li
			{...FOLD}
			aria-labelledby={isNew ? `${newId} ${labelId} ${valueId}` : `${labelId} ${valueId}`}
			className={cn(
				ROW_CLASS,
				"transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered",
				whyOpen ? "bg-bg-neutral-subtle-hovered" : null,
			)}
			data-block="pending"
			data-field={suggestion.id}
			ref={rowRef}
		>
			{isNew ? <motion.span animate={{ opacity: 0 }} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-bg-information-subtler" initial={{ opacity: 1 }} transition={ARRIVAL} /> : null}
			<div className="relative px-1.5 pt-2 pb-3">
				<div className="flex min-h-6 items-center gap-1">
					<span className="flex min-w-0 flex-1 items-center gap-2">
						<span className="text-xs text-text-subtle" id={labelId}>{suggestion.label}</span>
						{isNew ? <NewMark id={newId} /> : null}
					</span>
					<WhyPopover getBoundary={getWhyBoundary} onOpenChange={onWhyOpenChange} open={whyOpen} panelRef={panelRef} rowRef={rowRef} suggestion={suggestion} />
					<DecisionPair label={suggestion.label} onAccept={onAccept} onDismiss={onDismiss} />
				</div>
				<div className="pt-1" id={valueId}><LedgerValue value={suggestion.value} /></div>
			</div>
		</motion.li>
	);
}

export interface ReceiptRowProps {
	suggestion: WorkItemSuggestion;
	decision: Exclude<SuggestionDecision, "pending">;
	isLatest: boolean;
	onUndo: DecisionHandler;
}

/** A decided suggestion, collected under the run's pending work as one line of history. */
export function ReceiptRow({ suggestion, decision, isLatest, onUndo }: Readonly<ReceiptRowProps>) {
	return (
		<motion.li {...FOLD} className={ROW_CLASS} data-block="receipt" data-field={suggestion.id}>
			<div className="px-1.5">
				<Receipt decision={decision} isLatest={isLatest} onUndo={onUndo} suggestion={suggestion} />
			</div>
		</motion.li>
	);
}
