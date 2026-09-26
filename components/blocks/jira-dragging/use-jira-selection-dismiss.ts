"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

const COLUMN = "[data-jira-kanban-column]";
const TOOLBAR = '[data-slot="jira-toolbar-positioner"]';
const POPUP = '[role="menu"], [role="dialog"], [role="listbox"], [data-slot="popover-content"]';

/** Portals belong to their trigger, even when their DOM is outside the board. */
function preservesSelection(
	target: Element,
	root: HTMLElement,
	selectedColumns: ReadonlySet<string>,
	visited = new Set<Element>(),
): boolean {
	if (root.contains(target)) {
		if (target.closest(TOOLBAR)) return true;
		const column = target.closest<HTMLElement>(COLUMN);
		if (column && selectedColumns.has(column.dataset.jiraKanbanColumn ?? "")) return true;
	}
	const popup = target.closest(POPUP);
	if (!popup || visited.has(popup)) return false;
	visited.add(popup);
	const document = root.ownerDocument;
	const labelledBy = (popup.getAttribute("aria-labelledby") ?? "").split(/\s+/);
	const owners = labelledBy.flatMap((id) => {
		const owner = document.getElementById(id);
		return owner ? [owner] : [];
	});
	if (popup.id) {
		for (const trigger of document.querySelectorAll<HTMLElement>("[aria-controls], [aria-owns]")) {
			const controls = `${trigger.getAttribute("aria-controls") ?? ""} ${trigger.getAttribute("aria-owns") ?? ""}`.split(/\s+/);
			if (controls.includes(popup.id)) owners.push(trigger);
		}
	}
	return owners.some((owner) => preservesSelection(owner, root, selectedColumns, visited));
}

/** An ordinary outside press dismisses this board's selection, never its actions. */
export function useJiraSelectionDismiss({
	rootRef, boardColumns, selectedCardCodes, dragging, onClearSelection,
}: Readonly<{
	rootRef: RefObject<HTMLDivElement | null>;
	boardColumns: readonly JiraKanbanColumnData[];
	selectedCardCodes: ReadonlySet<string>;
	dragging: boolean;
	onClearSelection: () => void;
}>) {
	const active = selectedCardCodes.size > 0 && !dragging;
	const handleOutsidePress = useEffectEvent((event: PointerEvent) => {
		if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || dragging || selectedCardCodes.size === 0) return;
		const root = rootRef.current;
		const target = event.target;
		if (!root || !(target instanceof Element) || !root.isConnected || root.getClientRects().length === 0
			|| root.closest('[inert], [aria-hidden="true"]')) return;
		const selectedColumns = new Set(boardColumns.filter((column) =>
			column.cards.some((card) => selectedCardCodes.has(card.code))).map((column) => column.title));
		if (!preservesSelection(target, root, selectedColumns)) onClearSelection();
	});
	useEffect(() => {
		const root = rootRef.current;
		if (!active || !root) return;
		const document = root.ownerDocument;
		const onPointerDown = (event: PointerEvent) => handleOutsidePress(event);
		// Capture runs before a portalled action closes its popup and loses ownership.
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => document.removeEventListener("pointerdown", onPointerDown, true);
	}, [active, rootRef]);
}
