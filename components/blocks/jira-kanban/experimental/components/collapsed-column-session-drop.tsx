"use client";

import { useLayoutEffect, useRef } from "react";

import { AGENT_BRAND_TINT_FALLBACK, resolveAgentBrandTintColor } from "@/components/blocks/agent-session/agent-brand-tint";
import { toJiraIssueAttachTracePointer } from "@/components/blocks/jira-issue/attach-proximity";
import { JiraIssueAttachTraceOverlay } from "@/components/blocks/jira-issue/attach-trace-overlay";
import { useMediaQuery } from "@/hooks/use-media-query";

import type { KanbanColumnChromeStyles } from "../../column-chrome";
import { resolveBoardCreateDropzoneDrag } from "../lib/board-agent-session-drag";
import type { BoardAgentSessionDrag } from "../use-board-agent-session-drag";

/** The full lane receives the drop; this content-sized cell owns its feedback. */
export function CollapsedColumnSessionDrop({
	chrome,
	label,
	transaction,
	title,
}: Readonly<{
	chrome: KanbanColumnChromeStyles;
	label?: string;
	transaction: BoardAgentSessionDrag["transaction"];
	title: string;
}>) {
	const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const traceRef = useRef<HTMLSpanElement>(null);
	const armed = Boolean(label) && resolveBoardCreateDropzoneDrag(transaction, title) === "armed";
	const proximity = transaction?.collapsedColumnProximity;
	const nearness = label && !shouldReduceMotion && proximity?.columnTitle === title
		? proximity.nearness
		: 0;

	useLayoutEffect(() => {
		const surface = traceRef.current;
		if (!surface || !transaction || nearness <= 0) return;
		const rect = surface.getBoundingClientRect();
		// A drop in the empty lane still traces the nearest edge of the visible cell.
		const pointer = toJiraIssueAttachTracePointer(armed ? {
			x: Math.max(rect.left, Math.min(rect.right, transaction.pointer.x)),
			y: Math.max(rect.top, Math.min(rect.bottom, transaction.pointer.y)),
		} : { ...transaction.pointer, y: Math.min(rect.bottom, transaction.pointer.y) }, rect);
		if (!pointer) return;
		surface.style.setProperty("--card-glow-pointer-x", pointer.pointerX.toFixed(3));
		surface.style.setProperty("--card-glow-pointer-y", pointer.pointerY.toFixed(3));
	}, [armed, nearness, transaction]);

	return (
		<div data-collapsed-session-drop-surface="" className="pointer-events-none absolute inset-0" style={{ borderRadius: chrome.collapsed.pillRadius }}>
			{armed ? <span className="sr-only">{label} in {title}, selected drop target</span> : null}
			{armed && shouldReduceMotion ? <span aria-hidden="true" data-collapsed-session-drop-static="" className="pointer-events-none absolute inset-0 rounded-[inherit] border border-border-selected" /> : null}
			<JiraIssueAttachTraceOverlay
				nearness={nearness}
				ref={traceRef}
				trace={nearness > 0 ? {
					accent: resolveAgentBrandTintColor(transaction?.cohort.members[0]?.tintSeed) ?? AGENT_BRAND_TINT_FALLBACK,
					pointerX: 0,
					pointerY: 0,
				} : null}
			/>
		</div>
	);
}
