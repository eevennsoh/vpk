"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { AnimatePresence } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { token } from "@/lib/tokens";

import { ListCard } from "./list-card";
import { PanelFooter, PanelHeader, PanelStatus } from "./panel-chrome";
import { ReviewedGroup } from "./reviewed-group";
import { arrivalRunOf, stackOrder } from "./stack-order";

export interface StackPanelProps {
	id: string;
	feed: SuggestionFeed;
	panelRef: RefObject<HTMLDivElement | null>;
	/** Keeps why cards inside the preview frame; they open top-aligned with the panel. */
	whyMaxHeight?: number;
	onAccept: (id: SuggestionFieldId) => void;
	onAcceptAll: () => void;
	onClose: () => void;
}

/** Brings the top of the list into view when a run adds cards, so arrivals are never offscreen. */
function useRevealArrivals(feed: SuggestionFeed) {
	const bodyRef = useRef<HTMLDivElement>(null);
	const arrivalRun = arrivalRunOf(feed);
	useEffect(() => {
		if (arrivalRun > 1) bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	}, [arrivalRun]);
	return bodyRef;
}

/**
 * The deck fanned out: pending cards as soft tiles, newest run on top, with bulk decisions and a re-run. Cards
 * decided here fold into receipts in place; everything decided earlier (or once nothing is left) folds into one
 * "N reviewed" line, so the list never turns into a column of identical receipts.
 */
export function StackPanel({ id, feed, panelRef, whyMaxHeight, onAccept, onAcceptAll, onClose }: Readonly<StackPanelProps>) {
	const { review } = feed;
	const bodyRef = useRevealArrivals(feed);
	const titleId = `${id}-title`;
	const ordered = stackOrder(feed);
	/**
	 * Decided one by one while this list is open, keyed to the run they were decided in: their receipts stay where the
	 * card was until a run brings new cards (or nothing is left), then they join the reviewed line.
	 */
	const [decidedHere, setDecidedHere] = useState<ReadonlyMap<SuggestionFieldId, number>>(new Map());
	const runCount = feed.runs.length;
	const markHere = (suggestionId: SuggestionFieldId) => setDecidedHere((current) => new Map(current).set(suggestionId, runCount));
	const caughtUp = review.pending.length === 0;
	const inList = ordered.filter((suggestion) => review.decisionOf(suggestion.id) === "pending" || (!caughtUp && decidedHere.get(suggestion.id) === runCount));
	const reviewed = ordered.filter((suggestion) => !inList.includes(suggestion));
	const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
		if (event.key === "Escape" && !event.defaultPrevented) onClose();
	});
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const listener = (event: KeyboardEvent) => closeOnEscape(event);
		panel.addEventListener("keydown", listener);
		return () => panel.removeEventListener("keydown", listener);
	}, [panelRef]);
	return (
		<div
			aria-labelledby={titleId}
			className="flex max-h-full w-[344px] flex-col rounded-xl bg-surface-overlay outline-none"
			id={id}
			ref={panelRef}
			role="dialog"
			tabIndex={-1}
			style={{ boxShadow: token("elevation.shadow.overlay") }}
		>
			<PanelHeader feed={feed} onClose={onClose} titleId={titleId} />
			<div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 pt-0.5 pb-2" ref={bodyRef}>
				<PanelStatus feed={feed} />
				{inList.length > 0 ? (
					<ol aria-label="Suggested field values" className="flex flex-col gap-1">
						<AnimatePresence initial={false}>
							{inList.map((suggestion) => (
								<ListCard
									decision={review.decisionOf(suggestion.id)}
									isNew={feed.newIds.has(suggestion.id)}
									key={suggestion.id}
									onAccept={() => {
										markHere(suggestion.id);
										onAccept(suggestion.id);
									}}
									onDismiss={() => {
										markHere(suggestion.id);
										review.dismiss(suggestion.id);
									}}
									onUndo={() => review.undo(suggestion.id)}
									suggestion={suggestion}
									whyMaxHeight={whyMaxHeight}
								/>
							))}
						</AnimatePresence>
					</ol>
				) : null}
				{reviewed.length > 0 ? <ReviewedGroup groupId={`${id}-reviewed`} items={reviewed} review={review} /> : null}
			</div>
			<PanelFooter feed={feed} onAcceptAll={onAcceptAll} onClose={onClose} ordered={ordered} />
		</div>
	);
}
