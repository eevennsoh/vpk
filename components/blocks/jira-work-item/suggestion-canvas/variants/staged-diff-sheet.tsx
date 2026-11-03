"use client";

import { useId, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

import { motionRecipe } from "@/lib/motion";

import { WORK_ITEM_SUGGESTIONS } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { MainColumn } from "./staged-diff-sheet/main-column";
import { RailStatus } from "./staged-diff-sheet/rail-status";
import { ReviewSheet } from "./staged-diff-sheet/review-sheet";
import { useStagedReview } from "./staged-diff-sheet/use-staged-review";

/**
 * Staged diff sheet: a commit-style review. A slim banner sits atop the Details rail; the review sheet
 * slides over the main column with one diff per field, include toggles for a batch Apply, and immediate
 * per-row Accept / Dismiss. Applying closes the sheet, fills the rail, and leaves an Undo receipt.
 */
export function StagedDiffSheetVariant() {
	const sheetId = useId();
	const sheetRef = useRef<HTMLElement>(null);
	const railStatusRef = useRef<HTMLDivElement>(null);
	const staged = useStagedReview(WORK_ITEM_SUGGESTIONS, { sheetRef, railStatusRef });
	const { review } = staged;
	const description = review.decisionOf("description") === "accepted" ? review.suggestions.find((suggestion) => suggestion.id === "description") ?? null : null;

	const overlay = (
		<AnimatePresence initial={false}>
			{staged.open ? (
				<motion.div
					animate={{ opacity: 1, transition: motionRecipe.blanket.enter }}
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 left-0 w-[644px] bg-blanket/50"
					exit={{ opacity: 0, transition: motionRecipe.blanket.exit }}
					initial={{ opacity: 0 }}
					key="scrim"
					style={{ willChange: "opacity" }}
				/>
			) : null}
			{staged.open ? (
				<motion.div
					animate={{ opacity: 1, x: 0, transition: motionRecipe.flag.enter }}
					className="absolute top-2 bottom-2 left-2 w-[628px]"
					exit={{ opacity: 0, x: -16, transition: motionRecipe.flag.exit }}
					initial={{ opacity: 0, x: -32 }}
					key="sheet"
					style={{ willChange: "transform, opacity" }}
				>
					<ReviewSheet
						id={sheetId}
						isIncluded={staged.isIncluded}
						onAccept={staged.accept}
						onApply={staged.apply}
						onClose={staged.closeSheet}
						onDismissRemaining={staged.dismissRemaining}
						ref={sheetRef}
						review={review}
						setIncluded={staged.setIncluded}
					/>
				</motion.div>
			) : null}
		</AnimatePresence>
	);

	return (
		<WorkItemPreviewShell
			main={<MainColumn description={description} highlighted={staged.highlighted.has("description")} />}
			overlay={overlay}
			rail={
				<>
					<div className="shrink-0 rounded-xl outline-none" ref={railStatusRef} tabIndex={-1}>
						<RailStatus
							onCloseReceipt={staged.closeReceipt}
							onReset={staged.reset}
							onToggleSheet={staged.toggleSheet}
							onUndoReceipt={staged.undoReceipt}
							pendingCount={review.pending.length}
							receipt={staged.receipt}
							sheetId={sheetId}
							sheetOpen={staged.open}
						/>
					</div>
					<MockDetailsRail className="shrink-0" highlighted={staged.highlighted} review={review} />
				</>
			}
		/>
	);
}
