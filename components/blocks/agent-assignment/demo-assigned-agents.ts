import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import {
	type AgentAssignmentAgent,
	type AgentAssignmentStatusKind,
} from "@/components/blocks/agent-assignment";
import type { AgentListHost, AgentListInvoker } from "@/components/blocks/agent-list/agent-list-types";
import type { AgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";

const DEMO_INVOKERS: Readonly<Record<string, AgentListInvoker>> = {
	"release-notes-drafter": {
		avatarSrc: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
		name: "Jordan Okafor",
	},
	"readiness-checker": {
		avatarSrc: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
		name: "Priya Raman",
	},
};

export const INITIAL_ASSIGNED_AGENT_IDS = [
	"github-copilot",
	"code-reviewer",
	"release-notes-drafter",
	"readiness-checker",
] as const;

export const DEMO_USED_AGENT_IDS = [
	"github-copilot",
	"release-notes-drafter",
] as const;

interface DemoAgentState {
	statusKind: AgentAssignmentStatusKind;
	statusLabel: string;
	host: AgentListHost;
	role: Exclude<AgentSessionRole, "expired">;
	status?: string;
	intervalMs?: number;
	jitterMs?: number;
	labels?: readonly string[];
	timeLabel: string;
}

const DEMO_AGENT_STATES: Readonly<Record<string, DemoAgentState>> = {
	"github-copilot": {
		host: "cloud",
		role: "owner",
		statusKind: "working",
		statusLabel: "Running",
		timeLabel: "18m",
		intervalMs: 1700,
		jitterMs: 1900,
		labels: [
			"Inspecting changed files",
			"Tracing affected call sites",
			"Checking the proposed patch across every changed file in this review",
		],
	},
	"release-notes-drafter": {
		host: "cloud",
		role: "owner",
		statusKind: "needs-input",
		statusLabel: "Needs input",
		status: "Needs input",
		timeLabel: "Yesterday",
	},
	"code-reviewer": {
		host: "local",
		role: "owner",
		statusKind: "idle",
		statusLabel: "Idle",
		timeLabel: "3h",
	},
	"readiness-checker": {
		host: "local",
		role: "viewer",
		statusKind: "idle",
		statusLabel: "Idle",
		timeLabel: "Last week",
	},
};

function getDemoAssignedAgent(agent: AgentSelectorAgent): AgentAssignmentAgent {
	const demoStatus = DEMO_AGENT_STATES[agent.id] ?? {
		host: "cloud" as const,
		role: "owner" as const,
		statusKind: "idle" as const,
		statusLabel: "Idle",
		timeLabel: "12m",
	};

	return {
		...agent,
		host: demoStatus.host,
		...(DEMO_INVOKERS[agent.id]
			? { invokedBy: DEMO_INVOKERS[agent.id] }
			: {}),
		role: demoStatus.role,
		statusKind: demoStatus.statusKind,
		statusLabel: demoStatus.statusLabel,
		timeLabel: demoStatus.timeLabel,
		...(demoStatus.status ? { status: demoStatus.status } : {}),
		...(demoStatus.labels ? {
			statusSequence: demoStatus.labels,
			statusCycleIntervalMs: demoStatus.intervalMs,
			statusCycleJitterMs: demoStatus.jitterMs,
		} : {}),
	};
}

export function getAgentAssignmentDemoAssignedAgents(
	assignedAgentIds: readonly string[] = INITIAL_ASSIGNED_AGENT_IDS,
	options: { codeReviewerFinished?: boolean } = {},
): AgentAssignmentAgent[] {
	return assignedAgentIds.flatMap((agentId): AgentAssignmentAgent[] => {
		const agent = ROVO_AGENT_SELECTOR_AGENTS.find((candidate) => candidate.id === agentId);
		if (!agent) {
			return [];
		}
		const assigned = getDemoAssignedAgent(agent);
		if (agent.id === "code-reviewer" && options.codeReviewerFinished) {
			return [{
				...assigned,
				status: "Finished",
				statusKind: "finished",
				statusLabel: "Finished",
			}];
		}
		return [assigned];
	});
}
