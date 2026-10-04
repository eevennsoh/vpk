export const JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS = 7;

export function getHeaderFacepileAssigneeLimit(
	showUnassignedAvatar = true,
	maxItems = JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS,
): number {
	return Math.max(0, maxItems - (showUnassignedAvatar ? 1 : 0));
}

/** 24px avatars with 6px overlap, matching the shared AvatarGroup classes. */
export function getHeaderFacepileWidth(maxItems: number): number {
	return maxItems > 0 ? 24 + (maxItems - 1) * 18 : 0;
}

/**
 * Seven 24px avatars with six 6px overlaps occupy 132px. Board and Insights
 * share this exact geometry so swapping their rosters cannot move later tools.
 */
export const JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME =
	"w-33 shrink-0 items-center -space-x-1.5";
