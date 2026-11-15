import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_INLINE_CREATE_DETAIL: ComponentDetail = {
	apiName: "JiraInlineCreate",
	description: "An inline Jira work-item editor with an issue type, summary, parent, labels, subtasks, due date, priority and assignee. Enter saves the draft; Escape cancels. Parent and label pickers match the work-item details fields.",
	demoLayout: { previewHeight: "fit", examplesContentWidth: "full" },
	importStatement: `import { JiraInlineCreate } from "@/components/blocks/jira-inline-create";`,
	usage: `import { JiraInlineCreate } from "@/components/blocks/jira-inline-create";

<JiraInlineCreate
	columns={columns}
	issueKey="PAY-1000"
	onCancel={closeCreate}
	onSave={createWorkItem}
/>`,
	props: [
		{ name: "issueKey", type: "string", required: true, description: "The key shown for the new work item." },
		{ name: "columns", type: "readonly JiraKanbanColumnData[]", required: true, description: "Existing work items used to populate parent, labels, subtasks and assignee choices." },
		{ name: "assignees", type: "readonly JiraKanbanAssigneeData[]", description: "Additional people offered in the assignee picker." },
		{ name: "onSave", type: "(draft: JiraInlineCreateDraft) => void", required: true, description: "Receives the summary, issue type and chosen metadata when a nonempty summary is saved." },
		{ name: "onCancel", type: "() => void", required: true, description: "Closes the editor when Escape is pressed. Escape inside a picker closes that picker first." },
		{ name: "ref", type: "Ref<HTMLFormElement>", description: "Access to the editor form for host scrolling and placement." },
	],
};
