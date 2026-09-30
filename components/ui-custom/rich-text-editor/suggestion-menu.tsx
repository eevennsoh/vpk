"use client";

// oxlint-disable react-doctor/only-export-components -- This module intentionally exports colocated component API, variant contracts, context contracts, or metadata used by consumers.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import {
	Fragment,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type FocusEvent,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import { ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";
import { motion, useReducedMotion, type Variants } from "motion/react";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";
import LinkIcon from "@atlaskit/icon/core/link";
import PersonIcon from "@atlaskit/icon/core/person";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import SnippetIcon from "@atlaskit/icon/core/snippet";
import TeamsIcon from "@atlaskit/icon/core/teams";
import AlignTextCenterIcon from "@atlaskit/icon/core/align-text-center";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import AlignTextRightIcon from "@atlaskit/icon/core/align-text-right";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import ListNumberedIcon from "@atlaskit/icon/core/list-numbered";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
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

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { IconTile, type IconTileVariant } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { RovoColorIcon } from "@/components/ui/logo";
import { ArrowLeftIcon, ReturnIcon } from "@/components/ui/vpk-icons";
import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { cn } from "@/lib/utils";

import { RichTextMentionVisualMark } from "./mention-visual";
import { useCommandMenuScrollMask } from "./command-menu-scroll-mask";
import {
	RICH_TEXT_REFERENCE_CATEGORY_OPTIONS,
	getRichTextReferenceCategoryIcon,
	getRichTextReferenceCategoryLabel,
	isRichTextReferenceCategory,
} from "./reference-categories";
import {
	getPreferredSuggestionIndex,
	getSuggestionMatchRank,
	rankSuggestionsByMatch,
} from "./suggestion-ranking";
import "./suggestion-menu-actions.css";
import type {
	RichTextCommandCategory,
	RichTextMentionCategory,
	RichTextMentionItem,
	RichTextMentionSectionLabels,
	RichTextMentionSources,
	RichTextMentionVisual,
	RichTextSlashCategory,
} from "./types";
import { motionEase } from "@/lib/motion";

export interface RichTextCommandItem {
	id: string;
	label: string;
	description?: string;
	shortcut?: string;
	icon: ReactNode;
	run: (editor: Editor) => void;
}

export interface RichTextSuggestionMenuHoverActions {
	onPrimary: () => void;
	onSecondary: () => void;
	primaryLabel: string;
	secondaryIcon: ReactNode;
	secondaryLabel: string;
}

export interface RichTextSuggestionMenuItem {
	id: string;
	label: string;
	description?: string;
	/**
	 * Optional supplementary content revealed as a second-line byline on
	 * hover/selection. Use this for compact, dynamic metadata such as a running
	 * tool-call narration — the row stays a single identity line at rest.
	 */
	inlineMetadata?: ReactNode;
	/** Hover/focus-revealed sibling buttons; keeps the option button unnested. */
	hoverActions?: RichTextSuggestionMenuHoverActions;
	shortcut?: string;
	icon: ReactNode;
	/**
	 * IconTile treatment for the fallback (icon-only) leading slot. Overflow
	 * footers ("Browse all" / "View more" / "View less") use `"transparent"` so
	 * the glyph sits on the menu surface without a grey rounded-square tile.
	 */
	iconTileVariant?: IconTileVariant;
	/** Optional fully rendered leading visual for domain-specific identity frames. */
	leadingVisual?: ReactNode;
	isSticky?: boolean;
	stickyPosition?: "top" | "bottom";
	visual?: RichTextMentionVisual;
	disabled?: boolean;
	/**
	 * When set, the entry renders as a non-interactive section heading (matching
	 * the dropdown menu's `DropdownMenuLabel`) instead of a selectable option.
	 * Used by the flat editor palette to merge several "/" categories into one
	 * list with a labeled group per category.
	 */
	headingLabel?: string;
	/**
	 * When true, the description stays visible at all times instead of revealing
	 * on hover/selection. Used by nested parent rows whose byline is a count
	 * (e.g. "13 available") that should always be readable.
	 */
	persistentDescription?: boolean;
	/**
	 * Optional trailing indicator rendered on the far right of the row (e.g. a
	 * status spinner or info glyph). Shown at rest; it yields the slot to the
	 * return-key hint on the active row, and to `hoverActions` when that row is
	 * hovered or keyboard-focused.
	 */
	trailing?: ReactNode;
	/**
	 * When true, a full-bleed rule is drawn immediately above this row — the
	 * popup footer treatment used to split a trailing action (e.g. "Add agent")
	 * from the rows above it. The rule is decorative (`aria-hidden`, no `role`)
	 * so it stays out of the listbox, and it never consumes a selectable index.
	 */
	separatorBefore?: boolean;
}

/** Synthetic overflow rows that cap a flat / search / sparkle section. */
export type SuggestionOverflowFooterKind = "browse-all" | "view-more" | "view-less";

const OVERFLOW_FOOTER_LABELS = {
	"browse-all": "Browse all",
	"view-more": "View more",
	"view-less": "View less",
} as const;

function getOverflowFooterIcon(kind: SuggestionOverflowFooterKind): ReactNode {
	switch (kind) {
		case "browse-all":
			return <ShowMoreHorizontalIcon label="" size="small" />;
		case "view-more":
			return <ChevronDownIcon label="" size="small" />;
		case "view-less":
			return <ChevronUpIcon label="" size="small" />;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/**
 * Shared "Browse all" / "View more" / "View less" row. Always uses the
 * transparent IconTile so overflow glyphs never pick up the grey fallback tile.
 */
export function getSuggestionOverflowFooterItem(
	id: string,
	kind: SuggestionOverflowFooterKind,
	options?: Readonly<{ isSticky?: boolean }>,
): RichTextSuggestionMenuItem {
	return {
		id,
		label: OVERFLOW_FOOTER_LABELS[kind],
		icon: getOverflowFooterIcon(kind),
		iconTileVariant: "transparent",
		isSticky: options?.isSticky,
	};
}

function isOverflowFooterLabel(label: string): boolean {
	return (
		label === OVERFLOW_FOOTER_LABELS["browse-all"]
		|| label === OVERFLOW_FOOTER_LABELS["view-more"]
		|| label === OVERFLOW_FOOTER_LABELS["view-less"]
	);
}

function getSuggestionMenuIconTileVariant(
	item: RichTextSuggestionMenuItem,
): IconTileVariant {
	if (item.iconTileVariant) {
		return item.iconTileVariant;
	}

	return isOverflowFooterLabel(item.label) ? "transparent" : "gray";
}

interface RichTextSuggestionMenuProps {
	className?: string;
	emptyLabel: string;
	emptyState?: ReactNode;
	header?: ReactNode;
	items: readonly RichTextSuggestionMenuItem[];
	onBack?: () => void;
	/**
	 * Pointer hover handler. Receives the hovered row's index into `items` so the
	 * controller can move `selectedIndex` onto it — keeping mouse hover and
	 * keyboard navigation on a single source of truth (Enter always commits the
	 * row under the pointer).
	 */
	onHover?: (index: number) => void;
	/** Pointer left a hover-tracked row. Used to idle selection after hover-out. */
	onHoverEnd?: () => void;
	onSelect: (item: RichTextSuggestionMenuItem) => void;
	selectedIndex: number;
	selectedItemIds?: ReadonlySet<string>;
	/**
	 * When false, hide the Return (↵) shortcut glyph and its reserved gutter.
	 * Used by the agents-field session submenu, which is mouse-first.
	 * Defaults to true so editor palettes keep the keyboard hint.
	 */
	showReturnShortcut?: boolean;
	title: string;
}

interface SuggestionPopupState {
	component: ReactRenderer<unknown, RichTextSuggestionMenuProps> | null;
	element: HTMLDivElement | null;
	// Detaches the resize/scroll listeners used by the input-anchored (chat
	// composer) positioning mode. Null for caret-anchored menus.
	cleanup: (() => void) | null;
}

export type RichTextMentionMenuCategory = RichTextMentionCategory | "people-team";
type RichTextMentionParentCategory = "people-team" | "subagent";

const SUGGESTION_PAGE_KEY_STEP = 5;

const nestedCommandLabelVariants: Variants = {
	idle: (instant: boolean) => ({
		transform: "translateY(8px)",
		transition: instant ? { duration: 0 } : { type: "spring", bounce: 0, visualDuration: 0.18 },
	}),
	active: (instant: boolean) => ({
		transform: "translateY(0px)",
		transition: instant ? { duration: 0 } : { type: "spring", bounce: 0.12, visualDuration: 0.24 },
	}),
};

const nestedCommandDescriptionVariants: Variants = {
	idle: (instant: boolean) => ({
		opacity: 0,
		transform: "translateY(4px)",
		transition: instant ? { duration: 0 } : { duration: 0.1, ease: [0.4, 0, 1, 1] },
	}),
	active: (instant: boolean) => ({
		opacity: 1,
		transform: "translateY(0px)",
		transition: instant ? { duration: 0 } : { delay: 0.02, duration: 0.16, ease: motionEase.out },
	}),
};

const PEOPLE_AVATAR_SRCS = [
	"/avatar-user/andrea-wilson/color/asow-service-yellow.png",
	"/avatar-user/andrew-park/color/asow-dev-lime.png",
	"/avatar-user/annie-clare/color/asow-strategy-orange.png",
	"/avatar-user/aoife-burke/color/asow-service-yellow.png",
	"/avatar-user/bradley-phillips/color/asow-product-purple.png",
	"/avatar-user/brian-lin/color/asow-teamwork-blue.png",
	"/avatar-user/christine-sanchez/color/asow-strategy-orange.png",
	"/avatar-user/david-hsieh/color/asow-service-yellow.png",
	"/avatar-user/florence-garcia/color/asow-strategy-orange.png",
	"/avatar-user/maia-ma/color/asow-service-yellow.png",
	"/avatar-user/nova/color/asow-dev-lime.png",
	"/avatar-user/olivia-yang/color/asow-service-yellow.png",
] as const;

const TEAM_AVATAR_SRCS = [
	"/avatar-project/apple.svg",
	"/avatar-project/bank.svg",
	"/avatar-project/battery.svg",
	"/avatar-project/boat.svg",
	"/avatar-project/book.svg",
	"/avatar-project/canvas.svg",
	"/avatar-project/cat.svg",
	"/avatar-project/celebration.svg",
	"/avatar-project/cloud.svg",
	"/avatar-project/code.svg",
	"/avatar-project/compass.svg",
	"/avatar-project/connie-blog.svg",
	"/avatar-project/gears.svg",
	"/avatar-project/government.svg",
	"/avatar-project/graduation.svg",
	"/avatar-project/graph.svg",
	"/avatar-project/group.svg",
	"/avatar-project/hr-badge.svg",
	"/avatar-project/id.svg",
	"/avatar-project/it.svg",
	"/avatar-project/launch-ship.svg",
	"/avatar-project/life-ring.svg",
	"/avatar-project/light-bulb.svg",
	"/avatar-project/lightning.svg",
	"/avatar-project/loom-record.svg",
	"/avatar-project/loom-video.svg",
	"/avatar-project/magnifying-glass.svg",
	"/avatar-project/mail.svg",
	"/avatar-project/map.svg",
	"/avatar-project/megaphone.svg",
	"/avatar-project/palm-tree.svg",
	"/avatar-project/paper-airplane.svg",
	"/avatar-project/pencil.svg",
	"/avatar-project/phone.svg",
	"/avatar-project/pin.svg",
	"/avatar-project/plant.svg",
	"/avatar-project/rocket.svg",
	"/avatar-project/science.svg",
	"/avatar-project/service-bell.svg",
	"/avatar-project/shield.svg",
	"/avatar-project/shopping-cart.svg",
	"/avatar-project/star.svg",
	"/avatar-project/stopwatch.svg",
	"/avatar-project/store-bag.svg",
	"/avatar-project/storefront.svg",
	"/avatar-project/sun.svg",
	"/avatar-project/support-wrench.svg",
	"/avatar-project/tracking.svg",
	"/avatar-project/unicorn.svg",
	"/avatar-project/video.svg",
] as const;

const AGENT_AVATAR_SRCS = [
	"/avatar-agent/teamwork-agents/blocker-checker.svg",
	"/avatar-agent/teamwork-agents/brainstorm-facilitator.svg",
	"/avatar-agent/teamwork-agents/brand-guardian.svg",
	"/avatar-agent/teamwork-agents/bug-report-assistant.svg",
	"/avatar-agent/teamwork-agents/customer-insights.svg",
	"/avatar-agent/teamwork-agents/decision-director.svg",
	"/avatar-agent/teamwork-agents/diagram-creator.svg",
	"/avatar-agent/teamwork-agents/global-translator.svg",
	"/avatar-agent/dev-agents/code-accessibility-checker.svg",
	"/avatar-agent/dev-agents/code-documentation-writer.svg",
	"/avatar-agent/dev-agents/code-planner.svg",
	"/avatar-agent/dev-agents/code-reviewer.svg",
	"/avatar-agent/product-agents/feedback-analyzer.svg",
	"/avatar-agent/service-agents/ops-guide.svg",
	"/avatar-agent/service-agents/rca-agent.svg",
	"/avatar-agent/service-agents/service-triage.svg",
	"/avatar-agent/strategy-agents/strategic-insight.svg",
	"/avatar-agent/strategy-agents/talent-finder.svg",
] as const;

const DEFAULT_MENTION_PARENT_LABELS: Record<RichTextMentionParentCategory, string> = {
	"people-team": "People and team",
	subagent: "Subagents",
};

function getMentionParentLabels(
	overrides?: RichTextMentionSectionLabels,
): Record<RichTextMentionParentCategory, string> {
	return { ...DEFAULT_MENTION_PARENT_LABELS, ...overrides };
}

/** "@" mention surface: people/teams and subagents, each opening a nested list. */
const MENTION_TARGET_ORDER: readonly RichTextMentionParentCategory[] = [
	"people-team",
	"subagent",
];

/**
 * "/" command surface: reference categories other than subagent (which lives on
 * the "@" surface), each opening a nested item list. Derived from the shared
 * `RICH_TEXT_REFERENCE_CATEGORY_OPTIONS` so the toolbar's "Add content" menu and
 * the slash menu stay in sync, minus subagent.
 */
const COMMAND_CATEGORY_ORDER: readonly RichTextCommandCategory[] = RICH_TEXT_REFERENCE_CATEGORY_OPTIONS
	.map((option) => option.category)
	.filter((category) => category !== "subagent") as readonly RichTextCommandCategory[];

const SLASH_CATEGORY_ORDER: readonly RichTextSlashCategory[] = [
	...COMMAND_CATEGORY_ORDER,
	"format",
];

/**
 * The slash category order, optionally without the "format" parent. The
 * mentions-only chat composer passes `includeFormat: false` so its "/" menu
 * surfaces references only; the document editor keeps the default.
 */
function getSlashCategoryOrder(
	includeFormat: boolean,
): readonly RichTextSlashCategory[] {
	return includeFormat
		? SLASH_CATEGORY_ORDER
		: COMMAND_CATEGORY_ORDER;
}
const ASK_ROVO_SLASH_ITEM: RichTextSuggestionMenuItem = {
	description: "Ask Rovo to help with the current editor context.",
	icon: <RovoColorIcon size="xxsmall" />,
	id: "ask-rovo",
	label: "Ask Rovo",
};

/**
 * Static fallback mention catalog. Sourced from the single unified
 * `EDITOR_PALETTE_MENTION_SOURCES` (built from the `@/app/data/directory`
 * loaders) so the live editor's `@` and `/` surfaces draw from the same catalog
 * as the composer palette instead of a divergent hardcoded set. Consumer-passed
 * `getMentionSources` still take precedence via `getMergedMentionSources`.
 */
const STATIC_MENTION_ITEMS: RichTextMentionSources = EDITOR_PALETTE_MENTION_SOURCES;

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

function getCategoryIcon(category: RichTextMentionCategory): ReactNode {
	if (isRichTextReferenceCategory(category)) {
		return getRichTextReferenceCategoryIcon(category);
	}

	switch (category) {
		case "human":
			return <PersonIcon label="" size="small" />;
		case "team":
			return <TeamsIcon label="" size="small" />;
	}
}

function getSlashCategoryIcon(category: RichTextSlashCategory): ReactNode {
	return category === "format"
		? <TextIcon label="" size="small" />
		: getCategoryIcon(category);
}

function getSlashCategoryLabel(category: RichTextSlashCategory): string {
	return category === "format" ? "Format" : getRichTextReferenceCategoryLabel(category);
}

/**
 * Contextual empty state for a suggestion surface with no matching rows. Mirrors
 * the showcase search picker: a title, the "try another term" hint, and an
 * optional "Browse all" button that launches the surface's directory. When
 * `onBrowseAll` is omitted (a surface with no backing directory, e.g. Format),
 * the button is hidden and only the title + hint show.
 */
export function RichTextSuggestionEmptyState({
	label = "No matching items",
	onBrowseAll,
}: Readonly<{
	label?: string;
	onBrowseAll?: () => void;
}>) {
	return (
		<Empty width="narrow" className="px-6 pt-4 pb-6">
			<EmptyHeader>
				<EmptyTitle headingSize="xsmall">{label}</EmptyTitle>
				<EmptyDescription>Try a different search term.</EmptyDescription>
			</EmptyHeader>
			{onBrowseAll ? (
				<EmptyContent>
					<Button
						type="button"
						variant="outline"
						// Keep focus in the editor: a mousedown blur would tear down the
						// suggestion popup before the click handler can open the directory.
						onMouseDown={(event) => event.preventDefault()}
						onClick={onBrowseAll}
					>
						Browse all
					</Button>
				</EmptyContent>
			) : null}
		</Empty>
	);
}

export function RichTextSuggestionMenu({
	className,
	emptyLabel,
	emptyState,
	header,
	items,
	onBack,
	onHover,
	onHoverEnd,
	onSelect,
	selectedIndex,
	selectedItemIds,
	showReturnShortcut = true,
	title,
}: Readonly<RichTextSuggestionMenuProps>) {
	const {
		listProps,
		menuProps,
		remeasure: updateListScrollState,
	} = useCommandMenuScrollMask();
	const listRef = listProps.ref;
	const isNested = Boolean(onBack);
	const hasHoverActions = items.some((item) => item.hoverActions !== undefined);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- nested menu changes reset and remeasure the scroll container.
	useEffect(() => {
		const listElement = listRef.current;
		if (listElement) {
			listElement.scrollTop = 0;
		}
		updateListScrollState();
	}, [isNested, listRef, title, updateListScrollState]);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	useLayoutEffect(() => {
		const listElement = listRef.current;
		const selectedElement = listElement?.querySelector<HTMLElement>(
			hasHoverActions
				? "[data-suggestion-option][data-selected='true']"
				: "[role='option'][aria-selected='true']",
		);
		if (!listElement || !selectedElement) {
			return;
		}

		selectedElement.scrollIntoView({ block: "nearest" });
		updateListScrollState();
	}, [hasHoverActions, items, listRef, selectedIndex, title, updateListScrollState]);

	return (
		<div
			className={cn("rich-text-command-menu", className)}
			data-nested={isNested ? "true" : undefined}
			data-has-header={header ? "true" : undefined}
			data-hide-return-shortcut={showReturnShortcut ? undefined : "true"}
			data-pointer-selects={onHover ? "true" : undefined}
			{...menuProps}
		>
			{onBack ? (
				<button
					type="button"
					className="rich-text-command-menu-item rich-text-command-menu-back"
					onMouseDown={(event) => event.preventDefault()}
					onClick={onBack}
				>
					<span className="inline-flex size-6 items-center justify-center">
						<ArrowLeftIcon className="size-4" />
					</span>
					<span className="menu-row-title">Back</span>
				</button>
			) : null}
			{header}
			<div
				className="rich-text-command-menu-list"
				role={hasHoverActions ? "list" : "listbox"}
				aria-label={title}
				aria-multiselectable={selectedItemIds ? true : undefined}
				{...listProps}
			>
				{items.length > 0 ? (
					items.map((item, index) => {
						return (
							<Fragment key={item.id}>
								{item.separatorBefore ? (
									<div aria-hidden="true" className="rich-text-command-menu-divider" />
								) : null}
								{item.headingLabel !== undefined ? (
									<div
										className="rich-text-command-menu-heading"
										role="presentation"
									>
										{item.headingLabel}
									</div>
								) : (
									<RichTextSuggestionMenuOption
										isChosen={selectedItemIds?.has(item.id)}
										isSelected={index === selectedIndex}
										item={item}
										listMode={hasHoverActions}
										onHover={onHover ? () => onHover(index) : undefined}
										onHoverEnd={onHoverEnd}
										onSelect={onSelect}
										showReturnShortcut={showReturnShortcut}
									/>
								)}
							</Fragment>
						);
					})
				) : (
					emptyState ?? <div className="rich-text-command-menu-empty">{emptyLabel}</div>
				)}
			</div>
		</div>
	);
}

export interface RichTextCommandMenuSearchFieldProps {
	autoFocus?: boolean;
	/**
	 * Set when an ancestor owns list keyboard navigation — e.g. a cmdk `Command`
	 * root, which handles Arrow/Enter through a React `onKeyDown` on its own
	 * container and bails when the event is already `defaultPrevented`. In that
	 * mode the field stops swallowing keys (no `stopPropagation`, no Enter
	 * `preventDefault`) so navigation reaches the host. Defaults to false: the
	 * field is self-contained and swallows keys so a surrounding TipTap editor
	 * never sees them.
	 */
	hostOwnsKeyNavigation?: boolean;
	icon: ReactNode;
	id?: string;
	label: string;
	onClear: () => void;
	onEscape?: () => void;
	onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
	onSubmit?: () => void;
	onValueChange: (value: string) => void;
	placeholder?: string;
	/**
	 * When true, show a "Tab" key hint in the trailing slot while the field is
	 * empty and unfocused — signalling that pressing Tab from the editor moves
	 * focus into this field (e.g. to prompt Rovo) rather than typing into the
	 * page. Hidden once the field is focused or has a value (where the clear
	 * button takes the slot instead).
	 */
	tabHint?: boolean;
	value: string;
}

export function RichTextCommandMenuSearchField({
	autoFocus,
	hostOwnsKeyNavigation,
	icon,
	id,
	label,
	onClear,
	onEscape,
	onKeyDown,
	onSubmit,
	onValueChange,
	placeholder = label,
	tabHint,
	value,
}: Readonly<RichTextCommandMenuSearchFieldProps>) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	// When this field is rendered inside a Base UI menu/popover, the
	// `FloatingFocusManager` moves focus to the popup container on open, which
	// beats the input's plain `autoFocus` attribute. Imperatively focus on mount
	// (after the focus manager settles) so opening "Add automation", "Add apps",
	// "Add skills", etc. lands the caret in the search box ready for typing.
	// Use preventScroll because this field is often rendered in portalled
	// popovers; native auto-focus can jump the surrounding page to the popup.
	useEffect(() => {
		if (!autoFocus) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			inputRef.current?.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(frame);
	}, [autoFocus]);
	return (
		<div className="rich-text-command-menu-search rich-text-command-menu-item-sticky">
			<span className="rich-text-command-menu-search-logo" aria-hidden={true}>
				{icon}
			</span>
			<Input
				ref={inputRef}
				id={id}
				variant="subtle"
				value={value}
				aria-label={label}
				placeholder={placeholder}
				onChange={(event) => onValueChange(event.currentTarget.value)}
				onKeyDown={(event) => {
					onKeyDown?.(event);
					if (!hostOwnsKeyNavigation) {
						event.stopPropagation();
					}
					if (event.defaultPrevented) {
						return;
					}
					if ((event.key === "Escape" || event.key === "Esc") && onEscape) {
						event.preventDefault();
						onEscape();
						return;
					}
					// Leave Enter alone when the host owns navigation: cmdk's root
					// handler skips events that are already `defaultPrevented`, so
					// preventing here would stop Enter from picking the highlighted row.
					if (event.key === "Enter" && !hostOwnsKeyNavigation) {
						event.preventDefault();
						onSubmit?.();
					}
				}}
			/>
			{value ? (
				<Button
					type="button"
					aria-label="Clear search"
					className="rich-text-command-menu-search-clear text-icon-subtle"
					onMouseDown={(event) => event.preventDefault()}
					onClick={onClear}
					shape="circle"
					size="icon-compact"
					variant="ghost"
				>
					<CrossCircleIcon label="" size="small" />
				</Button>
			) : tabHint ? (
				<span className="rich-text-command-menu-search-hint" aria-hidden="true">
					{/* Wrap the label in an element so Kbd renders the literal word
					    "Tab" instead of mapping the string to the ⇥ glyph. */}
					<Kbd><span>Tab</span></Kbd>
				</span>
			) : null}
		</div>
	);
}

interface RichTextSuggestionMenuOptionProps {
	isChosen?: boolean;
	isSelected: boolean;
	item: RichTextSuggestionMenuItem;
	listMode?: boolean;
	onHover?: () => void;
	onHoverEnd?: () => void;
	onSelect: (item: RichTextSuggestionMenuItem) => void;
	showReturnShortcut?: boolean;
}

function isFocusLeavingElement(
	event: FocusEvent<HTMLElement>,
): boolean {
	const next = event.relatedTarget;
	return !(next instanceof Node && event.currentTarget.contains(next));
}

function RichTextSuggestionMenuOption({
	isChosen,
	isSelected,
	item,
	listMode = false,
	onHover,
	onHoverEnd,
	onSelect,
	showReturnShortcut = true,
}: Readonly<RichTextSuggestionMenuOptionProps>) {
	const [isRowPointerActive, setIsRowPointerActive] = useState(false);
	const [isRowFocusWithin, setIsRowFocusWithin] = useState(false);
	const prefersReducedMotion = useReducedMotion();
	// Descriptions and live `inlineMetadata` (tool-call narration) reveal on
	// hover/selection so the collapsed row stays compact (label only) until the
	// user lands on it. Rows that opt into `persistentDescription` (nested parent
	// rows with a count byline) instead keep their description visible at all
	// times.
	const hasDescription = Boolean(item.description);
	const showsPersistentDescription = hasDescription && Boolean(item.persistentDescription);
	const revealedMetadata = item.inlineMetadata ?? (showsPersistentDescription ? undefined : item.description);
	const canRevealMetadata = revealedMetadata !== undefined && revealedMetadata !== "";
	const hasHoverActions = item.hoverActions !== undefined;
	const hasTrailing = item.trailing != null;
	// Hover-action rows reveal from the row wrapper (pointer on the row or
	// keyboard focus on the option/CTAs). A stale `isSelected` from the last
	// hover must not keep the byline or hide the rest-state spinner.
	const isHoverActionsRevealed = hasHoverActions && (isRowPointerActive || isRowFocusWithin);
	const isBylineRevealed = hasHoverActions ? isHoverActionsRevealed : isSelected;
	const shouldShowReturnShortcut = showReturnShortcut && !item.disabled && !hasHoverActions && (isSelected || isRowPointerActive || isRowFocusWithin);
	const shouldYieldTrailingToHoverActions = isHoverActionsRevealed;
	// A persistent trailing indicator (e.g. a status glyph) shows at rest, so the
	// copy must reserve room for it always — not only on hover/selection like the
	// return hint — so the label truncates before it instead of sliding under it.
	const hasPersistentTrailing = hasTrailing && !shouldShowReturnShortcut && !shouldYieldTrailingToHoverActions;
	const handlePointerEnter = () => {
		setIsRowPointerActive(true);
		if (!item.disabled) {
			onHover?.();
		}
	};
	const handlePointerLeave = () => {
		setIsRowPointerActive(false);
		onHoverEnd?.();
	};
	const handleFocusWithin = () => {
		setIsRowFocusWithin(true);
	};
	const handleBlurWithin = (event: FocusEvent<HTMLElement>) => {
		if (isFocusLeavingElement(event)) {
			setIsRowFocusWithin(false);
		}
	};
	const optionInteractionProps = hasHoverActions
		? {}
		: {
			onBlur: handleBlurWithin,
			onFocus: handleFocusWithin,
			onMouseEnter: handlePointerEnter,
			onMouseLeave: handlePointerLeave,
		};
	const className = cn(
		"rich-text-command-menu-item",
		isSelected && "rich-text-command-menu-item-selected",
		getSuggestionMenuItemStickyClassName(item),
	);
	const children = (
		<>
			<RichTextSuggestionMenuItemVisual item={item} />
			{canRevealMetadata ? (
				<span className="rich-text-command-menu-copy rich-text-command-menu-nested-copy rich-text-command-menu-nested-copy-revealable min-w-0">
					<motion.span
						className="menu-row-title min-w-0"
						custom={Boolean(prefersReducedMotion)}
						style={{ willChange: "transform" }}
						variants={nestedCommandLabelVariants}
					>
						{item.label}
					</motion.span>
					<motion.span
						className="menu-row-byline min-w-0"
						custom={Boolean(prefersReducedMotion)}
						style={{ willChange: "transform, opacity" }}
						variants={nestedCommandDescriptionVariants}
					>
						{revealedMetadata}
					</motion.span>
				</span>
			) : (
				<span className="rich-text-command-menu-copy min-w-0">
					<span className="menu-row-title">{item.label}</span>
					{showsPersistentDescription ? (
						<span className="menu-row-byline">
							{item.description}
						</span>
					) : null}
				</span>
			)}
			{shouldShowReturnShortcut ? (
				<span className="rich-text-command-menu-shortcut rich-text-command-menu-return-shortcut" aria-hidden="true">
					<span className="inline-flex size-4 shrink-0 items-center justify-center">
						<ReturnIcon className="size-3.5 text-icon-subtlest" />
					</span>
				</span>
			) : hasTrailing ? (
				<span
					aria-hidden={shouldYieldTrailingToHoverActions ? true : undefined}
					className={cn(
						"rich-text-command-menu-shortcut",
						shouldYieldTrailingToHoverActions ? "pointer-events-none opacity-0" : undefined,
					)}
				>
					{item.trailing}
				</span>
			) : item.shortcut ? (
				<span className="rich-text-command-menu-shortcut">
					<Kbd>{item.shortcut}</Kbd>
				</span>
			) : null}
		</>
	);

	const option = canRevealMetadata ? (
			<motion.button
				type="button"
				role={listMode ? undefined : "option"}
				aria-selected={listMode ? undefined : isChosen ?? isSelected}
				animate={isBylineRevealed ? "active" : "idle"}
				custom={Boolean(prefersReducedMotion)}
				className={className}
				data-has-actions={hasHoverActions ? "true" : undefined}
				data-selected={isChosen ?? isSelected ? "true" : undefined}
				data-suggestion-option=""
				data-has-trailing={hasPersistentTrailing ? "true" : undefined}
				disabled={item.disabled}
				initial={false}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => onSelect(item)}
				whileFocus={hasHoverActions ? undefined : "active"}
				whileHover={hasHoverActions ? undefined : "active"}
				{...optionInteractionProps}
			>
				{children}
			</motion.button>
	) : (
		<button
			type="button"
			role={listMode ? undefined : "option"}
			aria-selected={listMode ? undefined : isChosen ?? isSelected}
			className={className}
			data-has-actions={hasHoverActions ? "true" : undefined}
			data-selected={isChosen ?? isSelected ? "true" : undefined}
			data-suggestion-option=""
			data-has-trailing={hasPersistentTrailing ? "true" : undefined}
			disabled={item.disabled}
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => onSelect(item)}
			{...optionInteractionProps}
		>
			{children}
		</button>
	);

	if (!item.hoverActions) {
		return option;
	}

	return (
		<div
			className="group/suggestion-option grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg"
			data-suggestion-actions=""
			onBlur={handleBlurWithin}
			onFocus={handleFocusWithin}
			onMouseEnter={handlePointerEnter}
			onMouseLeave={handlePointerLeave}
			role="listitem"
		>
			{option}
			<div
				className="pointer-events-none flex w-0 items-center gap-1 overflow-hidden opacity-0"
				data-suggestion-action-buttons=""
			>
				<Button
					onClick={(event) => {
						event.stopPropagation();
						item.hoverActions?.onPrimary();
					}}
					size="compact"
					type="button"
					variant="outline"
				>
					{item.hoverActions.primaryLabel}
				</Button>
				<Button
					aria-label={item.hoverActions.secondaryLabel}
					onClick={(event) => {
						event.stopPropagation();
						item.hoverActions?.onSecondary();
					}}
					size="icon-compact"
					type="button"
					variant="outline"
				>
					{item.hoverActions.secondaryIcon}
				</Button>
			</div>
		</div>
	);
}

