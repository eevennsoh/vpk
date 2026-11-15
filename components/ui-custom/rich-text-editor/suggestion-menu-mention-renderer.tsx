import { ReactRenderer } from "@tiptap/react";
import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";

import {
	getCategoryItems,
	getMentionChildItems,
	getMentionParentLabels,
	getMentionTargetItems,
} from "./suggestion-menu-catalog";
import {
	attachComposerAnchor,
	createPopup,
	positionComposerPopup,
	positionPopup,
	type SuggestionPopupState,
} from "./suggestion-menu-popup";
import {
	FLAT_FOOTER_ID_PREFIX,
	buildFlatSurfaceRows,
	filterItems,
	getFirstSelectableIndex,
	getNextSelectableIndex,
	getPagedSelectableIndex,
	isFlatFooterId,
	isSelectableRow,
	type FlatSectionSpec,
} from "./suggestion-menu-rows";
import { getPreferredSuggestionIndex } from "./suggestion-ranking";
import type {
	RichTextMentionParentCategory,
	RichTextSuggestionMenuItem,
	SuggestionVariant,
} from "./suggestion-menu-types";
import { RichTextSuggestionMenu } from "./suggestion-menu-view";
import type {
	RichTextMentionItem,
	RichTextMentionSectionLabels,
	RichTextMentionSources,
	RichTextSuggestionRowVariant,
} from "./types";

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
	rowVariant?: RichTextSuggestionRowVariant,
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
					rowVariant,
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
