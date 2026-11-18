"use client"

// oxlint-disable react-doctor/no-multi-comp -- Reasoning parts compose one Trace pattern.
// oxlint-disable react-doctor/no-event-handler -- Effects bridge streaming state and auto-collapse timers, not user events.

import * as React from "react"

import { useControllableState } from "@/hooks/use-controllable-state"
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
	type TraceCollapsibleTriggerProps,
} from "@/components/ui/trace"
import {
	shouldAutoExpandReasoning,
	shouldScheduleCompletionAutoCollapse,
	shouldScheduleTimelineAutoCollapse,
	shouldScheduleToolIdleAutoCollapse,
} from "@/components/ui/reasoning-open-state"
import { RovoIcon } from "@/components/ui/vpk-icons"
import { getDefaultThinkingLabel, getReasoningCompletedLabel } from "@/lib/reasoning-labels"
import { cn } from "@/lib/utils"

type ReasoningContextValue = {
	isStreaming: boolean
	duration: number | undefined
	maxVisibleTimelineItems: number
	setTimelineEntryCount: (count: number) => void
}

const ReasoningContext = React.createContext<ReasoningContextValue | null>(null)

function useReasoning() {
	const context = React.use(ReasoningContext)
	if (!context) {
		throw new Error("Reasoning components must be used within Reasoning")
	}
	return context
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000
const DEFAULT_MAX_VISIBLE_TIMELINE_ITEMS = 5
const TIMELINE_STATUS_LINE_REGEX =
	/^(?:used|using|invoking|completed|running|calling|tool call failed|failed|detected intent)\b/i
const COMPLETED_STATUS_PREFIXES = ["used", "completed", "thought for"] as const

type TimelineEntry = { id: string; label: string }

function parseTimelineEntries(value: string): TimelineEntry[] {
	const lines = value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
	if (lines.length === 0 || !lines.every((line) => TIMELINE_STATUS_LINE_REGEX.test(line))) {
		return []
	}

	return lines.map((line, index) => ({
		id: `${index}-${line.toLowerCase().replace(/\s+/g, " ")}`,
		label: line,
	}))
}

/** True when every line of the text is a tool/status line ("Invoking search", "Tool call failed: …"). */
// react-doctor-disable-next-line react-doctor/only-export-components -- Consumers decide whether reasoning text is only a timeline.
export function isTimelineOnlyContent(value: string): boolean {
	return parseTimelineEntries(value).length > 0
}

function isCompletedStatusLabel(label: string) {
	const normalized = label.trim().toLowerCase()
	return COMPLETED_STATUS_PREFIXES.some(
		(prefix) => normalized === prefix || normalized.startsWith(`${prefix} `)
	)
}

export type ReasoningProps = Omit<TraceCollapsibleProps, "open" | "onOpenChange" | "defaultOpen"> & {
	isStreaming?: boolean
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	duration?: number
	autoExpandOnDetails?: boolean
	hasDetails?: boolean
	allowAutoCollapse?: boolean
	autoCollapseAtCount?: number
	collapseDelayMs?: number
	maxVisibleTimelineItems?: number
	toolsRunning?: boolean
}

function Reasoning({
	className,
	isStreaming = false,
	open,
	defaultOpen,
	onOpenChange,
	duration: durationProp,
	autoExpandOnDetails = false,
	hasDetails = false,
	allowAutoCollapse = true,
	autoCollapseAtCount = DEFAULT_MAX_VISIBLE_TIMELINE_ITEMS,
	collapseDelayMs = AUTO_CLOSE_DELAY,
	maxVisibleTimelineItems = DEFAULT_MAX_VISIBLE_TIMELINE_ITEMS,
	toolsRunning,
	children,
	...props
}: Readonly<ReasoningProps>) {
	const isExplicitlyClosed = defaultOpen === false
	const [isOpen, setIsOpen] = useControllableState<boolean>({
		defaultProp: defaultOpen ?? isStreaming,
		onChange: onOpenChange,
		prop: open,
	})
	const [duration, setDuration] = useControllableState<number | undefined>({
		defaultProp: undefined,
		prop: durationProp,
	})
	const [timelineEntryCount, setTimelineEntryCount] = React.useState(0)

	const hasEverStreamedRef = React.useRef(isStreaming)
	const startTimeRef = React.useRef<number | null>(null)
	const hasUserClosedRef = React.useRef(false)
	const hasAutoCollapsedAtCountRef = React.useRef(false)
	const hasAutoCollapsedOnCompletionRef = React.useRef(false)
	const prevStreamingRef = React.useRef(isStreaming)
	const prevToolsRunningRef = React.useRef(toolsRunning ?? false)

	// Time the stream and reset the auto-collapse guards when a new one starts.
	React.useEffect(() => {
		if (isStreaming && !prevStreamingRef.current) {
			hasUserClosedRef.current = false
			hasAutoCollapsedAtCountRef.current = false
			hasAutoCollapsedOnCompletionRef.current = false
		}

		if (isStreaming) {
			hasEverStreamedRef.current = true
			startTimeRef.current ??= Date.now()
		} else if (startTimeRef.current !== null) {
			setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S))
			startTimeRef.current = null
		}

		prevStreamingRef.current = isStreaming
	}, [isStreaming, setDuration])

	// Open while streaming unless the caller or the person closed it.
	React.useEffect(() => {
		if (isStreaming && !isOpen && !isExplicitlyClosed && !hasUserClosedRef.current) {
			setIsOpen(true)
		}
	}, [isExplicitlyClosed, isOpen, isStreaming, setIsOpen])

	React.useEffect(() => {
		if (
			shouldAutoExpandReasoning({
				autoExpandOnDetails,
				hasDetails,
				isStreaming,
				isOpen,
				isExplicitlyClosed,
				hasUserClosed: hasUserClosedRef.current,
			})
		) {
			setIsOpen(true)
		}
	}, [autoExpandOnDetails, hasDetails, isExplicitlyClosed, isOpen, isStreaming, setIsOpen])

	React.useEffect(() => {
		if (
			!shouldScheduleTimelineAutoCollapse({
				allowAutoCollapse,
				isStreaming,
				isOpen,
				hasAutoCollapsedAtCount: hasAutoCollapsedAtCountRef.current,
				timelineEntryCount,
				autoCollapseAtCount,
			})
		) {
			return
		}

		const timer = setTimeout(() => {
			setIsOpen(false)
			hasAutoCollapsedAtCountRef.current = true
			hasUserClosedRef.current = true
		}, collapseDelayMs)
		return () => clearTimeout(timer)
	}, [allowAutoCollapse, autoCollapseAtCount, collapseDelayMs, isOpen, isStreaming, setIsOpen, timelineEntryCount])

	React.useEffect(() => {
		if (
			!shouldScheduleCompletionAutoCollapse({
				allowAutoCollapse,
				hasEverStreamed: hasEverStreamedRef.current,
				isStreaming,
				isOpen,
				hasAutoCollapsedOnCompletion: hasAutoCollapsedOnCompletionRef.current,
			})
		) {
			return
		}

		const timer = setTimeout(() => {
			setIsOpen(false)
			hasAutoCollapsedOnCompletionRef.current = true
		}, collapseDelayMs)
		return () => clearTimeout(timer)
	}, [allowAutoCollapse, collapseDelayMs, isOpen, isStreaming, setIsOpen])

	React.useEffect(() => {
		if (toolsRunning === undefined) {
			return
		}

		const wasRunning = prevToolsRunningRef.current
		prevToolsRunningRef.current = toolsRunning

		if (toolsRunning && !wasRunning) {
			hasUserClosedRef.current = false
			if (!isOpen) {
				setIsOpen(true)
			}
			return
		}

		if (shouldScheduleToolIdleAutoCollapse({ toolsRunning, prevToolsRunning: wasRunning, isOpen })) {
			const timer = setTimeout(() => {
				setIsOpen(false)
				hasUserClosedRef.current = true
			}, collapseDelayMs)
			return () => clearTimeout(timer)
		}
	}, [toolsRunning, isOpen, collapseDelayMs, setIsOpen])

	const handleOpenChange = React.useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && isStreaming) {
				hasUserClosedRef.current = true
			}
			setIsOpen(nextOpen)
		},
		[isStreaming, setIsOpen]
	)

	const handleTimelineEntryCountChange = React.useCallback((count: number) => {
		setTimelineEntryCount((previous) => (previous === count ? previous : count))
	}, [])

	const contextValue = React.useMemo(
		() => ({
			duration,
			isStreaming,
			maxVisibleTimelineItems,
			setTimelineEntryCount: handleTimelineEntryCountChange,
		}),
		[duration, handleTimelineEntryCountChange, isStreaming, maxVisibleTimelineItems]
	)

	return (
		<ReasoningContext value={contextValue}>
			<Trace data-slot="reasoning" className={cn("not-prose", className)}>
				<TraceCollapsible open={isOpen} onOpenChange={handleOpenChange} {...props}>
					{children}
				</TraceCollapsible>
			</Trace>
		</ReasoningContext>
	)
}

