"use client";

import { useCallback, useState } from "react";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { ExperimentalJiraKanbanPageProps } from "@/components/blocks/jira-kanban/experimental/experimental-page-types";

export function useAgentSessionReview(
	defaultCollapsed: boolean,
	suggestSessionBoardLinkOnHover: boolean,
	onAgentSessionsReviewed: ExperimentalJiraKanbanPageProps["onAgentSessionsReviewed"],
) {
	const [agentSessionColumnCollapsed, setAgentSessionColumnCollapsed] = useState(defaultCollapsed);
	const [untrackedHoveredSession, setUntrackedHoveredSession] = useState<AgentSessionItem | null>(null);
	const [previousDefaultCollapsed, setPreviousDefaultCollapsed] = useState(defaultCollapsed);
	// A content preset can change the starting state without remounting the board.
	if (previousDefaultCollapsed !== defaultCollapsed) {
		setPreviousDefaultCollapsed(defaultCollapsed);
		setAgentSessionColumnCollapsed(defaultCollapsed);
	}
	const handleUntrackedItemHover = useCallback((item: AgentSessionItem | null) => {
		if (suggestSessionBoardLinkOnHover) {
			setUntrackedHoveredSession(item);
		}
		if (item !== null) {
			onAgentSessionsReviewed?.([item.id]);
		}
	}, [onAgentSessionsReviewed, suggestSessionBoardLinkOnHover]);
	const handleAgentSessionColumnCollapsedChange = useCallback((nextCollapsed: boolean) => {
		setAgentSessionColumnCollapsed(nextCollapsed);
		if (!nextCollapsed) {
			onAgentSessionsReviewed?.();
		}
	}, [onAgentSessionsReviewed]);

	return {
		agentSessionColumnCollapsed,
		handleAgentSessionColumnCollapsedChange,
		handleUntrackedItemHover,
		untrackedHoveredSession: suggestSessionBoardLinkOnHover ? untrackedHoveredSession : null,
	};
}
