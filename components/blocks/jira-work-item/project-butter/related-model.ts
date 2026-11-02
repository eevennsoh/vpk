import type { PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";

export type ProjectButterRelatedStatus = "To do" | "In progress" | "In review" | "Done";
export interface ProjectButterRelatedItem {
	id: string;
	key: string;
	summary: string;
	priority: PriorityValue;
	assignee: string;
	status: ProjectButterRelatedStatus;
	relationship?: string;
	dueDate?: string;
	estimate?: string;
	labels?: readonly string[];
	createdAt?: string;
}

export type ProjectButterRelatedAddRequest =
	| { kind: "create"; summary: string; relationship?: string }
	| { kind: "existing"; item: ProjectButterRelatedItem; relationship?: string };

export type ProjectButterRelatedSearchItem = ProjectButterRelatedItem & {
	workType: "Epic" | "Story" | "Task" | "Bug" | "Subtask";
};

export const RELATED_SORT_OPTIONS = [
	{ value: "rank", label: "Rank" }, { value: "created", label: "Created" },
	{ value: "key", label: "Key" }, { value: "priority", label: "Priority" },
	{ value: "status", label: "Status" }, { value: "assignee", label: "Assignee" },
] as const;

export const RELATED_DISPLAY_PROPERTIES = [
	{ id: "priority", label: "Priority" }, { id: "id", label: "Key" },
	{ id: "status", label: "Status" }, { id: "labels", label: "Labels" },
	{ id: "dueDate", label: "Due date" }, { id: "estimate", label: "Estimate" },
	{ id: "assignee", label: "Assignee" },
] as const;

export type ProjectButterRelatedSort = typeof RELATED_SORT_OPTIONS[number]["value"];
export type ProjectButterRelatedField = typeof RELATED_DISPLAY_PROPERTIES[number]["id"];
export type ProjectButterRelatedFields = Readonly<Record<ProjectButterRelatedField, boolean>>;
export interface ProjectButterRelatedListEditor {
	expanded: boolean;
	composerOpen: boolean;
	query: string;
	relationship: string;
	editingId: string | null;
	summaryDrafts: Readonly<Record<string, string>>;
	hideDone: boolean;
	sortBy: ProjectButterRelatedSort | null;
	sortAscending: boolean;
	visibleFields: ProjectButterRelatedFields;
}

export function createProjectButterRelatedListEditor(): ProjectButterRelatedListEditor {
	return {
		expanded: false, composerOpen: false, query: "", relationship: "Clones", editingId: null,
		summaryDrafts: {}, hideDone: false, sortBy: null, sortAscending: true,
		visibleFields: { status: true, id: true, labels: false, dueDate: false, estimate: false, priority: true, assignee: true },
	};
}

export function createProjectButterRelatedEditorState() {
	return { children: createProjectButterRelatedListEditor(), linked: createProjectButterRelatedListEditor() };
}

export function relatedWorkItemKey(text: string): string | undefined {
	return text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i)?.[1].toUpperCase();
}

export function relatedSearchText(text: string): string {
	return /https?:|\/browse\/|\/jira\//i.test(text) ? relatedWorkItemKey(text) ?? text.trim() : text.trim();
}

export function orderRelatedItems(items: readonly ProjectButterRelatedItem[], editor: ProjectButterRelatedListEditor) {
	const shown = editor.hideDone ? items.filter((item) => item.status !== "Done") : [...items];
	const sortBy = editor.sortBy;
	if (!sortBy || sortBy === "rank") return editor.sortAscending ? shown : [...shown].reverse();
	const priorities = { Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 };
	const valueFor = (item: ProjectButterRelatedItem) => sortBy === "priority" ? priorities[item.priority] : sortBy === "created" ? item.createdAt ?? "" : item[sortBy];
	return [...shown].sort((left, right) => {
		const a = valueFor(left);
		const b = valueFor(right);
		const comparison = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "en-US", { numeric: true });
		return comparison * (editor.sortAscending ? 1 : -1);
	});
}
