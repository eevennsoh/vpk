"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";

import { motionDuration, motionRecipe } from "@/lib/motion";

import { type SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import { MockDetailsRail } from "@/components/blocks/jira-suggestion/components/mock-details-rail";
import { useSuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { WorkItemPreviewShell } from "@/components/blocks/jira-suggestion/components/work-item-preview-shell";
import { LedgerBanner } from "./ledger-popover/ledger-banner";
import { LedgerMain } from "./ledger-popover/ledger-main";
import { LedgerPanel } from "./ledger-popover/ledger-panel";

const PANEL_GAP = 8;
const FRAME_INSET = 24;
/** How long a just-filled Details row stays tinted: two and a half of the slowest motion beats. */
const HIGHLIGHT_MS = motionDuration.slowest * 2.5 * 1000;

/**
 * Places the ledger to the left of the banner, top-aligned with it, inside the preview frame.
 * It renders in the shell's overlay rather than a body portal so it pans and zooms with its canvas frame.
 */
function useLedgerPlacement(open: boolean) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const anchorRef = useRef<HTMLDivElement>(null);
	const [style, setStyle] = useState<CSSProperties | null>(null);
	const [boundaryStyle, setBoundaryStyle] = useState<CSSProperties | null>(null);
	useLayoutEffect(() => {
		const overlay = overlayRef.current;
		const anchor = anchorRef.current;
		if (!open || !overlay || !anchor) return undefined;
		const measure = () => {
			const frame = overlay.getBoundingClientRect();
			const banner = anchor.getBoundingClientRect();
			const scale = frame.width / overlay.offsetWidth || 1;
			const top = (banner.top - frame.top) / scale;
			setStyle({ top, right: (frame.right - banner.left) / scale + PANEL_GAP, maxHeight: overlay.offsetHeight - top - FRAME_INSET });
			setBoundaryStyle({ top: (banner.bottom - frame.top) / scale + PANEL_GAP, bottom: FRAME_INSET, left: 0, right: FRAME_INSET });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(overlay);
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [open]);
	return { overlayRef, anchorRef, style, boundaryStyle };
}

/** Briefly tints Details rows that just received a value, tying each Accept to its consequence. */
function useJustFilled() {
	const [filled, setFilled] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const timers = useRef(new Map<SuggestionFieldId, number>());
	useEffect(() => {
		const pending = timers.current;
		return () => pending.forEach((timer) => window.clearTimeout(timer));
	}, []);
	const flash = useCallback((ids: readonly SuggestionFieldId[]) => {
		setFilled((current) => new Set([...current, ...ids]));
		for (const id of ids) {
			window.clearTimeout(timers.current.get(id));
			timers.current.set(id, window.setTimeout(() => {
				timers.current.delete(id);
				setFilled((current) => new Set([...current].filter((entry) => entry !== id)));
			}, HIGHLIGHT_MS));
		}
	}, []);
	return { filled, flash };
}

export function LedgerPopoverVariant() {
	const feed = useSuggestionFeed();
	const review = feed.review;
	const [open, setOpen] = useState(true);
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { overlayRef, anchorRef, style, boundaryStyle } = useLedgerPlacement(open);
	const [whyBoundary, setWhyBoundary] = useState<HTMLDivElement | null>(null);
	const { filled, flash } = useJustFilled();

	const close = () => {
		setOpen(false);
		feed.acknowledgeNew();
		triggerRef.current?.focus();
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
			main={<LedgerMain review={review} highlighted={filled.has("description")} />}
			overlay={(
				<div className="pointer-events-none absolute inset-0 z-30" ref={overlayRef}>
					{/* The free area below the trigger banner: why cards shift to stay inside it, never covering the trigger. */}
					{boundaryStyle ? <div aria-hidden="true" className="absolute" ref={setWhyBoundary} style={boundaryStyle} /> : null}
					<AnimatePresence initial={false}>
						{open && style ? (
							<motion.div
								animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
								className="pointer-events-auto absolute flex"
								exit={{ opacity: 0, x: 8, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0, x: 8 }}
								key="ledger"
								style={{ ...style, willChange: "transform, opacity" }}
							>
								<LedgerPanel feed={feed} id={panelId} onAccept={accept} onAcceptAll={acceptAll} onClose={close} panelRef={panelRef} triggerRef={triggerRef} whyBoundary={whyBoundary} />
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			)}
			rail={(
				<>
					<div ref={anchorRef}>
						<LedgerBanner feed={feed} onToggle={() => (open ? close() : setOpen(true))} open={open} panelId={panelId} triggerRef={triggerRef} />
					</div>
					<MockDetailsRail highlighted={filled} review={review} />
				</>
			)}
		/>
	);
}
