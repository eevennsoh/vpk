"use client";

import type { CSSProperties } from "react";

import type {
	AgentListAgent,
	AgentListInvoker,
} from "@/components/blocks/agent-list";
import {
	AgentListIdentity,
	type AgentListAttributionOrder,
} from "@/components/blocks/agent-list/agent-list-identity";
import { Badge } from "@/components/ui/badge";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { agentDragIdentityLabel } from "./agent-session-identity-label";
import type { AgentSessionItem } from "./agent-session-types";
import type { SessionCohort } from "./session-cohort";

/**
 * Overlay elevation lives on the pill itself, never on a wrapper behind it —
 * a raised wrapper is what read as a sharp white rectangle under the old
 * at-mention chip. The surface fill is the semantic `bg-surface` class per
 * `.agents/rules/token-priority.md`; only the shadow has no Tailwind mapping.
 */
const DRAG_CHIP_ELEVATION: CSSProperties = {
	boxShadow: token("elevation.shadow.overlay"),
};

/** Pills drawn behind the lead before the count badge takes over. */
const DECK_VISIBLE_MAX = 3;

/**
 * Placement for each sheet behind the lead pill, front to back.
 *
 * Deliberately irregular. Equal steps along one diagonal read as a machine-cut
 * drop shadow; mismatched angles and directions read as a handful of cards
 * picked up at once, which is what the gesture actually is. Both sheets fan
 * downward so neither corner climbs into the count badge at the top right.
 *
 * The lead pill stays upright on purpose. It carries the label the drag has to
 * keep legible, and it is the `data-session-fusion-chip` node the Jira goo
 * overlay measures every frame — rotating it would inflate that rect and pull
 * the effect off the chip it is supposed to sit under.
 *
 * Sheets paint the same solid fill as the lead. Fading them let the page show
 * through, which read as a smudge under the stack rather than as cards. Elevated
 * copies get their edge from overlay shadow; a border on top of that shadow
 * reads as a thick outline. Resting in-flow copies have no shadow, so they keep
 * a border so the sheets still read as separate cards.
 */
const DECK_LAYERS = [
	{ rotateDeg: 2.4, xPx: 4, yPx: 3 },
	{ rotateDeg: -3.2, xPx: -3, yPx: 6 },
] as const;

/** Fallback placement, so a deeper deck never renders an untransformed sheet. */
const DECK_LAYER_FALLBACK = { rotateDeg: 4, xPx: 6, yPx: 9 } as const;

/** The cohort sentence, owned here so every caller reads identically. */
function sessionCohortLabel(total: number): string {
	return `${total} sessions`;
}

/**
 * One travelling session, drawn as the drag pill: an elevated white surface
 * holding equal-size human and agent avatars, then the human's name.
 * The 32px identity footprint stays stable as the travelling copy opens into
 * its horizontal group, preserving the card-to-chip pointer geometry.
 */
export function AgentSessionDragPill({
	agent,
	attributedBy,
	attributionOrder = "human-first",
	elevated = false,
	isFusionSource = false,
}: Readonly<{
	agent: AgentListAgent;
	attributedBy?: AgentListInvoker;
	attributionOrder?: AgentListAttributionOrder;
	/** Overlay copies paint an opaque surface + shadow; resting copies stay flat. */
	elevated?: boolean;
	/** Only a travelling lead pill is measured by the Jira fusion overlay. */
	isFusionSource?: boolean;
}>) {
	return (
		<div
			className={cn(
				// `rounded-lg`, not a pill: the Figma drag card is a rounded
				// rectangle, and 8px is the radius the resting session card already
				// carries (`agent-session-card.tsx`), so the corner language survives
				// the morph instead of rounding off mid-flight.
				//
				// Padding is asymmetric per the Figma redline: 6px block, 8px before
				// the identity mark, 12px after the label. The lead edge is tighter
				// because the composite's own avatar ring already reads as inset,
				// while the trailing edge needs the full 12px to keep the label off
				// the corner radius.
				"relative isolate flex w-fit max-w-full items-center gap-1.5 rounded-lg py-1.5 pl-2 pr-3",
			)}
			data-session-drag-pill=""
			data-session-fusion-chip={isFusionSource ? "" : undefined}
		>
			{/* Independent surface lets the row contract without scaling its avatars. */}
			<span
				aria-hidden="true"
				className={cn("absolute inset-0 -z-10 rounded-lg", elevated ? "bg-surface" : "bg-bg-neutral")}
				data-session-drag-surface=""
				style={{ ...(elevated ? DRAG_CHIP_ELEVATION : undefined), transformOrigin: "0 0" }}
			/>
			<span className="block shrink-0" data-session-drag-identity="">
				{attributedBy ? (
					<HumanAgentAvatar
						agent={agent}
						human={attributedBy}
						animate={isFusionSource}
						composition="horizontal-group"
						attributionOrder={attributionOrder}
						sizePx={32}
					/>
				) : (
					<AgentListIdentity agent={agent} sizePx={32} />
				)}
			</span>
			<span className="truncate text-xs text-text" data-session-drag-label="">
				{agentDragIdentityLabel(agent, attributedBy)}
			</span>
		</div>
	);
}

