"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";

/** Which control should hold focus once a decision re-renders the list. */
export type FocusRequest = { target: "undo" | "accept"; id: SuggestionFieldId; serial: number } | { target: "done"; serial: number } | null;

/**
 * Keeps keyboard focus on a sensible control when the one that was pressed unmounts:
 * a decided row's Undo, a restored row's Accept, or the footer's Done after a bulk decision.
 * Callers only request this for keyboard presses: after a mouse click, moving focus would pop the target's tooltip
 * over its neighbours and tint it as if pressed.
 */
export function useDecisionFocus(panelRef: RefObject<HTMLDivElement | null>) {
	const [request, setRequest] = useState<FocusRequest>(null);
	const serial = useRef(0);
	useEffect(() => {
		const surface = panelRef.current;
		if (!surface || request == null) return;
		// The pressed row may have folded into the caught-up summary; fall back to its Undo, then to Done.
		const selectors = request.target === "done"
			? [`[data-peek-focus="done"]`]
			: [`[data-peek-row="${request.id}"] [data-peek-focus="${request.target}"]`, `[data-peek-focus="batch-undo"]`, `[data-peek-focus="done"]`];
		for (const selector of selectors) {
			const target = surface.querySelector<HTMLElement>(selector);
			if (target) {
				target.focus({ preventScroll: true });
				return;
			}
		}
	}, [panelRef, request]);
	return {
		focusRow: (id: SuggestionFieldId, target: "undo" | "accept") => {
			serial.current += 1;
			setRequest({ id, target, serial: serial.current });
		},
		focusDone: () => {
			serial.current += 1;
			setRequest({ target: "done", serial: serial.current });
		},
	};
}

/**
 * Row order for one opening of the popover: pending first, then anything already decided, so a reopened list leads
 * with what still needs review. The order is fixed while open (rows never jump under the pointer); arrivals append.
 */
export function useOpeningOrder(review: SuggestionReview): readonly WorkItemSuggestion[] {
	const [opening] = useState<readonly SuggestionFieldId[]>(() => {
		const ids = review.suggestions.map((suggestion) => suggestion.id);
		return [...ids.filter((id) => review.decisionOf(id) === "pending"), ...ids.filter((id) => review.decisionOf(id) !== "pending")];
	});
	const rank = (id: SuggestionFieldId) => {
		const index = opening.indexOf(id);
		return index === -1 ? opening.length + review.suggestions.findIndex((suggestion) => suggestion.id === id) : index;
	};
	return [...review.suggestions].sort((a, b) => rank(a.id) - rank(b.id));
}

/** Escape unpins the pane first, then closes the popover. Also catches Escape when focus has fallen back to the page body. */
export function usePanelEscape(panelRef: RefObject<HTMLDivElement | null>, pinned: boolean, unpin: () => void, close: () => void) {
	const handle = useEffectEvent((event: KeyboardEvent) => {
		if (event.key !== "Escape" || event.defaultPrevented) return;
		const surface = panelRef.current;
		const target = event.target as Node | null;
		if (!surface || !(target === document.body || surface.contains(target))) return;
		event.preventDefault();
		if (pinned) unpin();
		else close();
	});
	useEffect(() => {
		const keydown = (event: KeyboardEvent) => handle(event);
		document.addEventListener("keydown", keydown);
		return () => document.removeEventListener("keydown", keydown);
	}, []);
}

/** The popover's own height, which caps the peek pane so the pair always shares one footprint. */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number | null {
	const [height, setHeight] = useState<number | null>(null);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return undefined;
		const measure = () => setHeight(element.offsetHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return height;
}
