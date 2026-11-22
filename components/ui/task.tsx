"use client"

// oxlint-disable react-doctor/no-multi-comp -- Task parts compose one Trace pattern.

import * as React from "react"

import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceLine,
	TraceTitle,
	type TraceCollapsibleContentProps,
	type TraceCollapsibleProps,
	type TraceCollapsibleTriggerProps,
	type TraceLineProps,
} from "@/components/ui/trace"
import { cn } from "@/lib/utils"

export type TaskProps = TraceCollapsibleProps

function Task({ defaultOpen = true, ...props }: Readonly<TaskProps>) {
	return (
		<Trace data-slot="task">
			<TraceCollapsible defaultOpen={defaultOpen} {...props} />
		</Trace>
	)
}

export type TaskTriggerProps = TraceCollapsibleTriggerProps & {
	title: string
}

function TaskTrigger({ title, children, ...props }: Readonly<TaskTriggerProps>) {
	return (
		<TraceCollapsibleTrigger {...props}>
			{children ?? (
				<TraceLine>
					<TraceTitle>{title}</TraceTitle>
				</TraceLine>
			)}
		</TraceCollapsibleTrigger>
	)
}

export type TaskContentProps = TraceCollapsibleContentProps

function TaskContent({ children, keepMounted = true, ...props }: Readonly<TaskContentProps>) {
	return (
		<TraceCollapsibleContent keepMounted={keepMounted} {...props}>
			<Trace>{children}</Trace>
		</TraceCollapsibleContent>
	)
}

export type TaskItemProps = TraceLineProps

function TaskItem({ children, ...props }: Readonly<TaskItemProps>) {
	return (
		<TraceLine data-slot="task-item" {...props}>
			<TraceTitle>{children}</TraceTitle>
		</TraceLine>
	)
}

export type TaskItemFileProps = React.ComponentProps<"div">

function TaskItemFile({ className, ...props }: Readonly<TaskItemFileProps>) {
	return (
		<div
			data-slot="task-item-file"
			className={cn(
				"inline-flex w-fit items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs text-foreground",
				className
			)}
			{...props}
		/>
	)
}

export { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile }
