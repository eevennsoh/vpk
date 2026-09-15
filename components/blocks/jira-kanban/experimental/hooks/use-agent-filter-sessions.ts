"use client";

import { useMemo } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";

import type { BoardAgentFilterId } from "../data/board-view-options";
import {
	filterAgentSessionsByAgentFilter,
	resolveAgentFilterViewer,
} from "../lib/board-agent-filter";
import { selectBoardUntrackedSessions } from "../lib/board-untracked-sessions";

/**
 * Unlink rows for the session column, already scoped to the Agents focus.
 *
 * Capture and archive still run against the unscoped Pulse list; this hook
 * only decides what the column shows while a focus row is on.
 */
export function useAgentFilterSessions({
	agentFilterId,
	archivedItemIds,
	capturedItemIds,
	detachedByCard,
	members,
	sessions,
}: {
	agentFilterId: BoardAgentFilterId | null;
	archivedItemIds?: ReadonlySet<string>;
	capturedItemIds?: ReadonlySet<string>;
	detachedByCard?: Readonly<Record<string, readonly AgentSessionItem[]>>;
	members: readonly Readonly<{
		avatarSrc?: string;
		id: string;
		name: string;
	}>[];
	sessions: readonly AgentSessionItem[];
}): readonly AgentSessionItem[] {
	const untrackedSessions = useMemo(
		() => selectBoardUntrackedSessions({
			archivedItemIds,
			capturedItemIds,
			detachedByCard,
			sessions,
		}),
		[archivedItemIds, capturedItemIds, detachedByCard, sessions],
	);
	const viewer = useMemo(
		() => resolveAgentFilterViewer(members),
		[members],
	);

	return useMemo(
		() => filterAgentSessionsByAgentFilter(untrackedSessions, agentFilterId, viewer),
		[agentFilterId, untrackedSessions, viewer],
	);
}
