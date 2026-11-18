"use client"

// oxlint-disable react-doctor/no-multi-comp -- Tool parts compose one Trace pattern.

import type { DynamicToolUIPart, ToolUIPart } from "ai"
import * as React from "react"

import { useHighlightedCode } from "@/hooks/use-highlighted-code"
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockLine,
	CodeBlockTitle,
	type CodeBlockProps,
} from "@/components/ui/code-block"
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceCollapsibleContentProps,
	type TraceCollapsibleProps,
	type TraceLineProps,
} from "@/components/ui/trace"
import { formatByteSize, stringifyToolValue, toToolValuePreview } from "@/components/ui/tool-value"
import { WrenchIcon } from "@/components/ui/vpk-icons"
import { cn } from "@/lib/utils"

export type ToolPart = ToolUIPart | DynamicToolUIPart
type ToolState = ToolPart["state"]
type CodeBlockSize = NonNullable<CodeBlockProps["size"]>

export type ToolProps = TraceCollapsibleProps

function Tool({ className, ...props }: Readonly<ToolProps>) {
	return (
		<Trace data-slot="tool" className={cn("not-prose", className)}>
			<TraceCollapsible {...props} />
		</Trace>
	)
}

const TOOL_LINE: Record<ToolState, { verb: string; status: TraceLineProps["status"] }> = {
	"input-streaming": { verb: "Running", status: "running" },
	"input-available": { verb: "Running", status: "running" },
	"approval-requested": { verb: "Waiting to run", status: "pending" },
	"approval-responded": { verb: "Running", status: "running" },
	"output-available": { verb: "Ran", status: undefined },
	"output-error": { verb: "Failed to run", status: "error" },
	"output-denied": { verb: "Denied", status: undefined },
}

