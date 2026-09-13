import type { AgentAssignmentStatusKind } from "@/components/blocks/agent-assignment/components/assigned-agent-status";
import type { AgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";

/** Explicit session ownership takes precedence over lifecycle state. */
export function assignmentSessionRole(
	statusKind: AgentAssignmentStatusKind,
	role?: AgentSessionRole,
): AgentSessionRole | undefined {
	return role ?? (statusKind === "needs-input" ? "owner" : undefined);
}
