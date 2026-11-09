"use client";

// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { type Dispatch, type KeyboardEvent, type MouseEvent, type SetStateAction, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import BranchIcon from "@atlaskit/icon/core/branch";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CrossIcon from "@atlaskit/icon/core/cross";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import EmailIcon from "@atlaskit/icon/core/email";
import GlobeIcon from "@atlaskit/icon/core/globe";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import SearchIcon from "@atlaskit/icon/core/search";
import SettingsIcon from "@atlaskit/icon/core/settings";
import ShieldIcon from "@atlaskit/icon/core/shield";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StarStarredIcon from "@atlaskit/icon/core/star-starred";
import StarUnstarredIcon from "@atlaskit/icon/core/star-unstarred";
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";
import SupportIcon from "@atlaskit/icon/core/support";
import TimelineIcon from "@atlaskit/icon/core/timeline";
import CartIcon from "@atlaskit/icon-lab/core/cart";

import type {
	AgentBrowserSidebarGroup,
	AgentBrowserSidebarItem,
} from "@/components/blocks/agent-browser";
import {
	ExperimentalDirectorySection,
	ExperimentalDirectoryView,
	toggleSelectedValue,
	type ExperimentalDirectoryFacet,
} from "@/components/blocks/directory-shared/experimental-directory-view";
import type {
	ToolDirectoryPermission as AppDirectoryPermission,
} from "@/app/data/directory/tools";
import { type DirectoryApp as AppDirectoryTool } from "@/app/data/directory/apps";
import {
	type KnowledgeDirectoryApp,
	type KnowledgeDirectoryContent,
	type KnowledgeDirectoryMode,
} from "@/app/data/directory/knowledge";
import { resolveDirectoryVisual } from "@/app/data/directory/visual";
import { APP_DIRECTORY_CATEGORIES } from "@/components/blocks/app-directory/data/categories";
import { DEFAULT_APP_DIRECTORY_SIDEBAR_GROUPS } from "@/components/blocks/app-directory/data/sidebar-groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getThirdPartyLogoIconFromSrc } from "@/components/ui/data/logo-third-party-icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { AtlassianLogo, CustomLogo } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import { AtlassianLogoGlyph, AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import { Switch } from "@/components/ui/switch";
import { Tile } from "@/components/ui/tile";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EntityCardAppCard } from "@/components/ui-custom/entity-card";
import { RichTextMentionVisualMark } from "@/components/ui-custom/rich-text-editor/mention-visual";
import { SidebarNavItem } from "@/components/ui-custom/sidebar-nav-item";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

// Re-export the app-directory data types under this block's public API names.
// An "app" is the tools + knowledge umbrella ({@link DirectoryApp}); permissions
// reuse the shared tool-directory permission shape.
export type { ToolDirectoryPermission as AppDirectoryPermission } from "@/app/data/directory/tools";
export type { DirectoryApp as AppDirectoryTool } from "@/app/data/directory/apps";

export type AppDirectorySidebarGroup = AgentBrowserSidebarGroup;

export type AppDirectoryVariant = "default" | "experimental";

export interface AppDirectoryDialogProps {
	addedToolIds?: readonly string[];
	defaultAddedToolIds?: readonly string[];
	onAddedToolIdsChange?: (toolIds: readonly string[]) => void;
	/**
	 * Fired when an app is added from its detail view, carrying the per-app
	 * knowledge selection (All / Select content / None) so callers can wire the
	 * knowledge facet to match what the user chose rather than defaulting to all.
	 */
	onAddApp?: (payload: AppDirectoryAddPayload) => void;
	onCreateTool?: () => void;
	onOpenChange: (open: boolean) => void;
	onSelectTool?: (tool: AppDirectoryTool) => void;
	open: boolean;
	sessionTools?: readonly AppDirectoryTool[];
	sidebarGroups?: readonly AppDirectorySidebarGroup[];
	title?: string;
	tools: readonly AppDirectoryTool[];
	/**
	 * Tool to open directly in its detail view when the dialog opens. Lets callers
	 * deep-link to a specific tool (e.g. clicking a tool chip in the agent config
	 * summary). The detail view stays user-controllable afterward: pressing back
	 * or closing clears it. Pass `null` to open at the directory list.
	 */
	initialSelectedToolId?: string | null;
	/**
	 * Opt-in layout variation. `"default"` keeps the left-sidebar directory.
	 * `"experimental"` drops the sidebar and moves the category/company/added
	 * filters into a horizontal dropdown row above a flat results grid.
	 */
	variant?: AppDirectoryVariant;
}

const EMPTY_APP_DIRECTORY_TOOLS: readonly AppDirectoryTool[] = [];
const MAX_VISIBLE_CATEGORY_ITEMS = 5;
type AppDirectoryKnowledgeMode = KnowledgeDirectoryMode | "none";

/** Payload emitted by {@link AppDirectoryDialogProps.onAddApp} on a detail-view add. */
export interface AppDirectoryAddPayload {
	appId: string;
	knowledgeMode: "all" | "custom" | "none";
	knowledgeContentIds: readonly string[];
}

const PRIMARY_CATEGORIES = [
	{ id: "all", label: "All" },
	{ id: "favorite-tools", label: "Favourite apps" },
	{ id: "my-tools", label: "My apps" },
] as const;

const DEFAULT_READ_ONLY_TOOLS: readonly AppDirectoryPermission[] = [
	{
		id: "search-projects",
		name: "Search projects",
		description: "Find project plans, issues, and related work.",
	},
	{
		id: "read-pages",
		name: "Read pages",
		description: "Retrieve documentation and decision records.",
	},
	{
		id: "inspect-analytics",
		name: "Inspect analytics",
		description: "Review dashboard data without making changes.",
	},
	{
		id: "list-users",
		name: "List users",
		description: "View teammates and group membership.",
		enabled: false,
	},
] as const;

const DEFAULT_WRITE_DELETE_TOOLS: readonly AppDirectoryPermission[] = [
	{
		id: "create-tasks",
		name: "Create tasks",
		description: "Open new tasks from approved requests.",
	},
	{
		id: "update-status",
		name: "Update status",
		description: "Move work between tracked phases.",
	},
	{
		id: "comment-on-work",
		name: "Comment on work",
		description: "Add context to issues and documents.",
	},
	{
		id: "assign-owners",
		name: "Assign owners",
		description: "Route work to responsible teammates.",
	},
	{
		id: "create-pages",
		name: "Create pages",
		description: "Draft team documentation.",
	},
	{
		id: "update-fields",
		name: "Update fields",
		description: "Change configured project fields.",
	},
	{
		id: "send-notifications",
		name: "Send notifications",
		description: "Notify teams about important updates.",
	},
	{
		id: "delete-drafts",
		name: "Delete drafts",
		description: "Remove temporary drafts when they are no longer needed.",
		enabled: false,
	},
] as const;

