import { getSuggestionOverflowFooterItem } from "./suggestion-menu-overflow";
import type { RichTextSuggestionMenuItem } from "./suggestion-menu-types";
import {
	getSuggestionMatchRank,
	rankSuggestionsByMatch,
} from "./suggestion-ranking";

const SUGGESTION_PAGE_KEY_STEP = 5;

export function filterItems<T extends { label: string; description?: string; isSticky?: boolean }>(
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

/** Max items shown per section (empty query) before the section footer. */
const FLAT_SECTION_LIMIT = 5;

/** Prefix for the synthetic footer rows ("Browse all" / "View more"). */
export const FLAT_FOOTER_ID_PREFIX = "__rich-text-flat-footer__";

function getFlatFooterId(category: string): string {
	return `${FLAT_FOOTER_ID_PREFIX}${category}`;
}

export function isFlatFooterId(id: string): boolean {
	return id.startsWith(FLAT_FOOTER_ID_PREFIX);
}

/** One section of a merged flat surface. */
export interface FlatSectionSpec {
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
export function buildFlatSurfaceRows(
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
export function isSelectableRow(item: RichTextSuggestionMenuItem): boolean {
	return item.headingLabel === undefined && !item.disabled;
}

/** First selectable index at or after `from` (wrapping), or -1 if none. */
export function getFirstSelectableIndex(
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
export function getNextSelectableIndex(
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
export function getPagedSelectableIndex(
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