export type ToolHeaderProps = {
	/** The tool's display name; the line reads "Running {title}", "Ran {title}" and so on. Defaults to the name in `type`. */
	title?: string
	/** The whole line text, for callers that already phrase the action ("Searching Confluence"). Replaces the verb and title. */
	label?: string
	className?: string
	leadingIcon?: React.ReactNode
} & (
	| { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
	| { type: DynamicToolUIPart["type"]; state: DynamicToolUIPart["state"]; toolName: string }
)

function ToolHeader({ className, leadingIcon, title, label, type, state, toolName }: Readonly<ToolHeaderProps>) {
	const name = title ?? (type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-"))
	const { verb, status } = TOOL_LINE[state]

	return (
		<TraceCollapsibleTrigger className={className}>
			<TraceLine status={status}>
				<TraceIcon>{leadingIcon ?? <WrenchIcon label="" />}</TraceIcon>
				<TraceTitle>{label ?? `${verb} ${name}`}</TraceTitle>
			</TraceLine>
		</TraceCollapsibleTrigger>
	)
}

export type ToolContentProps = TraceCollapsibleContentProps

function ToolContent({ className, ...props }: Readonly<ToolContentProps>) {
	return <TraceCollapsibleContent className={cn("flex flex-col gap-2", className)} {...props} />
}

function ToolCodeBlock({
	code,
	title,
	language,
	size,
	variant,
}: Readonly<{ code: string; title: string; language: string; size: CodeBlockSize; variant?: CodeBlockProps["variant"] }>) {
	const lines = useHighlightedCode(code, language)

	return (
		<CodeBlock size={size} variant={variant}>
			<CodeBlockHeader>
				<CodeBlockTitle>{title}</CodeBlockTitle>
				<CodeBlockActions>
					<CodeBlockCopyButton value={code} />
				</CodeBlockActions>
			</CodeBlockHeader>
			<CodeBlockContent wrap data-language={language} className="max-h-64">
				{lines.map((line, index) => (
					// oxlint-disable-next-line react/no-array-index-key -- Lines have no identity beyond their position.
					<CodeBlockLine key={index}>{line}</CodeBlockLine>
				))}
			</CodeBlockContent>
		</CodeBlock>
	)
}

function ToolNote({ children }: Readonly<{ children: React.ReactNode }>) {
	return <p className="text-xs text-muted-foreground">{children}</p>
}

export type ToolInputProps = React.ComponentProps<"div"> & {
	codeBlockSize?: CodeBlockSize
	input: ToolPart["input"]
}

function ToolInput({ className, codeBlockSize = "sm", input, ...props }: Readonly<ToolInputProps>) {
	const preview = toToolValuePreview(input)
	if (!preview.text) {
		return null
	}

	return (
		<div data-slot="tool-input" className={cn("flex min-w-0 flex-col gap-1", className)} {...props}>
			<ToolCodeBlock code={preview.text} title="Parameters" language="json" size={codeBlockSize} />
			{preview.truncated ? <ToolNote>Parameters truncated for performance.</ToolNote> : null}
		</div>
	)
}

export type ToolOutputProps = React.ComponentProps<"div"> & {
	codeBlockSize?: CodeBlockSize
	output: ToolPart["output"]
	outputPreview?: string
	errorText: ToolPart["errorText"]
	outputTruncated?: boolean
	outputBytes?: number
	suppressedRawOutput?: boolean
}

function ToolOutput({
	className,
	codeBlockSize = "sm",
	output,
	outputPreview,
	errorText,
	outputTruncated,
	outputBytes,
	suppressedRawOutput,
	...props
}: Readonly<ToolOutputProps>) {
	if ((output === undefined || output === null) && !errorText) {
		return null
	}

	const hasOutput = output !== undefined && output !== null
	const isElement = React.isValidElement(output)
	// Show the exact output unless the caller says it was dropped or it is a rendered element.
	const showExact = hasOutput && !isElement && suppressedRawOutput !== true
	const preview =
		typeof outputPreview === "string" && outputPreview.length > 0
			? { text: outputPreview, truncated: outputTruncated === true }
			: toToolValuePreview(output)
	const outputText = showExact ? stringifyToolValue(output) : preview.text
	const showTruncationNotice = !showExact && (outputTruncated === true || preview.truncated)
	const language = typeof output === "object" && !isElement ? "json" : "markdown"
	const bytes = typeof outputBytes === "number" ? formatByteSize(outputBytes) : null

	return (
		<div data-slot="tool-output" className={cn("flex min-w-0 flex-col gap-1", className)} {...props}>
			{errorText ? (
				<ToolCodeBlock code={errorText} title="Error" language="text" size={codeBlockSize} variant="destructive" />
			) : null}
			{outputText ? (
				<ToolCodeBlock code={outputText} title="Result" language={language} size={codeBlockSize} />
			) : null}
			{showTruncationNotice ? (
				<ToolNote>Result preview truncated for display{bytes ? ` (${bytes} received)` : ""}.</ToolNote>
			) : null}
			{suppressedRawOutput === true ? (
				<ToolNote>Raw output is unavailable for this event. Showing the best preserved preview.</ToolNote>
			) : null}
		</div>
	)
}

const STATUS_LOZENGE: Record<ToolState, { label: string; variant: LozengeProps["variant"] }> = {
	"approval-requested": { label: "Awaiting Approval", variant: "warning" },
	"approval-responded": { label: "Responded", variant: "information" },
	"input-available": { label: "Running", variant: "information" },
	"input-streaming": { label: "Pending", variant: "neutral" },
	"output-available": { label: "Completed", variant: "success" },
	"output-denied": { label: "Denied", variant: "warning" },
	"output-error": { label: "Error", variant: "danger" },
}

/** The AI Elements status badge, kept for callers outside Tool; ToolHeader shows status in its line instead. */
// react-doctor-disable-next-line react-doctor/only-export-components -- Kept for consumers of the AI Elements Tool API.
export function getStatusLozenge(status: ToolState, { icon }: { icon?: React.ReactNode } = {}) {
	const { label, variant } = STATUS_LOZENGE[status]
	return (
		<Lozenge variant={variant} icon={icon} maxWidth={110}>
			{label}
		</Lozenge>
	)
}

export { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput }
