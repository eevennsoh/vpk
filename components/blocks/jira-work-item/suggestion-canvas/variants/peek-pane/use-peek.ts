"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

import { PEEK_TIMING } from "./peek-timing";

export interface PeekState {
	id: SuggestionFieldId | null;
	pinned: boolean;
}

export interface Peek extends PeekState {
	/** Pointer rests on a pending row. */
	hoverRow: (id: SuggestionFieldId) => void;
	/** Pointer leaves a row before intent resolved. */
	leaveRow: () => void;
	/** Pointer is anywhere on the popover or the pane. */
	enterSurface: () => void;
	leaveSurface: () => void;
	/** Pointer is on the pane itself: never retarget while reading. */
	enterPane: () => void;
	/** Keyboard focus moved into a row. Immediate, no intent delay. */
	focusRow: (id: SuggestionFieldId) => void;
	/** Focus left the popover entirely. */
	blurSurface: () => void;
	/** Click or tap on "Why": pins the pane on that row, or unpins it if it is already pinned there. */
	togglePin: (id: SuggestionFieldId) => void;
	/** Move a pinned pane to another row, or close it when there is nothing left to explain. */
	retarget: (id: SuggestionFieldId | null) => void;
	close: () => void;
}

/**
 * Hover-intent state for the peek pane: which row it explains and whether a click pinned it there.
 * Pinned panes ignore hover; unpinned panes follow the pointer or keyboard focus and collapse when both leave.
 */
export function usePeek(): Peek {
	const [state, setState] = useState<PeekState>({ id: null, pinned: false });
	const intent = useRef(0);
	const closing = useRef(0);
	const stateRef = useRef(state);
	useLayoutEffect(() => {
		stateRef.current = state;
	}, [state]);

	useEffect(() => () => {
		window.clearTimeout(intent.current);
		window.clearTimeout(closing.current);
	}, []);

	const hoverRow = useCallback((id: SuggestionFieldId) => {
		const current = stateRef.current;
		window.clearTimeout(intent.current);
		if (current.pinned || current.id === id) return;
		intent.current = window.setTimeout(() => {
			setState((latest) => (latest.pinned ? latest : { id, pinned: false }));
		}, current.id == null ? PEEK_TIMING.openIntentMs : PEEK_TIMING.switchIntentMs);
	}, []);

	const leaveRow = useCallback(() => window.clearTimeout(intent.current), []);
	const enterSurface = useCallback(() => window.clearTimeout(closing.current), []);
	const enterPane = useCallback(() => {
		window.clearTimeout(intent.current);
		window.clearTimeout(closing.current);
	}, []);

	const leaveSurface = useCallback(() => {
		window.clearTimeout(intent.current);
		window.clearTimeout(closing.current);
		if (stateRef.current.pinned) return;
		closing.current = window.setTimeout(() => {
			setState((latest) => (latest.pinned ? latest : { id: null, pinned: false }));
		}, PEEK_TIMING.closeGraceMs);
	}, []);

	const focusRow = useCallback((id: SuggestionFieldId) => {
		window.clearTimeout(intent.current);
		window.clearTimeout(closing.current);
		setState((latest) => (latest.pinned || latest.id === id ? latest : { id, pinned: false }));
	}, []);

	const blurSurface = useCallback(() => {
		setState((latest) => (latest.pinned ? latest : { id: null, pinned: false }));
	}, []);

	const togglePin = useCallback((id: SuggestionFieldId) => {
		window.clearTimeout(intent.current);
		window.clearTimeout(closing.current);
		setState((latest) => (latest.pinned && latest.id === id ? { id: null, pinned: false } : { id, pinned: true }));
	}, []);

	const retarget = useCallback((id: SuggestionFieldId | null) => {
		setState((latest) => (id == null ? { id: null, pinned: false } : { ...latest, id }));
	}, []);

	const close = useCallback(() => {
		window.clearTimeout(intent.current);
		window.clearTimeout(closing.current);
		setState({ id: null, pinned: false });
	}, []);

	return { ...state, hoverRow, leaveRow, enterSurface, leaveSurface, enterPane, focusRow, blurSurface, togglePin, retarget, close };
}
