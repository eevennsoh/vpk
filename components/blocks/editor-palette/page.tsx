"use client";

// oxlint-disable react-doctor/prefer-module-scope-static-value -- These values are intentionally colocated with the component/demo contract for readability and token context.

import { useRef, useState, type ReactNode } from "react";

import { getSkillConfigLabel } from "@/components/blocks/agent/lib/agent-config-model";
import { Kbd } from "@/components/ui/kbd";
import { RovoColorIcon } from "@/components/ui/logo";
import { SearchIcon } from "@/components/ui/vpk-icons";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import {
	RichTextCommandMenuSearchField,
	RichTextEditor,
	RichTextSuggestionEmptyState,
	RichTextSuggestionMenu,
	getMentionChildItems,
	getMentionTargetItems,
	getSlashCommandCategoryItems,
	getSlashCommandFormatItems,
	getSuggestionOverflowFooterItem,
	type RichTextMentionItem,
	type RichTextMentionMenuCategory,
	type RichTextMentionSources,
	type RichTextSuggestionMenuItem,
	type RichTextSuggestionRowVariant,
} from "@/components/ui-custom/rich-text-editor";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { EDITOR_PALETTE_MENTION_SOURCES } from "./data/mention-sources";

/** How the editor palette lays out its suggestion surfaces. */
export type EditorPaletteVariant = "nested" | "flat" | "search";
export type EditorPaletteSearchCategory = Extract<
	RichTextMentionMenuCategory,
	"app" | "knowledge" | "skill" | "subagent" | "tool"
>;

export interface EditorPaletteProps {
	/** Skill catalog that drives the live editor's "/" Skills submenu counts. */
	mentionSources?: RichTextMentionSources;
	/**
	 * Layout for the showcase menus. `"nested"` (default) shows each top-level
	 * section as a single list you click into. `"flat"` expands every section
	 * inline, capped at five items with a "Browse all" / "View more" footer.
	 * `"search"` shows one category-specific inline search picker.
	 */
	variant?: EditorPaletteVariant;
	/** Compact 36px rows by default, or the original rows with bylines. */
	rowVariant?: RichTextSuggestionRowVariant;
	searchCategory?: EditorPaletteSearchCategory;
	/** Render a live editor where typing "@" or "/" opens the real menus. */
	showLiveEditor?: boolean;
	className?: string;
}

export interface EditorPaletteAssigneePickerProps {
	className?: string;
	mentionSources?: RichTextMentionSources;
	onSelect: (item: RichTextMentionItem) => void;
}

function noop(): void {}

/** Max items shown per section before the "Browse all" / "View more" footer. */
const FLAT_SECTION_LIMIT = 5;

const NESTED_MENTION_SHOWCASES: readonly {
	category: RichTextMentionMenuCategory;
	title: string;
	trigger: "@" | "/";
	caption: string;
}[] = [
	{ category: "people-team", title: "People and team", trigger: "@", caption: "People and team nested" },
	{ category: "subagent", title: "Subagents", trigger: "@", caption: "Subagents nested" },
	{ category: "skill", title: "Skills", trigger: "/", caption: "Skills nested" },
	{ category: "tool", title: "Tools", trigger: "/", caption: "Tools nested" },
	{ category: "knowledge", title: "Knowledge", trigger: "/", caption: "Knowledge nested" },
];

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
interface FlatSectionConfig {
	category: RichTextMentionMenuCategory | "format";
	title: string;
	hasDirectory: boolean;
}

const FLAT_MENTION_SECTIONS = [
	{ category: "people-team", title: "People and team", hasDirectory: false },
	{ category: "subagent", title: "Subagents", hasDirectory: true },
] as const satisfies readonly FlatSectionConfig[];

const FLAT_COMMAND_SECTIONS: readonly FlatSectionConfig[] = [
	{ category: "skill", title: "Skills", hasDirectory: true },
	{ category: "tool", title: "Tools", hasDirectory: true },
	{ category: "knowledge", title: "Knowledge", hasDirectory: true },
	{ category: "format", title: "Format", hasDirectory: false },
];

