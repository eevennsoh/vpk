/**
 * Demo-only attach: fixture detached sessions become extra chin rows.
 * Framework-free so the suite runs under `node --test` with strip-types.
 */

import type { AgentListInvoker } from "@/components/blocks/agent-list";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue/agent-activity";

/** The session fields attach needs. Avoids importing the React session card type. */
export interface JiraIssueDemoAttachableSession {
	id: string;
	title: string;
	state: "running" | "complete" | "needs-input" | "attention";
	agent: {
		name: string;
		avatarSrc?: string;
		brandName?: JiraIssueAgentActivity["agentBrandName"];
		vpkLogo?: JiraIssueAgentActivity["agentVpkLogo"];
	};
	/**
	 * Attaching a session must not cost it its face. Without this the chin row
	 * it becomes drags as bare "Claude" instead of "Claude with Priya", and a
	 * later unlink hands the card assignee back as the invoker.
	 */
	invokedBy?: AgentListInvoker;
	host?: JiraIssueAgentActivity["host"];
	role?: JiraIssueAgentActivity["role"];
}

/**
 * Sample detached sessions are often `complete`. A chin row only mounts for
 * active work, so attaching always lands as awaiting-input or working.
 */
export function toJiraIssueDemoAttachedActivity(
	session: JiraIssueDemoAttachableSession,
): JiraIssueAgentActivity {
	return {
		id: session.id,
		name: session.agent.name,
		label: session.title,
		state: session.state === "needs-input" || session.state === "attention"
			? "awaiting-input"
			: "working",
		...(session.agent.avatarSrc ? { avatarSrc: session.agent.avatarSrc } : {}),
		...(session.agent.brandName ? { agentBrandName: session.agent.brandName } : {}),
		...(session.agent.vpkLogo ? { agentVpkLogo: session.agent.vpkLogo } : {}),
		...(session.invokedBy ? { invokedBy: session.invokedBy } : {}),
		...(session.host !== undefined ? { host: session.host } : {}),
		...(session.role !== undefined ? { role: session.role } : {}),
	};
}

/** Link or unlink one id without dropping the others already attached. */
export function nextJiraIssueDemoLinkedIds(
	current: readonly string[],
	id: string,
	linked: boolean,
): readonly string[] {
	if (linked) {
		return current.includes(id) ? current : [...current, id];
	}

	return current.filter((candidate) => candidate !== id);
}

/**
 * Split fixture detached sessions into those already on the chin and those
 * still waiting under the card. Order is preserved so link-clicks stay stable.
 */
export function splitJiraIssueDemoSessionsById<TSession extends { id: string }>(
	sessions: readonly TSession[],
	linkedIds: readonly string[],
): { linked: readonly TSession[]; remaining: readonly TSession[] } {
	const linked = new Set(linkedIds);

	return {
		linked: sessions.filter((session) => linked.has(session.id)),
		remaining: sessions.filter((session) => !linked.has(session.id)),
	};
}
