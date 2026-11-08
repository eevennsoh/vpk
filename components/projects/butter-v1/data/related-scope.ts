// Butter board -> Project Butter related-work scope. Type-only `@/` imports, so node:test can load it directly.
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { ProjectButterRelatedSearchItem, ProjectButterRelatedStatus, ProjectButterRelatedWorkType } from "@/components/blocks/jira-work-item/project-butter/related-model";

const WORK_TYPES: Readonly<Record<NonNullable<JiraKanbanCardData["issueType"]>, ProjectButterRelatedWorkType>> = {
	bug: "Bug",
	epic: "Epic",
	story: "Story",
	subtask: "Subtask",
	task: "Task",
};

const PRIORITIES: Readonly<Record<JiraKanbanCardData["priority"], ProjectButterRelatedSearchItem["priority"]>> = {
	critical: "Highest",
	major: "High",
	medium: "Medium",
	minor: "Low",
};

/** A board card's work type; cards without one are Tasks. */
export function butterWorkType(card: Pick<JiraKanbanCardData, "issueType">): ProjectButterRelatedWorkType {
	return card.issueType ? WORK_TYPES[card.issueType] : "Task";
}

/** Folds a workflow status or column title into the three related-work statuses. */
export function butterRelatedStatus(status: string): ProjectButterRelatedStatus {
	const value = status.toLowerCase();
	if (/\b(done|closed|resolved|complete|shipped)\b/.test(value)) return "Done";
	if (/\b(progress|review|testing|qa|doing|blocked)\b/.test(value)) return "In progress";
	return "To do";
}

/** Every board card as a related-work match, so the composers find and open this project's items. */
export function butterRelatedCatalog(columns: readonly Pick<JiraKanbanColumnData, "cards" | "title">[]): ProjectButterRelatedSearchItem[] {
	return columns.flatMap((column) => column.cards.map((card): ProjectButterRelatedSearchItem => ({
		id: `board-${card.code}`,
		key: card.code,
		summary: card.title,
		status: butterRelatedStatus(card.status ?? column.title),
		priority: PRIORITIES[card.priority],
		assignee: card.assignee?.name ?? "Unassigned",
		workType: butterWorkType(card),
	})));
}
