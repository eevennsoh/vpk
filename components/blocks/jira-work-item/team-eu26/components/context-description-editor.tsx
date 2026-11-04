"use client";

import type { ReactNode } from "react";

import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import type { EditorToolbarViewMode } from "@/components/blocks/editor-toolbar";
import { RichTextEditor } from "@/components/ui-custom/rich-text-editor";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { cn } from "@/lib/utils";

const DEFAULT_PLACEHOLDER_SLOT = (
	<p className="tiptap-editor text-sm leading-[1.55] text-text-subtlest">
		Press <code>/</code> to help improve the work item
	</p>
);

/**
 * Shared TipTap description surface for work item and pull request overview.
 *
 * Keeps editor chrome, typography, slash/mention sources, and transparent fill
 * identical across both use cases — only value, aria label, and change handler
 * differ at the call site.
 */
export function ContextDescriptionEditor({
	"aria-label": ariaLabel,
	hugContent = false,
	placeholder = "Press / to help improve the work item",
	placeholderSlot = DEFAULT_PLACEHOLDER_SLOT,
	trailingNode = true,
	value,
	viewMode,
	onMarkdownChange,
	onViewModeChange,
}: Readonly<{
	"aria-label": string;
	hugContent?: boolean;
	placeholder?: string;
	placeholderSlot?: ReactNode;
	trailingNode?: boolean;
	value: string;
	viewMode?: EditorToolbarViewMode;
	onMarkdownChange: (value: string) => void;
	onViewModeChange?: (mode: EditorToolbarViewMode) => void;
}>) {
	return (
		<RichTextEditor
			aria-label={ariaLabel}
			className="min-w-0 space-y-0"
			editorClassName={cn(
				"agent-instructions-tiptap-editor context-description-tiptap-editor text-text",
				!trailingNode && "context-description-tiptap-no-trailing-node",
				hugContent && "context-description-tiptap-editor-hug",
			)}
			enableDirectoryAutocomplete
			mentionSources={EDITOR_PALETTE_MENTION_SOURCES}
			placeholder={placeholder}
			placeholderSlot={placeholderSlot}
			showToolbar={false}
			trailingNode={trailingNode}
			suggestionVariant="nested"
			value={value}
			viewMode={viewMode}
			onMarkdownChange={onMarkdownChange}
			onViewModeChange={onViewModeChange}
		/>
	);
}
