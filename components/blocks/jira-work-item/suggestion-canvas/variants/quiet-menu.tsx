"use client";

import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionFeed } from "../use-suggestion-feed";
import { WorkItemPreviewShell } from "../work-item-preview-shell";

/** Placeholder: replaced by the variant builder. */
export function QuietMenuVariant() {
	const feed = useSuggestionFeed();
	return <WorkItemPreviewShell rail={<MockDetailsRail review={feed.review} />} />;
}
