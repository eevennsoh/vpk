"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";

/** How long a freshly filled field keeps its glow. A hold, not an animation duration. */
const HIGHLIGHT_HOLD_MS = 1600;
/** Rail rows the Details card renders; Description lands in the main column instead. */
const RAIL_FIELDS: ReadonlySet<SuggestionFieldId> = new Set(["assignee", "dueDate", "parent", "labels", "acceptanceCriteria"]);
const CONTROL_SELECTOR = "input, textarea, select, button, a[href], [contenteditable=''], [contenteditable='true'], [role='button'], [role='link'], [role='menuitem'], [role='option'], [role='tab'], [role='checkbox'], [role='switch'], [role='slider'], [role='combobox']";

export type DeckDirection = 1 | -1;

function nextPendingIndex(review: SuggestionReview, from: number, skip: SuggestionFieldId): number | null {
	const count = review.suggestions.length;
	for (let step = 1; step <= count; step += 1) {
		const index = (from + step) % count;
		const candidate = review.suggestions[index];
		if (candidate && candidate.id !== skip && review.decisionOf(candidate.id) === "pending") return index;
	}
	return null;
}

/** Keep a filled rail row in view inside the rail's own scrollport (never scrolls the page or canvas). */
function revealRailRow(rail: HTMLElement | null, label: string) {
	const scroller = rail?.parentElement;
	if (!rail || !scroller) return;
	const labelNode = Array.from(rail.querySelectorAll("span")).find((node) => node.textContent === label);
	const row = labelNode?.parentElement;
	if (!row) return;
	const top = row.offsetTop - 12;
	const bottom = row.offsetTop + row.offsetHeight + 12;
	if (top < scroller.scrollTop) scroller.scrollTo({ top, behavior: "smooth" });
	else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTo({ top: bottom - scroller.clientHeight, behavior: "smooth" });
}

export interface FocusDeck {
	current: WorkItemSuggestion | undefined;
	cursor: number;
	direction: DeckDirection;
	complete: boolean;
	highlighted: ReadonlySet<SuggestionFieldId>;
	descriptionHighlighted: boolean;
	announcement: string;
	goTo: (index: number) => void;
	step: (delta: DeckDirection) => void;
	accept: () => void;
	dismiss: () => void;
	undo: (id: SuggestionFieldId) => void;
	acceptAll: () => void;
	dismissAll: () => void;
	reviewAgain: () => void;
}

export function useFocusDeck(review: SuggestionReview, deckRef: RefObject<HTMLElement | null>, railRef: RefObject<HTMLElement | null>): FocusDeck {
	const [cursor, setCursor] = useState(0);
	const [direction, setDirection] = useState<DeckDirection>(1);
	const [highlighted, setHighlighted] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const [announcement, setAnnouncement] = useState("");
	const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const current = review.suggestions[cursor];
	const complete = review.pending.length === 0;

	useEffect(() => () => {
		if (holdRef.current) clearTimeout(holdRef.current);
	}, []);

	useEffect(() => {
		const first = review.suggestions.find((suggestion) => highlighted.has(suggestion.id) && RAIL_FIELDS.has(suggestion.id));
		if (first) revealRailRow(railRef.current, first.label);
	}, [highlighted, railRef, review.suggestions]);

	const flash = useCallback((ids: readonly SuggestionFieldId[]) => {
		if (holdRef.current) clearTimeout(holdRef.current);
		setHighlighted(new Set(ids));
		holdRef.current = setTimeout(() => setHighlighted(new Set()), HIGHLIGHT_HOLD_MS);
	}, []);

	const refocusDeck = useCallback(() => deckRef.current?.focus({ preventScroll: true }), [deckRef]);

	const goTo = useCallback((index: number) => {
		setDirection(index < cursor ? -1 : 1);
		setCursor(index);
	}, [cursor]);

	const step = useCallback((delta: DeckDirection) => {
		const index = cursor + delta;
		if (index < 0 || index >= review.suggestions.length) return;
		setDirection(delta);
		setCursor(index);
	}, [cursor, review.suggestions.length]);

	const decide = useCallback((decision: "accepted" | "dismissed") => {
		if (!current || review.decisionOf(current.id) !== "pending") return;
		const next = nextPendingIndex(review, cursor, current.id);
		if (decision === "accepted") {
			review.accept(current.id);
			flash([current.id]);
		} else {
			review.dismiss(current.id);
		}
		const nextLabel = next == null ? "All suggestions reviewed." : `Next: ${review.suggestions[next]?.label}.`;
		setAnnouncement(`${current.label} ${decision}. ${nextLabel}`);
		if (next != null) {
			setDirection(next < cursor ? -1 : 1);
			setCursor(next);
		}
		refocusDeck();
	}, [current, cursor, flash, refocusDeck, review]);

	const accept = useCallback(() => decide("accepted"), [decide]);
	const dismiss = useCallback(() => decide("dismissed"), [decide]);

	const undo = useCallback((id: SuggestionFieldId) => {
		const index = review.suggestions.findIndex((suggestion) => suggestion.id === id);
		review.undo(id);
		setAnnouncement(`${review.suggestions[index]?.label ?? "Suggestion"} restored for review.`);
		if (index >= 0) {
			setDirection(index < cursor ? -1 : 1);
			setCursor(index);
		}
	}, [cursor, review]);

	const acceptAll = useCallback(() => {
		flash(review.pending.map((suggestion) => suggestion.id));
		setAnnouncement(`${review.pending.length} suggestions accepted.`);
		review.acceptAll();
	}, [flash, review]);

	const dismissAll = useCallback(() => {
		setAnnouncement(`${review.pending.length} suggestions dismissed.`);
		review.dismissAll();
	}, [review]);

	const reviewAgain = useCallback(() => {
		review.reset();
		setDirection(-1);
		setCursor(0);
		setAnnouncement("Review restarted.");
		refocusDeck();
	}, [refocusDeck, review]);

	const onKeyDown = useCallback((event: KeyboardEvent) => {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement;
		if (target !== event.currentTarget && target.closest(CONTROL_SELECTOR)) return;
		const key = event.key.toLowerCase();
		const decided = current ? review.decisionOf(current.id) !== "pending" : false;
		if (key === "arrowleft") step(-1);
		else if (key === "arrowright") step(1);
		else if (complete) return;
		else if (key === "a" && !decided) accept();
		else if (key === "d" && !decided) dismiss();
		else if (key === "u" && decided && current) undo(current.id);
		else return;
		event.preventDefault();
	}, [accept, complete, current, dismiss, review, step, undo]);

	// Shortcuts listen on the deck element itself, so they only fire while the deck (not a control in it) has focus.
	const keyHandlerRef = useRef(onKeyDown);
	useEffect(() => {
		keyHandlerRef.current = onKeyDown;
	}, [onKeyDown]);
	useEffect(() => {
		const node = deckRef.current;
		if (!node) return undefined;
		const listener = (event: KeyboardEvent) => keyHandlerRef.current(event);
		node.addEventListener("keydown", listener);
		return () => node.removeEventListener("keydown", listener);
	}, [deckRef]);

	return {
		current,
		cursor,
		direction,
		complete,
		highlighted,
		descriptionHighlighted: highlighted.has("description"),
		announcement,
		goTo,
		step,
		accept,
		dismiss,
		undo,
		acceptAll,
		dismissAll,
		reviewAgain,
	};
}
