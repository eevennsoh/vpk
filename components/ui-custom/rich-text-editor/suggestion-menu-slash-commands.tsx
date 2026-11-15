import LinkIcon from "@atlaskit/icon/core/link";
import SnippetIcon from "@atlaskit/icon/core/snippet";
import AlignTextCenterIcon from "@atlaskit/icon/core/align-text-center";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import AlignTextRightIcon from "@atlaskit/icon/core/align-text-right";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import ListNumberedIcon from "@atlaskit/icon/core/list-numbered";
import QuotationMarkIcon from "@atlaskit/icon/core/quotation-mark";
import TextIcon from "@atlaskit/icon/core/text";
import TextBoldIcon from "@atlaskit/icon/core/text-bold";
import TextItalicIcon from "@atlaskit/icon/core/text-italic";
import TextStrikethroughIcon from "@atlaskit/icon/core/text-strikethrough";
import TextUnderlineIcon from "@atlaskit/icon/core/text-underline";
import TableIcon from "@atlaskit/icon/core/table";
import DividerElementIcon from "@atlaskit/icon-lab/core/divider-element";
import TerminalIcon from "@atlaskit/icon-lab/core/terminal";
import TextHeadingFiveIcon from "@atlaskit/icon-lab/core/text-heading-five";
import TextHeadingFourIcon from "@atlaskit/icon-lab/core/text-heading-four";
import TextHeadingOneIcon from "@atlaskit/icon-lab/core/text-heading-one";
import TextHeadingSixIcon from "@atlaskit/icon-lab/core/text-heading-six";
import TextHeadingThreeIcon from "@atlaskit/icon-lab/core/text-heading-three";
import TextHeadingTwoIcon from "@atlaskit/icon-lab/core/text-heading-two";

import { filterItems } from "./suggestion-menu-rows";
import type {
	RichTextCommandItem,
	RichTextSuggestionMenuItem,
} from "./suggestion-menu-types";

export const SLASH_COMMANDS: readonly RichTextCommandItem[] = [
	{
		id: "normal-text",
		label: "Normal text",
		description: "Use the default paragraph style for body copy.",
		shortcut: "Text",
		icon: <TextIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().setParagraph().run(),
	},
	{
		id: "heading-1",
		label: "Heading 1",
		description: "Create the largest section heading.",
		shortcut: "#",
		icon: <TextHeadingOneIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
	},
	{
		id: "heading-2",
		label: "Heading 2",
		description: "Create a major subsection heading.",
		shortcut: "##",
		icon: <TextHeadingTwoIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
	},
	{
		id: "heading-3",
		label: "Heading 3",
		description: "Create a smaller nested heading.",
		shortcut: "###",
		icon: <TextHeadingThreeIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
	},
	{
		id: "heading-4",
		label: "Heading 4",
		description: "Create a compact fourth-level heading.",
		shortcut: "####",
		icon: <TextHeadingFourIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run(),
	},
	{
		id: "heading-5",
		label: "Heading 5",
		description: "Create a small fifth-level heading.",
		shortcut: "#####",
		icon: <TextHeadingFiveIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleHeading({ level: 5 }).run(),
	},
	{
		id: "heading-6",
		label: "Heading 6",
		description: "Create the smallest heading style.",
		shortcut: "######",
		icon: <TextHeadingSixIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleHeading({ level: 6 }).run(),
	},
	{
		id: "quote",
		label: "Quote",
		description: "Set the current block as a quoted passage.",
		icon: <QuotationMarkIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleBlockquote().run(),
	},
	{
		id: "bold",
		label: "Bold",
		description: "Emphasize selected text with bold weight.",
		icon: <TextBoldIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleBold().run(),
	},
	{
		id: "italic",
		label: "Italic",
		description: "Emphasize selected text with italic styling.",
		icon: <TextItalicIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleItalic().run(),
	},
	{
		id: "underline",
		label: "Underline",
		description: "Add underline styling to selected text.",
		icon: <TextUnderlineIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleUnderline().run(),
	},
	{
		id: "strikethrough",
		label: "Strikethrough",
		description: "Mark selected text as removed or outdated.",
		icon: <TextStrikethroughIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleStrike().run(),
	},
	{
		id: "inline-code",
		label: "Inline code",
		description: "Render the selection in monospace (`code`).",
		shortcut: "`",
		icon: <SnippetIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleCode().run(),
	},
	{
		id: "code-block",
		label: "Code block",
		description: "Fenced code block with monospace text.",
		shortcut: "```",
		icon: <TerminalIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
	},
	{
		id: "bulleted-list",
		label: "Bulleted list",
		description: "Turn the current block into an unordered list.",
		shortcut: "-",
		icon: <ListBulletedIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleBulletList().run(),
	},
	{
		id: "numbered-list",
		label: "Numbered list",
		description: "Turn the current block into an ordered list.",
		shortcut: "1.",
		icon: <ListNumberedIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleOrderedList().run(),
	},
	{
		id: "task-list",
		label: "Task list",
		description: "Track items with checkable boxes (GFM).",
		shortcut: "- [ ]",
		icon: <ListChecklistIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().toggleTaskList().run(),
	},
	{
		id: "table",
		label: "Table",
		description: "Insert a 3×3 table with a header row (GFM).",
		icon: <TableIcon label="" size="small" />,
		run: (editor) =>
			editor
				.chain()
				.focus()
				.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
				.run(),
	},
	{
		id: "align-left",
		label: "Align left",
		description: "Align the current block to the left edge.",
		icon: <AlignTextLeftIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().setTextAlign("left").run(),
	},
	{
		id: "align-center",
		label: "Align center",
		description: "Center-align the current block.",
		icon: <AlignTextCenterIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().setTextAlign("center").run(),
	},
	{
		id: "align-right",
		label: "Align right",
		description: "Align the current block to the right edge.",
		icon: <AlignTextRightIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().setTextAlign("right").run(),
	},
	{
		id: "link",
		label: "Link",
		description: "Attach a URL to the selected text.",
		icon: <LinkIcon label="" size="small" />,
		run: (editor) => {
			const url = window.prompt("Enter URL");
			if (url) {
				editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
			}
		},
	},
	{
		id: "horizontal-rule",
		label: "Horizontal rule",
		description: "Insert a thematic break (`---`).",
		shortcut: "---",
		icon: <DividerElementIcon label="" size="small" />,
		run: (editor) => editor.chain().focus().setHorizontalRule().run(),
	},
];

export function getSlashCommandFormatItems(
	query = "",
): readonly RichTextSuggestionMenuItem[] {
	return filterItems(
		SLASH_COMMANDS.map((command) => ({
			description: command.description,
			icon: command.icon,
			id: command.id,
			label: command.label,
			shortcut: command.shortcut,
		})),
		query,
	);
}
