import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_KANBAN_DETAIL: ComponentDetail = {
	description:
		"Enterprise RFP Jira kanban board with drag-and-drop work-item cards, agent assignment controls, tags, priority signals, avatar ownership, multi-select drag support, and optional Jira Toolbar actions. Ships a standard variant plus independently owned experimental variants.",
	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	importStatement: `import { JiraKanban } from "@/components/blocks/jira-kanban";`,
	usage: `import JiraKanbanPage from "@/components/blocks/jira-kanban/page";
import ExperimentalJiraKanbanPage from "@/components/blocks/jira-kanban/experimental/page";
import ExperimentalV2JiraKanbanPage from "@/components/blocks/jira-kanban/experimental-v2/page";`,
	examples: [
		{
			title: "Standard",
			description: "Current Jira kanban board: drag-and-drop columns, per-column agent assignment, assignee filtering, and the multi-select Jira Toolbar.",
			demoSlug: "jira-kanban-demo-standard",
		},
		{
			title: "Experimental",
			description: "Standalone fork of the standard board that starts identical to it. Owns its own board, header, and page tree so experimental changes never touch the default variant; shares the board state helpers and data contracts.",
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
			description: "Experimental v2 with To do, In progress, and Done empty beside a populated In review column, for checking zero-item column layout and resize controls.",
			demoSlug: "jira-kanban-demo-empty-columns",
		},
	],
	props: [
		{ name: "cardAppearance", type: '"default" | "project-butter"', default: '"default"', description: "Experimental board/page only. Forward the selected JiraIssue presentation to every card while preserving board data, selection, dragging and agent sessions. Butter opts into project-butter." },
		{ name: "columnChrome", type: '"default" | "simple"', description: "Expanded column backdrop. \"default\" is the sunken well. \"simple\" is no well. Omit for \"default\"." },
		{ name: "selectionToolbar", type: "JiraKanbanSelectionToolbarConfig", description: "Optional Jira Toolbar actions shown while controlled card selection is non-empty." },
	],
};
