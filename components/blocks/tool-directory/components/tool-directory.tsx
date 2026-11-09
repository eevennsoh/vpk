"use client";

// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";
import SupportIcon from "@atlaskit/icon/core/support";
import TimelineIcon from "@atlaskit/icon/core/timeline";
import CartIcon from "@atlaskit/icon-lab/core/cart";

import type {
	AgentBrowserSidebarGroup,
	AgentBrowserSidebarItem,
} from "@/components/blocks/agent-browser";
import type {
	ToolDirectoryPermission,
	ToolDirectoryTool,
} from "@/app/data/directory/tools";
import { TOOL_DIRECTORY_CATEGORIES } from "@/components/blocks/tool-directory/data/categories";
import { DEFAULT_TOOL_DIRECTORY_SIDEBAR_GROUPS } from "@/components/blocks/tool-directory/data/sidebar-groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { EntityCardToolCard } from "@/components/ui-custom/entity-card";
import { SidebarNavItem } from "@/components/ui-custom/sidebar-nav-item";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

// `ToolDirectoryTool` and `ToolDirectoryPermission` are owned by the data layer
// (`@/app/data/directory/tools`) so JSON data and the directory UI share one type
// identity. Re-exported here for existing callers that import them from this module.
export type { ToolDirectoryPermission, ToolDirectoryTool } from "@/app/data/directory/tools";

export type ToolDirectorySidebarGroup = AgentBrowserSidebarGroup;

export interface ToolDirectoryDialogProps {
	addedToolIds?: readonly string[];
	defaultAddedToolIds?: readonly string[];
	onAddedToolIdsChange?: (toolIds: readonly string[]) => void;
	onCreateTool?: () => void;
	onOpenChange: (open: boolean) => void;
	onSelectTool?: (tool: ToolDirectoryTool) => void;
	open: boolean;
	sessionTools?: readonly ToolDirectoryTool[];
	sidebarGroups?: readonly ToolDirectorySidebarGroup[];
	title?: string;
	tools: readonly ToolDirectoryTool[];
	/**
	 * Tool to open directly in its detail view when the dialog opens. Lets callers
	 * deep-link to a specific tool (e.g. clicking a tool chip in the agent config
	 * summary). The detail view stays user-controllable afterward: pressing back
	 * or closing clears it. Pass `null` to open at the directory list.
	 */
	initialSelectedToolId?: string | null;
}

const EMPTY_TOOL_DIRECTORY_TOOLS: readonly ToolDirectoryTool[] = [];
const MAX_VISIBLE_CATEGORY_ITEMS = 5;

const PRIMARY_CATEGORIES = [
	{ id: "all", label: "All" },
	{ id: "favorite-tools", label: "Favourite tools" },
	{ id: "my-tools", label: "My tools" },
] as const;

