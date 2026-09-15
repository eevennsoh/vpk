import {
	sessionTransferTintSeed,
	type JiraIssueAgentSessionTransferMember,
} from "@/components/blocks/jira-issue/agent-session-drag";

import {
	AGENT_BRAND_TINT_FALLBACK,
	resolveAgentBrandTintColor,
} from "./agent-brand-tint";
import type { AgentSessionItem } from "./agent-session-types";

/**
 * The tint seed for a session's agent, derived exactly once here.
 *
 * Both the drop transfer and the card's own chrome go through this, so the
 * colour a session shows on hover cannot drift from the colour it flashes when
 * it lands on a work item.
 */
export function agentSessionTintSeed(item: AgentSessionItem): string | undefined {
	return sessionTransferTintSeed(
		item.agent.brandName,
		item.agent.vpkLogo,
		item.agent.name,
	);
}

/**
 * The CSS colour a session's decorative chrome is painted in.
 *
 * Deliberately the same expression the drop acknowledgement uses for its sweep
 * (`resolveJiraIssueLinkFlash` in the board's fusion state), fallback included:
 * hovering a session in the column and dropping it on a work item are two
 * halves of one gesture, so they must read as the same colour. If the flash
 * chain changes, this changes with it.
 */
export function agentSessionAccentColor(item: AgentSessionItem): string {
	return resolveAgentBrandTintColor(agentSessionTintSeed(item)) ?? AGENT_BRAND_TINT_FALLBACK;
}

/**
 * Identity the fusion overlay needs to draw this member: the avatar URL when
 * one exists, a stable seed for the deterministic colour fallback when it does
 * not — most agents identify by a brand logo component, not an image — and the
 * human who invoked the session.
 *
 * The invoker is the load-bearing one. It is the only path by which the
 * post-drop flight and glow chips learn the face: the board rebuilds its cohort
 * from these members (`toSessionFusionDrop` → `toJiraLinkingCohort`), so
 * dropping it here makes the chip degrade from "Claude with Annie" to a bare
 * hexagon the instant the pointer is released.
 */
export function toSessionTransferMember(
	member: AgentSessionItem,
): JiraIssueAgentSessionTransferMember {
	return {
		avatarSrc: member.agent.avatarSrc,
		id: member.id,
		invoker: member.invokedBy,
		name: member.agent.name,
		tintSeed: agentSessionTintSeed(member),
	};
}
