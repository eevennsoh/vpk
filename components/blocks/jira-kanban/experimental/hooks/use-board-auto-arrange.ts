"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import type { JiraKanbanColumnData } from "../../index";
import { getAutoArrangePlan } from "../lib/board-auto-arrange";

const EMPTY_CODES = new Set<string>();

export function useBoardAutoArrange({ columns, selected, dragged, onArrange, beforeArrange, boardRef }: Readonly<{
	columns: readonly JiraKanbanColumnData[];
	selected: ReadonlySet<string> | undefined;
	dragged: string | null;
	onArrange?: (codes: ReadonlySet<string>) => void;
	beforeArrange: () => void;
	boardRef: RefObject<HTMLElement | null>;
}>) {
	const codes = useMemo(() => dragged && !selected?.has(dragged) ? new Set([dragged]) : selected ?? EMPTY_CODES, [dragged, selected]);
	const plan = onArrange ? getAutoArrangePlan(columns, codes) : [];
	const key = onArrange && codes.size ? [...codes].sort().join("|") : "";
	const [readyKey, setReadyKey] = useState("");
	const ready = Boolean(key && readyKey === key);
	useEffect(() => {
		if (!key) { setReadyKey(""); return; }
		const timer = setTimeout(() => setReadyKey(key), 1000);
		return () => clearTimeout(timer);
	}, [key]);
	const arrange = useCallback(() => {
		if (!ready) return;
		onArrange?.(codes);
		// Freeze the traveller for the shared drop flight before ending pickup.
		beforeArrange();
	}, [beforeArrange, codes, onArrange, ready]);
	useEffect(() => {
		if (!ready || !onArrange) return;
		const keydown = (event: KeyboardEvent) => {
			if (event.key !== "Enter" || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="menuitem"], [role="combobox"], [role="dialog"]')) return;
			if (!(event.target instanceof Node) || !boardRef.current?.contains(event.target)) return;
			event.preventDefault();
			arrange();
		};
		window.addEventListener("keydown", keydown);
		return () => window.removeEventListener("keydown", keydown);
	}, [arrange, boardRef, onArrange, ready]);
	return { codes, key, ready, arrange, incoming: (title: string) => ready ? plan.filter((move) => move.columnTitle === title).length : undefined };
}
