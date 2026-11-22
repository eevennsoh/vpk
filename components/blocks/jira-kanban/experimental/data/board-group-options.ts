/** Options used by the board controls and their standalone previews. */
export const BOARD_GROUP_OPTIONS = [
	{ id: "agent", label: "Agent" },
	{ id: "assignee", label: "Assignee" },
	{ id: "atlassian-project", label: "Atlassian Project" },
	{ id: "epic", label: "Epic" },
	{ id: "labels", label: "Labels" },
	{ id: "priority", label: "Priority" },
	{ id: "subtask", label: "Subtask" },
] as const;

export const BOARD_SWIMLANE_OPTIONS = BOARD_GROUP_OPTIONS.filter((option) => option.id !== "atlassian-project");
export const TABLE_WORK_ITEM_GROUP_OPTIONS = [
	{ id: "status", label: "Status" },
	{ id: "work-type", label: "Work type" },
	{ id: "parent", label: "Epic" },
	...BOARD_SWIMLANE_OPTIONS.filter((option) => option.id !== "epic"),
] as const;
export type BoardSwimlaneOptionId = (typeof TABLE_WORK_ITEM_GROUP_OPTIONS)[number]["id"] | (typeof BOARD_SWIMLANE_OPTIONS)[number]["id"];
export type BoardGroupOptionId = (typeof BOARD_GROUP_OPTIONS)[number]["id"] | BoardSwimlaneOptionId;

/**
 * Empty on purpose: the View menu opens with no grouping selected. The radio
 * group still accepts a later pick; nothing matches this value, so no row
 * starts checked.
 */
export const BOARD_GROUP_DEFAULT_ID = "" as const;
