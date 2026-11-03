"use client";

import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";

import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { cn } from "@/lib/utils";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision, SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import type { FocusDeck } from "./use-focus-deck";
import { WhyPopoverButton } from "./why-popover";

const DECISION_COPY: Readonly<Record<SuggestionDecision, string>> = {
	pending: "To review",
	accepted: "Accepted",
	dismissed: "Dismissed",
};

function StatusGlyph({ decision, current }: Readonly<{ decision: SuggestionDecision; current: boolean }>) {
	if (decision === "accepted") return <span className="flex size-4 shrink-0 text-icon-success"><CheckCircleIcon color="currentColor" label="" size="small" /></span>;
	if (decision === "dismissed") return <span className="flex size-4 shrink-0 text-icon-subtlest"><CrossCircleIcon color="currentColor" label="" size="small" /></span>;
	return (
		<span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
			<span className={cn("rounded-full", current ? "size-2.5 bg-primary ring-4 ring-bg-selected-hovered" : "size-3 border-[1.5px] border-border-bold")} />
		</span>
	);
}

/** Compact list of every suggestion: jump to one, read why on hover/focus/tap, undo a decision. */
export function ReviewQueue({ review, deck }: Readonly<{ review: SuggestionReview; deck: FocusDeck }>) {
	const remaining = review.pending.length;
	return (
		<section aria-label="Suggestion queue" className="flex shrink-0 flex-col rounded-xl border border-border bg-surface">
			<header className="flex items-center gap-2.5 px-3 pt-3 pb-2">
				<Tile hasBorder label="Teamwork Graph" size="small" variant="transparent">
					<TeamworkGraphMark />
				</Tile>
				<div className="flex min-w-0 flex-1 flex-col">
					<h2 className="text-sm leading-5 font-semibold text-text">Work item suggestions</h2>
					<span className="text-xs text-text-subtlest">{SUGGESTION_WORK_ITEM.agent.name} · {SUGGESTION_WORK_ITEM.agent.ranAt}</span>
				</div>
				<span className="shrink-0 rounded-full bg-bg-neutral px-2 py-0.5 text-xs font-medium text-text-subtle tabular-nums">
					{remaining === 0 ? "Done" : `${remaining} left`}
				</span>
			</header>
			<ol className="flex flex-col gap-px px-1.5">
				{review.suggestions.map((suggestion, index) => {
					const decision = review.decisionOf(suggestion.id);
					const current = !deck.complete && index === deck.cursor;
					return (
						<li
							className={cn("flex items-center gap-0.5 rounded-lg pr-1 transition-colors duration-xxshort ease-out-practical", current ? "bg-bg-selected" : "hover:bg-bg-neutral-subtle-hovered")}
							key={suggestion.id}
						>
							<button
								aria-current={current ? "step" : undefined}
								aria-label={`${suggestion.label}, ${DECISION_COPY[decision].toLowerCase()}. Show in deck`}
								className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-focused"
								onClick={() => deck.goTo(index)}
								type="button"
							>
								<StatusGlyph current={current} decision={decision} />
								<span className={cn("min-w-0 flex-1 text-sm leading-5", current ? "font-medium text-text-selected" : decision === "dismissed" ? "text-text-subtle" : "text-text")}>{suggestion.label}</span>
								<span className={cn("shrink-0 text-xs", decision === "accepted" ? "text-text-success" : "text-text-subtlest")}>{DECISION_COPY[decision]}</span>
							</button>
							<WhyPopoverButton suggestion={suggestion} />
							{decision === "pending" ? null : (
								<Button aria-label={`Undo ${suggestion.label} decision`} onClick={() => deck.undo(suggestion.id)} size="compact" type="button" variant="ghost">Undo</Button>
							)}
						</li>
					);
				})}
			</ol>
			<footer className="mt-1.5 flex items-center justify-end gap-2 border-t border-border px-3 py-2.5">
				<Button disabled={remaining === 0} onClick={deck.dismissAll} size="compact" type="button" variant="ghost">Dismiss all</Button>
				<Button disabled={remaining === 0} onClick={deck.acceptAll} size="compact" type="button" variant="outline">Accept all</Button>
			</footer>
		</section>
	);
}