const CATEGORY_ICON_RENDERERS: Record<string, (label: string) => ReactNode> = {
	"project-management": (label) => <TimelineIcon label={label} size="small" color="currentColor" />,
	"administrative-tools": (label) => <SettingsIcon label={label} size="small" color="currentColor" />,
	"content-and-communication": (label) => <EditIcon label={label} size="small" color="currentColor" />,
	"data-and-analytics": (label) => <ChartTrendUpIcon label={label} size="small" color="currentColor" />,
	"software-development": (label) => <AngleBracketsIcon label={label} size="small" color="currentColor" />,
	"it-support-and-service": (label) => <SupportIcon label={label} size="small" color="currentColor" />,
	"design-and-diagramming": (label) => <BranchIcon label={label} size="small" color="currentColor" />,
	"security-and-compliance": (label) => <ShieldIcon label={label} size="small" color="currentColor" />,
	"hr-and-team-building": (label) => <PeopleGroupIcon label={label} size="small" color="currentColor" />,
	"sales-and-customer-relations": (label) => <CartIcon label={label} size="small" color="currentColor" />,
};

function derivePublisher(tool: AppDirectoryTool): string {
	if (tool.publisherName) return tool.publisherName;

	const match = /\bby\s+(.+)$/i.exec(tool.byline);
	return (match?.[1] ?? tool.byline).trim();
}

function isYourApp(tool: AppDirectoryTool): boolean {
	const publisher = derivePublisher(tool).toLowerCase();
	return tool.attributionKind === "person" || tool.attributionKind === "team" || publisher === "you";
}

function isVerifiedTool(tool: AppDirectoryTool, publisher: string): boolean {
	if (typeof tool.verified === "boolean") return tool.verified;
	if (tool.attributionKind) return tool.attributionKind === "company";
	return ["atlassian", "google", "github", "slack", "notion", "figma", "canva"].includes(publisher.toLowerCase());
}

