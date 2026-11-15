// Tiptap-free entry for the rich-text command and mention menus. Pickers, selectors and toolbars
// that render a menu without an editor import from here, so the routes that show them do not load
// the editor runtime that the package entry (./index) brings with RichTextEditor and its extensions.
// verify:lazy-load keeps this entry from reaching the editor.
export {
	RichTextSuggestionEmptyState,
	RichTextSuggestionMenu,
} from "./suggestion-menu-view";
export { getMentionChildItems } from "./suggestion-menu-catalog";
export { getSuggestionOverflowFooterItem } from "./suggestion-menu-overflow";
export type {
	RichTextMentionMenuCategory,
	RichTextSuggestionMenuItem,
} from "./suggestion-menu-types";
export { useCommandMenuScrollMask } from "./command-menu-scroll-mask";
export { RichTextMentionVisualMark } from "./mention-visual";
export type {
	RichTextMentionItem,
	RichTextMentionSources,
} from "./types";
export { DropdownMenuSearchField as RichTextCommandMenuSearchField, type DropdownMenuSearchFieldProps as RichTextCommandMenuSearchFieldProps } from "@/components/ui/dropdown-menu";
