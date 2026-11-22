"use client";

import { useMemo } from "react";

import type { ExperimentalJiraKanbanPageProps } from "../experimental-page-types";
import { boardFilterScopeEntryPolicy, type BoardFilterScopeEntryPolicy } from "../lib/board-jira-filter";
import { filterPulseLooseWorkByMember, toPulseSessionItems } from "../pulse/lib/pulse-sessions";
import type { PulseAgentSession, PulseLooseWork, PulseMember, PulseWorkItem } from "../pulse/types";
import type { BoardFilterActions, BoardFilterModel } from "./use-board-filter";

const EMPTY_ADDITIONAL_AGENT_SESSIONS: readonly PulseAgentSession[] = [];

/** An explicit Epic or Sprint selection opens its Insights brief when available. */
export function usePageFilterActions(
	actions: BoardFilterActions,
	currentConditions: BoardFilterModel["conditions"],
	openTimeline?: (snapshotId?: string | null, assigneePolicy?: BoardFilterScopeEntryPolicy) => void,
): BoardFilterActions {
	return useMemo(() => ({
		...actions,
		setConditions: (conditions) => {
			actions.setConditions(conditions);
			const entryPolicy = boardFilterScopeEntryPolicy(conditions, currentConditions);
			if (entryPolicy) openTimeline?.(null, entryPolicy);
		},
		toggleValue: (fieldId, valueId) => {
			actions.toggleValue(fieldId, valueId);
			if (fieldId === "parent" || fieldId === "sprint") openTimeline?.();
		},
	}), [actions, currentConditions, openTimeline]);
}

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
