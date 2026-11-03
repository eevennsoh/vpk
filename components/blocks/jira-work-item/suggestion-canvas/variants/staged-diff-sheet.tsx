"use client";

import { WORK_ITEM_SUGGESTIONS } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionReview } from "../use-suggestion-review";

/** Placeholder: replaced by the variant builder. */
export function StagedDiffSheetVariant() {
	const review = useSuggestionReview(WORK_ITEM_SUGGESTIONS);
	return (
		<div className="flex h-full justify-end bg-surface p-6">
			<MockDetailsRail className="w-[360px]" review={review} />
		</div>
	);
}
