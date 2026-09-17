"use client";

import { useMemo } from "react";

import type {
	AgentSessionItem,
	AgentSessionWorkItemDraft,
	AgentSessionWorkItemOption,
} from "@/components/blocks/agent-session";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

import {
	createBoardCardFromDraft,
	linkBoardCardToSession,
} from "../lib/board-menu-work-item";
import { appendBoardCardFromDraft, toAgentSessionWorkItemOptions, boardHasWorkItem } from "../lib/board-work-item-options";

export interface BoardMenuWorkItem {
	readonly onCreateColumnWorkItem: (columnTitle: string, draft: AgentSessionWorkItemDraft) => void;
	readonly workItemOptions: readonly AgentSessionWorkItemOption[];
	readonly onLinkWorkItem: (item: AgentSessionItem, workItemKey?: string) => void;
	readonly onCreateWorkItemFromDraft: (
		item: AgentSessionItem,
		draft: AgentSessionWorkItemDraft,
	) => void;
}

/**
 * What the session card's Link work item submenu needs from the board.
 *
 * Both actions have the same two-branch shape: defer to the host's own
 * capability when it wired one, otherwise operate on the board this page
 * already owns. The fallback is not a convenience — a picker whose rows swallow
 * clicks and a name field that discards what you typed read as broken controls,
 * not absent ones, and the block's demo route supplies neither capability.
 *
 * Lives beside the page rather than inside it because the page is already at its
 * size budget, and this is a self-contained concern with its own seam.
 */
export function useBoardMenuWorkItem({
	boardColumns,
	hostCreate,
	hostLink,
	onCapture,
	updateBoardColumns,
}: Readonly<{
	boardColumns: readonly JiraKanbanColumnData[];
	/**
	 * The host's create path, already bound to a column. Undefined when the host
	 * owns no board creation, which sends creates to the local fallback.
	 *
	 * Callers deliver the typed name by overriding the session's own `title`:
	 * that field is what the board's create path reads for the card summary, so
	 * passing it there spares every layer below from learning what a draft is.
	 * The menu names no column, unlike a drag, so new work lands at the head of
	 * the board's flow.
	 */
	hostCreate?: (item: AgentSessionItem, draft: AgentSessionWorkItemDraft) => void;
	/** The host's link path. Undefined sends links to the local fallback. */
	hostLink?: (item: AgentSessionItem, workItemKey?: string) => void;
	onCapture: (item: AgentSessionItem) => void;
	updateBoardColumns: (
		updater: (columns: readonly JiraKanbanColumnData[]) => readonly JiraKanbanColumnData[],
	) => void;
}>): BoardMenuWorkItem {
	const workItemOptions = useMemo(
		() => toAgentSessionWorkItemOptions(boardColumns),
		[boardColumns],
	);

	return {
		onCreateColumnWorkItem: (columnTitle, draft) => {
			updateBoardColumns((columns) => appendBoardCardFromDraft(columns, draft, columnTitle).columns);
		},
		onCreateWorkItemFromDraft: (item, draft) => {
			if (hostCreate !== undefined) {
				hostCreate(item, draft);
				return;
			}
			// Capture hides the session from untracked work, so it may only follow a
			// mutation that actually lands a card. An empty board has nowhere to put
			// one, and capturing anyway would lose the session to no work item.
			if (boardColumns.length === 0) {
				return;
			}

			updateBoardColumns((columns) => createBoardCardFromDraft(columns, item, draft));
			onCapture(item);
		},
		onLinkWorkItem: (item, workItemKey) => {
			if (hostLink !== undefined) {
				hostLink(item, workItemKey);
				return;
			}
			if (workItemKey === undefined || !boardHasWorkItem(boardColumns, workItemKey)) {
				return;
			}

			updateBoardColumns((columns) => linkBoardCardToSession(columns, item, workItemKey));
			onCapture(item);
		},
		workItemOptions,
	};
}
