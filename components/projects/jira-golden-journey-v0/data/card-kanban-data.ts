import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
	JiraIssuePriority,
	JiraIssueSubtask,
	JiraIssueTag,
} from "@/components/blocks/jira-issue";
import { QUESTION_CARD_SINGLE_SELECT_DEMO } from "@/components/blocks/question-card/data/questions";

/**
 * ASX "Card Kanban" data.
 *
 * Drives a single `jira-issue` card that the gallery stage transitions across
 * the "Agent activity states" — default, one agent working, multiple agents
 * working, an agent awaiting input, and completed agent work — via the toggle
 * bar above it. One card, every state, no board wall.
 */
export type AsxCardKanbanState =
	| "default"
	| "single-agent-working"
	| "multiple-agents-working"
	| "awaiting-user-input"
	| "agent-completed-work";

export const ASX_CARD_KANBAN_STATES = [
	{ value: "default", label: "Default" },
	{ value: "single-agent-working", label: "1 agent" },
	{ value: "multiple-agents-working", label: "1-n agents" },
	{ value: "awaiting-user-input", label: "Needs input" },
	{ value: "agent-completed-work", label: "Done" },
] as const satisfies readonly { value: AsxCardKanbanState; label: string }[];

const SERVICE_IMPACT_LABELS = [
	"Figuring out which services are affected",
	"Reading linked design notes",
	"Checking release ownership",
	"Mapping customer-facing impact",
	"Drafting the service impact summary",
] as const;

const DEPENDENCY_MAPPER_LABELS = [
	"Checking dependent components",
	"Following linked work items",
	"Comparing API usage",
	"Finding blocked handoffs",
	"Updating dependency notes",
] as const;

const SERVICE_IMPACT_AGENT: JiraIssueAgentActivity = {
	id: "service-impact-agent",
	name: "Service impact agent",
	avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
	label: "Figuring out which services are affected",
	labels: SERVICE_IMPACT_LABELS,
	cycleIntervalMs: 5200,
	cycleIntervalJitterMs: 1600,
	state: "working",
};

const DEPENDENCY_MAPPER_AGENT: JiraIssueAgentActivity = {
	id: "dependency-mapper",
	name: "Dependency mapper",
	avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
	label: "Checking dependent components",
	labels: DEPENDENCY_MAPPER_LABELS,
	cycleIntervalMs: 6800,
	cycleIntervalJitterMs: 2200,
	state: "working",
};

const ASX_CARD_KANBAN_DEPLOYMENT_QUESTION = {
	...QUESTION_CARD_SINGLE_SELECT_DEMO[0],
	options: QUESTION_CARD_SINGLE_SELECT_DEMO[0].options.slice(0, 2),
};

/** Working agents, ordered so `slice(0, 1)` yields the single-agent state. */
export const ASX_CARD_KANBAN_WORKING_ACTIVITIES = [
	SERVICE_IMPACT_AGENT,
	DEPENDENCY_MAPPER_AGENT,
] as const satisfies readonly JiraIssueAgentActivity[];

/** The lead agent pauses for input while the second keeps working. */
export const ASX_CARD_KANBAN_AWAITING_ACTIVITIES = [
	{
		...SERVICE_IMPACT_AGENT,
		label: "Awaiting user input",
		question: ASX_CARD_KANBAN_DEPLOYMENT_QUESTION,
		state: "awaiting-input",
	},
	DEPENDENCY_MAPPER_AGENT,
] as const satisfies readonly JiraIssueAgentActivity[];

/** Completed agent updates surfaced by the "Done" state. */
export const ASX_CARD_KANBAN_DONE_RUNS = [
	{
		id: "PD-40:service-impact-agent",
		summary: "Mapped the affected services and added a customer-facing impact summary.",
		agentName: SERVICE_IMPACT_AGENT.name,
		agentAvatarSrc: SERVICE_IMPACT_AGENT.avatarSrc,
		issueKey: "PD-40",
		issueSummary: "Implement advanced date-range filter",
		relativeTime: "Just now",
		state: "done",
	},
	{
		id: "PD-40:dependency-mapper",
		summary: "Documented dependent components, owners, and blocked handoffs.",
		agentName: DEPENDENCY_MAPPER_AGENT.name,
		agentAvatarSrc: DEPENDENCY_MAPPER_AGENT.avatarSrc,
		issueKey: "PD-40",
		issueSummary: "Implement advanced date-range filter",
		relativeTime: "1 min ago",
		state: "failed",
	},
] as const satisfies readonly JiraIssueCompletedAgentRun[];

export const ASX_CARD_KANBAN_SUBTASKS: readonly JiraIssueSubtask[] = [
	{
		summary: "Design the date-range picker interaction",
		issueKey: "PD-41",
		status: "To Do",
		assigneeUnassignedKind: "person",
	},
];

/** Static content for the single card the stage transitions across states. */
export const ASX_CARD_KANBAN_CARD = {
	issueKey: "PD-40",
	summary: "Implement advanced date-range filter",
	tags: [{ text: "FE Development", color: "purple" }] as readonly JiraIssueTag[],
	priority: "major" as JiraIssuePriority,
	assigneeAvatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
} as const;
