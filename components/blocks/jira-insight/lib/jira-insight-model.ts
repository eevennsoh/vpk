import type {
	JiraInsightCheckpoint,
	JiraInsightSelectionState,
	JiraInsightSnapshot,
} from "@/components/blocks/jira-insight/jira-insight-types";

export function sortJiraInsightCheckpoints<T extends Pick<JiraInsightCheckpoint, "capturedAtMs">>(
	checkpoints: readonly T[],
): T[] {
	return [...checkpoints].sort((a, b) => a.capturedAtMs - b.capturedAtMs);
}

function newestCheckpointId(snapshot: JiraInsightSnapshot): string | null {
	return sortJiraInsightCheckpoints(snapshot.checkpoints).at(-1)?.id ?? null;
}

export function createJiraInsightSelectionState(
	snapshot: JiraInsightSnapshot,
): JiraInsightSelectionState {
	return {
		activeCheckpointId: newestCheckpointId(snapshot),
		readCheckpointIds: [],
		revision: snapshot.revision,
	};
}

export function getUnreadCheckpointIds(
	snapshot: JiraInsightSnapshot,
	state: JiraInsightSelectionState,
): string[] {
	const unreadIds = new Set(snapshot.unreadCheckpointIds);
	const readIds = new Set(state.readCheckpointIds);
	return sortJiraInsightCheckpoints(snapshot.checkpoints)
		.filter((checkpoint) => unreadIds.has(checkpoint.id) && !readIds.has(checkpoint.id))
		.map((checkpoint) => checkpoint.id);
}

export function reconcileJiraInsightSelectionState(
	snapshot: JiraInsightSnapshot,
	state: JiraInsightSelectionState,
): JiraInsightSelectionState {
	if (!Object.is(snapshot.revision, state.revision)) {
		return createJiraInsightSelectionState(snapshot);
	}

	const checkpointIds = new Set(snapshot.checkpoints.map((checkpoint) => checkpoint.id));
	return {
		activeCheckpointId: state.activeCheckpointId && checkpointIds.has(state.activeCheckpointId)
			? state.activeCheckpointId
			: newestCheckpointId(snapshot),
		readCheckpointIds: state.readCheckpointIds.filter((id) => checkpointIds.has(id)),
		revision: state.revision,
	};
}

export function selectLatestUnreadCheckpoint(
	snapshot: JiraInsightSnapshot,
	state: JiraInsightSelectionState,
): JiraInsightSelectionState {
	const unreadCheckpointIds = getUnreadCheckpointIds(snapshot, state);
	const readIds = new Set(state.readCheckpointIds);
	for (const id of unreadCheckpointIds) readIds.add(id);

	return {
		activeCheckpointId: unreadCheckpointIds.at(-1) ?? state.activeCheckpointId,
		readCheckpointIds: [...readIds],
		revision: state.revision,
	};
}
