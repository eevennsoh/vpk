"use client";

import { useMemo, useState } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";

import {
	EMPTY_AGENT_SESSION_COLUMN_FILTER,
	type AgentSessionColumnFilterState,
} from "./agent-session-column-filter";
import {
	countAgentSessionColumnView,
	scopeAgentSessionColumnPools,
} from "./agent-session-column-view";
import type { AgentSessionColumnView } from "./use-agent-session-column-hidden";

/**
 * Filter state plus the column view it produces. Rows are memoized so row
 * effects stay stable; counts are recomputed from those same rows each render.
 */
export function useAgentSessionColumnFilter({
	activeItems,
	count,
	getSuggestedWorkItemKey,
	getSuggestedWorkItemKeys,
	hiddenItems,
	newItemIds,
	showFilter,
	view,
}: Readonly<{
	activeItems: readonly AgentSessionItem[];
	count?: number;
	getSuggestedWorkItemKey?: (item: AgentSessionItem) => string | undefined;
	getSuggestedWorkItemKeys?: (item: AgentSessionItem) => readonly string[] | undefined;
	hiddenItems: readonly AgentSessionItem[];
	newItemIds?: ReadonlySet<string>;
	showFilter: boolean;
	view: AgentSessionColumnView;
}>) {
	const [filter, setFilter] = useState<AgentSessionColumnFilterState>(
		EMPTY_AGENT_SESSION_COLUMN_FILTER,
	);
	const pools = useMemo(
		() => scopeAgentSessionColumnPools({
			activeItems,
			filter,
			filterContext: { getSuggestedWorkItemKey, getSuggestedWorkItemKeys },
			hiddenItems,
			showFilter,
		}),
		[activeItems, filter, getSuggestedWorkItemKey, getSuggestedWorkItemKeys, hiddenItems, showFilter],
	);

	return {
		...countAgentSessionColumnView({ ...pools, count, newItemIds, view }),
		filter,
		setFilter,
	};
}
