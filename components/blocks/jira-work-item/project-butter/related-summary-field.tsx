"use client";

import { useEffectEvent, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { normalizeRelatedSummary } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { cn } from "@/lib/utils";

/** Keys that never re-enter editing from the settled state. */
const NON_EDITING_KEYS = new Set(["Enter", "Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

/**
 * Live, in-place summary editor (reference InlineEditableTextCell). The text stays in the row:
 * focus or pointerdown starts editing, Enter commits, Escape reverts (the row commits when focus leaves it).
 * After a commit or revert focus stays on the text in a settled state; typing a character edits again.
 * The DOM text is uncontrolled while editing so the caret never jumps; the draft is mirrored upward.
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
	const [settled, setSettled] = useState(false);
	const openingText = useEffectEvent(() => draft);
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		if (!editing) element.textContent = summary;
		else if (!wasEditing.current) element.textContent = openingText();
		wasEditing.current = editing;
	}, [editing, summary]);
	function begin() {
		setSettled(false);
		if (!editing) onEdit();
	}
	function finish(save: boolean) {
		setSettled(true);
		onFinish(save);
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
			onBlur={() => setSettled(false)}
			onFocus={() => { if (!settled) begin(); }}
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
	);
}
