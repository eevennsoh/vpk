"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { motionRecipe } from "@/lib/motion";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import { MockDetailsRail } from "@/components/blocks/jira-suggestion/components/mock-details-rail";
import { useSuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { WorkItemPreviewShell } from "@/components/blocks/jira-suggestion/components/work-item-preview-shell";
import { QuietMain } from "./quiet-menu/quiet-main";
import { QuietPanel } from "./quiet-menu/quiet-panel";
import { QuietTrigger } from "./quiet-menu/quiet-trigger";
import { MENU_OVERLAP, useJustFilled, useMenuPlacement, useRevealFilled } from "./quiet-menu/use-menu-state";

/**
 * Quiet menu: the most minimal suggestion surface. A refined popover over the work item with compact rows,
 * quiet per-row actions, a why card over the free main column, and a single text footer.
 */
export function QuietMenuVariant() {
	const feed = useSuggestionFeed();
	const review = feed.review;
	const [open, setOpen] = useState(true);
	const [acknowledgedRun, setAcknowledgedRun] = useState(1);
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { overlayRef, anchorRef, style } = useMenuPlacement(open);
	const { filled, flash } = useJustFilled();
	const { railRef, reveal } = useRevealFilled();

	const lastRun = feed.runs.at(-1);
	const newGroup: ReadonlySet<SuggestionFieldId> = lastRun && lastRun.number > 1 && lastRun.number !== acknowledgedRun ? new Set(lastRun.ids) : new Set();

	const close = () => {
		setOpen(false);
		feed.acknowledgeNew();
		if (lastRun) setAcknowledgedRun(lastRun.number);
		triggerRef.current?.focus();
	};
	const toggle = () => {
		if (open) {
			close();
			return;
		}
		setOpen(true);
		requestAnimationFrame(() => panelRef.current?.focus());
	};
	const accept = (ids: readonly SuggestionFieldId[]) => {
		flash(ids);
		if (ids.length === 1) review.accept(ids[0]);
		else review.acceptAll();
		reveal();
	};

	return (
		<WorkItemPreviewShell
			main={<QuietMain highlighted={filled.has("description")} reserve={open ? MENU_OVERLAP : 0} review={review} />}
			overlay={(
				<div className="pointer-events-none absolute inset-0 z-30" data-why-frame="" ref={overlayRef}>
					<AnimatePresence initial={false}>
						{open && style ? (
							<motion.div
								animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
								className="pointer-events-auto absolute flex"
								exit={{ opacity: 0, x: 8, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0, x: 8 }}
								key="quiet-menu"
								style={{ ...style, willChange: "transform, opacity" }}
							>
								<QuietPanel feed={feed} id={panelId} newGroup={newGroup} onAccept={accept} onClose={close} panelRef={panelRef} />
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			)}
			rail={(
				<>
					<div ref={anchorRef}>
						<QuietTrigger feed={feed} onToggle={toggle} open={open} panelId={panelId} triggerRef={triggerRef} />
					</div>
					<div ref={railRef}>
						<MockDetailsRail highlighted={filled} review={review} />
					</div>
				</>
			)}
		/>
	);
}
