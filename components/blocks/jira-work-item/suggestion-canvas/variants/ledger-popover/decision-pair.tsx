"use client";

import { useRef, useState, type ReactNode } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { focusKey, isQuietlyFocused } from "./ledger-focus";

/** Quiet icon buttons that wake one step when their row is hovered or holds keyboard focus. */
const DECISION_BUTTON = "flex size-7 items-center justify-center rounded-md outline-none transition-colors duration-xxshort ease-out-practical focus-visible:ring-2 focus-visible:ring-ring";

interface DecisionButtonProps {
	label: string;
	tip: string;
	className: string;
	focusId: string;
	onClick: () => void;
	children: ReactNode;
}

/** An icon button whose tooltip answers real hover or keyboard focus, never a focus handoff after a decision. */
function DecisionButton({ label, tip, className, focusId, onClick, children }: Readonly<DecisionButtonProps>) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	return (
		<Tooltip
			onOpenChange={(next) => {
				if (next && isQuietlyFocused(buttonRef.current)) return;
				setOpen(next);
			}}
			open={open}
		>
			<TooltipTrigger render={<button aria-label={label} className={cn(DECISION_BUTTON, className)} data-focus-key={focusId} onClick={onClick} ref={buttonRef} type="button" />}>
				{children}
			</TooltipTrigger>
			<TooltipContent>{tip}</TooltipContent>
		</Tooltip>
	);
}

export interface DecisionPairProps {
	suggestion: WorkItemSuggestion;
	onAccept: () => void;
	onDismiss: () => void;
}

/** ✕ rests at the quietest step and ✓ one step stronger, so the primary action reads without hover. */
export function DecisionPair({ suggestion, onAccept, onDismiss }: Readonly<DecisionPairProps>) {
	const { label } = suggestion;
	return (
		<div aria-label={`${label} decision`} className="-my-0.5 -mr-1.5 flex shrink-0 items-center gap-px" role="group">
			<DecisionButton
				className="text-icon-subtlest group-hover/row:text-icon-subtle group-has-[:focus-visible]/row:text-icon-subtle hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed"
				focusId={focusKey.dismiss(suggestion.id)}
				label={`Dismiss ${label} suggestion`}
				onClick={onDismiss}
				tip="Dismiss"
			>
				<CrossIcon color="currentColor" label="" size="small" />
			</DecisionButton>
			<DecisionButton
				className="text-icon-subtle group-hover/row:text-icon group-has-[:focus-visible]/row:text-icon hover:bg-bg-success-subtler hover:text-icon-success active:bg-bg-success-subtler-hovered"
				focusId={focusKey.accept(suggestion.id)}
				label={`Accept ${label} suggestion`}
				onClick={onAccept}
				tip="Accept"
			>
				<CheckMarkIcon color="currentColor" label="" size="small" />
			</DecisionButton>
		</div>
	);
}
