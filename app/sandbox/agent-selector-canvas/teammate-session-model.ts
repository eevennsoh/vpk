import type { AgentSessionItem } from "@/components/blocks/agent-session";

/** Count every state present in the payload, without inventing zero-count statuses. */
export function summarizeTeammateActivity(items: readonly AgentSessionItem[]) {
	const counts = new Map<AgentSessionItem["state"], number>();
	for (const item of items) counts.set(item.state, (counts.get(item.state) ?? 0) + 1);
	return Array.from(counts, ([state, count]) => ({ state, count }));
}
