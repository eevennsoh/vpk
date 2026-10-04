import { useCallback, useEffect, useState } from "react";

import type { PulseAgentSession } from "@/components/blocks/jira-kanban/experimental/pulse/types";

import {
	addJiraTeamEu26SyncSessionInitialVersions,
	advanceJiraTeamEu26SyncSession,
	getJiraTeamEu26StateChangeDelayMs,
	getJiraTeamEu26SyncDelayMs,
	JIRA_TEAM_EU26_DEFAULT_SYNC_SOURCE,
	type JiraTeamEu26AgentSessionSyncSource,
	removeReviewedJiraTeamEu26AgentSessionIds,
	takeJiraTeamEu26SyncBatch,
} from "@/components/projects/jira-team-eu26/data/agent-session-sync";

interface JiraTeamEu26AgentSessionSyncState {
	lastAction: "arrival" | "state-change";
	newAgentSessionIds: ReadonlySet<string>;
	nextIndex: number;
	stateChangeVersions: ReadonlyMap<string, number>;
	syncedAgentSessions: readonly PulseAgentSession[];
	transitionQueue: readonly string[];
}

function createInitialSyncState(source: JiraTeamEu26AgentSessionSyncSource): JiraTeamEu26AgentSessionSyncState {
	return {
		lastAction: "state-change",
		newAgentSessionIds: new Set(),
		nextIndex: 0,
		stateChangeVersions: new Map(
			[...source.seedOverrides.values()].map((session) => [session.id, 0] as const),
		),
		syncedAgentSessions: [],
		transitionQueue: [],
	};
}

/** One retained instance per content source keeps each preset's progress and arrival marks isolated. */
export function useJiraTeamEu26AgentSessionSync({
	active,
	paused = false,
	source = JIRA_TEAM_EU26_DEFAULT_SYNC_SOURCE,
}: Readonly<{ active: boolean; paused?: boolean; source?: JiraTeamEu26AgentSessionSyncSource }>): Readonly<{
	newAgentSessionIds: ReadonlySet<string>;
	reviewAgentSessions: (sessionIds?: readonly string[]) => void;
	stateChangeVersions: ReadonlyMap<string, number>;
	syncedAgentSessions: readonly PulseAgentSession[];
}> {
	const [syncState, setSyncState] = useState(() => createInitialSyncState(source));
	const reviewAgentSessions = useCallback((sessionIds?: readonly string[]) => {
		setSyncState((current) => {
			const newAgentSessionIds = removeReviewedJiraTeamEu26AgentSessionIds(
				current.newAgentSessionIds,
				sessionIds,
			);
			return newAgentSessionIds === current.newAgentSessionIds
				? current
				: { ...current, newAgentSessionIds };
		});
	}, []);

	useEffect(() => {
		if (
			!active || paused || (
				syncState.nextIndex >= source.sessions.length
				&& syncState.transitionQueue.length === 0
			)
		) {
			return undefined;
		}

		let timeoutId: number | undefined;
		const clearPendingSync = () => {
			if (timeoutId === undefined) {
				return;
			}
			window.clearTimeout(timeoutId);
			timeoutId = undefined;
		};
		const scheduleNextSync = () => {
			if (timeoutId !== undefined || document.visibilityState !== "visible") {
				return;
			}

			const changingState = syncState.transitionQueue.length > 0 && (
				syncState.lastAction === "arrival"
				|| syncState.nextIndex >= source.sessions.length
			);
			timeoutId = window.setTimeout(() => {
				timeoutId = undefined;
				const batchRandom = Math.random();
				setSyncState((current) => {
					const hasPendingArrivals = current.nextIndex < source.sessions.length;
					const shouldChangeState = current.transitionQueue.length > 0 && (
						current.lastAction === "arrival" || !hasPendingArrivals
					);
					if (shouldChangeState) {
						const sessionId = current.transitionQueue[0];
						const next = advanceJiraTeamEu26SyncSession(
							current.syncedAgentSessions,
							current.stateChangeVersions,
							sessionId,
							source.cohortById,
						);
						return {
							...current,
							lastAction: "state-change",
							stateChangeVersions: next.stateChangeVersions,
							syncedAgentSessions: next.sessions,
							transitionQueue: next.nextState === "needs-input"
								&& source.cohortById.get(sessionId) === "full-path"
								? [sessionId, ...current.transitionQueue.slice(1)]
								: current.transitionQueue.slice(1),
						};
					}
					if (!hasPendingArrivals) {
						return current;
					}

					const batch = takeJiraTeamEu26SyncBatch(current.nextIndex, () => batchRandom, source.sessions);
					return {
						...current,
						lastAction: "arrival",
						newAgentSessionIds: new Set([
							...current.newAgentSessionIds,
							...batch.sessions.map((session) => session.id),
						]),
						nextIndex: batch.nextIndex,
						stateChangeVersions: addJiraTeamEu26SyncSessionInitialVersions(
							current.stateChangeVersions,
							batch.sessions,
						),
						syncedAgentSessions: [
							...batch.sessions,
							...current.syncedAgentSessions,
						],
						transitionQueue: [
							...current.transitionQueue,
							...batch.sessions
								.filter((session) => {
									const cohort = source.cohortById.get(session.id);
									return cohort === "needs-input-terminal" || cohort === "full-path";
								})
								.map((session) => session.id),
						],
					};
				});
			}, changingState
				? getJiraTeamEu26StateChangeDelayMs()
				: getJiraTeamEu26SyncDelayMs(syncState.nextIndex));
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				scheduleNextSync();
				return;
			}
			clearPendingSync();
		};

		scheduleNextSync();
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			clearPendingSync();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [active, paused, source, syncState.lastAction, syncState.nextIndex, syncState.transitionQueue]);

	return {
		newAgentSessionIds: syncState.newAgentSessionIds,
		reviewAgentSessions,
		stateChangeVersions: syncState.stateChangeVersions,
		syncedAgentSessions: syncState.syncedAgentSessions,
	};
}