export default function EditorPalette({
	mentionSources = EDITOR_PALETTE_MENTION_SOURCES,
	searchCategory = "tool",
	variant = "nested",
	rowVariant = "compact",
	showLiveEditor = true,
	className,
}: Readonly<EditorPaletteProps>) {
	return (
		<div
			className={cn("flex w-full max-w-[1440px] flex-col", className)}
			style={{ gap: token("space.400") }}
		>
			{variant === "search" ? (
				<SearchPalette category={searchCategory} mentionSources={mentionSources} rowVariant={rowVariant} />
			) : variant === "flat" ? (
				<FlatPalette mentionSources={mentionSources} rowVariant={rowVariant} />
			) : (
				<NestedPalette mentionSources={mentionSources} rowVariant={rowVariant} />
			)}

			{showLiveEditor ? (
				<div
					className="rounded-lg border border-border bg-surface"
					style={{ padding: token("space.200") }}
				>
					<RichTextEditor
						mentionSources={mentionSources}
						suggestionVariant={variant === "search" ? "flat" : variant}
						suggestionRowVariant={rowVariant}
						placeholder="Type @ to mention people and agents, or / for commands…"
						showToolbar={false}
						showBubbleMenu={false}
						aria-label="Editor palette demo"
						editorClassName="agent-instructions-tiptap-editor"
					/>
				</div>
			) : null}
		</div>
	);
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

interface PaletteVariantProps {
	mentionSources: RichTextMentionSources;
	rowVariant: RichTextSuggestionRowVariant;
}

const SEARCH_CATEGORY_LABELS: Record<EditorPaletteSearchCategory, string> = {
	app: "apps",
	knowledge: "knowledge",
	skill: "skills",
	subagent: "subagents",
	tool: "tools",
};

const SEARCH_BROWSE_ALL_ITEM_ID = "__editor-palette-search-browse-all__";

function getSearchPlaceholder(category: EditorPaletteSearchCategory): string {
	return `Search ${SEARCH_CATEGORY_LABELS[category]}`;
}

function filterSearchItems(
	items: readonly RichTextSuggestionMenuItem[],
	query: string,
): readonly RichTextSuggestionMenuItem[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return items;
	}

	return items.filter((item) => {
		const haystack = `${item.label} ${item.description ?? ""}`.toLowerCase();
		return haystack.includes(normalizedQuery);
	});
}

function normalizeSearchPickerItem(
	item: RichTextSuggestionMenuItem,
): RichTextSuggestionMenuItem {
	return item.persistentDescription
		? { ...item, persistentDescription: false }
		: item;
}

/**
 * Drops rows whose label matches an already-configured value. Skills compare by
 * kebab-case config label; other categories compare case-insensitive trimmed
 * labels. This mirrors the add handler's de-dupe (`appendListValues`), so an
 * item the agent already has never reappears in the inline "Add" search.
 */
function getSearchPickerExcludeKey(category: EditorPaletteSearchCategory, label: string): string {
	return category === "skill" ? getSkillConfigLabel(label) : label.trim().toLowerCase();
}

function excludeItemsByLabel(
	items: readonly RichTextSuggestionMenuItem[],
	category: EditorPaletteSearchCategory,
	excludeLabels: readonly string[],
): readonly RichTextSuggestionMenuItem[] {
	if (excludeLabels.length === 0) {
		return items;
	}

	const excluded = new Set(excludeLabels.map((label) => getSearchPickerExcludeKey(category, label)));
	return items.filter((item) => !excluded.has(getSearchPickerExcludeKey(category, item.label)));
}