function getSuggestionMenuItemStickyClassName(
	item: RichTextSuggestionMenuItem,
): string | undefined {
	return cn(
		item.isSticky && "rich-text-command-menu-item-sticky",
		item.isSticky && item.stickyPosition === "bottom" && "rich-text-command-menu-item-sticky-bottom",
	);
}

function RichTextSuggestionMenuItemVisual({
	item,
}: Readonly<{ item: RichTextSuggestionMenuItem }>) {
	// Single front-slot size everywhere: every shared menu tile is drawn natively
	// at 24px (`small`) inside the 24px front-slot box defined in CSS via
	// `.rich-text-command-menu-avatar`. Rendering natively (rather than scaling a
	// 32px mark down to 75%) keeps the glyph on ADS's `small` Tile inset (14px),
	// matching /components/ui/logo — a scaled 32px tile would freeze the `medium`
	// inset and shrink the glyph to 12px.
	const tileVariant = getSuggestionMenuIconTileVariant(item);
	const visual = item.leadingVisual ? (
		item.leadingVisual
	) : item.visual ? (
		<RichTextMentionVisualMark
			label={item.label}
			size="menu-compact"
			visual={item.visual}
		/>
	) : (
		<IconTile
			size="small"
			iconSize={tileVariant === "transparent" ? "small" : undefined}
			label={item.label}
			aria-hidden={true}
			icon={item.icon}
			variant={tileVariant}
		/>
	);

	return (
		<span className="rich-text-command-menu-avatar inline-flex shrink-0 items-center justify-center">
			{visual}
		</span>
	);
}

