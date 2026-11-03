"use client";

import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";

import { SUGGESTION_WORK_ITEM, type WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { AgentMark, DecisionPair, NewMark, QUIET_BUTTON, SuggestionCardBody } from "./card-parts";
import { WHY_POPUP_ATTR } from "./card-reason";
import type { HoldReason } from "./use-stack-peek";

export const POPPED_CARD_WIDTH = 336;
/** How far a drag must travel before letting go decides the card. */
const DRAG_DECIDE_PX = 110;

export interface PoppedCardProps {
	suggestion: WorkItemSuggestion;
	isNew: boolean;
	/** How many suggestions are waiting, including this one. */
	pendingCount: number;
	maxHeight?: number;
	/** Came back via Undo from the keyboard: take focus so the decision pair is one Tab away. */
	focusOnMount: boolean;
	onFocused: () => void;
	/** Presses outside the work item frame (canvas chrome, theme picker) leave the card alone. */
	isInFrame: (target: Element) => boolean;
	onAccept: () => void;
	onDismiss: () => void;
	/** Settle the card back into the stack (Escape or a press outside). */
	onLater: () => void;
	onSeeAll: () => void;
	onHold: (reason: HoldReason, active: boolean) => void;
}

/** Hover, focus, Escape and presses outside: the card holds while engaged and settles back when let go. */
function useCardPresence(cardRef: RefObject<HTMLElement | null>, onHold: PoppedCardProps["onHold"], onLater: () => void, isInFrame: (target: Element) => boolean) {
	const onCardEvent = useEffectEvent((event: Event) => {
		const card = cardRef.current;
		if (!card) return;
		switch (event.type) {
			case "pointerenter":
				onHold("pointer", true);
				break;
			case "pointerleave":
				onHold("pointer", false);
				break;
			case "focusin":
				onHold("focus", true);
				break;
			case "focusout":
				if (!card.contains((event as FocusEvent).relatedTarget as Node | null)) onHold("focus", false);
				break;
			case "keydown":
				if ((event as KeyboardEvent).key === "Escape" && !event.defaultPrevented) onLater();
				break;
			default:
				break;
		}
	});
	const onOutsidePress = useEffectEvent((event: PointerEvent) => {
		const target = event.target instanceof Element ? event.target : null;
		if (!target || cardRef.current?.contains(target) || !isInFrame(target)) return;
		if (target.closest(`[${WHY_POPUP_ATTR}], [data-slot=tooltip-content]`)) return;
		onLater();
	});
	useEffect(() => {
		const card = cardRef.current;
		if (!card) return undefined;
		const types = ["pointerenter", "pointerleave", "focusin", "focusout", "keydown"] as const;
		const listener = (event: Event) => onCardEvent(event);
		const outside = (event: PointerEvent) => onOutsidePress(event);
		for (const type of types) card.addEventListener(type, listener);
		document.addEventListener("pointerdown", outside, true);
		return () => {
			for (const type of types) card.removeEventListener(type, listener);
			document.removeEventListener("pointerdown", outside, true);
		};
	}, [cardRef]);
}

/**
 * The card the stack lifts out for review: who suggested it, the field, its full value, the reason with its sources,
 * and a ✕|✓ pair. Drag it right to accept or left to dismiss. It floats over the work item without taking focus.
 */
export function PoppedCard({ suggestion, isNew, pendingCount, maxHeight, focusOnMount, onFocused, isInFrame, onAccept, onDismiss, onLater, onSeeAll, onHold }: Readonly<PoppedCardProps>) {
	const cardRef = useRef<HTMLElement>(null);
	useCardPresence(cardRef, onHold, onLater, isInFrame);
	const focused = useEffectEvent(onFocused);
	useEffect(() => {
		if (!focusOnMount) return;
		cardRef.current?.focus();
		focused();
	}, [focusOnMount]);

	const dragX = useMotionValue(0);
	const rotate = useTransform(dragX, [-240, 240], [-5, 5]);
	const acceptTint = useTransform(dragX, [0, DRAG_DECIDE_PX], [0, 0.7]);
	const dismissTint = useTransform(dragX, [-DRAG_DECIDE_PX, 0], [0.7, 0]);
	const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
		if (info.offset.x > DRAG_DECIDE_PX) onAccept();
		else if (info.offset.x < -DRAG_DECIDE_PX) onDismiss();
	};

	return (
		<motion.section
			aria-label={`Suggestion for ${suggestion.label} from ${SUGGESTION_WORK_ITEM.agent.name}`}
			className="relative flex cursor-grab flex-col rounded-xl bg-surface-overlay outline-none active:cursor-grabbing"
			drag="x"
			dragElastic={0.5}
			dragSnapToOrigin
			onDragEnd={onDragEnd}
			ref={cardRef}
			tabIndex={-1}
			style={{ width: POPPED_CARD_WIDTH, maxHeight, boxShadow: token("elevation.shadow.overlay"), x: dragX, rotate, willChange: "transform" }}
		>
			<motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl bg-bg-success-subtler" style={{ opacity: acceptTint }} />
			<motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl bg-bg-neutral" style={{ opacity: dismissTint }} />
			<div className="relative flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pt-3 pb-1">
				<p className="flex min-h-5 items-center gap-1.5 text-xs text-text-subtlest">
					<AgentMark />
					<span className="text-text-subtle">{SUGGESTION_WORK_ITEM.agent.name}</span>
					<span>suggests</span>
					<span className="flex-1" />
					{isNew ? <NewMark /> : null}
				</p>
				<h3 className="text-text" style={{ font: token("font.heading.xsmall") }}>{suggestion.label}</h3>
				<div className="flex flex-col items-start gap-2.5">
					<SuggestionCardBody layout="card" onWhyOpenChange={(open) => onHold("why", open)} suggestion={suggestion} whyAnchor={cardRef} whyMaxHeight={maxHeight} />
				</div>
			</div>
			<footer className="relative flex items-center gap-2 px-4 pt-1.5 pb-3">
				<button className={cn(QUIET_BUTTON, "-ml-1.5 text-text-subtlest")} onClick={onSeeAll} type="button">
					{pendingCount > 1 ? `See all ${pendingCount}` : "Open suggestions"}
				</button>
				<span className="flex-1" />
				<DecisionPair emphasis label={suggestion.label} onAccept={onAccept} onDismiss={onDismiss} />
			</footer>
		</motion.section>
	);
}
