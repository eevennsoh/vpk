"use client"

// oxlint-disable react-doctor/no-multi-comp -- Terminal parts compose one Trace pattern.

import * as React from "react"

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { useHighlightedCode } from "@/hooks/use-highlighted-code"
import { Button, type ButtonProps } from "@/components/ui/button"
import { CodeBlock, CodeBlockContent, CodeBlockLine, type CodeBlockContentProps } from "@/components/ui/code-block"
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceCollapsibleTriggerProps,
	type TraceLineProps,
} from "@/components/ui/trace"
import { CheckIcon, CopyIcon, TerminalIcon, Trash2Icon } from "@/components/ui/vpk-icons"
import { splitChildrenByType } from "@/lib/split-children-by-type"
import { cn } from "@/lib/utils"

interface TerminalContextValue {
	output: string
	isStreaming: boolean
	autoScroll: boolean
	onClear?: () => void
}

const TerminalContext = React.createContext<TerminalContextValue>({
	output: "",
	isStreaming: false,
	autoScroll: true,
})

export type TerminalProps = React.ComponentProps<"div"> & {
	output: string
	isStreaming?: boolean
	autoScroll?: boolean
	onClear?: () => void
	/** Starts the output open. After that the reader's click wins, as with `open ?? running` in Trace. */
	defaultOpen?: boolean
}

function Terminal({
	output,
	isStreaming = false,
	autoScroll = true,
	onClear,
	defaultOpen,
	children,
	...props
}: Readonly<TerminalProps>) {
	// Open once output arrives while the command runs; the reader's click wins after that.
	const [open, setOpen] = React.useState<boolean | undefined>(defaultOpen)
	const context = React.useMemo(
		() => ({ output, isStreaming, autoScroll, onClear }),
		[output, isStreaming, autoScroll, onClear]
	)

	return (
		<TerminalContext value={context}>
			<Trace data-slot="terminal" {...props}>
				<TraceCollapsible open={open ?? (isStreaming && output.length > 0)} onOpenChange={setOpen}>
					{children ?? (
						<>
							<TerminalHeader>
								<TerminalTitle />
								<TerminalStatus />
								<TerminalActions>
									<TerminalCopyButton />
									<TerminalClearButton />
								</TerminalActions>
							</TerminalHeader>
							<TerminalContent />
						</>
					)}
				</TraceCollapsible>
			</Trace>
		</TerminalContext>
	)
}

export type TerminalHeaderProps = TraceCollapsibleTriggerProps & {
	/** TraceLine status. Defaults to `running` while streaming; set `error` for a non-zero exit code. */
	status?: TraceLineProps["status"]
}

function TerminalHeader({ status, children, ...props }: Readonly<TerminalHeaderProps>) {
	const { output, isStreaming } = React.use(TerminalContext)
	const lineStatus = status ?? (isStreaming ? "running" : undefined)
	// Buttons cannot sit inside the trigger, so status and actions render next to it.
	const [line, rest] = splitChildrenByType(children, [
		TerminalStatus,
		TerminalActions,
		TerminalCopyButton,
		TerminalClearButton,
	])

	return (
		<div data-slot="terminal-header" className="flex max-w-full min-w-0 items-center gap-2">
			{/* With no output there is nothing to open, so the command is a plain line. */}
			{output ? (
				<TraceCollapsibleTrigger {...props}>
					<TraceLine status={lineStatus}>{line}</TraceLine>
				</TraceCollapsibleTrigger>
			) : (
				<TraceLine status={lineStatus}>{line}</TraceLine>
			)}
			{rest}
		</div>
	)
}

export type TerminalTitleProps = React.ComponentProps<"span"> & {
	/** Replaces the terminal icon, for example with a status icon. */
	icon?: React.ReactNode
}

function TerminalTitle({ icon, children, ...props }: Readonly<TerminalTitleProps>) {
	return (
		<>
			<TraceIcon>{icon ?? <TerminalIcon label="" />}</TraceIcon>
			<TraceTitle data-slot="terminal-title" {...props}>
				{children ?? "Terminal"}
			</TraceTitle>
		</>
	)
}

