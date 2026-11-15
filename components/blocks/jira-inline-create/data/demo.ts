import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

export const JIRA_INLINE_CREATE_DEMO_COLUMNS: readonly JiraKanbanColumnData[] = [{
	title: "To do",
	count: 3,
	cards: [
		{ code: "PAY-100", title: "Payments SDK v2 migration", issueType: "epic", priority: "major", tags: [{ text: "payments", color: "standard" }], assignee: { id: "venn", name: "Venn" } },
		{ code: "PAY-118", title: "Carry card artwork into the next wallet", issueType: "task", parentIssueKey: "PAY-100", priority: "medium", tags: [{ text: "wallet", color: "standard" }], assignee: { id: "maya", name: "Maya Ferreira" } },
		{ code: "PAY-124", title: "Confirm the account allow-list", issueType: "task", parentIssueKey: "PAY-100", priority: "medium", tags: [{ text: "rollout", color: "standard" }] },
	],
}];
