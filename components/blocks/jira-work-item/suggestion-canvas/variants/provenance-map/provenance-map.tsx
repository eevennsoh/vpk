"use client";

import { useMemo, useRef } from "react";

import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { ConnectorLayer } from "./connector-layer";
import { DecidedSuggestionRow } from "./decided-suggestion-row";
import { PendingSuggestionRow } from "./pending-suggestion-row";
import { SourceCard } from "./source-card";
import { PROVENANCE_SOURCES, provenanceEdges } from "./sources";
import { useConnectorGeometry } from "./use-connector-geometry";
import { useProvenanceHighlight } from "./use-provenance-highlight";
import type { ReviewActions } from "./use-review-actions";

/** Two zones joined by curves: what the agent suggests, and where each suggestion came from. */
export function ProvenanceMap({ review, actions }: Readonly<{ review: SuggestionReview; actions: ReviewActions }>) {
	const mapRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLUListElement>(null);
	const edges = useMemo(() => provenanceEdges(review.suggestions), [review.suggestions]);
	const highlight = useProvenanceHighlight(review, edges, mapRef);
	const layoutKey = review.suggestions.map((suggestion) => review.decisionOf(suggestion.id)).join();
	const geometry = useConnectorGeometry(mapRef, viewportRef, layoutKey);
	const { focus } = highlight;
	const remaining = review.pending.length;

	return (
		<div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_48px_200px] grid-rows-[auto_minmax(0,1fr)]" ref={mapRef}>
			<div className="flex items-baseline justify-between pt-3 pr-1 pb-2 pl-4">
				<h3 className="text-xs font-semibold text-text-subtle">Suggested values</h3>
				<span aria-live="polite" className="text-xs text-text-subtlest">
					{remaining > 0 ? `${remaining} of ${review.suggestions.length} to review` : "All reviewed"}
				</span>
			</div>
			<div aria-hidden="true" />
			<h3 className="pt-3 pr-4 pb-2 text-xs font-semibold text-text-subtle">Sources</h3>
			<ul aria-label="Suggestions" className="flex min-h-0 flex-col gap-2 overflow-y-auto pt-1 pr-1 pb-6 pl-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]" ref={viewportRef}>
				{review.suggestions.map((suggestion) => {
					const decision = review.decisionOf(suggestion.id);
					const intent = actions.focusIntent?.id === suggestion.id ? actions.focusIntent.target : null;
					return decision === "pending" ? (
						<PendingSuggestionRow
							dimmed={focus.kind === "source" && !highlight.isRowLit(suggestion.id)}
							focusTarget={intent}
							key={suggestion.id}
							lit={highlight.isRowLit(suggestion.id)}
							onAccept={() => actions.accept(suggestion.id)}
							onDismiss={() => actions.dismiss(suggestion.id)}
							onWhyOpenChange={(open) => highlight.setWhyRow(open ? suggestion.id : null)}
							suggestion={suggestion}
						/>
					) : (
						<DecidedSuggestionRow autoFocus={intent === "undo"} decision={decision} key={suggestion.id} onUndo={() => actions.undo(suggestion.id)} suggestion={suggestion} />
					);
				})}
			</ul>
			<div aria-hidden="true" />
			<div className="flex min-h-0 flex-col gap-3 overflow-y-auto pt-1 pr-4 pb-4">
			<ul aria-label="Sources" className="flex flex-col gap-1.5">
				{PROVENANCE_SOURCES.map((source) => {
					const supports = review.pending.filter((suggestion) => edges.some((edge) => edge.sourceId === source.id && edge.suggestionId === suggestion.id));
					const lit = highlight.isSourceLit(source.id);
					return (
						<li key={source.id}>
							<SourceCard
								dimmed={highlight.dimsOthers && !lit}
								lit={lit}
								onTogglePin={() => highlight.togglePinnedSource(source.id)}
								pinned={highlight.pinnedSource === source.id}
								source={source}
								supports={supports}
							/>
						</li>
					);
				})}
			</ul>
			<p className="px-1 text-[11px]/4 text-pretty text-text-subtlest">Hover or focus a suggestion to trace its sources. Press a source to pin what it supports.</p>
			</div>
			<ConnectorLayer activeEdges={highlight.activeEdges} dimsOthers={highlight.dimsOthers} geometry={geometry} pendingEdges={highlight.pendingEdges} />
		</div>
	);
}
