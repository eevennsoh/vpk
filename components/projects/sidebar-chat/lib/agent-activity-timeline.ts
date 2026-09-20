import type { StudioSessionAgentEntry } from "@/app/contexts/context-rovo-chat"
import type { ProgressTrackerStepState } from "@/components/ui/progress-tracker"
import type {
	AgentExecutionStatus,
	AgentExecutionSummary,
	ThinkingToolCallSummary,
	ThinkingToolState,
} from "@/lib/rovo-ui-messages"

/**
 * One row of the custom-agent Activity timeline. `byline` carries the
 * secondary line (a formatted timestamp for runtime/status rows, a short
 * count for config rows); `toolTags` render as blue Tag chips after it.
 *
 * This module is intentionally dependency-free (type-only imports) so it can
 * be unit-tested under plain `node --test`; the React glue that calls the
 * message getters lives in the sibling component.
 */
export interface AgentActivityEntry {
	id: string
	label: string
	byline?: string
	toolTags?: readonly string[]
	state: ProgressTrackerStepState
}

// Cap the list so a long conversation can't grow the timeline unbounded.
const MAX_ACTIVITY_ENTRIES = 12

// Locale pinned (per AGENTS.md) so the formatted string is identical on the
// server and client and never triggers a hydration mismatch.
const activityDateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
})

export function formatActivityTimestamp(value: string | number | undefined): string | undefined {
	if (value === undefined) {
		return undefined
	}

	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? undefined : activityDateFormatter.format(date)
}

// Runtime statuses already mirror ProgressTracker semantics, so the mapping is
// 1:1: in-flight -> spinner (current), success -> done, failure -> warning.
export function mapExecutionState(status: AgentExecutionStatus): ProgressTrackerStepState {
	if (status === "completed") {
		return "done"
	}

	return status === "failed" ? "warning" : "current"
}

export function mapToolState(state: ThinkingToolState): ProgressTrackerStepState {
	if (state === "completed") {
		return "done"
	}

	// "approval-requested" / "awaiting-input" / "running" are all in-flight.
	return state === "error" ? "warning" : "current"
}

export function executionSummaryToEntry(
	summary: AgentExecutionSummary,
	messageIndex: number,
	messageTimestamp: string | undefined,
): AgentActivityEntry {
	const state = mapExecutionState(summary.status)
	return {
		id: `exec-${messageIndex}-${summary.taskId}`,
		label: summary.taskLabel,
		// In-flight rows have no settled time yet.
		byline: state === "current" ? undefined : formatActivityTimestamp(messageTimestamp),
		state,
	}
}

export function toolCallSummaryToEntry(
	summary: ThinkingToolCallSummary,
	messageIndex: number,
	messageTimestamp: string | undefined,
): AgentActivityEntry {
	const state = mapToolState(summary.state)
	return {
		id: `tool-${messageIndex}-${summary.id}`,
		label: summary.label ?? summary.toolName,
		byline:
			state === "current"
				? undefined
				: formatActivityTimestamp(summary.timestamp ?? messageTimestamp),
		state,
	}
}

export function buildConfigEntries(entry: StudioSessionAgentEntry): AgentActivityEntry[] {
	const entries: AgentActivityEntry[] = []
	const result = entry.publishReadyResult

	const automationCount = result.automationRules?.length ?? 0
	if (automationCount > 0) {
		entries.push({
			id: "config-triggers",
			label: automationCount > 1 ? `${automationCount} automations configured` : "Automation configured",
			state: "done",
		})
	}

	const tools = result.tools ?? []
	if (tools.length > 0) {
		entries.push({
			id: "config-tools",
			label: tools.length > 1 ? `${tools.length} tools connected` : "Tool connected",
			toolTags: tools,
			state: "done",
		})
	}

	const isPublished = entry.publishStatus === "published"
	entries.push({
		id: "config-status",
		label: isPublished ? "Published" : "In testing",
		byline: formatActivityTimestamp(entry.lastTouchedAt),
		state: isPublished ? "done" : "current",
	})

	return entries
}

/**
 * Assemble the final timeline rows: runtime activity newest-first on top,
 * then the agent's config/lifecycle milestones. `runtimeEntries` arrive in
 * chronological (oldest-first) order. Returns an empty array when nothing is
 * derivable (no runtime activity and no session entry), letting the caller
 * fall back to the empty state.
 */
export function buildAgentActivitySteps({
	runtimeEntries,
	entry,
}: Readonly<{
	runtimeEntries: readonly AgentActivityEntry[]
	entry: StudioSessionAgentEntry | null
}>): AgentActivityEntry[] {
	const newestFirst = [...runtimeEntries].reverse()
	const configEntries = entry ? buildConfigEntries(entry) : []

	// Always keep the (small) config milestones; clamp runtime to fit the cap.
	const maxRuntime = Math.max(0, MAX_ACTIVITY_ENTRIES - configEntries.length)
	return [...newestFirst.slice(0, maxRuntime), ...configEntries]
}
