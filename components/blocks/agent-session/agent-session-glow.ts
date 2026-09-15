import {
	CARD_GLOW_EFFECT_STYLE,
	type CardGlowCSSProperties,
} from "@/components/visual/card-glow";

import type { AgentSessionVariant } from "./agent-session-types";

// The shared bloom was tuned on 144px bento tiles. A large session row is 60px,
// so the same blob covers the whole row and reads as a selected fill rather
// than a glow — measured side by side in the column at 0.25 / 0.18 / 0.12.
// Dialling it back leaves the traced accent stroke as the primary signal and
// lets the row's own `bg-surface-hovered` still show through.
export const AGENT_SESSION_GLOW_STYLE: CardGlowCSSProperties = {
	...CARD_GLOW_EFFECT_STYLE,
	// The gradient stays tight so the stroke reads as a travelling arc rather
	// than a border: widening it far enough to be seen from across the column
	// lights a 60px row's whole ring at once. Distance is carried by
	// `--card-glow-proximity` instead, which the enclosing plane writes — a far
	// row traces faintly, a near row brightly. A little above the tile-tuned
	// 120px because these rows are wide and short, so an arc needs the reach to
	// cover a useful share of the edge.
	"--card-glow-border-core": 24,
	"--card-glow-border-spread": 150,
	"--card-glow-icon-opacity": 0.18,
};

export interface AgentSessionGlow {
	/** Wash the accent behind each row. */
	readonly bloom: boolean;
	/** Either layer is on, so the list needs the tuning vars. */
	readonly enabled: boolean;
	/** Trace the accent along each row's edge. */
	readonly stroke: boolean;
	/**
	 * Tuning vars for the list, or an empty object when neither layer is on.
	 * Always spreadable, so a caller needs no branch of its own.
	 */
	readonly style: CardGlowCSSProperties;
}

const AGENT_SESSION_GLOW_OFF: AgentSessionGlow = {
	bloom: false,
	enabled: false,
	stroke: false,
	style: {},
};

/**
 * Which accent layers a session list should paint.
 *
 * Only the large card renders them, and each layer is independently switchable,
 * so the combination is a small decision with several branches. It lives here
 * rather than inline in `AgentSession` to keep that component's control flow
 * readable (`react-doctor/no-high-complexity-react-function`) and to make the
 * combination directly testable.
 */
export function resolveAgentSessionGlow({
	bloom,
	stroke,
	variant,
}: Readonly<{
	bloom: boolean;
	stroke: boolean;
	variant: AgentSessionVariant;
}>): AgentSessionGlow {
	if (variant !== "large") {
		return AGENT_SESSION_GLOW_OFF;
	}
	if (!stroke && !bloom) {
		return AGENT_SESSION_GLOW_OFF;
	}

	return { bloom, enabled: true, stroke, style: AGENT_SESSION_GLOW_STYLE };
}
