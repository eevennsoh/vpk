"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

import { SUGGESTIONS_ICON_RESOLVE_MS, SuggestionsStatusIcon } from "@/components/blocks/jira-suggestion/components/suggestions-status-icon";
import { Shimmer } from "@/components/ui/shimmer";

/** How long the resolved AI suggestion icon rests in the slot before the recommended agent's avatar takes it. */
const RESOLVED_HOLD_MS = 250;

/**
 * Holds the recommended agent's slot while the recommendation is worked out: the AI suggestion icon's loading spinner
 * where the avatar will be and a shimmering label where its name will be, in the same row geometry, so the agent
 * replaces it without a jump. Once `done`, the spinner resolves into the AI suggestion icon (the same choreography as
 * the Review suggestions action) and, after a beat, `onDone` hands the slot to the agent.
 */
export function RecommendingAgentRow({ done, onDone, doneLabel }: Readonly<{
	done: boolean;
	onDone: () => void;
	/** Settle on this status once done (the icon stays) instead of handing the slot to an agent. */
	doneLabel?: string;
}>) {
	const reduced = useReducedMotion() ?? false;
	const finished = useRef(onDone);
	useEffect(() => { finished.current = onDone; });
	useEffect(() => {
		if (!done) return undefined;
		const timer = window.setTimeout(() => finished.current(), reduced ? 0 : SUGGESTIONS_ICON_RESOLVE_MS + RESOLVED_HOLD_MS);
		return () => window.clearTimeout(timer);
	}, [done, reduced]);
	return (
		<div className="rounded-lg" data-menu-row="" role="status">
			<div className="flex items-center gap-3 py-1.5 pr-1.5 pl-2">
				<span aria-hidden className="grid size-6 shrink-0 place-items-center text-icon-subtle">
					<SuggestionsStatusIcon state={done ? "done" : "loading"} />
				</span>
				{done && doneLabel ? (
					<span className="menu-row-title block min-w-0 flex-1 truncate text-text-subtle">{doneLabel}</span>
				) : (
					// The same sweep as an agent's Working label (JiraIssueAgentRowLabel), on subtle text: a placeholder, not an agent yet.
					<Shimmer as="span" className="menu-row-title block min-w-0 flex-1 truncate text-text-subtle" duration={1.4} spread={2}>Recommending agent</Shimmer>
				)}
			</div>
		</div>
	);
}
