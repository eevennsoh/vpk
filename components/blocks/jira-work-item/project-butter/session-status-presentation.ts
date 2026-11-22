import type { AgentSessionItem } from "@/components/blocks/agent-session";

export const SESSION_URGENCY: Readonly<Record<AgentSessionItem["state"], number>> = { "needs-input": 0, attention: 0, running: 1, complete: 2 };

export function sessionStatusPresentation(sessions: readonly AgentSessionItem[]) {
	const personal = sessions.filter((session) => session.role !== "viewer");
	const priority = Math.min(...personal.map((session) => SESSION_URGENCY[session.state]));
	const cohort = personal.filter((session) => SESSION_URGENCY[session.state] === priority);
	return { cohort, shouldCycle: cohort.length > 1 && priority < SESSION_URGENCY.complete };
}