export type TerminalStatusProps = React.ComponentProps<"span">

function TerminalStatus({ className, children, ...props }: Readonly<TerminalStatusProps>) {
	const { isStreaming } = React.use(TerminalContext)

	if (!isStreaming) {
		return null
	}

	return (
		<span
			data-slot="terminal-status"
			className={cn("shrink-0 text-xs text-muted-foreground shimmer motion-reduce:shimmer-none", className)}
			{...props}
		>
			{children ?? "Running"}
		</span>
	)
}

export type TerminalActionsProps = React.ComponentProps<"div">

function TerminalActions({ className, ...props }: Readonly<TerminalActionsProps>) {
	return <div data-slot="terminal-actions" className={cn("flex shrink-0 items-center gap-1", className)} {...props} />
}

export type TerminalCopyButtonProps = ButtonProps & {
	onCopy?: () => void
	onError?: (error: Error) => void
	timeout?: number
}

function TerminalCopyButton({
	onCopy,
	onError,
	timeout,
	variant = "ghost",
	size = "icon-compact",
	children,
	onClick,
	...props
}: Readonly<TerminalCopyButtonProps>) {
	const { output } = React.use(TerminalContext)
	const { copied, copy } = useCopyToClipboard({ onCopy, onError, timeout })

	return (
		<Button
			data-slot="terminal-copy-button"
			variant={variant}
			size={size}
			aria-label={copied ? "Copied" : "Copy output"}
			onClick={(event) => {
				onClick?.(event)
				void copy(output)
			}}
			{...props}
		>
			{children ?? (copied ? <CheckIcon label="" /> : <CopyIcon label="" />)}
		</Button>
	)
}

export type TerminalClearButtonProps = ButtonProps

function TerminalClearButton({
	variant = "ghost",
	size = "icon-compact",
	children,
	...props
}: Readonly<TerminalClearButtonProps>) {
	const { onClear } = React.use(TerminalContext)

	if (!onClear) {
		return null
	}

	return (
		<Button
			data-slot="terminal-clear-button"
			variant={variant}
			size={size}
			aria-label="Clear output"
			onClick={onClear}
			{...props}
		>
			{children ?? <Trash2Icon label="" />}
		</Button>
	)
}

function useAutoScroll<T extends HTMLElement>(output: string, autoScroll: boolean) {
	const ref = React.useRef<T>(null)

	React.useEffect(() => {
		if (autoScroll && ref.current) {
			ref.current.scrollTop = ref.current.scrollHeight
		}
	}, [output, autoScroll])

	return ref
}

export type TerminalContentProps = CodeBlockContentProps

function TerminalOutputLines({ output }: Readonly<{ output: string }>) {
	// Decodes ANSI escape sequences into colored spans instead of printing them.
	const lines = useHighlightedCode(output, "ansi")

	return lines.map((line, index) => (
		// oxlint-disable-next-line react/no-array-index-key -- Lines have no identity beyond their position.
		<CodeBlockLine key={index}>{line}</CodeBlockLine>
	))
}

function TerminalContent({ className, children, ...props }: Readonly<TerminalContentProps>) {
	const { output, autoScroll } = React.use(TerminalContext)
	const ref = useAutoScroll<HTMLPreElement>(output, autoScroll)

	return (
		<TraceCollapsibleContent data-slot="terminal-content">
			<CodeBlock size="sm">
				<CodeBlockContent
					ref={ref}
					wrap
					data-language="ansi"
					className={cn("max-h-64", className)}
					{...props}
				>
					{children ?? <TerminalOutputLines output={output} />}
				</CodeBlockContent>
			</CodeBlock>
		</TraceCollapsibleContent>
	)
}

export {
	Terminal,
	TerminalHeader,
	TerminalTitle,
	TerminalStatus,
	TerminalActions,
	TerminalCopyButton,
	TerminalClearButton,
	TerminalContent,
}
