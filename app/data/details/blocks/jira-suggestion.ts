import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_SUGGESTION_DETAIL: ComponentDetail = {
	description: "Agent suggestions for an empty Jira work item, reviewed as a card stack in a lightweight popover over the work item. Each card is one suggested field value, shown in full and never truncated, with why it was suggested (sources, excerpts, confidence) on hover or focus. Swipe or press → to accept, ← to dismiss, or use the ✕/✓ buttons; Undo appears once there is a decision to undo. The rear cards are randomly fanned like Jira's kanban bulk-selection deck, fan out on hover, and unpack into a scrolling list whose lower cards scale up as they rise. Suggestions are ongoing: re-running the agent adds new cards marked New, and accepted values fill the Details rail.",
	importStatement: `import { JiraSuggestion } from "@/components/blocks/jira-suggestion";`,
	usage: `import { JiraSuggestion } from "@/components/blocks/jira-suggestion";

// Renders the work item context (main column + Details rail) with the
// suggestion trigger above Details and the card stack popover open over it.
// All data is synthetic and local; nothing is fetched or written.
<div className="h-[760px] w-[1040px]">
  <JiraSuggestion />
</div>`,
	demoLayout: { previewHeight: "fixed", previewContentWidth: "full" },
	props: [],
};
