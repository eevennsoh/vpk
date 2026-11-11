"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import type { JiraListProps, JiraListRowData } from "@/components/blocks/jira-list/jira-list-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SummaryDraft = { caretOffset: number; issueKey: string; left: number; value: string; width: number };

function summaryCaretOffset(trigger: HTMLElement, event: ReactMouseEvent<HTMLButtonElement>, length: number) {
	if (event.detail === 0) return length;
	const caretDocument = document as Document & {
		caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
		caretRangeFromPoint?: (x: number, y: number) => Range | null;
	};
	const caret = caretDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
	const fallback = caret ? null : caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
	const node = caret?.offsetNode ?? fallback?.startContainer;
	const offset = caret?.offset ?? fallback?.startOffset;
	if (!node || offset === undefined || !trigger.contains(node)) return length;
	const range = document.createRange();
	range.selectNodeContents(trigger);
	range.setEnd(node, offset);
	return Math.min(length, Math.max(0, range.toString().length));
}

export function useJiraListSummaryEdit(onSummaryChange: JiraListProps["onSummaryChange"]) {
	const listRef = useRef<HTMLElement | null>(null);
	const editorRef = useRef<HTMLDivElement | null>(null);
	const pendingClick = useRef<((event: MouseEvent) => void) | null>(null);
	const pendingTimer = useRef<number | null>(null);
	const [draft, setDraft] = useState<SummaryDraft | null>(null);
	const begin = useCallback((row: JiraListRowData, event: ReactMouseEvent<HTMLButtonElement>) => {
		const trigger = event.currentTarget;
		const cell = trigger.closest<HTMLTableCellElement>("td");
		const tableRow = trigger.closest<HTMLTableRowElement>("tr");
		const summaryTrigger = cell?.querySelector<HTMLButtonElement>("[data-summary-trigger]");
		if (!cell || !tableRow || !summaryTrigger) return;
		const cellBounds = cell.getBoundingClientRect();
		const summaryBounds = summaryTrigger.getBoundingClientRect();
		const rowBounds = tableRow.getBoundingClientRect();
		setDraft({
			caretOffset: trigger === summaryTrigger ? summaryCaretOffset(trigger, event, row.summary.length) : row.summary.length,
			issueKey: row.issueKey,
			left: summaryBounds.left - cellBounds.left,
			value: row.summary,
			width: Math.max(rowBounds.right - summaryBounds.left - 8, 0),
		});
	}, []);
	const finish = useCallback((save: boolean, editedValue?: string) => {
		if (!draft) return;
		const value = (editedValue ?? draft.value).trim();
		if (save && value) onSummaryChange?.(draft.issueKey, value);
		const issueKey = draft.issueKey;
		setDraft(null);
		requestAnimationFrame(() => {
			const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-summary-trigger]");
			Array.from(buttons ?? []).find((button) => button.dataset.summaryTrigger === issueKey)?.focus({ preventScroll: true });
		});
	}, [draft, onSummaryChange]);

	useEffect(() => {
		if (!draft) return;
		const cancelOutside = (event: PointerEvent) => {
			if (event.target instanceof Node && editorRef.current?.closest("tr")?.contains(event.target)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			const suppressClick = (click: MouseEvent) => {
				click.preventDefault();
				click.stopImmediatePropagation();
				pendingClick.current = null;
			};
			pendingClick.current = suppressClick;
			document.addEventListener("click", suppressClick, { capture: true, once: true });
			pendingTimer.current = window.setTimeout(() => {
				document.removeEventListener("click", suppressClick, true);
				pendingClick.current = null;
			}, 750);
			finish(false);
		};
		document.addEventListener("pointerdown", cancelOutside, true);
		return () => document.removeEventListener("pointerdown", cancelOutside, true);
	}, [draft, finish]);
	useEffect(() => () => {
		if (pendingClick.current) document.removeEventListener("click", pendingClick.current, true);
		if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
	}, []);

	return { begin, draft, editorRef, finish, listRef };
}

export function JiraListSummaryEditor({ draft, editorRef, finish }: Readonly<{
	draft: SummaryDraft;
	editorRef: React.RefObject<HTMLDivElement | null>;
	finish: (save: boolean, editedValue?: string) => void;
}>) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [value, setValue] = useState(draft.value);
	useLayoutEffect(() => {
		const input = inputRef.current;
		input?.focus({ preventScroll: true });
		input?.setSelectionRange(draft.caretOffset, draft.caretOffset);
		if (input) input.scrollLeft = 0;
	}, [draft.caretOffset]);
	return (
		<div
			ref={editorRef}
			data-slot="jira-list-summary-editor"
			className="absolute top-1/2 z-40 flex h-6 min-w-0 -translate-y-1/2 items-center gap-2 overflow-visible"
			style={{ left: draft.left, width: draft.width }}
		>
			<Input
				aria-label={`Summary for ${draft.issueKey}`}
				ref={inputRef}
				variant="none"
				className="h-6 min-w-0 flex-1 rounded-none px-0 py-0 text-sm font-normal leading-5 text-text focus-visible:ring-0"
				value={value}
				onChange={(event) => setValue(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.nativeEvent.isComposing) {
						event.preventDefault();
						event.stopPropagation();
						finish(true, value);
					}
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						finish(false);
					}
				}}
			/>
			<div data-slot="jira-list-summary-actions" className="sticky right-3 flex shrink-0 gap-1">
				<Button aria-label="Save summary" onClick={() => finish(true, value)} size="icon-compact" variant="outline"><CheckMarkIcon label="" size="small" /></Button>
				<Button aria-label="Cancel summary edit" onClick={() => finish(false)} size="icon-compact" variant="outline"><CrossIcon label="" size="small" /></Button>
			</div>
		</div>
	);
}
