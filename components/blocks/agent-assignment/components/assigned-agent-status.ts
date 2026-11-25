export type AgentAssignmentStatusKind = "working" | "needs-input" | "ready-for-review" | "finished" | "idle";

export function resolveAssignedAgentStatusKind(
	agent: Pick<{ statusKind?: AgentAssignmentStatusKind; statusSequence?: readonly string[] }, "statusKind" | "statusSequence">,
): AgentAssignmentStatusKind {
	if (agent.statusKind !== undefined) {
		return agent.statusKind;
	}

	const hasWorkingSequence = agent.statusSequence?.some((label) => label.trim().length > 0) ?? false;
	return hasWorkingSequence ? "working" : "idle";
}
