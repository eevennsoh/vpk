"use client";

import { useLayoutEffect, useMemo, useState } from "react";

import { createButterPayBoardColumns } from "@/components/projects/butter/data/presentation-story";
import { useButterList } from "@/components/projects/butter/hooks/use-butter-list";

import { JiraList } from "@/components/blocks/jira-list";

export default function JiraListDemo() {
	const [columns, setColumns] = useState(createButterPayBoardColumns);
	const { getProps, onVisibleRowsChange } = useButterList({
		boardColumns: columns,
		setBoardColumns: setColumns,
	});
	const listProps = useMemo(() => getProps(columns), [columns, getProps]);

	useLayoutEffect(() => {
		onVisibleRowsChange(listProps.rows);
	}, [listProps.rows, onVisibleRowsChange]);

	return (
		<div className="rounded-lg bg-surface p-4 md:p-5">
			<JiraList
				{...listProps}
				onRefresh={() => {
					setColumns(createButterPayBoardColumns());
					listProps.onRefresh?.();
				}}
			/>
		</div>
	);
}
