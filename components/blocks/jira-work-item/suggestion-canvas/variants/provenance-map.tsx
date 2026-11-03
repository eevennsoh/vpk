"use client";

import { useId } from "react";

import { token } from "@/lib/tokens";

import { WORK_ITEM_SUGGESTIONS } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionReview } from "../use-suggestion-review";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { DescriptionCard } from "./provenance-map/description-card";
import { PanelHeader } from "./provenance-map/panel-header";
import { ProvenanceMap } from "./provenance-map/provenance-map";
import { useReviewActions } from "./provenance-map/use-review-actions";

const DESCRIPTION = WORK_ITEM_SUGGESTIONS.find((suggestion) => suggestion.id === "description");

/**
 * Provenance map: every suggestion is drawn to the sources that justify it. Hover or focus a suggestion
 * to trace its evidence; hover or press a source to see everything it supports.
 */
export function ProvenanceMapVariant() {
	const review = useSuggestionReview(WORK_ITEM_SUGGESTIONS);
	const actions = useReviewActions(review);
	const titleId = useId();

	return (
		<WorkItemPreviewShell
			main={(
				<section aria-labelledby={titleId} className="flex h-full flex-col rounded-xl bg-surface-raised" style={{ boxShadow: token("elevation.shadow.raised") }}>
					<PanelHeader onAcceptAll={actions.acceptAll} onDismissAll={actions.dismissAll} onReset={actions.reset} review={review} titleId={titleId} />
					<ProvenanceMap actions={actions} review={review} />
				</section>
			)}
			rail={(
				<>
					{DESCRIPTION ? <DescriptionCard highlighted={actions.justFilled.has(DESCRIPTION.id)} review={review} suggestion={DESCRIPTION} /> : null}
					<MockDetailsRail highlighted={actions.justFilled} review={review} />
				</>
			)}
			railClassName="w-[296px]"
		/>
	);
}
