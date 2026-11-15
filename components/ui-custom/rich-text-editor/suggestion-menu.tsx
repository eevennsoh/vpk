"use client";

/**
 * Public entry for the rich-text suggestion menus ("/" commands and "@"
 * mentions). The implementation is split by concern:
 *
 * - `suggestion-menu-types.ts` — item, props, and action contracts
 * - `suggestion-menu-view.tsx` — the rendered menu, rows, and empty state
 * - `suggestion-menu-overflow.tsx` — "Browse all" / "View more" footer rows
 * - `suggestion-menu-slash-commands.tsx` — the "/" Format command catalog
 * - `suggestion-menu-catalog.tsx` — mention sources and category entries
 * - `suggestion-menu-rows.ts` — filtering, flat sections, and selection math
 * - `suggestion-menu-popup.ts` — caret and composer-anchored popup placement
 * - `suggestion-menu-slash-renderer.tsx` / `suggestion-menu-mention-renderer.tsx`
 *   — the Tiptap suggestion render lifecycles
 */

export type {
	RichTextCommandItem,
	RichTextMentionMenuCategory,
	RichTextSlashAction,
	RichTextSuggestionMenuHoverActions,
	RichTextSuggestionMenuItem,
} from "./suggestion-menu-types";
export {
	getSuggestionOverflowFooterItem,
	type SuggestionOverflowFooterKind,
} from "./suggestion-menu-overflow";
export {
	SLASH_COMMANDS,
	getSlashCommandFormatItems,
} from "./suggestion-menu-slash-commands";
export {
	getMentionChildItems,
	getMentionTargetItems,
	getSlashCommandCategoryItems,
} from "./suggestion-menu-catalog";
export {
	RichTextSuggestionEmptyState,
	RichTextSuggestionMenu,
} from "./suggestion-menu-view";
export { createSlashSuggestionRenderer } from "./suggestion-menu-slash-renderer";
export { createMentionSuggestionRenderer } from "./suggestion-menu-mention-renderer";
