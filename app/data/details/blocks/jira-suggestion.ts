import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_SUGGESTION_DETAIL: ComponentDetail = {
	description: "Review suggested field values for a Jira work item. Menu opens a card stack beside Details, with source explanations, swipe and keyboard actions, and a list view. Use Check again to look for new suggestions. Floating opens from the Rovo launcher, pauses on the fanned stack, then unfolds into a list. Accepting a suggestion fills the corresponding field.",
	importStatement: `import { JiraFloatingSuggestions, JiraSuggestion } from "@/components/blocks/jira-suggestion";`,
	usage: `import { JiraSuggestion } from "@/components/blocks/jira-suggestion";

// Menu preview with a sample Jira work item and the suggestion stack open.
<div className="h-[760px] w-[1040px]">
  <JiraSuggestion />
</div>`,
	demoLayout: { previewHeight: "fixed", previewContentWidth: "full" },
	props: [],
	subComponents: [
		{
			name: "JiraFloatingSuggestions",
			description: "The Floating variant. Render it inside a RovoChatProvider and pass the work item's suggestion feed.",
			props: [
				{ name: "feed", type: "SuggestionFeed", required: true, description: "Supply suggestions and handle review decisions for the current work item." },
				{ name: "workItemKey", type: "string", required: true, description: "Show the current Jira work item key in the panel title." },
				{ name: "portalContainer", type: "HTMLElement", description: "Anchor the launcher and review panel inside a positioned container. Omit it to float over the viewport." },
				{ name: "ref", type: "Ref<{ reopen: () => true }>", description: "Call reopen() from a host action to return to the review and restore dismissed suggestions." },
			],
		},
	],
};
