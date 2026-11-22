import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { JiraBacklogSprintMove } from "@/components/blocks/jira-backlog";
import { INITIAL_BUTTER_BACKLOG_ORDER, moveButterBacklogItems, type ButterBacklogOrder } from "../lib/backlog-order";
import { createButterPayBoardColumns } from "../data/presentation-story";
import { createButterWacBoardColumns, finishWacReviewAgents, normalizeWacBoardCurrentUser, WAC_REVIEW_FINISH_DELAY_MS } from "@/components/projects/butter-v1/data/wac-content";

type ContentMode = "default" | "wac";
type DetachedSessions = Readonly<Record<string, readonly AgentSessionItem[]>>;

interface ContentSnapshot {
	boardColumns: JiraKanbanColumnData[];
	detachedAgentSessionsByCard: DetachedSessions;
	backlogOrder: ButterBacklogOrder;
}

function resolveUpdate<T>(update: SetStateAction<T>, current: T): T {
	return typeof update === "function" ? (update as (value: T) => T)(current) : update;
}

/** Each preset owns its edited cards and unlinked sessions across switches. */
export function useButterContent() {
	const [contentMode, setContentMode] = useState<ContentMode>("default");
	const [snapshots, setSnapshots] = useState<Record<ContentMode, ContentSnapshot>>(() => ({
		default: { boardColumns: createButterPayBoardColumns(), detachedAgentSessionsByCard: {}, backlogOrder: INITIAL_BUTTER_BACKLOG_ORDER },
		wac: { boardColumns: createButterWacBoardColumns(), detachedAgentSessionsByCard: {}, backlogOrder: INITIAL_BUTTER_BACKLOG_ORDER },
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
	const moveBacklogItems = useCallback((move: JiraBacklogSprintMove) => {
		setSnapshots((current) => ({
			...current,
			[contentMode]: {
				...current[contentMode],
				backlogOrder: moveButterBacklogItems(current[contentMode].backlogOrder, move),
			},
		}));
	}, [contentMode]);
	const updateBacklogOrder = useCallback((sectionId: string, issueKeys: readonly string[]) => {
		setSnapshots((current) => {
			const snapshot = current[contentMode];
			const field = sectionId === "backlog" ? "backlogKeys" : "sprintKeys";
			return {
				...current,
				[contentMode]: { ...snapshot, backlogOrder: { ...snapshot.backlogOrder, [field]: issueKeys } },
			};
		});
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
		moveBacklogItems,
		updateBacklogOrder,
		toggleWacContent,
		wacContent: contentMode === "wac",
	};
}