export type ReasoningTriggerProps = TraceCollapsibleTriggerProps & {
	/** Title while thinking. A completed status label ("Thought for 5s", "Used …") is shown as finished. */
	label?: string
	/** Title once the stream has a duration. */
	completedLabel?: (duration?: number) => React.ReactNode
	/** When false, renders the line without a trigger, for reasoning that has no text to open yet. */
	showChevron?: boolean
}

function ReasoningTrigger({
	label = getDefaultThinkingLabel(),
	completedLabel = getReasoningCompletedLabel,
	showChevron = true,
	children,
	...props
}: Readonly<ReasoningTriggerProps>) {
	const { isStreaming, duration } = useReasoning()
	const hasCompletedStatusLabel = isCompletedStatusLabel(label)
	const isComplete = hasCompletedStatusLabel || (!isStreaming && duration !== undefined && duration > 0)
	const title = isComplete && !hasCompletedStatusLabel ? completedLabel(duration) : label

	const line = children ?? (
		<TraceLine status={isStreaming && !isComplete ? "running" : undefined}>
			<TraceIcon>
				<RovoIcon label="" />
			</TraceIcon>
			<TraceTitle>{title}</TraceTitle>
		</TraceLine>
	)

	if (!showChevron) {
		return line
	}

	return <TraceCollapsibleTrigger {...props}>{line}</TraceCollapsibleTrigger>
}

