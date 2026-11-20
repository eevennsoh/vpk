import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_WORK_ITEM_TIMELINE_DETAIL: ComponentDetail = {
	description: "A sticky activity header with a scrubbable timeline. Hover or focus a stop to preview its entry, drag or select a stop to navigate, and scroll the feed to move the playhead.",
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { JiraWorkItemTimeline, useJiraWorkItemTimelineNavigation } from "@/components/blocks/jira-work-item-timeline";`,
	usage: `const navigation = useJiraWorkItemTimelineNavigation(rows);

<JiraWorkItemTimeline
  rows={rows}
  visibleId={navigation.visibleId}
  progress={navigation.progress}
  onSelect={navigation.scrollToEntry}
  onSeek={navigation.seekToProgress}
  stuck={navigation.stuck}
  ref={navigation.headerRef}
/>
<div ref={navigation.feedRef}>
  <JiraActivity entries={rows} hideHeader composer={null} />
</div>`,
	props: [
		{ name: "rows", type: "readonly JiraActivityEntry[]", required: true, description: "Entries in their rendered order, with one stop per visible row." },
		{ name: "visibleId", type: "string | null", required: true, description: "ID of the row at the reading position." },
		{ name: "progress", type: "MotionValue<number>", required: true, description: "Continuous playhead position from 0 to 1." },
		{ name: "onSelect", type: "(id: string) => void", required: true, description: "Navigates to a selected row." },
		{ name: "onSeek", type: "(progress: number) => void", required: true, description: "Seeks continuously as the user drags." },
		{ name: "getPreviewLabel", type: "(entry: JiraActivityEntry) => string", default: "entry.timestamp", description: "Formats the label shown when a stop is hovered or focused." },
		{ name: "stuck", type: "boolean", default: "false", description: "Marks the header as sticky and shows headerTime when supplied." },
		{ name: "headerTime", type: "string", description: "Relative time shown in place of the visible heading while stuck." },
		{ name: "actions", type: "ReactNode", description: "Optional trailing controls, such as the activity filter." },
	],
	subComponents: [{ name: "useJiraWorkItemTimelineNavigation", description: "Connects the header and the Jira Activity feed to their nearest scrollable ancestor. Attach headerRef and feedRef, and pass the same rows in their rendered order. Optional focusId, layoutKey and viewKey synchronize external focus and layout changes." }],
};
