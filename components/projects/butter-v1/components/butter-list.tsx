"use client";

import { useLayoutEffect, useMemo } from "react";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { JiraList, type JiraListProps, type JiraListRowData } from "@/components/blocks/jira-list";
import { useGroupedJiraRows, type JiraWorkItemGroup } from "@/components/blocks/jira-list/jira-list-grouping";
import { cn } from "@/lib/utils";

interface ButterListProps {
	addAgentLabel: string;
	columns: readonly JiraKanbanColumnData[];
	centered?: boolean;
	groups?: readonly JiraWorkItemGroup[];
	getProps: (columns: readonly JiraKanbanColumnData[]) => JiraListProps;
	onVisibleRowsChange: (rows: readonly JiraListRowData[]) => void;
	rowFlash: JiraListProps["rowFlash"];
	agentSessionDropIntent?: JiraListProps["agentSessionDropIntent"];
	onTrailingContentUnderlapChange: JiraListProps["onTrailingContentUnderlapChange"];
	scrollEndInset: number;
	trailingOverlayRef: JiraListProps["trailingOverlayRef"];
}

const PANEL_END_GAP_PX = 24;

export function ButterList({
	addAgentLabel,
	columns,
	centered = false,
	groups,
	getProps,
	onVisibleRowsChange,
	scrollEndInset,
	...layout
}: Readonly<ButterListProps>) {
	const listProps = useMemo(() => getProps(columns), [columns, getProps]);
	const grouped = useGroupedJiraRows(listProps.rows, groups);
	const rows = grouped?.items ?? listProps.rows;
	useLayoutEffect(() => {
		onVisibleRowsChange(rows);
	}, [rows, onVisibleRowsChange]);

	return (
		<div className={cn(
			// Add the board's transparent 2px drop border to match its painted gutter.
			"min-h-0 flex-1 overflow-hidden ps-6.5",
			centered ? "flex flex-col py-6" : "pb-6 pt-0.5",
			scrollEndInset > 0 ? "pe-0" : "pe-4 md:pe-5",
		)}>
			<JiraList
				{...listProps}
				{...layout}
				rows={rows}
				groupHeaders={grouped?.before}
				trailingGroupHeaders={grouped?.tail}
				onMoveRow={groups ? undefined : listProps.onMoveRow}
				addAgentLabel={addAgentLabel}
				hideStickyFooter
				className={cn(listProps.className, "max-h-full", centered && "my-auto")}
				scrollEndInset={scrollEndInset > 0 ? scrollEndInset + PANEL_END_GAP_PX : 0}
			/>
		</div>
	);
}
