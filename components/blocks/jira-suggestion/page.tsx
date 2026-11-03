"use client";

import { JiraSuggestion } from "@/components/blocks/jira-suggestion";

/** Demo: the suggestion card stack over an empty work item, at the 1040×760 work-item modal size it was designed for. */
export default function JiraSuggestionPage() {
	return (
		<div className="flex min-h-screen w-full items-center justify-center p-4">
			<div className="h-[760px] w-full max-w-[1040px] overflow-hidden rounded-xl border border-border bg-surface">
				<JiraSuggestion />
			</div>
		</div>
	);
}
