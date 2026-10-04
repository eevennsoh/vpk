"use client";

// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import {
	type Dispatch,
	type KeyboardEvent,
	useMemo,
	useState,
	type MouseEvent,
	type SetStateAction,
} from "react";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CrossIcon from "@atlaskit/icon/core/cross";
import DeleteIcon from "@atlaskit/icon/core/delete";
import DownloadIcon from "@atlaskit/icon/core/download";
import LinkIcon from "@atlaskit/icon/core/link";
import SearchIcon from "@atlaskit/icon/core/search";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StarUnstarredIcon from "@atlaskit/icon/core/star-unstarred";

import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import {
	ExperimentalDirectorySection,
	ExperimentalDirectoryView,
	toggleSelectedValue,
	type ExperimentalDirectoryFacet,
	type ExperimentalDirectoryFilterOption,
} from "@/components/blocks/directory-shared/experimental-directory-view";
import {
	Agent,
	AgentConfigFields,
	AgentContent,
} from "@/components/blocks/skill-config";
import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/ui-custom/file-tree";
import {
	SkillProfileCover,
	SkillProfileMeta,
	useSkillMdDraft,
	type SkillMdDraft,
} from "./skill-md-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import { Switch } from "@/components/ui/switch";
import {
	EntityCardSkillCard,
	type EntityCardSource,
} from "@/components/ui-custom/entity-card";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { cn } from "@/lib/utils";

import {
	frontmatterValueToString,
	getFrontmatterField,
	parseSkillMd,
} from "@/app/data/directory/skill-frontmatter";
import { SkillsDirectorySidebar } from "./skills-directory-sidebar";
import { useSkillsDirectoryView } from "../hooks/use-skills-directory-view";
import {
	DEFAULT_SKILLS,
	getSkillCategoryId,
	getSkillCollection,
	getSkillCollectionId,
	getSkillIcon,
	getSkillIconTileVariant,
	getSkillMarkdown,
	getSkillPublisherAvatarSrc,
	getSkillPublisherLogoName,
	getSkillPublisherName,
	isSkillPublisherPerson,
	slugifySkillName,
	type SkillCategory,
	type SkillsDirectoryFileTreeItem,
	type SkillsDirectorySkill,
} from "@/app/data/directory/skills";
import {
	DEFAULT_SKILLS_DIRECTORY_PRIMARY_ITEMS,
	DEFAULT_SKILLS_DIRECTORY_SIDEBAR_GROUPS,
	type SkillsDirectoryPrimaryItem,
	type SkillsDirectorySidebarGroup,
} from "../data/sidebar-groups";

export type SkillsDirectoryAgent = AgentBrowserAgent;
export type SkillsDirectorySelectionExperience = "checkbox-actions" | "studio-bulk-add" | "chat-single-add";
export type SkillsDirectoryVariant = "default" | "experimental";
export type { SkillsDirectorySkill } from "@/app/data/directory/skills";
export type {
	SkillsDirectoryPrimaryItem,
	SkillsDirectorySidebarGroup,
} from "../data/sidebar-groups";

