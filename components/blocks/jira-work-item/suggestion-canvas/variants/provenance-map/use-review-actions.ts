"use client";

import { useEffect, useRef, useState } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import type { FocusTarget } from "./pending-suggestion-row";

const FLASH_MS = 1600;

export interface ReviewActions {
	focusIntent: { id: SuggestionFieldId; target: FocusTarget } | null;
	/** Details rows that just received a value and should glow briefly. */
	justFilled: ReadonlySet<SuggestionFieldId>;
	accept: (id: SuggestionFieldId) => void;
	dismiss: (id: SuggestionFieldId) => void;
	undo: (id: SuggestionFieldId) => void;
	acceptAll: () => void;
	dismissAll: () => void;
	reset: () => void;
}

/**
 * Wraps the shared review state with the two things a person notices after deciding: where focus lands
 * (the row's Undo, or its Accept after undoing) and a short glow on the Details row that changed.
 */
export function useReviewActions(review: SuggestionReview): ReviewActions {
	const [focusIntent, setFocusIntent] = useState<ReviewActions["focusIntent"]>(null);
	const [justFilled, setJustFilled] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
	}, []);

	const flash = (ids: readonly SuggestionFieldId[]) => {
		if (timer.current) clearTimeout(timer.current);
		setJustFilled(new Set(ids));
		timer.current = setTimeout(() => setJustFilled(new Set()), FLASH_MS);
	};

	return {
		focusIntent,
		justFilled,
		accept: (id) => {
			review.accept(id);
			setFocusIntent({ id, target: "undo" });
			flash([id]);
		},
		dismiss: (id) => {
			review.dismiss(id);
			setFocusIntent({ id, target: "undo" });
		},
		undo: (id) => {
			review.undo(id);
			setFocusIntent({ id, target: "accept" });
		},
		acceptAll: () => {
			flash(review.pending.map((suggestion) => suggestion.id));
			review.acceptAll();
			setFocusIntent(null);
		},
		dismissAll: () => {
			review.dismissAll();
			setFocusIntent(null);
		},
		reset: () => {
			review.reset();
			setFocusIntent(null);
		},
	};
}
