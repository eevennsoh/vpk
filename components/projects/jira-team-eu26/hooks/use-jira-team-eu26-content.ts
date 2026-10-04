import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { createJiraTeamEu26PayBoardColumns } from "../data/presentation-story";
import { createJiraTeamEu26WacBoardColumns, finishWacReviewAgents, normalizeWacBoardCurrentUser, WAC_REVIEW_FINISH_DELAY_MS } from "@/components/projects/jira-team-eu26/data/wac-content";

type ContentMode = "default" | "wac";
type DetachedSessions = Readonly<Record<string, readonly AgentSessionItem[]>>;

interface ContentSnapshot {
	boardColumns: JiraKanbanColumnData[];
	detachedAgentSessionsByCard: DetachedSessions;
}

function resolveUpdate<T>(update: SetStateAction<T>, current: T): T {
	return typeof update === "function" ? (update as (value: T) => T)(current) : update;
}

/** Each preset owns its edited cards and unlinked sessions across switches. */
export function useJiraTeamEu26Content() {
	const [contentMode, setContentMode] = useState<ContentMode>("default");
	const [snapshots, setSnapshots] = useState<Record<ContentMode, ContentSnapshot>>(() => ({
		default: { boardColumns: createJiraTeamEu26PayBoardColumns(), detachedAgentSessionsByCard: {} },
		wac: { boardColumns: createJiraTeamEu26WacBoardColumns(), detachedAgentSessionsByCard: {} },
	}));
	const defaultDetachedActivities = useRef<Record<string, JiraIssueAgentActivity>>({});
	const wacDetachedActivities = useRef<Record<string, JiraIssueAgentActivity>>({});
	const wacReviewFinishDeadline = useRef<number | null>(null);
	useEffect(() => {
		if (contentMode !== "wac") return;
		wacReviewFinishDeadline.current ??= Date.now() + WAC_REVIEW_FINISH_DELAY_MS;
		let timeoutId: number | undefined;
		let finished = false;
		const schedule = () => {
			if (timeoutId !== undefined) window.clearTimeout(timeoutId);
			if (finished || document.visibilityState !== "visible") return;
			timeoutId = window.setTimeout(() => {
				timeoutId = undefined;
				finished = true;
				setSnapshots((current) => {
					const boardColumns = finishWacReviewAgents(current.wac.boardColumns);
					return boardColumns === current.wac.boardColumns ? current : {
						...current,
						wac: { ...current.wac, boardColumns },
					};
				});
			}, Math.max(0, wacReviewFinishDeadline.current! - Date.now()));
		};
		schedule();
		document.addEventListener("visibilitychange", schedule);
		return () => {
			if (timeoutId !== undefined) window.clearTimeout(timeoutId);
			document.removeEventListener("visibilitychange", schedule);
		};
	}, [contentMode]);
	const setBoardColumns = useCallback((update: SetStateAction<JiraKanbanColumnData[]>) => {
		setSnapshots((current) => ({
			...current,
			[contentMode]: {
				...current[contentMode],
				boardColumns: contentMode === "wac"
					? normalizeWacBoardCurrentUser(resolveUpdate(update, current[contentMode].boardColumns))
					: resolveUpdate(update, current[contentMode].boardColumns),
			},
		}));
	}, [contentMode]);
	const setDetachedAgentSessionsByCard = useCallback((update: SetStateAction<DetachedSessions>) => {
		setSnapshots((current) => ({
			...current,
			[contentMode]: {
				...current[contentMode],
				detachedAgentSessionsByCard: resolveUpdate(update, current[contentMode].detachedAgentSessionsByCard),
			},
		}));
	}, [contentMode]);
	const toggleWacContent = useCallback(() => {
		setContentMode((current) => current === "wac" ? "default" : "wac");
	}, []);

	return {
		...snapshots[contentMode],
		contentMode,
		detachedActivitiesByIdRef: contentMode === "wac" ? wacDetachedActivities : defaultDetachedActivities,
		setBoardColumns,
		setDetachedAgentSessionsByCard,
		toggleWacContent,
		wacContent: contentMode === "wac",
	};
}