function filterItems<T extends { label: string; description?: string; isSticky?: boolean }>(
	items: readonly T[],
	query: string,
): readonly T[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return items;
	}

	return items.filter((item) => {
		if (item.isSticky) {
			return true;
		}

		const haystack = `${item.label} ${item.description ?? ""}`.toLowerCase();
		return haystack.includes(normalizedQuery);
	});
}

function createPopup(anchorToInput = false): HTMLDivElement {
	const element = document.createElement("div");
	element.className = anchorToInput
		? "rich-text-command-menu-popover rich-text-command-menu-popover-anchored"
		: "rich-text-command-menu-popover";
	document.body.appendChild(element);
	return element;
}

function positionPopup(
	element: HTMLDivElement | null,
	clientRect?: (() => DOMRect | null) | null,
): void {
	if (!element || !clientRect) {
		return;
	}

	const rect = clientRect();
	if (!rect) {
		return;
	}

	element.style.left = `${rect.left}px`;
	element.style.top = `${rect.bottom + 6}px`;
}

/**
 * Chat-composer positioning: instead of opening at the caret, anchor the palette
 * to the prompt-input root, span its full width, and sit 8px away. Prefer the
 * Studio-style placement above the input; use the old below placement only when
 * the menu would clip above the viewport.
 */
