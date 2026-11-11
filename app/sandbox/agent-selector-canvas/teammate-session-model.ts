import type { AgentSessionItem } from "@/components/blocks/agent-session";

/** First appearance orders teammates; incoming order orders each teammate's sessions. */
export function groupTeammateSessions(items: readonly AgentSessionItem[]) {
	const groups = new Map<string, AgentSessionItem[]>();
	for (const item of items) {
		const name = item.invokedBy?.name.trim() || "Unknown teammate";
		const sessions = groups.get(name);
		if (sessions) sessions.push(item);
		else groups.set(name, [item]);
	}
	return Array.from(groups, ([name, sessions]) => ({ name, sessions }));
}

/** Count every state present in the payload, without inventing zero-count statuses. */
export function summarizeTeammateActivity(items: readonly AgentSessionItem[]) {
	const counts = new Map<AgentSessionItem["state"], number>();
	for (const item of items) counts.set(item.state, (counts.get(item.state) ?? 0) + 1);
	return Array.from(counts, ([state, count]) => ({ state, count }));
}
