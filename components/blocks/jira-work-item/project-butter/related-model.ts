import type { PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";

export type ProjectButterRelatedStatus = "To do" | "In progress" | "In review" | "Done";
export interface ProjectButterRelatedItem {
	key: string;
	summary: string;
	priority: PriorityValue;
	assignee: string;
	status: ProjectButterRelatedStatus;
	relationship?: string;
}
