"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { hasJiraSelectionToggleModifier } from "@/components/blocks/jira-kanban/selection-modifiers";
import type { JiraKanbanSelectionAnchor } from "@/components/blocks/jira-kanban/state";

const ACTIVATION = "[data-jira-issue-activation-control]";
const SELECTION = "[data-jira-issue-selection-control]";
const ISSUE = '[data-board-agent-session-drop-zone="issue"]';
const EDITOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]';
const POPUP = '[role="menu"], [role="dialog"], [role="listbox"], [data-slot="popover-content"], [aria-haspopup][aria-expanded="true"]';

export function visibleJiraIssueCards(root: HTMLElement | null): HTMLElement[] {
	return root ? [...root.querySelectorAll<HTMLElement>(ISSUE)].filter((node) =>
		!node.closest('[inert], [aria-hidden="true"], [data-collapsed="true"]') && node.getClientRects().length > 0) : [];
}

export interface JiraIssueSelectionKeyboardRange extends JiraKanbanSelectionAnchor {
	indexInColumn: number;
	fallbackAnchor: JiraKanbanSelectionAnchor;
}

function hasVisiblePopup(document: Document): boolean {
	return [...document.querySelectorAll<HTMLElement>(POPUP)].some((node) =>
		!node.closest('[inert], [aria-hidden="true"]')
		&& node.getClientRects().length > 0
		&& getComputedStyle(node).visibility !== "hidden");
}

/** Only this board's card controls/surfaces own navigation and selection keys. */
export function useJiraIssueSelectionKeyboard({
	rootRef, enabled = true, dragging, onCancelDrag, onClearSelection, onRangeSelect, onSelectAll,
}: Readonly<{
	rootRef: RefObject<HTMLDivElement | null>;
	enabled?: boolean;
	dragging: boolean;
	onCancelDrag: () => void;
	onClearSelection: () => void;
	onRangeSelect: (range: JiraIssueSelectionKeyboardRange) => void;
	onSelectAll: () => void;
}>) {
	const actions = useRef({ dragging, onCancelDrag, onClearSelection, onRangeSelect, onSelectAll });
	useLayoutEffect(() => {
		actions.current = { dragging, onCancelDrag, onClearSelection, onRangeSelect, onSelectAll };
	}, [dragging, onCancelDrag, onClearSelection, onRangeSelect, onSelectAll]);
	useEffect(() => {
		const root = rootRef.current;
		if (!enabled || !root) return;
		const document = root.ownerDocument;
		let scrollFrame = 0;
		const focusCard = (issue: HTMLElement, rangeSelection: boolean) => {
			issue.querySelector<HTMLButtonElement>(ACTIVATION)?.focus({ preventScroll: true, focusVisible: !rangeSelection });
			cancelAnimationFrame(scrollFrame);
			scrollFrame = requestAnimationFrame(() => issue.scrollIntoView({ block: "nearest", inline: "nearest" }));
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			const { dragging, onCancelDrag, onClearSelection, onRangeSelect, onSelectAll } = actions.current;
			if (event.defaultPrevented || event.isComposing || event.altKey) return;
			const target = event.target;
			if (!(target instanceof HTMLElement) || target.closest(EDITOR) || hasVisiblePopup(document)) return;
			if (event.key === "Escape" && !event.repeat && dragging) {
				// Leave the native Escape default intact so Chromium cancels its drag.
				event.stopPropagation();
				onCancelDrag();
				return;
			}
			if (!root.contains(target) || target.closest('[inert], [aria-hidden="true"]')) return;
			const cardControl = target.closest(`${ACTIVATION}, ${SELECTION}`);
			const boardSurface = target === root || target.matches('[data-jira-kanban-scrollport], [data-jira-kanban-card-list]');
			const toolbarControl = target.closest('[data-slot="jira-toolbar"]');
			if (!cardControl && !boardSurface && !toolbarControl) return;
			if (event.key === "Escape" && !event.repeat) {
				event.preventDefault();
				event.stopPropagation();
				onClearSelection();
				return;
			}
			if (event.key.toLowerCase() === "a" && hasJiraSelectionToggleModifier(event)) {
				event.preventDefault();
				if (!event.repeat) onSelectAll();
				return;
			}
			if (!cardControl || event.metaKey || event.ctrlKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
			const source = cardControl.closest<HTMLElement>(ISSUE);
			if (!source?.dataset.issueKey || !source.dataset.boardColumnTitle) return;
			const columnTitle = source.dataset.boardColumnTitle;
			const cards = visibleJiraIssueCards(root).filter((node) => node.dataset.boardColumnTitle === columnTitle);
			const index = cards.indexOf(source);
			if (index < 0) return;
			const next = cards[Math.max(0, Math.min(cards.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
			event.preventDefault();
			event.stopPropagation();
			if (event.shiftKey && next.dataset.issueKey) onRangeSelect({
				cardCode: next.dataset.issueKey, columnTitle,
				indexInColumn: Number(next.dataset.boardCardIndex),
				fallbackAnchor: { cardCode: source.dataset.issueKey, columnTitle },
			});
			focusCard(next, event.shiftKey);
		};
		const handleClick = (event: MouseEvent) => {
			if (!event.shiftKey && !hasJiraSelectionToggleModifier(event)) return;
			const target = event.target;
			if (!(target instanceof Element) || target.closest(`button, a, ${EDITOR}`)) return;
			const issue = target.closest<HTMLElement>(ISSUE);
			if (issue && root.contains(issue)) issue.querySelector<HTMLButtonElement>(ACTIVATION)?.focus({ preventScroll: true, focusVisible: false });
		};
		document.addEventListener("keydown", handleKeyDown, true);
		root.addEventListener("click", handleClick);
		return () => {
			cancelAnimationFrame(scrollFrame);
			document.removeEventListener("keydown", handleKeyDown, true);
			root.removeEventListener("click", handleClick);
		};
	}, [enabled, rootRef]);
}
