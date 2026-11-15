import {
	getSuggestionOverflowFooterItem,
	type RichTextMentionMenuCategory,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor/menus";

// Flat-section row building shared by the editor palette showcase and the assignee picker.
// Deliberately free of the Tiptap runtime so pickers can render without loading the editor.

/** Max items shown per section before the "Browse all" / "View more" footer. */
const FLAT_SECTION_LIMIT = 5;

/**
 * Sections rendered by the flat variant. `hasDirectory` sections get a
 * "Browse all" footer (ellipsis icon) that links to a dedicated directory;
 * sections without one get a "View more" footer (chevron) that expands the
 * remaining items inline.
 *
 * `"@"` sections each render as their own panel. `"/"` sections are merged into
 * a single panel/menu, separated by section headings, since they share one
 * trigger.
 */
export interface FlatSectionConfig {
	category: RichTextMentionMenuCategory | "format";
	title: string;
	hasDirectory: boolean;
}

export const FLAT_MENTION_SECTIONS = [
	{ category: "people-team", title: "People and team", hasDirectory: false },
	{ category: "subagent", title: "Subagents", hasDirectory: true },
] as const satisfies readonly FlatSectionConfig[];

const FOOTER_ITEM_ID_PREFIX = "__editor-palette-footer__";

export function getSectionFooterId(category: string): string {
	return `${FOOTER_ITEM_ID_PREFIX}${category}`;
}

/**
 * Builds the rows for one flat section: up to five items capped by the limit,
 * plus a sticky footer ("Browse all" for directory-backed sections, "View
 * more" / "View less" for the rest). When `headingLabel` is provided the
 * section leads with a non-interactive heading so several sections can share
 * one merged list.
 */
export function getFlatSectionRows(
	section: FlatSectionConfig,
	items: readonly RichTextSuggestionMenuItem[],
	expanded: boolean,
	headingLabel?: string,
): readonly RichTextSuggestionMenuItem[] {
	const overflowing = items.length > FLAT_SECTION_LIMIT;
	// Directory sections always cap at five and link out via "Browse all".
	// Non-directory sections cap at five but can expand the rest inline.
	const showAll = !section.hasDirectory && expanded;
	const visibleItems = showAll ? items : items.slice(0, FLAT_SECTION_LIMIT);

	const rows: RichTextSuggestionMenuItem[] = [];

	if (headingLabel !== undefined) {
		rows.push({
			id: `${section.category}-heading`,
			label: headingLabel,
			headingLabel,
			icon: null,
		});
	}

	rows.push(...visibleItems);

	if (overflowing) {
		rows.push(
			getSuggestionOverflowFooterItem(
				getSectionFooterId(section.category),
				section.hasDirectory ? "browse-all" : (showAll ? "view-less" : "view-more"),
				{ isSticky: true },
			),
		);
	}

	return rows;
}
