"use client";

import { useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { AnimatePresence, type MotionValue, type Transition } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { cn } from "@/lib/utils";

import { FAN, FAN_SPREAD, LIST_GAP, MORPH, MORPH_STAGGER, REAR_SHEETS, STACK_ROOM, WIDE_CARD_TILT } from "./constants";
import { SuggestionCard, type CardEntrance, type CardExit, type CardPose, type CardRole } from "./suggestion-card";
import { StackSheetGhost } from "./ghost-card";
import type { Deck, SwipeDirection } from "./use-deck";
import { useDeckLayers } from "./use-deck-layers";
import { useSheetRoom } from "./use-sheet-room";

const REST: CardPose = { x: 0, y: 0, rotate: 0 };

export interface CardDeckProps {
	feed: SuggestionFeed;
	deck: Deck;
	/** "list" lays every card out in rows; otherwise the pending cards form the stack. */
	listed: boolean;
	/** The list's order (the stack's order when it unpacked, a re-run's finds on top). */
	listIds: readonly SuggestionFieldId[];
	/** Decided cards still drawn behind the last sheet while a list gathers back into the stack. */
	gathering: readonly SuggestionFieldId[];
	exitKind: CardExit;
	/** The morph between stack and list is still in flight. */
	morphing: boolean;
	returning: { ids: readonly SuggestionFieldId[]; direction: SwipeDirection } | null;
	registerDepth: (element: HTMLElement) => () => void;
	deckRef: RefObject<HTMLDivElement | null>;
	whyAnchor: RefObject<HTMLElement | null>;
	whyContainer: HTMLElement | null;
	whyId: SuggestionFieldId | null;
	onWhyIdChange: (id: SuggestionFieldId | null) => void;
	onGrab: (grab: { id: SuggestionFieldId; progress: MotionValue<number> } | null) => void;
	onCommit: (direction: SwipeDirection) => void;
	onUnpack: () => void;
	/** A decided card that gathered into the stack has landed behind the last sheet and faded: it can go. */
	onRelease: (id: SuggestionFieldId) => void;
}

function isFromControl(event: KeyboardEvent<HTMLDivElement>): boolean {
	if (event.target === event.currentTarget) return false;
	return (event.target as Element).closest("button, a, input, textarea, select, [contenteditable], [role=button], [role=menuitem], [data-suggestion-value-scroll]") != null;
}

/**
 * Every suggestion card in one persistent container that is the stack or the list. In the stack the first pending card
 * is in flow and the rest are blank sheets layered behind it on a freshly rolled fan (beyond the second, exactly behind
 * the last one); in the list every card is a row. The same card elements serve both, so unpacking slides the sheets
 * out from under the top card into rows 2, 3, … and gathering slides them back underneath it.
 */
export function CardDeck({
	feed, deck, listed, listIds, gathering, exitKind, morphing, returning, registerDepth, deckRef,
	whyAnchor, whyContainer, whyId, onWhyIdChange, onGrab, onCommit, onUnpack, onRelease,
}: Readonly<CardDeckProps>) {
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [grabbed, setGrabbed] = useState<MotionValue<number> | null>(null);
	const layers = useDeckLayers(deck.formation);
	const running = feed.status === "running";
	const orderIds = deck.order.map((suggestion) => suggestion.id);
	const ids = listed ? listIds : [...orderIds, ...gathering.filter((id) => !orderIds.includes(id))];
	const top = listed ? undefined : deck.order.at(0);
	const fanned = (hovered || focused) && !grabbed && !listed && orderIds.length > 1;
	const keepInside = useSheetRoom(deckRef, STACK_ROOM, !listed);
	const commit = (direction: SwipeDirection) => {
		setGrabbed(null);
		onCommit(direction);
	};

	const layerOf = (depth: number): CardPose => {
		const layer = layers[Math.min(depth, REAR_SHEETS) - 1];
		if (!layer) return REST;
		// The kanban roll is tuned for narrow issue cards; a popover-wide card tilts less for the same corner reveal.
		const spread = fanned ? 1 : 0;
		return keepInside({
			x: layer.xPx * (1 + spread * (FAN_SPREAD.x - 1)),
			y: layer.yPx + spread * FAN_SPREAD.y * Math.min(depth, REAR_SHEETS),
			rotate: layer.rotateDeg * WIDE_CARD_TILT * (1 + spread * (FAN_SPREAD.rotate - 1)),
		});
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!top || isFromControl(event) || event.altKey || event.shiftKey) return;
		if (event.metaKey || event.ctrlKey) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onUnpack();
		}
	};
	const onClick = (event: MouseEvent<HTMLDivElement>) => {
		if (listed || !top || (event.target as Element).closest("[data-top-card], button")) return;
		onUnpack();
	};
	const onFocus = (event: FocusEvent<HTMLDivElement>) => setFocused(!listed && event.target === event.currentTarget && event.currentTarget.matches(":focus-visible"));

	const entranceOf = (id: SuggestionFieldId): CardEntrance => {
		if (returning?.ids.includes(id)) return returning.direction;
		if (feed.newIds.has(id)) return "new";
		return listed && feed.review.decisionOf(id) !== "pending" ? "reveal" : "none";
	};

	const ghostDepth = Math.min(orderIds.length, REAR_SHEETS + 1);
	const ghostLayer = layerOf(Math.max(ghostDepth, 1));

	return (
		// A composite widget in stack mode: arrows decide, Enter unpacks; a click on the stack is the pointer twin of Enter.
		<div
			aria-keyshortcuts={top ? "ArrowLeft ArrowRight Enter" : undefined}
			aria-label={listed ? "Suggestions" : top ? `${top.label}: ${top.valueText.replace(/\.$/, "")}. Right arrow accepts, left arrow dismisses, Enter shows every suggestion.` : "Suggestion stack"}
			aria-roledescription={listed ? undefined : "suggestion stack"}
			className={cn(
				"relative isolate rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface-overlay",
				listed ? "flex flex-col" : null,
			)}
			onBlur={() => setFocused(false)}
			onClick={onClick}
			onFocus={onFocus}
			onKeyDown={onKeyDown}
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => setHovered(false)}
			ref={deckRef}
			role={listed ? "list" : "group"}
			style={listed ? { gap: LIST_GAP } : undefined}
			tabIndex={top ? 0 : undefined}
		>
			<AnimatePresence custom={exitKind} initial={false} mode="popLayout">
				{ids.map((id, index) => {
					const suggestion = feed.review.suggestions.find((candidate) => candidate.id === id);
					if (!suggestion) return null;
					const role: CardRole = listed ? "row" : index === 0 ? "top" : "sheet";
					const delay = index * MORPH_STAGGER;
					const poseTransition: Transition = morphing ? { ...MORPH, delay } : FAN;
					return (
						<SuggestionCard
							decision={feed.review.decisionOf(id)}
							delay={delay}
							entrance={entranceOf(id)}
							isNew={feed.newIds.has(id)}
							key={id}
							morphing={morphing}
							onCommit={commit}
							onDecide={(direction) => deck.decide(id, direction)}
							onGrab={(progress) => {
								setGrabbed(progress);
								onGrab(progress ? { id, progress } : null);
							}}
							onRestore={() => deck.restore(id)}
							onTap={onUnpack}
							onWhyOpenChange={(open) => onWhyIdChange(open ? id : null)}
							onParked={gathering.includes(id) ? () => onRelease(id) : undefined}
							parked={!listed && (index > REAR_SHEETS || gathering.includes(id))}
							peekProgress={role === "sheet" && index === 1 ? grabbed : null}
							pose={role === "sheet" ? layerOf(index) : REST}
							poseTransition={poseTransition}
							registerDepth={registerDepth}
							role={role}
							suggestion={suggestion}
							whyAnchor={whyAnchor}
							whyContainer={whyContainer}
							whyOpen={whyId === id}
							zIndex={ids.length - index}
						/>
					);
				})}
			</AnimatePresence>
			<AnimatePresence initial={false}>
				{running && top ? <StackSheetGhost key="ghost-sheet" pose={{ ...ghostLayer, rotate: -ghostLayer.rotate }} /> : null}
			</AnimatePresence>
		</div>
	);
}
