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
export type AgentSessionMetadataSegmentKind = "agent" | "branch" | "artifact" | "time";

export interface AgentSessionMetadataSegment {
	readonly kind: AgentSessionMetadataSegmentKind;
	/** Plain text for the chunk. The `time` chunk carries none — the row clocks it. */
	readonly label?: string;
	/** Pull-request lifecycle for the artifact chunk, selecting its glyph. */
	readonly prStatus?: AgentListPrStatus;
	/**
	 * Declared session host, attached to the time chunk so the byline can
	 * render icon + timestamp as one clause instead of `Cloud · 12s`.
	 */
	readonly host?: AgentListHost;
}

export interface AgentSessionMetadataInput {
	readonly agentName: string;
	/** Override the default visibility of the name beside the agent mark. */
	readonly showAgentName?: boolean;
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
	readonly showArtifact?: boolean;
	readonly prStatus?: AgentListPrStatus;
	/** Lifecycle state used by the default agent-name visibility. */
	readonly state?: AgentListState;
	/** Short-density line: agent mark only, no agent name. */
	readonly compact?: boolean;
}

/** Lifecycle states with ongoing work. */
export function isActiveAgentSessionState(state: AgentListState | undefined): boolean {
	return state === "running" || state === "needs-input" || state === "attention";
}

/** Status copy per lifecycle state, used by trailing indicators and tooltips. */
export const AGENT_SESSION_STATUS_LABEL: Readonly<Record<AgentListState, string>> = {
	attention: "Needs attention",
	complete: "Finished",
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
	const isActive = isActiveAgentSessionState(input.state);
	const showAgentName = input.showAgentName ?? (!input.compact && !isActive);
	const segments: AgentSessionMetadataSegment[] = [
		showAgentName ? { kind: "agent", label: input.agentName } : { kind: "agent" },
	];
	if (input.branch) {
		segments.push({ kind: "branch", label: input.branch });
	}

	if (input.showArtifact !== false && input.artifactLabel !== undefined && input.artifactLabel.length > 0) {
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
