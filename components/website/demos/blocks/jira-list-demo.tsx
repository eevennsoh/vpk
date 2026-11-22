"use client";

import { useLayoutEffect, useMemo, useState } from "react";

import { createButterPayBoardColumns } from "@/components/projects/butter-v1/data/presentation-story";
import { useButterList } from "@/components/projects/butter-v1/hooks/use-butter-list";

import { JiraList, type JiraListVariant } from "@/components/blocks/jira-list";

function JiraListVariantDemo({ variant }: Readonly<{ variant: JiraListVariant }>) {
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
		<div className="w-full min-w-0 rounded-lg bg-surface p-4 md:p-5">
			<JiraList
				{...listProps}
				variant={variant}
				onRefresh={() => {
					setColumns(createButterPayBoardColumns());
					listProps.onRefresh?.();
				}}
			/>
		</div>
	);
}

export function JiraListDemoProjectButter() {
	return <JiraListVariantDemo variant="project-butter" />;
}

export function JiraListDemoClassic() {
	return <JiraListVariantDemo variant="classic" />;
}

export default JiraListDemoProjectButter;
