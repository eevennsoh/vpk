import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_LIST_DETAIL: ComponentDetail = {
	description:
		"Compact Jira list view with hierarchical work rows, agent sessions, editable summaries and points, status, assignees, labels, and sticky footer actions.",
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { JiraList } from "@/components/blocks/jira-list";`,
	usage: `import { JiraList } from "@/components/blocks/jira-list";

<JiraList
  rows={[
    {
      issueKey: "PAY-118",
      summary: "Carry card-artwork metadata into the next wallet epic",
      issueType: "task",
      priority: "medium",
      status: "To do",
      statusVariant: "neutral",
    },
  ]}
/>`,
	props: [
		{ name: "rows", type: "readonly JiraListRowData[]", required: true, description: "Visible Jira list rows, already ordered for display." },
		{ name: "selectedIssueKeys", type: "ReadonlySet<string>", description: "Set of selected issue keys used to render checkbox and row selected state." },
		{ name: "onSelectRow", type: '(issueKey: string, checked: boolean) => void', description: "Called when a row checkbox changes." },
		{ name: "onSelectAllRows", type: '(checked: boolean) => void', description: "Called when the header checkbox changes." },
		{ name: "onToggleExpand", type: '(issueKey: string) => void', description: "Called when a parent row expand or collapse control is activated." },
		{ name: "onIssueClick", type: '(row: JiraListRowData) => void', description: "Called when the summary text is activated." },
		{ name: "onIssueKeyClick", type: '(row: JiraListRowData) => void', description: "Called when the issue key link is activated." },
		{ name: "onCreate", type: '(insertion?: JiraListInsertion) => void', description: "Creates a work item from the footer or a row boundary. Omit it to remove Create controls." },
		{ name: "onRefresh", type: "() => void", description: "Refreshes the list. Omit it to remove the footer refresh action." },
		{ name: "visibleCount", type: "number", default: "rows.length", description: "Visible issue count shown in the sticky footer." },
		{ name: "totalCountLabel", type: "string", default: "rows.length as text", description: "Total issue count label shown in the sticky footer." },
	],
};
