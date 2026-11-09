import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_INSIGHT_DETAIL: ComponentDetail = {
	description:
		"A decision-focused Jira work-item briefing with a current summary, sourced checkpoints on the shared Jira Activity spine, unread selection state, and a dockable timeline scrubber.",
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { JiraInsight } from "@/components/blocks/jira-insight";`,
	usage: `import { JiraInsight } from "@/components/blocks/jira-insight";
import { JIRA_INSIGHT_DEMO_SNAPSHOT } from "@/components/blocks/jira-insight/data";

<JiraInsight snapshot={JIRA_INSIGHT_DEMO_SNAPSHOT} />`,
	props: [
		{
			name: "snapshot",
			type: "JiraInsightSnapshot",
			required: true,
			description: "Summary, ordered decision checkpoints, unread checkpoint ids, and the reset revision.",
		},
		{
			name: "onSourceSelect",
			type: "(source: JiraInsightSource) => void",
			description: "Handles in-product work-item, activity, agent-session, and pull-request sources. External links navigate directly.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the standalone block container.",
		},
	],
	subComponents: [
		{
			name: "JiraInsightProvider",
			description: "Shares selection, unread state, source handling, and checkpoint element registration across split layout slots.",
			props: [],
		},
		{
			name: "JiraInsightContent",
			description: "Standalone summary and Jira Activity-backed decision timeline composition.",
			props: [],
		},
		{
			name: "JiraInsightScrubber",
			description: "Connects provider selection to the horizontal Activity/decision timeline rail.",
			props: [],
		},
		{
			name: "JiraInsightTimelineRail",
			description: "Scrollable horizontal chronology with Activity ticks, decision landmarks, hover tooltips, drag, wheel, and keyboard navigation.",
			props: [],
		},
		{
			name: "JiraInsightEditorialPane",
			description: "Selected-decision editorial summary with adjacent navigation, sources, and metadata.",
			props: [],
		},
	],
};
