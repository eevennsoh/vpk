import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_FILTER_DETAIL: ComponentDetail = {
	description:
		"A Jira filter in tabbed and compact Project butter variants, with saved filters, field selection, advanced conditions, and a JQL editor. Conditions are controlled by the host; saved filters, pins, and recent selections live in the component for the current mount.",
	importStatement: `import { JiraFilter } from "@/components/blocks/jira-filter";`,
	usage: `<JiraFilter fields={fields} value={conditions} onChange={setConditions} initialSavedFilters={savedFilters} />`,
	demoLayout: { previewHeight: "fixed", previewContentWidth: "full" },
	examples: [
		{ id: "default", title: "Default", description: "Tabbed saved, basic, advanced, and JQL filter modes.", demoSlug: "jira-filter-demo-default" },
		{ id: "project-butter", title: "Project butter", description: "Compact board filter with pinned shortcuts, field flyouts, saved filters and JQL.", demoSlug: "jira-filter-demo-project-butter" },
	],
	props: [
		{ name: "variant", type: '"default" | "project-butter"', default: '"default"', description: "Choose the tabbed filter or the compact Project butter menu." },
		{
			name: "fields",
			type: "readonly JiraFilterField[]",
			required: true,
			description:
				"Available fields and their supported values. Set multiple for fields that accept more than one value. Project butter initially shows agentStatus, prStatus, assignee, fixVersion, epic, sprint, type, label and status when supplied; other fields can be added through search.",
		},
		{
			name: "value",
			type: "readonly JiraFilterCondition[]",
			required: true,
			description: "The active conditions, owned by the host.",
		},
		{
			name: "onChange",
			type: "(conditions: JiraFilterCondition[]) => void",
			required: true,
			description:
				"Receives applied conditions, including an empty array when cleared.",
		},
		{
			name: "initialSavedFilters",
			type: "readonly JiraSavedFilter[]",
			description:
				"Initial team, personal, and default filters. IDs must be unique.",
		},
		{
			name: "initialRecentFilterIds",
			type: "readonly string[]",
			description: "Initial recent filter IDs, in display order.",
		},
		{
			name: "onSavedFiltersChange",
			type: "(filters: readonly JiraSavedFilter[]) => void",
			description:
				"Reports saved-filter additions and deletions for persistence by the host.",
		},
		{ name: "onSaveView", type: "(conditions: readonly JiraFilterCondition[]) => void", description: "Receives the current conditions when Save view is selected in Project butter." },
		{ name: "onSaveAsView", type: "(name: string, conditions: readonly JiraFilterCondition[]) => void", description: "Receives the name and conditions of a new Project butter view." },
	],
};
