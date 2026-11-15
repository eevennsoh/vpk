"use client";

import {
	getMentionChildItems,
	RichTextSuggestionMenu,
	type RichTextMentionItem,
	type RichTextMentionSources,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor/menus";
import { cn } from "@/lib/utils";

import { EDITOR_PALETTE_MENTION_SOURCES } from "../data/mention-sources";
import { FLAT_MENTION_SECTIONS, getFlatSectionRows } from "../lib/flat-sections";

// A people-and-agents picker built from the editor palette's flat sections. It imports the menu
// entry, not the rich-text-editor package entry, so the routes that render it (the Jira list
// footer) do not load the Tiptap runtime.

export interface EditorPaletteAssigneePickerProps {
	className?: string;
	mentionSources?: RichTextMentionSources;
	onSelect: (item: RichTextMentionItem) => void;
}

export function EditorPaletteAssigneePicker({
	className,
	mentionSources = EDITOR_PALETTE_MENTION_SOURCES,
	onSelect,
}: Readonly<EditorPaletteAssigneePickerProps>) {
	const items = FLAT_MENTION_SECTIONS.flatMap((section) =>
		getFlatSectionRows(
			section,
			getMentionChildItems(mentionSources, section.category),
			false,
			section.title,
		),
	);

	const handleSelect = (item: RichTextSuggestionMenuItem) => {
		const mention = [
			...(mentionSources.human ?? []),
			...(mentionSources.team ?? []),
			...(mentionSources.subagent ?? []),
		].find((candidate) => candidate.id === item.id);
		if (mention) {
			onSelect(mention);
		}
	};

	return (
		<RichTextSuggestionMenu
			className={cn(
				"rich-text-command-menu-borderless max-h-80 w-72",
				className,
			)}
			emptyLabel="No people or agents found"
			items={items}
			onSelect={handleSelect}
			selectedIndex={-1}
			title="Assign work item"
		/>
	);
}
