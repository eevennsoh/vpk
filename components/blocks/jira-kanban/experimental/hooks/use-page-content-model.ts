"use client";

import { useMemo } from "react";

import type { ExperimentalJiraKanbanPageProps } from "../experimental-page-types";
import { filterPulseLooseWorkByMember, toPulseSessionItems } from "../pulse/lib/pulse-sessions";
import type { PulseAgentSession, PulseLooseWork, PulseMember, PulseWorkItem } from "../pulse/types";

const EMPTY_ADDITIONAL_AGENT_SESSIONS: readonly PulseAgentSession[] = [];

export function useAgentSessionLooseWork(
	additionalAgentSessions: readonly PulseAgentSession[] | undefined,
	pulseLooseWork: readonly PulseLooseWork[],
	agentSessionSeedOverrides?: ReadonlyMap<string, PulseAgentSession>,
): readonly PulseLooseWork[] {
	return useMemo(
		() => {
			const seededLooseWork = agentSessionSeedOverrides === undefined
				? pulseLooseWork
				: pulseLooseWork.map((item) => item.kind === "agent-session"
					? agentSessionSeedOverrides.get(item.id) ?? item
					: item);
			return [...(additionalAgentSessions ?? EMPTY_ADDITIONAL_AGENT_SESSIONS), ...seededLooseWork];
		},
		[additionalAgentSessions, pulseLooseWork, agentSessionSeedOverrides],
	);
}

export function isExperimentalJiraListContent(
	activeView: ExperimentalJiraKanbanPageProps["activeView"],
	renderListContent: ExperimentalJiraKanbanPageProps["renderListContent"],
): boolean {
	return activeView === "list" && renderListContent !== undefined;
}

export function useAgentSessionItems(
	agentSessionLooseWork: readonly PulseLooseWork[],
	agentSessionMemberId: string | null,
	agentSessionMembers: readonly PulseMember[],
	workItems: readonly PulseWorkItem[],
) {
	return useMemo(
		() => toPulseSessionItems(
			filterPulseLooseWorkByMember(agentSessionLooseWork, agentSessionMemberId),
			agentSessionMembers,
			workItems,
		),
		[agentSessionLooseWork, agentSessionMemberId, agentSessionMembers, workItems],
	);
}