const COMPOSER_POPUP_GAP = 8;
const PROMPT_INPUT_ROOT_SELECTOR = "[data-prompt-input-root]";

function getComposerAnchorBox(editorDom: HTMLElement): HTMLElement | null {
	const root =
		editorDom.closest<HTMLElement>(PROMPT_INPUT_ROOT_SELECTOR) ??
		editorDom.closest<HTMLElement>(".chat-composer-form") ??
		editorDom.closest<HTMLElement>("form");
	return root ? resolveComposerVisualBox(root) : null;
}

/**
 * The palette must clear the VISIBLE composer card, but `[data-prompt-input-root]`
 * is the inner `<form>`, which paints the visible border only for the floating /
 * blocks composers. The card composer (e.g. the Rovo "/rovo" + Studio panels)
 * wraps that border-less form in a padded, bordered container, so measuring the
 * 8px gap from the form drops the palette ~12px INSIDE the visible card instead of
 * outside it.
 *
 * Walk up from the form and return the first (innermost) ancestor that tightly
 * wraps it (≈ same width — not the whole panel) and is a ROUNDED card (has a
 * corner radius). Requiring a radius — not merely a top border — is deliberate:
 * composers are wrapped in `border-t p-*` footer/divider containers (e.g.
 * components/blocks/cursor/page.tsx, components/blocks/workflow/page.tsx) whose
 * top border would otherwise be mistaken for the input's edge, climbing the
 * anchor PAST the real (already-rounded) composer into the footer. Returning at
 * the first rounded match means an already-rounded form (floating / blocks) stops
 * there, while a border-less card form ascends one level to its rounded wrapper.
 */
function resolveComposerVisualBox(root: HTMLElement): HTMLElement {
	const rootWidth = root.getBoundingClientRect().width;
	let element: HTMLElement | null = root;
	for (let depth = 0; depth < 3 && element; depth++) {
		const styles = window.getComputedStyle(element);
		const isRoundedCard = Number.parseFloat(styles.borderTopLeftRadius) > 0;
		// Guard against climbing into a much larger layout container (e.g. the chat
		// panel): only adopt an ancestor that hugs the form's width.
		const tightlyWraps = element.getBoundingClientRect().width <= rootWidth + 48;
		if (isRoundedCard && tightlyWraps) {
			return element;
		}
		element = element.parentElement;
	}
	// No rounded card within reach (border-less / square composer): fall back to the
	// form so behavior is unchanged for those surfaces.
	return root;
}

