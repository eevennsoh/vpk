// Open/close rules for Reasoning: when it opens itself while streaming, and when it collapses itself.

interface ShouldAutoExpandReasoningOptions {
	autoExpandOnDetails: boolean
	hasDetails: boolean
	isStreaming: boolean
	isOpen: boolean
	isExplicitlyClosed: boolean
	hasUserClosed: boolean
}

export function shouldAutoExpandReasoning({
	autoExpandOnDetails,
	hasDetails,
	isStreaming,
	isOpen,
	isExplicitlyClosed,
	hasUserClosed,
}: Readonly<ShouldAutoExpandReasoningOptions>): boolean {
	return (
		autoExpandOnDetails &&
		hasDetails &&
		isStreaming &&
		!isOpen &&
		!isExplicitlyClosed &&
		!hasUserClosed
	)
}

interface TimelineAutoCollapseOptions {
	allowAutoCollapse: boolean
	isStreaming: boolean
	isOpen: boolean
	hasAutoCollapsedAtCount: boolean
	timelineEntryCount: number
	autoCollapseAtCount: number
}

export function shouldScheduleTimelineAutoCollapse({
	allowAutoCollapse,
	isStreaming,
	isOpen,
	hasAutoCollapsedAtCount,
	timelineEntryCount,
	autoCollapseAtCount,
}: Readonly<TimelineAutoCollapseOptions>): boolean {
	return (
		allowAutoCollapse &&
		isStreaming &&
		isOpen &&
		!hasAutoCollapsedAtCount &&
		timelineEntryCount >= autoCollapseAtCount
	)
}

interface CompletionAutoCollapseOptions {
	allowAutoCollapse: boolean
	hasEverStreamed: boolean
	isStreaming: boolean
	isOpen: boolean
	hasAutoCollapsedOnCompletion: boolean
}

export function shouldScheduleCompletionAutoCollapse({
	allowAutoCollapse,
	hasEverStreamed,
	isStreaming,
	isOpen,
	hasAutoCollapsedOnCompletion,
}: Readonly<CompletionAutoCollapseOptions>): boolean {
	return (
		allowAutoCollapse &&
		hasEverStreamed &&
		!isStreaming &&
		isOpen &&
		!hasAutoCollapsedOnCompletion
	)
}

interface ToolIdleAutoCollapseOptions {
	toolsRunning: boolean
	prevToolsRunning: boolean
	isOpen: boolean
}

export function shouldScheduleToolIdleAutoCollapse({
	toolsRunning,
	prevToolsRunning,
	isOpen,
}: Readonly<ToolIdleAutoCollapseOptions>): boolean {
	return prevToolsRunning && !toolsRunning && isOpen
}
