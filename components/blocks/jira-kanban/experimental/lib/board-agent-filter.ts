import type { JiraKanbanCardData, JiraKanbanColumnData } from "../../index";
import type { BoardAgentFilterId } from "../data/board-view-options";
import type { CollapsedBoardColumns } from "./board-column-collapse";

interface AgentFilterSession {
	readonly invokedBy?: {
		readonly avatarSrc?: string;
		readonly name: string;
	};
	readonly role?: "expired" | "owner" | "viewer";
	readonly state: string;
}

/** Prototype signed-in viewer — Pulse and Team EU26 both name this roster id. */
export const BOARD_AGENT_FILTER_VIEWER_ID = "venn";

export interface AgentFilterViewer {
	readonly avatarSrc?: string;
	readonly id?: string;
	readonly name: string;
}

export function resolveAgentFilterViewer(
	members: readonly Readonly<{
		avatarSrc?: string;
		id: string;
		name: string;
	}>[],
	viewerId: string = BOARD_AGENT_FILTER_VIEWER_ID,
): AgentFilterViewer | null {
	const viewer = members.find((member) => member.id === viewerId);
	if (viewer === undefined) {
		return null;
	}

	return {
		id: viewer.id,
		name: viewer.name,
		...(viewer.avatarSrc === undefined ? {} : { avatarSrc: viewer.avatarSrc }),
	};
}

function isNeedsInputSession(item: AgentFilterSession): boolean {
	return item.state === "needs-input" || item.state === "attention";
}

function sessionOwnedByViewer(
	item: AgentFilterSession,
	viewer: AgentFilterViewer | null,
): boolean {
	if (viewer === null) {
		return true;
	}

	if (item.invokedBy !== undefined) {
		return item.invokedBy.avatarSrc === viewer.avatarSrc
			|| item.invokedBy.name === viewer.name;
	}

	return (item.role ?? "owner") === "owner";
}

function sessionMatchesAgentFilterState(
	item: AgentFilterSession,
	filterId: BoardAgentFilterId,
): boolean {
	switch (filterId) {
		case "untracked":
			return true;
		case "working":
			return item.state === "running";
		case "needs-input":
			return isNeedsInputSession(item);
		case "finished":
			return item.state === "complete";
		default: {
			const _exhaustive: never = filterId;
			return _exhaustive;
		}
	}
}

/**
 * Does this unlink session belong in the Agents focus the header asked for?
 *
 * Needs input is "waiting on me": the row has to be awaiting input *and*
 * owned by the signed-in viewer. Working and Finished only match lifecycle.
 * Untracked is the whole column, so every row stays.
 */
export function sessionMatchesAgentFilter(
	item: AgentFilterSession,
	filterId: BoardAgentFilterId,
	viewer: AgentFilterViewer | null = null,
): boolean {
	if (!sessionMatchesAgentFilterState(item, filterId)) {
		return false;
	}

	return filterId === "needs-input" ? sessionOwnedByViewer(item, viewer) : true;
}

/**
 * Scope unlink sessions the same way the board scopes linked cards.
 *
 * A null focus returns the column as given. Needs input keeps the viewer's
 * own waiting rows and drops everyone else's.
 */
export function filterAgentSessionsByAgentFilter<T extends AgentFilterSession>(
	items: readonly T[],
	filterId: BoardAgentFilterId | null,
	viewer: AgentFilterViewer | null = null,
): readonly T[] {
	if (filterId === null) {
		return items;
	}

	return items.filter((item) => sessionMatchesAgentFilter(item, filterId, viewer));
}

/**
 * Does this card carry the linked-session chrome the Agents focus asked for?
 *
 * The single matcher behind both board scoping and column collapse, so a
 * column can never stay expanded on work its own cards no longer show.
 */
