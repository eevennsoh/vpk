import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_LIST_DETAIL: ComponentDetail = {
	description:
		"Jira list view with the default borderless Project Butter presentation and the earlier Classic table with row and column separators. Both support hierarchical work rows, editable fields, agent sessions, and sticky footer actions.",
	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	importStatement: `import { JiraList } from "@/components/blocks/jira-list";`,
	usage: `import { JiraList, type JiraListRowData } from "@/components/blocks/jira-list";

const rows: JiraListRowData[] = [
  {
    issueKey: "PAY-118",
    summary: "Carry card-artwork metadata into the next wallet epic",
    issueType: "task",
    priority: "medium",
    status: "To do",
    statusVariant: "neutral",
  },
];

<JiraList rows={rows} />
<JiraList variant="classic" rows={rows} />`,
	examples: [
		{ id: "project-butter", title: "Project Butter", description: "The current Butter v1 list, without an outer frame or cell separators.", demoSlug: "jira-list-demo-project-butter" },
		{ id: "classic", title: "Classic", description: "The earlier Jira table with an outer frame and horizontal and vertical cell separators.", demoSlug: "jira-list-demo-classic" },
	],
	props: [
		{ name: "variant", type: '"project-butter" | "classic"', default: '"project-butter"', description: "Use the current Project Butter list or the traditional Classic table." },
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
