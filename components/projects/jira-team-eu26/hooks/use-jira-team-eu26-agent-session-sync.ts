import { useCallback, useEffect, useState } from "react";

import type { PulseAgentSession } from "@/components/blocks/jira-kanban/experimental/pulse/types";

import {
	getJiraTeamEu26SyncDelayMs,
	JIRA_TEAM_EU26_SYNC_SESSIONS,
	removeReviewedJiraTeamEu26AgentSessionIds,
	takeJiraTeamEu26SyncBatch,
} from "../data/agent-session-sync";

interface JiraTeamEu26AgentSessionSyncState {
	newAgentSessionIds: ReadonlySet<string>;
	nextIndex: number;
	syncedAgentSessions: readonly PulseAgentSession[];
}

function createInitialSyncState(): JiraTeamEu26AgentSessionSyncState {
	return {
		newAgentSessionIds: new Set(),
		nextIndex: 0,
		syncedAgentSessions: [],
	};
}

export function useJiraTeamEu26AgentSessionSync({
	active,
	paused = false,
}: Readonly<{ active: boolean; paused?: boolean }>): Readonly<{
	newAgentSessionIds: ReadonlySet<string>;
	reviewAgentSessions: (sessionIds?: readonly string[]) => void;
	syncedAgentSessions: readonly PulseAgentSession[];
}> {
	const [syncState, setSyncState] = useState(createInitialSyncState);
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
		if (!active || paused || syncState.nextIndex >= JIRA_TEAM_EU26_SYNC_SESSIONS.length) {
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

			timeoutId = window.setTimeout(() => {
				timeoutId = undefined;
				const batch = takeJiraTeamEu26SyncBatch(syncState.nextIndex);
				const newAgentSessionIds = new Set(syncState.newAgentSessionIds);
				for (const session of batch.sessions) {
					newAgentSessionIds.add(session.id);
				}

				setSyncState({
					newAgentSessionIds,
					nextIndex: batch.nextIndex,
					syncedAgentSessions: [
						...batch.sessions,
						...syncState.syncedAgentSessions,
					],
				});
			}, getJiraTeamEu26SyncDelayMs(syncState.nextIndex));
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
	}, [active, paused, syncState]);

	return {
		newAgentSessionIds: syncState.newAgentSessionIds,
		reviewAgentSessions,
		syncedAgentSessions: syncState.syncedAgentSessions,
	};
}
