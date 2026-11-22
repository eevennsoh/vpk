import type { JiraKanbanAssigneeData } from "@/components/blocks/jira-kanban";

/** Prototype "me" — same face as TopNavigation, and the drag-to-create assignee. */
export const BUTTER_PAY_CURRENT_USER = {
	id: "venn",
	name: "Venn",
	avatarSrc: "/avatar-user/venn/venn.png",
} as const satisfies JiraKanbanAssigneeData;

export const BUTTER_DEFAULT_REPORTER = { name: BUTTER_PAY_CURRENT_USER.name, avatarUrl: BUTTER_PAY_CURRENT_USER.avatarSrc };
