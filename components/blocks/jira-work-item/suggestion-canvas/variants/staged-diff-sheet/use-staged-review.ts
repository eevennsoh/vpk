"use client";

import { type RefObject, useCallback, useEffect, useMemo, useState } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { useSuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import type { Receipt } from "./rail-status";

const FLASH_MS = 1600;

interface ReceiptState extends Receipt {
	ids: readonly SuggestionFieldId[];
}

/**
 * Staging layer over the shared review state: which pending changes are included in the next Apply,
 * whether the sheet is open, the post-apply receipt (for Undo), and which fields just received a value.
 */
export interface StagedReviewRefs {
	sheetRef: RefObject<HTMLElement | null>;
	railStatusRef: RefObject<HTMLDivElement | null>;
}

export function useStagedReview(suggestions: readonly WorkItemSuggestion[], { sheetRef, railStatusRef }: StagedReviewRefs) {
	const review = useSuggestionReview(suggestions);
	const [open, setOpen] = useState(true);
	const [excluded, setExcluded] = useState<ReadonlySet<SuggestionFieldId>>(() => new Set());
	const [receipt, setReceipt] = useState<ReceiptState | null>(null);
	const [flash, setFlash] = useState<ReadonlySet<SuggestionFieldId> | null>(null);

	useEffect(() => {
		if (!flash) return;
		const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
		return () => window.clearTimeout(timer);
	}, [flash]);

	const isIncluded = useCallback((id: SuggestionFieldId) => !excluded.has(id), [excluded]);
	const setIncluded = useCallback((ids: readonly SuggestionFieldId[], included: boolean) => {
		setExcluded((prev) => {
			const next = new Set(prev);
			for (const id of ids) {
				if (included) next.delete(id);
				else next.add(id);
			}
			return next;
		});
	}, []);

	const openSheet = () => {
		setOpen(true);
		requestAnimationFrame(() => sheetRef.current?.focus());
	};
	const closeSheet = () => {
		setOpen(false);
		requestAnimationFrame(() => railStatusRef.current?.focus());
	};

	const accept = (id: SuggestionFieldId) => {
		review.accept(id);
		setFlash(new Set([id]));
	};

	const apply = () => {
		const ids = review.pending.map((suggestion) => suggestion.id).filter(isIncluded);
		if (ids.length === 0) return;
		for (const id of ids) review.accept(id);
		setReceipt({ kind: "applied", count: ids.length, ids });
		setFlash(new Set(ids));
		closeSheet();
	};

	const dismissRemaining = () => {
		const ids = review.pending.map((suggestion) => suggestion.id);
		review.dismissAll();
		setReceipt({ kind: "dismissed", count: ids.length, ids });
		closeSheet();
	};

	const undoReceipt = () => {
		if (!receipt) return;
		for (const id of receipt.ids) review.undo(id);
		setReceipt(null);
	};

	const reset = () => {
		review.reset();
		setExcluded(new Set());
		setReceipt(null);
		openSheet();
	};

	const highlighted = useMemo(() => flash ?? new Set<SuggestionFieldId>(), [flash]);

	return {
		review,
		open,
		toggleSheet: () => (open ? closeSheet() : openSheet()),
		closeSheet,
		isIncluded,
		setIncluded,
		accept,
		apply,
		dismissRemaining,
		receipt,
		undoReceipt,
		closeReceipt: () => setReceipt(null),
		reset,
		highlighted,
	};
}
