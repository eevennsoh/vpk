"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

/** How long a just-filled row glows. */
const FLASH_MS = 900;
/** How long a just-decided row keeps its Undo visible without hover. */
const UNDO_WINDOW_MS = 5000;

export interface RecentDecisions {
	/** Rows that just received a decision and should glow. */
	flashing: ReadonlySet<SuggestionFieldId>;
	/** Rows whose inline Undo stays visible for a short window. */
	undoable: ReadonlySet<SuggestionFieldId>;
	mark: (ids: readonly SuggestionFieldId[]) => void;
	clear: (ids: readonly SuggestionFieldId[]) => void;
}

function without(set: ReadonlySet<SuggestionFieldId>, ids: readonly SuggestionFieldId[]) {
	const next = new Set(set);
	for (const id of ids) next.delete(id);
	return next;
}

/** Short-lived, per-row confirmation windows. Timers are cleared on unmount and when a row is undone. */
export function useRecentDecisions(): RecentDecisions {
	const [flashing, setFlashing] = useState<ReadonlySet<SuggestionFieldId>>(() => new Set());
	const [undoable, setUndoable] = useState<ReadonlySet<SuggestionFieldId>>(() => new Set());
	const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

	const schedule = useCallback((key: string, ms: number, run: () => void) => {
		const existing = timers.current.get(key);
		if (existing) clearTimeout(existing);
		timers.current.set(key, setTimeout(() => {
			timers.current.delete(key);
			run();
		}, ms));
	}, []);

	const mark = useCallback((ids: readonly SuggestionFieldId[]) => {
		if (ids.length === 0) return;
		setFlashing((current) => new Set([...current, ...ids]));
		setUndoable((current) => new Set([...current, ...ids]));
		for (const id of ids) {
			schedule(`flash:${id}`, FLASH_MS, () => setFlashing((current) => without(current, [id])));
			schedule(`undo:${id}`, UNDO_WINDOW_MS, () => setUndoable((current) => without(current, [id])));
		}
	}, [schedule]);

	const clear = useCallback((ids: readonly SuggestionFieldId[]) => {
		for (const id of ids) {
			for (const key of [`flash:${id}`, `undo:${id}`]) {
				const timer = timers.current.get(key);
				if (timer) clearTimeout(timer);
				timers.current.delete(key);
			}
		}
		setFlashing((current) => without(current, ids));
		setUndoable((current) => without(current, ids));
	}, []);

	useEffect(() => {
		const pending = timers.current;
		return () => {
			for (const timer of pending.values()) clearTimeout(timer);
			pending.clear();
		};
	}, []);

	return { flashing, undoable, mark, clear };
}
