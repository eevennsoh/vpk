"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { motionRecipe } from "@/lib/motion";

import { type SuggestionFieldId } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionFeed } from "../use-suggestion-feed";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { LedgerMain } from "./ledger-popover/ledger-main";
import { TimelinePanel } from "./run-timeline/timeline-panel";
import { TimelineTrigger } from "./run-timeline/timeline-trigger";
import { useDismissOnOutsidePress, useJustFilled, useOverlayPlacement } from "./run-timeline/use-overlay-placement";

/** Run timeline: ongoing suggestions grouped by agent run, newest first, in a popover over the work item. */
export function RunTimelineVariant() {
	const feed = useSuggestionFeed();
	const { review } = feed;
	const [open, setOpen] = useState(true);
	const [latestDecisionId, setLatestDecisionId] = useState<SuggestionFieldId | null>(null);
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { overlayRef, anchorRef, style, whyBoundary } = useOverlayPlacement(open);
	const { filled, flash } = useJustFilled();

	// Closing the popover means the reader has seen whatever arrived while it was open.
	const close = ({ restoreFocus = true } = {}) => {
		setOpen(false);
		feed.acknowledgeNew();
		// preventScroll: the preview sits in a pan/zoom canvas, and a scrolling focus would throw the frame off screen.
		if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
	};
	const toggle = () => (open ? close() : setOpen(true));
	useDismissOnOutsidePress({ open, scopeRef: overlayRef, insideRefs: [panelRef, anchorRef], onDismiss: () => close({ restoreFocus: false }) });

	const accept = (id: SuggestionFieldId) => {
		review.accept(id);
		setLatestDecisionId(id);
		flash([id]);
	};
	const dismiss = (id: SuggestionFieldId) => {
		review.dismiss(id);
		setLatestDecisionId(id);
	};
	const acceptAll = () => {
		flash(review.pending.map((suggestion) => suggestion.id));
		review.acceptAll();
		setLatestDecisionId(null);
	};
	const dismissAll = () => {
		review.dismissAll();
		setLatestDecisionId(null);
	};

	return (
		<WorkItemPreviewShell
			main={<LedgerMain highlighted={filled.has("description")} review={review} />}
			overlay={(
				<div className="pointer-events-none absolute inset-0 z-30" ref={overlayRef}>
					<AnimatePresence initial={false}>
						{open && style ? (
							<motion.div
								animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
								className="pointer-events-auto absolute flex"
								exit={{ opacity: 0, x: 8, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0, x: 8 }}
								key="run-timeline"
								style={style}
							>
								<TimelinePanel
									feed={feed}
									getWhyBoundary={whyBoundary}
									id={panelId}
									latestDecisionId={latestDecisionId}
									onAccept={accept}
									onAcceptAll={acceptAll}
									onClose={close}
									onDismiss={dismiss}
									onDismissAll={dismissAll}
									onUndo={review.undo}
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
						<TimelineTrigger feed={feed} onToggle={toggle} open={open} panelId={panelId} triggerRef={triggerRef} />
					</div>
					<MockDetailsRail highlighted={filled} review={review} />
				</>
			)}
		/>
	);
}
