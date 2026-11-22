"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import type { ProjectButterRelatedKind } from "@/components/blocks/jira-work-item/project-butter/related-model";

const SHORTCUTS: Readonly<Record<string, ProjectButterRelatedKind>> = { A: "attachments", C: "children", K: "linked" };

export function useRelatedAddShortcuts(enabled: boolean, scopeRef: RefObject<HTMLElement | null>, openRelatedAdd: (kind: ProjectButterRelatedKind) => void) {
	const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
		const kind = SHORTCUTS[event.key.toUpperCase()];
		if (!kind || !event.shiftKey || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target && (
			target.closest<HTMLElement>("[contenteditable]")?.isContentEditable ||
			target.closest("input, textarea, select, [role=combobox], [role=menu], [role=menuitem], [role=listbox], [role=option], [role=slider]")
		)) return;
		const scopeDialog = scopeRef.current?.closest('[role="dialog"]') ?? null;
		const targetDialog = target?.closest('[role="dialog"], [role="alertdialog"]') ?? null;
		if (targetDialog && targetDialog !== scopeDialog) return;
		event.preventDefault();
		openRelatedAdd(kind);
	});
	useEffect(() => {
		if (!enabled) return undefined;
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled]);
}
