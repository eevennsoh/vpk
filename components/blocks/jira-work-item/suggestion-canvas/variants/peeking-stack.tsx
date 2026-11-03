"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { motionDuration, motionEase, motionRecipe } from "@/lib/motion";

import type { SuggestionFieldId } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionFeed } from "../use-suggestion-feed";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { DeckReceipt } from "./peeking-stack/deck-receipt";
import { POPPED_CARD_WIDTH, PoppedCard } from "./peeking-stack/popped-card";
import { StackMain, useJustFilled } from "./peeking-stack/stack-main";
import { pendingDeck, runAnnouncement } from "./peeking-stack/stack-order";
import { StackPanel } from "./peeking-stack/stack-panel";
import { StackTrigger } from "./peeking-stack/stack-trigger";
import { useStackPeek } from "./peeking-stack/use-stack-peek";
import { useStackPlacement, type StackPlacement } from "./peeking-stack/use-stack-placement";

/** Transform only, so the flight is one composited property plus a short fade. */
function tuckedTransform(placement: StackPlacement): string {
	return `translate(${placement.deckOffset.x}px, ${placement.deckOffset.y}px) scale(${placement.deckWidth / POPPED_CARD_WIDTH})`;
}

/** The pop grows out of the front deck card and flies to its place; settling or deciding flies it back into the deck. */
const popVariants = {
	tucked: (placement: StackPlacement) => ({ transform: tuckedTransform(placement), opacity: 0 }),
	up: {
		transform: "translate(0px, 0px) scale(1)",
		opacity: 1,
		transition: { default: { duration: motionDuration.slower, ease: motionEase.out }, opacity: { duration: motionDuration.medium, ease: motionEase.outPractical } },
	},
};

/**
 * "Peeking stack": a small fanned deck of suggestion cards tucked behind the trigger above Details. Now and then the
 * top card rises over the work item to invite review, with its value and reason on the card; the trigger or the
 * deck fans every card out into a light popover. Suggestions keep arriving as the agent re-runs.
 */
