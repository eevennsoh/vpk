"use client";

import { useMemo, useState, type KeyboardEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";

import {
	RichTextCommandMenuSearchField,
	RichTextSuggestionMenu,
	getSuggestionOverflowFooterItem,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor/menus";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { RovoColorIcon } from "@/components/ui/logo";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

import { RovoSparkleButton, type RovoSparkleSize } from "./button";

export type RovoSparkleActionKind = "ask-rovo" | "skill" | "agent";
export type RovoSparkleItem = RichTextSuggestionMenuItem;

export interface RovoSparkleSelectedItem {
	id: string;
	label: string;
	description?: string;
	avatarSrc?: string;
}

export type RovoSparkleActionRequest =
	| { kind: "ask-rovo"; prompt: string }
	| { kind: "agent" | "skill"; selectedItem: RovoSparkleSelectedItem };

export interface RovoSparkleProps {
	agents: readonly RovoSparkleItem[];
	align?: "start" | "center" | "end";
	alignOffset?: number;
	ariaLabel?: string;
	defaultOpen?: boolean;
	emptyLabel?: string;
	menuTitle?: string;
	onOpenChange?: (open: boolean) => void;
	onSubmit: (request: RovoSparkleActionRequest) => void | Promise<void>;
	open?: boolean;
	popoverTitle?: string;
	side?: "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
	sideOffset?: number;
	size?: RovoSparkleSize;
	skills: readonly RovoSparkleItem[];
	triggerElement?: ReactElement;
	triggerPortalContainer?: HTMLElement | null;
}

export interface RovoSparkleMenuProps {
	agents: readonly RovoSparkleItem[];
	emptyLabel?: string;
	menuTitle?: string;
	onRequestClose: () => void;
	onSubmit: (request: RovoSparkleActionRequest) => void | Promise<void>;
	skills: readonly RovoSparkleItem[];
}

const SKILLS_HEADING_ID = "rovo-sparkle-skills-heading";
const AGENTS_HEADING_ID = "rovo-sparkle-agents-heading";
const SKILLS_BROWSE_ALL_ID = "rovo-sparkle-skills-browse-all";
const AGENTS_BROWSE_ALL_ID = "rovo-sparkle-agents-browse-all";
const SECTION_LIMIT = 3;

function getSelectedItemMetadata(item: RovoSparkleItem): RovoSparkleSelectedItem {
	return {
		id: item.id,
		label: item.label,
		description: item.description,
		avatarSrc: item.visual?.kind === "avatar" || item.visual?.kind === "image"
			? item.visual.src
			: undefined,
	};
}

function getBrowseAllRow(id: string): RovoSparkleItem {
	return getSuggestionOverflowFooterItem(id, "browse-all");
}

function filterItems(items: readonly RovoSparkleItem[], query: string): readonly RovoSparkleItem[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return items;
	}

	return items.filter((item) => `${item.label} ${item.description ?? ""}`.toLowerCase().includes(normalizedQuery));
}

function getRows(
	agents: readonly RovoSparkleItem[],
	skills: readonly RovoSparkleItem[],
	query: string,
	showAllAgents: boolean,
	showAllSkills: boolean,
): readonly RovoSparkleItem[] {
	const isFiltering = query.trim().length > 0;
	const matchedAgents = filterItems(agents, query);
	const matchedSkills = filterItems(skills, query);
	const visibleAgents = isFiltering || showAllAgents ? matchedAgents : matchedAgents.slice(0, SECTION_LIMIT);
	const visibleSkills = isFiltering || showAllSkills ? matchedSkills : matchedSkills.slice(0, SECTION_LIMIT);

	return [
		...(matchedAgents.length > 0 ? [
			{ id: AGENTS_HEADING_ID, label: "Agents", headingLabel: "Agents", icon: null },
			...visibleAgents,
			...(isFiltering || showAllAgents || agents.length <= SECTION_LIMIT ? [] : [getBrowseAllRow(AGENTS_BROWSE_ALL_ID)]),
		] : []),
		...(matchedSkills.length > 0 ? [
			{ id: SKILLS_HEADING_ID, label: "Skills", headingLabel: "Skills", icon: null },
			...visibleSkills,
			...(isFiltering || showAllSkills || skills.length <= SECTION_LIMIT ? [] : [getBrowseAllRow(SKILLS_BROWSE_ALL_ID)]),
		] : []),
	];
}

function isSelectableRow(item: RovoSparkleItem | undefined): boolean {
	return Boolean(item && item.headingLabel === undefined && !item.disabled);
}

function getNextSelectedIndex(items: readonly RovoSparkleItem[], currentIndex: number, direction: -1 | 1): number {
	if (items.length === 0) {
		return -1;
	}

	const startIndex = currentIndex < 0 ? (direction === 1 ? -1 : 0) : currentIndex;
	for (let step = 1; step <= items.length; step += 1) {
		const index = (startIndex + direction * step + items.length * step) % items.length;
		if (isSelectableRow(items[index])) {
			return index;
		}
	}

	return -1;
}

export function RovoSparkle({
	agents,
	align = "start",
	alignOffset = 0,
	ariaLabel = "Open Rovo actions",
	defaultOpen = false,
	emptyLabel = "No Rovo actions found",
	menuTitle = "Rovo actions",
	onOpenChange,
	onSubmit,
	open,
	popoverTitle = "Rovo actions",
	side = "right",
	sideOffset = 4,
	size = "default",
	skills,
	triggerElement,
	triggerPortalContainer,
}: Readonly<RovoSparkleProps>) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const [menuKey, setMenuKey] = useState(0);
	const resolvedOpen = open ?? internalOpen;

	function handleOpenChange(nextOpen: boolean) {
		if (open === undefined) {
			setInternalOpen(nextOpen);
		}
		if (!nextOpen) {
			setMenuKey((currentKey) => currentKey + 1);
		}
		onOpenChange?.(nextOpen);
	}

	const resolvedTrigger = triggerElement ?? (
		<RovoSparkleButton active={resolvedOpen} aria-label={ariaLabel} size={size} />
	);
	const trigger = <PopoverTrigger render={resolvedTrigger} />;
	const renderedTrigger = triggerPortalContainer ? createPortal(trigger, triggerPortalContainer) : trigger;

	return (
		<Popover onOpenChange={handleOpenChange} open={resolvedOpen}>
			{renderedTrigger}
			<PopoverContent
				align={align}
				alignOffset={alignOffset}
				className="z-[600] w-auto gap-0 border-0 bg-transparent p-0 text-text shadow-none"
				positionerClassName="z-[600]"
				side={side}
				sideOffset={sideOffset}
			>
				<PopoverTitle className="sr-only">{popoverTitle}</PopoverTitle>
				<RovoSparkleMenu
					agents={agents}
					emptyLabel={emptyLabel}
					key={menuKey}
					menuTitle={menuTitle}
					onRequestClose={() => handleOpenChange(false)}
					onSubmit={onSubmit}
					skills={skills}
				/>
			</PopoverContent>
		</Popover>
	);
}

