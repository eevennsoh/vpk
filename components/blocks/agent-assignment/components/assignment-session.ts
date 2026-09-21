import type { AgentAssignmentAgent } from "@/components/blocks/agent-assignment/components/agent-assignment";
import {
	resolveAssignedAgentStatusKind,
	type AgentAssignmentStatusKind,
} from "@/components/blocks/agent-assignment/components/assigned-agent-status";
import { assignmentSessionRole } from "@/components/blocks/agent-assignment/components/assignment-session-role";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue/agent-activity";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { agentIdentityLabel } from "@/components/blocks/agent-session/agent-session-identity-label";

export { assignmentSessionRole } from "@/components/blocks/agent-assignment/components/assignment-session-role";

export type AgentAssignmentVariant = "default" | "simple";

function assignmentSessionState(
	kind: AgentAssignmentStatusKind,
): AgentSessionItem["state"] {
	switch (kind) {
		case "working":
			return "running";
		case "needs-input":
			return "needs-input";
		case "finished":
		case "idle":
			return "complete";
		default: {
			const exhaustiveKind: never = kind;
			return exhaustiveKind;
		}
	}
}

function assignmentActivityState(
	kind: AgentAssignmentStatusKind,
): JiraIssueAgentActivity["state"] {
	switch (kind) {
		case "working":
			return "working";
		case "needs-input":
			return "awaiting-input";
		case "finished":
		case "idle":
			return "completed";
		default: {
			const exhaustiveKind: never = kind;
			return exhaustiveKind;
		}
	}
}

function assignmentActivityLabel(kind: AgentAssignmentStatusKind, agent: AgentAssignmentAgent): string {
	switch (kind) {
		case "working":
			return "Working";
		case "needs-input":
			return "Needs input";
		case "finished":
			return "Finished";
		case "idle":
			return agent.statusLabel.trim() || "Assigned";
		default: {
			const exhaustiveKind: never = kind;
			return exhaustiveKind;
		}
	}
}

/** Maps an assigned agent onto the Agent Session long-row model. */
export function toAssignmentSessionItem(agent: AgentAssignmentAgent): AgentSessionItem {
	const statusKind = resolveAssignedAgentStatusKind(agent);
	const role = assignmentSessionRole(statusKind, agent.role);
	const invokedBy = agent.invokedBy;

	return {
		agent: {
			id: agent.id,
			kind: "agent",
			name: agent.name,
			...(agent.avatarSrc ? { avatarSrc: agent.avatarSrc } : {}),
			...(agent.brandName ? { brandName: agent.brandName } : {}),
		},
		id: agent.id,
		...(invokedBy ? { invokedBy } : {}),
		state: assignmentSessionState(statusKind),
		title: role === "viewer" ? agentIdentityLabel(agent, invokedBy) : agent.name,
		...(agent.host !== undefined ? { host: agent.host } : {}),
		...(role !== undefined ? { role } : {}),
		...(agent.timeLabel ? { timeLabel: agent.timeLabel } : {}),
	};
}

/** Maps an assigned agent onto the Jira issue activity-row model. */
export function toAssignmentActivity(agent: AgentAssignmentAgent): JiraIssueAgentActivity {
	const statusKind = resolveAssignedAgentStatusKind(agent);
	const role = assignmentSessionRole(statusKind, agent.role);
	const invokedBy = agent.invokedBy;

	return {
		id: agent.id,
		name: agent.name,
		label: assignmentActivityLabel(statusKind, agent),
		state: assignmentActivityState(statusKind),
		...(agent.avatarSrc ? { avatarSrc: agent.avatarSrc } : {}),
		...(agent.brandName ? { agentBrandName: agent.brandName } : {}),
		...(statusKind === "working" && agent.statusSequence
			? { labels: agent.statusSequence }
			: {}),
		...(invokedBy ? { invokedBy } : {}),
		...(agent.host !== undefined ? { host: agent.host } : {}),
		...(role !== undefined ? { role } : {}),
	};
}
