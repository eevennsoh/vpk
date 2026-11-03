"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

/**
 * Rest delay before the first card opens. Long enough that travelling across the menu, or toward a row's
 * actions, stays quiet; the card is for a deliberate pause on the suggestion itself.
 */
const OPEN_DELAY_MS = 520;
/** Once a card is showing, resting on a neighbouring row switches faster, like a submenu. */
const SWITCH_DELAY_MS = 160;
const CLOSE_DELAY_MS = 180;
/** Keyboard focus opens the card once the reviewer settles on a row, so arrowing through the list stays calm. */
const FOCUS_DELAY_MS = 160;

/** Gap between the card and the menu's left edge. */
export const WHY_OFFSET = 14;

/** Space kept between the card and the preview frame's top and bottom edges. */
const FRAME_PAD = 24;
/** Space kept between the card and the preview frame's left edge. */
const FRAME_PAD_X = 16;
/** The card's top sits a touch above its row, so the row's label and the card's eyebrow share a line. */
const ROW_LEAD = 6;

/**
 * A virtual anchor for the card: the row's visible slice, shifted only as far as needed for the card to stay
 * inside the preview frame. Floating UI re-reads it whenever the card resizes, so the card's live height is used.
 */
export interface WhyAnchor {
	getBoundingClientRect: () => DOMRect;
	contextElement: Element;
}

function framedAnchor(row: HTMLElement, popupId: string): WhyAnchor {
	return {
		contextElement: row,
		getBoundingClientRect: () => {
			const box = row.getBoundingClientRect();
			const port = row.closest("[data-why-scrollport]")?.getBoundingClientRect();
			const frame = row.closest("[data-why-frame]")?.getBoundingClientRect();
			const cardBox = document.getElementById(popupId)?.getBoundingClientRect();
			const card = cardBox?.height ?? 0;
			const visibleTop = port ? Math.min(Math.max(box.top, port.top), port.bottom) : box.top;
			let top = visibleTop - ROW_LEAD;
			if (frame) top = Math.max(frame.top + FRAME_PAD, Math.min(top, frame.bottom - FRAME_PAD - card));
			/** Never let the card cross the frame's left edge; in a tight frame it tucks over the menu's edge instead. */
			const left = frame && cardBox ? Math.max(box.left, frame.left + FRAME_PAD_X + WHY_OFFSET + cardBox.width) : box.left;
			return new DOMRect(left, top, Math.max(1, box.right - left), 1);
		},
	};
}

export interface WhyState {
	id: SuggestionFieldId;
	anchor: WhyAnchor;
	open: boolean;
}

/**
 * One why card per menu, anchored to whichever row is hovered or focused. The last suggestion is retained
 * while closing so the card can animate out with its content.
 */
export function useWhyCard(popupId: string) {
	const [state, setState] = useState<WhyState | null>(null);
	const openTimer = useRef(0);
	const closeTimer = useRef(0);
	const openId = state?.open ? state.id : null;

	useEffect(() => () => {
		window.clearTimeout(openTimer.current);
		window.clearTimeout(closeTimer.current);
	}, []);

	const clearTimers = useCallback(() => {
		window.clearTimeout(openTimer.current);
		window.clearTimeout(closeTimer.current);
	}, []);

	const show = useCallback((id: SuggestionFieldId, anchor: HTMLElement) => {
		clearTimers();
		setState({ id, anchor: framedAnchor(anchor, popupId), open: true });
	}, [clearTimers, popupId]);

	const close = useCallback(() => {
		clearTimers();
		setState((current) => (current?.open ? { ...current, open: false } : current));
	}, [clearTimers]);

	const hoverStart = useCallback((id: SuggestionFieldId, anchor: HTMLElement, via: "pointer" | "focus") => {
		window.clearTimeout(closeTimer.current);
		window.clearTimeout(openTimer.current);
		if (openId === id) return;
		const delay = via === "focus" ? FOCUS_DELAY_MS : openId == null ? OPEN_DELAY_MS : SWITCH_DELAY_MS;
		openTimer.current = window.setTimeout(() => show(id, anchor), delay);
	}, [openId, show]);

	const hoverEnd = useCallback(() => {
		window.clearTimeout(openTimer.current);
		window.clearTimeout(closeTimer.current);
		closeTimer.current = window.setTimeout(close, CLOSE_DELAY_MS);
	}, [close]);

	/** The pointer reached a row's actions: drop a pending open, but leave a card that is already showing. */
	const cancelPending = useCallback(() => window.clearTimeout(openTimer.current), []);

	/** Pointer resting on the card itself keeps it open. */
	const cardHold = useCallback(() => clearTimers(), [clearTimers]);

	const toggle = useCallback((id: SuggestionFieldId, anchor: HTMLElement) => {
		if (openId === id) close();
		else show(id, anchor);
	}, [close, openId, show]);

	return { state, openId, show, close, hoverStart, hoverEnd, cancelPending, cardHold, toggle };
}
