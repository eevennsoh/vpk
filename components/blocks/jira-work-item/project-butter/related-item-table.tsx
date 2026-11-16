"use client";

import { JiraListTable, JiraListTableCell, JiraListTableHead } from "@/components/blocks/jira-list/jira-list-table";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { RelatedTableColumn } from "@/components/blocks/jira-work-item/project-butter/related-table-columns";
import type { RelatedListCardProps } from "@/components/blocks/jira-work-item/project-butter/related-list-card";
import { relatedListWindow } from "@/components/blocks/jira-work-item/project-butter/related-work-model";
import { cn } from "@/lib/utils";

export function ProjectButterRelatedItemTable<T>({ columns, composer, empty, expanded, items, label, onExpandedChange, renderItem, toggleDisabled = false }: Readonly<Omit<RelatedListCardProps<T>, "className"> & { columns: readonly RelatedTableColumn[] }>) {
	const page = relatedListWindow(items, { expanded, composerOpen: Boolean(composer) });
	const noun = label.toLowerCase();
	return (
		<div>
			<JiraListTable aria-label={label} style={{ minWidth: columns.reduce((width, column) => width + column.width, 0) }}>
				<colgroup>{columns.map((column) => <col key={column.id} style={column.id === "work" ? undefined : { width: column.width }} />)}</colgroup>
				<TableHeader><TableRow className="border-0 hover:bg-transparent">{columns.map((column) => <JiraListTableHead key={column.id}><span className={column.hideLabel ? "sr-only" : undefined}>{column.label}</span></JiraListTableHead>)}</TableRow></TableHeader>
				<TableBody>
					{composer ? <TableRow className="border-0"><JiraListTableCell className="px-0" colSpan={columns.length}><ul aria-label={`Add ${noun}`} className="list-none">{composer}</ul></JiraListTableCell></TableRow> : null}
					{page.shown.map((item, index) => renderItem(item, { index, faded: page.fadedIndex === index }))}
					{page.shown.length === 0 && !composer ? <TableRow className="border-0"><JiraListTableCell colSpan={columns.length}>{empty}</JiraListTableCell></TableRow> : null}
				</TableBody>
			</JiraListTable>
			{page.showToggle ? <div className={cn("-ml-2 mt-2", toggleDisabled && "opacity-(--opacity-disabled)")} inert={toggleDisabled || undefined}>
				<Button aria-expanded={expanded} aria-label={expanded ? `Show less ${noun}` : `Show ${page.hiddenCount} more ${noun}`} onClick={() => onExpandedChange(!expanded)} type="button" variant="ghost">{expanded ? "Show less" : `Show ${page.hiddenCount} more`}</Button>
			</div> : null}
		</div>
	);
}