export interface EditorPaletteSearchPickerProps {
	autoFocus?: boolean;
	category: EditorPaletteSearchCategory;
	className?: string;
	emptyLabel?: string;
	/**
	 * Labels already configured for this category. Matching rows are dropped from
	 * the searchable list (case-insensitive, trimmed — mirroring the add
	 * handler's de-dupe) so an item the agent already has cannot be added again
	 * from the inline "Add" flyout. `leadingItems` are never excluded.
	 */
	excludeLabels?: readonly string[];
	/**
	 * Explicit rows to search over. When omitted, the picker derives its rows
	 * from `mentionSources` for `category`. Callers pass this to surface a
	 * curated list (e.g. one row per knowledge app) instead of the raw catalog.
	 */
	items?: readonly RichTextSuggestionMenuItem[];
	/**
	 * Sticky rows pinned above the searchable list (e.g. an "Upload files" lead
	 * row). They are not filtered by the query.
	 */
	leadingItems?: readonly RichTextSuggestionMenuItem[];
	mentionSources?: RichTextMentionSources;
	rowVariant?: RichTextSuggestionRowVariant;
	onBrowseAll?: () => void;
	onSelectItem?: (item: RichTextSuggestionMenuItem) => void;
	/**
	 * Keep the picker usable for back-to-back selections: after a (non-browse)
	 * pick, focus is returned to the search field. This matters when the picker
	 * lives inside a popup/menu — selecting a row filters it out (via
	 * `excludeLabels`), unmounting the focused option, which would otherwise let
	 * focus fall to the body and force the surrounding menu to close on focus-out.
	 */
	keepOpenOnSelect?: boolean;
}

export function EditorPaletteSearchPicker({
	autoFocus,
	category,
	className,
	emptyLabel = "No matching items",
	excludeLabels = [],
	items: itemsProp,
	leadingItems = [],
	mentionSources = EDITOR_PALETTE_MENTION_SOURCES,
	rowVariant = "compact",
	onBrowseAll,
	onSelectItem,
	keepOpenOnSelect = false,
}: Readonly<EditorPaletteSearchPickerProps>) {
	const [query, setQuery] = useState("");
	const pickerRef = useRef<HTMLDivElement | null>(null);
	const sourceItems = excludeItemsByLabel(
		(itemsProp ?? getMentionChildItems(mentionSources, category)).map(normalizeSearchPickerItem),
		category,
		excludeLabels,
	);
	const leadingRows = leadingItems.map(normalizeSearchPickerItem);
	const items = filterSearchItems(sourceItems, query);
	const browseAllItem = getSuggestionOverflowFooterItem(
		SEARCH_BROWSE_ALL_ITEM_ID,
		"browse-all",
	);
	const rows = items.length > 0
		? [...leadingRows, ...items, browseAllItem]
		: leadingRows;

	const selectFirstResult = () => {
		const firstItem = items[0] ?? leadingRows[0];
		if (firstItem) {
			onSelectItem?.(firstItem);
		}
	};

	const handleSelect = (item: RichTextSuggestionMenuItem) => {
		if (item.id === SEARCH_BROWSE_ALL_ITEM_ID) {
			onBrowseAll?.();
			return;
		}

		onSelectItem?.(item);

		if (keepOpenOnSelect) {
			// Return focus to the search field synchronously, before React unmounts
			// the just-picked row (it gets filtered out via `excludeLabels`). If
			// focus fell to the body, a surrounding popup/menu would close on
			// focus-out; keeping it on the search field lets the caller add several
			// items in a row and immediately type the next query.
			pickerRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
		}
	};

	return (
		<div ref={pickerRef} className="contents">
			<RichTextSuggestionMenu
				rowVariant={rowVariant}
				className={className}
				title={getSearchPlaceholder(category)}
				emptyLabel={emptyLabel}
				emptyState={
					<RichTextSuggestionEmptyState
						label={emptyLabel}
						onBrowseAll={onBrowseAll}
					/>
				}
				header={(
					<RichTextCommandMenuSearchField
						autoFocus={autoFocus}
						icon={<SearchIcon className="size-4 text-icon-subtle" />}
						label={getSearchPlaceholder(category)}
						onClear={() => setQuery("")}
						onSubmit={selectFirstResult}
						onValueChange={setQuery}
						value={query}
					/>
				)}
				items={rows}
				onSelect={handleSelect}
				selectedIndex={-1}
			/>
		</div>
	);
}

