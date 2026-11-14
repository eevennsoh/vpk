"use client"

// oxlint-disable react-doctor/jsx-no-constructed-context-values -- Context values in this file intentionally combine live state and setters; extracting them would not reduce meaningful consumer churn.

import * as React from "react"

import {
	Table,
	TableBody,
	TableCell,
	TableRow,
	type TableCellProps,
	type TableProps,
	type TableRowProps,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface ListColumn {
	/** Optional width/utility class applied to this column's `<col>`. */
	className?: string
}

export type ListRootProps = React.ComponentProps<"section">

function ListRoot({ className, ...props }: Readonly<ListRootProps>) {
	return (
		<section
			data-slot="list"
			className={cn("flex w-full flex-col gap-2", className)}
			{...props}
		/>
	)
}

export type ListHeadingProps = React.ComponentProps<"h2">

function ListHeading({ className, ...props }: Readonly<ListHeadingProps>) {
	return (
		<h2
			data-slot="list-heading"
			className={cn(
				"px-1.5 text-xs font-semibold leading-4 text-text-subtlest",
				className,
			)}
			{...props}
		/>
	)
}

// Position of a row within the list body, supplied by ListTable so the edge
// cells can round the outer corners of the list card.
interface ListRowPosition {
	isFirst: boolean
	isLast: boolean
}

const ListRowPositionContext = React.createContext<ListRowPosition>({
	isFirst: false,
	isLast: false,
})

export interface ListTableProps extends Omit<TableProps, "children"> {
	columns: readonly ListColumn[]
	children: React.ReactNode
}

function ListTable({
	columns,
	className,
	children,
	...props
}: Readonly<ListTableProps>) {
	// Annotate each row child with its position so List.Cell can round the
	// outer corners (the rounded card look) without consumers hand-rolling
	// per-edge radius classes.
	const rows = React.Children.toArray(children).filter(React.isValidElement)
	const lastIndex = rows.length - 1

	return (
		<Table
			data-slot="list-table"
			className={cn("min-w-full table-fixed", className)}
			{...props}
		>
			<colgroup>
				{columns.map((column, columnIndex) => (
					<col key={columnIndex} className={column.className} />
				))}
			</colgroup>
			<TableBody>
				{rows.map((row, rowIndex) => (
					<ListRowPositionContext
						key={row.key ?? rowIndex}
						value={{ isFirst: rowIndex === 0, isLast: rowIndex === lastIndex }}
					>
						{row}
					</ListRowPositionContext>
				))}
			</TableBody>
		</Table>
	)
}

export type ListRowProps = TableRowProps

function ListRow({ className, ...props }: Readonly<ListRowProps>) {
	return (
		<TableRow
			data-slot="list-row"
			// The hover highlight is applied per-cell (see List.Cell) so the
			// rounded outer corners can clip it; the row itself stays transparent.
			className={cn(
				"group/row h-14 border-disabled hover:bg-transparent",
				className,
			)}
			{...props}
		/>
	)
}

export interface ListCellProps extends TableCellProps {
	/**
	 * Marks this cell as the first/last in its row so it rounds the matching
	 * outer corners of the list card. Defaults to false.
	 */
	edge?: "leading" | "trailing"
}

function ListCell({ edge, className, ...props }: Readonly<ListCellProps>) {
	const { isFirst, isLast } = React.use(ListRowPositionContext)
	const radiusClass = cn(
		edge === "leading" && isFirst && "rounded-tl-xl",
		edge === "leading" && isLast && "rounded-bl-xl",
		edge === "trailing" && isFirst && "rounded-tr-xl",
		edge === "trailing" && isLast && "rounded-br-xl",
	)
	// Edge cells get outer padding so the first/last content sits visually
	// balanced against the rounded card corners; inner cells use 8px. The
	// leading edge uses 16px so the first cell's content aligns to the card
	// gutter; the trailing edge keeps 12px.
	const edgePaddingClass = cn(
		edge === "leading" && "pl-4",
		edge === "trailing" && "pr-3",
	)
	return (
		<TableCell
			data-slot="list-cell"
			className={cn(
				"px-2 transition-colors group-hover/row:bg-bg-neutral-subtle-hovered",
				edgePaddingClass,
				radiusClass,
				className,
			)}
			{...props}
		/>
	)
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const List = {
	Root: ListRoot,
	Heading: ListHeading,
	Table: ListTable,
	Row: ListRow,
	Cell: ListCell,
} as const

export { ListRoot, ListHeading, ListTable, ListRow, ListCell }
