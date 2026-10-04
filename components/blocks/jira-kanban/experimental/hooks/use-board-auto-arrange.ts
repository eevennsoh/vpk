"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLatestRef } from "@/lib/use-latest-ref";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";
import { getAutoArrangePlan } from "../lib/board-auto-arrange";

const EMPTY_CODES = new Set<string>();
const EMPTY_PREPARATION = { key: "", counts: new Map<string, number>() };

export function useBoardAutoArrange({ columns, selected, dragged, onArrange, beforeArrange, scopeId }: Readonly<{
	columns: readonly JiraKanbanColumnData[];
	selected: ReadonlySet<string> | undefined;
	dragged: string | null;
	onArrange?: (codes: ReadonlySet<string>) => void;
	beforeArrange: () => void;
	scopeId: string;
}>) {
	const codes = useMemo(() => dragged && !selected?.has(dragged) ? new Set([dragged]) : selected ?? EMPTY_CODES, [dragged, selected]);
	const plan = onArrange ? getAutoArrangePlan(columns, codes) : [];
	const available = plan.length > 0;
	const key = onArrange && codes.size && available ? [...codes].sort().join("|") : "";
	const [prepared, setPrepared] = useState(EMPTY_PREPARATION);
	const ready = Boolean(key && prepared.key === key);
	const latestPlan = useLatestRef({ key, plan });
	useEffect(() => {
		if (!key) { setPrepared(EMPTY_PREPARATION); return; }
		const timer = setTimeout(() => {
			const current = latestPlan.current;
			if (current.key !== key) return;
			const counts = new Map<string, number>();
			for (const move of current.plan) counts.set(move.columnTitle, (counts.get(move.columnTitle) ?? 0) + 1);
			setPrepared({ key, counts });
		}, 1000);
		return () => clearTimeout(timer);
	}, [key, latestPlan]);
	const arrange = useCallback(() => {
		if (!ready) return;
		onArrange?.(codes);
		// Freeze the traveller for the shared drop flight before ending pickup.
		beforeArrange();
	}, [beforeArrange, codes, onArrange, ready]);
	useEffect(() => {
		if (!ready || !onArrange) return;
		const keydown = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== "a" || event.metaKey || event.ctrlKey || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.shiftKey) return;
			if (!(event.target instanceof Element) || event.target.closest("[data-jira-auto-arrange-scope]")?.getAttribute("data-jira-auto-arrange-scope") !== scopeId) return;
			if (event.target.closest('a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], [role="menuitem"], [role="listbox"], [role="combobox"], [role="dialog"]')) return;
			// The board shortcut also works while Select all retains toolbar focus.
			const cardControl = event.target.closest('[data-jira-issue-activation-control], [data-jira-issue-selection-control]');
			const toolbarControl = event.target.closest('[data-slot="jira-toolbar"]');
			if (!cardControl && !toolbarControl && event.target.closest('button, [role="button"]')) return;
			event.preventDefault();
			arrange();
		};
		window.addEventListener("keydown", keydown);
		return () => window.removeEventListener("keydown", keydown);
	}, [arrange, onArrange, ready, scopeId]);
	return { codes, key, ready, available, arrange, incoming: (title: string) => {
		if (!key) return undefined;
		const count = plan.filter((move) => move.columnTitle === title).length;
		return ready ? count : count > 0 ? prepared.counts.get(title) : undefined;
	} };
}
