"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface TableProps extends React.ComponentProps<"table"> {
	containerClassName?: string
	containerProps?: React.ComponentProps<"div">
}

function Table({ className, containerClassName, containerProps, ...props }: Readonly<TableProps>) {
	return (
		<div
			{...containerProps}
			data-slot="table-container"
			className={cn("relative w-full overflow-x-auto", containerProps?.className, containerClassName)}
		>
			<table
				data-slot="table"
				className={cn("w-full caption-bottom text-sm", className)}
				{...props}
			/>
		</div>
	)
}

type TableHeaderProps = React.ComponentProps<"thead">

function TableHeader({ className, ...props }: Readonly<TableHeaderProps>) {
	return (
		<thead
			data-slot="table-header"
			className={cn("[&_tr]:border-b-2 [&_tr]:border-border", className)}
			{...props}
		/>
	)
}

type TableBodyProps = React.ComponentProps<"tbody">

function TableBody({ className, ...props }: Readonly<TableBodyProps>) {
	return (
		<tbody
			data-slot="table-body"
			className={cn("[&_tr:last-child]:border-0", className)}
			{...props}
		/>
	)
}

type TableFooterProps = React.ComponentProps<"tfoot">

function TableFooter({ className, ...props }: Readonly<TableFooterProps>) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn(
				"bg-surface-sunken border-t font-medium [&>tr]:last:border-b-0",
				className,
			)}
			{...props}
		/>
	)
}

type TableRowProps = React.ComponentProps<"tr">

function TableRow({ className, ...props }: Readonly<TableRowProps>) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				"border-b border-border transition-colors",
				"hover:bg-bg-neutral-subtle-hovered",
				"data-[state=selected]:bg-bg-selected",
				className,
			)}
			{...props}
		/>
	)
}

type TableHeadProps = React.ComponentProps<"th">

function TableHead({ className, ...props }: Readonly<TableHeadProps>) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"h-9 px-2 text-left align-middle text-xs font-semibold text-text-subtlest whitespace-nowrap",
				"has-[[role=checkbox]]:pr-0",
				className,
			)}
			{...props}
		/>
	)
}

type TableCellProps = React.ComponentProps<"td">

function TableCell({ className, ...props }: Readonly<TableCellProps>) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"p-2 align-middle whitespace-nowrap",
				"has-[[role=checkbox]]:pr-0",
				className,
			)}
			{...props}
		/>
	)
}

type TableCaptionProps = React.ComponentProps<"caption">

function TableCaption({ className, ...props }: Readonly<TableCaptionProps>) {
	return (
		<caption
			data-slot="table-caption"
			className={cn("text-text-subtlest mt-4 text-sm", className)}
			{...props}
		/>
	)
}

export {
	Table,
	TableHeader,
	TableBody,
	TableFooter,
	TableHead,
	TableRow,
	TableCell,
	TableCaption,
	type TableProps,
	type TableHeaderProps,
	type TableBodyProps,
	type TableFooterProps,
	type TableRowProps,
	type TableHeadProps,
	type TableCellProps,
	type TableCaptionProps,
}