function positionComposerPopup(
	element: HTMLDivElement | null,
	editorDom?: HTMLElement | null,
): void {
	if (!element || !editorDom) {
		return;
	}

	const box = getComposerAnchorBox(editorDom);
	if (!box) {
		return;
	}

	const rect = box.getBoundingClientRect();
	const popupHeight = element.offsetHeight || 0;
	const spaceAbove = rect.top - COMPOSER_POPUP_GAP;
	const placeAbove = popupHeight <= spaceAbove;

	element.style.maxWidth = "none";
	element.style.left = `${rect.left}px`;
	element.style.width = `${rect.width}px`;
	element.style.top = placeAbove
		? `${Math.max(COMPOSER_POPUP_GAP, rect.top - popupHeight - COMPOSER_POPUP_GAP)}px`
		: `${rect.bottom + COMPOSER_POPUP_GAP}px`;
}

/**
 * Attach the input-anchored positioning + a resize/scroll reposition loop for a
 * chat-composer palette. Returns a cleanup that detaches the listeners. A double
 * rAF lets the menu render (and re-render after a category drill-in) so its
 * measured height drives the up/down flip on the next frame.
 */
function attachComposerAnchor(
	element: HTMLDivElement | null,
	editorDom: HTMLElement | null,
): () => void {
	let frame = 0;
	const reposition = () => positionComposerPopup(element, editorDom);
	// Coalesce bursty scroll/resize events into a single reposition per frame —
	// each reposition does a getBoundingClientRect read + style writes, so an
	// unthrottled capture-phase scroll listener would force-reflow on every event
	// during momentum scrolling.
	const scheduleReposition = () => {
		if (frame) {
			return;
		}
		frame = requestAnimationFrame(() => {
			frame = 0;
			reposition();
		});
	};
	reposition();
	requestAnimationFrame(reposition);
	window.addEventListener("resize", scheduleReposition);
	// Capture phase so we also catch scrolls inside scrollable ancestors; passive
	// since we never preventDefault.
	window.addEventListener("scroll", scheduleReposition, { capture: true, passive: true });

	// The palette is BOTTOM-anchored: `positionComposerPopup` sets `top = anchorTop
	// - height - gap`, so its bottom hugs `anchorTop - gap` ONLY when recomputed at
	// the menu's current height. The list grows/shrinks AFTER the initial double
	// rAF — filtering the "/" query down to a couple of rows, a category drill-in,
	// or async row content — and neither the window resize nor scroll listener
	// fires for an element's OWN size change. Without observing it, a menu that
	// opened tall and then shrank keeps its stale `top` and floats high above the
	// composer instead of hugging it. Observe the popup (its height) and the anchor
	// box (its position/size) so every height change re-hugs the bottom edge.
	const resizeObserver =
		typeof ResizeObserver === "undefined"
			? null
			: new ResizeObserver(scheduleReposition);
	if (resizeObserver) {
		if (element) {
			resizeObserver.observe(element);
		}
		const anchorBox = editorDom ? getComposerAnchorBox(editorDom) : null;
		if (anchorBox) {
			resizeObserver.observe(anchorBox);
		}
	}

	return () => {
		if (frame) {
			cancelAnimationFrame(frame);
		}
		resizeObserver?.disconnect();
		window.removeEventListener("resize", scheduleReposition);
		window.removeEventListener("scroll", scheduleReposition, { capture: true });
	};
}

/**
 * A "/" selection is either a basic-block command to run or a reference item to
 * insert as a mention token (the migrated Skills/Tools/Knowledge categories).
 */
export type RichTextSlashAction =
	| { type: "ask-rovo"; onAskRovo?: (editor: Editor) => void }
	| { type: "command"; run: (editor: Editor) => void }
	| { type: "mention"; mention: RichTextMentionItem };

function isSlashCategoryId(id: string): id is RichTextSlashCategory {
	return (SLASH_CATEGORY_ORDER as readonly string[]).includes(id);
}

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

/**
 * Layout for the live suggestion menus. `"flat"` merges every section of a
 * surface into one list separated by headings; `"nested"` keeps the original
 * drill-in category lists.
 */
type SuggestionVariant = "nested" | "flat";

/** Max items shown per section (empty query) before the section footer. */
const FLAT_SECTION_LIMIT = 5;

/** Prefix for the synthetic footer rows ("Browse all" / "View more"). */
const FLAT_FOOTER_ID_PREFIX = "__rich-text-flat-footer__";

function getFlatFooterId(category: string): string {
	return `${FLAT_FOOTER_ID_PREFIX}${category}`;
}

function isFlatFooterId(id: string): boolean {
	return id.startsWith(FLAT_FOOTER_ID_PREFIX);
}

/** One section of a merged flat surface. */
interface FlatSectionSpec {
	/** Stable key used for the heading id, footer id, and expansion state. */
	key: string;
	/** Section heading text (mirrors the dropdown menu group label). */
	title: string;
	/**
	 * Directory-backed sections show a "Browse all" footer that links out;
	 * the rest show a "View more" / "View less" footer that expands inline.
	 */
	hasDirectory: boolean;
	/** Full item list for the section (already mapped to menu items). */
	items: readonly RichTextSuggestionMenuItem[];
}

/**
 * Builds the rows for a merged flat surface from its sections.
 *
 * - Empty query: each section leads with a heading, caps at five items, and
 *   ends with a footer ("Browse all" for directory sections, "View more" /
 *   "View less" for the rest). "View more" sections honor `expandedSections`.
 * - Non-empty query: every section is filtered, empty sections (and their
 *   headings/footers) are dropped, and all matches are shown with no cap.
 */
function buildFlatSurfaceRows(
	sections: readonly FlatSectionSpec[],
	query: string,
	expandedSections: Readonly<Record<string, boolean>>,
	rankMatches = false,
): readonly RichTextSuggestionMenuItem[] {
	const normalizedQuery = query.trim();
	const isFiltering = normalizedQuery.length > 0;
	const rows: RichTextSuggestionMenuItem[] = [];
	const resolvedSections = sections
		.map((section, index) => {
			const filteredItems = isFiltering
				? filterItems(section.items, normalizedQuery)
				: section.items;
			const matchedItems = isFiltering && rankMatches
				? rankSuggestionsByMatch(filteredItems, normalizedQuery)
				: filteredItems;
			return { index, matchedItems, section };
		})
		.filter(({ matchedItems }) => matchedItems.length > 0);
	if (isFiltering && rankMatches) {
		resolvedSections.sort((left, right) =>
			getSuggestionMatchRank(left.matchedItems[0], normalizedQuery)
			- getSuggestionMatchRank(right.matchedItems[0], normalizedQuery)
			|| left.index - right.index,
		);
	}

	for (const { matchedItems, section } of resolvedSections) {
		rows.push({
			id: `${section.key}-heading`,
			label: section.title,
			headingLabel: section.title,
			icon: null,
		});

		if (isFiltering) {
			// While filtering, show every match across all sections — no caps.
			rows.push(...matchedItems);
			continue;
		}

		const overflowing = matchedItems.length > FLAT_SECTION_LIMIT;
		const expanded = !section.hasDirectory && Boolean(expandedSections[section.key]);
		const visibleItems = expanded ? matchedItems : matchedItems.slice(0, FLAT_SECTION_LIMIT);
		rows.push(...visibleItems);

		if (overflowing) {
			rows.push(
				getSuggestionOverflowFooterItem(
					getFlatFooterId(section.key),
					section.hasDirectory ? "browse-all" : (expanded ? "view-less" : "view-more"),
					{ isSticky: true },
				),
			);
		}
	}

	return rows;
}

/** A row is selectable when it is neither a section heading nor disabled. */
function isSelectableRow(item: RichTextSuggestionMenuItem): boolean {
	return item.headingLabel === undefined && !item.disabled;
}

/** First selectable index at or after `from` (wrapping), or -1 if none. */
function getFirstSelectableIndex(
	items: readonly RichTextSuggestionMenuItem[],
	from = 0,
): number {
	for (let offset = 0; offset < items.length; offset += 1) {
		const index = (from + offset) % items.length;
		if (isSelectableRow(items[index])) {
			return index;
		}
	}
	return -1;
}

/**
 * Moves the selected index to the next selectable row in `direction`, skipping
 * heading rows and wrapping around the list.
 */
function getNextSelectableIndex(
	items: readonly RichTextSuggestionMenuItem[],
	currentIndex: number,
	direction: -1 | 1,
): number {
	if (items.length === 0) {
		return 0;
	}
	for (let step = 1; step <= items.length; step += 1) {
		const index = (currentIndex + direction * step + items.length * step) % items.length;
		if (isSelectableRow(items[index])) {
			return index;
		}
	}
	return currentIndex;
}

/** Page up/down to a selectable row, clamped to the list bounds. */
function getPagedSelectableIndex(
	items: readonly RichTextSuggestionMenuItem[],
	currentIndex: number,
	direction: -1 | 1,
): number {
	if (items.length === 0) {
		return 0;
	}
	const target = Math.min(
		Math.max(currentIndex + direction * SUGGESTION_PAGE_KEY_STEP, 0),
		items.length - 1,
	);
	// Snap onto the nearest selectable row in the travel direction.
	for (let index = target; index >= 0 && index < items.length; index += direction) {
		if (isSelectableRow(items[index])) {
			return index;
		}
	}
	return getFirstSelectableIndex(items, target);
}

