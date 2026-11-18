"use client"

// oxlint-disable react-doctor/no-multi-comp -- Stack Trace parts compose one Trace pattern.

import * as React from "react"

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Button, type ButtonProps } from "@/components/ui/button"
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
} from "@/components/ui/trace"
import { CheckIcon, CircleXIcon, CopyIcon, FileCodeIcon, LayersIcon } from "@/components/ui/vpk-icons"
import { splitChildrenByType } from "@/lib/split-children-by-type"
import { cn } from "@/lib/utils"

const STACK_FRAME_WITH_PARENS_REGEX = /^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/
const STACK_FRAME_WITHOUT_FN_REGEX = /^at\s+(.+):(\d+):(\d+)$/
const ERROR_TYPE_REGEX = /^(\w+Error|Error):\s*(.*)$/
const AT_PREFIX_REGEX = /^at\s+/

export interface StackFrame {
	raw: string
	functionName: string | null
	filePath: string | null
	lineNumber: number | null
	columnNumber: number | null
	isInternal: boolean
}

interface ParsedStackTrace {
	errorType: string | null
	errorMessage: string
	errorLine: string
	frames: StackFrame[]
	raw: string
}

type FilePathClickHandler = (filePath: string, line?: number, column?: number) => void

interface StackTraceContextValue {
	trace: ParsedStackTrace
	raw: string
	onFilePathClick?: FilePathClickHandler
}

const StackTraceContext = React.createContext<StackTraceContextValue | null>(null)

function useStackTrace() {
	const context = React.use(StackTraceContext)
	if (!context) {
		throw new Error("StackTrace components must be used within StackTrace")
	}
	return context
}

function isInternalPath(path: string) {
	return path.includes("node_modules") || path.startsWith("node:") || path.includes("internal/")
}

function parseStackFrame(line: string): StackFrame {
	const raw = line.trim()
	const withParens = raw.match(STACK_FRAME_WITH_PARENS_REGEX)
	const withoutFn = withParens ? null : raw.match(STACK_FRAME_WITHOUT_FN_REGEX)
	const [functionName, filePath, lineNumber, columnNumber] = withParens
		? withParens.slice(1)
		: withoutFn
			? [null, ...withoutFn.slice(1)]
			: [null, null, null, null]

	return {
		raw,
		functionName,
		filePath,
		lineNumber: lineNumber ? Number.parseInt(lineNumber, 10) : null,
		columnNumber: columnNumber ? Number.parseInt(columnNumber, 10) : null,
		isInternal: filePath ? isInternalPath(filePath) : raw.includes("node_modules") || raw.includes("node:"),
	}
}

function parseStackTrace(trace: string): ParsedStackTrace {
	const lines = trace.split("\n").filter((line) => line.trim())

	if (lines.length === 0) {
		return { errorType: null, errorMessage: trace, errorLine: trace, frames: [], raw: trace }
	}

	const errorLine = lines[0].trim()
	const errorMatch = errorLine.match(ERROR_TYPE_REGEX)

	return {
		errorType: errorMatch ? errorMatch[1] : null,
		errorMessage: errorMatch ? (errorMatch[2] ?? "") : errorLine,
		errorLine,
		frames: lines
			.slice(1)
			.filter((line) => line.trim().startsWith("at "))
			.map(parseStackFrame),
		raw: trace,
	}
}

export type StackTraceProps = React.ComponentProps<"div"> & {
	trace: string
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	onFilePathClick?: FilePathClickHandler
}

function StackTrace({
	trace,
	open,
	defaultOpen = false,
	onOpenChange,
	onFilePathClick,
	children,
	...props
}: Readonly<StackTraceProps>) {
	const parsedTrace = React.useMemo(() => parseStackTrace(trace), [trace])
	const context = React.useMemo(
		() => ({ trace: parsedTrace, raw: trace, onFilePathClick }),
		[parsedTrace, trace, onFilePathClick]
	)
	const collapsibleProps =
		open === undefined
			? { defaultOpen, onOpenChange: (next: boolean) => onOpenChange?.(next) }
			: { open, onOpenChange: (next: boolean) => onOpenChange?.(next) }

	return (
		<StackTraceContext value={context}>
			<Trace data-slot="stack-trace" {...props}>
				<TraceCollapsible {...collapsibleProps}>{children}</TraceCollapsible>
			</Trace>
		</StackTraceContext>
	)
}

