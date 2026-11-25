"use client";

import { useState } from "react";

import type { AgentAssignmentStatusKind } from "@/components/blocks/agent-assignment/components/assigned-agent-status";

export function isAssignedAgentAttentionKind(kind: AgentAssignmentStatusKind): boolean {
	return kind === "needs-input" || kind === "ready-for-review" || kind === "finished";
}

export function resolveAssignedAgentAttentionChanges(
	agents: readonly { id: string; statusKind: AgentAssignmentStatusKind }[],
	previousKinds: ReadonlyMap<string, AgentAssignmentStatusKind>,
): {
	changedIds: readonly string[];
	nextKinds: Map<string, AgentAssignmentStatusKind>;
} {
	const nextKinds = new Map(previousKinds);
	const seen = new Set<string>();
	const changedIds: string[] = [];

	for (const agent of agents) {
		seen.add(agent.id);
		const previousKind = nextKinds.get(agent.id);
		nextKinds.set(agent.id, agent.statusKind);
		if (previousKind !== undefined && previousKind !== agent.statusKind) {
			changedIds.push(agent.id);
		}
	}

	for (const id of nextKinds.keys()) {
		if (!seen.has(id)) {
			nextKinds.delete(id);
			changedIds.push(id);
		}
	}

	return { changedIds, nextKinds };
}

export function acknowledgeAssignedAgentAttention(
	current: ReadonlySet<string>,
	agentId: string,
	statusKind: AgentAssignmentStatusKind,
): ReadonlySet<string> {
	if (!isAssignedAgentAttentionKind(statusKind) || current.has(agentId)) {
		return current;
	}

	const next = new Set(current);
	next.add(agentId);
	return next;
}

export function clearAcknowledgedAssignedAgentIds(
	current: ReadonlySet<string>,
	changedIds: readonly string[],
): ReadonlySet<string> {
	if (changedIds.length === 0) {
		return current;
	}

	let changed = false;
	const next = new Set(current);
	for (const id of changedIds) {
		if (next.delete(id)) {
			changed = true;
		}
	}

	return changed ? next : current;
}

export function useAssignedAgentAttention(
	agents: readonly { id: string; statusKind: AgentAssignmentStatusKind }[],
): {
	acknowledgeAttention: (agentId: string) => void;
	isAttentionAcknowledged: (agentId: string) => boolean;
} {
	const [acknowledgedIds, setAcknowledgedIds] = useState<ReadonlySet<string>>(() => new Set());
	const [previousKinds, setPreviousKinds] = useState<ReadonlyMap<string, AgentAssignmentStatusKind>>(
		() => new Map(),
	);
	const attentionSignature = agents
		.map((agent) => `${agent.id}:${agent.statusKind}`)
		.join(",");
	const [seenSignature, setSeenSignature] = useState<string | null>(null);

	if (attentionSignature !== seenSignature) {
		setSeenSignature(attentionSignature);

		const { changedIds, nextKinds } = resolveAssignedAgentAttentionChanges(
			agents,
			previousKinds,
		);
		setPreviousKinds(nextKinds);
		setAcknowledgedIds((current) => clearAcknowledgedAssignedAgentIds(current, changedIds));
	}

	const acknowledgeAttention = (agentId: string) => {
		const agent = agents.find((candidate) => candidate.id === agentId);
		if (!agent) {
			return;
		}
		setAcknowledgedIds((current) => (
			acknowledgeAssignedAgentAttention(current, agentId, agent.statusKind)
		));
	};

	return {
		acknowledgeAttention,
		isAttentionAcknowledged: (agentId: string) => acknowledgedIds.has(agentId),
	};
}