/**
 * The travelling representation of a dragged agent session cohort.
 *
 * One session is one pill. Several become a stacked deck: the lead pill stays
 * legible, up to two more peek out from behind it, and a badge carries the
 * total — not the visible three. `data-session-fusion-chip` stays on the lead
 * pill so the fusion overlay measures the drawn chip rather than a box
 * inflated by the stack offsets.
 */
export function AgentSessionDragChip({
	cohort,
	elevated = false,
	isFusionSource = false,
}: Readonly<{
	cohort: SessionCohort<AgentSessionItem>;
	elevated?: boolean;
	/**
	 * Set only by the two drag-overlay hosts. Resting, in-flow copies of this
	 * chip must not answer `[data-session-fusion-chip]`, or an unscoped query
	 * finds a page chip before the travelling one.
	 */
	isFusionSource?: boolean;
}>) {
	const [lead] = cohort.members;
	const total = cohort.members.length;

	if (total === 1) {
		return (
			<AgentSessionDragPill
				agent={lead.agent}
				attributedBy={lead.invokedBy}
				attributionOrder="agent-first"
				elevated={elevated}
				isFusionSource={isFusionSource}
			/>
		);
	}

	const cohortLabel = sessionCohortLabel(total);
	const layers = cohort.members.slice(1, DECK_VISIBLE_MAX);

	return (
		// `role="img"` so the label is legal on this node and the deck speaks
		// once; the `sr-only` sentence stays as the machine-readable text the
		// untracked-board specs read off the overlay's text content.
		<div
			aria-label={cohortLabel}
			className="relative isolate w-fit max-w-full"
			data-session-cohort-chip=""
			role="img"
		>
			<span className="sr-only">{cohortLabel}</span>
			{layers.map((member, index) => {
				const layer = DECK_LAYERS[index] ?? DECK_LAYER_FALLBACK;

				return (
					// Blank receding sheets, not full pills: a second pill's content is
					// entirely occluded by the lead, and laying it out in flow would
					// inflate the `w-fit` box every flight path centres on. Each sheet
					// paints the lead's own opaque fill so the stack reads as cards
					// rather than as a translucent shadow. Overlay elevation is the
					// edge on travelling copies — a border on the same surface
					// doubles it into a thick outline. Resting copies have no
					// shadow, so they keep the border.
					<span
						aria-hidden="true"
						className={cn(
							"pointer-events-none absolute inset-0 -z-10 rounded-lg",
							elevated ? "bg-surface" : "border border-border bg-bg-neutral",
						)}
						data-session-deck-layer={index + 1}
						key={member.id}
						style={{
							...(elevated ? DRAG_CHIP_ELEVATION : null),
							transform: `translate(${layer.xPx}px, ${layer.yPx}px) rotate(${layer.rotateDeg}deg)`,
						}}
					/>
				);
			})}
			<AgentSessionDragPill
				agent={lead.agent}
				attributedBy={lead.invokedBy}
				attributionOrder="agent-first"
				elevated={elevated}
				isFusionSource={isFusionSource}
			/>
			{/* The shared VPK Badge, unrestyled: its own `neutral` fill, 16px
			    height, and `rounded-xs` corners are the count treatment, and its
			    default `max` renders "99+" past two digits. Only placement is
			    ours — the ring lifts it off the pill edge it overlaps, the same
			    trick the invoker avatar uses against the agent mark. */}
			<Badge
				aria-hidden="true"
				className="absolute -right-1 -top-1 z-10 ring-2 ring-surface"
			>
				{total}
			</Badge>
		</div>
	);
}