interface SearchPaletteProps extends PaletteVariantProps {
	category: EditorPaletteSearchCategory;
}

function SearchPalette({ category, mentionSources, rowVariant }: Readonly<SearchPaletteProps>) {
	return (
		<div
			className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start justify-items-center"
			style={{ gap: token("space.300") }}
		>
			<PalettePanel caption={getSearchPlaceholder(category)}>
				<EditorPaletteSearchPicker
					category={category}
					className="rich-text-command-menu-borderless rich-text-command-menu-showcase"
					mentionSources={mentionSources}
					rowVariant={rowVariant}
				/>
			</PalettePanel>
		</div>
	);
}

function NestedPalette({ mentionSources, rowVariant }: Readonly<PaletteVariantProps>) {
	const [commandPrompt, setCommandPrompt] = useState("");
	const mentionItems = getMentionTargetItems(mentionSources);
	const commandItems = getSlashCommandCategoryItems(mentionSources);
	const formatItems = getSlashCommandFormatItems();

	return (
		<div
			className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start justify-items-center"
			style={{ gap: token("space.300") }}
		>
			<PalettePanel trigger="@" caption="Mention">
				<RichTextSuggestionMenu
					rowVariant={rowVariant}
					className="rich-text-command-menu-borderless rich-text-command-menu-showcase"
					title="Mention"
					emptyLabel="No people or agents found"
					items={mentionItems}
					selectedIndex={0}
					onSelect={noop}
				/>
			</PalettePanel>

			<PalettePanel trigger="/" caption="Commands">
				<RichTextSuggestionMenu
					rowVariant={rowVariant}
					className="rich-text-command-menu-borderless rich-text-command-menu-showcase"
					title="Commands"
					emptyLabel="No commands found"
					items={commandItems}
					header={(
						<RichTextCommandMenuSearchField
							icon={ASK_ROVO_LEAD_ITEM.icon}
							label={ASK_ROVO_LEAD_ITEM.label}
							onClear={() => setCommandPrompt("")}
							onSubmit={noop}
							onValueChange={setCommandPrompt}
							placeholder={ASK_ROVO_LEAD_ITEM.label}
							value={commandPrompt}
						/>
					)}
					selectedIndex={0}
					onSelect={noop}
				/>
			</PalettePanel>

			{NESTED_MENTION_SHOWCASES.map(({ category, caption, title, trigger }) => (
				<PalettePanel key={category} trigger={trigger} caption={caption}>
					<RichTextSuggestionMenu
						rowVariant={rowVariant}
						className="rich-text-command-menu-borderless rich-text-command-menu-showcase"
						title={title}
						emptyLabel="No matching items"
						items={getMentionChildItems(mentionSources, category)}
						selectedIndex={0}
						onBack={noop}
						onSelect={noop}
					/>
				</PalettePanel>
			))}

			<PalettePanel trigger="/" caption="Format nested">
				<RichTextSuggestionMenu
					rowVariant={rowVariant}
					className="rich-text-command-menu-borderless rich-text-command-menu-showcase"
					title="Format"
					emptyLabel="No matching items"
					items={formatItems}
					selectedIndex={0}
					onBack={noop}
					onSelect={noop}
				/>
			</PalettePanel>
		</div>
	);
}

function getFlatSectionItems(
	mentionSources: RichTextMentionSources,
	category: RichTextMentionMenuCategory | "format",
): readonly RichTextSuggestionMenuItem[] {
	return category === "format"
		? getSlashCommandFormatItems()
		: getMentionChildItems(mentionSources, category);
}

const FOOTER_ITEM_ID_PREFIX = "__editor-palette-footer__";

function getSectionFooterId(category: string): string {
	return `${FOOTER_ITEM_ID_PREFIX}${category}`;
}

/**
 * Builds the rows for one flat section: up to five items capped by the limit,
 * plus a sticky footer ("Browse all" for directory-backed sections, "View
 * more" / "View less" for the rest). When `headingLabel` is provided the
 * section leads with a non-interactive heading so several sections can share
 * one merged list.
 */
