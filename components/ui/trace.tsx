"use client"

// oxlint-disable react-doctor/no-multi-comp -- Trace parts are one compound primitive.

import * as React from "react"

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRightIcon } from "@/components/ui/vpk-icons"
import { cn } from "@/lib/utils"

export type TraceProps = React.ComponentProps<"div">

function Trace({ className, ...props }: Readonly<TraceProps>) {
	return (
		<div
			data-slot="trace"
			className={cn(
				"flex w-full min-w-0 flex-col gap-2 *:has-[>[data-slot=trace-line]]:flex *:has-[>[data-slot=trace-line]]:w-fit *:has-[>[data-slot=trace-line]]:max-w-full *:has-[>[data-slot=trace-line]]:min-w-0 *:has-[>[data-slot=trace-line]]:rounded-lg *:has-[>[data-slot=trace-line]]:text-left *:has-[>[data-slot=trace-line]]:outline-none *:has-[>[data-slot=trace-line]]:focus-visible:ring-3 *:has-[>[data-slot=trace-line]]:focus-visible:ring-ring/30",
				className
			)}
			{...props}
		/>
	)
}

export type TraceLineProps = React.ComponentProps<"span"> & {
	status?: "running" | "error" | "pending"
}

function TraceLine({ className, status, ...props }: Readonly<TraceLineProps>) {
	return (
		<span
			data-slot="trace-line"
			data-status={status}
			className={cn(
				"flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors in-[a,button]:cursor-pointer in-[a:hover,button:hover]:text-foreground data-[status=error]:text-destructive data-[status=error]:in-[a:hover,button:hover]:text-destructive data-[status=pending]:opacity-60 data-[status=running]:*:data-[slot=trace-title]:shimmer",
				className
			)}
			{...props}
		/>
	)
}

export type TraceIconProps = React.ComponentProps<"span">

function TraceIcon({ className, ...props }: Readonly<TraceIconProps>) {
	return (
		<span
			data-slot="trace-icon"
			aria-hidden="true"
			className={cn(
				"flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [[data-slot=trace-title]~&]:-ml-1",
				className
			)}
			{...props}
		/>
	)
}

export type TraceTitleProps = React.ComponentProps<"span">

function TraceTitle({ className, ...props }: Readonly<TraceTitleProps>) {
	return (
		<span
			data-slot="trace-title"
			className={cn("min-w-0 truncate motion-reduce:shimmer-none", className)}
			{...props}
		/>
	)
}

export type TraceDescriptionProps = React.ComponentProps<"span">

function TraceDescription({ className, ...props }: Readonly<TraceDescriptionProps>) {
	return (
		<span
			data-slot="trace-description"
			className={cn("shrink-0 text-muted-foreground/70 tabular-nums", className)}
			{...props}
		/>
	)
}

type CollapsibleProps = React.ComponentProps<typeof Collapsible>

export type TraceCollapsibleProps = Omit<CollapsibleProps, "open"> &
	(
		| { open?: undefined }
		| { open: boolean; onOpenChange: NonNullable<CollapsibleProps["onOpenChange"]> }
	)

function TraceCollapsible({ className, ...props }: Readonly<TraceCollapsibleProps>) {
	return (
		<Collapsible
			data-slot="trace-collapsible"
			className={cn("flex w-full min-w-0 flex-col", className)}
			{...props}
		/>
	)
}

export type TraceCollapsibleTriggerProps = React.ComponentProps<typeof CollapsibleTrigger>

function TraceCollapsibleTrigger({
	className,
	children,
	...props
}: Readonly<TraceCollapsibleTriggerProps>) {
	return (
		<CollapsibleTrigger
			data-slot="trace-collapsible-trigger"
			className={cn(
				"group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-lg text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 has-[[data-status=error]]:text-destructive",
				className
			)}
			{...props}
		>
			{children}
			<TraceIcon className="transition-transform duration-medium ease-in-out group-aria-expanded/trace-collapsible-trigger:rotate-90">
				<ChevronRightIcon label="" />
			</TraceIcon>
		</CollapsibleTrigger>
	)
}

export type TraceCollapsibleContentProps = React.ComponentProps<typeof CollapsibleContent>

function TraceCollapsibleContent({
	className,
	children,
	...props
}: Readonly<TraceCollapsibleContentProps>) {
	return (
		<CollapsibleContent
			data-slot="trace-collapsible-content"
			className="h-(--collapsible-panel-height) min-w-0 overflow-hidden transition-[height] duration-medium ease-in-out data-ending-style:h-0 data-starting-style:h-0"
			{...props}
		>
			<div
				data-slot="trace-collapsible-content-inner"
				className={cn(
					"mt-2 mb-1 ml-[calc(--spacing(2)-1px)] min-w-0 border-l pr-1 pl-4 leading-relaxed wrap-break-word text-muted-foreground",
					className
				)}
			>
				{children}
			</div>
		</CollapsibleContent>
	)
}

export {
	Trace,
	TraceLine,
	TraceIcon,
	TraceTitle,
	TraceDescription,
	TraceCollapsible,
	TraceCollapsibleTrigger,
	TraceCollapsibleContent,
}
