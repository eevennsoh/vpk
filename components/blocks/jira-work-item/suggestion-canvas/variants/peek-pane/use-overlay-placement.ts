"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

import { PEEK_TIMING } from "./peek-timing";

const PANEL_GAP = 8;
const FRAME_INSET = 24;

/**
 * Places the popover to the left of its trigger, top-aligned with it, inside the preview frame.
 * It renders in the shell's overlay instead of a body portal so it pans and zooms with its canvas frame.
 */
export function useOverlayPlacement(open: boolean) {
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
			setStyle({ top, right: (frame.right - trigger.left) / scale + PANEL_GAP, maxHeight: overlay.offsetHeight - top - FRAME_INSET });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(overlay);
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [open]);
	return { overlayRef, anchorRef, style };
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
			}, PEEK_TIMING.filledHighlightMs));
		}
	}, []);
	return { filled, flash };
}
