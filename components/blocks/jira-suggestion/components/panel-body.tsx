"use client";

import { useEffect, useLayoutEffect, useRef, type Ref, type RefObject } from "react";
import { AnimatePresence, motion, type MotionValue } from "motion/react";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { motionRecipe } from "@/lib/motion";

import { CardDeck } from "./card-deck";
import { CaughtUp } from "./caught-up";
import { CONTROLS_IN, FADE, FADE_OUT } from "./constants";
import { DeckControls } from "./deck-controls";
import { GhostCard } from "./ghost-card";
import { useArmed } from "./use-armed";
import { useBodyHeight, type BodyMode } from "./use-body-height";
import type { Deck, SwipeDirection } from "./use-deck";
import type { useDeckView } from "./use-deck-view";
import { useListDepth } from "./use-list-depth";

export interface PanelBodyProps {
	feed: SuggestionFeed;
	deck: Deck;
	view: ReturnType<typeof useDeckView>;
	mode: BodyMode;
	/** The list's height budget: the popover's, less its header and footer. */
	maxHeight: number;
	grab: { id: SuggestionFieldId; progress: MotionValue<number> } | null;
	deckRef: RefObject<HTMLDivElement | null>;
	checkRef: Ref<HTMLButtonElement>;
	whyAnchor: RefObject<HTMLElement | null>;
	whyContainer: HTMLElement | null;
	whyId: SuggestionFieldId | null;
	onWhyIdChange: (id: SuggestionFieldId | null) => void;
	onGrab: (grab: { id: SuggestionFieldId; progress: MotionValue<number> } | null) => void;
	onCommit: (direction: SwipeDirection) => void;
	onUndo: () => void;
	onUnpack: () => void;
}

const SWAP = { opacity: 1, transition: FADE };
const SWAP_OUT = { opacity: 0, transition: FADE_OUT };

/**
 * The popover body, which is also the list's scrollport: the card deck (stack or list), and under the stack its
 * ✕ · ↶ · ✓ controls or the caught-up state. Its height eases with the morph; the list scrolls natively with depth.
 */
export function PanelBody({ feed, deck, view, mode, maxHeight, grab, deckRef, checkRef, whyAnchor, whyContainer, whyId, onWhyIdChange, onGrab, onCommit, onUndo, onUnpack }: Readonly<PanelBodyProps>) {
	const scroller = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const { height, settled, overflow, viewport } = useBodyHeight(content, mode, maxHeight);
	const listed = mode === "list";
	const registerDepth = useListDepth(scroller, deckRef, listed, viewport);
	const top = deck.order.at(0);
	const armed = useArmed(grab && top && grab.id === top.id ? grab : null);
	const running = feed.status === "running";

	// A re-run's finds land at the top of the list; scroll up to meet them.
	const runs = feed.runs.length;
	useEffect(() => {
		if (runs > 1) scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
	}, [runs]);

	// Every unpack opens at the top, with the first row straight under the top card it came from, wherever the last
	// list was scrolled to. Before Motion measures where the rows land, so the flight heads for the right slots.
	useLayoutEffect(() => {
		if (listed && scroller.current) scroller.current.scrollTop = 0;
	}, [listed]);

	return (
		<motion.div className="relative shrink-0 overscroll-contain" ref={scroller} data-scrollport="" style={{ height, ...overflow }}>
			<div className={listed ? "px-4 pt-2 pb-4" : "px-5 pt-3 pb-5"} ref={content}>
				<AnimatePresence initial={false} mode="popLayout">
					{listed && running ? (
						<motion.div animate={SWAP} className="pb-2.5" exit={SWAP_OUT} initial={{ opacity: 0 }} key="ghost"><GhostCard /></motion.div>
					) : null}
					{listed && !running && deck.order.length === 0 ? (
						<motion.div animate={{ opacity: 1, transition: motionRecipe.popup.enter }} className="flex items-center justify-between gap-3 pb-3 pl-1" exit={SWAP_OUT} initial={{ opacity: 0 }} key="caught-up">
							<p className="text-sm font-medium text-text">All caught up</p>
							<Button onClick={feed.rerun} size="compact" type="button" variant="ghost">
								<RefreshIcon color="currentColor" label="" size="small" />
								Check again
							</Button>
						</motion.div>
					) : null}
				</AnimatePresence>
				<CardDeck
					deck={deck}
					deckRef={deckRef}
					exitKind={view.exitKind}
					feed={feed}
					gathering={view.gathering}
					listIds={view.listIds}
					listed={listed}
					morphing={!settled}
					onCommit={onCommit}
					onGrab={onGrab}
					onRelease={view.release}
					onUnpack={onUnpack}
					onWhyIdChange={onWhyIdChange}
					registerDepth={registerDepth}
					returning={view.returning}
					whyAnchor={whyAnchor}
					whyContainer={whyContainer}
					whyId={whyId}
				/>
				<AnimatePresence initial={false} mode="popLayout">
					{/* pt-11 is STACK_ROOM.below: the fanned sheets' tilt is capped to clear the discs within it. */}
					{mode === "stack" && top ? (
						<motion.div animate={{ opacity: 1, transition: CONTROLS_IN }} className="box-content grid h-10 items-center pt-11" exit={SWAP_OUT} initial={{ opacity: 0 }} key="controls">
							<DeckControls armed={armed} deck={deck} label={top.label} onCommit={onCommit} onUndo={onUndo} />
						</motion.div>
					) : null}
					{mode === "caught-up" ? (
						<motion.div animate={{ opacity: 1, transition: CONTROLS_IN }} exit={SWAP_OUT} initial={{ opacity: 0 }} key="caught-up">
							<CaughtUp checkRef={checkRef} deck={deck} feed={feed} onUndo={onUndo} />
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
