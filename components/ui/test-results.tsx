"use client"

// oxlint-disable react-doctor/no-multi-comp -- Test Results parts compose one Trace pattern.

import * as React from "react"

import { CodeBlock, CodeBlockContent, type CodeBlockProps } from "@/components/ui/code-block"
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceCollapsibleContentProps,
	type TraceCollapsibleProps,
	type TraceCollapsibleTriggerProps,
	type TraceLineProps,
} from "@/components/ui/trace"
import {
	CheckIcon,
	CircleDashedIcon,
	FileCodeIcon,
	FlaskConicalIcon,
	LoaderCircleIcon,
	XIcon,
} from "@/components/ui/vpk-icons"
import { cn } from "@/lib/utils"

type TestStatusValue = "passed" | "failed" | "skipped" | "running"

interface TestResultSummaryData {
	passed: number
	failed: number
	skipped: number
	total: number
	duration?: number
}

const TestResultContext = React.createContext<{ summary?: TestResultSummaryData }>({})

function formatDuration(ms: number): string {
	return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function formatCounts({ total, failed, skipped }: TestResultSummaryData) {
	return [`${total} tests`, failed > 0 ? `${failed} failed` : null, skipped > 0 ? `${skipped} skipped` : null]
		.filter(Boolean)
		.join(", ")
}

function lineStatus(status: TestStatusValue): TraceLineProps["status"] {
	if (status === "failed") {
		return "error"
	}
	return status === "running" ? "running" : undefined
}

export type TestResultProps = React.ComponentProps<"div"> & {
	summary?: TestResultSummaryData
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
}

function TestResult({
	summary,
	open,
	defaultOpen = true,
	onOpenChange,
	children,
	...props
}: Readonly<TestResultProps>) {
	const context = React.useMemo(() => ({ summary }), [summary])
	const collapsibleProps =
		open === undefined
			? { defaultOpen, onOpenChange: (next: boolean) => onOpenChange?.(next) }
			: { open, onOpenChange: (next: boolean) => onOpenChange?.(next) }

	return (
		<TestResultContext value={context}>
			<Trace data-slot="test-result" {...props}>
				<TraceCollapsible {...collapsibleProps}>
					{children ??
						(summary ? (
							<TestResultHeader>
								<TestResultSummary />
								<TestResultDuration />
							</TestResultHeader>
						) : null)}
				</TraceCollapsible>
			</Trace>
		</TestResultContext>
	)
}

export type TestResultHeaderProps = TraceCollapsibleTriggerProps & {
	/** TraceLine status. Defaults to `error` when a test failed; set `running` while the run is in progress. */
	status?: TraceLineProps["status"]
}

function TestResultHeader({ status, children, ...props }: Readonly<TestResultHeaderProps>) {
	const { summary } = React.use(TestResultContext)
	const line = (
		<TraceLine status={status ?? (summary && summary.failed > 0 ? "error" : undefined)}>
			<TraceIcon>
				<FlaskConicalIcon label="" />
			</TraceIcon>
			{children}
		</TraceLine>
	)

	// Without a summary there are no results to open yet, so the run is a plain line.
	if (!summary) {
		return line
	}

	return (
		<TraceCollapsibleTrigger data-slot="test-result-header" {...props}>
			{line}
		</TraceCollapsibleTrigger>
	)
}

export type TestResultSummaryProps = React.ComponentProps<"span">

function TestResultSummary({ children, ...props }: Readonly<TestResultSummaryProps>) {
	const { summary } = React.use(TestResultContext)

	if (!summary && children === undefined) {
		return null
	}

	return (
		<TraceTitle data-slot="test-result-summary" {...props}>
			{children ?? (summary ? `Ran ${formatCounts(summary)}` : null)}
		</TraceTitle>
	)
}

export type TestResultDurationProps = React.ComponentProps<"span">

function TestResultDuration({ children, ...props }: Readonly<TestResultDurationProps>) {
	const { summary } = React.use(TestResultContext)

	if (!summary?.duration) {
		return null
	}

	return (
		<TraceDescription data-slot="test-result-duration" {...props}>
			{children ?? formatDuration(summary.duration)}
		</TraceDescription>
	)
}

export type TestResultProgressProps = React.ComponentProps<"div">

function TestResultProgress({ className, children, ...props }: Readonly<TestResultProgressProps>) {
	const { summary } = React.use(TestResultContext)

	if (!summary) {
		return null
	}

	const passedPercent = (summary.passed / summary.total) * 100
	const failedPercent = (summary.failed / summary.total) * 100

	return (
		<div data-slot="test-result-progress" className={cn("mt-2 flex flex-col gap-2", className)} {...props}>
			{children ?? (
				<>
					<div className="flex h-2 overflow-hidden rounded-full bg-muted">
						<div className="bg-green-500 transition-all" style={{ width: `${passedPercent}%` }} />
						<div className="bg-red-500 transition-all" style={{ width: `${failedPercent}%` }} />
					</div>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>
							{summary.passed}/{summary.total} tests passed
						</span>
						<span>{passedPercent.toFixed(0)}%</span>
					</div>
				</>
			)}
		</div>
	)
}

export type TestResultContentProps = TraceCollapsibleContentProps

function TestResultContent({ children, keepMounted = true, ...props }: Readonly<TestResultContentProps>) {
	return (
		<TraceCollapsibleContent data-slot="test-result-content" keepMounted={keepMounted} {...props}>
			<Trace>{children}</Trace>
		</TraceCollapsibleContent>
	)
}

const TestSuiteContext = React.createContext<{ name: string; status: TestStatusValue }>({
	name: "",
	status: "passed",
})

export type TestSuiteProps = TraceCollapsibleProps & {
	name: string
	status: TestStatusValue
}

function TestSuite({ name, status, defaultOpen, ...props }: Readonly<TestSuiteProps>) {
	const context = React.useMemo(() => ({ name, status }), [name, status])

	return (
		<TestSuiteContext value={context}>
			<TraceCollapsible data-slot="test-suite" defaultOpen={defaultOpen ?? status === "failed"} {...props} />
		</TestSuiteContext>
	)
}

export type TestSuiteNameProps = TraceCollapsibleTriggerProps

function TestSuiteName({ children, ...props }: Readonly<TestSuiteNameProps>) {
	const { name, status } = React.use(TestSuiteContext)

	return (
		<TraceCollapsibleTrigger data-slot="test-suite-name" {...props}>
			<TraceLine status={lineStatus(status)}>
				<TraceIcon>
					<FileCodeIcon label="" />
				</TraceIcon>
				<TraceTitle>{children ?? name}</TraceTitle>
			</TraceLine>
		</TraceCollapsibleTrigger>
	)
}

export type TestSuiteStatsProps = React.ComponentProps<"span"> & {
	passed?: number
	failed?: number
	skipped?: number
}

function TestSuiteStats({
	passed = 0,
	failed = 0,
	skipped = 0,
	className,
	children,
	...props
}: Readonly<TestSuiteStatsProps>) {
	return (
		<span data-slot="test-suite-stats" className={cn("ms-2 inline-flex items-center gap-2 text-xs", className)} {...props}>
			{children ?? (
				<>
					{passed > 0 ? <span className="text-green-600">{passed} passed</span> : null}
					{failed > 0 ? <span className="text-red-600">{failed} failed</span> : null}
					{skipped > 0 ? <span className="text-yellow-600">{skipped} skipped</span> : null}
				</>
			)}
		</span>
	)
}

export type TestSuiteContentProps = TraceCollapsibleContentProps

function TestSuiteContent({ children, keepMounted = true, ...props }: Readonly<TestSuiteContentProps>) {
	return (
		<TraceCollapsibleContent data-slot="test-suite-content" keepMounted={keepMounted} {...props}>
			<Trace>{children}</Trace>
		</TraceCollapsibleContent>
	)
}

const TestContext = React.createContext<{ name: string; status: TestStatusValue; duration?: number }>({
	name: "",
	status: "passed",
})

export type TestProps = Omit<TraceLineProps, "status"> & {
	name: string
	status: TestStatusValue
	duration?: number
	/** The failure, such as its message and stack. Makes the test a collapsible line that opens on a TestError. */
	error?: React.ReactNode
	/** With `error`: whether the failure starts open. */
	defaultOpen?: boolean
}

function Test({ name, status, duration, error, defaultOpen, children, ...props }: Readonly<TestProps>) {
	const context = React.useMemo(() => ({ name, status, duration }), [name, status, duration])
	const line = (
		<TraceLine data-slot="test" status={lineStatus(status)} {...props}>
			{children ?? (
				<>
					<TestStatus />
					<TestName />
					{duration === undefined ? null : <TestDuration />}
				</>
			)}
		</TraceLine>
	)

	return (
		<TestContext value={context}>
			{error === undefined ? (
				line
			) : (
				<TraceCollapsible defaultOpen={defaultOpen}>
					<TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<TestError>{error}</TestError>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			)}
		</TestContext>
	)
}

const statusIcons: Record<TestStatusValue, React.ReactNode> = {
	passed: <CheckIcon label="" />,
	failed: <XIcon label="" />,
	skipped: <CircleDashedIcon label="" />,
	running: <LoaderCircleIcon label="" className="animate-spin" />,
}

export type TestStatusProps = React.ComponentProps<"span">

function TestStatus({ children, ...props }: Readonly<TestStatusProps>) {
	const { status } = React.use(TestContext)

	return (
		<TraceIcon data-slot="test-status" {...props}>
			{children ?? statusIcons[status]}
		</TraceIcon>
	)
}

export type TestNameProps = React.ComponentProps<"span">

function TestName({ children, ...props }: Readonly<TestNameProps>) {
	const { name, status } = React.use(TestContext)

	return (
		<TraceTitle data-slot="test-name" {...props}>
			{children ?? (status === "skipped" ? `Skipped ${name}` : name)}
		</TraceTitle>
	)
}

export type TestDurationProps = React.ComponentProps<"span">

function TestDuration({ children, ...props }: Readonly<TestDurationProps>) {
	const { duration } = React.use(TestContext)

	if (duration === undefined) {
		return null
	}

	return (
		<TraceDescription data-slot="test-duration" {...props}>
			{children ?? `${duration}ms`}
		</TraceDescription>
	)
}

export type TestErrorProps = CodeBlockProps

function TestError({ size = "sm", children, ...props }: Readonly<TestErrorProps>) {
	return (
		<CodeBlock data-slot="test-error" size={size} {...props}>
			<CodeBlockContent wrap className="max-h-64">
				{children}
			</CodeBlockContent>
		</CodeBlock>
	)
}

export type TestErrorMessageProps = React.ComponentProps<"span">

function TestErrorMessage({ className, ...props }: Readonly<TestErrorMessageProps>) {
	return <span data-slot="test-error-message" className={cn("block text-destructive", className)} {...props} />
}

export type TestErrorStackProps = React.ComponentProps<"span">

function TestErrorStack({ className, ...props }: Readonly<TestErrorStackProps>) {
	return <span data-slot="test-error-stack" className={cn("mt-2 block text-muted-foreground", className)} {...props} />
}

export {
	TestResult,
	TestResultHeader,
	TestResultSummary,
	TestResultDuration,
	TestResultProgress,
	TestResultContent,
	TestSuite,
	TestSuiteName,
	TestSuiteStats,
	TestSuiteContent,
	Test,
	TestStatus,
	TestName,
	TestDuration,
	TestError,
	TestErrorMessage,
	TestErrorStack,
}
