"use client";

import { useEffectEvent, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import { Button } from "@/components/ui/button";
import { normalizeRelatedSummary } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { cn } from "@/lib/utils";

/** Keys that never re-enter editing from the settled state. */
const NON_EDITING_KEYS = new Set(["Enter", "Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

function placeCaretAtEnd(element: HTMLElement) {
	const selection = window.getSelection?.();
	if (!selection || typeof document.createRange !== "function") return;
	const range = document.createRange();
	range.selectNodeContents(element);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}

/**
 * Live, in-place summary editor (reference InlineEditableTextCell). The text stays in the row:
 * focus or pointerdown starts editing, Enter commits, Escape reverts (the row commits when focus leaves it).
 * After a commit or revert focus stays on the text in a settled state; typing a character edits again.
 * The DOM text is uncontrolled while editing so the caret never jumps; the draft is mirrored upward.
 * Save and Cancel live here so keyboard activation (and Escape on them) also returns focus to the text.
 */
export function RelatedSummaryField({ draft, editing, faded, itemKey, onDraftChange, onEdit, onFinish, summary }: Readonly<{
	draft: string;
	editing: boolean;
	/** Last visible row with more hidden below: mask the text unless focused. */
	faded: boolean;
	itemKey: string;
	onDraftChange: (draft: string) => void;
	onEdit: () => void;
	onFinish: (save: boolean) => void;
	summary: string;
}>) {
	const ref = useRef<HTMLSpanElement>(null);
	const wasEditing = useRef(false);
	/** Mirrors `settled` synchronously so refocusing after a commit does not re-enter editing. */
	const settledRef = useRef(false);
	const [settled, setSettled] = useState(false);
	const openingText = useEffectEvent(() => draft);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		// Write only when it changes something, and never under a focused, settled caret
		// (reference InlineEditableTextCell). Restoring a saved draft on entry is the one forced write.
		if (editing && !wasEditing.current) {
			const opening = openingText();
			if (element.textContent !== opening) element.textContent = opening;
		} else if (!editing && element.textContent !== summary && document.activeElement !== element) {
			element.textContent = summary;
		}
		wasEditing.current = editing;
	}, [editing, summary]);
	function settle(value: boolean) {
		settledRef.current = value;
		setSettled(value);
	}
	function begin() {
		settle(false);
		if (!editing) onEdit();
	}
	function finish(save: boolean) {
		const element = ref.current;
		settle(true);
		if (element) {
			const committed = normalizeRelatedSummary(element.textContent ?? "");
			const keep = save && committed !== "" && committed === element.textContent;
			if (!keep) element.textContent = save && committed ? committed : summary;
			element.scrollLeft = 0;
			if (document.activeElement !== element) element.focus();
			if (!keep) placeCaretAtEnd(element);
		}
		onFinish(save);
	}
	/** Escape on Save/Cancel cancels the edit instead of closing the work item dialog. */
	function cancelOnEscape(event: KeyboardEvent<HTMLElement>) {
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		finish(false);
	}
	function keyDown(event: KeyboardEvent<HTMLSpanElement>) {
		if (!editing) {
			const printable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
			if (printable && !NON_EDITING_KEYS.has(event.key)) begin();
			else if (event.key === "Enter" || event.key === " ") event.preventDefault();
			return;
		}
		if (event.key === "Enter" || event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			finish(event.key === "Enter");
		}
	}
	return (
		<>
			<span
				aria-label={`Edit summary for ${itemKey}`}
				aria-multiline="false"
				className={cn(
					"block min-w-0 flex-1 cursor-text truncate rounded-sm py-1 text-sm text-text outline-none focus:text-clip",
					settled && !editing && "caret-transparent",
					faded && !editing && "related-row-fade group-has-[:focus-visible]/work-row:mask-none group-has-[[aria-expanded=true]]/work-row:mask-none",
				)}
				contentEditable
				data-summary-settled={settled && !editing ? true : undefined}
				onBlur={(event) => {
					settle(false);
					// The settled text may keep the edit's horizontal scroll; show its start again.
					event.currentTarget.scrollLeft = 0;
				}}
				onFocus={() => { if (!settledRef.current) begin(); }}
				onInput={(event) => {
					// Input that skipped keydown (IME, autocorrect) still enters editing.
					if (!editing) begin();
					onDraftChange(event.currentTarget.textContent ?? "");
				}}
				onKeyDown={keyDown}
				onPaste={(event) => {
					event.preventDefault();
					const text = normalizeRelatedSummary(event.clipboardData.getData("text"));
					if (!text) return;
					if (!editing) begin();
					if (!document.execCommand?.("insertText", false, text)) {
						event.currentTarget.textContent = `${event.currentTarget.textContent ?? ""}${text}`;
						onDraftChange(event.currentTarget.textContent);
					}
				}}
				onPointerDown={() => begin()}
				ref={ref}
				role="textbox"
				spellCheck={false}
				suppressContentEditableWarning
				tabIndex={0}
			/>
			{editing ? (
				<div className="flex shrink-0 items-center gap-1">
					<Button aria-label={`Save summary for ${itemKey}`} onClick={() => finish(true)} onKeyDown={cancelOnEscape} onMouseDown={(event) => event.preventDefault()} size="icon-compact" type="button" variant="secondary"><CheckMarkIcon label="" size="small" /></Button>
					<Button aria-label={`Cancel summary for ${itemKey}`} onClick={() => finish(false)} onKeyDown={cancelOnEscape} onMouseDown={(event) => event.preventDefault()} size="icon-compact" type="button" variant="secondary"><CrossIcon label="" size="small" /></Button>
				</div>
			) : null}
		</>
	);
}