export type StackTraceHeaderProps = TraceCollapsibleTriggerProps & {
	/** Replaces the error icon, for example with the icon of the tool that failed. */
	icon?: React.ReactNode
}

function StackTraceHeader({ icon, children, ...props }: Readonly<StackTraceHeaderProps>) {
	// Buttons cannot sit inside the trigger, so the actions render next to it.
	const [line, actions] = splitChildrenByType(children, [StackTraceActions, StackTraceCopyButton])

	return (
		<div data-slot="stack-trace-header" className="flex max-w-full min-w-0 items-center gap-1">
			<TraceCollapsibleTrigger {...props}>
				<TraceLine status="error">
					<TraceIcon>{icon ?? <CircleXIcon label="" />}</TraceIcon>
					{line}
				</TraceLine>
			</TraceCollapsibleTrigger>
			{actions}
		</div>
	)
}

export type StackTraceErrorProps = React.ComponentProps<"span">

function StackTraceError({ children, ...props }: Readonly<StackTraceErrorProps>) {
	const { trace } = useStackTrace()

	return (
		<TraceTitle data-slot="stack-trace-error" {...props}>
			Failed: {children ?? trace.errorLine}
		</TraceTitle>
	)
}

export type StackTraceErrorTypeProps = React.ComponentProps<"span">

function StackTraceErrorType({ children, ...props }: Readonly<StackTraceErrorTypeProps>) {
	const { trace } = useStackTrace()
	const type = children ?? trace.errorType

	if (!type) {
		return null
	}

	return (
		<>
			<span data-slot="stack-trace-error-type" {...props}>
				{type}
			</span>
			{": "}
		</>
	)
}

export type StackTraceErrorMessageProps = React.ComponentProps<"span">

function StackTraceErrorMessage({ children, ...props }: Readonly<StackTraceErrorMessageProps>) {
	const { trace } = useStackTrace()

	return (
		<span data-slot="stack-trace-error-message" {...props}>
			{children ?? trace.errorMessage}
		</span>
	)
}

export type StackTraceActionsProps = React.ComponentProps<"div">

function StackTraceActions({ className, ...props }: Readonly<StackTraceActionsProps>) {
	return (
		<div data-slot="stack-trace-actions" className={cn("flex shrink-0 items-center gap-1", className)} {...props} />
	)
}

export type StackTraceCopyButtonProps = ButtonProps & {
	onCopy?: () => void
	onError?: (error: Error) => void
	timeout?: number
}

function StackTraceCopyButton({
	onCopy,
	onError,
	timeout,
	variant = "ghost",
	size = "icon-compact",
	children,
	onClick,
	...props
}: Readonly<StackTraceCopyButtonProps>) {
	const { raw } = useStackTrace()
	const { copied, copy } = useCopyToClipboard({ onCopy, onError, timeout })

	return (
		<Button
			data-slot="stack-trace-copy-button"
			variant={variant}
			size={size}
			aria-label={copied ? "Copied" : "Copy stack trace"}
			onClick={(event) => {
				onClick?.(event)
				void copy(raw)
			}}
			{...props}
		>
			{children ?? (copied ? <CheckIcon label="" /> : <CopyIcon label="" />)}
		</Button>
	)
}

export type StackTraceExpandButtonProps = React.ComponentProps<"div">

/** Renders nothing: the whole line opens the frames. Kept so existing compositions compile. */
function StackTraceExpandButton(_props: Readonly<StackTraceExpandButtonProps>) {
	return null
}

export type StackTraceContentProps = TraceCollapsibleContentProps & {
	maxHeight?: number
}

function StackTraceContent({ maxHeight = 400, children, ...props }: Readonly<StackTraceContentProps>) {
	return (
		<TraceCollapsibleContent {...props}>
			{/* -m-1 p-1 keeps the file path buttons' focus rings clear of the scrollport. */}
			<div className="-m-1 overflow-auto p-1" style={{ maxHeight }}>
				{children}
			</div>
		</TraceCollapsibleContent>
	)
}

export type StackTraceFramesProps = React.ComponentProps<"div"> & {
	showInternalFrames?: boolean
}

function FilePath({ frame, onFilePathClick }: Readonly<{ frame: StackFrame; onFilePathClick?: FilePathClickHandler }>) {
	const label = `${frame.filePath}${frame.lineNumber === null ? "" : `:${frame.lineNumber}`}${frame.columnNumber === null ? "" : `:${frame.columnNumber}`}`

	if (!onFilePathClick || !frame.filePath) {
		return <span>{label}</span>
	}

	const { filePath } = frame

	return (
		<button
			type="button"
			className="cursor-pointer rounded-sm underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
			onClick={() => onFilePathClick(filePath, frame.lineNumber ?? undefined, frame.columnNumber ?? undefined)}
		>
			{label}
		</button>
	)
}

