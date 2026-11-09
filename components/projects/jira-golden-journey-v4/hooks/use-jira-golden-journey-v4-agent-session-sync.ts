import { useCallback, useEffect, useState } from "react";

import type { PulseAgentSession } from "@/components/blocks/jira-kanban/experimental/pulse/types";

import {
	getJiraGoldenJourneyV4SyncDelayMs,
	JIRA_GOLDEN_JOURNEY_V4_SYNC_SESSIONS,
	removeReviewedJiraGoldenJourneyV4AgentSessionIds,
	takeJiraGoldenJourneyV4SyncBatch,
} from "../data/agent-session-sync";

interface JiraGoldenJourneyV4AgentSessionSyncState {
	newAgentSessionIds: ReadonlySet<string>;
	nextIndex: number;
	syncedAgentSessions: readonly PulseAgentSession[];
}

function createInitialSyncState(): JiraGoldenJourneyV4AgentSessionSyncState {
	return {
		newAgentSessionIds: new Set(),
		nextIndex: 0,
		syncedAgentSessions: [],
	};
}

export function useJiraGoldenJourneyV4AgentSessionSync({
	active,
}: Readonly<{ active: boolean }>): Readonly<{
	newAgentSessionIds: ReadonlySet<string>;
	reviewAgentSessions: (sessionIds?: readonly string[]) => void;
	syncedAgentSessions: readonly PulseAgentSession[];
}> {
	const [syncState, setSyncState] = useState(createInitialSyncState);
	const reviewAgentSessions = useCallback((sessionIds?: readonly string[]) => {
		setSyncState((current) => {
			const newAgentSessionIds = removeReviewedJiraGoldenJourneyV4AgentSessionIds(
				current.newAgentSessionIds,
				sessionIds,
			);
			return newAgentSessionIds === current.newAgentSessionIds
				? current
				: { ...current, newAgentSessionIds };
		});
	}, []);

	useEffect(() => {
		if (!active || syncState.nextIndex >= JIRA_GOLDEN_JOURNEY_V4_SYNC_SESSIONS.length) {
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
				const batch = takeJiraGoldenJourneyV4SyncBatch(syncState.nextIndex);
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
			}, getJiraGoldenJourneyV4SyncDelayMs());
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
	}, [active, syncState]);

	return {
		newAgentSessionIds: syncState.newAgentSessionIds,
		reviewAgentSessions,
		syncedAgentSessions: syncState.syncedAgentSessions,
	};
}