function filterTools(
	tools: readonly AppDirectoryTool[],
	query: string,
	activeCategory: string,
	addedIds: ReadonlySet<string>,
): readonly AppDirectoryTool[] {
	const normalizedQuery = query.trim().toLowerCase();

	return tools.filter((tool) => {
		if (activeCategory === "favorite-tools" && !tool.favorite) return false;
		if (activeCategory === "my-tools" && !addedIds.has(tool.id)) return false;
		if (
			activeCategory !== "all" &&
			activeCategory !== "favorite-tools" &&
			activeCategory !== "my-tools" &&
			tool.categoryId !== activeCategory
		) {
			return false;
		}

		if (!normalizedQuery) return true;

		const category = APP_DIRECTORY_CATEGORIES.find((item) => item.id === tool.categoryId);
		const haystack = [
			tool.name,
			tool.byline,
			tool.description,
			tool.publisherName,
			category?.label,
			category?.description,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		return haystack.includes(normalizedQuery);
	});
}

function getSidebarGroupItems(
	all: readonly AppDirectoryTool[],
	group: AppDirectorySidebarGroup,
): readonly AgentBrowserSidebarItem[] {
	if (group.items) return group.items;

	return (group.agentIds ?? [])
		.map((id) => all.find((tool) => tool.id === id))
		.filter((tool): tool is AppDirectoryTool => Boolean(tool))
		.map((tool) => ({
			id: tool.id,
			label: tool.name,
			avatarSrc: tool.avatarSrc,
			logoName: tool.logoName,
		}));
}

function getToolLogo(tool: AppDirectoryTool): ReactNode {
	if (tool.logoName || tool.id === "atlassian") {
		return <AtlassianLogoMark label={tool.name} name={tool.logoName ?? "atlassian"} size="medium" />;
	}

	if (tool.brandName) {
		return <BrandLogoMark frame="tile" label={tool.name} name={tool.brandName} size="medium" />;
	}

	const src = tool.logoSrc ?? tool.avatarSrc;
	if (!src) return null;

	return <BrandLogoMark frame="tile" label={tool.name} size="medium" src={src} />;
}

function getDetailLogo(tool: AppDirectoryTool): ReactNode {
	if (tool.logoName || tool.id === "atlassian") {
		const logoName = tool.logoName ?? "atlassian";

		if (logoName === "atlassian") {
			return <AtlassianLogoGlyph className="!size-12" name={logoName} size="xlarge" />;
		}

		return (
			<AtlassianLogo
				label={tool.name}
				name={logoName}
				size="xlarge"
				themeAware
			/>
		);
	}

	if (tool.brandName) {
		return <LogoThirdParty label={tool.name} name={tool.brandName} size="xlarge" />;
	}

	const src = tool.logoSrc ?? tool.avatarSrc;
	if (!src) return null;

	return <CustomLogo label={tool.name} size="xlarge" src={src} />;
}

function getPermissionGroups(tool: AppDirectoryTool) {
	return [
		{
			id: "read-only",
			label: "Read-only actions",
			permissions: tool.readOnlyTools ?? DEFAULT_READ_ONLY_TOOLS,
		},
		{
			id: "write-delete",
			label: "Write / Delete actions",
			permissions: tool.writeDeleteTools ?? DEFAULT_WRITE_DELETE_TOOLS,
		},
	] as const;
}

const EMPTY_KNOWLEDGE_CONTENT_IDS: readonly string[] = [];

function getKnowledgeContentIds(app: KnowledgeDirectoryApp | null): readonly string[] {
	return app?.contents.map((content) => content.id) ?? EMPTY_KNOWLEDGE_CONTENT_IDS;
}

// An app's knowledge facet comes straight from the unified catalog record; there
// is no name-matching fallback — a tool-only app simply has no knowledge facet.
function getKnowledgeAppForTool(tool: AppDirectoryTool): KnowledgeDirectoryApp | null {
	return tool.hasKnowledgeFacet ? tool.knowledgeApp ?? null : null;
}

function filterKnowledgeContent(
	contents: readonly KnowledgeDirectoryContent[],
	selectedIds: readonly string[],
	query: string,
): readonly KnowledgeDirectoryContent[] {
	const selectedIdSet = new Set(selectedIds);
	const normalizedQuery = query.trim().toLowerCase();

	return contents.filter((content) => {
		if (!selectedIdSet.has(content.id)) return false;
		if (!normalizedQuery) return true;

		return [content.name, content.description, content.type].join(" ").toLowerCase().includes(normalizedQuery);
	});
}

export function AppDirectoryDialog({
	addedToolIds,
	defaultAddedToolIds = [],
	onAddedToolIdsChange,
	onAddApp,
	onCreateTool,
	onOpenChange,
	onSelectTool,
	open,
	sessionTools = EMPTY_APP_DIRECTORY_TOOLS,
	sidebarGroups = DEFAULT_APP_DIRECTORY_SIDEBAR_GROUPS,
	title,
	tools,
	initialSelectedToolId = null,
	variant = "default",
}: Readonly<AppDirectoryDialogProps>) {
	const directoryTools = useMemo(
		() => [...tools, ...sessionTools],
		[tools, sessionTools],
	);
	const [activeCategory, setActiveCategory] = useState<string>("all");
	const [query, setQuery] = useState("");
	// Experimental-variant filters live on the dialog (not inside
	// ExperimentalAppDirectoryView) so they survive opening/closing an app's detail
	// view — the view unmounts on detail navigation, mirroring how activeCategory persists.
	const [experimentalYourApps, setExperimentalYourApps] = useState(false);
	const [experimentalAddedApps, setExperimentalAddedApps] = useState(false);
	const [experimentalFavourites, setExperimentalFavourites] = useState(false);
	const [experimentalCategories, setExperimentalCategories] = useState<readonly string[]>([]);
	const [experimentalCompanies, setExperimentalCompanies] = useState<readonly string[]>([]);
	const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
	const resolvedDirectoryTools = useMemo(
		() => directoryTools.map((tool) => (
			tool.id in favoriteOverrides ? { ...tool, favorite: favoriteOverrides[tool.id] } : tool
		)),
		[directoryTools, favoriteOverrides],
	);
	const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
	// Seed the detail view from `initialSelectedToolId` each time the dialog
	// transitions to open, so callers can deep-link to a specific tool (e.g. a
	// clicked chip). After opening, the detail view stays user-controllable —
	// back/close clears it via `handleOpenChange`/the header back button.
	const wasOpenRef = useRef(false);
	useEffect(() => {
		if (open && !wasOpenRef.current) {
			setSelectedToolId(initialSelectedToolId);
		}
		wasOpenRef.current = open;
	}, [open, initialSelectedToolId]);
	const [uncontrolledAddedToolIds, setUncontrolledAddedToolIds] = useState<ReadonlySet<string>>(
		() => new Set(defaultAddedToolIds),
	);
	const [permissionSelections, setPermissionSelections] = useState<Record<string, Record<string, boolean>>>({});
	// Per-app enable/disable state for the detail header — mirrors the agent config
	// toggle: a disabled app stays added but is parked off until re-enabled or removed.
	const [disabledToolIds, setDisabledToolIds] = useState<ReadonlySet<string>>(() => new Set());
	// Per-app knowledge selection (All / Select content / None), mirrored up from
	// the detail view so the header "Add to agent" can wire the chosen knowledge
	// facet via onAddApp instead of always defaulting to "all content".
	const [knowledgeSelections, setKnowledgeSelections] = useState<
		Record<string, { mode: AppDirectoryKnowledgeMode; contentIds: readonly string[] }>
	>({});
	const controlledAddedIds = typeof addedToolIds !== "undefined";
	const addedIds = useMemo(
		() => new Set(controlledAddedIds ? addedToolIds : uncontrolledAddedToolIds),
		[addedToolIds, controlledAddedIds, uncontrolledAddedToolIds],
	);
	const selectedTool = selectedToolId
		? resolvedDirectoryTools.find((tool) => tool.id === selectedToolId) ?? null
		: null;
	const filteredTools = useMemo(
		() => filterTools(resolvedDirectoryTools, query, activeCategory, addedIds),
		[resolvedDirectoryTools, query, activeCategory, addedIds],
	);

	function commitAddedToolIds(nextAddedIds: ReadonlySet<string>): void {
		if (!controlledAddedIds) {
			setUncontrolledAddedToolIds(nextAddedIds);
		}

		onAddedToolIdsChange?.([...nextAddedIds]);
	}

	function handleOpenChange(nextOpen: boolean): void {
		if (!nextOpen) {
			setSelectedToolId(null);
		}

		onOpenChange(nextOpen);
	}

	function handleSelectTool(tool: AppDirectoryTool): void {
		// Clear any mirrored knowledge selection for this app so reopening it starts
		// from the "all" default (matching ToolDetailView's reset-on-open effect).
		setKnowledgeSelections((current) => {
			if (!(tool.id in current)) {
				return current;
			}
			const next = { ...current };
			delete next[tool.id];
			return next;
		});
		setSelectedToolId(tool.id);
		onSelectTool?.(tool);
	}

	function handleAddTool(tool: AppDirectoryTool): void {
		// When a caller wants the per-app knowledge selection (config panel), emit it
		// via onAddApp so the chosen mode/content drives the knowledge facet. The
		// dialog's added state is controlled from the caller's config, so it reflects
		// the change on the next render without a local set here.
		if (onAddApp) {
			const selection = knowledgeSelections[tool.id];
			const hasKnowledge = Boolean(getKnowledgeAppForTool(tool));
			onAddApp({
				appId: tool.id,
				knowledgeMode: hasKnowledge ? (selection?.mode ?? "all") : "none",
				knowledgeContentIds: selection?.contentIds ?? [],
			});
			return;
		}
		const nextAddedIds = new Set(addedIds);
		nextAddedIds.add(tool.id);
		commitAddedToolIds(nextAddedIds);
	}

	function handleKnowledgeSelectionChange(
		appId: string,
		selection: { mode: AppDirectoryKnowledgeMode; contentIds: readonly string[] },
	): void {
		setKnowledgeSelections((current) => ({ ...current, [appId]: selection }));
	}

	function handleRemoveTool(tool: AppDirectoryTool): void {
		const nextAddedIds = new Set(addedIds);
		nextAddedIds.delete(tool.id);
		commitAddedToolIds(nextAddedIds);
		setDisabledToolIds((current) => {
			if (!current.has(tool.id)) {
				return current;
			}
			const next = new Set(current);
			next.delete(tool.id);
			return next;
		});
	}

	function handleToggleAddedTool(tool: AppDirectoryTool, checked: boolean): void {
		if (checked) {
			handleAddTool(tool);
		} else {
			handleRemoveTool(tool);
		}
	}

	function handleToggleToolEnabled(tool: AppDirectoryTool, enabled: boolean): void {
		setDisabledToolIds((current) => {
			const next = new Set(current);
			if (enabled) {
				next.delete(tool.id);
			} else {
				next.add(tool.id);
			}
			return next;
		});
	}

	function handleToggleFavoriteTool(tool: AppDirectoryTool): void {
		setFavoriteOverrides((current) => ({
			...current,
			[tool.id]: !tool.favorite,
		}));
	}

	function setPermission(tool: AppDirectoryTool, permissionId: string, checked: boolean): void {
		setPermissionSelections((current) => ({
			...current,
			[tool.id]: {
				...current[tool.id],
				[permissionId]: checked,
			},
		}));
	}

	function checkPermissionGroup(tool: AppDirectoryTool, permissions: readonly AppDirectoryPermission[]): void {
		setPermissionSelections((current) => {
			const toolSelections = { ...current[tool.id] };

			for (const permission of permissions) {
				toolSelections[permission.id] = true;
			}

			return {
				...current,
				[tool.id]: toolSelections,
			};
		});
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="grid h-[min(768px,calc(100svh-2rem))] !max-w-[calc(100vw-2rem)] max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:!max-w-[1200px]"
				showCloseButton={false}
			>
				<AppDirectoryHeader
					title={title ?? "Browse apps"}
					enabled={selectedTool ? !disabledToolIds.has(selectedTool.id) : undefined}
					onToggleEnabled={
						selectedTool && addedIds.has(selectedTool.id)
							? (enabled) => handleToggleToolEnabled(selectedTool, enabled)
							: undefined
					}
					onBack={selectedTool ? () => setSelectedToolId(null) : undefined}
					onAddTool={selectedTool && !addedIds.has(selectedTool.id) ? () => handleAddTool(selectedTool) : undefined}
					onCreateTool={onCreateTool}
					onRemoveTool={selectedTool && addedIds.has(selectedTool.id) ? () => handleRemoveTool(selectedTool) : undefined}
				/>
				{selectedTool ? (
					<ToolDetailView
						added={addedIds.has(selectedTool.id)}
						disabled={addedIds.has(selectedTool.id) && disabledToolIds.has(selectedTool.id)}
						onCheckGroup={(permissions) => checkPermissionGroup(selectedTool, permissions)}
						onPermissionChange={(permissionId, checked) => setPermission(selectedTool, permissionId, checked)}
						onKnowledgeSelectionChange={(selection) => handleKnowledgeSelectionChange(selectedTool.id, selection)}
						permissionSelections={permissionSelections[selectedTool.id] ?? {}}
						tool={selectedTool}
					/>
				) : variant === "experimental" ? (
					<ExperimentalAppDirectoryView
						addedIds={addedIds}
						filterYourApps={experimentalYourApps}
						filterFavourites={experimentalFavourites}
						filterAddedApps={experimentalAddedApps}
						onSelectTool={handleSelectTool}
						onToggleAddedTool={handleToggleAddedTool}
						onToggleFavoriteTool={handleToggleFavoriteTool}
						query={query}
						selectedCategories={experimentalCategories}
						selectedCompanies={experimentalCompanies}
						setFilterYourApps={setExperimentalYourApps}
						setFilterFavourites={setExperimentalFavourites}
						setFilterAddedApps={setExperimentalAddedApps}
						setQuery={setQuery}
						setSelectedCategories={setExperimentalCategories}
						setSelectedCompanies={setExperimentalCompanies}
						tools={resolvedDirectoryTools}
					/>
				) : (
					<AppDirectoryView
						activeCategory={activeCategory}
						addedIds={addedIds}
						filteredTools={filteredTools}
						onSelectCategory={setActiveCategory}
						onSelectTool={handleSelectTool}
						onToggleAddedTool={handleToggleAddedTool}
						onToggleFavoriteTool={handleToggleFavoriteTool}
						query={query}
						setQuery={setQuery}
						sidebarGroups={sidebarGroups}
						tools={resolvedDirectoryTools}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface AppDirectoryHeaderProps {
	/** Whether the selected app is enabled — drives the disable Switch. */
	enabled?: boolean;
	onAddTool?: () => void;
	onBack?: () => void;
	onCreateTool?: () => void;
	onRemoveTool?: () => void;
	/** Toggles the app's enabled state on the agent. Presence renders the Switch. */
	onToggleEnabled?: (enabled: boolean) => void;
	title: string;
}

function AppDirectoryHeader({ enabled = true, onAddTool, onBack, onCreateTool, onRemoveTool, onToggleEnabled, title }: Readonly<AppDirectoryHeaderProps>) {
	return (
		<div className="flex items-center justify-between px-6 py-6">
			<div className="flex min-w-0 items-center gap-2">
				{onBack ? (
					<Button
						aria-label="Back to apps"
						className="-ml-2 text-icon-subtle"
						onClick={onBack}
						size="icon"
						type="button"
						variant="ghost"
					>
						<ArrowLeftIcon label="" color="currentColor" />
					</Button>
				) : null}
				<DialogTitle className="truncate text-xl font-semibold leading-6 text-text">
					{title}
				</DialogTitle>
			</div>
			<div className="flex items-center gap-2">
				{onToggleEnabled ? (
					// Enable/disable the added app — mirrors the agent config toggle.
					<label className="flex items-center gap-2 text-sm leading-5 text-text-subtle">
						<span aria-hidden>{enabled ? "Enabled" : "Disabled"}</span>
						<Switch
							aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
							checked={enabled}
							onCheckedChange={onToggleEnabled}
						/>
					</label>
				) : null}
				{onRemoveTool ? (
					<Button variant="destructive" onClick={onRemoveTool} type="button">
						<DeleteIcon label="" size="small" />
						Remove
					</Button>
				) : onAddTool ? (
					<Button onClick={onAddTool} type="button">
						Add to agent
					</Button>
				) : (
					<Button onClick={onCreateTool} type="button">
						New app
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

interface AppDirectoryViewProps {
	activeCategory: string;
	addedIds: ReadonlySet<string>;
	filteredTools: readonly AppDirectoryTool[];
	onSelectCategory: (categoryId: string) => void;
	onSelectTool: (tool: AppDirectoryTool) => void;
	onToggleAddedTool: (tool: AppDirectoryTool, checked: boolean) => void;
	onToggleFavoriteTool: (tool: AppDirectoryTool) => void;
	query: string;
	setQuery: (query: string) => void;
	sidebarGroups: readonly AppDirectorySidebarGroup[];
	tools: readonly AppDirectoryTool[];
}

function AppDirectoryView({
	activeCategory,
	addedIds,
	filteredTools,
	onSelectCategory,
	onSelectTool,
	onToggleAddedTool,
	onToggleFavoriteTool,
	query,
	setQuery,
	sidebarGroups,
	tools,
}: Readonly<AppDirectoryViewProps>) {
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();

	return (
		<div className="grid min-h-0 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
			<AppDirectorySidebar
				activeCategory={activeCategory}
				addedIds={addedIds}
				onSelectCategory={onSelectCategory}
				onSelectTool={onSelectTool}
				sidebarGroups={sidebarGroups}
				tools={tools}
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
						aria-label="Search apps"
						placeholder="Search for an app by name, or describe it"
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
						Showing {filteredTools.length.toLocaleString("en-US")} results
					</p>
				</div>
				{filteredTools.length === 0 ? (
					<p className="py-6 text-sm text-text-subtlest">
						No apps match &ldquo;{query}&rdquo;.
					</p>
				) : (
					<ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
						{filteredTools.map((tool) => (
							<li key={tool.id}>
								<AppCard
									added={addedIds.has(tool.id)}
									onSelectTool={onSelectTool}
									onToggleAddedTool={onToggleAddedTool}
									onToggleFavoriteTool={onToggleFavoriteTool}
									tool={tool}
								/>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function createOptionId(label: string): string {
	return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Categories map straight from the catalog; they carry no avatar (text only).
function getCategoryOptions(): readonly AgentBrowserSidebarItem[] {
	return APP_DIRECTORY_CATEGORIES.map((category) => ({ id: category.id, label: category.label }));
}

// Company options come from company-attributed apps grouped by publisher, mirroring
// the experimental agent directory. The first matching app supplies the brand mark.
function getCompanyOptions(tools: readonly AppDirectoryTool[]): readonly AgentBrowserSidebarItem[] {
	const order: string[] = [];
	const byId = new Map<string, AgentBrowserSidebarItem>();

	for (const tool of tools) {
		if (tool.attributionKind !== "company") continue;

		const label = derivePublisher(tool);
		if (!label) continue;

		const id = createOptionId(label);
		if (byId.has(id)) continue;

		order.push(id);
		byId.set(id, { id, label, avatarSrc: tool.avatarSrc, logoName: tool.logoName, brandName: tool.brandName });
	}

	return order.map((id) => byId.get(id)!);
}

interface ExperimentalAppsFilters {
	yourApps: boolean;
	addedApps: boolean;
	favourites: boolean;
	categoryIds: readonly string[];
	companyIds: readonly string[];
}

// Experimental counterpart to filterTools: the query haystack is identical, but the
// sidebar's single active category becomes multi-select category + company facets
// plus the Your apps / Added apps / Favourites toggles.
function filterToolsExperimental(
	tools: readonly AppDirectoryTool[],
	query: string,
	filters: ExperimentalAppsFilters,
	addedIds: ReadonlySet<string>,
): readonly AppDirectoryTool[] {
	const normalizedQuery = query.trim().toLowerCase();
	const categorySet = new Set(filters.categoryIds);
	const companySet = new Set(filters.companyIds);

	return tools.filter((tool) => {
		if (filters.yourApps && !isYourApp(tool)) return false;
		if (filters.addedApps && !addedIds.has(tool.id)) return false;
		if (filters.favourites && !tool.favorite) return false;
		if (categorySet.size > 0 && !(tool.categoryId && categorySet.has(tool.categoryId))) return false;
		if (companySet.size > 0 && !companySet.has(createOptionId(derivePublisher(tool)))) return false;

		if (!normalizedQuery) return true;

		const category = APP_DIRECTORY_CATEGORIES.find((item) => item.id === tool.categoryId);
		const haystack = [
			tool.name,
			tool.byline,
			tool.description,
			tool.publisherName,
			category?.label,
			category?.description,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		return haystack.includes(normalizedQuery);
	});
}

// Filter-aware empty copy: a query miss, empty Your apps / Added apps /
// Favourites facets, or a filter combination with no matches each read differently.
function getExperimentalEmptyState(
	query: string,
	filters: Pick<ExperimentalAppsFilters, "yourApps" | "addedApps" | "favourites">,
): { title: string; description: string } {
	if (query.trim()) {
		return {
			title: `No apps match “${query.trim()}”`,
			description: "Try a different search or clear your filters.",
		};
	}
	if (filters.addedApps) {
		return {
			title: "No apps added yet",
			description: "Apps you add to this agent will show up here.",
		};
	}
	if (filters.yourApps) {
		return {
			title: "No apps of yours yet",
			description: "Apps you create or own will show up here.",
		};
	}
	if (filters.favourites) {
		return {
			title: "No favourite apps yet",
			description: "Apps you mark as favourite will show up here.",
		};
	}
	return {
		title: "No apps match your filters",
		description: "Try removing a filter to see more apps.",
	};
}

interface ExperimentalAppDirectoryViewProps {
	addedIds: ReadonlySet<string>;
	filterAddedApps: boolean;
	filterFavourites: boolean;
	filterYourApps: boolean;
	onSelectTool: (tool: AppDirectoryTool) => void;
	onToggleAddedTool: (tool: AppDirectoryTool, checked: boolean) => void;
	onToggleFavoriteTool: (tool: AppDirectoryTool) => void;
	query: string;
	selectedCategories: readonly string[];
	selectedCompanies: readonly string[];
	setFilterAddedApps: Dispatch<SetStateAction<boolean>>;
	setFilterFavourites: Dispatch<SetStateAction<boolean>>;
	setFilterYourApps: Dispatch<SetStateAction<boolean>>;
	setQuery: (query: string) => void;
	setSelectedCategories: Dispatch<SetStateAction<readonly string[]>>;
	setSelectedCompanies: Dispatch<SetStateAction<readonly string[]>>;
	tools: readonly AppDirectoryTool[];
}

function ExperimentalAppDirectoryView({
	addedIds,
	filterAddedApps,
	filterFavourites,
	filterYourApps,
	onSelectTool,
	onToggleAddedTool,
	onToggleFavoriteTool,
	query,
	selectedCategories,
	selectedCompanies,
	setFilterAddedApps,
	setFilterFavourites,
	setFilterYourApps,
	setQuery,
	setSelectedCategories,
	setSelectedCompanies,
	tools,
}: Readonly<ExperimentalAppDirectoryViewProps>) {
	const categoryOptions = useMemo(() => getCategoryOptions(), []);
	const companyOptions = useMemo(() => getCompanyOptions(tools), [tools]);

	const filteredTools = useMemo(
		() => filterToolsExperimental(
			tools,
			query,
			{
				yourApps: filterYourApps,
				addedApps: filterAddedApps,
				favourites: filterFavourites,
				categoryIds: selectedCategories,
				companyIds: selectedCompanies,
			},
			addedIds,
		),
		[addedIds, filterAddedApps, filterFavourites, filterYourApps, query, selectedCategories, selectedCompanies, tools],
	);

	// Split results into the user's own apps and everything else, each under its
	// own micro section header (mirrors the experimental agent directory).
	const myApps = useMemo(() => filteredTools.filter(isYourApp), [filteredTools]);
	const otherApps = useMemo(() => filteredTools.filter((tool) => !isYourApp(tool)), [filteredTools]);

	const emptyState = getExperimentalEmptyState(query, {
		yourApps: filterYourApps,
		addedApps: filterAddedApps,
		favourites: filterFavourites,
	});

	const facets: readonly ExperimentalDirectoryFacet<AgentBrowserSidebarItem>[] = [
		{
			active: filterYourApps,
			id: "yourApps",
			kind: "toggle",
			label: "Filter by your apps",
			onToggle: () => setFilterYourApps((current) => !current),
		},
		{
			active: filterAddedApps,
			id: "addedApps",
			kind: "toggle",
			label: "Added apps",
			onToggle: () => setFilterAddedApps((current) => !current),
		},
		{
			active: filterFavourites,
			id: "favourites",
			kind: "toggle",
			label: "Favourites",
			onToggle: () => setFilterFavourites((current) => !current),
		},
		{
			activeLabel: "Filter by categories",
			id: "categories",
			kind: "dropdown",
			label: "Categories",
			onToggle: (value) => setSelectedCategories((current) => toggleSelectedValue(current, value)),
			options: categoryOptions,
			renderOptionLeading: (option) => <SidebarToolAvatar item={option} />,
			selectedValues: selectedCategories,
		},
		{
			activeLabel: "Filter by companies",
			id: "companies",
			kind: "dropdown",
			label: "Companies",
			onToggle: (value) => setSelectedCompanies((current) => toggleSelectedValue(current, value)),
			options: companyOptions,
			renderOptionLeading: (option) => <SidebarToolAvatar item={option} />,
			selectedValues: selectedCompanies,
		},
	];

	function resetFilters() {
		setQuery("");
		setFilterYourApps(false);
		setFilterAddedApps(false);
		setFilterFavourites(false);
		setSelectedCategories([]);
		setSelectedCompanies([]);
	}

	return (
		<ExperimentalDirectoryView
			contentClassName="pb-8"
			emptyState={emptyState}
			facets={facets}
			isEmpty={filteredTools.length === 0}
			onQueryChange={setQuery}
			onResetFilters={resetFilters}
			query={query}
			resultCount={filteredTools.length}
			searchLabel="Search apps"
			searchPlaceholder="Search for an app by name, or describe it"
		>
			<div className="flex flex-col gap-6">
				{myApps.length > 0 ? (
					<ExperimentalDirectorySection
						heading="My apps"
						items={myApps}
						renderItem={(tool) => (
							<AppCard
								added={addedIds.has(tool.id)}
								onSelectTool={onSelectTool}
								onToggleAddedTool={onToggleAddedTool}
								onToggleFavoriteTool={onToggleFavoriteTool}
								tool={tool}
							/>
						)}
					/>
				) : null}
				{otherApps.length > 0 ? (
					<ExperimentalDirectorySection
						heading="Other apps"
						items={otherApps}
						renderItem={(tool) => (
							<AppCard
								added={addedIds.has(tool.id)}
								onSelectTool={onSelectTool}
								onToggleAddedTool={onToggleAddedTool}
								onToggleFavoriteTool={onToggleFavoriteTool}
								tool={tool}
							/>
						)}
					/>
				) : null}
			</div>
		</ExperimentalDirectoryView>
	);
}

interface AppCardProps {
	added?: boolean;
	onSelectTool: (tool: AppDirectoryTool) => void;
	onToggleAddedTool: (tool: AppDirectoryTool, checked: boolean) => void;
	onToggleFavoriteTool: (tool: AppDirectoryTool) => void;
	tool: AppDirectoryTool;
}

function AppCard({ added = false, onSelectTool, onToggleAddedTool, onToggleFavoriteTool, tool }: Readonly<AppCardProps>) {
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const knowledgeApp = getKnowledgeAppForTool(tool);
	const selectTool = () => onSelectTool(tool);
	const toggleAdded = (checked: boolean) => onToggleAddedTool(tool, checked);
	const toggleFavorite = () => onToggleFavoriteTool(tool);

	return (
		<EntityCardAppCard
			active={moreMenuOpen}
			added={added}
			appLogo={getToolLogo(tool)}
			className="min-h-[102px] hover:border-transparent"
			description={tool.description ?? "Short description about the app."}
			moreAction={
				<DirectoryCardMoreMenu
					label={`More actions for ${tool.name}`}
					favorite={Boolean(tool.favorite)}
					onLearnMore={selectTool}
					onOpenChange={setMoreMenuOpen}
					onToggleFavorite={toggleFavorite}
					open={moreMenuOpen}
				/>
			}
			knowledgeCount={knowledgeApp?.contents.length}
			mentionHandle={tool.id}
			name={tool.name}
			onAddedChange={toggleAdded}
			onSelect={selectTool}
			promptSuggestion={tool.promptSuggestion}
			teammateCount={tool.teammateCount}
			toolCount={tool.toolCount}
		/>
	);
}

interface DirectoryCardMoreMenuProps {
	favorite: boolean;
	label: string;
	onLearnMore?: () => void;
	onOpenChange: (open: boolean) => void;
	onToggleFavorite: () => void;
	open: boolean;
}

function DirectoryCardMoreMenu({
	favorite,
	label,
	onLearnMore,
	onOpenChange,
	onToggleFavorite,
	open,
}: Readonly<DirectoryCardMoreMenuProps>) {
	function stopPropagation(event: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>): void {
		event.stopPropagation();
	}

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={label}
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
						onLearnMore?.();
					}}
				>
					Learn more
				</DropdownMenuItem>
				<DropdownMenuItem
					elemBefore={favorite ? <StarStarredIcon label="" /> : <StarUnstarredIcon label="" />}
					onClick={stopPropagation}
					onSelect={(event) => {
						event.stopPropagation();
						onToggleFavorite();
					}}
				>
					{favorite ? "Unfavourite" : "Favourite"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface AppDirectorySidebarProps {
	activeCategory: string;
	addedIds: ReadonlySet<string>;
	onSelectCategory: (categoryId: string) => void;
	onSelectTool: (tool: AppDirectoryTool) => void;
	sidebarGroups: readonly AppDirectorySidebarGroup[];
	tools: readonly AppDirectoryTool[];
}

function AppDirectorySidebar({
	activeCategory,
	addedIds,
	onSelectCategory,
	onSelectTool,
	sidebarGroups,
	tools,
}: Readonly<AppDirectorySidebarProps>) {
	const [showAllCategories, setShowAllCategories] = useState(false);
	const visibleCategoryItems = showAllCategories
		? APP_DIRECTORY_CATEGORIES
		: APP_DIRECTORY_CATEGORIES.slice(0, MAX_VISIBLE_CATEGORY_ITEMS);
	const hasHiddenCategoryItems =
		!showAllCategories && APP_DIRECTORY_CATEGORIES.length > MAX_VISIBLE_CATEGORY_ITEMS;
	const sidebarOverflow = useHasVerticalOverflow<HTMLElement>();

	return (
		<nav
			aria-label="Tool categories"
			className={cn(
				"hidden min-h-0 w-[280px] shrink-0 flex-col overflow-y-auto pl-6 md:flex",
				sidebarOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
			)}
			ref={sidebarOverflow.ref}
		>
			<ul className="flex w-64 flex-col">
				{PRIMARY_CATEGORIES.map((category) => (
					<li key={category.id}>
						<SidebarNavItem
							isSelected={activeCategory === category.id}
							label={category.label}
							onClick={() => onSelectCategory(category.id)}
						/>
					</li>
				))}
			</ul>
			<div className="h-3 w-64 shrink-0" />
			<div className="w-64 py-2 pl-1.5">
				<p className="text-text-subtlest" style={{ font: token("font.heading.xxsmall") }}>
					Category
				</p>
			</div>
			<ul className="flex w-64 flex-col">
				{visibleCategoryItems.map((category) => (
					<li key={category.id}>
						<SidebarNavItem
							isSelected={activeCategory === category.id}
							label={category.label}
							leading={CATEGORY_ICON_RENDERERS[category.id]?.(category.label)}
							leadingSize="medium"
							onClick={() => onSelectCategory(category.id)}
						/>
					</li>
				))}
				{hasHiddenCategoryItems ? (
					<li>
						<SidebarNavItem
							label="Show all"
							leading={<AlignTextLeftIcon label="" size="small" />}
							leadingSize="medium"
							onClick={() => setShowAllCategories(true)}
						/>
					</li>
				) : null}
			</ul>
			{sidebarGroups.length > 0 ? (
				<div className="mt-5 flex w-64 flex-col gap-5 pb-6">
					{sidebarGroups.map((group) => (
						<AppDirectorySidebarGroup
							key={group.title}
							addedIds={addedIds}
							group={group}
							onSelectCategory={onSelectCategory}
							onSelectTool={onSelectTool}
							tools={tools}
						/>
					))}
				</div>
			) : null}
		</nav>
	);
}

interface AppDirectorySidebarGroupProps {
	addedIds: ReadonlySet<string>;
	group: AppDirectorySidebarGroup;
	onSelectCategory: (categoryId: string) => void;
	onSelectTool: (tool: AppDirectoryTool) => void;
	tools: readonly AppDirectoryTool[];
}

function AppDirectorySidebarGroup({
	addedIds,
	group,
	onSelectCategory,
	onSelectTool,
	tools,
}: Readonly<AppDirectorySidebarGroupProps>) {
	const items = getSidebarGroupItems(tools, group);

	if (items.length === 0) return null;

	return (
		<div className="flex flex-col gap-1.5">
			<p className="px-1.5 text-text-subtlest" style={{ font: token("font.heading.xxsmall") }}>
				{group.title}
			</p>
			<ul className="flex flex-col">
				{items.map((item) => {
					const tool = tools.find((candidate) => candidate.id === item.id);
					return (
						<li key={item.id}>
							<SidebarNavItem
								isSelected={tool ? addedIds.has(tool.id) : false}
								label={item.label}
								leading={<SidebarToolAvatar item={item} />}
								leadingSize="medium"
								onClick={tool ? () => onSelectTool(tool) : undefined}
							/>
						</li>
					);
				})}
				{group.showAll ? (
					<li>
						<SidebarNavItem
							label="Show all"
							leading={<AlignTextLeftIcon label="" size="small" />}
							leadingSize="medium"
							onClick={() => onSelectCategory("all")}
						/>
					</li>
				) : null}
			</ul>
		</div>
	);
}

function SidebarToolAvatar({ item }: Readonly<{ item: AgentBrowserSidebarItem }>) {
	if (item.logoName) {
		return <AtlassianLogoMark label={item.label} name={item.logoName} size="small" />;
	}

	if (item.brandName) {
		return <BrandLogoMark frame="tile" label={item.label} name={item.brandName} size="small" />;
	}

	if (!item.avatarSrc) return null;

	const ThirdPartyIcon = getThirdPartyLogoIconFromSrc(item.avatarSrc);
	return ThirdPartyIcon ? (
		<ThirdPartyIcon label={item.label} size="small" />
	) : (
		<BrandLogoMark frame="tile" label={item.label} size="small" src={item.avatarSrc} />
	);
}

interface ToolDetailViewProps {
	added: boolean;
	/** When true the app is disabled on the agent — the whole body is muted and made inert. */
	disabled?: boolean;
	onCheckGroup: (permissions: readonly AppDirectoryPermission[]) => void;
	onPermissionChange: (permissionId: string, checked: boolean) => void;
	onKnowledgeSelectionChange?: (
		selection: { mode: AppDirectoryKnowledgeMode; contentIds: readonly string[] },
	) => void;
	permissionSelections: Readonly<Record<string, boolean>>;
	tool: AppDirectoryTool;
}

function ToolDetailView({
	added,
	disabled = false,
	onCheckGroup,
	onPermissionChange,
	onKnowledgeSelectionChange,
	permissionSelections,
	tool,
}: Readonly<ToolDetailViewProps>) {
	const publisher = derivePublisher(tool);
	const verified = isVerifiedTool(tool, publisher);
	const groups = getPermissionGroups(tool);
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();
	const knowledgeApp = useMemo(() => getKnowledgeAppForTool(tool), [tool]);
	const [knowledgeState, setKnowledgeState] = useState(() => ({
		mode: "all" as AppDirectoryKnowledgeMode,
		query: "",
		selectedContentIds: getKnowledgeContentIds(knowledgeApp),
		toolId: tool.id,
	}));
	let resolvedKnowledgeState = knowledgeState;
	if (knowledgeState.toolId !== tool.id) {
		resolvedKnowledgeState = {
			mode: "all",
			query: "",
			selectedContentIds: getKnowledgeContentIds(knowledgeApp),
			toolId: tool.id,
		};
		setKnowledgeState(resolvedKnowledgeState);
	}
	const knowledgeMode = resolvedKnowledgeState.mode;
	const knowledgeQuery = resolvedKnowledgeState.query;
	const selectedKnowledgeContentIds = resolvedKnowledgeState.selectedContentIds;
	const filteredKnowledgeContent = useMemo(
		() => filterKnowledgeContent(knowledgeApp?.contents ?? [], selectedKnowledgeContentIds, knowledgeQuery),
		[knowledgeApp, selectedKnowledgeContentIds, knowledgeQuery],
	);

	function handleSelectKnowledgeMode(nextMode: AppDirectoryKnowledgeMode): void {
		let nextContentIds: readonly string[];
		if (nextMode === "none") {
			nextContentIds = [];
		} else if (nextMode === "all") {
			nextContentIds = getKnowledgeContentIds(knowledgeApp);
		} else {
			nextContentIds =
				knowledgeApp && selectedKnowledgeContentIds.length === 0
					? getKnowledgeContentIds(knowledgeApp)
					: selectedKnowledgeContentIds;
		}
		setKnowledgeState((currentState) => ({
			...currentState,
			mode: nextMode,
			selectedContentIds: nextContentIds,
		}));
		onKnowledgeSelectionChange?.({ mode: nextMode, contentIds: nextContentIds });
	}

	function handleRemoveKnowledgeContent(contentId: string): void {
		const nextContentIds = selectedKnowledgeContentIds.filter((id) => id !== contentId);
		setKnowledgeState((currentState) => ({ ...currentState, selectedContentIds: nextContentIds }));
		onKnowledgeSelectionChange?.({ mode: knowledgeMode, contentIds: nextContentIds });
	}

	return (
		<div className="grid min-h-0 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
			<aside className="hidden min-h-0 w-[280px] shrink-0 overflow-y-auto pl-6 md:block">
				<div className="flex w-64 flex-col gap-4">
					<Tile
						className="size-24 rounded-xl"
						hasBorder
						isInset={false}
						label={tool.name}
						size="xlarge"
						variant="transparent"
					>
						{getDetailLogo(tool)}
					</Tile>
					<div className="flex flex-col gap-2">
						<h2 className="text-2xl font-semibold leading-7 text-text">{tool.name}</h2>
						<p className="text-sm leading-5 text-text">
							{tool.description ??
								"Specializes in collaboration tools designed primarily for software development and project management."}
						</p>
					</div>
					<div className="flex flex-col gap-1 text-xs leading-4 text-text-subtlest">
						<p className="flex items-center gap-1">
							<span>By</span>
							<span className="truncate text-link">{publisher}</span>
							{verified ? (
								<Icon
									className="text-icon-information"
									render={<StatusVerifiedIcon label="Verified" size="small" color="currentColor" />}
								/>
							) : null}
						</p>
						<p>{tool.teammateCount.toLocaleString("en-US")} teammates</p>
						<p>{tool.lastUpdatedLabel ?? "Last updated 2mo ago"}</p>
					</div>
					<div className="flex items-center gap-2 text-icon-subtle">
						<SupportIcon label="Support" size="small" color="currentColor" />
						<GlobeIcon label="Website" size="small" color="currentColor" />
						<EmailIcon label="Email" size="small" color="currentColor" />
					</div>
				</div>
			</aside>
			<div
				ref={contentOverflow.ref}
				// Only the configurable actions panel is disabled when the app is parked
				// off — the left identity sidebar (avatar, name, links) stays active.
				// `inert` removes this panel from tab order / pointer + a11y interaction;
				// the muted opacity reads as disabled. Re-enable from the header switch.
				aria-disabled={disabled || undefined}
				className={cn(
					"flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-6 pb-6 md:pl-4",
					contentOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
					disabled && "opacity-(--opacity-disabled)",
				)}
				inert={disabled || undefined}
			>
				<div className="rounded-xl border border-border p-4 md:hidden">
					<div className="flex items-start gap-4">
						<Tile hasBorder isInset={false} label={tool.name} size="xlarge" variant="transparent">
							{getDetailLogo(tool)}
						</Tile>
						<div className="min-w-0 flex-1">
							<h2 className="truncate text-2xl font-semibold leading-7 text-text">{tool.name}</h2>
							<p className="mt-1 text-sm leading-5 text-text-subtle">{tool.description}</p>
						</div>
					</div>
				</div>
				{/* Facet-aware: knowledge-only apps show just the Knowledge section,
				    tool-only apps show just the permission groups, dual apps show both. */}
				{tool.hasKnowledgeFacet ? (
					<KnowledgeSection
						key="knowledge"
						contentQuery={knowledgeQuery}
						filteredContent={filteredKnowledgeContent}
						mode={knowledgeMode}
						onRemoveContent={handleRemoveKnowledgeContent}
						onSelectMode={handleSelectKnowledgeMode}
						selectedContentCount={selectedKnowledgeContentIds.length}
						setContentQuery={(nextQuery) => {
							setKnowledgeState((currentState) => ({ ...currentState, query: nextQuery }));
						}}
					/>
				) : null}
				{tool.hasToolFacet
					? groups.map((group) => (
						<ToolPermissionGroup
							key={group.id}
							added={added}
							label={group.label}
							onCheckAll={() => onCheckGroup(group.permissions)}
							onPermissionChange={onPermissionChange}
							permissionSelections={permissionSelections}
							permissions={group.permissions}
						/>
					))
					: null}
			</div>
		</div>
	);
}

interface KnowledgeSectionProps {
	contentQuery: string;
	filteredContent: readonly KnowledgeDirectoryContent[];
	mode: AppDirectoryKnowledgeMode;
	onRemoveContent: (contentId: string) => void;
	onSelectMode: (mode: AppDirectoryKnowledgeMode) => void;
	selectedContentCount: number;
	setContentQuery: (query: string) => void;
}

function KnowledgeSection({
	contentQuery,
	filteredContent,
	mode,
	onRemoveContent,
	onSelectMode,
	selectedContentCount,
	setContentQuery,
}: Readonly<KnowledgeSectionProps>) {
	const badgeLabel = mode === "all"
		? "All"
		: mode === "none"
			? "None"
			: selectedContentCount;

	return (
		<section className="flex flex-col gap-2" aria-label="Knowledge">
			<div className="flex h-8 items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<h3 className="text-text-subtlest" style={{ font: token("font.heading.xxsmall") }}>
						Knowledge
					</h3>
					<Badge max={false}>{badgeLabel}</Badge>
				</div>
			</div>
			<div className={cn("flex flex-col gap-6", mode === "custom" && "gap-4")}>
				<KnowledgeContentModeSelector mode={mode} onSelectMode={onSelectMode} />
				{mode === "custom" ? (
					<div className="flex flex-col gap-4">
						<DirectorySearchField
							ariaLabel="Search selected knowledge content"
							onChange={setContentQuery}
							placeholder="Search for content by name, or describe it"
							value={contentQuery}
						/>
						<SelectedKnowledgeContentList
							contents={filteredContent}
							onRemoveContent={onRemoveContent}
							selectedContentCount={selectedContentCount}
						/>
					</div>
				) : null}
			</div>
		</section>
	);
}

interface KnowledgeContentModeSelectorProps {
	mode: AppDirectoryKnowledgeMode;
	onSelectMode: (mode: AppDirectoryKnowledgeMode) => void;
}

function KnowledgeContentModeSelector({ mode, onSelectMode }: Readonly<KnowledgeContentModeSelectorProps>) {
	return (
		<ToggleGroup
			aria-label="Knowledge content mode"
			className="w-full"
			onValueChange={(value) => {
				const nextMode = value[0] as AppDirectoryKnowledgeMode | undefined;
				if (nextMode) {
					onSelectMode(nextMode);
				}
			}}
			value={[mode]}
			variant="outline"
		>
			<ToggleGroupItem
				aria-label="All content"
				className="h-9 flex-1"
				value="all"
			>
				All content
			</ToggleGroupItem>
			<ToggleGroupItem
				aria-label="Custom content"
				className="h-9 flex-1"
				value="custom"
			>
				Select content
			</ToggleGroupItem>
			<ToggleGroupItem
				aria-label="No knowledge"
				className="h-9 flex-1"
				value="none"
			>
				None
			</ToggleGroupItem>
		</ToggleGroup>
	);
}

interface SelectedKnowledgeContentListProps {
	contents: readonly KnowledgeDirectoryContent[];
	onRemoveContent: (contentId: string) => void;
	selectedContentCount: number;
}

function SelectedKnowledgeContentList({
	contents,
	onRemoveContent,
	selectedContentCount,
}: Readonly<SelectedKnowledgeContentListProps>) {
	return (
		<div className="overflow-hidden rounded-xl border border-border">
			{contents.length > 0 ? (
				<ul>
					{contents.map((content, index) => (
						<li
							className={cn("border-border bg-surface", index < contents.length - 1 && "border-b")}
							key={content.id}
						>
							<div className="flex h-14 items-center gap-3 px-3">
								<KnowledgeContentVisual content={content} />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium leading-5 text-text">{content.name}</span>
									<span className="block truncate text-xs leading-4 text-text-subtlest">{content.type}</span>
								</span>
								<Button
									aria-label={`Remove ${content.name}`}
									className="hover:bg-bg-danger hover:text-text-danger hover:[&_svg]:text-icon-danger active:bg-bg-danger-pressed active:[&_svg]:text-icon-danger focus-visible:border-border-danger"
									onClick={() => onRemoveContent(content.id)}
									size="icon"
									type="button"
									variant="ghost"
								>
									<DeleteIcon label="" color="currentColor" />
								</Button>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="px-4 py-6 text-sm text-text-subtlest">
					{selectedContentCount === 0 ? "No custom content selected." : "No selected content matches this search."}
				</p>
			)}
		</div>
	);
}

function KnowledgeContentVisual({ content }: Readonly<{ content: KnowledgeDirectoryContent }>) {
	const visual = resolveDirectoryVisual(content.visual);

	return visual ? (
		<RichTextMentionVisualMark
			label={content.name}
			size="menu"
			visual={visual}
		/>
	) : null;
}

interface DirectorySearchFieldProps {
	ariaLabel: string;
	onChange: (query: string) => void;
	placeholder: string;
	value: string;
}

function DirectorySearchField({
	ariaLabel,
	onChange,
	placeholder,
	value,
}: Readonly<DirectorySearchFieldProps>) {
	return (
		<InputGroup>
			<InputGroupAddon>
				<SearchIcon label="" />
			</InputGroupAddon>
			<InputGroupInput
				aria-label={ariaLabel}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</InputGroup>
	);
}

interface ToolPermissionGroupProps {
	added: boolean;
	label: string;
	onCheckAll: () => void;
	onPermissionChange: (permissionId: string, checked: boolean) => void;
	permissionSelections: Readonly<Record<string, boolean>>;
	permissions: readonly AppDirectoryPermission[];
}

function ToolPermissionGroup({
	added,
	label,
	onCheckAll,
	onPermissionChange,
	permissionSelections,
	permissions,
}: Readonly<ToolPermissionGroupProps>) {
	return (
		<section className="flex flex-col gap-2" aria-label={label}>
			<div className="flex h-8 items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<h3 className="text-text-subtlest" style={{ font: token("font.heading.xxsmall") }}>
						{label}
					</h3>
					<Badge max={false}>{permissions.length}</Badge>
				</div>
				<Button disabled={!added} variant="ghost" size="default" onClick={onCheckAll} type="button">
					Check all
				</Button>
			</div>
			<div className="overflow-hidden rounded-xl border border-border">
				{permissions.map((permission, index) => {
					const checked = added
						? permissionSelections[permission.id] ?? permission.enabled ?? true
						: true;
					const disabled = !added || permission.disabled;

					return (
						<div
							key={permission.id}
							className={cn(
								"flex h-14 items-center gap-3 bg-surface px-3",
								index < permissions.length - 1 && "border-b border-border",
							)}
						>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium leading-5 text-text">{permission.name}</p>
								<p className="truncate text-xs leading-4 text-text-subtlest">{permission.description}</p>
							</div>
							<Switch
								aria-label={`${permission.name} permission`}
								checked={checked}
								disabled={disabled}
								onCheckedChange={(nextChecked) => onPermissionChange(permission.id, nextChecked)}
							/>
						</div>
					);
				})}
			</div>
		</section>
	);
}
