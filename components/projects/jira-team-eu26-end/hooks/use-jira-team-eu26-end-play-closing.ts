"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { JiraKanbanIssueMoveRequest } from "@/components/blocks/jira-kanban/experimental/hooks/use-issue-move-request";
import type { TopNavigationSettingsMenuItem } from "@/components/blocks/top-navigation/page";

import { applyJiraTeamEu26EndClosingMove, resolveJiraTeamEu26EndClosingAction } from "../lib/keynote-closing";

/**
 * Settings → "Play closing". An incomplete board asks the kanban to play one
 * cohort drop into Done (its drop visuals run, then the finale's own "all
 * Done" transition fires). A complete board bumps the finale's replay request.
 */
export function useJiraTeamEu26EndPlayClosing({ boardColumns, boardVisible, setBoardColumns }: Readonly<{
	boardColumns: readonly JiraKanbanColumnData[];
	/** The kanban can only play the drop while it is on screen. */
	boardVisible: boolean;
	setBoardColumns: Dispatch<SetStateAction<JiraKanbanColumnData[]>>;
}>) {
	const [closingMoveRequest, setClosingMoveRequest] = useState<JiraKanbanIssueMoveRequest>();
	const [finaleReplayRequest, setFinaleReplayRequest] = useState(0);
	const playClosing = useCallback(() => {
		const action = resolveJiraTeamEu26EndClosingAction(boardColumns);
		if (action.kind === "replay") {
			setFinaleReplayRequest((current) => current + 1);
		} else if (boardVisible) {
			setClosingMoveRequest((current) => ({ ...action.move, id: (current?.id ?? 0) + 1 }));
		} else {
			// List view has no board to animate; commit the same drop directly.
			setBoardColumns((columns) => applyJiraTeamEu26EndClosingMove(columns, action.move));
		}
	}, [boardColumns, boardVisible, setBoardColumns]);
	const settingsMenuItems = useMemo<readonly TopNavigationSettingsMenuItem[]>(() => [
		{ id: "play-closing", label: "Play closing", onSelect: playClosing },
	], [playClosing]);
	return { closingMoveRequest, finaleReplayRequest, settingsMenuItems };
}