export function cardMatchesAgentFilter(
	card: JiraKanbanCardData,
	filterId: BoardAgentFilterId,
): boolean {
	switch (filterId) {
		case "untracked":
			return false;
		case "working":
			return card.agentActivities?.some((activity) => activity.state === "working") ?? false;
		case "needs-input":
			return card.agentActivities?.some((activity) => activity.state === "awaiting-input") ?? false;
		case "finished":
			return Boolean(card.agentDoneRuns?.length)
				|| (card.agentActivities?.some((activity) => activity.state === "completed") ?? false);
		default: {
			const _exhaustive: never = filterId;
			return _exhaustive;
		}
	}
}

function columnMatchesAgentFilter(
	column: JiraKanbanColumnData,
	filterId: BoardAgentFilterId,
): boolean {
	return column.cards.some((card) => cardMatchesAgentFilter(card, filterId));
}

/**
 * Scope the board to the work the Agents focus row is about.
 *
 * Focusing "Needs input" is a question about agents, not about a status
 * column: a card that merely shares a column with a waiting session is not
 * an answer, so it leaves the board while the focus is on. Column counts
 * follow the surviving cards the way the assignee filter's do.
 *
 * Untracked is not a card state — it lives in the session column — so it
 * returns the status columns as given instead of emptying the board.
 *
 * `columns` should already be assignee-scoped.
 */
export function filterJiraKanbanColumnsByAgentFilter(
	columns: readonly JiraKanbanColumnData[],
	filterId: BoardAgentFilterId | null,
): JiraKanbanColumnData[] {
	if (filterId === null || filterId === "untracked") {
		return [...columns];
	}

	return columns.map((column) => {
		const cards = column.cards.filter((card) => cardMatchesAgentFilter(card, filterId));
		return cards.length === column.cards.length
			? column
			: { ...column, cards, count: cards.length };
	});
}

/**
 * Status columns that have no work matching the View → Agents focus row.
 * Those columns collapse so the board can keep the matching work in view.
 * Clearing the menu restores the viewer's prior collapse set.
 *
 * `columns` should already be assignee-scoped.
 */
export function collapsedColumnsForAgentFilter({
	columns,
	filterId,
}: {
	columns: readonly JiraKanbanColumnData[];
	filterId: BoardAgentFilterId;
}): CollapsedBoardColumns {
	return new Set(
		columns
			.filter((column) => !columnMatchesAgentFilter(column, filterId))
			.map((column) => column.title),
	);
}

/**
 * Untracked and Needs input keep the session column open so their matching
 * unlink rows stay on screen. Working and Finished collapse it — those
 * focuses are about linked chrome on status columns.
 */
export function agentSessionColumnCollapsedForAgentFilter(
	filterId: BoardAgentFilterId,
): boolean {
	switch (filterId) {
		case "untracked":
		case "needs-input":
			return false;
		case "working":
		case "finished":
			return true;
		default: {
			const _exhaustive: never = filterId;
			return _exhaustive;
		}
	}
}

/**
 * Overlay the Agents focus on top of the viewer's collapse set. A focused
 * override records manual resize choices while the focus is active, including
 * expanding a column whose filtered card list is empty. The viewer set stays
 * untouched so a tab switch or Clear can restore it.
 *
 * `columns` should already be assignee-scoped.
 */
export function displayedCollapsedColumnsForAgentFilter({
	columns,
	filterId,
	focusedOverride,
	viewerCollapsed,
}: {
	columns: readonly JiraKanbanColumnData[];
	filterId: BoardAgentFilterId | null;
	focusedOverride?: CollapsedBoardColumns | null;
	viewerCollapsed: CollapsedBoardColumns;
}): CollapsedBoardColumns {
	return filterId === null
		? viewerCollapsed
		: focusedOverride ?? collapsedColumnsForAgentFilter({ columns, filterId });
}

/** Empty focused pools share the status columns' automatic collapse; clearing restores the viewer. */
export function displayedAgentSessionColumnCollapsedForAgentFilter(
	filterId: BoardAgentFilterId | null,
	viewerCollapsed: boolean,
	matchingSessionCount: number,
): boolean {
	return filterId === null
		? viewerCollapsed
		: matchingSessionCount === 0 || agentSessionColumnCollapsedForAgentFilter(filterId);
}