function getFlatSectionRows(
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

/**
 * Sticky "Ask Rovo" prompt for the "/" surface, rendered as the menu header
 * input. The "@" surface has no equivalent.
 */
const ASK_ROVO_LEAD_ITEM: RichTextSuggestionMenuItem = {
	id: "ask-rovo",
	label: "Ask Rovo",
	description: "Ask Rovo to help with the current editor context.",
	icon: <RovoColorIcon size="xxsmall" />,
	isSticky: true,
};

function FlatPalette({ mentionSources, rowVariant }: Readonly<PaletteVariantProps>) {
	return (
		<div
			className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start justify-items-center"
			style={{ gap: token("space.300") }}
		>
			<FlatMergedPanel
				trigger="@"
				caption="Mention"
				sections={FLAT_MENTION_SECTIONS}
				mentionSources={mentionSources}
				rowVariant={rowVariant}
			/>

			<FlatMergedPanel
				trigger="/"
				caption="Commands"
				sections={FLAT_COMMAND_SECTIONS}
				mentionSources={mentionSources}
				rowVariant={rowVariant}
				leadItem={ASK_ROVO_LEAD_ITEM}
			/>
		</div>
	);
}

interface FlatMergedPanelProps extends PaletteVariantProps {
	trigger: "@" | "/";
	caption: string;
	sections: readonly FlatSectionConfig[];
	/**
	 * Optional sticky lead prompt (e.g. "Ask Rovo") rendered as the menu header
	 * input before the section list.
	 */
	leadItem?: RichTextSuggestionMenuItem;
}

/**
 * A flat surface: every section is merged into one list, each preceded by a
 * section heading and capped at five items with its own "Browse all" / "View
 * more" footer. Used by both the "@" (Mention) and "/" (Commands) surfaces.
 */
function FlatMergedPanel({
	trigger,
	caption,
	sections,
	mentionSources,
	rowVariant,
	leadItem,
}: Readonly<FlatMergedPanelProps>) {
	const [expandedSections, setExpandedSections] = useState<Readonly<Record<string, boolean>>>({});
	const [leadPrompt, setLeadPrompt] = useState("");

	const rows = [
		...sections.flatMap((section) =>
			getFlatSectionRows(
				section,
				getFlatSectionItems(mentionSources, section.category),
				Boolean(expandedSections[section.category]),
				section.title,
			),
		),
	];

	const handleSelect = (item: RichTextSuggestionMenuItem) => {
		const section = sections.find(
			(candidate) => item.id === getSectionFooterId(candidate.category),
		);
		if (section && !section.hasDirectory) {
			setExpandedSections((value) => ({
				...value,
				[section.category]: !value[section.category],
			}));
		}
	};

	return (
		<PalettePanel trigger={trigger} caption={caption}>
			<RichTextSuggestionMenu
				rowVariant={rowVariant}
				className="rich-text-command-menu-borderless rich-text-command-menu-showcase"
				title={caption}
				emptyLabel="No matching items"
				items={rows}
				header={leadItem ? (
					<RichTextCommandMenuSearchField
						icon={leadItem.icon}
						label={leadItem.label}
						onClear={() => setLeadPrompt("")}
						onSubmit={() => handleSelect(leadItem)}
						onValueChange={setLeadPrompt}
						placeholder={leadItem.label}
						value={leadPrompt}
					/>
				) : undefined}
				selectedIndex={-1}
				onSelect={handleSelect}
			/>
		</PalettePanel>
	);
}

interface PalettePanelProps {
	trigger?: string;
	caption: string;
	children: ReactNode;
}

function PalettePanel({ trigger, caption, children }: Readonly<PalettePanelProps>) {
	return (
		<figure className="m-0 flex flex-col" style={{ gap: token("space.100") }}>
			<figcaption className="flex items-center" style={{ gap: token("space.100") }}>
				{trigger ? <Kbd>{trigger}</Kbd> : null}
				<span className="text-sm font-medium text-text">{caption}</span>
			</figcaption>
			{children}
		</figure>
	);
}
