"use client";

import { useEffect, useEffectEvent, useState, type RefObject } from "react";
import { AnimatePresence, motion, type MotionValue } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

import { ArrivalNote } from "./arrival-note";
import type { CardHeights } from "./card-face";
import { ARRIVAL_ROOM, CONTROLS_GAP, CONTROLS_HEIGHT, GHOST_HEIGHT, PEEK_STEP, VISIBLE_CARDS } from "./constants";
import { DeckControls } from "./deck-controls";
import { GhostCard } from "./ghost-card";
import { CheckingLine } from "./run-status";
import { SwipeCard } from "./swipe-card";
import type { Deck, SwipeDirection } from "./use-deck";
import { useEasedLength } from "./use-eased-length";

export interface DeckStackProps {
	deck: Deck;
	running: boolean;
	newIds: ReadonlySet<SuggestionFieldId>;
	/** Each suggestion's natural card height. */
	heights: CardHeights;
	deckRef: RefObject<HTMLDivElement | null>;
	whyAnchor: RefObject<HTMLElement | null>;
	whyContainer: HTMLElement | null;
	whyId: SuggestionFieldId | null;
	onWhyIdChange: (id: SuggestionFieldId | null) => void;
	onUndo: () => void;
}

interface Grab {
	id: SuggestionFieldId;
	progress: MotionValue<number>;
}

function isFromControl(event: KeyboardEvent): boolean {
	if (event.target === event.currentTarget) return false;
	return (event.target as Element).closest("button, a, input, textarea, select, [contenteditable], [role=button], [role=menuitem]") != null;
}

/** Which decision releasing now would commit, re-rendering only when that changes. */
function useArmed(grab: Grab | null): SwipeDirection | null {
	const [armed, setArmed] = useState<{ id: SuggestionFieldId; direction: SwipeDirection } | null>(null);
	useEffect(() => {
		if (!grab) return undefined;
		return grab.progress.on("change", (value) => {
			const direction = value >= 1 ? "accept" : value <= -1 ? "dismiss" : null;
			setArmed((current) => (current?.direction === direction && current?.id === grab.id ? current : direction ? { id: grab.id, direction } : null));
		});
	}, [grab]);
	return grab && armed?.id === grab.id ? armed.direction : null;
}

/**
 * The deck: the top card sized to its own content with up to two peeks behind it, then ✕ / Undo / ✓.
 * The stack's height follows the top card. While the pointer rests on the controls, the stack keeps the tallest
 * height it has had since, so ✕ and ✓ stay under the pointer for a run of clicks and settle once it leaves.
 * While the agent re-runs, a ghost takes the back slot. ← dismisses, → accepts, ⌘Z / Ctrl+Z undoes.
 */
export function DeckStack({ deck, running, newIds, heights, deckRef, whyAnchor, whyContainer, whyId, onWhyIdChange, onUndo }: Readonly<DeckStackProps>) {
	const [grab, setGrab] = useState<Grab | null>(null);
	const [hold, setHold] = useState<number | null>(null);
	const visible = deck.order.slice(0, running ? VISIBLE_CARDS - 1 : VISIBLE_CARDS);
	const top = visible.at(0);
	const activeGrab = grab && top && grab.id === top.id ? grab : null;
	const armed = useArmed(activeGrab);

	const topHeight = top ? (heights[top.id] ?? null) : running ? GHOST_HEIGHT : null;
	const layers = Math.min(visible.length + (running ? 1 : 0), VISIBLE_CARDS);
	// While new arrivals wait at the back, the stack makes room below the peeks for their note.
	const natural = topHeight == null ? null : topHeight + Math.max(0, layers - 1) * PEEK_STEP + (deck.arrival ? ARRIVAL_ROOM : 0);
	const stackHeight = natural == null ? null : Math.max(natural, hold ?? 0);
	const easedHeight = useEasedLength(stackHeight);

	const commit = (direction: SwipeDirection) => {
		if (!top) return;
		setGrab(null);
		onWhyIdChange(null);
		deck.decide(top.id, direction);
	};

	const onKey = useEffectEvent((event: KeyboardEvent) => {
		if (isFromControl(event) || event.altKey || event.shiftKey) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
			if (!deck.lastDecision) return;
			event.preventDefault();
			onUndo();
			return;
		}
		if (event.metaKey || event.ctrlKey) return;
		if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			event.preventDefault();
			commit(event.key === "ArrowRight" ? "accept" : "dismiss");
		}
	});
	const hasCards = top != null;
	useEffect(() => {
		const element = deckRef.current;
		if (!element || !hasCards) return undefined;
		const listener = (event: KeyboardEvent) => onKey(event);
		element.addEventListener("keydown", listener);
		return () => element.removeEventListener("keydown", listener);
	}, [deckRef, hasCards]);

	return (
		<div className="flex flex-col" style={{ gap: CONTROLS_GAP }}>
			<motion.div
				aria-label={top ? `${top.label}: ${top.valueText.replace(/\.$/, "")}. Right arrow accepts, left arrow dismisses.` : "Checking for new suggestions"}
				aria-roledescription="suggestion deck"
				className="group/deck relative outline-none"
				ref={deckRef}
				role="group"
				style={{ height: easedHeight }}
				tabIndex={top ? 0 : -1}
			>
				<AnimatePresence custom={deck.exitDirection} initial={false}>
					{visible.map((suggestion, index) => (
						<SwipeCard
							entrance={deck.entranceOf(suggestion.id)}
							height={topHeight}
							index={index}
							isNew={newIds.has(suggestion.id)}
							key={suggestion.id}
							onCommit={commit}
							onGrab={(progress) => setGrab(progress ? { id: suggestion.id, progress } : null)}
							onWhyOpenChange={(open) => onWhyIdChange(open ? suggestion.id : null)}
							promote={index > 0 && activeGrab ? activeGrab.progress : null}
							suggestion={suggestion}
							whyAnchor={whyAnchor}
							whyContainer={whyContainer}
							whyOpen={whyId === suggestion.id}
						/>
					))}
					{running ? <GhostCard height={topHeight} index={visible.length} key="ghost" /> : null}
				</AnimatePresence>
				<ArrivalNote arrival={deck.arrival} onReviewFirst={deck.reviewArrivalsFirst} />
			</motion.div>
			<div
				className="grid"
				onPointerEnter={() => setHold(natural)}
				onPointerLeave={() => setHold(null)}
				style={{ height: CONTROLS_HEIGHT }}
			>
				{top ? <DeckControls armed={armed} deck={deck} label={top.label} onCommit={commit} onUndo={onUndo} /> : <CheckingLine />}
			</div>
		</div>
	);
}
