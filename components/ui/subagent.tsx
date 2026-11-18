"use client"

// oxlint-disable react-doctor/no-multi-comp -- Subagent parts compose one Trace pattern.

import * as React from "react"
import type { Tool } from "ai"

import { Badge } from "@/components/ui/badge"
import { CodeBlock, CodeBlockContent, CodeBlockHeader, CodeBlockTitle } from "@/components/ui/code-block"
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceCollapsibleContentProps,
	type TraceCollapsibleTriggerProps,
	type TraceLineProps,
} from "@/components/ui/trace"
import { BotIcon, CircleCheckIcon } from "@/components/ui/vpk-icons"
import { cn } from "@/lib/utils"

export type AgentProps = React.ComponentProps<"div"> & {
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
}

function Agent({ open, defaultOpen, onOpenChange, children, ...props }: Readonly<AgentProps>) {
	const collapsibleProps =
		open === undefined
			? { defaultOpen, onOpenChange: (next: boolean) => onOpenChange?.(next) }
			: { open, onOpenChange: (next: boolean) => onOpenChange?.(next) }

	return (
		<Trace data-slot="agent" {...props}>
			<TraceCollapsible {...collapsibleProps}>{children}</TraceCollapsible>
		</Trace>
	)
}

export type AgentHeaderProps = TraceCollapsibleTriggerProps & {
	/** The run, like "Ran the research agent". */
	name: string
	model?: string
	/** TraceLine status, such as `running` while the subagent works. */
	status?: TraceLineProps["status"]
	/** Replaces the default bot icon, for example with a spinner while running. */
	icon?: React.ReactNode
	/** Set false while the subagent has nothing to show yet, so the run is a plain line. */
	collapsible?: boolean
}

function AgentHeader({
	name,
	model,
	status,
	icon,
	collapsible = true,
	children,
	...props
}: Readonly<AgentHeaderProps>) {
	const line = (
		<TraceLine status={status}>
			<TraceIcon>{icon ?? <BotIcon label="" />}</TraceIcon>
			<TraceTitle>{name}</TraceTitle>
			{model ? (
				<Badge variant="neutral" className="shrink-0 font-mono">
					{model}
				</Badge>
			) : null}
			{children}
		</TraceLine>
	)

	if (!collapsible) {
		return line
	}

	return (
		<TraceCollapsibleTrigger data-slot="agent-header" {...props}>
			{line}
		</TraceCollapsibleTrigger>
	)
}

export type AgentContentProps = TraceCollapsibleContentProps

function AgentContent({ className, keepMounted = true, ...props }: Readonly<AgentContentProps>) {
	return (
		<TraceCollapsibleContent
			data-slot="agent-content"
			keepMounted={keepMounted}
			className={cn("flex flex-col gap-3", className)}
			{...props}
		/>
	)
}

export type AgentInstructionsProps = React.ComponentProps<"p"> & {
	children: string
}

function AgentInstructions(props: Readonly<AgentInstructionsProps>) {
	return <p data-slot="agent-instructions" {...props} />
}

export type AgentToolsProps = React.ComponentProps<"div">

function AgentTools(props: Readonly<AgentToolsProps>) {
	return <Trace data-slot="agent-tools" {...props} />
}

export type AgentToolProps = TraceLineProps & {
	/** An AI SDK tool; its description is the title unless children are given. */
	tool?: Tool
	/** Kept for compatibility with the Accordion version; unused. */
	value?: string
	icon?: React.ReactNode
	/** The tool call's output. Makes the line collapsible, with the output in a Code Block. */
	output?: string
}

function AgentTool({ tool, value: _value, icon, output, children, ...props }: Readonly<AgentToolProps>) {
	const description = typeof tool?.description === "string" ? tool.description : "No description"
	const line = (
		<TraceLine data-slot="agent-tool" {...props}>
			<TraceIcon>{icon ?? <CircleCheckIcon label="" />}</TraceIcon>
			<TraceTitle>{children ?? description}</TraceTitle>
		</TraceLine>
	)

	if (output === undefined) {
		return line
	}

	return (
		<TraceCollapsible>
			<TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
			<TraceCollapsibleContent>
				<CodeBlock size="sm">
					<CodeBlockContent wrap className="max-h-64">
						{output}
					</CodeBlockContent>
				</CodeBlock>
			</TraceCollapsibleContent>
		</TraceCollapsible>
	)
}

export type AgentOutputProps = React.ComponentProps<"div"> & {
	schema: string
}

function AgentOutput({ schema, ...props }: Readonly<AgentOutputProps>) {
	return (
		<CodeBlock data-slot="agent-output" size="sm" {...props}>
			<CodeBlockHeader>
				<CodeBlockTitle>Output schema</CodeBlockTitle>
			</CodeBlockHeader>
			<CodeBlockContent wrap className="max-h-64">
				{schema}
			</CodeBlockContent>
		</CodeBlock>
	)
}

export { Agent, AgentHeader, AgentContent, AgentInstructions, AgentTools, AgentTool, AgentOutput }
