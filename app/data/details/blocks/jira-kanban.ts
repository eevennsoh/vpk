import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_KANBAN_DETAIL: ComponentDetail = {
	description:
		"Jira kanban board with Project Butter work-item cards, agent sessions, selection, and drag-and-drop. Includes the earlier standard and experimental variants.",
	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	importStatement: `import { JiraKanban } from "@/components/blocks/jira-kanban";`,
	usage: `import { JiraKanban } from "@/components/blocks/jira-kanban";

<JiraKanban boardColumns={columns} />
<JiraKanban variant="standard" boardColumns={columns} />`,
	examples: [
		{
			id: "project-butter",
			title: "Project butter",
			description: "The current Project Butter board, sharing the Jira Team EU26 kanban with Project Butter cards and agent sessions.",
			demoSlug: "jira-kanban-demo-project-butter",
		},
		{
			title: "Standard",
			description: "Current Jira kanban board: drag-and-drop columns, per-column agent assignment, assignee filtering, and the multi-select Jira Toolbar.",
			demoSlug: "jira-kanban-demo-standard",
		},
		{
			title: "Experimental",
			description: "The shared experimental board with its earlier issue-card appearance and simple column chrome.",
			demoSlug: "jira-kanban-demo-experimental",
		},
		{
			title: "Experimental v2",
			description: "Standalone fork of Experimental. Default chrome frames status headers and the Untracked title inside their wells. Use Default / Simple on the board to switch chrome.",
			demoSlug: "jira-kanban-demo-experimental-v2",
		},
		{
			title: "Experimental v2 simple",
			description: "Same v2 board, starting on simple chrome. Toggle back to Default on the board.",
			demoSlug: "jira-kanban-demo-experimental-v2-simple",
		},
		{
			title: "Empty columns",
			description: "Project Butter with To do, In progress, and Done empty beside a populated In review column, for checking zero-item column layout and resize controls.",
			demoSlug: "jira-kanban-demo-empty-columns",
		},
	],
	props: [
		{ name: "variant", type: '"standard" | "project-butter"', default: '"project-butter"', description: "Select the Project Butter board or the earlier standard board." },
		{ name: "cardAppearance", type: '"default" | "project-butter"', default: '"project-butter"', description: "Issue card presentation on the Project Butter board." },
		{ name: "columnChrome", type: '"default" | "simple"', description: "Expanded column backdrop. \"default\" is the sunken well. \"simple\" is no well. Omit for \"default\"." },
		{ name: "selectionToolbar", type: "JiraKanbanSelectionToolbarConfig", description: "Optional Jira Toolbar actions shown while controlled card selection is non-empty." },
	],
};