/**
 * Per-renderer counter so each Ask Rovo-enabled "/" menu gives its field a
 * unique, stable DOM id. The id lets the editor's Tab handler move focus into
 * that field (client-only — the renderer is created by Tiptap on the client,
 * never SSR).
 */
let askRovoFieldIdCounter = 0;

export function createSlashSuggestionRenderer(
	getMentionSources?: () => RichTextMentionSources | undefined,
	onAskRovo?: (editor: Editor) => void,
	includeFormat = true,
	anchorToInput = false,
	variant: SuggestionVariant = "nested",
	showAskRovoPrompt = true,
	// Launches the directory for a nested "/" category from its empty-state
	// "Browse all" button. Only directory-backed categories (everything but
	// "format") invoke it; omit it to keep the plain empty title with no button.
	onOpenDirectory?: (category: RichTextSlashCategory) => void,
	onExitSuggestion?: (editor: Editor) => void,
) {
	const popupState: SuggestionPopupState = { component: null, element: null, cleanup: null };
	let selectedIndex = 0;
	let activeCategory: RichTextSlashCategory | null = null;
	let currentProps: SuggestionProps<RichTextSlashAction, RichTextSlashAction> | null = null;
	let askRovoPrompt = "";
	askRovoFieldIdCounter += 1;
	const askRovoFieldId = `rich-text-ask-rovo-field-${askRovoFieldIdCounter}`;
	// Per-section inline expansion for "View more" footers (flat variant only).
	const expandedSections: Record<string, boolean> = {};

	const isFlat = variant === "flat";

	function shouldUseFlatSurface(query: string): boolean {
		return isFlat || (!activeCategory && query.trim().length > 0);
	}

	/** Maps a "/" category to its full, unfiltered menu items. */
	function getCategoryMenuItems(
		category: RichTextSlashCategory,
	): readonly RichTextSuggestionMenuItem[] {
		return category === "format"
			? getSlashCommandFormatItems()
			: getMentionChildItems(getMentionSources?.(), category);
	}

	/** Flat surface sections in slash order (skills, tools, knowledge, format). */
	function getFlatSections(): readonly FlatSectionSpec[] {
		return getSlashCategoryOrder(includeFormat).map((category) => ({
			key: category,
			title: getSlashCategoryLabel(category),
			// Reference categories link out to a directory; "format" expands inline.
			hasDirectory: category !== "format",
			items: getCategoryMenuItems(category),
		}));
	}

	// --- Nested (drill-in) item resolution -------------------------------------
	function getTopLevelItems(query: string): readonly RichTextSuggestionMenuItem[] {
		return filterItems(getSlashCommandCategoryItems(getMentionSources?.(), includeFormat), query);
	}

	function getChildItems(query: string): readonly RichTextSuggestionMenuItem[] {
		if (!activeCategory) {
			return [];
		}

		if (activeCategory === "format") {
			return getSlashCommandFormatItems(query);
		}

		return filterItems(getMentionChildItems(getMentionSources?.(), activeCategory), query);
	}

	function getVisibleItems(query: string): readonly RichTextSuggestionMenuItem[] {
		if (shouldUseFlatSurface(query)) {
			return buildFlatSurfaceRows(getFlatSections(), query, expandedSections);
		}
		return activeCategory ? getChildItems(query) : getTopLevelItems(query);
	}

	function dismissSuggestion(): void {
		if (!currentProps) {
			return;
		}
		const { editor } = currentProps;
		onExitSuggestion?.(editor);
		requestAnimationFrame(() => {
			editor.commands.focus();
		});
	}

	function submitAskRovoPrompt(): boolean {
		if (!currentProps) {
			return false;
		}
		currentProps.command({ type: "ask-rovo", onAskRovo });
		return true;
	}

	function updateAskRovoPrompt(value: string): void {
		askRovoPrompt = value;
		if (currentProps) {
			update(currentProps);
		}
	}

	function shouldHideSlashRowsForAskRovoPrompt(): boolean {
		return showAskRovoPrompt && (isFlat || !activeCategory) && askRovoPrompt.trim().length > 0;
	}

	function getAskRovoHeader(): ReactNode | undefined {
		if (!showAskRovoPrompt) {
			return undefined;
		}

		return (
			<RichTextCommandMenuSearchField
				id={askRovoFieldId}
				icon={ASK_ROVO_SLASH_ITEM.icon}
				label={ASK_ROVO_SLASH_ITEM.label}
				onClear={() => updateAskRovoPrompt("")}
				onEscape={dismissSuggestion}
				onSubmit={submitAskRovoPrompt}
				onValueChange={updateAskRovoPrompt}
				placeholder={ASK_ROVO_SLASH_ITEM.label}
				tabHint
				value={askRovoPrompt}
			/>
		);
	}

	function update(props: SuggestionProps<RichTextSlashAction, RichTextSlashAction>) {
		currentProps = props;
		const items = shouldHideSlashRowsForAskRovoPrompt()
			? []
			: getVisibleItems(props.query);
		selectedIndex = clampSelectedIndex(items, selectedIndex);

		// A nested drill-in (no header) shows the contextual empty state: the
		// "No matching items" title plus, for directory-backed categories
		// (everything but "format"), a "Browse all" button that opens that
		// category's directory. With the Ask Rovo header showing (flat surface or
		// the top-level category list), a non-matching query collapses to just
		// that header — render an empty fragment so no "No commands found" row.
		const nestedCategory = !isFlat && activeCategory ? activeCategory : null;
		const shouldShowAskRovoHeader = showAskRovoPrompt && (isFlat || !activeCategory);

		// When a "/" filter matches nothing and there is no Ask Rovo header to
		// fall back on, hide the popup entirely instead of surfacing a "no
		// results" box — the empty composer already signals there are no matches.
		const shouldHidePopup = items.length === 0 && !shouldShowAskRovoHeader;
		if (popupState.element) {
			popupState.element.style.display = shouldHidePopup ? "none" : "";
		}
		if (shouldHidePopup) {
			return;
		}

		if (anchorToInput) {
			positionComposerPopup(popupState.element, props.editor.view.dom);
		} else {
			positionPopup(popupState.element, props.clientRect);
		}
		const nestedEmptyState = nestedCategory ? (
			<RichTextSuggestionEmptyState
				onBrowseAll={
					nestedCategory !== "format" && onOpenDirectory
						? () => onOpenDirectory(nestedCategory)
						: undefined
				}
			/>
		) : undefined;
		popupState.component?.updateProps({
			emptyLabel: nestedCategory ? "No matching items" : "No commands found",
			emptyState: nestedCategory ? nestedEmptyState : shouldShowAskRovoHeader ? <></> : undefined,
			items,
			onBack: !isFlat && activeCategory
				? () => {
						activeCategory = null;
						selectedIndex = 0;
						update(props);
					}
				: undefined,
			header: shouldShowAskRovoHeader ? getAskRovoHeader() : undefined,
			onSelect: (item: RichTextSuggestionMenuItem) => selectItem(item),
			onHover: selectIndex,
			selectedIndex,
			title: !isFlat && activeCategory ? getSlashCategoryLabel(activeCategory) : "Commands",
		});
	}

	/** Clamp/snap the selection onto a selectable row (skips headings). */
	function clampSelectedIndex(
		items: readonly RichTextSuggestionMenuItem[],
		index: number,
	): number {
		if (items.length === 0) {
			return 0;
		}
		const bounded = Math.min(Math.max(index, 0), items.length - 1);
		return isSelectableRow(items[bounded])
			? bounded
			: Math.max(getFirstSelectableIndex(items, bounded), 0);
	}

	function selectItem(item: RichTextSuggestionMenuItem | undefined): boolean {
		if (!item || !currentProps) {
			return false;
		}

		if (shouldUseFlatSurface(currentProps.query)) {
			// "Browse all" footers link out to a directory we don't host here; keep
			// the menu open. "View more" / "View less" footers toggle the section.
			if (isFlatFooterId(item.id)) {
				const sectionKey = item.id.slice(FLAT_FOOTER_ID_PREFIX.length);
				if (item.label === "View more" || item.label === "View less") {
					expandedSections[sectionKey] = !expandedSections[sectionKey];
					update(currentProps);
				}
				return true;
			}

			// Format commands run; everything else inserts a reference mention.
			const command = SLASH_COMMANDS.find((candidate) => candidate.id === item.id);
			if (command) {
				currentProps.command({ type: "command", run: command.run });
				return true;
			}

			const mention = findMentionAcrossCategories(item.id);
			if (mention) {
				currentProps.command({ type: "mention", mention });
				return true;
			}
			return false;
		}

		if (activeCategory) {
			if (activeCategory === "format") {
				const command = SLASH_COMMANDS.find((candidate) => candidate.id === item.id);
				if (!command) {
					return false;
				}

				currentProps.command({ type: "command", run: command.run });
				return true;
			}

			const mention = getCategoryItems(getMentionSources?.(), activeCategory).find(
				(candidate) => candidate.id === item.id,
			);
			if (!mention) {
				return false;
			}

			currentProps.command({ type: "mention", mention });
			return true;
		}

		if (isSlashCategoryId(item.id)) {
			activeCategory = item.id;
			selectedIndex = 0;
			update(currentProps);
			return true;
		}
		return false;
	}

	/** Find a reference mention by id across every "/" reference category. */
	function findMentionAcrossCategories(id: string): RichTextMentionItem | undefined {
		for (const category of getSlashCategoryOrder(includeFormat)) {
			if (category === "format") {
				continue;
			}
			const mention = getCategoryItems(getMentionSources?.(), category).find(
				(candidate) => candidate.id === id,
			);
			if (mention) {
				return mention;
			}
		}
		return undefined;
	}

	function moveSelection(direction: -1 | 1, paged: boolean) {
		if (!currentProps) {
			return;
		}
		const items = getVisibleItems(currentProps.query);
		selectedIndex = paged
			? getPagedSelectableIndex(items, selectedIndex, direction)
			: getNextSelectableIndex(items, selectedIndex, direction);
		update(currentProps);
	}

	/** Pointer hover: move the keyboard selection onto the hovered row. */
	function selectIndex(index: number) {
		if (!currentProps || index === selectedIndex) {
			return;
		}
		selectedIndex = index;
		update(currentProps);
	}

	return {
		onStart: (props: SuggestionProps<RichTextSlashAction, RichTextSlashAction>) => {
			popupState.element = createPopup(anchorToInput);
			popupState.component = new ReactRenderer(RichTextSuggestionMenu, {
				editor: props.editor,
				props: {
					className: "rich-text-command-menu-borderless",
					emptyLabel: "No commands found",
					items: getVisibleItems(props.query),
					onSelect: (item: RichTextSuggestionMenuItem) => selectItem(item),
					selectedIndex,
					title: "Commands",
				},
			});
			popupState.element.appendChild(popupState.component.element);
			update(props);
			if (anchorToInput) {
				popupState.cleanup = attachComposerAnchor(popupState.element, props.editor.view.dom);
			}
		},
		onUpdate: update,
		onKeyDown: ({ event }: SuggestionKeyDownProps) => {
			if (!currentProps) {
				return false;
			}
			const items = getVisibleItems(currentProps.query);
			if (event.key === "ArrowDown") {
				moveSelection(1, false);
				return true;
			}
			if (event.key === "ArrowUp") {
				moveSelection(-1, false);
				return true;
			}
			if (event.key === "PageDown") {
				moveSelection(1, true);
				return true;
			}
			if (event.key === "PageUp") {
				moveSelection(-1, true);
				return true;
			}
			if (event.key === "Home") {
				selectedIndex = Math.max(getFirstSelectableIndex(items, 0), 0);
				update(currentProps);
				return true;
			}
			if (event.key === "End") {
				selectedIndex = clampSelectedIndex(items, items.length - 1);
				update(currentProps);
				return true;
			}
			if (event.key === "Tab") {
				// Tab moves focus into the Ask Rovo field (when present) so the user
				// can prompt Rovo instead of inserting into the page. The header only
				// renders for the flat surface and the nested top level, so fall back
				// to selecting the row when there is no field to focus.
				if (showAskRovoPrompt) {
					const askRovoField = document.getElementById(askRovoFieldId);
					if (askRovoField instanceof HTMLInputElement && currentProps) {
						// If the user already typed "/query", move that text out of the
						// page and into the Ask Rovo field: keep the "/" trigger so the
						// menu stays open, then delete just the query characters.
						if (currentProps.query) {
							askRovoPrompt += currentProps.query;
							const { from, to } = currentProps.range;
							currentProps.editor.commands.deleteRange({ from: from + 1, to });
						}
						askRovoField.focus();
						return true;
					}
				}
				return selectItem(items[selectedIndex]);
			}
			if (event.key === "Enter") {
				return selectItem(items[selectedIndex]);
			}
			if (event.key === "Backspace" && !isFlat && activeCategory) {
				activeCategory = null;
				selectedIndex = 0;
				update(currentProps);
				return true;
			}
			if (event.key === "Escape") {
				return false;
			}
			return false;
		},
		onExit: () => {
			popupState.cleanup?.();
			popupState.cleanup = null;
			popupState.component?.destroy();
			popupState.element?.remove();
			popupState.component = null;
			popupState.element = null;
			currentProps = null;
			selectedIndex = 0;
			activeCategory = null;
			askRovoPrompt = "";
		},
	};
}

