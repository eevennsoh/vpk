import directoryAgentsData from "@/app/data/directory/agents.json";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
	JiraIssueGenerativeActionRequest,
} from "@/components/blocks/jira-issue";
import type { JiraKanbanAgentData } from "@/components/blocks/jira-kanban";

export const JGP_KANBAN_DEFAULT_AGENT_ID = "claude-code";
export const JGP_KANBAN_CURSOR_AGENT_ID = "cursor";

export interface JgpKanbanAgentSelection {
	id: string;
	name?: string;
	avatarSrc?: string;
}

interface JgpKanbanActivityScenario {
	completedSummary: string;
	cycleIntervalMs: number;
	labels: readonly string[];
	workingMessage: string;
}

const JGP_DIRECTORY_AGENTS = directoryAgentsData as readonly AgentSelectorAgent[];

export function getDirectoryAgentAvatar(agentId: string): string | undefined {
	return JGP_DIRECTORY_AGENTS.find((agent) => agent.id === agentId)?.avatarSrc;
}

export const JGP_KANBAN_AGENTS: readonly JiraKanbanAgentData[] = [
	{
		id: JGP_KANBAN_DEFAULT_AGENT_ID,
		name: "Claude",
		byline: "Coding agent by Anthropic",
		brandName: "claude",
	},
	{
		id: JGP_KANBAN_CURSOR_AGENT_ID,
		name: "Cursor",
		byline: "Coding agent by Cursor",
		brandName: "cursor",
	},
] as const;

export const JGP_KANBAN_SELECTION_AGENTS = JGP_KANBAN_AGENTS;

export const JGP_GLOBAL_KANBAN_SELECTION_AGENTS = [
	...JGP_KANBAN_AGENTS,
	...JGP_DIRECTORY_AGENTS.filter((agent) => agent.id !== "rovo-dev"),
] as const;

const ACTIVITY_SCENARIOS: Readonly<Record<string, JgpKanbanActivityScenario>> = {
	[JGP_KANBAN_DEFAULT_AGENT_ID]: {
		labels: ["Reading the work item context", "Implementing the board change", "Running focused tests", "Preparing the pull request"],
		cycleIntervalMs: 2200,
		workingMessage: "I’m using the connected work context to implement this Jira board change and verify it with focused tests.",
		completedSummary: "Implemented the Jira board change and prepared it for review.",
	},
	[JGP_KANBAN_CURSOR_AGENT_ID]: {
		labels: ["Reading the Jira context", "Updating the board behavior", "Checking accessibility", "Preparing the change for review"],
		cycleIntervalMs: 2100,
		workingMessage: "I’m working through the Jira context and preparing this focused board improvement for review.",
		completedSummary: "Completed the board improvement and moved it to Review.",
	},
};

function getActivityScenario(agentId: string): JgpKanbanActivityScenario {
	return ACTIVITY_SCENARIOS[agentId] ?? {
		labels: ["Reading the Jira context", "Applying the requested change", "Checking the result"],
		cycleIntervalMs: 2300,
		workingMessage: "I’m applying the requested change using the linked Jira context.",
		completedSummary: "Completed the requested change and prepared it for review.",
	};
}

export function getJgpGenerativeActivityId(request: JiraIssueGenerativeActionRequest): string {
	if (request.kind === "skill") {
		const skillId = request.selectedItem?.id ?? "selected-skill";
		return skillId.startsWith("skill:") ? skillId : `skill:${skillId}`;
	}
	if (request.kind === "agent") return request.selectedItem?.id.replace(/^subagent:/u, "") ?? JGP_KANBAN_DEFAULT_AGENT_ID;
	return "rovo-dev";
}

export function getJgpGenerativeAgentSelection(request: JiraIssueGenerativeActionRequest): JgpKanbanAgentSelection {
	return {
		id: getJgpGenerativeActivityId(request),
		name: request.kind === "agent" ? request.selectedItem?.label : undefined,
		avatarSrc: request.kind === "agent" ? request.selectedItem?.avatarSrc : undefined,
	};
}

function hashJgpSeed(seed: string): number {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function rotateJgpLabels(labels: readonly string[], offset: number): readonly string[] {
	if (labels.length <= 1) return labels;
	const start = offset % labels.length;
	return [...labels.slice(start), ...labels.slice(0, start)];
}

export function createJgpKanbanActivity(
	agentId: string,
	selection?: JgpKanbanAgentSelection,
	seed?: string,
): JiraIssueAgentActivity {
	const scenario = getActivityScenario(agentId);
	const hash = seed ? hashJgpSeed(seed) : 0;
	const labels = rotateJgpLabels(scenario.labels, hash);
	const jgpAgent = JGP_KANBAN_AGENTS.find((candidate) => candidate.id === agentId);
	const directoryAgent = JGP_DIRECTORY_AGENTS.find((candidate) => candidate.id === agentId);
	return {
		id: agentId,
		name: selection?.name ?? jgpAgent?.name ?? directoryAgent?.name ?? "Coding agent",
		avatarSrc: selection?.avatarSrc ?? jgpAgent?.avatarSrc ?? directoryAgent?.avatarSrc,
		agentBrandName: jgpAgent?.brandName,
		label: labels[0] ?? "Reading the Jira context",
		labels,
		message: scenario.workingMessage,
		cycleIntervalMs: Math.max(1200, scenario.cycleIntervalMs + (seed ? (hash % 9) * 100 - 400 : 0)),
		cycleIntervalJitterMs: seed ? 500 + (hash % 6) * 100 : 0,
		state: "working",
	};
}

export function createJgpKanbanCompletedRun(
	agentId: string,
	issue: Readonly<{ issueKey: string; issueSummary: string }>,
	selection?: JgpKanbanAgentSelection,
	summary?: string,
	state: JiraIssueCompletedAgentRun["state"] = "done",
): JiraIssueCompletedAgentRun {
	const activity = createJgpKanbanActivity(agentId, selection);
	return {
		id: `${issue.issueKey}:${agentId}`,
		summary: summary ?? getActivityScenario(agentId).completedSummary,
		agentName: activity.name,
		agentAvatarSrc: activity.avatarSrc,
		agentBrandName: JGP_KANBAN_AGENTS.find((agent) => agent.id === agentId)?.brandName,
		issueKey: issue.issueKey,
		issueSummary: issue.issueSummary,
		relativeTime: "Just now",
		state,
	};
}
