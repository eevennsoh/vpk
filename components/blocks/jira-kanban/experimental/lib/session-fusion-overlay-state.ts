/**
 * Board-side geometry and link acknowledgement for the work item Jira linking.
 *
 * The reusable field, its timing and its gating live in
 * `@/components/blocks/jira-linking`. What stays here is the only part that is
 * genuinely Jira's: turning a card into the shape the field grows into, and
 * deciding which drops count as the attach-to-card path this effect covers.
 * Pure, so the contract can be tested without a DOM.
 */

import type {
	JiraLinkingDropMember,
	JiraLinkingRelease,
	JiraLinkingTarget,
	JiraLinkingVariant,
} from "@/components/blocks/jira-linking";

import type {
	JiraIssueAgentLinkFlash,
	JiraIssueGenerativeActionRequest,
} from "@/components/blocks/jira-issue";
import type {
	JiraIssueAgentSessionTransferMember,
} from "@/components/blocks/jira-issue/agent-session-drag";

import {
	AGENT_BRAND_TINT_FALLBACK,
	resolveAgentBrandTintColor,
	// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
} from "../../../agent-session/agent-brand-tint.ts";
import {
	sessionTransferTintSeed,
	// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
} from "../../../jira-issue/agent-session-drag.ts";
import type {
	BoardAgentSessionAttachProximity,
	BoardAgentSessionDropBounds,
} from "./board-agent-session-drag";

/**
 * Matches `AGENT_ACTIVITY_SHELL_STYLE.borderRadius` on the card. The blob is
 * morphing into that exact surface, so a different radius would read as a
 * second shape sitting behind the card instead of as the card itself.
 */
export const SESSION_FUSION_SHELL_RADIUS_PX = 10;

/**
 * Matches `rounded-md` on `JiraIssueAgentActivityRow` and the attach-chin
 * slot. Flights land in that row, not the whole card, so a card-sized radius
 * would overshoot the destination.
 */
export const SESSION_FUSION_ROW_RADIUS_PX = 6;

/** Height of `jira-issue-attach-chin-slot` (`h-6`) when the chin is not measured. */
export const SESSION_FUSION_CHIN_HEIGHT_PX = 24;

/**
 * Matches `radius.large` on the issue's own card surface. Glow lands its chip
 * on that surface, so a shell-sized radius would round a shape it never draws.
 */
export const SESSION_FUSION_SURFACE_RADIUS_PX = 8;

function toTargetFromBounds(
	bounds: Readonly<BoardAgentSessionDropBounds>,
	radius: number,
): JiraLinkingTarget {
	return {
		anchor: {
			x: (bounds.left + bounds.right) / 2,
			y: (bounds.top + bounds.bottom) / 2,
		},
		height: Math.max(0, bounds.bottom - bounds.top),
		radius,
		width: Math.max(0, bounds.right - bounds.left),
	};
}

/**
 * The card's whole agent shell as a link target.
 *
 * The session is being absorbed into the card, not parked in a strip at its
 * lip, so the field grows into the entire shell — backdrop, body and chin rows.
 * Falls back to the drop-zone bounds before the shell can be measured.
 */
export function toSessionFusionTarget(
	proximity: BoardAgentSessionAttachProximity | null,
): JiraLinkingTarget | null {
	if (!proximity) {
		return null;
	}

	return toTargetFromBounds(
		proximity.dockRect ?? proximity.bounds,
		SESSION_FUSION_SHELL_RADIUS_PX,
	);
}

/**
 * Where drop flights land: the attach chin or activity row at the bottom of
 * the card. Falls back to a chin-height strip of the shell so an unmeasured
 * slot still aims at the agent session area, not the card's centre.
 */
export function toSessionFusionLandTarget(
	proximity: BoardAgentSessionAttachProximity | null,
): JiraLinkingTarget | null {
	if (!proximity) {
		return null;
	}

	return toTargetFromBounds(
		proximity.landRect ?? bottomStrip(
			proximity.dockRect ?? proximity.bounds,
			SESSION_FUSION_CHIN_HEIGHT_PX,
		),
		SESSION_FUSION_ROW_RADIUS_PX,
	);
}

/**
 * Where a Glow release lands: the card's own surface, so the chip collapses
 * into the card body the viewer aimed at. Falls back to the shell, then to the
 * drop-zone bounds, before the surface can be measured.
 */
export function toSessionFusionGlowLandTarget(
	proximity: BoardAgentSessionAttachProximity | null,
): JiraLinkingTarget | null {
	if (!proximity) {
		return null;
	}

	return toTargetFromBounds(
		proximity.surfaceRect ?? proximity.dockRect ?? proximity.bounds,
		SESSION_FUSION_SURFACE_RADIUS_PX,
	);
}

function bottomStrip(
	bounds: Readonly<BoardAgentSessionDropBounds>,
	height: number,
): BoardAgentSessionDropBounds {
	const available = Math.max(0, bounds.bottom - bounds.top);
	const strip = Math.min(Math.max(0, height), available);
	return {
		bottom: bounds.bottom,
		left: bounds.left,
		right: bounds.right,
		top: bounds.bottom - strip,
	};
}

/** A link flash pinned to the card whose chin rows should sweep. */
export interface BoardAgentSessionLinkFlash {
	cardCode: string;
	flash: JiraIssueAgentLinkFlash;
}

