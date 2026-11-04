"use client";

import { useEffect, useEffectEvent, useRef, type Ref } from "react";
import { motion } from "motion/react";
import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { QUIET_BUTTON } from "./card-parts";
import type { HoldReason } from "./use-stack-peek";

export interface DeckReceiptProps {
	suggestion: WorkItemSuggestion;
	decision: Exclude<SuggestionDecision, "pending">;
	/** The decision came from the keyboard: land focus on Undo so it is one key away. */
	focusUndo: boolean;
	hasNext: boolean;
	onUndo: () => void;
	onNext: () => void;
	onLater: () => void;
	onHold: (reason: HoldReason, active: boolean) => void;
	/** Focus landed; the parent clears its request so later receipts do not take focus by themselves. */
	onFocused: () => void;
	ref?: Ref<HTMLDivElement>;
}

/**
 * Once a popped card is decided it flies back to the stack and leaves this slip in the pocket, above the pill and
 * clear of the main column, so the value it just filled stays in view. It offers Undo and the next card, holds while
 * engaged, and clears on its own a moment later.
 */
export function DeckReceipt({ suggestion, decision, focusUndo, hasNext, onUndo, onNext, onLater, onHold, onFocused, ref }: Readonly<DeckReceiptProps>) {
	const undoRef = useRef<HTMLButtonElement>(null);
	const focused = useEffectEvent(onFocused);
	useEffect(() => {
		if (!focusUndo) return;
		undoRef.current?.focus();
		focused();
	}, [focusUndo]);
	const accepted = decision === "accepted";
	return (
		<motion.div
			animate={{ opacity: 1, y: 0, transition: { duration: motionDuration.medium, ease: motionEase.outPractical, delay: motionDuration.fast } }}
			aria-label={`${suggestion.label} ${accepted ? "accepted" : "dismissed"}`}
			className="absolute top-1.5 left-0 z-20 flex h-8 items-center gap-1 rounded-lg bg-surface-overlay pr-1 pl-2.5 whitespace-nowrap"
			exit={{ opacity: 0, y: 6, transition: { duration: motionDuration.fast, ease: motionEase.in } }}
			initial={{ opacity: 0, y: 10 }}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHold("focus", false);
			}}
			onFocus={() => onHold("focus", true)}
			onKeyDown={(event) => {
				if (event.key === "Escape") onLater();
			}}
			onPointerEnter={() => onHold("pointer", true)}
			onPointerLeave={() => onHold("pointer", false)}
			ref={ref}
			role="group"
			style={{ boxShadow: token("elevation.shadow.raised"), willChange: "transform, opacity" }}
		>
			<span className={cn("flex size-4 shrink-0 items-center justify-center", accepted ? "text-icon-success" : "text-icon-subtlest")}>
				{accepted ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <CrossIcon color="currentColor" label="" size="small" />}
			</span>
			<span className="pr-1 text-xs text-text-subtle">
				<span className="text-text">{suggestion.label}</span> {accepted ? "accepted" : "dismissed"}
			</span>
			<span aria-hidden="true" className="h-3.5 w-px bg-border" />
			<button aria-label={`Undo ${suggestion.label} ${accepted ? "accept" : "dismiss"}`} className={QUIET_BUTTON} onClick={onUndo} ref={undoRef} type="button">Undo</button>
			{hasNext ? (
				<button className={QUIET_BUTTON} onClick={onNext} type="button">
					Next
					<ArrowRightIcon color="currentColor" label="" size="small" />
				</button>
			) : null}
		</motion.div>
	);
}