function getMergedMentionSources(
	sources: RichTextMentionSources | undefined,
): RichTextMentionSources {
	const mergeCategoryItems = (category: RichTextMentionCategory): readonly RichTextMentionItem[] => {
		const merged = [...(sources?.[category] ?? []), ...(STATIC_MENTION_ITEMS[category] ?? [])];
		const seen = new Set<string>();

		return merged.filter((item) => {
			const key = `${item.category}:${item.id}:${item.label.trim().toLowerCase()}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	};

	return {
		...STATIC_MENTION_ITEMS,
		...sources,
		// Subagents are nested agents owned by the current agent — never sourced from
		// the global parent-agent palette. Use ONLY the per-editor sources so the
		// `@subagent` list is empty/0 until the agent has its own subagents.
		subagent: [...(sources?.subagent ?? [])],
		human: mergeCategoryItems("human"),
		team: mergeCategoryItems("team"),
		skill: mergeCategoryItems("skill"),
		tool: mergeCategoryItems("tool"),
		knowledge: mergeCategoryItems("knowledge"),
		app: mergeCategoryItems("app"),
	};
}

function getCategoryItems(
	sources: RichTextMentionSources | undefined,
	category: RichTextMentionMenuCategory,
): readonly RichTextMentionItem[] {
	if (category === "people-team") {
		return [
			...getCategoryItems(sources, "human"),
			...getCategoryItems(sources, "team"),
		];
	}

	return getMergedMentionSources(sources)[category] ?? [];
}

/** Lowercase, dotted handle from a display name (e.g. "Andrea Wilson" -> "andrea.wilson"). */
function getMentionHandle(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ".")
			.replace(/^\.+|\.+$/g, "") || "user"
	);
}

/** Stable, pseudo-random member count (10-200) derived from the team id. */
function getStableMemberCount(seed: string): number {
	let hash = 0;

	for (let index = 0; index < seed.length; index += 1) {
		hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
	}

	return 10 + (hash % 191);
}

function getMentionChildDescription(item: RichTextMentionItem): string {
	if (item.description) {
		return item.description;
	}

	switch (item.category) {
		case "subagent":
			return `Delegate context or follow-up work to ${item.label}.`;
		case "human":
			return `@${getMentionHandle(item.label)}`;
		case "team":
			return `${getStableMemberCount(item.id)} members`;
		case "skill":
			return `Run the ${item.label} skill.`;
		case "tool":
			return `Use ${item.label} for this task.`;
		case "knowledge":
			return `Reference ${item.label} as knowledge context.`;
		case "app":
			return `Connect ${item.label} (tools and knowledge) to this agent.`;
		default: {
			// Exhaustiveness guard: a new RichTextMentionCategory must add a case above.
			const exhaustiveCategory: never = item.category;
			return exhaustiveCategory;
		}
	}
}

function getStableAssetIndex(seed: string, assetCount: number): number {
	let hash = 0;

	for (let index = 0; index < seed.length; index += 1) {
		hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
	}

	return hash % assetCount;
}

function getMentionChildVisual(
	item: RichTextMentionItem,
): RichTextMentionVisual | undefined {
	if (item.visual) {
		return item.visual;
	}

	if (item.category === "human") {
		const nameSlug = item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const matchedByName = PEOPLE_AVATAR_SRCS.find((src) =>
			src.includes(`/avatar-user/${nameSlug}/`),
		);

		return {
			kind: "avatar",
			shape: "circle",
			src:
				matchedByName ??
				PEOPLE_AVATAR_SRCS[
					getStableAssetIndex(`${item.category}:${item.id}`, PEOPLE_AVATAR_SRCS.length)
				],
		};
	}

	if (item.category === "team") {
		return {
			kind: "avatar",
			shape: "square",
			src: TEAM_AVATAR_SRCS[
				getStableAssetIndex(`${item.category}:${item.id}`, TEAM_AVATAR_SRCS.length)
			],
		};
	}

	if (item.category === "subagent") {
		return {
			kind: "avatar",
			shape: "hexagon",
			src: AGENT_AVATAR_SRCS[
				getStableAssetIndex(`${item.category}:${item.id}`, AGENT_AVATAR_SRCS.length)
			],
		};
	}

	return undefined;
}

function buildCategoryMenuItems(
	order: readonly RichTextMentionParentCategory[],
	sources: RichTextMentionSources | undefined,
	labels: Record<RichTextMentionParentCategory, string>,
): readonly RichTextSuggestionMenuItem[] {
	return order.map((category) => ({
		description: `${getCategoryItems(sources, category).length} available`,
		persistentDescription: true,
		icon: category === "people-team"
			? <PeopleGroupIcon label="" size="small" />
			: getCategoryIcon(category),
		id: category,
		label: labels[category],
	}));
}

/** Parent entries for the "@" mention surface: people/teams and subagents. */
export function getMentionTargetItems(
	sources?: RichTextMentionSources,
	labelOverrides?: RichTextMentionSectionLabels,
): readonly RichTextSuggestionMenuItem[] {
	return buildCategoryMenuItems(MENTION_TARGET_ORDER, sources, getMentionParentLabels(labelOverrides));
}

/** Parent entries for the "/" command surface: skills, tools, knowledge. */
export function getSlashCommandCategoryItems(
	sources?: RichTextMentionSources,
	includeFormat = true,
): readonly RichTextSuggestionMenuItem[] {
	return getSlashCategoryOrder(includeFormat).map((category) => ({
		description: category === "format"
			? `${SLASH_COMMANDS.length} options`
			: `${getCategoryItems(sources, category).length} available`,
		persistentDescription: true,
		icon: getSlashCategoryIcon(category),
		id: category,
		label: getSlashCategoryLabel(category),
	}));
}

/** Nested reference items for a single category (e.g. the Skills submenu). */
export function getMentionChildItems(
	sources: RichTextMentionSources | undefined,
	category: RichTextMentionMenuCategory,
): readonly RichTextSuggestionMenuItem[] {
	return getCategoryItems(sources, category).map((item) => {
		const visual = getMentionChildVisual(item);

		return {
			description: getMentionChildDescription(item),
			icon: getCategoryIcon(item.category),
			id: item.id,
			label: item.label,
			leadingVisual: item.category === "subagent" && visual?.kind === "third-party" ? (
				<AgentAvatarVisual
					brandName={visual.name}
					fallbackText={item.label.slice(0, 2).toUpperCase()}
					sizePx={24}
				/>
			) : undefined,
			visual,
		};
	});
}

/** "@" surface sections in mention order: people & team, then subagents. */
const MENTION_FLAT_SECTIONS: readonly { category: RichTextMentionParentCategory; hasDirectory: boolean }[] = [
	{ category: "people-team", hasDirectory: false },
	{ category: "subagent", hasDirectory: true },
];

export function createMentionSuggestionRenderer(
	getMentionSources?: () => RichTextMentionSources | undefined,
	anchorToInput = false,
	variant: SuggestionVariant = "nested",
	labelOverrides?: RichTextMentionSectionLabels,
) {
	const popupState: SuggestionPopupState = { component: null, element: null, cleanup: null };
	let selectedIndex = 0;
	let activeCategory: RichTextMentionParentCategory | null = null;
	let currentProps: SuggestionProps<RichTextMentionItem, RichTextMentionItem> | null = null;
	let previousQuery: string | null = null;
	// Per-section inline expansion for "View more" footers (flat variant only).
	const expandedSections: Record<string, boolean> = {};
	const labels = getMentionParentLabels(labelOverrides);

	const isFlat = variant === "flat";

	function shouldUseFlatSurface(query: string): boolean {
		return isFlat || (!activeCategory && query.trim().length > 0);
	}

	/** Flat surface sections: people & team, then subagents. */
	function getFlatSections(): readonly FlatSectionSpec[] {
		return MENTION_FLAT_SECTIONS.map(({ category, hasDirectory }) => ({
			key: category,
			title: labels[category],
			hasDirectory,
			items: getMentionChildItems(getMentionSources?.(), category),
		}));
	}

	function getParentItems(query: string): readonly RichTextSuggestionMenuItem[] {
		return filterItems(getMentionTargetItems(getMentionSources?.(), labelOverrides), query);
	}

	function getChildItems(query: string): readonly RichTextSuggestionMenuItem[] {
		if (!activeCategory) {
			return [];
		}

		return filterItems(getMentionChildItems(getMentionSources?.(), activeCategory), query);
	}

	function getVisibleItems(
		props: SuggestionProps<RichTextMentionItem, RichTextMentionItem>,
	): readonly RichTextSuggestionMenuItem[] {
		if (shouldUseFlatSurface(props.query)) {
			return buildFlatSurfaceRows(getFlatSections(), props.query, expandedSections, true);
		}
		return activeCategory ? getChildItems(props.query) : getParentItems(props.query);
	}

	/** Clamp/snap the selection onto a selectable row (skips headings). */
	function clampSelectedIndex(
		items: readonly RichTextSuggestionMenuItem[],
		index: number,
	): number {
		if (items.length === 0) {
			return 0;
		}
		const bounded = Math.min(Math.max(index, 0), items.length - 1);
		return isSelectableRow(items[bounded])
			? bounded
			: Math.max(getFirstSelectableIndex(items, bounded), 0);
	}

	function update(props: SuggestionProps<RichTextMentionItem, RichTextMentionItem>) {
		currentProps = props;
		const items = getVisibleItems(props);
		const queryChanged = previousQuery !== props.query;
		previousQuery = props.query;
		const preferredIndex = queryChanged
			? getPreferredSuggestionIndex(items, props.query, isSelectableRow)
			: -1;
		selectedIndex = preferredIndex >= 0
			? preferredIndex
			: clampSelectedIndex(items, selectedIndex);

		// When an "@" filter matches nothing, hide the popup entirely instead of
		// surfacing a "no results" box — the empty composer already signals there
		// are no matches.
		const shouldHidePopup = items.length === 0;
		if (popupState.element) {
			popupState.element.style.display = shouldHidePopup ? "none" : "";
		}
		if (shouldHidePopup) {
			return;
		}

		if (anchorToInput) {
			positionComposerPopup(popupState.element, props.editor.view.dom);
		} else {
			positionPopup(popupState.element, props.clientRect);
		}
		popupState.component?.updateProps({
			emptyLabel: !isFlat && activeCategory ? "No matching items" : "No people or agents found",
			items,
			onBack: !isFlat && activeCategory
				? () => {
						activeCategory = null;
						selectedIndex = 0;
						update(props);
					}
				: undefined,
			onSelect: (item: RichTextSuggestionMenuItem) => selectItem(item),
			onHover: selectIndex,
			selectedIndex,
			title: !isFlat && activeCategory ? labels[activeCategory] : "Mention",
		});
	}

	/** Resolve a mention by id across both "@" parent categories. */
	function findMentionAcrossCategories(id: string): RichTextMentionItem | undefined {
		for (const { category } of MENTION_FLAT_SECTIONS) {
			const mention = getCategoryItems(getMentionSources?.(), category).find(
				(candidate) => candidate.id === id,
			);
			if (mention) {
				return mention;
			}
		}
		return undefined;
	}

	function selectItem(item: RichTextSuggestionMenuItem | undefined): boolean {
		if (!item || !currentProps) {
			return false;
		}

		if (shouldUseFlatSurface(currentProps.query)) {
			// "Browse all" footers link out to a directory we don't host here; keep
			// the menu open. "View more" / "View less" footers toggle the section.
			if (isFlatFooterId(item.id)) {
				const sectionKey = item.id.slice(FLAT_FOOTER_ID_PREFIX.length);
				if (item.label === "View more" || item.label === "View less") {
					expandedSections[sectionKey] = !expandedSections[sectionKey];
					update(currentProps);
				}
				return true;
			}

			const mention = findMentionAcrossCategories(item.id);
			if (!mention) {
				return false;
			}
			currentProps.command(mention);
			return true;
		}

		if (!activeCategory) {
			activeCategory = item.id as RichTextMentionParentCategory;
			selectedIndex = 0;
			update(currentProps);
			return true;
		}

		const mention = getCategoryItems(getMentionSources?.(), activeCategory)
			.find((candidate) => candidate.id === item.id);
		if (!mention) {
			return false;
		}

		currentProps.command(mention);
		return true;
	}

	function moveSelection(direction: -1 | 1, paged: boolean) {
		if (!currentProps) {
			return;
		}
		const items = getVisibleItems(currentProps);
		selectedIndex = paged
			? getPagedSelectableIndex(items, selectedIndex, direction)
			: getNextSelectableIndex(items, selectedIndex, direction);
		update(currentProps);
	}

	/** Pointer hover: move the keyboard selection onto the hovered row. */
	function selectIndex(index: number) {
		if (!currentProps || index === selectedIndex) {
			return;
		}
		selectedIndex = index;
		update(currentProps);
	}

	return {
		onStart: (props: SuggestionProps<RichTextMentionItem, RichTextMentionItem>) => {
			popupState.element = createPopup(anchorToInput);
			popupState.component = new ReactRenderer(RichTextSuggestionMenu, {
				editor: props.editor,
				props: {
					className: "rich-text-command-menu-borderless",
					emptyLabel: "No people or agents found",
					items: getVisibleItems(props),
					onSelect: (item: RichTextSuggestionMenuItem) => selectItem(item),
					selectedIndex,
					title: "Mention",
				},
			});
			popupState.element.appendChild(popupState.component.element);
			update(props);
			if (anchorToInput) {
				popupState.cleanup = attachComposerAnchor(popupState.element, props.editor.view.dom);
			}
		},
		onUpdate: update,
		onKeyDown: ({ event }: SuggestionKeyDownProps) => {
			if (!currentProps) {
				return false;
			}
			const items = getVisibleItems(currentProps);
			if (event.key === "ArrowDown") {
				moveSelection(1, false);
				return true;
			}
			if (event.key === "ArrowUp") {
				moveSelection(-1, false);
				return true;
			}
			if (event.key === "PageDown") {
				moveSelection(1, true);
				return true;
			}
			if (event.key === "PageUp") {
				moveSelection(-1, true);
				return true;
			}
			if (event.key === "Home") {
				selectedIndex = Math.max(getFirstSelectableIndex(items, 0), 0);
				update(currentProps);
				return true;
			}
			if (event.key === "End") {
				selectedIndex = clampSelectedIndex(items, items.length - 1);
				update(currentProps);
				return true;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				return selectItem(items[selectedIndex]);
			}
			if (event.key === "Backspace" && !isFlat && activeCategory) {
				activeCategory = null;
				selectedIndex = 0;
				update(currentProps);
				return true;
			}
			if (event.key === "Escape") {
				return false;
			}
			return false;
		},
		onExit: () => {
			popupState.cleanup?.();
			popupState.cleanup = null;
			popupState.component?.destroy();
			popupState.element?.remove();
			popupState.component = null;
			popupState.element = null;
			currentProps = null;
			selectedIndex = 0;
			activeCategory = null;
			previousQuery = null;
		},
	};
}
