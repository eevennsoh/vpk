export const JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS = 7;

export function getHeaderFacepileAssigneeLimit(showUnassignedAvatar = true): number {
	return JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS - (showUnassignedAvatar ? 1 : 0);
}

/**
 * Seven 24px avatars with six 6px overlaps occupy 132px. Board and Insights
 * share this exact geometry so swapping their rosters cannot move later tools.
 */
export const JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME =
	"w-33 shrink-0 items-center -space-x-1.5";
