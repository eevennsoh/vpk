import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_WORK_ITEM_DETAIL: ComponentDetail = {
	description: "Jira work-item surface with a standard current-state variant, independently versioned experimental forks, and the Project butter agent-session layout.",
	importStatement: `import JiraWorkItem from "@/components/blocks/jira-work-item";`,
	usage: `import JiraWorkItem from "@/components/blocks/jira-work-item";

<JiraWorkItem variant="experimental" initialExperimentalPreset="running" />`,
	examples: [
		{
			title: "Standard",
			description: "Current Jira agent sessions surface with the work item modal trigger and floating Rovo chat.",
			demoSlug: "jira-work-item-demo-standard",
		},
		{
			title: "Experimental",
			description: "Compare the filled, empty, and multiple-agents-running states within the original experimental work-item surface.",
			demoSlug: "jira-work-item-demo-experimental",
		},
		{
			title: "Experimental v2",
			description: "Compare the filled, empty, and multiple-agents-running states within the independently owned v2 surface.",
			demoSlug: "jira-work-item-demo-experimental-v2",
		},
		{
			title: "Experimental v3",
			description: "Compare the filled, empty, and multiple-agents-running states within the independently owned v3 surface.",
			demoSlug: "jira-work-item-demo-experimental-v3",
		},
		{
			title: "Experimental v4",
			description: "Compare the filled, empty, and multiple-agents-running states within the independently owned v4 surface.",
			demoSlug: "jira-work-item-demo-experimental-v4",
		},
		{
			title: "Experimental v5",
			description: "Compare the filled, empty, and multiple-agents-running states within the independently owned v5 surface.",
			demoSlug: "jira-work-item-demo-experimental-v5",
		},
		{
			title: "Team EU26",
			description: "Compare the content-rich VITA-1 work item with its sparse empty state in one Team EU26 demo.",
			demoSlug: "jira-work-item-demo-team-eu26",
		},
		{
			title: "Project butter",
			id: "project-butter",
			description: "Open Project butter in full screen, a modal, or a side panel. Toggle Empty or Suggestion before opening, or through the global header Settings cog.",
			demoSlug: "jira-work-item-demo-project-butter",
		},
	],
	props: [
		{
			name: "projectButterPresentation",
			type: "\"full-screen\" | \"modal\" | \"side-panel\"",
			default: "\"full-screen\"",
			description: "Initial Project butter presentation. The global Settings cog switches presentation, Empty, and Suggestion without discarding drafts.",
		},
		{
			name: "initialIssueOpen",
			type: "boolean",
			default: "false",
			description: "Opens the Jira work item modal on initial render.",
		},
		{
			name: "onIssueClose",
			type: "() => void",
			description: "Called after the Jira work item modal closes.",
		},
		{
			name: "variant",
			type: "\"default\" | \"experimental\" | \"experimental-v2\" | \"experimental-v3\" | \"experimental-v4\" | \"experimental-v5\" | \"team-eu26\" | \"project-butter\"",
			default: "\"default\"",
			description: "Opt-in layout variation with independently owned component trees.",
		},
		{
			name: "projectButterSuggestion",
			type: "boolean",
			default: "false",
			description: "Opens the Project butter variant in the suggestion state. Teamwork Graph proposes values for empty details fields, which can be accepted one at a time or all at once.",
		},
		{
			name: "initialExperimentalPreset",
			type: "\"blank\" | \"empty\" | \"filled\" | \"running\"",
			default: "\"filled\"",
			description: "Deterministic starting state for the experimental variants: true empty context, AI-planned suggestions, filled context, or filled context with concurrent running agents.",
		},
	],
};
