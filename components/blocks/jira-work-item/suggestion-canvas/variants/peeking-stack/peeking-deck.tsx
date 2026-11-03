"use client";

import type { Ref } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/**
 * Fanned like a hand of cards held in a pocket: the front card leans right, each card behind it sits further left
 * and turns further the other way, so three distinct card tops show above the pill.
 */
const SLOTS = [
	{ rotate: 5, x: 0, y: 0 },
	{ rotate: -4, x: -36, y: 0 },
	{ rotate: -11, x: -68, y: 2 },
] as const;
/** Deck card size. Cards are taller than the band they peek through, so their lower half stays in the pocket. */
export const DECK_CARD = { width: 88, height: 58 } as const;
/** The band reserved above the pill while the deck holds cards. */
export const DECK_BAND = 46;
/** How much of a deck card shows above the pill's top edge. */
const PEEK = 36;
/** The pill's height: the deck is clipped at its bottom edge. */
const PILL_HEIGHT = 36;
/** Far enough down that a card here is fully tucked behind the pill. */
const TUCKED_Y = DECK_CARD.height;

const SETTLE = { duration: motionDuration.slow, ease: motionEase.inOut };
const SLIDE_OUT = { duration: motionDuration.medium, ease: motionEase.in };
const BREATHE = { duration: motionDuration.slowest * 2, ease: motionEase.inOut, repeat: Infinity };

/** Value preview bars sized from the value, so each thumbnail reads as a different card. */
function previewBars(suggestion: WorkItemSuggestion): readonly number[] {
	switch (suggestion.value.kind) {
		case "paragraph":
			return [92, 84, 64];
		case "checklist":
			return [78, 70, 74];
		case "labels":
			return [36, 28, 42];
		case "person":
		case "date":
			return [58, 40];
		case "issue":
			return [86, 52];
		default: {
			const unreachable: never = suggestion.value;
			return unreachable;
		}
	}
}

/**
 * Light: a white card with a hairline and a raised shadow. Dark: the lighter overlay surface with a bolder hairline,
 * so the cards separate from the rail instead of sinking into it. The hairline is an outline because the shadow token
 * owns box-shadow.
 */
const CARD_SURFACE = "rounded-md bg-surface-overlay outline outline-1 -outline-offset-1 outline-border dark:outline-border-bold";

interface ThumbnailProps {
	suggestion: WorkItemSuggestion;
	front: boolean;
	isNew: boolean;
	badge: number | null;
}

/** Only the front card carries words; the cards behind it show a label bar and value bars, so nothing is clipped. */
function Thumbnail({ suggestion, front, isNew, badge }: Readonly<ThumbnailProps>) {
	return (
		<span
			className={cn(
				"relative flex size-full flex-col gap-1.5 px-2 pt-2 transition-transform duration-normal ease-out",
				"group-hover/trigger:-translate-y-1 group-focus-visible/trigger:-translate-y-1",
				CARD_SURFACE,
			)}
			style={{ boxShadow: token("elevation.shadow.raised") }}
		>
			{front ? (
				<span className="flex items-start gap-1 text-[10px] leading-3 font-medium text-pretty text-text-subtle">
					{isNew ? <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-icon-brand" /> : null}
					<span className="min-w-0">{suggestion.label}</span>
				</span>
			) : (
				<span className="flex h-3 items-center gap-1">
					{isNew ? <span className="size-1.5 shrink-0 rounded-full bg-icon-brand" /> : null}
					<span className="h-1 w-6 rounded-full bg-icon-subtlest/60" />
				</span>
			)}
			<span className="flex flex-col gap-[3px]">
				{previewBars(suggestion).map((width, index) => (
					<span className="h-[3px] rounded-full bg-bg-neutral-hovered" key={index} style={{ width: `${width}%` }} />
				))}
			</span>
			{badge != null ? (
				<span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">{badge}</span>
			) : null}
		</span>
	);
}

export interface PeekingDeckProps {
	/** Front first, excluding a popped card. At most three are shown; the rest close up behind them. */
	cards: readonly WorkItemSuggestion[];
	newIds: ReadonlySet<string>;
	running: boolean;
	/** Reduced motion: the stack never moves by itself, so the front card carries a static count instead. */
	staticCount: number | null;
	deckRef: Ref<HTMLSpanElement>;
}

/**
 * Decorative mini cards tucked behind the right end of the pill, peeking out over its top edge. New cards rise
 * out of the pocket into their slot; decided, popped or fanned-out cards slip back down into it, and the rest close
 * up. While the agent runs, the hand breathes. Hidden from assistive technology: the trigger's name carries the count.
 * Only the cards themselves take pointer events, so the hit area is the pill plus what is visibly there.
 */
export function PeekingDeck({ cards, newIds, running, staticCount, deckRef }: Readonly<PeekingDeckProps>) {
	const visible = cards.slice(0, SLOTS.length);
	return (
		<span
			aria-hidden="true"
			className="pointer-events-none absolute right-4 block"
			ref={deckRef}
			// Clipped at the pill's bottom edge: cards rising out of (or slipping into) the pocket never show below it.
			style={{ top: -PEEK, width: DECK_CARD.width, height: DECK_CARD.height, clipPath: `inset(-64px -128px ${DECK_CARD.height - PEEK - PILL_HEIGHT}px -128px)` }}
		>
			<AnimatePresence initial={false}>
				{visible.map((suggestion, slotIndex) => {
					const slot = SLOTS[slotIndex] ?? SLOTS[0];
					return (
						<motion.span
							animate={running
								? { x: slot.x, y: slot.y, rotate: [slot.rotate, slot.rotate + (slotIndex % 2 === 0 ? 3 : -3), slot.rotate], transition: { rotate: { ...BREATHE, delay: slotIndex * motionDuration.fast }, default: SETTLE } }
								: { x: slot.x, y: slot.y, rotate: slot.rotate, transition: SETTLE }}
							className="pointer-events-auto absolute inset-0 block origin-bottom"
							exit={{ y: TUCKED_Y, rotate: 0, transition: SLIDE_OUT }}
							initial={{ y: TUCKED_Y, x: slot.x, rotate: 0 }}
							key={suggestion.id}
							style={{ zIndex: SLOTS.length - slotIndex, willChange: "transform" }}
						>
							<Thumbnail badge={slotIndex === 0 ? staticCount : null} front={slotIndex === 0} isNew={newIds.has(suggestion.id)} suggestion={suggestion} />
						</motion.span>
					);
				})}
			</AnimatePresence>
		</span>
	);
}
