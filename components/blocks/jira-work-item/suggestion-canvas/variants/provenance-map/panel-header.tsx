"use client";

import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { PROVENANCE_SOURCES } from "./sources";

interface PanelHeaderProps {
	titleId: string;
	review: SuggestionReview;
	onAcceptAll: () => void;
	onDismissAll: () => void;
	onReset: () => void;
}

export function PanelHeader({ titleId, review, onAcceptAll, onDismissAll, onReset }: Readonly<PanelHeaderProps>) {
	const remaining = review.pending.length;
	const total = review.suggestions.length;
	const { agent } = SUGGESTION_WORK_ITEM;
	return (
		<header className="flex items-center gap-3 border-b border-border px-4 py-3">
			<Tile className="bg-surface" hasBorder label="Teamwork Graph" size="medium" variant="transparent">
				<TeamworkGraphMark />
			</Tile>
			<div className="flex min-w-0 flex-1 flex-col">
				<h2 className="text-sm font-semibold text-text" id={titleId}>Work item suggestions</h2>
				<p className="text-xs text-text-subtlest">
					{agent.name} · {agent.ranAt} · {total} suggestions traced to {PROVENANCE_SOURCES.length} sources
				</p>
			</div>
			{remaining > 0 ? (
				<div className="flex shrink-0 items-center gap-1">
					<Button onClick={onDismissAll} type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={onAcceptAll} type="button">Accept {remaining === total ? "all" : `${remaining} left`}</Button>
				</div>
			) : (
				<Button className="shrink-0" onClick={onReset} type="button" variant="outline">Review again</Button>
			)}
		</header>
	);
}
