"use client";

import type { ComponentProps, HTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	CheckCircle2Icon,
	ChevronRightIcon,
	CircleDotIcon,
	CircleIcon,
	XCircleIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import { createContext, use, useMemo } from "react";

type TestStatus = "passed" | "failed" | "skipped" | "running";

interface TestResultSummaryData {
	passed: number;
	failed: number;
	skipped: number;
	total: number;
	duration?: number;
}

interface TestResultContextType {
	summary?: TestResultSummaryData;
}

const TestResultContext = createContext<TestResultContextType>({});

function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

export type TestResultProps = HTMLAttributes<HTMLDivElement> & {
	summary?: TestResultSummaryData;
};

export function TestResult({
	summary,
	className,
	children,
	...props
}: Readonly<TestResultProps>) {
	const contextValue = useMemo(() => ({ summary }), [summary]);

	return (
		<TestResultContext value={contextValue}>
			<div
				className={cn("rounded-lg border bg-background", className)}
				{...props}
			>
				{children ??
					(summary && (
						<TestResultHeader>
							<TestResultSummary />
							<TestResultDuration />
						</TestResultHeader>
					))}
			</div>
		</TestResultContext>
	);
}

export type TestResultHeaderProps = HTMLAttributes<HTMLDivElement>;

export function TestResultHeader({
	className,
	children,
	...props
}: Readonly<TestResultHeaderProps>) {
	return (
		<div
			className={cn(
				"flex items-center justify-between border-b px-4 py-3",
				className
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export type TestResultSummaryProps = HTMLAttributes<HTMLDivElement>;

export function TestResultSummary({
	className,
	children,
	...props
}: Readonly<TestResultSummaryProps>) {
	const { summary } = use(TestResultContext);

	if (!summary) {
		return null;
	}

	return (
		<div className={cn("flex items-center gap-3", className)} {...props}>
			{children ?? (
				<>
					<Badge
						className="gap-1 bg-green-100 text-green-700"
						variant="neutral"
					>
						<CheckCircle2Icon className="size-3" />
						{summary.passed} passed
					</Badge>
					{summary.failed > 0 ? (
						<Badge
							className="gap-1 bg-red-100 text-red-700"
							variant="neutral"
						>
							<XCircleIcon className="size-3" />
							{summary.failed} failed
						</Badge>
					) : null}
					{summary.skipped > 0 ? (
						<Badge
							className="gap-1 bg-yellow-100 text-yellow-700"
							variant="neutral"
						>
							<CircleIcon className="size-3" />
							{summary.skipped} skipped
						</Badge>
					) : null}
				</>
			)}
		</div>
	);
}

export type TestResultDurationProps = HTMLAttributes<HTMLSpanElement>;

export function TestResultDuration({
	className,
	children,
	...props
}: Readonly<TestResultDurationProps>) {
	const { summary } = use(TestResultContext);

	if (!summary?.duration) {
		return null;
	}

	return (
		<span className={cn("text-muted-foreground text-sm", className)} {...props}>
			{children ?? formatDuration(summary.duration)}
		</span>
	);
}

export type TestResultProgressProps = HTMLAttributes<HTMLDivElement>;

export function TestResultProgress({
	className,
	children,
	...props
}: Readonly<TestResultProgressProps>) {
	const { summary } = use(TestResultContext);

	if (!summary) {
		return null;
	}

	const passedPercent = (summary.passed / summary.total) * 100;
	const failedPercent = (summary.failed / summary.total) * 100;

	return (
		<div className={cn("space-y-2", className)} {...props}>
			{children ?? (
				<>
					<div className="flex h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="bg-green-500 transition-all"
							style={{ width: `${passedPercent}%` }}
						/>
						<div
							className="bg-red-500 transition-all"
							style={{ width: `${failedPercent}%` }}
						/>
					</div>
					<div className="flex justify-between text-muted-foreground text-xs">
						<span>
							{summary.passed}/{summary.total} tests passed
						</span>
						<span>{passedPercent.toFixed(0)}%</span>
					</div>
				</>
			)}
		</div>
	);
}

export type TestResultContentProps = HTMLAttributes<HTMLDivElement>;

export function TestResultContent({
	className,
	children,
	...props
}: Readonly<TestResultContentProps>) {
	return (
		<div className={cn("space-y-2 p-4", className)} {...props}>
			{children}
		</div>
	);
}

interface TestSuiteContextType {
	name: string;
	status: TestStatus;
}

const TestSuiteContext = createContext<TestSuiteContextType>({
	name: "",
	status: "passed",
});

export type TestSuiteProps = ComponentProps<typeof Collapsible> & {
	name: string;
	status: TestStatus;
};

export function TestSuite({
	name,
	status,
	className,
	children,
	...props
}: Readonly<TestSuiteProps>) {
	const contextValue = useMemo(() => ({ name, status }), [name, status]);

	return (
		<TestSuiteContext value={contextValue}>
			<Collapsible className={cn("rounded-lg border", className)} {...props}>
				{children}
			</Collapsible>
		</TestSuiteContext>
	);
}

export type TestSuiteNameProps = ComponentProps<typeof CollapsibleTrigger>;

export function TestSuiteName({
	className,
	children,
	...props
}: Readonly<TestSuiteNameProps>) {
	const { name, status } = use(TestSuiteContext);

	return (
		<CollapsibleTrigger
			className={cn(
				"group flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50",
				className
			)}
			{...props}
		>
			<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
			<TestStatusIcon status={status} />
			<span className="font-medium text-sm">{children ?? name}</span>
		</CollapsibleTrigger>
	);
}

export type TestSuiteStatsProps = HTMLAttributes<HTMLDivElement> & {
	passed?: number;
	failed?: number;
	skipped?: number;
};

export function TestSuiteStats({
	passed = 0,
	failed = 0,
	skipped = 0,
	className,
	children,
	...props
}: Readonly<TestSuiteStatsProps>) {
	return (
		<div
			className={cn("ml-auto flex items-center gap-2 text-xs", className)}
			{...props}
		>
			{children ?? (
				<>
					{passed > 0 ? (
						<span className="text-green-600">
							{passed} passed
						</span>
					) : null}
					{failed > 0 ? (
						<span className="text-red-600">
							{failed} failed
						</span>
					) : null}
					{skipped > 0 ? (
						<span className="text-yellow-600">
							{skipped} skipped
						</span>
					) : null}
				</>
			)}
		</div>
	);
}

export type TestSuiteContentProps = ComponentProps<typeof CollapsibleContent>;

export function TestSuiteContent({
	className,
	children,
	...props
}: Readonly<TestSuiteContentProps>) {
	return (
		<CollapsibleContent className={cn("border-t", className)} {...props}>
			<div className="divide-y">{children}</div>
		</CollapsibleContent>
	);
}

interface TestContextType {
	name: string;
	status: TestStatus;
	duration?: number;
}

const TestContext = createContext<TestContextType>({
	name: "",
	status: "passed",
});

export type TestProps = HTMLAttributes<HTMLDivElement> & {
	name: string;
	status: TestStatus;
	duration?: number;
};

export function Test({
	name,
	status,
	duration,
	className,
	children,
	...props
}: Readonly<TestProps>) {
	const contextValue = useMemo(
		() => ({ duration, name, status }),
		[duration, name, status]
	);

	return (
		<TestContext value={contextValue}>
			<div
				className={cn("flex items-center gap-2 px-4 py-2 text-sm", className)}
				{...props}
			>
				{children ?? (
					<>
						<TestStatus />
						<TestName />
						{duration !== undefined ? <TestDuration /> : null}
					</>
				)}
			</div>
		</TestContext>
	);
}

const statusStyles: Record<TestStatus, string> = {
	failed: "text-red-600",
	passed: "text-green-600",
	running: "text-blue-600",
	skipped: "text-yellow-600",
};

const statusIcons: Record<TestStatus, React.ReactNode> = {
	failed: <XCircleIcon className="size-4" />,
	passed: <CheckCircle2Icon className="size-4" />,
	running: <CircleDotIcon className="size-4 animate-pulse" />,
	skipped: <CircleIcon className="size-4" />,
};

function TestStatusIcon({ status }: Readonly<{ status: TestStatus }>) {
	return (
		<span className={cn("shrink-0", statusStyles[status])}>
			{statusIcons[status]}
		</span>
	);
}

export type TestStatusProps = HTMLAttributes<HTMLSpanElement>;

export function TestStatus({
	className,
	children,
	...props
}: Readonly<TestStatusProps>) {
	const { status } = use(TestContext);

	return (
		<span
			className={cn("shrink-0", statusStyles[status], className)}
			{...props}
		>
			{children ?? statusIcons[status]}
		</span>
	);
}

export type TestNameProps = HTMLAttributes<HTMLSpanElement>;

export function TestName({ className, children, ...props }: Readonly<TestNameProps>) {
	const { name } = use(TestContext);

	return (
		<span className={cn("flex-1", className)} {...props}>
			{children ?? name}
		</span>
	);
}

export type TestDurationProps = HTMLAttributes<HTMLSpanElement>;

export function TestDuration({
	className,
	children,
	...props
}: Readonly<TestDurationProps>) {
	const { duration } = use(TestContext);

	if (duration === undefined) {
		return null;
	}

	return (
		<span
			className={cn("ml-auto text-muted-foreground text-xs", className)}
			{...props}
		>
			{children ?? `${duration}ms`}
		</span>
	);
}

export type TestErrorProps = HTMLAttributes<HTMLDivElement>;

export function TestError({
	className,
	children,
	...props
}: Readonly<TestErrorProps>) {
	return (
		<div
			className={cn(
				"mt-2 rounded-md bg-red-50 p-3",
				className
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export type TestErrorMessageProps = HTMLAttributes<HTMLParagraphElement>;

export function TestErrorMessage({
	className,
	children,
	...props
}: Readonly<TestErrorMessageProps>) {
	return (
		<p
			className={cn(
				"font-medium text-red-700 text-sm",
				className
			)}
			{...props}
		>
			{children}
		</p>
	);
}

export type TestErrorStackProps = HTMLAttributes<HTMLPreElement>;

export function TestErrorStack({
	className,
	children,
	...props
}: Readonly<TestErrorStackProps>) {
	return (
		<pre
			className={cn(
				"mt-2 overflow-auto font-mono text-red-600 text-xs",
				className
			)}
			{...props}
		>
			{children}
		</pre>
	);
}
