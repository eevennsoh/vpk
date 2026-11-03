"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { motionRecipe } from "@/lib/motion";

import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionFeed } from "../use-suggestion-feed";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { StackMain } from "./card-stack/stack-main";
import { StackPanel } from "./card-stack/stack-panel";
import { StackTrigger } from "./card-stack/stack-trigger";
import { useDeck } from "./card-stack/use-deck";
import { useJustFilled } from "./card-stack/use-just-filled";
import { useOverlayPlacement } from "./card-stack/use-overlay-placement";

/**
 * Card stack: one suggestion at a time on a swipeable deck inside a compact popover over the work item.
 * Swipe or press → to accept, ← to dismiss; re-runs add new cards to the back of the deck.
 */
export function CardStackVariant() {
	const feed = useSuggestionFeed();
	const [open, setOpen] = useState(true);
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const deckRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { overlayRef, overlay, anchorRef, style } = useOverlayPlacement(open);
	const { filled, flash } = useJustFilled();
	const deck = useDeck(feed, flash);
	const slide = useReducedMotion() ? 0 : 8;

	const close = () => {
		setOpen(false);
		feed.acknowledgeNew();
		triggerRef.current?.focus();
	};
	const toggle = () => {
		if (open) {
			close();
			return;
		}
		setOpen(true);
		requestAnimationFrame(() => deckRef.current?.focus({ preventScroll: true }));
	};

	return (
		<WorkItemPreviewShell
			main={<StackMain highlighted={filled.has("description")} review={feed.review} />}
			overlay={(
				<div className="pointer-events-none absolute inset-0 z-30" ref={overlayRef}>
					<AnimatePresence initial={false}>
						{open && style ? (
							<motion.div
								animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
								className="pointer-events-auto absolute flex"
								exit={{ opacity: 0, x: slide, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0, x: slide }}
								key="deck"
								style={{ ...style, willChange: "transform, opacity" }}
							>
								<StackPanel deck={deck} deckRef={deckRef} feed={feed} id={panelId} onClose={close} overlay={overlay} panelRef={panelRef} />
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			)}
			rail={(
				<>
					<div ref={anchorRef}>
						<StackTrigger feed={feed} onToggle={toggle} open={open} panelId={panelId} triggerRef={triggerRef} />
					</div>
					<MockDetailsRail highlighted={filled} review={feed.review} />
				</>
			)}
		/>
	);
}
