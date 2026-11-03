"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";

import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";

import { focusKey, focusQuietly } from "./ledger-focus";

/**
 * Tracks whether the body is scrolled past its top or has more below, from two sentinels at its edges.
 * Header and footer hairlines appear only while content actually passes under them.
 */
export function useScrollEdges() {
	const bodyRef = useRef<HTMLDivElement>(null);
	const topRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const [scrolled, setScrolled] = useState(false);
	const [moreBelow, setMoreBelow] = useState(false);
	useEffect(() => {
		const root = bodyRef.current;
		const top = topRef.current;
		const bottom = bottomRef.current;
		if (!root || !top || !bottom) return undefined;
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === top) setScrolled(!entry.isIntersecting);
				if (entry.target === bottom) setMoreBelow(!entry.isIntersecting);
			}
		}, { root });
		observer.observe(top);
		observer.observe(bottom);
		return () => observer.disconnect();
	}, []);
	return { bodyRef, topRef, bottomRef, scrolled, moreBelow };
}

/** Brings the top of the list into view when a run adds suggestions, so arrivals are never offscreen. */
export function useRevealArrivals(feed: SuggestionFeed, bodyRef: RefObject<HTMLDivElement | null>) {
	const latest = feed.runs.at(-1);
	const arrivalRun = latest && latest.ids.length > 0 ? latest.number : 0;
	useEffect(() => {
		if (arrivalRun > 1) bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	}, [arrivalRun, bodyRef]);
}

function focusByKey(panel: HTMLElement | null, key: string): boolean {
	const target = panel?.querySelector<HTMLElement>(`[data-focus-key="${key}"]`);
	if (target) focusQuietly(target);
	return target != null;
}

/**
 * Decisions unmount the control that was pressed. The panel names where focus goes next and
 * this moves it there once the new controls have committed, so focus never drops to the page.
 */
export function useFocusHandoff(panelRef: RefObject<HTMLDivElement | null>, feed: SuggestionFeed) {
	const requested = useRef<string | null>(null);
	const request = (key: string) => {
		requested.current = key;
	};
	useEffect(() => {
		const key = requested.current;
		if (key == null) return;
		requested.current = null;
		focusByKey(panelRef.current, key);
	});

	// A run that adds rows removes the caught-up "Check again". If focus fell with it, hand it to the first arrival.
	const runCount = feed.runs.length;
	const firstArrival = feed.runs.at(-1)?.ids[0];
	const caughtUp = feed.review.pending.length === 0;
	useEffect(() => {
		if (runCount < 2) return;
		const active = document.activeElement;
		// The caught-up block may still be folding away, so a focused "Check again" counts as lost once rows arrived.
		const onLeavingCheckAgain = !caughtUp && active instanceof HTMLElement && active.dataset.focusKey === focusKey.checkAgain;
		if (active && active !== document.body && !onLeavingCheckAgain) return;
		const key = firstArrival ? focusKey.accept(firstArrival) : caughtUp ? focusKey.checkAgain : focusKey.refresh;
		focusByKey(panelRef.current, key);
	}, [runCount, firstArrival, caughtUp, panelRef]);

	return request;
}

/** Marks a why card's popup: it portals out of the panel but still belongs to the ledger's keyboard scope. */
export const WHY_CARD_ATTRIBUTE = "data-ledger-why";

interface LedgerEscapeOptions {
	panelRef: RefObject<HTMLElement | null>;
	triggerRef: RefObject<HTMLElement | null>;
	whyOpen: boolean;
	closeWhy: () => void;
	onClose: () => void;
}

/** True when focus sits on the ledger, its trigger, or one of its portaled why cards; nowhere else in the work item. */
function focusInLedger(panel: HTMLElement | null, trigger: HTMLElement | null): boolean {
	const active = document.activeElement;
	if (!(active instanceof Element)) return false;
	return active === trigger || (panel?.contains(active) ?? false) || active.closest(`[${WHY_CARD_ATTRIBUTE}]`) != null;
}

/**
 * Escape closes an open why card first, and the ledger only when no card is open. It is scoped to the ledger:
 * an Escape meant for the comment editor, an inline field or another popover elsewhere on the page is ignored.
 */
export function useLedgerEscape({ panelRef, triggerRef, whyOpen, closeWhy, onClose }: Readonly<LedgerEscapeOptions>) {
	const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
		if (event.key !== "Escape" || !focusInLedger(panelRef.current, triggerRef.current)) return;
		if (whyOpen) {
			closeWhy();
			return;
		}
		if (event.defaultPrevented) return;
		onClose();
	});
	useEffect(() => {
		const listener = (event: KeyboardEvent) => onKeyDown(event);
		document.addEventListener("keydown", listener);
		return () => document.removeEventListener("keydown", listener);
	}, []);
}