const DEFAULT_READ_ONLY_TOOLS: readonly ToolDirectoryPermission[] = [
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

const DEFAULT_WRITE_DELETE_TOOLS: readonly ToolDirectoryPermission[] = [
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

function derivePublisher(tool: ToolDirectoryTool): string {
	if (tool.publisherName) return tool.publisherName;

	const match = /\bby\s+(.+)$/i.exec(tool.byline);
	return (match?.[1] ?? tool.byline).trim();
}

function isVerifiedTool(tool: ToolDirectoryTool, publisher: string): boolean {
	if (typeof tool.verified === "boolean") return tool.verified;
	if (tool.attributionKind) return tool.attributionKind === "company";
	return ["atlassian", "google", "github", "slack", "notion", "figma", "canva"].includes(publisher.toLowerCase());
}

function filterTools(
	tools: readonly ToolDirectoryTool[],
	query: string,
	activeCategory: string,
	addedIds: ReadonlySet<string>,
): readonly ToolDirectoryTool[] {
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

		const category = TOOL_DIRECTORY_CATEGORIES.find((item) => item.id === tool.categoryId);
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
	all: readonly ToolDirectoryTool[],
	group: ToolDirectorySidebarGroup,
): readonly AgentBrowserSidebarItem[] {
	if (group.items) return group.items;

	return (group.agentIds ?? [])
		.map((id) => all.find((tool) => tool.id === id))
		.filter((tool): tool is ToolDirectoryTool => Boolean(tool))
		.map((tool) => ({
			id: tool.id,
			label: tool.name,
			avatarSrc: tool.avatarSrc,
			logoName: tool.logoName,
		}));
}

function getToolLogo(tool: ToolDirectoryTool): ReactNode {
	if (tool.logoName || tool.id === "atlassian") {
		return <AtlassianLogoMark label={tool.name} name={tool.logoName ?? "atlassian"} size="medium" />;
	}

	if (tool.brandName) {
		return <BrandLogoMark frame="tile" label={tool.name} name={tool.brandName} size="medium" />;
	}

	const src = tool.logoSrc ?? tool.avatarSrc;
	return src ? <BrandLogoMark frame="tile" label={tool.name} size="medium" src={src} /> : null;
}

function getDetailLogo(tool: ToolDirectoryTool): ReactNode {
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

function getPermissionGroups(tool: ToolDirectoryTool) {
	return [
		{
			id: "read-only",
			label: "Read-only tools",
			permissions: tool.readOnlyTools ?? DEFAULT_READ_ONLY_TOOLS,
		},
		{
			id: "write-delete",
			label: "Write / Delete tools",
			permissions: tool.writeDeleteTools ?? DEFAULT_WRITE_DELETE_TOOLS,
		},
	] as const;
}

export function ToolDirectoryDialog({
	addedToolIds,
	defaultAddedToolIds = [],
	onAddedToolIdsChange,
	onCreateTool,
	onOpenChange,
	onSelectTool,
	open,
	sessionTools = EMPTY_TOOL_DIRECTORY_TOOLS,
	sidebarGroups = DEFAULT_TOOL_DIRECTORY_SIDEBAR_GROUPS,
	title,
	tools,
	initialSelectedToolId = null,
}: Readonly<ToolDirectoryDialogProps>) {
	const directoryTools = useMemo(
		() => [...tools, ...sessionTools],
		[tools, sessionTools],
	);
	const [activeCategory, setActiveCategory] = useState<string>("all");
	const [query, setQuery] = useState("");
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
	const controlledAddedIds = typeof addedToolIds !== "undefined";
	const addedIds = useMemo(
		() => new Set(controlledAddedIds ? addedToolIds : uncontrolledAddedToolIds),
		[addedToolIds, controlledAddedIds, uncontrolledAddedToolIds],
	);
	const selectedTool = selectedToolId
		? directoryTools.find((tool) => tool.id === selectedToolId) ?? null
		: null;
	const filteredTools = useMemo(
		() => filterTools(directoryTools, query, activeCategory, addedIds),
		[directoryTools, query, activeCategory, addedIds],
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

	function handleSelectTool(tool: ToolDirectoryTool): void {
		setSelectedToolId(tool.id);
		onSelectTool?.(tool);
	}

	function handleAddTool(tool: ToolDirectoryTool): void {
		const nextAddedIds = new Set(addedIds);
		nextAddedIds.add(tool.id);
		commitAddedToolIds(nextAddedIds);
	}

	function handleRemoveTool(tool: ToolDirectoryTool): void {
		const nextAddedIds = new Set(addedIds);
		nextAddedIds.delete(tool.id);
		commitAddedToolIds(nextAddedIds);
	}

	function setPermission(tool: ToolDirectoryTool, permissionId: string, checked: boolean): void {
		setPermissionSelections((current) => ({
			...current,
			[tool.id]: {
				...current[tool.id],
				[permissionId]: checked,
			},
		}));
	}

	function checkPermissionGroup(tool: ToolDirectoryTool, permissions: readonly ToolDirectoryPermission[]): void {
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
				<ToolDirectoryHeader
					title={title ?? "Browse tools"}
					onBack={selectedTool ? () => setSelectedToolId(null) : undefined}
					onCreateTool={onCreateTool}
				/>
				{selectedTool ? (
					<ToolDetailView
						added={addedIds.has(selectedTool.id)}
						onAddTool={() => handleAddTool(selectedTool)}
						onCheckGroup={(permissions) => checkPermissionGroup(selectedTool, permissions)}
						onPermissionChange={(permissionId, checked) => setPermission(selectedTool, permissionId, checked)}
						onRemoveTool={() => handleRemoveTool(selectedTool)}
						permissionSelections={permissionSelections[selectedTool.id] ?? {}}
						tool={selectedTool}
					/>
				) : (
					<ToolDirectoryView
						activeCategory={activeCategory}
						addedIds={addedIds}
						filteredTools={filteredTools}
						onSelectCategory={setActiveCategory}
						onSelectTool={handleSelectTool}
						query={query}
						setQuery={setQuery}
						sidebarGroups={sidebarGroups}
						tools={directoryTools}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface ToolDirectoryHeaderProps {
	onBack?: () => void;
	onCreateTool?: () => void;
	title: string;
}

function ToolDirectoryHeader({ onBack, onCreateTool, title }: Readonly<ToolDirectoryHeaderProps>) {
	return (
		<div className="flex items-center justify-between px-6 py-6">
			<div className="flex min-w-0 items-center gap-2">
				{onBack ? (
					<Button
						aria-label="Back to tools"
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
				<Button onClick={onCreateTool} type="button">
					New tool
				</Button>
				<DialogClose render={<Button variant="ghost" size="icon" />}>
					<CrossIcon label="" />
					<span className="sr-only">Close</span>
				</DialogClose>
			</div>
		</div>
	);
}

interface ToolDirectoryViewProps {
	activeCategory: string;
	addedIds: ReadonlySet<string>;
	filteredTools: readonly ToolDirectoryTool[];
	onSelectCategory: (categoryId: string) => void;
	onSelectTool: (tool: ToolDirectoryTool) => void;
	query: string;
	setQuery: (query: string) => void;
	sidebarGroups: readonly ToolDirectorySidebarGroup[];
	tools: readonly ToolDirectoryTool[];
}

function ToolDirectoryView({
	activeCategory,
	addedIds,
	filteredTools,
	onSelectCategory,
	onSelectTool,
	query,
	setQuery,
	sidebarGroups,
	tools,
}: Readonly<ToolDirectoryViewProps>) {
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();

	return (
		<div className="grid min-h-0 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
			<ToolDirectorySidebar
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
						aria-label="Search tools"
						placeholder="Search for a tool by name, or describe it"
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
						No tools match &ldquo;{query}&rdquo;.
					</p>
				) : (
					<ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
						{filteredTools.map((tool) => (
							<li key={tool.id}>
								<ToolCard added={addedIds.has(tool.id)} onSelectTool={onSelectTool} tool={tool} />
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

interface ToolCardProps {
	added?: boolean;
	onSelectTool: (tool: ToolDirectoryTool) => void;
	tool: ToolDirectoryTool;
}

function ToolCard({ added = false, onSelectTool, tool }: Readonly<ToolCardProps>) {
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const selectTool = () => onSelectTool(tool);

	return (
		<EntityCardToolCard
			active={moreMenuOpen}
			added={added}
			appLogo={getToolLogo(tool)}
			className="min-h-[102px] hover:border-transparent"
			description={tool.description ?? "Short description about the app."}
			moreAction={
				<DirectoryCardMoreMenu
					label={`More actions for ${tool.name}`}
					onLearnMore={selectTool}
					onOpenChange={setMoreMenuOpen}
					open={moreMenuOpen}
				/>
			}
			name={tool.name}
			onSelect={selectTool}
			teammateCount={tool.teammateCount}
			toolCount={tool.toolCount}
		/>
	);
}

interface DirectoryCardMoreMenuProps {
	label: string;
	onLearnMore?: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

function DirectoryCardMoreMenu({
	label,
	onLearnMore,
	onOpenChange,
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
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface ToolDirectorySidebarProps {
	activeCategory: string;
	addedIds: ReadonlySet<string>;
	onSelectCategory: (categoryId: string) => void;
	onSelectTool: (tool: ToolDirectoryTool) => void;
	sidebarGroups: readonly ToolDirectorySidebarGroup[];
	tools: readonly ToolDirectoryTool[];
}

function ToolDirectorySidebar({
	activeCategory,
	addedIds,
	onSelectCategory,
	onSelectTool,
	sidebarGroups,
	tools,
}: Readonly<ToolDirectorySidebarProps>) {
	const [showAllCategories, setShowAllCategories] = useState(false);
	const visibleCategoryItems = showAllCategories
		? TOOL_DIRECTORY_CATEGORIES
		: TOOL_DIRECTORY_CATEGORIES.slice(0, MAX_VISIBLE_CATEGORY_ITEMS);
	const hasHiddenCategoryItems =
		!showAllCategories && TOOL_DIRECTORY_CATEGORIES.length > MAX_VISIBLE_CATEGORY_ITEMS;
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
						<ToolDirectorySidebarGroup
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

interface ToolDirectorySidebarGroupProps {
	addedIds: ReadonlySet<string>;
	group: ToolDirectorySidebarGroup;
	onSelectCategory: (categoryId: string) => void;
	onSelectTool: (tool: ToolDirectoryTool) => void;
	tools: readonly ToolDirectoryTool[];
}

function ToolDirectorySidebarGroup({
	addedIds,
	group,
	onSelectCategory,
	onSelectTool,
	tools,
}: Readonly<ToolDirectorySidebarGroupProps>) {
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

	return item.avatarSrc ? <BrandLogoMark frame="tile" label={item.label} size="small" src={item.avatarSrc} /> : null;
}

interface ToolDetailViewProps {
	added: boolean;
	onAddTool: () => void;
	onCheckGroup: (permissions: readonly ToolDirectoryPermission[]) => void;
	onPermissionChange: (permissionId: string, checked: boolean) => void;
	onRemoveTool: () => void;
	permissionSelections: Readonly<Record<string, boolean>>;
	tool: ToolDirectoryTool;
}

function ToolDetailView({
	added,
	onAddTool,
	onCheckGroup,
	onPermissionChange,
	onRemoveTool,
	permissionSelections,
	tool,
}: Readonly<ToolDetailViewProps>) {
	const publisher = derivePublisher(tool);
	const verified = isVerifiedTool(tool, publisher);
	const groups = getPermissionGroups(tool);
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();

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
					{added ? (
						<Button variant="destructive" onClick={onRemoveTool} type="button">
							<DeleteIcon label="" size="small" />
							Remove
						</Button>
					) : (
						<Button onClick={onAddTool} type="button">
							Add to agent
						</Button>
					)}
				</div>
			</aside>
			<div
				ref={contentOverflow.ref}
				className={cn(
					"flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-6 pb-6 md:pl-4",
					contentOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
				)}
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
				{groups.map((group) => (
					<ToolPermissionGroup
						key={group.id}
						added={added}
						label={group.label}
						onCheckAll={() => onCheckGroup(group.permissions)}
						onPermissionChange={onPermissionChange}
						permissionSelections={permissionSelections}
						permissions={group.permissions}
					/>
				))}
			</div>
		</div>
	);
}

interface ToolPermissionGroupProps {
	added: boolean;
	label: string;
	onCheckAll: () => void;
	onPermissionChange: (permissionId: string, checked: boolean) => void;
	permissionSelections: Readonly<Record<string, boolean>>;
	permissions: readonly ToolDirectoryPermission[];
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