export function RovoSparkleMenu({
	agents,
	emptyLabel = "No Rovo actions found",
	menuTitle = "Rovo actions",
	onRequestClose,
	onSubmit,
	skills,
}: Readonly<RovoSparkleMenuProps>) {
	const [askPrompt, setAskPrompt] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [showAllAgents, setShowAllAgents] = useState(false);
	const [showAllSkills, setShowAllSkills] = useState(false);
	const rows = useMemo(
		() => getRows(agents, skills, askPrompt, showAllAgents, showAllSkills),
		[agents, askPrompt, showAllAgents, showAllSkills, skills],
	);
	const agentIds = useMemo(() => new Set(agents.map((item) => item.id)), [agents]);

	function submitRequest(request: RovoSparkleActionRequest) {
		onRequestClose();
		void onSubmit(request);
	}

	function handleAskPromptChange(value: string) {
		setAskPrompt(value);
		setSelectedIndex(-1);
	}

	function handleAskRovoSubmit() {
		const prompt = askPrompt.trim();
		if (prompt) {
			submitRequest({ kind: "ask-rovo", prompt });
		}
	}

	function handleSelectItem(item: RovoSparkleItem) {
		if (item.id === AGENTS_BROWSE_ALL_ID) {
			setShowAllAgents(true);
			setSelectedIndex(-1);
			return;
		}
		if (item.id === SKILLS_BROWSE_ALL_ID) {
			setShowAllSkills(true);
			setSelectedIndex(-1);
			return;
		}

		submitRequest({
			kind: agentIds.has(item.id) ? "agent" : "skill",
			selectedItem: getSelectedItemMetadata(item),
		});
	}

	function handleMenuKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			setSelectedIndex((currentIndex) => getNextSelectedIndex(rows, currentIndex, event.key === "ArrowDown" ? 1 : -1));
			return;
		}

		if (event.key === "Enter" && isSelectableRow(rows[selectedIndex])) {
			event.preventDefault();
			handleSelectItem(rows[selectedIndex]);
		}
	}

	return (
		<RichTextSuggestionMenu
			className="rich-text-command-menu-borderless rich-text-command-menu-search-selects"
			emptyLabel={emptyLabel}
			emptyState={false}
			header={(
				<RichTextCommandMenuSearchField
					autoFocus
					icon={<RovoColorIcon size="xxsmall" />}
					label="Ask Rovo"
					onClear={() => handleAskPromptChange("")}
					onEscape={onRequestClose}
					onKeyDown={handleMenuKeyDown}
					onSubmit={handleAskRovoSubmit}
					onValueChange={handleAskPromptChange}
					placeholder="Ask Rovo"
					value={askPrompt}
				/>
			)}
			items={rows}
			onHover={setSelectedIndex}
			onSelect={handleSelectItem}
			selectedIndex={selectedIndex}
			title={menuTitle}
		/>
	);
}