function StackTraceFrames({ className, showInternalFrames = true, ...props }: Readonly<StackTraceFramesProps>) {
	const { trace, onFilePathClick } = useStackTrace()
	const frames = showInternalFrames ? trace.frames : trace.frames.filter((frame) => !frame.isInternal)

	return (
		<div
			data-slot="stack-trace-frames"
			className={cn("flex flex-col gap-2 rounded-md bg-muted p-3 font-mono text-xs", className)}
			{...props}
		>
			{/* The title truncates, so the full error repeats at the top of the frames. */}
			<p className="text-destructive">{trace.errorLine}</p>
			{frames.length > 0 ? (
				<ol className="flex flex-col gap-1">
					{frames.map((frame, index) => (
						<li key={`${frame.raw}-${index}`} className={frame.isInternal ? undefined : "text-foreground"}>
							at {frame.functionName ? `${frame.functionName} ` : null}
							{frame.filePath ? (
								<>
									(<FilePath frame={frame} onFilePathClick={onFilePathClick} />)
								</>
							) : null}
							{frame.filePath || frame.functionName ? null : frame.raw.replace(AT_PREFIX_REGEX, "")}
						</li>
					))}
				</ol>
			) : (
				<p>No stack frames</p>
			)}
		</div>
	)
}

export type StackTraceFrameLinksProps = React.ComponentProps<"div"> & {
	/** Where each of your own frames links. Defaults to `#file:line`. */
	getHref?: (frame: StackFrame) => string
}

function defaultFrameHref(frame: StackFrame) {
	return `#${frame.filePath}:${frame.lineNumber}`
}

/**
 * Your own frames as links to the file and line, with the framework frames
 * folded into a collapsible line of their own, so the frames you can fix come first.
 */
function StackTraceFrameLinks({ getHref = defaultFrameHref, className, ...props }: Readonly<StackTraceFrameLinksProps>) {
	const { trace, onFilePathClick } = useStackTrace()
	const appFrames = trace.frames.filter((frame) => !frame.isInternal)
	const internalFrames = trace.frames.filter((frame) => frame.isInternal)

	return (
		<div data-slot="stack-trace-frame-links" className={cn("flex flex-col gap-2", className)} {...props}>
			{/* The title truncates, so the full error repeats at the top of the frames. */}
			<p className="font-mono text-xs text-destructive">{trace.errorLine}</p>
			<Trace>
				{appFrames.map((frame, index) => (
					<a
						key={`${frame.raw}-${index}`}
						href={getHref(frame)}
						onClick={() => {
							if (onFilePathClick && frame.filePath) {
								onFilePathClick(frame.filePath, frame.lineNumber ?? undefined, frame.columnNumber ?? undefined)
							}
						}}
					>
						<TraceLine>
							<TraceIcon>
								<FileCodeIcon label="" />
							</TraceIcon>
							<TraceTitle>
								{frame.functionName ? `${frame.functionName} in ` : null}
								{frame.filePath}:{frame.lineNumber}
							</TraceTitle>
						</TraceLine>
					</a>
				))}
				{internalFrames.length > 0 ? (
					<TraceCollapsible>
						<TraceCollapsibleTrigger>
							<TraceLine>
								<TraceIcon>
									<LayersIcon label="" />
								</TraceIcon>
								<TraceTitle>{internalFrames.length} framework frames</TraceTitle>
							</TraceLine>
						</TraceCollapsibleTrigger>
						<TraceCollapsibleContent>
							<ol className="flex flex-col gap-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
								{internalFrames.map((frame, index) => (
									<li key={`${frame.raw}-${index}`} className="whitespace-nowrap">
										{frame.raw}
									</li>
								))}
							</ol>
						</TraceCollapsibleContent>
					</TraceCollapsible>
				) : null}
			</Trace>
		</div>
	)
}

export {
	StackTrace,
	StackTraceHeader,
	StackTraceError,
	StackTraceErrorType,
	StackTraceErrorMessage,
	StackTraceActions,
	StackTraceCopyButton,
	StackTraceExpandButton,
	StackTraceContent,
	StackTraceFrames,
	StackTraceFrameLinks,
}
