"use client";

import type { ComponentProps } from "react";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { JIRA_LIST_CELL_CLASS, JIRA_LIST_HEADER_CELL_CLASS, type JiraListVariant } from "@/components/blocks/jira-list/jira-list-appearance";

export { JIRA_LIST_HEADER_CELL_CLASS, type JiraListVariant } from "@/components/blocks/jira-list/jira-list-appearance";

export function JiraListTable({ "aria-label": label, className, containerProps, variant = "project-butter", ...props }: Readonly<ComponentProps<typeof Table> & { variant?: JiraListVariant }>) {
	return <Table
		{...props}
		aria-label={label}
		containerProps={label ? { role: "region", "aria-label": `${label} columns`, tabIndex: 0, ...containerProps } : containerProps}
		className={cn(
			"table-fixed border-separate border-spacing-0",
			variant === "classic"
				? "[&_th]:border-b [&_th]:border-r [&_th]:border-border [&_td]:border-b [&_td]:border-r [&_td]:border-border [&_tr>*:last-child]:border-r-0 [&_tbody_tr:last-child>td]:border-b-0 [&_tr[data-summary-editing=true]>td]:border-r-transparent"
				: "[&_thead_th:first-child]:rounded-l-xl [&_thead_th:last-child]:rounded-r-xl",
			className,
		)}
		data-jira-list-variant={variant}
	/>;
}

export function JiraListTableHead({ className, ...props }: Readonly<ComponentProps<typeof TableHead>>) {
	return <TableHead {...props} className={cn(JIRA_LIST_HEADER_CELL_CLASS, className)} scope="col" />;
}

export function JiraListTableCell({ className, ...props }: Readonly<ComponentProps<typeof TableCell>>) {
	return <TableCell {...props} className={cn(JIRA_LIST_CELL_CLASS, className)} />;
}
