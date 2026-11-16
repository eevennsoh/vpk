import type { ProjectButterRelatedFields } from "@/components/blocks/jira-work-item/project-butter/related-model";

export type RelatedTableColumnId = "relationship" | "work" | "actions" | Exclude<keyof ProjectButterRelatedFields, "id">;

export interface RelatedTableColumn {
	id: RelatedTableColumnId;
	label: string;
	width: number;
	hideLabel?: boolean;
}

const OPTIONAL_COLUMNS = ["status", "assignee", "priority", "labels", "dueDate", "estimate"] as const;
const COLUMNS: Readonly<Record<RelatedTableColumnId, Omit<RelatedTableColumn, "id">>> = {
	relationship: { label: "Relationship", width: 120 },
	work: { label: "Work", width: 224 },
	status: { label: "Status", width: 144 },
	assignee: { label: "Assignee", width: 214 },
	priority: { label: "Priority", width: 80 },
	labels: { label: "Labels", width: 128 },
	dueDate: { label: "Due date", width: 96 },
	estimate: { label: "Estimate", width: 72 },
	actions: { label: "Actions", width: 40, hideLabel: true },
};

export function relatedTableColumns(fields: ProjectButterRelatedFields, linked: boolean): RelatedTableColumn[] {
	const ids: RelatedTableColumnId[] = [
		...(linked ? ["relationship" as const] : []),
		"work",
		...OPTIONAL_COLUMNS.filter((id) => fields[id]),
		...(linked ? [] : ["actions" as const]),
	];
	return ids.map((id) => ({ id, ...COLUMNS[id], ...(id === "assignee" && !linked ? { width: 56, hideLabel: true } : {}) }));
}
