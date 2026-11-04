"use client";

import { useEffect, useRef } from "react";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Button } from "@/components/ui/button";

function outcome(accepted: number, dismissed: number): string {
	const parts = [accepted > 0 ? `${accepted} applied` : null, dismissed > 0 ? `${dismissed} dismissed` : null].filter(Boolean);
	return parts.join(" · ");
}

export interface TimelineFooterProps {
	feed: SuggestionFeed;
	onAcceptAll: () => void;
	onDismissAll: () => void;
	onClose: () => void;
}

/**
 * The one place progress is counted, and the bulk actions for whatever is still pending across every run.
 * Once nothing is pending it settles into a quiet summary and Done, but never claims "caught up" while the agent is still looking.
 */
export function TimelineFooter({ feed, onAcceptAll, onDismissAll, onClose }: Readonly<TimelineFooterProps>) {
	const { review } = feed;
	const total = review.suggestions.length;
	const pending = review.pending.length;
	const done = pending === 0;
	const running = feed.status === "running";
	const primaryRef = useRef<HTMLButtonElement>(null);
	const settled = useRef(done);

	// The buttons swap when the last suggestion is decided or new ones arrive. If the pressed button went with them,
	// focus would fall to the page; hand it to the new primary action instead.
	useEffect(() => {
		if (settled.current === done) return;
		settled.current = done;
		if (document.activeElement === document.body) primaryRef.current?.focus({ preventScroll: true });
	}, [done]);

	return (
		<footer className="flex min-h-15 items-center gap-1 border-t border-border px-5 py-2">
			<div aria-live="polite" className="min-w-0 flex-1 text-xs leading-4 text-text-subtlest tabular-nums">
				{done ? (
					<span className="flex flex-col">
						<span className="text-sm leading-5 text-text">{running ? "Checking for more…" : "All caught up"}</span>
						<span>{outcome(review.accepted.length, review.dismissed.length)}</span>
					</span>
				) : (
					<><span className="text-text-subtle">{total - pending} of {total}</span> reviewed</>
				)}
			</div>
			{/* Re-running lives in one place, the header; once settled the footer only offers to close. */}
			{done ? (
				<Button onClick={onClose} ref={primaryRef} type="button">Done</Button>
			) : (
				<>
					<Button onClick={onDismissAll} type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={onAcceptAll} ref={primaryRef} type="button">Accept all</Button>
				</>
			)}
		</footer>
	);
}