export function PeekingStackVariant() {
	const feed = useSuggestionFeed();
	const review = feed.review;
	const [open, setOpen] = useState(false);
	/** Where keyboard focus should land on the next surface: the receipt's Undo, or the card that Undo brought back. */
	const [focusTarget, setFocusTarget] = useState<"undo" | "card" | null>(null);
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const receiptRef = useRef<HTMLDivElement>(null);
	const { overlayRef, regionRef, deckRef, placement } = useStackPlacement();
	const { filled, flash } = useJustFilled();
	const peek = useStackPeek(feed, open);
	const pending = pendingDeck(feed);
	const peeked = peek.poppedId ? review.suggestions.find((suggestion) => suggestion.id === peek.poppedId) ?? null : null;
	const peekedDecision = peeked ? review.decisionOf(peeked.id) : "pending";
	const popped = peeked && peekedDecision === "pending" && !open ? peeked : null;
	const deck = pending.filter((suggestion) => suggestion.id !== peek.poppedId);
	const nextCard = pending.find((suggestion) => suggestion.id !== peek.poppedId) ?? null;

	const focusIsIn = (...elements: (HTMLElement | null)[]) => elements.some((element) => element?.contains(document.activeElement) ?? false);
	const close = () => {
		setOpen(false);
		feed.acknowledgeNew();
		triggerRef.current?.focus();
	};
	const openList = () => {
		peek.tuck();
		setOpen(true);
	};
	const accept = (id: SuggestionFieldId) => {
		review.accept(id);
		flash([id]);
	};
	const acceptAll = () => {
		flash(review.pending.map((suggestion) => suggestion.id));
		review.acceptAll();
	};
	/** A decision on the popped card: the card returns to the deck and its receipt takes the pocket. */
	const decidePopped = (action: () => void) => () => {
		setFocusTarget(focusIsIn(overlayRef.current) ? "undo" : null);
		peek.release();
		action();
	};
	const later = () => {
		const hadFocus = focusIsIn(overlayRef.current, receiptRef.current);
		peek.tuck();
		if (hadFocus) triggerRef.current?.focus();
	};

	const receipt = peeked && peekedDecision !== "pending" && !open ? (
		<DeckReceipt
				decision={peekedDecision}
				focusUndo={focusTarget === "undo"}
				key={`receipt-${peeked.id}`}
				onFocused={() => setFocusTarget(null)}
				hasNext={nextCard != null}
				onHold={peek.hold}
				onLater={later}
				onNext={() => {
					if (nextCard) peek.pop(nextCard.id);
				}}
				onUndo={() => {
					setFocusTarget(focusIsIn(receiptRef.current) ? "card" : null);
					peek.release();
					review.undo(peeked.id);
				}}
				ref={receiptRef}
				suggestion={peeked}
			/>
	) : null;

	return (
		<WorkItemPreviewShell
			main={<StackMain highlighted={filled.has("description")} review={review} />}
			overlay={(
				<div className="pointer-events-none absolute inset-0 z-30" ref={overlayRef}>
					<AnimatePresence>
						{popped && placement ? (
							<motion.div
								animate="up"
								className="pointer-events-auto absolute flex origin-top-right"
								custom={placement}
								exit={{ transform: tuckedTransform(placement), opacity: 0, transition: { default: { duration: motionDuration.slow, ease: motionEase.in }, opacity: { duration: motionDuration.medium, ease: motionEase.in } } }}
								initial="tucked"
								key={popped.id}
								style={{ top: placement.top, right: placement.right, maxHeight: placement.maxHeight, willChange: "transform, opacity" }}
								variants={popVariants}
							>
								<PoppedCard
									focusOnMount={focusTarget === "card"}
									onFocused={() => setFocusTarget(null)}
									isInFrame={(target) => overlayRef.current?.parentElement?.contains(target) ?? false}
									isNew={feed.newIds.has(popped.id)}
									maxHeight={placement.maxHeight}
									onAccept={decidePopped(() => accept(popped.id))}
									onDismiss={decidePopped(() => review.dismiss(popped.id))}
									onHold={peek.hold}
									onLater={later}
									onSeeAll={openList}
									pendingCount={pending.length}
									suggestion={popped}
								/>
							</motion.div>
						) : null}
					</AnimatePresence>
					<AnimatePresence initial={false}>
						{open && placement ? (
							<motion.div
								animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
								className="pointer-events-auto absolute flex"
								exit={{ opacity: 0, x: 8, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0, x: 8 }}
								key="panel"
								style={{ top: placement.top, right: placement.right, maxHeight: placement.maxHeight, willChange: "transform, opacity" }}
							>
								<StackPanel feed={feed} id={panelId} onAccept={accept} onAcceptAll={acceptAll} onClose={close} panelRef={panelRef} whyMaxHeight={placement.maxHeight} />
							</motion.div>
						) : null}
					</AnimatePresence>
					<p aria-live="polite" className="sr-only">{peek.announcement}</p>
					{/* The list's status row speaks for itself while open; closed, the run result is announced here. */}
					<p aria-live="polite" className="sr-only">{open ? "" : runAnnouncement(feed)}</p>
				</div>
			)}
			rail={(
				<>
					<StackTrigger
						autonomous={peek.autonomous}
						deck={deck}
						deckRef={deckRef}
						feed={feed}
						holdBand={peeked != null}
						onToggle={() => (open ? close() : openList())}
						open={open}
						panelId={panelId}
						receipt={<AnimatePresence>{receipt}</AnimatePresence>}
						receiptShown={receipt != null}
						regionRef={regionRef}
						triggerRef={triggerRef}
					/>
					<MockDetailsRail highlighted={filled} review={review} />
				</>
			)}
		/>
	);
}
