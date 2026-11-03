"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

import { WORK_ITEM_SUGGESTIONS } from "../data/suggestions";
import { MockDetailsRail } from "../mock-details-rail";
import { useSuggestionReview, type SuggestionReview } from "../use-suggestion-review";
import { WorkItemPreviewShell } from "../work-item-preview-shell";
import { DeckProgress, DeckStack } from "./focus-deck/deck-stack";
import { ReviewQueue } from "./focus-deck/review-queue";
import { useFocusDeck, type FocusDeck } from "./focus-deck/use-focus-deck";

/** The work item's own Description, which an accepted description suggestion fills in place. */
function DescriptionField({ review, deck }: Readonly<{ review: SuggestionReview; deck: FocusDeck }>) {
	const suggestion = review.suggestions.find((item) => item.id === "description");
	const accepted = suggestion != null && review.decisionOf(suggestion.id) === "accepted";
	const reviewing = !deck.complete && deck.current?.id === "description";
	return (
		<section aria-label="Description" className="flex shrink-0 flex-col gap-1">
			<h2 className="text-sm font-semibold text-text">Description</h2>
			{accepted && suggestion?.value.kind === "paragraph" ? (
				<p className={cn("-mx-2 rounded-md px-2 py-1 text-sm text-pretty text-text transition-colors duration-slow ease-out", deck.descriptionHighlighted ? "bg-bg-success-subtler" : null)}>
					{suggestion.value.text}
				</p>
			) : (
				<p className="py-1 text-sm text-text-subtlest">
					Add description
					{reviewing ? <span className="text-text-discovery"> · suggestion ready below</span> : null}
				</p>
			)}
		</section>
	);
}

export function FocusDeckVariant() {
	const review = useSuggestionReview(WORK_ITEM_SUGGESTIONS);
	const deckRef = useRef<HTMLElement>(null);
	const railRef = useRef<HTMLDivElement>(null);
	const deck = useFocusDeck(review, deckRef, railRef);

	const main = (
		<div className="flex h-full flex-col gap-4">
			<DescriptionField deck={deck} review={review} />
			<section
				aria-keyshortcuts="A D U ArrowLeft ArrowRight"
				aria-label="Suggestion review. A accepts, D dismisses, U undoes, arrow keys move between suggestions."
				className="-m-1 flex min-h-0 flex-1 flex-col gap-3 rounded-2xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-border-focused"
				ref={deckRef}
				tabIndex={0}
			>
				<DeckProgress deck={deck} review={review} />
				<DeckStack deck={deck} review={review} />
				<p aria-live="polite" className="sr-only">{deck.announcement}</p>
			</section>
		</div>
	);

	return (
		<WorkItemPreviewShell
			main={main}
			rail={(
				<>
					<ReviewQueue deck={deck} review={review} />
					<div className="shrink-0" ref={railRef}>
						<MockDetailsRail highlighted={deck.highlighted} review={review} />
					</div>
				</>
			)}
			railClassName="-m-1 w-[368px] p-1"
		/>
	);
}
