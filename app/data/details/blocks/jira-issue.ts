import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_ISSUE_DETAIL: ComponentDetail = {
	description:
		"Compact Jira issue card for kanban boards, with summary text, issue key, tags, priority signal, assignee avatar, selected state, drag affordance, subtasks, and parent epic composition.",
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { JiraIssue } from "@/components/blocks/jira-issue";`,
	usage: `import { JiraIssue } from "@/components/blocks/jira-issue";

<JiraIssue
  issueKey="RFP-101"
  summary="Acmecorp: Prepare for bid recommendation for ESM RFP"
  tags={[
    { text: "Acmecorp", color: "discovery" },
    { text: "qualification", color: "blue" },
    { text: "enterprise", color: "discovery" },
  ]}
  priority="major"
  assigneeAvatarSrc="/avatar-user/andrea-wilson/color/asow-service-yellow.png"
/>`,
	examples: [
		{ title: "Experimental", description: "Issue card with the stroke-only visual treatment used by the experimental Jira Kanban.", demoSlug: "jira-issue-demo-experimental" },
		{ title: "Uncaptured work", description: "GitHub PRs, branches, and commits discovered outside Jira, with source context, a suggested Link to work item button, and trailing Create work item and Subtasks icons.", demoSlug: "jira-issue-demo-uncaptured-work" },
		{ title: "Subtasks collapsed", description: "Issue card with a collapsed nested subtasks row.", demoSlug: "jira-issue-demo-subtasks-collapsed" },
		{ title: "Subtasks expanded", description: "Expanded subtasks with nested issue cards.", demoSlug: "jira-issue-demo-subtasks-expanded" },
		{ title: "Parent epic", description: "Issue card with a parent epic selector embedded through the Jira epic block.", demoSlug: "jira-issue-demo-parent-epic" },
		{ title: "Agent activity states", description: "Interactive issue card states for agents working, awaiting input, and completed work.", demoSlug: "jira-issue-demo-agent-activity-states" },
		{ id: "agent-activity-states-experimental", title: "Agent activity states (experimental)", description: "Agent activity uses the same merged chin and shared flyout for one or many attached sessions, matching the Jira Team EU26 experience. The transfer phases show unlinking a session, keeping one running session with two detached sessions, and linking or dragging those sessions back onto the card.", demoSlug: "jira-issue-demo-agent-activity-states-experimental" },
		{ id: "agent-activity-states-experimental-v2", title: "Agent activity states (experimental v2)", description: "Same merged-chin playground as the experimental agent activity states, with 16px issue-type, priority, and subtask icons, 24px avatars, and nested subtask cards that stay stroke regardless of the parent Raised/Stroke toggle. Expired shows an expired session beside active and private sessions, with the 28-day row tooltip and a Delete-only menu.", demoSlug: "jira-issue-demo-agent-activity-states-experimental-v2" },
	],
	props: [
		{ name: "variant", type: '"default" | "uncaptured-work"', default: '"default"', description: "Selects the standard Jira issue card or the uncaptured-work presentation." },
		{ name: "summary", type: "string", required: true, description: "Issue summary shown as the primary card text." },
		{ name: "issueKey", type: "string", description: "Jira issue key shown beside the issue-type icon. Required for the default variant." },
		{ name: "sourceLink", type: "SmartLinkItem", description: "Hoverable source reference with a type icon (PR status, branch, or commit), provider name, and destination label. Required for the uncaptured-work variant." },
		{ name: "participants", type: "readonly JiraIssueParticipant[]", description: "People and agents involved in uncaptured work. Required for the uncaptured-work variant." },
		{ name: "captured", type: "boolean", default: "false", description: "Controlled completion state for the uncaptured-work chin after linking or creating a work item." },
		{ name: "suggestedWorkItemKey", type: "string", description: "Suggested Jira key shown on the uncaptured-work chin primary action, e.g. PAY-121." },
		{ name: "suggestedWorkItemKeys", type: "readonly string[]", description: "Several candidate Jira keys, rendered one linkable chin row each. Takes precedence over `suggestedWorkItemKey`." },
		{ name: "onCreateWorkItem", type: "() => void", description: "Creates a Jira work item from the uncaptured-work chin's trailing add control. When omitted, the control is exposed as unavailable." },
		{ name: "onLinkWorkItem", type: "(workItemKey?: string) => void", description: "Links uncaptured work to a suggested Jira work item. Receives the row's key when several are offered. When omitted, the action is exposed as unavailable." },
		{ name: "onSubtasks", type: "() => void", description: "Subtasks action behind the chin's trailing subtasks control. The button always renders; omit this to leave it a placeholder until the behaviour lands." },
		{ name: "showMoreAction", type: "boolean", default: "true", description: "Shows the hover- and focus-revealed issue actions menu while reserving its title-row space." },
		{ name: "onMoreActionSelect", type: "(action: JiraIssueMoreAction) => void", description: "Called after an item is selected from the built-in issue actions menu." },
		{ name: "tags", type: "readonly JiraIssueTag[]", description: "Tags rendered below the summary." },
		{ name: "parentEpicControl", type: "ReactNode", description: "Optional parent epic selector/control rendered in the issue metadata below the summary." },
		{ name: "subtasks", type: "readonly JiraIssueSubtask[]", description: "Nested subtasks rendered behind the expandable subtasks row." },
		{ name: "subtasksCompleted", type: "number", default: "0", description: "Completed subtask count used for the subtasks badge." },
		{ name: "defaultSubtasksExpanded", type: "boolean", default: "false", description: "Initial uncontrolled expanded state for subtasks." },
		{ name: "priority", type: '"major" | "medium" | "minor"', default: '"major"', description: "Priority icon and color." },
		{ name: "showPriorityIndicator", type: "boolean", default: "true", description: "Controls whether the priority icon is shown in the issue metadata row." },
		{ name: "selected", type: "boolean", default: "false", description: "Applies the selected border/background and aria-pressed state." },
		{ name: "dragging", type: "boolean", default: "false", description: "Applies the drag cursor and faded drag state." },
		{ name: "iconScale", type: '"compact" | "comfortable"', default: '"compact"', description: "Compact keeps 12px icons and 16px avatars on compact/stroke cards. Comfortable uses 16px icons and 24px avatars." },
		{ name: "subtaskChrome", type: '"raised" | "stroke"', description: "Chrome for nested subtask cards. Compact cards default to stroke so Raised/Stroke only changes the parent. Stroke keeps a border even when the parent is raised." },
		{ name: "assigneeAvatarSrc", type: "string", description: "Assignee avatar image source." },
		{ name: "assigneeUnassignedKind", type: '"person" | "agent"', description: "Renders the shared unassigned avatar placeholder instead of an assignee image." },
		{ name: "agentActivities", type: "readonly JiraIssueAgentActivity[]", description: "Active agents aggregated into one priority row. One or many attached sessions reveal the same shared assignment flyout; multiple agents use the cycling Agent Loading visual." },
		{ name: "agentActivityMode", type: '"none" | "working" | "awaiting-input" | "completed"', default: '"none"', description: "Presentation mode for showing active agent rows or completed-work notification states." },
		{ name: "agentActivityLayout", type: '"merged" | "split"', default: '"merged"', description: "Merged collapses active agents into one prioritized chin row; split gives each active agent its own row with its own status and chat entry point." },
		{ name: "agentDoneRuns", type: "readonly JiraIssueCompletedAgentRun[]", description: "Completed agent runs shown with the shared Jira Activity output-card design." },
		{ name: "onAgentActivityViewChat", type: "(activity: JiraIssueAgentActivity) => void", description: "Called when an attached agent is selected from the shared assignment flyout, or when a single-session chin is activated directly." },
		{ name: "onAgentDoneRunView", type: "(run: JiraIssueCompletedAgentRun) => void", description: "Called when View is selected from a completed agent run." },
		{ name: "onAgentDoneRunSubmit", type: "(run: JiraIssueCompletedAgentRun, prompt: string) => void", description: "Receives prompts submitted from a completed run's immediately visible composer." },
		{ name: "agentSessionTransfer", type: "JiraIssueAgentSessionTransferConfig", description: "Adds the Unlink drop zone below the card so an agent session can be dragged off its chin row. Collapsed at rest so stacked cards do not reserve a gap. Hovering or focusing a linked chin row, or dragging that row out, opens the well. Hovering an already detached session does not. Supplies the onUnlink commit handler." },
		{ name: "generativeAction", type: "JiraIssueGenerativeActionConfig", description: "Optional hover-revealed generative action menu that can submit Ask Rovo, skill, or agent prompts with issue context." },
	],
};
