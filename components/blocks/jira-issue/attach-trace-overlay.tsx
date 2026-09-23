"use client";

import type { Ref } from "react";

import {
	CARD_GLOW_EFFECT_STYLE,
	CardGlowLayers,
	cardGlowSurfaceStyle,
	type CardGlowCSSProperties,
} from "@/components/visual/card-glow";

import type { JiraIssueAttachTrace } from "./attach-proximity";

/**
 * The accent stroke traced along a card's edge as a dragged session approaches.
 *
 * Sibling to {@link JiraIssueAgentLinkFlashOverlay} in `agent-link-flash.tsx`:
 * both are one-shot decorations the card hosts but does not own, and both read
 * the same brand accent, so the colour appears to travel with the session —
 * hover in the column, approach here, flash on release — rather than each
 * surface lighting up on its own.
 *
 * Nearness fades it in. `resolveJiraIssueAttachNearness` already returns 0 under
 * reduced motion, so that setting removes the stroke without a second guard.
 *
 * Stroke only, no bloom: the grey backdrop behind the card is already the
 * approach's fill feedback, and a second accent wash on top would fight it.
 */
export function JiraIssueAttachTraceOverlay({
	nearness,
	ref,
	trace,
}: Readonly<{
	/** 0..1 approach ramp. At or below 0 the overlay renders nothing. */
	nearness: number;
	ref?: Ref<HTMLSpanElement>;
	/** Accent and pointer for the nearest card. Absent on every other card. */
	trace: JiraIssueAttachTrace | null | undefined;
}>) {
	if (!trace || nearness <= 0) {
		return null;
	}

	const style: CardGlowCSSProperties = {
		...CARD_GLOW_EFFECT_STYLE,
		...cardGlowSurfaceStyle(trace.accent),
		"--card-glow-pointer-x": trace.pointerX.toFixed(3),
		"--card-glow-pointer-y": trace.pointerY.toFixed(3),
		opacity: nearness,
	};

	return (
		// `-inset-px` lifts the traced ring onto the surface's own 1px border
		// rather than sitting just inside it, so the accent replaces that stroke
		// where the pointer is instead of doubling it. `isolate` keeps the layers'
		// negative z-index from escaping behind the surface.
		<span
			aria-hidden="true"
			className="pointer-events-none absolute -inset-px isolate rounded-[inherit]"
			data-slot="jira-issue-attach-trace"
			ref={ref}
			style={style}
		>
			<CardGlowLayers baseBorder={false} bloom={false} />
		</span>
	);
}
