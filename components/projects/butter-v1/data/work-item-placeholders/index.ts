import type { ProjectButterPlaceholderMap } from "@/components/blocks/jira-work-item/project-butter/placeholder-fill";
import { BUTTER_DONE_PLACEHOLDERS } from "./done";
import { BUTTER_IN_PROGRESS_PLACEHOLDERS } from "./in-progress";
import { BUTTER_IN_REVIEW_PLACEHOLDERS } from "./in-review";
import { BUTTER_TODO_PLACEHOLDERS } from "./todo";
import type { ButterPlaceholderMap } from "./types";

export const BUTTER_WORK_ITEM_PLACEHOLDERS = {
	...BUTTER_TODO_PLACEHOLDERS,
	...BUTTER_IN_PROGRESS_PLACEHOLDERS,
	...BUTTER_IN_REVIEW_PLACEHOLDERS,
	...BUTTER_DONE_PLACEHOLDERS,
} satisfies ButterPlaceholderMap & ProjectButterPlaceholderMap;
