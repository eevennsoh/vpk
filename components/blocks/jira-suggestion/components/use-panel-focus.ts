"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { BodyMode } from "./use-body-height";

interface PanelFocusOptions {
	panelRef: RefObject<HTMLDivElement | null>;
	deckRef: RefObject<HTMLDivElement | null>;
	checkRef: RefObject<HTMLButtonElement | null>;
	toggleRef: RefObject<HTMLButtonElement | null>;
	mode: BodyMode;
	hasCards: boolean;
}

/**
 * Keeps keyboard focus inside the popover when the control holding it unmounts (the last card decided, the stack
 * unpacking, Check again starting a run): it moves to whatever replaced it. Only when the popover held focus, so
 * opening it never draws a ring for someone who only pointed at it.
 */
export function usePanelFocus({ panelRef, deckRef, checkRef, toggleRef, mode, hasCards }: Readonly<PanelFocusOptions>) {
	// Removing a focused element sends focus to <body> without a focusout naming a destination, so this stays true.
	const holdsFocus = useRef(false);
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const onFocusIn = () => {
			holdsFocus.current = true;
		};
		const onFocusOut = (event: FocusEvent) => {
			const next = event.relatedTarget as Node | null;
			if (next && !panel.contains(next)) holdsFocus.current = false;
		};
		panel.addEventListener("focusin", onFocusIn);
		panel.addEventListener("focusout", onFocusOut);
		return () => {
			panel.removeEventListener("focusin", onFocusIn);
			panel.removeEventListener("focusout", onFocusOut);
		};
	}, [panelRef]);

	useEffect(() => {
		const active = document.activeElement;
		if (holdsFocus.current && mode === "caught-up" && active instanceof Element && (active.closest("footer") || deckRef.current?.contains(active))) {
			checkRef.current?.focus({ preventScroll: true });
			return;
		}
		if (!holdsFocus.current || (active != null && active !== document.body && active !== panelRef.current)) return;
		const target = mode === "caught-up" ? checkRef.current : mode === "stack" && hasCards ? deckRef.current : toggleRef.current;
		(target ?? panelRef.current)?.focus({ preventScroll: true });
	}, [checkRef, deckRef, hasCards, mode, panelRef, toggleRef]);
}
