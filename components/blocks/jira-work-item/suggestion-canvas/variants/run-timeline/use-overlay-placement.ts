"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import { motionDuration } from "@/lib/motion";

/** Space between the popover and its trigger, and between a why card and the popover. */
const PANEL_GAP = 8;
/** The popover keeps clear of the preview frame's bottom edge. */
const FRAME_INSET = 24;
/** A filled Details row holds its tint for two of the slowest motion beats, then fades on the rail's own transition. */
const FLASH_HOLD_MS = motionDuration.slowest * 2 * 1000;

/** A viewport rectangle, the shape Base UI accepts as a collision boundary. */
export interface ViewportRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Places the popover to the left of its trigger, top-aligned with it, inside the preview frame.
 * It renders in the shell's overlay rather than a body portal so it pans and zooms with its canvas frame.
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

	/**
	 * Where a why card may sit: inside the preview frame and below the live trigger, so the card never
	 * escapes the frame when the canvas is panned and never hides the count you are changing.
	 */
	const whyBoundary = useCallback((): ViewportRect | undefined => {
		const overlay = overlayRef.current;
		const anchor = anchorRef.current;
		if (!overlay || !anchor) return undefined;
		const frame = overlay.getBoundingClientRect();
		const top = Math.max(frame.top, anchor.getBoundingClientRect().bottom + PANEL_GAP);
		return { x: frame.left, y: top, width: frame.width, height: Math.max(0, frame.bottom - top) };
	}, []);

	return { overlayRef, anchorRef, style, whyBoundary };
}

/**
 * Closes the popover on a pointer press elsewhere in the preview, the way a menu does.
 * Presses on the popover, its trigger, or its portaled layers (why cards, tooltips) are ignored.
 */
export function useDismissOnOutsidePress({ open, scopeRef, insideRefs, onDismiss }: Readonly<{
	open: boolean;
	/** The element whose presses count; presses on canvas chrome outside the preview are left alone. */
	scopeRef: RefObject<HTMLElement | null>;
	insideRefs: readonly RefObject<HTMLElement | null>[];
	onDismiss: () => void;
}>) {
	const handle = useEffectEvent((event: PointerEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (insideRefs.some((ref) => ref.current?.contains(target))) return;
		if (target.closest("[data-run-timeline-layer], [data-slot='tooltip-content']")) return;
		onDismiss();
	});
	useEffect(() => {
		const scope = scopeRef.current?.parentElement;
		if (!open || !scope) return undefined;
		const listener = (event: PointerEvent) => handle(event);
		scope.addEventListener("pointerdown", listener);
		return () => scope.removeEventListener("pointerdown", listener);
	}, [open, scopeRef]);
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
			}, FLASH_HOLD_MS));
		}
	}, []);
	return { filled, flash };
}
