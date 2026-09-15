"use client";

import { useMemo } from "react";

import type { JiraIssueAgentSessionTransferMember } from "@/components/blocks/jira-issue/agent-session-drag";
import {
	JiraLinking,
	type JiraLinkingIdentity,
	type JiraLinkingRelease,
	type JiraLinkingVariant,
} from "@/components/blocks/jira-linking";

import {
	resolveAgentBrandTint,
	resolveAgentBrandTintVariable,
} from "@/components/blocks/agent-session/agent-brand-tint";
import type { BoardAgentSessionAttachProximity } from "../lib/board-agent-session-drag";
import { toSessionFusionTarget } from "../lib/session-fusion-overlay-state";

/**
 * Both drag sources mark the drawn lead pill — `AgentSessionDragPill` with
 * `isFusionSource`, never the centring wrapper around it. The wrapper's border
 * box ignores the chip's own transform, so measuring it would be off by half
 * the chip in both axes and would sit still through the chip's entrance FLIP.
 */
const CHIP_SELECTOR = "[data-session-drag-overlay] [data-session-fusion-chip]";

/**
 * Below both drag-chip portals (z-[400] detached, z-[300] chin) so the goo forms
 * behind the chip and its label stays readable.
 */
const FUSION_Z_INDEX = 290;

/**
 * Board agents identify through a brand logo *component* rather than an image
 * URL, so the shared effect gets a resolved brand tint instead of an `imageSrc`
 * for most drags. `tintSeed` is passed through untouched as the fallback seed,
 * so an agent we have no brand colour for still melts in its own stable hue.
 */
function toLinkingIdentities(
	members: readonly JiraIssueAgentSessionTransferMember[] | null,
): readonly JiraLinkingIdentity[] | null {
	if (!members) {
		return null;
	}

	return members.map((member) => {
		const tintVariable = resolveAgentBrandTintVariable(member.tintSeed);
		return {
			id: member.id,
			imageSrc: member.avatarSrc,
			tint: tintVariable ? undefined : resolveAgentBrandTint(member.tintSeed),
			tintSeed: member.tintSeed || member.name || member.id,
			tintVariable,
		};
	});
}

export interface SessionFusionOverlayProps {
	/** Cohort being dragged, or null between drags. */
	members: readonly JiraIssueAgentSessionTransferMember[] | null;
	/** Called once every drop flight has landed, so the host can commit the link. */
	onFuseSettled?: () => void;
	/** Nearest eligible issue card during the approach. */
	proximity: BoardAgentSessionAttachProximity | null;
	/** Armed on an attach drop so subjects fly into the card. */
	release?: JiraLinkingRelease | null;
	/** Which linking decoration to draw. Defaults to the metaball `fuse`. */
	variant?: JiraLinkingVariant;
}

/**
 * Board adapter for the reusable Jira linking.
 *
 * Fuse's approach is the metaball field. An attach drop arms `release.drop` so
 * the subjects fly into the card's agent session row with the same stagger as
 * the create well, and the chin-row sweep waits until those flights have
 * landed.
 *
 * Glow draws nothing on approach: it arms on release only. A drop collapses
 * one cohort chip into the card; a click-to-assign release omits that chip
 * and goes straight to the halo and backdrop pulse. It stays mounted after
 * the host clears `release` so that backdrop can finish.
 */
export function SessionFusionOverlay({
	members,
	onFuseSettled,
	proximity,
	release = null,
	variant = "fuse",
}: Readonly<SessionFusionOverlayProps>) {
	const identities = useMemo(() => toLinkingIdentities(members), [members]);

	return (
		<JiraLinking
			identities={identities}
			nearness={release ? 0 : proximity?.nearness ?? 0}
			onFuseSettled={onFuseSettled}
			release={release}
			sourceSelector={CHIP_SELECTOR}
			target={release?.target ?? toSessionFusionTarget(proximity)}
			variant={variant}
			zIndex={FUSION_Z_INDEX}
		/>
	);
}
