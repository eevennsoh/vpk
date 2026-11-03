"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";

const MENU_GAP = 8;
/** The menu surface width; the main column keeps the description clear of it while the menu is open. */
export const MENU_WIDTH = 336;
/** The shell's column gap; the menu sits MENU_GAP left of the rail, so this much of the main column is under it. */
const SHELL_GAP = 24;
export const MENU_OVERLAP = MENU_WIDTH + MENU_GAP - SHELL_GAP;
/** How long the footer keeps offering Undo for the last action, counted from the action itself. */
const UNDO_MS = 12000;
const FRAME_INSET = 24;
const HIGHLIGHT_MS = 1400;
/** How long a decided row stays as a one-line receipt before it folds away. */
const RECEIPT_MS = 2600;

/**
 * Places the menu to the left of its trigger, top-aligned, inside the preview frame.
 * It renders in the shell's overlay (not a body portal) so it pans and zooms with the canvas frame.
 */
export function useMenuPlacement(open: boolean) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const anchorRef = useRef<HTMLDivElement>(null);
	const [style, setStyle] = useState<CSSProperties | null>(null);
	useLayoutEffect(() => {
		const overlay = overlayRef.current;
		const anchor = anchorRef.current;
		if (!open || !overlay || !anchor) return undefined;
		const measure = () => {
			const frame = overlay.getBoundingClientRect();
			const trigger = anchor.getBoundingClientRect();
			const scale = frame.width / overlay.offsetWidth || 1;
			const top = (trigger.top - frame.top) / scale;
			setStyle({ top, right: (frame.right - trigger.left) / scale + MENU_GAP, maxHeight: overlay.offsetHeight - top - FRAME_INSET });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(overlay);
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [open]);
	return { overlayRef, anchorRef, style };
}

/**
 * Scrolls the Details rail so a row that just filled is in view (acceptance criteria sit below the fold).
 * Scrolls only the rail's own scrollport, never the page or the canvas, and measures in the frame's unscaled space.
 */
export function useRevealFilled() {
	const railRef = useRef<HTMLDivElement>(null);
	const reveal = useCallback(() => {
		requestAnimationFrame(() => requestAnimationFrame(() => {
			const rail = railRef.current;
			const scroller = rail?.parentElement;
			const row = rail?.querySelector<HTMLElement>(".bg-bg-success-subtler");
			if (!scroller || !row) return;
			const box = scroller.getBoundingClientRect();
			const target = row.getBoundingClientRect();
			const scale = box.height / scroller.offsetHeight || 1;
			const below = (target.bottom - box.bottom) / scale;
			const above = (box.top - target.top) / scale;
			if (below <= 0 && above <= 0) return;
			const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			scroller.scrollBy({ top: below > 0 ? below + 8 : -(above + 8), behavior: smooth ? "smooth" : "auto" });
		}));
	}, []);
	return { railRef, reveal };
}

/** Briefly tints Details rows that just received a value, tying each Accept to its consequence. */
export function useJustFilled() {
	const [filled, setFilled] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const timers = useRef(new Map<SuggestionFieldId, number>());
	useEffect(() => {
		const pending = timers.current;
		return () => pending.forEach((timer) => window.clearTimeout(timer));
	}, []);
	const flash = useCallback((ids: readonly SuggestionFieldId[]) => {
		setFilled((current) => new Set([...current, ...ids]));
		for (const id of ids) {
			window.clearTimeout(timers.current.get(id));
			timers.current.set(id, window.setTimeout(() => {
				timers.current.delete(id);
				setFilled((current) => new Set([...current].filter((entry) => entry !== id)));
			}, HIGHLIGHT_MS));
		}
	}, []);
	return { filled, flash };
}

/**
 * Decided rows linger as receipts, then fold away. A receipt the pointer or focus is resting on is held
 * until it is left, so Undo never disappears from under the cursor.
 */
export function useReceipts() {
	const [receipts, setReceipts] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const timers = useRef(new Map<SuggestionFieldId, number>());
	const held = useRef(new Set<SuggestionFieldId>());
	useEffect(() => {
		const pending = timers.current;
		return () => pending.forEach((timer) => window.clearTimeout(timer));
	}, []);

	const drop = useCallback((id: SuggestionFieldId) => {
		window.clearTimeout(timers.current.get(id));
		timers.current.delete(id);
		setReceipts((current) => {
			if (!current.has(id)) return current;
			const next = new Set(current);
			next.delete(id);
			return next;
		});
	}, []);

	const schedule = useCallback((id: SuggestionFieldId) => {
		window.clearTimeout(timers.current.get(id));
		timers.current.set(id, window.setTimeout(() => {
			if (held.current.has(id)) return;
			drop(id);
		}, RECEIPT_MS));
	}, [drop]);

	const add = useCallback((id: SuggestionFieldId) => {
		setReceipts((current) => new Set([...current, id]));
		schedule(id);
	}, [schedule]);

	const hold = useCallback((id: SuggestionFieldId, holding: boolean) => {
		if (holding) {
			held.current.add(id);
			return;
		}
		held.current.delete(id);
		if (timers.current.has(id)) schedule(id);
	}, [schedule]);

	const clear = useCallback(() => {
		timers.current.forEach((timer) => window.clearTimeout(timer));
		timers.current.clear();
		held.current.clear();
		setReceipts(new Set());
	}, []);

	return { receipts, add, drop, hold, clear };
}

export interface LastAction {
	ids: readonly SuggestionFieldId[];
	decision: "accepted" | "dismissed";
	bulk: boolean;
}

/**
 * The last decision, offered back as a labelled footer Undo. It expires after a while (paused while the pointer
 * or focus rests on it) and survives re-runs; only a newer action or expiry retires it.
 */
export function useLastAction() {
	const [last, setLast] = useState<LastAction | null>(null);
	const timer = useRef(0);
	const held = useRef(false);
	useEffect(() => () => window.clearTimeout(timer.current), []);

	const arm = useCallback((delay: number) => {
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			if (!held.current) setLast(null);
		}, delay);
	}, []);

	const record = useCallback((action: LastAction) => {
		setLast(action);
		arm(UNDO_MS);
	}, [arm]);

	const clear = useCallback(() => {
		window.clearTimeout(timer.current);
		held.current = false;
		setLast(null);
	}, []);

	const hold = useCallback((holding: boolean) => {
		held.current = holding;
		if (!holding) arm(UNDO_MS / 2);
	}, [arm]);

	return { last, record, clear, hold };
}
