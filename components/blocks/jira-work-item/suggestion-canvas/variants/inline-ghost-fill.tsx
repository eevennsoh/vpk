"use client";

import { useCallback } from "react";

import { WORK_ITEM_SUGGESTIONS, type SuggestionFieldId, type WorkItemSuggestion } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionReview } from "../use-suggestion-review";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { GhostField } from "./inline-ghost-fill/ghost-field";
import { ReviewBar } from "./inline-ghost-fill/review-bar";
import { useRecentDecisions } from "./inline-ghost-fill/use-recent-decisions";

/**
 * Inline ghost fill: no panel. Each suggestion waits in the exact field it would fill, as a soft
 * "ghost" of the full value, and resolves in place when accepted. A sticky bar above Details
 * summarises the run and offers the bulk actions.
 */
export function InlineGhostFillVariant() {
	const review = useSuggestionReview(WORK_ITEM_SUGGESTIONS);
	const recent = useRecentDecisions();
	const { accept, dismiss, undo, acceptAll, dismissAll, reset, pending, suggestions } = review;
	const { mark, clear } = recent;

	const pendingIds = pending.map((suggestion) => suggestion.id);
	const handleAcceptAll = useCallback(() => {
		mark(pendingIds);
		acceptAll();
	}, [acceptAll, mark, pendingIds]);
	const handleDismissAll = useCallback(() => {
		mark(pendingIds);
		dismissAll();
	}, [dismissAll, mark, pendingIds]);
	const handleUndoAll = useCallback(() => {
		clear(suggestions.map((suggestion) => suggestion.id));
		reset();
	}, [clear, reset, suggestions]);

	const renderField = (suggestion: WorkItemSuggestion, whySide: "left" | "bottom", labelHidden = false) => {
		const id: SuggestionFieldId = suggestion.id;
		return (
			<GhostField
				decision={review.decisionOf(id)}
				flashing={recent.flashing.has(id)}
				labelHidden={labelHidden}
				onAccept={() => {
					mark([id]);
					accept(id);
				}}
				onDismiss={() => {
					mark([id]);
					dismiss(id);
				}}
				onUndo={() => {
					clear([id]);
					undo(id);
				}}
				suggestion={suggestion}
				undoable={recent.undoable.has(id)}
				whySide={whySide}
			/>
		);
	};

	const description = suggestions.find((suggestion) => suggestion.id === "description");

	return (
		<WorkItemPreviewShell
			main={(
				<div className="flex flex-col gap-6">
					<section aria-label="Description" className="flex max-w-[34rem] flex-col gap-1">
						<h2 className="text-sm font-semibold text-text">Description</h2>
						{description ? renderField(description, "bottom", true) : null}
					</section>
					<div className="flex w-fit gap-0.5 rounded-md bg-bg-neutral p-0.5 text-sm">
						<span className="rounded-sm bg-surface px-2.5 py-1 text-text shadow-sm">Activity</span>
						<span className="px-2.5 py-1 text-text-subtle">Audit</span>
					</div>
					<div className="rounded-lg border border-border px-3 py-2.5 text-sm text-text-subtlest">Add a comment…</div>
				</div>
			)}
			rail={(
				<>
					<ReviewBar onAcceptAll={handleAcceptAll} onDismissAll={handleDismissAll} onUndoAll={handleUndoAll} review={review} />
					<MockDetailsRail review={review} slot={(suggestion) => renderField(suggestion, "left")} />
				</>
			)}
			railClassName="w-[392px] -mx-1 px-1 pb-1"
		/>
	);
}
