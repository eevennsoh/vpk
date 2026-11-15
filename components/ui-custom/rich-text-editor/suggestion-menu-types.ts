import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";

import type { IconTileVariant } from "@/components/ui/icon-tile";

import type {
	RichTextMentionCategory,
	RichTextMentionItem,
	RichTextMentionVisual,
	RichTextSuggestionRowVariant,
} from "./types";

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
	leadingVisualSize?: "compact";
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

export interface RichTextSuggestionMenuProps {
	className?: string;
	rowVariant?: RichTextSuggestionRowVariant;
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

export type RichTextMentionMenuCategory = RichTextMentionCategory | "people-team";
export type RichTextMentionParentCategory = "people-team" | "subagent";

/**
 * A "/" selection is either a basic-block command to run or a reference item to
 * insert as a mention token (the migrated Skills/Tools/Knowledge categories).
 */
export type RichTextSlashAction =
	| { type: "ask-rovo"; onAskRovo?: (editor: Editor) => void }
	| { type: "command"; run: (editor: Editor) => void }
	| { type: "mention"; mention: RichTextMentionItem };

/**
 * Layout for the live suggestion menus. `"flat"` merges every section of a
 * surface into one list separated by headings; `"nested"` keeps the original
 * drill-in category lists.
 */
export type SuggestionVariant = "nested" | "flat";
