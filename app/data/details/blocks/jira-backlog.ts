import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_BACKLOG_DETAIL: ComponentDetail = {
	description: "Plan sprints and triage backlog work in the Project Butter List style. Drag the sprint boundary across rows to move work in or out, or click it for move actions.",
	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	importStatement: `import { JiraBacklog } from "@/components/blocks/jira-backlog";`,
	usage: `<JiraBacklog sprints={sprints} backlog={backlog} people={people} onStatusChange={updateStatus} />`,
	props: [
		{ name: "sprints", type: "readonly JiraBacklogSection[]", required: true, description: "Sprint sections and their ordered work items." },
		{ name: "backlog", type: "readonly JiraBacklogItem[]", required: true, description: "Work items outside a sprint." },
		{ name: "sprintBoundary", type: "{ sprintId: string; onMove: (move: JiraBacklogSprintMove) => void }", description: "Enables the boundary between the running sprint and backlog. Put the running sprint last. Apply the reported item IDs to the destination in order." },
		{ name: "people", type: "readonly JiraListPerson[]", description: "Available assignees. The first six appear in the quick filters." },
		{ name: "agentCatalog", type: "readonly AgentSelectorAgent[]", description: "Overrides the agent picker roster. Each work item can carry its own agentSessions." },
		{ name: "statusOptions", type: "readonly JiraListStatusOption[]", description: "Sets the workflow statuses and their lozenge colors in the row menu and filter." },
		{ name: "onAssignedAgentIdsChange", type: "(issueKey: string, agentIds: readonly string[]) => void", description: "Enables the Add agent picker and reports the selected agent IDs." },
		{ name: "onAssignedAgentSelect", type: "(issueKey: string, agent: JiraListAssignedAgent) => void", description: "Called when someone opens an existing session from its row menu." },
		{ name: "onIssueClick", type: "(item: JiraBacklogItem) => void", description: "Opens a work item." },
		{ name: "onStatusChange", type: "(id: string, status: JiraBacklogStatus) => void", description: "Updates a work item's status." },
		{ name: "onAssigneeChange", type: "(id: string, person: JiraListPerson | undefined) => void", description: "Updates a work item's assignee." },
		{ name: "onSelectionChange", type: "(ids: ReadonlySet<string>) => void", description: "Reports selected work item IDs." },
		{ name: "onCreate", type: "(draft: JiraBacklogInlineCreate) => void", description: "Creates a work item at a row boundary or in an empty section. Tab indents the draft and Shift+Tab outdents it." },
		{ name: "onReorder", type: "(sectionId: string, issueKeys: readonly string[]) => void", description: "Applies a row reorder within a sprint or backlog section." },
		{ name: "onSprintAction", type: "(sectionId: string) => void", description: "Handles the sprint or backlog action." },
	],
};
