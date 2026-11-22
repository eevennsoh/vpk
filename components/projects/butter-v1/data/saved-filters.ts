import type { JiraSavedFilter } from "@/components/blocks/jira-filter";

export const BUTTER_SAVED_FILTERS = [
	{ id: "open-pull-requests", name: "Open pull requests", group: "personal", conditions: [{ field: "prStatus", operator: "is", values: ["open"] }] },
	{ id: "reviews-needing-input", name: "Reviews needing agent input", group: "personal", conditions: [{ field: "status", operator: "is", values: ["in-review"] }, { field: "agentStatus", operator: "is", values: ["needsInput"] }] },
	{ id: "tasks-in-progress", name: "Tasks in progress", group: "personal", conditions: [{ field: "status", operator: "is", values: ["in-progress"] }, { field: "type", operator: "is", values: ["task"] }] },
	{ id: "priyas-work", name: "Priya’s work", group: "personal", conditions: [{ field: "assignee", operator: "is", values: ["priya-raman"] }] },
] as const satisfies readonly JiraSavedFilter[];
