"use client";

import type { CSSProperties } from "react";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { TwgToolBannerBackground, TwgToolSourceStack } from "@/components/ui-custom/twg-tool";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { allEvidence, distinctSources } from "./evidence-sources";

const BAR_STYLE: CSSProperties = { boxShadow: token("elevation.shadow.raised") };

export interface ReviewBarProps {
	review: SuggestionReview;
	onAcceptAll: () => void;
	onDismissAll: () => void;
	onUndoAll: () => void;
}

function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Sticky summary above Details: who suggested, from where, how far review has got, and the bulk actions. */
export function ReviewBar({ review, onAcceptAll, onDismissAll, onUndoAll }: Readonly<ReviewBarProps>) {
	const evidence = allEvidence(review.suggestions);
	const sources = distinctSources(evidence);
	const total = review.suggestions.length;
	const remaining = review.pending.length;
	const reviewed = total - remaining;
	const done = remaining === 0;

	return (
		<section
			aria-label="Work item suggestions"
			className="sticky top-0 z-10 shrink-0 overflow-hidden rounded-xl bg-surface-raised"
			style={BAR_STYLE}
		>
			<TwgToolBannerBackground />
			<div className="relative flex flex-col gap-3 p-3">
				<div className="flex items-center gap-2.5">
					{done ? (
						<Tile label="All reviewed" size="medium" variant="success">
							<CheckCircleIcon color="currentColor" label="" />
						</Tile>
					) : (
						<Tile className="bg-surface" hasBorder label="Teamwork Graph" size="medium" variant="transparent">
							<TeamworkGraphMark />
						</Tile>
					)}
					<div className="flex min-w-0 flex-1 flex-col">
						<span aria-live="polite" className="text-sm font-semibold text-text">
							{done ? "All suggestions reviewed" : `${plural(remaining, "suggestion")} to review`}
						</span>
						<span className="text-xs text-text-subtle">
							{done
								? `${review.accepted.length} accepted · ${review.dismissed.length} dismissed`
								: `${SUGGESTION_WORK_ITEM.agent.name} · ${plural(evidence.length, "source")} · ${SUGGESTION_WORK_ITEM.agent.ranAt}`}
						</span>
					</div>
					{done ? null : <TwgToolSourceStack animated={false} className="shrink-0" iconSize="xsmall" sources={sources} />}
				</div>

				<div className="flex items-center gap-3">
					<div
						aria-label="Review progress"
						aria-valuemax={total}
						aria-valuemin={0}
						aria-valuenow={reviewed}
						aria-valuetext={`${reviewed} of ${total} reviewed`}
						className="flex min-w-0 flex-1 gap-0.5"
						role="progressbar"
					>
						{review.suggestions.map((suggestion) => {
							const decision = review.decisionOf(suggestion.id);
							return (
								<span
									className={cn(
										"h-1 flex-1 rounded-full transition-colors duration-medium ease-out",
										decision === "accepted" ? "bg-chart-success-bold" : decision === "dismissed" ? "bg-border-bold" : "bg-bg-neutral",
									)}
									key={suggestion.id}
								/>
							);
						})}
					</div>
					<span className="shrink-0 text-xs text-text-subtlest tabular-nums">{reviewed}/{total}</span>
				</div>

				<div className="flex items-center justify-end gap-1.5">
					{done ? (
						<Button onClick={onUndoAll} size="compact" type="button" variant="outline">
							<UndoIcon color="currentColor" label="" size="small" />
							Undo all
						</Button>
					) : (
						<>
							{reviewed > 0 ? (
								<Button className="mr-auto" onClick={onUndoAll} size="compact" type="button" variant="ghost">
									<UndoIcon color="currentColor" label="" size="small" />
									Undo all
								</Button>
							) : null}
							<Button onClick={onDismissAll} size="compact" type="button" variant="outline">
								{reviewed > 0 ? "Dismiss rest" : "Dismiss all"}
							</Button>
							<Button onClick={onAcceptAll} size="compact" type="button" variant="default">
								<CheckMarkIcon color="currentColor" label="" size="small" />
								{reviewed > 0 ? `Accept ${remaining}` : "Accept all"}
							</Button>
						</>
					)}
				</div>
			</div>
		</section>
	);
}
