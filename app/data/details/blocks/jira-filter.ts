import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_FILTER_DETAIL: ComponentDetail = {
	description:
		"A Jira filter popover with saved filter directories, basic field selection, advanced conditions, and a JQL editor. Conditions are controlled by the host; saved filters, pins, and recent selections live in the component for the current mount.",
	importStatement: `import { JiraFilter } from "@/components/blocks/jira-filter";`,
	usage: `<JiraFilter fields={fields} value={conditions} onChange={setConditions} initialSavedFilters={savedFilters} />`,
	demoLayout: { previewHeight: "fixed", previewContentWidth: "full" },
	props: [
		{
			name: "fields",
			type: "readonly JiraFilterField[]",
			required: true,
			description:
				"Available fields and their supported values. Set multiple for fields that accept more than one value.",
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
	],
};
