"use client";

import type { ReactNode } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type {
	SuggestionKeyDownProps,
	SuggestionProps,
} from "@tiptap/suggestion";

import { DropdownMenuSearchField as RichTextCommandMenuSearchField } from "@/components/ui/dropdown-menu";

import {
	ASK_ROVO_SLASH_ITEM,
	getCategoryItems,
	getMentionChildItems,
	getSlashCategoryLabel,
	getSlashCategoryOrder,
	getSlashCommandCategoryItems,
	isSlashCategoryId,
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
import {
	SLASH_COMMANDS,
	getSlashCommandFormatItems,
} from "./suggestion-menu-slash-commands";
import type {
	RichTextSlashAction,
	RichTextSuggestionMenuItem,
	SuggestionVariant,
} from "./suggestion-menu-types";
import {
	RichTextSuggestionEmptyState,
	RichTextSuggestionMenu,
} from "./suggestion-menu-view";
import type {
	RichTextMentionItem,
	RichTextMentionSources,
	RichTextSlashCategory,
	RichTextSuggestionRowVariant,
} from "./types";

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
	rowVariant?: RichTextSuggestionRowVariant,
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
					rowVariant,
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
