import type { JiraKanbanAssigneeData } from "@/components/blocks/jira-kanban";

/** Prototype "me" — same face as TopNavigation, and the drag-to-create assignee. */
export const JIRA_GOLDEN_JOURNEY_V4_PAY_CURRENT_USER = {
	id: "venn",
	name: "Venn",
	avatarSrc: "/avatar-user/venn/venn.png",
} as const satisfies JiraKanbanAssigneeData;
