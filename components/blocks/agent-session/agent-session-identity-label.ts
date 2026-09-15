import type { AgentListAgent, AgentListInvoker } from "@/components/blocks/agent-list";

import type { AgentSessionItem } from "./agent-session-types";

/**
 * "Claude with Annie" — the agent that ran the session and the human who
 * invoked it, as one string.
 *
 * Cards use the full identity for accessible names. Drag chips use the
 * separate person-only label below. Sessions with no invoker use the agent name.
 */
export function agentIdentityLabel(
	agent: AgentListAgent,
	attributedBy?: AgentListInvoker,
): string {
	return attributedBy === undefined ? agent.name : `${agent.name} with ${attributedBy.name}`;
}

/** `agentIdentityLabel` for a session row. */
export function agentSessionIdentityLabel(item: AgentSessionItem): string {
	return agentIdentityLabel(item.agent, item.invokedBy);
}

/** The human owns the visible drag label; agent identity remains in the avatar. */
export function agentDragIdentityLabel(
	agent: AgentListAgent,
	attributedBy?: AgentListInvoker,
): string {
	return attributedBy?.name ?? agent.name;
}
