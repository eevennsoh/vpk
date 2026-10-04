import type { AgentSessionItem } from "@/components/blocks/agent-session";

import {
	applyAgentSessionColumnFilter,
	countAgentSessionColumnFilterSelections,
	type AgentSessionColumnFilterContext,
	type AgentSessionColumnFilterState,
} from "./agent-session-column-filter";
import type { AgentSessionColumnView } from "./use-agent-session-column-hidden";

export interface AgentSessionColumnPools {
	/** Active (unarchived) rows, scoped by the header filter. */
	readonly activeRows: readonly AgentSessionItem[];
	readonly hasActiveFilters: boolean;
	/** The host handed in at least one archived row, before the header filter. */
	readonly hasArchivedRows: boolean;
	/** Archived rows, scoped by the same header filter. */
	readonly hiddenRows: readonly AgentSessionItem[];
}

export interface AgentSessionColumnViewModel {
	/** Rows the column paints: the open pool, scoped by the header filter. */
	readonly displayedItems: readonly AgentSessionItem[];
	/** Well footer number: the rows the other pool shows once it is opened. */
	readonly footerCount: number;
	readonly hasActiveFilters: boolean;
	/** Newly synced rows among `displayedItems` — the rail's unread notches. */
	readonly newCount: number;
	/** Header, rail and landmark total for `displayedItems`. */
	readonly sessionCount: number;
	/**
	 * Archived ids whose rows the host omitted (Agents focus, assignee scope)
	 * are not rows, so they never raise an Archived footer onto an empty list.
	 * A header filter that matches no archived row still shows Archived 0.
	 */
	readonly showWellFooter: boolean;
}

interface AgentSessionColumnPoolInput {
	readonly activeItems: readonly AgentSessionItem[];
	readonly filter: AgentSessionColumnFilterState;
	readonly filterContext?: AgentSessionColumnFilterContext;
	/** Archived rows already scoped to the host's `items`; ids alone are not rows. */
	readonly hiddenItems: readonly AgentSessionItem[];
	readonly showFilter: boolean;
}

interface AgentSessionColumnCountInput {
	/** Host override for the whole active pool; applies only while it is shown unfiltered. */
	readonly count?: number;
	readonly newItemIds?: ReadonlySet<string>;
	readonly view: AgentSessionColumnView;
}

/**
 * Scope both pools with the header filter. Unfiltered pools keep their
 * identity, so callers can memoize this step and keep row effects stable.
 */
export function scopeAgentSessionColumnPools({
	activeItems,
	filter,
	filterContext,
	hiddenItems,
	showFilter,
}: AgentSessionColumnPoolInput): AgentSessionColumnPools {
	const hasActiveFilters = showFilter && countAgentSessionColumnFilterSelections(filter) > 0;
	const hasArchivedRows = hiddenItems.length > 0;
	return hasActiveFilters
		? {
			activeRows: applyAgentSessionColumnFilter(activeItems, filter, filterContext),
			hasActiveFilters,
			hasArchivedRows,
			hiddenRows: applyAgentSessionColumnFilter(hiddenItems, filter, filterContext),
		}
		: { activeRows: activeItems, hasActiveFilters, hasArchivedRows, hiddenRows: hiddenItems };
}

/**
 * Every number the column shows, read from the same scoped rows it paints, so
 * a filter can never leave a badge describing rows it removed — the PR #1599
 * bug, where `newCount` still counted every active session.
 */
export function countAgentSessionColumnView({
	activeRows,
	count,
	hasActiveFilters,
	hasArchivedRows,
	hiddenRows,
	newItemIds,
	view,
}: AgentSessionColumnPools & AgentSessionColumnCountInput): AgentSessionColumnViewModel {
	const activeCount = hasActiveFilters ? activeRows.length : count ?? activeRows.length;
	const displayedItems = view === "hidden" ? hiddenRows : activeRows;

	return {
		displayedItems,
		footerCount: view === "hidden" ? activeCount : hiddenRows.length,
		hasActiveFilters,
		newCount: newItemIds === undefined
			? 0
			: displayedItems.filter((item) => newItemIds.has(item.id)).length,
		sessionCount: view === "hidden" ? hiddenRows.length : activeCount,
		showWellFooter: view === "hidden" || hasArchivedRows,
	};
}

/** The one owner of what the session column lists and every count it shows. */
export function selectAgentSessionColumnView(
	input: AgentSessionColumnPoolInput & AgentSessionColumnCountInput,
): AgentSessionColumnViewModel {
	return countAgentSessionColumnView({ ...scopeAgentSessionColumnPools(input), ...input });
}