export interface SkillsDirectoryDialogProps {
	/**
	 * Skills already added to the agent, as ids. Drives the persistent "added"
	 * check on each card so committed skills can be scanned at a glance. Distinct
	 * from `selectedSkillIds`, which is the in-dialog multi-select (checkbox) set.
	 */
	addedSkillIds?: readonly string[];
	agents?: readonly SkillsDirectoryAgent[];
	defaultSelectedSkillIds?: readonly string[];
	/**
	 * Opens the dialog directly on this skill's detail/config view (the SKILL.md
	 * editor) instead of the browse grid. Used when a configured Skills chip is
	 * clicked to jump straight to that skill. Reapplied on each open or when this
	 * value changes; browse navigation and filters remain owned by the dialog.
	 */
	initialDetailSkillId?: string | null;
	/**
	 * When the dialog is opened directly on a skill's detail/config view, exiting
	 * that view (Back or the config's Cancel) closes the whole dialog instead of
	 * returning to the browse grid. Use when there is no meaningful grid to return
	 * to (e.g. a generated-skill config opened from a chat card).
	 */
	closeOnDetailExit?: boolean;
	onAddSkills?: (skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => void;
	onCreateShareLink?: (skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => void;
	onCreateSkill?: () => void;
	/**
	 * Ids of skills currently disabled on the agent. When provided, the detail
	 * header's disable Switch is controlled by this set (and `onToggleSkillEnabled`);
	 * omit it to let the dialog manage a local, uncontrolled disabled state.
	 */
	disabledSkillIds?: readonly string[];
	onDownloadSkills?: (skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => void;
	onFavoriteSkills?: (skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => void;
	onNewSkill?: () => void;
	onOpenChange: (open: boolean) => void;
	onOpenSkill?: (skill: SkillsDirectorySkill) => void;
	/** Removes a skill from the agent (fired by the detail header's "Remove" button). */
	onRemoveSkills?: (skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => void;
	/** Toggles a skill's enabled state on the agent (fired by the detail header Switch). */
	onToggleSkillEnabled?: (skill: SkillsDirectorySkill, enabled: boolean) => void;
	onSelectAgent?: (agent: SkillsDirectoryAgent) => void;
	onSelectedSkillIdsChange?: (skillIds: readonly string[]) => void;
	onSelectSkill?: (skill: SkillsDirectorySkill) => void;
	open: boolean;
	primaryItems?: readonly SkillsDirectoryPrimaryItem[];
	selectedSkillIds?: readonly string[];
	/**
	 * Controls how browse-grid card clicks and selected-skill actions behave.
	 * - `checkbox-actions`: legacy multi-select checkbox/actions flow.
	 * - `studio-bulk-add`: card switch/click immediately adds or removes the skill.
	 * - `chat-single-add`: card immediately adds one skill to the chat prompt.
	 */
	selectionExperience?: SkillsDirectorySelectionExperience;
	sessionAgents?: readonly SkillsDirectoryAgent[];
	sessionSkills?: readonly SkillsDirectorySkill[];
	sidebarGroups?: readonly SkillsDirectorySidebarGroup[];
	skills?: readonly SkillsDirectorySkill[];
	title?: string;
	/**
	 * Opt-in layout variation. `"default"` keeps the left-sidebar directory.
	 * `"experimental"` drops the sidebar and moves user/company filters into a
	 * horizontal row above a flat, scroll-masked grid.
	 */
	variant?: SkillsDirectoryVariant;
}

const EMPTY_SKILLS: readonly SkillsDirectorySkill[] = [];
const EMPTY_AGENTS: readonly SkillsDirectoryAgent[] = [];
const PRIMARY_ITEM_ALIASES: Record<string, string> = {
	all: "all-skills",
	"my-skills": "your-skills",
};

function deriveAgentPublisher(agent: SkillsDirectoryAgent): string {
	const match = /\bby\s+(.+)$/i.exec(agent.byline);
	return (match?.[1] ?? agent.byline).trim();
}

function normalizeAgentSkill(agent: SkillsDirectoryAgent): SkillsDirectorySkill {
	return {
		id: agent.id,
		name: agent.name,
		description: agent.description ?? agent.byline,
		icon: "page",
		collectionId: "software",
		publisherName: deriveAgentPublisher(agent),
		publisherAvatarSrc: agent.avatarSrc,
		companyId: agent.attributionKind === "person" || agent.attributionKind === "team" ? "you" : undefined,
		categoryId: "software-development",
		starCount: 0,
		teammateCount: 0,
	};
}

function normalizeActiveItem(item: string): string {
	return PRIMARY_ITEM_ALIASES[item] ?? item;
}

function isYourSkill(skill: SkillsDirectorySkill): boolean {
	const publisher = (skill.publisherName ?? skill.publisher ?? "").trim().toLowerCase();
	return skill.companyId === "you" || publisher === "by you" || publisher === "you";
}

function isCategoryItem(value: string): value is SkillCategory {
	return [
		"project-management",
		"administrative-tools",
		"content-and-communication",
		"data-and-analytics",
		"software-development",
		"it-support-and-service",
		"design-and-diagramming",
		"security-and-compliance",
		"hr-and-team-building",
		"sales-and-customer-relations",
	].includes(value);
}

function isCollectionItem(value: string): boolean {
	return [
		"teamwork",
		"strategy",
		"service",
		"software",
		"product",
		"platform",
		"marketplace",
		"custom",
		"default",
	].includes(value);
}

function filterSkills(
	skills: readonly SkillsDirectorySkill[],
	query: string,
	activeItem: string,
): readonly SkillsDirectorySkill[] {
	const normalizedQuery = query.trim().toLowerCase();
	const normalizedActiveItem = normalizeActiveItem(activeItem);

	return skills.filter((skill) => {
		if (normalizedActiveItem === "favorite-skills" && !skill.favorite) return false;
		if (normalizedActiveItem === "your-skills" && !isYourSkill(skill)) return false;
		if (isCollectionItem(normalizedActiveItem) && getSkillCollectionId(skill) !== normalizedActiveItem) return false;
		if (isCategoryItem(normalizedActiveItem) && getSkillCategoryId(skill) !== normalizedActiveItem) return false;
		if (
			normalizedActiveItem !== "all-skills" &&
			normalizedActiveItem !== "favorite-skills" &&
			normalizedActiveItem !== "your-skills" &&
			!isCollectionItem(normalizedActiveItem) &&
			!isCategoryItem(normalizedActiveItem) &&
			skill.companyId !== normalizedActiveItem
		) {
			return false;
		}

		if (!normalizedQuery) return true;

		const haystack = [
			skill.name,
			skill.description,
			getSkillPublisherName(skill),
			getSkillCategoryId(skill),
			getSkillCollection(skill).label,
			getSkillCollection(skill).description,
			skill.collectionDescription,
			skill.collectionProducts?.join(" "),
			skill.companyId,
			...(skill.tools ?? []).map((tool) => tool.name),
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		return haystack.includes(normalizedQuery);
	});
}

function getSelectedSkills(
	skills: readonly SkillsDirectorySkill[],
	selectedIds: readonly string[],
): readonly SkillsDirectorySkill[] {
	return selectedIds
		.map((id) => skills.find((skill) => skill.id === id))
		.filter((skill): skill is SkillsDirectorySkill => Boolean(skill));
}

function getDefaultFileTree(skill: SkillsDirectorySkill): readonly SkillsDirectoryFileTreeItem[] {
	const slug = slugifySkillName(skill.name);
	return [
		{ id: "root", label: slug, kind: "folder", expanded: true },
		{ id: "skill-md", label: "SKILL.md", kind: "file", depth: 1, selected: true },
		{ id: "license", label: "LICENSE.txt", kind: "file", depth: 1 },
		{ id: "references", label: "references", kind: "folder", depth: 1 },
		{ id: "scripts", label: "scripts", kind: "folder", depth: 1 },
	];
}

export function SkillsDirectoryDialog({
	addedSkillIds,
	agents,
	defaultSelectedSkillIds = [],
	disabledSkillIds,
	initialDetailSkillId = null,
	closeOnDetailExit = false,
	onAddSkills,
	onCreateShareLink,
	onCreateSkill,
	onDownloadSkills,
	onFavoriteSkills,
	onNewSkill,
	onOpenChange,
	onOpenSkill,
	onRemoveSkills,
	onToggleSkillEnabled,
	onSelectAgent,
	onSelectedSkillIdsChange,
	onSelectSkill,
	open,
	primaryItems = DEFAULT_SKILLS_DIRECTORY_PRIMARY_ITEMS,
	selectedSkillIds,
	selectionExperience = "checkbox-actions",
	sessionAgents = EMPTY_AGENTS,
	sessionSkills = EMPTY_SKILLS,
	sidebarGroups = DEFAULT_SKILLS_DIRECTORY_SIDEBAR_GROUPS,
	skills,
	title = "Browse all",
	variant = "default",
}: Readonly<SkillsDirectoryDialogProps>) {
	const baseSkills = useMemo(
		() => skills ?? agents?.map(normalizeAgentSkill) ?? DEFAULT_SKILLS,
		[agents, skills],
	);
	const agentBySkillId = useMemo(() => new Map((agents ?? EMPTY_AGENTS).map((agent) => [agent.id, agent])), [agents]);
	const normalizedSessionSkills = useMemo(
		() => [...sessionSkills, ...sessionAgents.map(normalizeAgentSkill)],
		[sessionAgents, sessionSkills],
	);
	const [activeItem, setActiveItem] = useState<string>(primaryItems[0]?.id ?? "all-skills");
	const [query, setQuery] = useState("");
	// Experimental-variant filters live on the dialog (not inside
	// ExperimentalSkillsDirectoryView) so they survive Learn more → Back; the view
	// unmounts while the detail page shows, mirroring how activeItem persists.
	const [experimentalYourSkills, setExperimentalYourSkills] = useState(false);
	const [experimentalAddedSkills, setExperimentalAddedSkills] = useState(false);
	const [experimentalFavourites, setExperimentalFavourites] = useState(false);
	const [experimentalCompanies, setExperimentalCompanies] = useState<readonly string[]>([]);
	const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
	const directorySkills = useMemo(
		() => [...baseSkills, ...normalizedSessionSkills].map((skill) => (
			skill.id in favoriteOverrides ? { ...skill, favorite: favoriteOverrides[skill.id] } : skill
		)),
		[baseSkills, favoriteOverrides, normalizedSessionSkills],
	);
	const [selectedDetailSkillId, setSelectedDetailSkillId] = useSkillsDirectoryView(open, initialDetailSkillId);
	const [uncontrolledSelectedIds, setUncontrolledSelectedIds] = useState<readonly string[]>(defaultSelectedSkillIds);
	// Per-skill enable/disable state for the detail view — mirrors the agent
	// config toggle, where a configured skill can be parked disabled while staying
	// on the agent until explicitly removed. Controlled by `disabledSkillIds` when
	// the host wires it to the agent config; otherwise a local set (demo use). Keyed
	// by skill id.
	const [uncontrolledDisabledIds, setUncontrolledDisabledIds] = useState<readonly string[]>([]);
	const controlledDisabled = typeof disabledSkillIds !== "undefined";
	const resolvedDisabledIds = controlledDisabled ? disabledSkillIds : uncontrolledDisabledIds;
	const disabledIdSet = useMemo(() => new Set(resolvedDisabledIds), [resolvedDisabledIds]);
	const controlledSelection = typeof selectedSkillIds !== "undefined";
	const resolvedSelectedIds = controlledSelection ? selectedSkillIds : uncontrolledSelectedIds;
	const selectedIdSet = useMemo(() => new Set(resolvedSelectedIds), [resolvedSelectedIds]);
	const addedIdSet = useMemo(() => new Set(addedSkillIds ?? []), [addedSkillIds]);
	const selectedSkills = useMemo(
		() => getSelectedSkills(directorySkills, resolvedSelectedIds),
		[directorySkills, resolvedSelectedIds],
	);
	const selectedFooterCount = resolvedSelectedIds.length;
	const showSelectedSkillsFooter = selectedFooterCount > 0;
	const selectedDetailSkill = selectedDetailSkillId
		? directorySkills.find((skill) => skill.id === selectedDetailSkillId) ?? null
		: null;
	const filteredSkills = useMemo(
		() => filterSkills(directorySkills, query, activeItem),
		[directorySkills, query, activeItem],
	);

	function commitSelectedIds(nextIds: readonly string[]): void {
		if (!controlledSelection) {
			setUncontrolledSelectedIds(nextIds);
		}

		onSelectedSkillIdsChange?.(nextIds);
	}

	function handleOpenChange(nextOpen: boolean): void {
		if (!nextOpen) {
			setSelectedDetailSkillId(null);
		}

		onOpenChange(nextOpen);
	}

	/** Leaving the detail view: close the dialog when opened directly on it,
	 *  otherwise return to the browse grid. */
	function handleExitDetail(): void {
		if (closeOnDetailExit) {
			handleOpenChange(false);
			return;
		}
		setSelectedDetailSkillId(null);
	}

	function handleToggleSelectedSkill(skill: SkillsDirectorySkill, checked?: boolean): void {
		const nextSelectedIdSet = new Set(resolvedSelectedIds);
		const nextChecked = checked ?? !nextSelectedIdSet.has(skill.id);

		if (nextChecked) {
			nextSelectedIdSet.add(skill.id);
		} else {
			nextSelectedIdSet.delete(skill.id);
		}

		const nextIds = directorySkills
			.filter((candidate) => nextSelectedIdSet.has(candidate.id))
			.map((candidate) => candidate.id);

		commitSelectedIds(nextIds);
		notifySkillSelected(skill);
	}

	function notifySkillSelected(skill: SkillsDirectorySkill): void {
		onSelectSkill?.(skill);

		const agent = agentBySkillId.get(skill.id);
		if (agent) {
			onSelectAgent?.(agent);
		}
	}

	function handleToggleAddedSkill(skill: SkillsDirectorySkill, checked: boolean): void {
		if (checked) {
			onAddSkills?.([skill.id], [skill]);
		} else {
			commitSelectedIds(resolvedSelectedIds.filter((id) => id !== skill.id));
			if (!controlledDisabled) {
				setUncontrolledDisabledIds((current) => current.filter((id) => id !== skill.id));
			}
			onRemoveSkills?.([skill.id], [skill]);
		}
		notifySkillSelected(skill);
	}

	function handleCardSelectSkill(skill: SkillsDirectorySkill): void {
		if (selectionExperience === "chat-single-add") {
			onAddSkills?.([skill.id], [skill]);
			onSelectSkill?.(skill);
			handleOpenChange(false);
		}
	}

	function handleToggleFavoriteSkill(skill: SkillsDirectorySkill): void {
		setFavoriteOverrides((current) => ({
			...current,
			[skill.id]: !skill.favorite,
		}));
	}

	function handleSelectedSkillsAdd(): void {
		handleBulkAction(onAddSkills);
		commitSelectedIds([]);
	}

	function handleBulkAction(
		callback?: (skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => void,
	): void {
		callback?.(resolvedSelectedIds, selectedSkills);
	}

	function handleSingleSkillAction(
		skill: SkillsDirectorySkill,
		callback?: (skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => void,
	): void {
		callback?.([skill.id], [skill]);
	}

	function handleToggleSkillEnabled(skill: SkillsDirectorySkill, enabled: boolean): void {
		// Prefer the host-controlled callback (wires to the agent config); fall back
		// to the local uncontrolled set when no callback is supplied.
		if (onToggleSkillEnabled) {
			onToggleSkillEnabled(skill, enabled);
		}
		if (!controlledDisabled) {
			setUncontrolledDisabledIds((current) => {
				const next = new Set(current);
				if (enabled) {
					next.delete(skill.id);
				} else {
					next.add(skill.id);
				}
				return [...next];
			});
		}
	}

	function handleRemoveSkill(skill: SkillsDirectorySkill): void {
		// Drop the skill from the active selection, clear any local disabled state,
		// notify the host so it can update the agent config, then return to the list.
		commitSelectedIds(resolvedSelectedIds.filter((id) => id !== skill.id));
		if (!controlledDisabled) {
			setUncontrolledDisabledIds((current) => current.filter((id) => id !== skill.id));
		}
		onRemoveSkills?.([skill.id], [skill]);
		setSelectedDetailSkillId(null);
	}

	function handleAddSkill(skill: SkillsDirectorySkill): void {
		// Notify the host so it can add the skill to the agent config. The detail
		// stays open so the header flips to its added state (Remove + Switch).
		onAddSkills?.([skill.id], [skill]);
	}

	const createSkillHandler = onCreateSkill ?? onNewSkill;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="grid h-[min(800px,calc(100svh-2rem))] max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[1200px]"
				showCloseButton={false}
			>
				{selectedDetailSkill ? (
					<SkillDetailHeader
						addLabel={selectionExperience === "chat-single-add" ? "Try in chat" : "Add to agent"}
						added={addedIdSet.has(selectedDetailSkill.id)}
						enabled={!disabledIdSet.has(selectedDetailSkill.id)}
						onBack={handleExitDetail}
						onCreateShareLink={() => handleBulkAction(onCreateShareLink)}
						onDownloadSkills={() => handleBulkAction(onDownloadSkills)}
						onFavoriteSkills={() => handleBulkAction(onFavoriteSkills)}
						onOpenSkill={() => onOpenSkill?.(selectedDetailSkill)}
						onRemove={() => handleRemoveSkill(selectedDetailSkill)}
						onToggleEnabled={(enabled) => handleToggleSkillEnabled(selectedDetailSkill, enabled)}
						onAdd={() => handleAddSkill(selectedDetailSkill)}
						showTryInChatAction={selectionExperience === "chat-single-add"}
						title={selectedDetailSkill.name}
					/>
				) : (
					<SkillsDirectoryHeader
						onCreateSkill={createSkillHandler}
						title={title}
					/>
				)}
				{selectedDetailSkill ? (
					<SkillDetailView
						disabled={addedIdSet.has(selectedDetailSkill.id) && disabledIdSet.has(selectedDetailSkill.id)}
						skill={selectedDetailSkill}
						onExit={handleExitDetail}
					/>
				) : (
					<>
						{variant === "experimental" ? (
							<ExperimentalSkillsDirectoryView
								addedIds={addedIdSet}
								filterAddedSkills={experimentalAddedSkills}
								filterFavourites={experimentalFavourites}
								filterYourSkills={experimentalYourSkills}
								onCreateShareLink={(skill) => handleSingleSkillAction(skill, onCreateShareLink)}
								onDownloadSkills={(skill) => handleSingleSkillAction(skill, onDownloadSkills)}
								onLearnMore={(skill) => setSelectedDetailSkillId(skill.id)}
								onSelectSkill={handleCardSelectSkill}
								onToggleAddedSkill={handleToggleAddedSkill}
								onToggleFavoriteSkill={handleToggleFavoriteSkill}
								onToggleSelectedSkill={handleToggleSelectedSkill}
								query={query}
								selectionExperience={selectionExperience}
								selectedCompanies={experimentalCompanies}
								selectedIds={selectedIdSet}
								setFilterAddedSkills={setExperimentalAddedSkills}
								setFilterFavourites={setExperimentalFavourites}
								setFilterYourSkills={setExperimentalYourSkills}
								setQuery={setQuery}
								setSelectedCompanies={setExperimentalCompanies}
								skills={directorySkills}
							/>
						) : (
							<SkillsDirectoryView
								addedIds={addedIdSet}
								activeItem={activeItem}
								filteredSkills={filteredSkills}
								onCreateShareLink={(skill) => handleSingleSkillAction(skill, onCreateShareLink)}
								onDownloadSkills={(skill) => handleSingleSkillAction(skill, onDownloadSkills)}
								onLearnMore={(skill) => setSelectedDetailSkillId(skill.id)}
								onSelectItem={setActiveItem}
								onSelectSkill={handleCardSelectSkill}
								onToggleAddedSkill={handleToggleAddedSkill}
								onToggleFavoriteSkill={handleToggleFavoriteSkill}
								onToggleSelectedSkill={handleToggleSelectedSkill}
								primaryItems={primaryItems}
								query={query}
								selectionExperience={selectionExperience}
								selectedIds={selectedIdSet}
								setQuery={setQuery}
								sidebarGroups={sidebarGroups}
								skills={directorySkills}
							/>
						)}
						{showSelectedSkillsFooter ? (
							<SelectedSkillsFooter
								count={selectedFooterCount}
								onAddSkills={handleSelectedSkillsAdd}
								onCancelSelection={() => commitSelectedIds([])}
								onCreateShareLink={() => handleBulkAction(onCreateShareLink)}
								onDownloadSkills={() => handleBulkAction(onDownloadSkills)}
								onFavoriteSkills={() => handleBulkAction(onFavoriteSkills)}
								selectionExperience={selectionExperience}
							/>
						) : null}
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface SkillsDirectoryHeaderProps {
	onCreateSkill?: () => void;
	title: string;
}

function SkillsDirectoryHeader({ onCreateSkill, title }: Readonly<SkillsDirectoryHeaderProps>) {
	return (
		<div className="flex items-center justify-between px-6 pt-6 pb-4">
			<DialogTitle className="text-base font-medium leading-5 text-text">
				{title}
			</DialogTitle>
			<div className="flex items-center gap-2">
				{onCreateSkill ? (
					<Button onClick={onCreateSkill} type="button">
						New skill
					</Button>
				) : null}
				<DialogClose render={<Button variant="ghost" size="icon" />}>
					<CrossIcon label="" />
					<span className="sr-only">Close</span>
				</DialogClose>
			</div>
		</div>
	);
}

interface SkillsDirectoryViewProps {
	addedIds: ReadonlySet<string>;
	activeItem: string;
	filteredSkills: readonly SkillsDirectorySkill[];
	onCreateShareLink: (skill: SkillsDirectorySkill) => void;
	onDownloadSkills: (skill: SkillsDirectorySkill) => void;
	onLearnMore: (skill: SkillsDirectorySkill) => void;
	onSelectItem: (id: string) => void;
	onSelectSkill: (skill: SkillsDirectorySkill) => void;
	onToggleAddedSkill: (skill: SkillsDirectorySkill, checked: boolean) => void;
	onToggleFavoriteSkill: (skill: SkillsDirectorySkill) => void;
	onToggleSelectedSkill: (skill: SkillsDirectorySkill, checked?: boolean) => void;
	primaryItems: readonly SkillsDirectoryPrimaryItem[];
	query: string;
	selectionExperience: SkillsDirectorySelectionExperience;
	selectedIds: ReadonlySet<string>;
	setQuery: (query: string) => void;
	sidebarGroups: readonly SkillsDirectorySidebarGroup[];
	skills: readonly SkillsDirectorySkill[];
}

function SkillsDirectoryView({
	addedIds,
	activeItem,
	filteredSkills,
	onCreateShareLink,
	onDownloadSkills,
	onLearnMore,
	onSelectItem,
	onSelectSkill,
	onToggleAddedSkill,
	onToggleFavoriteSkill,
	onToggleSelectedSkill,
	primaryItems,
	query,
	selectionExperience,
	selectedIds,
	setQuery,
	sidebarGroups,
	skills,
}: Readonly<SkillsDirectoryViewProps>) {
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();

	return (
		<div className="grid min-h-0 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
			<SkillsDirectorySidebar
				activeItem={activeItem}
				groups={sidebarGroups}
				onSelectItem={onSelectItem}
				primaryItems={primaryItems}
				skills={skills}
			/>

			<div
				ref={contentOverflow.ref}
				className={cn(
					// overflow-y-auto forces overflow-x to compute to auto, so this scroll
					// viewport clips anything painted outside its content box. pt-1 gives the
					// search input's focus ring (ring-3) room at the top; pb-8 gives the card
					// hover shadow (elevation.shadow.overlay = 0 8px 12px, ~20px reach) room at
					// the bottom so it is not clipped. px-6 already clears the ~12px side reach.
					"flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto px-6 pt-1 pb-8 md:pl-4",
					contentOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
				)}
			>
				<InputGroup>
					<InputGroupAddon>
						<SearchIcon label="" />
					</InputGroupAddon>
					<InputGroupInput
						aria-label="Search skills"
						placeholder="Search for a skill by name, or describe it"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>

				<div className="flex items-center justify-between gap-3">
					<Button variant="outline" type="button">
						Sort by latest
						<Icon render={<ChevronDownIcon label="" size="small" color="currentColor" />} />
					</Button>
					<p className="text-sm leading-5 text-text-subtle">
						Showing {filteredSkills.length.toLocaleString("en-US")} results
					</p>
				</div>

				{filteredSkills.length === 0 ? (
					<p className="py-6 text-sm text-text-subtlest">No skills match &ldquo;{query}&rdquo;.</p>
				) : (
					<SkillSection
						addedIds={addedIds}
						onCreateShareLink={onCreateShareLink}
						onDownloadSkills={onDownloadSkills}
						onLearnMore={onLearnMore}
						onSelectSkill={onSelectSkill}
						onToggleAddedSkill={onToggleAddedSkill}
						onToggleFavoriteSkill={onToggleFavoriteSkill}
						onToggleSelectedSkill={onToggleSelectedSkill}
						selectionExperience={selectionExperience}
						selectedIds={selectedIds}
						skills={filteredSkills}
					/>
				)}
			</div>
		</div>
	);
}

interface SkillSectionProps {
	addedIds: ReadonlySet<string>;
	gridClassName?: string;
	/** Optional micro section header (e.g. "My skills"); omit for a single unlabeled grid. */
	heading?: string;
	onCreateShareLink: (skill: SkillsDirectorySkill) => void;
	onDownloadSkills: (skill: SkillsDirectorySkill) => void;
	onLearnMore: (skill: SkillsDirectorySkill) => void;
	onSelectSkill: (skill: SkillsDirectorySkill) => void;
	onToggleAddedSkill: (skill: SkillsDirectorySkill, checked: boolean) => void;
	onToggleFavoriteSkill: (skill: SkillsDirectorySkill) => void;
	onToggleSelectedSkill: (skill: SkillsDirectorySkill, checked?: boolean) => void;
	selectionExperience: SkillsDirectorySelectionExperience;
	selectedIds: ReadonlySet<string>;
	skills: readonly SkillsDirectorySkill[];
}

function SkillSection({
	addedIds,
	gridClassName = "grid grid-cols-1 gap-3 lg:grid-cols-2",
	heading,
	onCreateShareLink,
	onDownloadSkills,
	onLearnMore,
	onSelectSkill,
	onToggleAddedSkill,
	onToggleFavoriteSkill,
	onToggleSelectedSkill,
	selectionExperience,
	selectedIds,
	skills,
}: Readonly<SkillSectionProps>) {
	const checkboxSelectable = true;
	const cardSelectable = selectionExperience !== "checkbox-actions";
	const showAddedSwitch = selectionExperience === "studio-bulk-add";

	return (
		<section aria-label={heading ?? "Skills"} className={cn(heading && "flex flex-col gap-2")}>
			{heading ? (
				<h2 className="px-1.5 text-xs font-semibold leading-4 text-text-subtlest">
					{heading}
				</h2>
			) : null}
			<ul className={gridClassName}>
				{skills.map((skill) => {
					const selected = selectedIds.has(skill.id);
					const effectiveAdded = addedIds.has(skill.id);
					const handleCardSelect =
						selectionExperience === "studio-bulk-add"
							? () => onToggleAddedSkill(skill, !effectiveAdded)
							: cardSelectable ? () => onSelectSkill(skill) : undefined;
					return (
						<li key={skill.id} className="cv-auto" style={{ containIntrinsicSize: "auto 112px" }}>
							<SkillsDirectoryEntityCard
								added={effectiveAdded}
								checkboxSelectable={checkboxSelectable}
								hoverAdded={false}
								onCreateShareLink={() => onCreateShareLink(skill)}
								onDownloadSkills={() => onDownloadSkills(skill)}
								onLearnMore={() => onLearnMore(skill)}
								onSelect={handleCardSelect}
								onToggleAdded={showAddedSwitch ? (checked) => onToggleAddedSkill(skill, checked) : undefined}
								onToggleFavorite={() => onToggleFavoriteSkill(skill)}
								onToggleSelected={(checked) => onToggleSelectedSkill(skill, checked)}
								selected={selected}
								skill={skill}
							/>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

interface SkillsDirectoryEntityCardProps {
	/** Skill is already on the agent — shows the persistent "added" check. */
	added: boolean;
	/** Shows the hover/focus checkbox affordance when the surface supports it. */
	checkboxSelectable: boolean;
	/** Shows a subtle trailing check on hover for deferred add flows. */
	hoverAdded: boolean;
	onCreateShareLink: () => void;
	onDownloadSkills: () => void;
	onLearnMore: () => void;
	onSelect?: () => void;
	/** Immediate add/remove toggle for Studio directory cards. */
	onToggleAdded?: (checked: boolean) => void;
	onToggleFavorite: () => void;
	onToggleSelected: (checked?: boolean) => void;
	selected: boolean;
	skill: SkillsDirectorySkill;
}

function getSkillCardSource(skill: SkillsDirectorySkill): EntityCardSource {
	const publisher = getSkillPublisherName(skill);
	const logoName = getSkillPublisherLogoName(skill);
	const avatarSrc = getSkillPublisherAvatarSrc(skill);

	if (isSkillPublisherPerson(skill)) {
		return {
			type: "custom",
			name: publisher,
			avatarSrc,
		};
	}

	return {
		type: "app",
		name: publisher,
		avatarSrc,
		brandName: skill.publisherBrandName,
		logoName,
	};
}

function SkillsDirectoryEntityCard({
	added,
	checkboxSelectable,
	hoverAdded,
	onCreateShareLink,
	onDownloadSkills,
	onLearnMore,
	onSelect,
	onToggleAdded,
	onToggleFavorite,
	onToggleSelected,
	selected,
	skill,
}: Readonly<SkillsDirectoryEntityCardProps>) {
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const moreActionsDisabled = selected;

	return (
		<EntityCardSkillCard
			active={!moreActionsDisabled && moreMenuOpen}
			added={added}
			cardActionLabel={onToggleAdded ? `${added ? "Remove" : "Add"} ${skill.name}` : undefined}
			className="min-h-[112px] gap-4"
			description={skill.description}
			hoverAdded={hoverAdded}
			icon={getSkillIcon(skill.icon)}
			iconVariant={getSkillIconTileVariant(skill)}
			moreAction={
				moreActionsDisabled ? null : (
					<SkillMoreMenu
						onCreateShareLink={onCreateShareLink}
						onDownloadSkills={onDownloadSkills}
						onLearnMore={onLearnMore}
						onOpenChange={setMoreMenuOpen}
						onToggleFavorite={onToggleFavorite}
						open={moreMenuOpen}
						favorite={Boolean(skill.favorite)}
						skillName={skill.name}
					/>
				)
			}
			name={skill.name}
			onAddedChange={onToggleAdded}
			onSelectedChange={(checked) => {
				const nextSelected = checked ?? !selected;
				if (nextSelected) {
					setMoreMenuOpen(false);
				}
				onToggleSelected(checked);
			}}
			onSelect={onSelect}
			selectable={checkboxSelectable}
			selected={selected}
			source={getSkillCardSource(skill)}
			starCount={skill.starCount}
			teammateCount={skill.teammateCount}
		/>
	);
}

function SkillMoreMenu({
	favorite,
	onCreateShareLink,
	onDownloadSkills,
	onLearnMore,
	onOpenChange,
	onToggleFavorite,
	open,
	skillName,
}: Readonly<{
	favorite: boolean;
	onCreateShareLink: () => void;
	onDownloadSkills: () => void;
	onLearnMore: () => void;
	onOpenChange: (open: boolean) => void;
	onToggleFavorite: () => void;
	open: boolean;
	skillName: string;
}>) {
	function stopPropagation(event: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>): void {
		event.stopPropagation();
	}

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={`More actions for ${skillName}`}
						aria-pressed={open || undefined}
						className={cn(
							"size-6 shrink-0 cursor-pointer opacity-0 transition-opacity duration-fast ease-out group-hover/card:opacity-100 group-has-[:focus-visible]/card:opacity-100",
							open && "opacity-100",
						)}
						onClick={stopPropagation}
						onKeyDown={stopPropagation}
						size="icon-compact"
						type="button"
						variant="ghost"
					>
						<Icon render={<ShowMoreHorizontalIcon label="" size="small" color="currentColor" />} />
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="min-w-fit" onClick={stopPropagation} sideOffset={6}>
				<DropdownMenuItem
					onClick={stopPropagation}
					onSelect={(event) => {
						event.stopPropagation();
						onLearnMore();
					}}
				>
					Learn more
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={stopPropagation}
					onSelect={(event) => {
						event.stopPropagation();
						onToggleFavorite();
					}}
				>
					{favorite ? "Unfavourite" : "Favourite"}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={stopPropagation}
					onSelect={(event) => {
						event.stopPropagation();
						onDownloadSkills();
					}}
				>
					Download
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={stopPropagation}
					onSelect={(event) => {
						event.stopPropagation();
						onCreateShareLink();
					}}
				>
					Share
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface SelectedSkillsFooterProps {
	count: number;
	onAddSkills: () => void;
	onCancelSelection: () => void;
	onCreateShareLink: () => void;
	onDownloadSkills: () => void;
	onFavoriteSkills: () => void;
	selectionExperience: SkillsDirectorySelectionExperience;
}

function SelectedSkillsFooter({
	count,
	onAddSkills,
	onCancelSelection,
	onCreateShareLink,
	onDownloadSkills,
	onFavoriteSkills,
	selectionExperience,
}: Readonly<SelectedSkillsFooterProps>) {
	const showAddButton = selectionExperience === "checkbox-actions";
	const countLabel = "selected";

	return (
		<DialogFooter
			aria-label="Selected skills actions"
			aria-live="polite"
			className="flex-col items-stretch border-t border-border px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
			role="toolbar"
		>
			<div className="flex min-w-0 items-center gap-2">
				<Badge>{count}</Badge>
				<span className="shrink-0 text-sm font-medium leading-5 text-text">{countLabel}</span>
			</div>
			<div className="flex max-w-full items-center justify-end gap-2 overflow-x-auto">
				<Button onClick={onCancelSelection} size="default" type="button" variant="ghost">
					<CrossIcon label="" />
					Cancel
				</Button>
				<Button onClick={onFavoriteSkills} size="default" type="button" variant="ghost">
					<StarUnstarredIcon label="" />
					Favorite
				</Button>
				<Button onClick={onDownloadSkills} size="default" type="button" variant="ghost">
					<DownloadIcon label="" />
					Download
				</Button>
				{showAddButton ? (
					<Button onClick={onAddSkills} size="default" type="button">
						Add skills
					</Button>
				) : null}
				<Button onClick={onCreateShareLink} size="default" type="button" variant="ghost">
					<LinkIcon label="" />
					Create link to share
				</Button>
			</div>
		</DialogFooter>
	);
}

interface SkillDetailHeaderProps {
	addLabel: string;
	/** Whether the skill is on the agent — gates the disable Switch + Remove button. */
	added: boolean;
	/** Whether the skill is enabled on the agent — drives the disable Switch. */
	enabled: boolean;
	/** Adds the skill to the agent. */
	onAdd: () => void;
	onBack: () => void;
	onCreateShareLink: () => void;
	onDownloadSkills: () => void;
	onFavoriteSkills: () => void;
	onOpenSkill: () => void;
	/** Removes the skill from the agent. */
	onRemove: () => void;
	/** Replaces the destructive added-state action with a primary chat try action. */
	showTryInChatAction: boolean;
	/** Toggles the skill's enabled state on the agent. */
	onToggleEnabled: (enabled: boolean) => void;
	title: string;
}

function SkillDetailHeader({
	addLabel,
	added,
	enabled,
	onAdd,
	onBack,
	onCreateShareLink,
	onDownloadSkills,
	onFavoriteSkills,
	onOpenSkill,
	onRemove,
	showTryInChatAction,
	onToggleEnabled,
	title,
}: Readonly<SkillDetailHeaderProps>) {
	return (
		<div className="flex items-center justify-between border-b border-border px-6 py-6">
			<div className="flex min-w-0 items-center gap-2">
				<Button
					aria-label="Back to skills"
					className="-ml-2 text-icon-subtle"
					onClick={onBack}
					size="icon"
					type="button"
					variant="ghost"
				>
					<ArrowLeftIcon label="" color="currentColor" />
				</Button>
				<DialogTitle className="truncate text-xl font-semibold leading-6 text-text">
					{title}
				</DialogTitle>
			</div>
			<div className="flex items-center gap-2">
				{/* Enable/disable applies to a skill already on the agent —
				    it drives the agent config. Hidden for skills that are not added,
				    mirroring the tools/apps detail headers. */}
				{added ? (
					<label className="flex items-center gap-2 text-sm leading-5 text-text-subtle">
						<span aria-hidden>{enabled ? "Enabled" : "Disabled"}</span>
						<Switch
							aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
							checked={enabled}
							onCheckedChange={onToggleEnabled}
						/>
					</label>
				) : null}
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button aria-label="More skill actions" size="icon" type="button" variant="outline">
								<ShowMoreHorizontalIcon label="" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end" sideOffset={6}>
						<DropdownMenuItem onSelect={() => onCreateShareLink()}>
							Create link to share
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => onFavoriteSkills()}>
							Favorite
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => onDownloadSkills()}>
							Download
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<ButtonGroup aria-label="Open skill" variant="split">
					<Button onClick={onOpenSkill} variant="outline">
						Open
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button aria-label="More open actions" size="icon" variant="outline" />}
						>
							<ChevronDownIcon label="" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" sideOffset={6}>
							<DropdownMenuItem onSelect={() => onOpenSkill()}>
								Open in new tab
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => onCreateShareLink()}>
								Copy link
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</ButtonGroup>
				{added && !showTryInChatAction ? (
					<Button onClick={onRemove} type="button" variant="destructive">
						<DeleteIcon label="" size="small" />
						Remove
					</Button>
				) : (
					<Button onClick={onAdd} type="button">
						{addLabel}
					</Button>
				)}
				<DialogClose render={<Button variant="ghost" size="icon" />}>
					<CrossIcon label="" />
					<span className="sr-only">Close</span>
				</DialogClose>
			</div>
		</div>
	);
}

function SkillDetailView({
	disabled = false,
	skill,
	onExit,
}: Readonly<{ disabled?: boolean; skill: SkillsDirectorySkill; onExit: () => void }>) {
	return <SkillDetailConfig key={skill.id} disabled={disabled} skill={skill} onExit={onExit} />;
}

const SKILL_DRAFT_KEY_PREFIX = "vpk:skill-draft:";
const SKILL_DRAFT_VERSION = 1;
const SKILL_NAME_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

interface StoredSkillDraft extends SkillMdDraft {
	version: number;
}

/** Load a saved draft, discarding anything from an older/unknown schema. */
function loadSkillDraft(skillId: string): SkillMdDraft | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const raw = window.localStorage.getItem(`${SKILL_DRAFT_KEY_PREFIX}${skillId}`);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as Partial<StoredSkillDraft>;
		if (parsed.version !== SKILL_DRAFT_VERSION || typeof parsed.skillMd !== "string") {
			return null;
		}
		return { skillMd: parsed.skillMd, descriptionOverride: parsed.descriptionOverride ?? null };
	} catch {
		return null;
	}
}

function saveSkillDraft(skillId: string, draft: SkillMdDraft): void {
	if (typeof window === "undefined") {
		return;
	}
	try {
		const stored: StoredSkillDraft = { version: SKILL_DRAFT_VERSION, ...draft };
		window.localStorage.setItem(`${SKILL_DRAFT_KEY_PREFIX}${skillId}`, JSON.stringify(stored));
	} catch {
		// Best-effort persistence (quota / privacy mode) — a failed write just means
		// the edit isn't restored on reopen, which is acceptable for the prototype.
	}
}

/**
 * Required-field validation (per the agentskills spec): a valid SKILL.md needs a
 * slug `name` and a non-empty `description` in its frontmatter. Returns "" when valid.
 */
function validateSkillMd(skillMd: string): string {
	const { frontmatter } = parseSkillMd(skillMd);
	const name = frontmatterValueToString(getFrontmatterField(frontmatter, "name")).trim();
	const description = frontmatterValueToString(getFrontmatterField(frontmatter, "description")).trim();
	if (!name) {
		return "Add a name to the frontmatter before saving.";
	}
	if (!SKILL_NAME_SLUG_RE.test(name)) {
		return "The frontmatter name must be a lowercase slug (e.g. design-landing-page).";
	}
	if (!description) {
		return "Add a description to the frontmatter before saving.";
	}
	return "";
}

/**
 * The skill detail editor. Edits a draft of the skill's SKILL.md (rendered with
 * the in-editor frontmatter card) plus the outside name + human-friendly
 * description, committed via the Save/Cancel footer (localStorage-backed).
 *
 * State lives in the shared {@link useSkillMdDraft} hook (single source = the full
 * SKILL.md); this component layers persistence, validation, and the commit flow.
 */
function SkillDetailConfig({
	disabled = false,
	skill,
	onExit,
}: Readonly<{ disabled?: boolean; skill: SkillsDirectorySkill; onExit: () => void }>) {
	const initialDraft = useMemo<SkillMdDraft>(
		() => loadSkillDraft(skill.id) ?? { skillMd: getSkillMarkdown(skill), descriptionOverride: null },
		[skill],
	);
	const { config, draft, handleTextChange, getDraft } = useSkillMdDraft(skill, initialDraft);

	const dirty =
		draft.skillMd !== initialDraft.skillMd || draft.descriptionOverride !== initialDraft.descriptionOverride;
	const validationError = useMemo(() => validateSkillMd(draft.skillMd), [draft.skillMd]);

	function handleSave() {
		// Read the freshest draft from the hook's ref so a value committed on blur by
		// the same click that triggers Save isn't missed by a not-yet-flushed update.
		const current = getDraft();
		if (validateSkillMd(current.skillMd)) {
			return;
		}
		saveSkillDraft(skill.id, current);
		onExit();
	}

	function handleCancel() {
		if (dirty && typeof window !== "undefined" && !window.confirm("Discard unsaved changes to this skill?")) {
			return;
		}
		onExit();
	}

	return (
		<div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
			<div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
				<SkillFileTreeSidebar skill={skill} />
				{/* Disabling the skill parks its editor off: only the config column goes
				    inert + muted; the file-tree sidebar stays browsable. */}
				<div
					aria-disabled={disabled || undefined}
					className={cn(
						"flex min-h-0 min-w-0 flex-col overflow-hidden md:pl-4",
						disabled && "opacity-(--opacity-disabled)",
					)}
					inert={disabled || undefined}
				>
					<Agent className="flex min-h-0 flex-1 flex-col bg-transparent">
						{/* Drop the frame's vertical padding (keep px-6) so the 24px
						    top/bottom rhythm is owned by the scroll content. The top padding
						    stays on the scrollport so the hover-reveal editor toolbar keeps
						    the default 24px top gap; the toolbar uses a negative sticky
						    offset so that gap compresses to 8px only once it pins. The bottom
						    padding must sit on the editor body (`.rich-text-editor-content`) — the instructions
						    section is `flex-1 min-h-0` and collapses to a 0-basis box, so
						    its overflowing editor body is the real scroll boundary; pb on
						    the scrollport or section lands above the fold and never shows.
						    Keep it large enough that short SKILL.md files still have enough
						    scroll travel for the toolbar to finish sticking. */}
						<AgentContent className="flex min-h-0 flex-1 flex-col py-0">
							<AgentConfigFields
								compactScrollAreaClassName="-mr-6 pr-6 pt-6 [&_[data-agent-field=instructions]_.rich-text-editor-content]:pb-8"
								config={config}
								idPrefix={`skill-detail-${skill.id}`}
								instructionsToolbarClassName="-top-4"
								profileCover={<SkillProfileCover skill={skill} />}
								profileMetaSlot={<SkillProfileMeta skill={skill} />}
								showConfigToolbar={false}
								frontmatter={{ enabled: true }}
								onTextChange={handleTextChange}
							/>
						</AgentContent>
					</Agent>
				</div>
			</div>
			{dirty ? (
				<div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-6">
					<p className="min-w-0 truncate text-xs leading-4 text-text-danger">{validationError}</p>
					<div className="flex shrink-0 items-center gap-2">
						<Button onClick={handleCancel} type="button" variant="outline">
							Cancel
						</Button>
						<Button disabled={Boolean(validationError)} onClick={handleSave} type="button">
							Save
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

interface SkillFileTreeNode extends SkillsDirectoryFileTreeItem {
	children: SkillFileTreeNode[];
}

/** Convert the flat, depth-tagged file list into the nested shape the FileTree compound expects. */
function buildSkillFileTree(items: readonly SkillsDirectoryFileTreeItem[]): SkillFileTreeNode[] {
	const roots: SkillFileTreeNode[] = [];
	const ancestors: SkillFileTreeNode[] = [];

	for (const item of items) {
		const depth = item.depth ?? 0;
		const node: SkillFileTreeNode = { ...item, children: [] };
		ancestors.length = depth;
		const parent = ancestors[depth - 1];

		if (parent) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}

		ancestors[depth] = node;
	}

	return roots;
}

function renderSkillFileTreeNode(node: SkillFileTreeNode) {
	if (node.kind === "folder") {
		return (
			<FileTreeFolder key={node.id} name={node.label} path={node.id}>
				{node.children.map(renderSkillFileTreeNode)}
			</FileTreeFolder>
		);
	}

	return <FileTreeFile key={node.id} name={node.label} path={node.id} />;
}

function SkillFileTreeSidebar({ skill }: Readonly<{ skill: SkillsDirectorySkill }>) {
	const items = skill.fileTreeItems ?? getDefaultFileTree(skill);
	const nodes = useMemo(() => buildSkillFileTree(items), [items]);
	const defaultExpanded = useMemo(
		() => new Set(items.filter((item) => item.kind === "folder" && item.expanded).map((item) => item.id)),
		[items],
	);
	const selectedPath = items.find((item) => item.selected)?.id;

	return (
		<aside className="hidden min-h-0 w-[280px] shrink-0 overflow-y-auto pl-6 pr-4 pt-6 md:block">
			<FileTree
				aria-label={`${skill.name} files`}
				className="text-xs"
				defaultExpanded={defaultExpanded}
				selectedPath={selectedPath}
			>
				{nodes.map(renderSkillFileTreeNode)}
			</FileTree>
		</aside>
	);
}

// ---------------------------------------------------------------------------
// Experimental variant: the sidebar's primary items + company groups become a
// horizontal filter row of toggles and searchable multi-select dropdowns, above
// a pinned-header + scroll-masked results grid (mirrors the experimental apps/
// agent directories).
// ---------------------------------------------------------------------------

interface ExperimentalSkillFilterOption extends ExperimentalDirectoryFilterOption {
	id: string;
	label: string;
	/** When set, renders the ADS brand logo instead of an `avatarSrc` image. */
	logoName?: ReturnType<typeof getSkillPublisherLogoName>;
	/** When set, renders the upstream 3P brand mark instead of an `avatarSrc` image. */
	brandName?: ThirdPartyLogoName;
	avatarSrc?: string;
}

// Company publishers present in the catalog (excludes self-authored "you" skills),
// carrying each company's brand mark from the first matching skill.
function getSkillCompanyOptions(skills: readonly SkillsDirectorySkill[]): readonly ExperimentalSkillFilterOption[] {
	const order: string[] = [];
	const byId = new Map<string, ExperimentalSkillFilterOption>();

	for (const skill of skills) {
		const id = skill.companyId;
		if (!id || id === "you" || byId.has(id)) continue;

		order.push(id);
		byId.set(id, {
			id,
			label: getSkillPublisherName(skill),
			logoName: id === "atlassian" ? "atlassian" : getSkillPublisherLogoName(skill),
			brandName: skill.publisherBrandName,
			avatarSrc: id === "atlassian" ? undefined : getSkillPublisherAvatarSrc(skill),
		});
	}

	return order.map((id) => byId.get(id)!);
}

interface ExperimentalSkillsFilters {
	yourSkills: boolean;
	addedSkills: boolean;
	favourites: boolean;
	companyIds: readonly string[];
}

// Experimental counterpart to filterSkills: the query haystack is identical, but
// the single active sidebar item becomes independent multi-select facets plus the
// Your skills / Added skills / Favourites toggles.
function filterSkillsExperimental(
	skills: readonly SkillsDirectorySkill[],
	query: string,
	filters: ExperimentalSkillsFilters,
	addedIds: ReadonlySet<string>,
): readonly SkillsDirectorySkill[] {
	const normalizedQuery = query.trim().toLowerCase();
	const companySet = new Set(filters.companyIds);

	return skills.filter((skill) => {
		if (filters.yourSkills && !isYourSkill(skill)) return false;
		if (filters.addedSkills && !addedIds.has(skill.id)) return false;
		if (filters.favourites && !skill.favorite) return false;
		if (companySet.size > 0 && !(skill.companyId && companySet.has(skill.companyId))) return false;

		if (!normalizedQuery) return true;

		const haystack = [
			skill.name,
			skill.description,
			getSkillPublisherName(skill),
			getSkillCategoryId(skill),
			getSkillCollection(skill).label,
			getSkillCollection(skill).description,
			skill.collectionDescription,
			skill.collectionProducts?.join(" "),
			skill.companyId,
			...(skill.tools ?? []).map((tool) => tool.name),
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		return haystack.includes(normalizedQuery);
	});
}

function getExperimentalSkillsEmptyState(
	query: string,
	filters: Pick<ExperimentalSkillsFilters, "yourSkills" | "addedSkills" | "favourites">,
): { title: string; description: string } {
	if (query.trim()) {
		return {
			title: `No skills match “${query.trim()}”`,
			description: "Try a different search or clear your filters.",
		};
	}
	if (filters.yourSkills) {
		return {
			title: "No skills of yours yet",
			description: "Skills you create or own will show up here.",
		};
	}
	if (filters.addedSkills) {
		return {
			title: "No skills added yet",
			description: "Skills you add to this agent will show up here.",
		};
	}
	if (filters.favourites) {
		return {
			title: "No favourite skills yet",
			description: "Skills you mark as favourite will show up here.",
		};
	}
	return {
		title: "No skills match your filters",
		description: "Try removing a filter to see more skills.",
	};
}

interface ExperimentalSkillsDirectoryViewProps {
	addedIds: ReadonlySet<string>;
	filterAddedSkills: boolean;
	filterFavourites: boolean;
	filterYourSkills: boolean;
	onCreateShareLink: (skill: SkillsDirectorySkill) => void;
	onDownloadSkills: (skill: SkillsDirectorySkill) => void;
	onLearnMore: (skill: SkillsDirectorySkill) => void;
	onSelectSkill: (skill: SkillsDirectorySkill) => void;
	onToggleAddedSkill: (skill: SkillsDirectorySkill, checked: boolean) => void;
	onToggleFavoriteSkill: (skill: SkillsDirectorySkill) => void;
	onToggleSelectedSkill: (skill: SkillsDirectorySkill, checked?: boolean) => void;
	query: string;
	selectionExperience: SkillsDirectorySelectionExperience;
	selectedCompanies: readonly string[];
	selectedIds: ReadonlySet<string>;
	setFilterAddedSkills: Dispatch<SetStateAction<boolean>>;
	setFilterFavourites: Dispatch<SetStateAction<boolean>>;
	setFilterYourSkills: Dispatch<SetStateAction<boolean>>;
	setQuery: (query: string) => void;
	setSelectedCompanies: Dispatch<SetStateAction<readonly string[]>>;
	skills: readonly SkillsDirectorySkill[];
}

function ExperimentalSkillsDirectoryView({
	addedIds,
	filterAddedSkills,
	filterFavourites,
	filterYourSkills,
	onCreateShareLink,
	onDownloadSkills,
	onLearnMore,
	onSelectSkill,
	onToggleAddedSkill,
	onToggleFavoriteSkill,
	onToggleSelectedSkill,
	query,
	selectionExperience,
	selectedCompanies,
	selectedIds,
	setFilterAddedSkills,
	setFilterFavourites,
	setFilterYourSkills,
	setQuery,
	setSelectedCompanies,
	skills,
}: Readonly<ExperimentalSkillsDirectoryViewProps>) {
	const companyOptions = useMemo(() => getSkillCompanyOptions(skills), [skills]);

	const filteredSkills = useMemo(
		() => {
			const matched = filterSkillsExperimental(
				skills,
				query,
				{
					yourSkills: filterYourSkills,
					addedSkills: filterAddedSkills,
					favourites: filterFavourites,
					companyIds: selectedCompanies,
				},
				addedIds,
			);
			// Alphabetical by name: the catalog front-loads grey (custom/marketplace)
			// skills, so alphabetising interleaves the collection-coloured tiles and
			// keeps the first rows multi-coloured rather than a block of grey.
			return [...matched].sort((a, b) => a.name.localeCompare(b.name, "en"));
		},
		[addedIds, filterAddedSkills, filterFavourites, filterYourSkills, query, selectedCompanies, skills],
	);

	// Split results into the user's own skills and everything else, each under its
	// own micro section header (mirrors the experimental agent directory).
	const mySkills = useMemo(() => filteredSkills.filter(isYourSkill), [filteredSkills]);
	const otherSkills = useMemo(() => filteredSkills.filter((skill) => !isYourSkill(skill)), [filteredSkills]);

	const emptyState = getExperimentalSkillsEmptyState(query, {
		yourSkills: filterYourSkills,
		addedSkills: filterAddedSkills,
		favourites: filterFavourites,
	});

	const facets: readonly ExperimentalDirectoryFacet<ExperimentalSkillFilterOption>[] = [
		{
			active: filterYourSkills,
			id: "yourSkills",
			kind: "toggle",
			label: "Filter by your skills",
			onToggle: () => setFilterYourSkills((current) => !current),
		},
		...(selectionExperience === "chat-single-add"
			? []
			: [{
				active: filterAddedSkills,
				id: "addedSkills",
				kind: "toggle",
				label: "Added skills",
				onToggle: () => setFilterAddedSkills((current) => !current),
			} satisfies ExperimentalDirectoryFacet<ExperimentalSkillFilterOption>]),
		{
			active: filterFavourites,
			id: "favourites",
			kind: "toggle",
			label: "Favourites",
			onToggle: () => setFilterFavourites((current) => !current),
		},
		{
			activeLabel: "Filter by companies",
			id: "companies",
			kind: "dropdown",
			label: "Companies",
			onToggle: (value) => setSelectedCompanies((current) => toggleSelectedValue(current, value)),
			options: companyOptions,
			renderOptionLeading: (option) => <ExperimentalSkillOptionAvatar option={option} />,
			selectedValues: selectedCompanies,
		},
	];

	function resetFilters() {
		setQuery("");
		setFilterYourSkills(false);
		setFilterAddedSkills(false);
		setFilterFavourites(false);
		setSelectedCompanies([]);
	}

	const checkboxSelectable = true;
	const cardSelectable = selectionExperience !== "checkbox-actions";
	const showAddedSwitch = selectionExperience === "studio-bulk-add";

	return (
		<ExperimentalDirectoryView
			contentClassName="pb-8"
			emptyState={emptyState}
			facets={facets}
			isEmpty={filteredSkills.length === 0}
			onQueryChange={setQuery}
			onResetFilters={resetFilters}
			query={query}
			resultCount={filteredSkills.length}
			searchLabel="Search skills"
			searchPlaceholder="Search for a skill by name, or describe it"
		>
			<div className="flex flex-col gap-6">
				{mySkills.length > 0 ? (
					<ExperimentalDirectorySection
						heading="My skills"
						items={mySkills}
						renderItem={(skill) => {
							const selected = selectedIds.has(skill.id);
							const effectiveAdded = addedIds.has(skill.id);
							const handleCardSelect =
								selectionExperience === "studio-bulk-add"
									? () => onToggleAddedSkill(skill, !effectiveAdded)
									: cardSelectable ? () => onSelectSkill(skill) : undefined;
							return (
								<SkillsDirectoryEntityCard
									added={effectiveAdded}
									checkboxSelectable={checkboxSelectable}
									hoverAdded={false}
									onCreateShareLink={() => onCreateShareLink(skill)}
									onDownloadSkills={() => onDownloadSkills(skill)}
									onLearnMore={() => onLearnMore(skill)}
									onSelect={handleCardSelect}
									onToggleAdded={showAddedSwitch ? (checked) => onToggleAddedSkill(skill, checked) : undefined}
									onToggleFavorite={() => onToggleFavoriteSkill(skill)}
									onToggleSelected={(checked) => onToggleSelectedSkill(skill, checked)}
									selected={selected}
									skill={skill}
								/>
							);
						}}
					/>
				) : null}
				{otherSkills.length > 0 ? (
					<ExperimentalDirectorySection
						heading="Other skills"
						items={otherSkills}
						renderItem={(skill) => {
							const selected = selectedIds.has(skill.id);
							const effectiveAdded = addedIds.has(skill.id);
							const handleCardSelect =
								selectionExperience === "studio-bulk-add"
									? () => onToggleAddedSkill(skill, !effectiveAdded)
									: cardSelectable ? () => onSelectSkill(skill) : undefined;
							return (
								<SkillsDirectoryEntityCard
									added={effectiveAdded}
									checkboxSelectable={checkboxSelectable}
									hoverAdded={false}
									onCreateShareLink={() => onCreateShareLink(skill)}
									onDownloadSkills={() => onDownloadSkills(skill)}
									onLearnMore={() => onLearnMore(skill)}
									onSelect={handleCardSelect}
									onToggleAdded={showAddedSwitch ? (checked) => onToggleAddedSkill(skill, checked) : undefined}
									onToggleFavorite={() => onToggleFavoriteSkill(skill)}
									onToggleSelected={(checked) => onToggleSelectedSkill(skill, checked)}
									selected={selected}
									skill={skill}
								/>
							);
						}}
					/>
				) : null}
			</div>
		</ExperimentalDirectoryView>
	);
}

function ExperimentalSkillOptionAvatar({ option }: Readonly<{ option: ExperimentalSkillFilterOption }>) {
	if (option.logoName) {
		return <AtlassianLogoMark name={option.logoName} size="small" transparent label={option.label} />;
	}
	if (option.brandName) {
		return <BrandLogoMark name={option.brandName} size="small" transparent label={option.label} />;
	}
	if (option.avatarSrc) {
		return <BrandLogoMark src={option.avatarSrc} size="small" transparent label={option.label} />;
	}
	return null;
}
