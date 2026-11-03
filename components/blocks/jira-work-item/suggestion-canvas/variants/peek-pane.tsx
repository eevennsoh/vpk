"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { motionRecipe } from "@/lib/motion";

import type { SuggestionFieldId } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionFeed } from "../use-suggestion-feed";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { PeekMain } from "./peek-pane/peek-main";
import { PeekPanel } from "./peek-pane/peek-panel";
import { PeekTrigger } from "./peek-pane/peek-trigger";
import { useJustFilled, useOverlayPlacement } from "./peek-pane/use-overlay-placement";

/**
 * Peek pane: a narrow suggestions popover whose explanation slides out from beneath its left edge
 * for the hovered, focused or pinned row, so "why" never needs a second floating card.
 */
export function PeekPaneVariant() {
	const feed = useSuggestionFeed();
	const { review } = feed;
	const [open, setOpen] = useState(true);
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { overlayRef, anchorRef, style } = useOverlayPlacement(open);
	const { filled, flash } = useJustFilled();

	const close = () => {
		setOpen(false);
		feed.acknowledgeNew();
		triggerRef.current?.focus({ preventScroll: true });
	};
	const toggle = () => {
		if (open) feed.acknowledgeNew();
		setOpen((current) => !current);
	};
	const accept = (id: SuggestionFieldId) => {
		review.accept(id);
		flash([id]);
	};
	const acceptAll = () => {
		flash(review.pending.map((suggestion) => suggestion.id));
		review.acceptAll();
	};

	return (
		<WorkItemPreviewShell
			main={<PeekMain highlighted={filled.has("description")} review={review} />}
			overlay={(
				<div className="pointer-events-none absolute inset-0 z-30" ref={overlayRef}>
					<AnimatePresence initial={false}>
						{open && style ? (
							<motion.div
								animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
								className="pointer-events-auto absolute flex"
								exit={{ opacity: 0, x: 8, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0, x: 8 }}
								key="peek-pane"
								style={{ top: style.top, right: style.right, willChange: "transform, opacity" }}
							>
								<PeekPanel
									feed={feed}
									id={panelId}
									maxHeight={typeof style.maxHeight === "number" ? style.maxHeight : undefined}
									onAccept={accept}
									onAcceptAll={acceptAll}
									onClose={close}
									panelRef={panelRef}
								/>
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			)}
			rail={(
				<>
					<div ref={anchorRef}>
						<PeekTrigger feed={feed} onToggle={toggle} open={open} panelId={panelId} triggerRef={triggerRef} />
					</div>
					<MockDetailsRail highlighted={filled} review={review} />
				</>
			)}
		/>
	);
}
