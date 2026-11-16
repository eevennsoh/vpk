import type { AgentListHost, AgentListPrStatus, AgentListState } from "@/components/blocks/agent-list";

/**
 * One `·`-separated chunk of a long-form session row's metadata line.
 *
 * The line is a sentence about provenance — who ran this, where, what it
 * produced, and when it last moved — and every middle clause is optional. A
 * session with no declared host or no artifact simply drops that clause rather
 * than rendering an em-dash placeholder. Progression lives on the trailing
 * lifecycle icon, not in this line.
 */
export type AgentSessionMetadataSegmentKind = "agent" | "branch" | "tool-call" | "artifact" | "time";

export interface AgentSessionMetadataSegment {
	readonly kind: AgentSessionMetadataSegmentKind;
	/** Plain text for the chunk. The `time` chunk carries none — the row clocks it. */
	readonly label?: string;
	/** Pull-request lifecycle for the artifact chunk, selecting its glyph. */
	readonly prStatus?: AgentListPrStatus;
	/** Tool-call labels cycled by the long-form renderer. */
	readonly toolCalls?: readonly string[];
	/** Tool call shimmers only while the session is still in progress. */
	readonly animated?: boolean;
	/**
	 * Declared session host, attached to the time chunk so the byline can
	 * render icon + timestamp as one clause instead of `Cloud · 12s`.
	 */
	readonly host?: AgentListHost;
}

export interface AgentSessionMetadataInput {
	readonly agentName: string;
	readonly branch?: string;
	/**
	 * Resolved session host, or `undefined` when the row never declared one.
	 *
	 * Deliberately not defaulted here: `getAgentListHost` answers `"cloud"` for a
	 * payload that simply never said, which is the right default for behavior but
	 * the wrong claim to print on a card. A row that does not know where it ran
	 * should stay quiet rather than assert the cloud.
	 */
	readonly host?: AgentListHost;
	/** Pre-formatted artifact name, e.g. `#1306: Add guest checkout`. */
	readonly artifactLabel?: string;
	readonly prStatus?: AgentListPrStatus;
	/** Human-readable tool calls, in display order. */
	readonly toolCalls?: readonly string[];
	/** Lifecycle state; decides whether the agent is named and the tool call shimmers. */
	readonly state?: AgentListState;
	/** Short-density line: agent mark only, no agent name, no tool call. */
	readonly compact?: boolean;
}

/**
 * Working and Needs input rows let the agent mark speak for itself — the line
 * is about what the session is doing now, so the agent's name is never printed.
 */
export function isActiveAgentSessionState(state: AgentListState | undefined): boolean {
	return state === "running" || state === "needs-input" || state === "attention";
}

/** Status copy per lifecycle state, used by trailing indicators and tooltips. */
export const AGENT_SESSION_STATUS_LABEL: Readonly<Record<AgentListState, string>> = {
	attention: "Needs attention",
	complete: "Complete",
	"needs-input": "Needs input",
	running: "Working",
};

/**
 * Ordered metadata chunks for a long-form session row.
 *
 * Pure and total: same input, same array, no clock and no DOM. The renderer
 * turns each chunk into a glyph plus text, which keeps the "what do we say"
 * decision testable apart from the "how does it look" one.
 */
export function toAgentSessionMetadataSegments(
	input: AgentSessionMetadataInput,
): readonly AgentSessionMetadataSegment[] {
	const segments: AgentSessionMetadataSegment[] = [
		input.compact || isActiveAgentSessionState(input.state) ? { kind: "agent" } : { kind: "agent", label: input.agentName },
	];
	// The compact (short) line has no room for narration: the mark stands in for
	// the agent and the tool call is dropped, leaving PR, host, and time.
	const toolCalls = input.compact ? undefined : input.toolCalls
		?.map((toolCall) => toolCall.trim())
		.filter((toolCall) => toolCall.length > 0);
	if (input.branch) {
		segments.push({ kind: "branch", label: input.branch });
	}

	if (toolCalls !== undefined && toolCalls.length > 0) {
		segments.push({ kind: "tool-call", toolCalls, animated: input.state !== "complete" });
	}

	if (input.artifactLabel !== undefined && input.artifactLabel.length > 0) {
		segments.push({
			kind: "artifact",
			label: input.artifactLabel,
			prStatus: input.prStatus ?? "created",
		});
	}

	segments.push({
		kind: "time",
		...(input.host !== undefined ? { host: input.host } : {}),
	});

	return segments;
}
