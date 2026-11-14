"use client";

import type { TaskItemOptions } from "@tiptap/extension-list";
import {
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
} from "@tiptap/react";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * TipTap TaskItem NodeView — replaces the extension's native
 * `<input type="checkbox">` with VPK/shadcn Checkbox so GFM task lists
 * (e.g. PR description Test plan) match the rest of the product.
 */
export function RichTextTaskItemNodeView({
	node,
	editor,
	extension,
	updateAttributes,
}: Readonly<ReactNodeViewProps>) {
	const checked = Boolean(node.attrs.checked);
	const options = extension.options as TaskItemOptions;
	const canToggleWhenReadOnly = typeof options.onReadOnlyChecked === "function";
	const ariaLabel =
		options.a11y?.checkboxLabel?.(node, checked) ??
		`Task item checkbox for ${node.textContent || "empty task item"}`;

	const handleCheckedChange = (nextChecked: boolean) => {
		if (!editor.isEditable) {
			// Match TipTap TaskItem: never write attrs when read-only; optional
			// callback lets the host react without mutating the document.
			options.onReadOnlyChecked?.(node, nextChecked);
			return;
		}
		updateAttributes({ checked: nextChecked });
	};

	return (
		<NodeViewWrapper
			as="li"
			className="rich-text-task-item"
			data-checked={checked ? "true" : "false"}
			data-type="taskItem"
		>
			<span className="rich-text-task-item-checkbox" contentEditable={false}>
				<Checkbox
					aria-label={ariaLabel}
					checked={checked}
					disabled={!editor.isEditable && !canToggleWhenReadOnly}
					onCheckedChange={handleCheckedChange}
					onMouseDown={(event) => {
						// Preserve editor selection while toggling (TipTap TaskItem default).
						event.preventDefault();
					}}
				/>
			</span>
			<NodeViewContent as="div" />
		</NodeViewWrapper>
	);
}