type ReasoningTextProps = {
	text: string
	timelineMode: "auto" | "always" | "never"
	maxVisibleTimelineItems: number
}

function ReasoningText({ text, timelineMode, maxVisibleTimelineItems }: Readonly<ReasoningTextProps>) {
	const { setTimelineEntryCount } = useReasoning()
	const timelineEntries = React.useMemo(() => parseTimelineEntries(text), [text])
	const shouldRenderTimeline =
		timelineMode === "always" || (timelineMode === "auto" && timelineEntries.length > 0)

	React.useEffect(() => {
		setTimelineEntryCount(shouldRenderTimeline ? timelineEntries.length : 0)
		return () => setTimelineEntryCount(0)
	}, [setTimelineEntryCount, shouldRenderTimeline, timelineEntries.length])

	if (!shouldRenderTimeline) {
		return <div className="whitespace-pre-wrap">{text}</div>
	}

	return (
		<Trace>
			{timelineEntries.slice(-maxVisibleTimelineItems).map((entry) => (
				<TraceLine key={entry.id}>
					<TraceTitle>{entry.label}</TraceTitle>
				</TraceLine>
			))}
		</Trace>
	)
}

export type ReasoningContentProps = TraceCollapsibleContentProps & {
	/** A string renders as text, or as a list of status lines when every line is one. Pass elements for richer content. */
	children: React.ReactNode
	timelineMode?: "auto" | "always" | "never"
	maxVisibleTimelineItems?: number
}

function ReasoningContent({
	children,
	timelineMode = "auto",
	maxVisibleTimelineItems,
	...props
}: Readonly<ReasoningContentProps>) {
	const { maxVisibleTimelineItems: contextMaxVisibleTimelineItems } = useReasoning()

	return (
		<TraceCollapsibleContent {...props}>
			{typeof children === "string" ? (
				<ReasoningText
					maxVisibleTimelineItems={maxVisibleTimelineItems ?? contextMaxVisibleTimelineItems}
					text={children}
					timelineMode={timelineMode}
				/>
			) : (
				children
			)}
		</TraceCollapsibleContent>
	)
}

export { Reasoning, ReasoningTrigger, ReasoningContent, useReasoning }
