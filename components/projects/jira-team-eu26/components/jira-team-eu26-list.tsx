"use client";

import { useLayoutEffect, useMemo } from "react";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { JiraList, type JiraListProps, type JiraListRowData } from "@/components/blocks/jira-list";
import { cn } from "@/lib/utils";

interface JiraTeamEu26ListProps {
	addAgentLabel: string;
	columns: readonly JiraKanbanColumnData[];
	getProps: (columns: readonly JiraKanbanColumnData[]) => JiraListProps;
	onVisibleRowsChange: (rows: readonly JiraListRowData[]) => void;
	rowFlash: JiraListProps["rowFlash"];
	agentSessionDropIntent?: JiraListProps["agentSessionDropIntent"];
	onTrailingContentUnderlapChange: JiraListProps["onTrailingContentUnderlapChange"];
	scrollEndInset: number;
	trailingOverlayRef: JiraListProps["trailingOverlayRef"];
}

const PANEL_END_GAP_PX = 24;

export function JiraTeamEu26List({
	addAgentLabel,
	columns,
	getProps,
	onVisibleRowsChange,
	scrollEndInset,
	...layout
}: Readonly<JiraTeamEu26ListProps>) {
	const listProps = useMemo(() => getProps(columns), [columns, getProps]);
	useLayoutEffect(() => {
		onVisibleRowsChange(listProps.rows);
	}, [listProps.rows, onVisibleRowsChange]);

	return (
		<div className={cn(
			"min-h-0 flex-1 overflow-hidden pb-4 ps-6 md:pb-5",
			scrollEndInset > 0 ? "pe-0" : "pe-4 md:pe-5",
		)}>
			<JiraList
				{...listProps}
				{...layout}
				addAgentLabel={addAgentLabel}
				scrollEndInset={scrollEndInset > 0 ? scrollEndInset + PANEL_END_GAP_PX : 0}
			/>
		</div>
	);
}
