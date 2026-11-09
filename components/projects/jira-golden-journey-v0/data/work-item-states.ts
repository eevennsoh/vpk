import type { JiraWorkItemExperimentalPreset } from "@/components/blocks/jira-work-item";

export const WORK_ITEM_STATES: readonly {
	label: string;
	value: JiraWorkItemExperimentalPreset;
}[] = [
	{ label: "Empty", value: "blank" },
	{ label: "Suggestions", value: "empty" },
	{ label: "Running", value: "running" },
	{ label: "Done", value: "filled" },
];