export interface SessionFusionLinkFlashInput {
	members: readonly JiraIssueAgentSessionTransferMember[];
	proximity: BoardAgentSessionAttachProximity | null;
	targetCardCode: string | null;
	/** Monotonic, so dropping the same session again replays the sweep. */
	token: number;
	/** Glow owns its own acknowledgement, so it never earns a chin-row sweep. */
	variant?: JiraLinkingVariant;
}

/**
 * Staggered chip flights into the card's agent session row, or `null` when
 * this drop is not the attach-to-card path the linking effect covers.
 *
 * The host commits the transfer on pointer-up and animates this snapshot
 * afterward, so a Board/List switch cannot drop a successful attach. The chin
 * sweep still waits until the flights land. Unlink, create-well, create-list
 * and untracked drops still skip this: they never resolve attach proximity.
 *
 * Glow lands one cohort chip on the card surface instead, and snapshots the
 * shell as `fromTarget` — the node it grows its halo and backdrop pulse inside.
 */
export function toSessionFusionDrop(input: Readonly<{
	from: { readonly x: number; readonly y: number };
	id: number;
	members: readonly JiraIssueAgentSessionTransferMember[];
	proximity: BoardAgentSessionAttachProximity | null;
	variant?: JiraLinkingVariant;
}>): JiraLinkingRelease | null {
	const glow = input.variant === "glow";
	const target = glow
		? toSessionFusionGlowLandTarget(input.proximity)
		: toSessionFusionLandTarget(input.proximity);
	const [first, ...rest] = input.members;
	if (!target || !first) {
		return null;
	}

	return {
		drop: {
			from: { x: input.from.x, y: input.from.y },
			members: [toDropMember(first), ...rest.map(toDropMember)],
			playback: "stagger",
		},
		fromTarget: glow ? toSessionFusionTarget(input.proximity) : undefined,
		id: input.id,
		target,
	};
}

/**
 * A click-to-assign acknowledgement: the card's glow, with no travelling chip.
 *
 * A drop hands the effect a pointer and a cohort chip that collapses into the
 * card. A menu assignment has neither — the agent is already on the work item
 * — so this snapshots the same landing shape a glow drop uses and leaves
 * `drop` unset. Glow then skips the flight and plays the halo and pulse.
 *
 * `null` when the card cannot be measured, which is the same gate
 * {@link toSessionFusionDrop} applies — no shape, no acknowledgement.
 */
export function toSessionFusionAssignmentRelease(input: Readonly<{
	id: number;
	proximity: BoardAgentSessionAttachProximity | null;
}>): JiraLinkingRelease | null {
	const target = toSessionFusionGlowLandTarget(input.proximity);
	if (!target) {
		return null;
	}

	return {
		fromTarget: toSessionFusionTarget(input.proximity),
		id: input.id,
		target,
	};
}

/**
 * The agent a generative-action submit puts on the card, as a link subject.
 *
 * `null` for Ask Rovo, which opens a chat instead of adding an agent row, and
 * for a skill: a skill submit does land an agent row, but *which* agent runs
 * the skill is the host's choice, so the board cannot name the subject the
 * acknowledgement would be pointing at.
 */
export function toAssignedAgentTransferMember(
	request: Readonly<JiraIssueGenerativeActionRequest>,
): JiraIssueAgentSessionTransferMember | null {
	const item = request.kind === "agent" ? request.selectedItem : undefined;
	if (!item) {
		return null;
	}

	return {
		avatarSrc: item.avatarSrc,
		id: item.id,
		name: item.label,
		tintSeed: sessionTransferTintSeed(item.label, item.id),
	};
}

function toDropMember(
	member: JiraIssueAgentSessionTransferMember,
): JiraLinkingDropMember {
	return {
		avatarSrc: member.avatarSrc,
		id: member.id,
		invoker: member.invoker,
		name: member.name,
	};
}

/**
 * What acknowledges a drop, or `null` when this drop is not the attach-to-card
 * path this effect covers.
 *
 * Fired once the staggered flights have landed, so the sweep plays on rows that
 * already exist. Requiring the proximity winner to be the drop target is what
 * keeps unlink, create-well, create-list and untracked drops on their existing
 * treatment: a jira-list row attach registers no issue zone, so it resolves no
 * proximity and therefore no flash.
 *
 * Glow earns no sweep at all: it acknowledges the drop with the card's own
 * halo and backdrop pulse, so a chin-row sweep would be a second receipt
 * competing with it for one link.
 */
export function toBoardAgentSessionLinkFlash(
	input: Readonly<SessionFusionLinkFlashInput>,
): BoardAgentSessionLinkFlash | null {
	const { members, proximity, targetCardCode } = input;
	if (input.variant === "glow") {
		return null;
	}
	if (targetCardCode === null || !proximity || proximity.cardCode !== targetCardCode) {
		return null;
	}
	if (members.length === 0) {
		return null;
	}

	return {
		cardCode: targetCardCode,
		flash: {
			activityIds: members.map((member) => member.id),
			tint: resolveAgentBrandTintColor(members[0].tintSeed) ?? AGENT_BRAND_TINT_FALLBACK,
			token: input.token,
		},
	};
}

/**
 * A drop's acknowledgement that has not been handed to the rows yet.
 *
 * `flash` is nullable because a drop can arm the flights without earning a
 * sweep — the flights cover attach *and* move, the sweep only covers a drop
 * whose proximity winner is the card it landed on.
 */
export interface PendingSessionLinkFlash {
	flash: BoardAgentSessionLinkFlash | null;
}
