import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_TOOLBAR_DETAIL: ComponentDetail = {
	description:
		"Floating Jira bulk-action toolbar with Select all, Add agent, and Ask Rovo. Status changes, deletion, and secondary actions live in the overflow menu; presence transitions honor reduced motion.",
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { JiraToolbar } from "@/components/blocks/jira-toolbar";`,
	props: [
		{ name: "onSelectAll", type: "() => void", description: "Selects every visible work item. The action is disabled without this capability." },
		{ name: "onAskRovo", type: "() => void", description: "Overrides the Rovo launcher. By default opens the workspace chat, or navigates to /rovo in standalone demos." },
		{ name: "selectedCount", type: "number", required: true, description: "Number of selected Jira work items; zero hides the toolbar." },
		{ name: "agents", type: "readonly JiraToolbarAgent[]", required: true, description: "Agents displayed in the shared Agent Selector." },
		{ name: "selectedAgentIds", type: "readonly string[]", default: "[]", description: "Agents assigned to every selected work item." },
		{ name: "statusOptions", type: "readonly string[]", required: true, description: "Available Jira statuses in menu order." },
		{ name: "selectedStatus", type: "string | null", description: "Common status for all selected work items, or null for mixed statuses." },
		{ name: "onAgentAssignmentChange", type: "(agentId: string, assigned: boolean) => void", required: true, description: "Adds or removes an agent across the selected work items." },
		{ name: "onStatusChange", type: "(status: string) => void", required: true, description: "Changes the selected work items to a Jira status." },
		{ name: "onClearSelection", type: "() => void", required: true, description: "Clears selection and dismisses the toolbar." },
		{ name: "dismissOnEscape", type: "boolean", default: "true", description: "Handles Escape in the toolbar. Set false when the owning board provides scoped popup, drag, and selection dismissal." },
	],
};
