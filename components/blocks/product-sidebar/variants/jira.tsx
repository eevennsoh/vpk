"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SidebarNavItem, SidebarNavItemAction } from "@/components/ui-custom/sidebar-nav-item";
import { AnimatedDots } from "@/components/ui-custom/animated-dots";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { IconTile } from "@/components/ui/icon-tile";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { Tile, TileAvatar } from "@/components/ui/tile";
import { STARRED_PROJECTS, JIRA_EXTERNAL_LINKS } from "../data/jira-navigation";
import AddIcon from "@atlaskit/icon/core/add";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import AppsIcon from "@atlaskit/icon/core/apps";
import ArchiveBoxIcon from "@atlaskit/icon/core/archive-box";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import ClockIcon from "@atlaskit/icon/core/clock";
import DashboardIcon from "@atlaskit/icon/core/dashboard";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PersonAvatarIcon from "@atlaskit/icon/core/person-avatar";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import PlanIcon from "@atlaskit/icon/core/list-checklist";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import RoadmapIcon from "@atlaskit/icon/core/roadmap";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import SpacesIcon from "@atlaskit/icon-lab/core/spaces";
import SortOptionsIcon from "@atlaskit/icon-lab/core/sort-options";
import StarUnstarredIcon from "@atlaskit/icon/core/star-unstarred";
import TaskIcon from "@atlaskit/icon/core/task";
import VideoStopIcon from "@atlaskit/icon/core/video-stop";
import VideoStopOverlayIcon from "@atlaskit/icon/core/video-stop-overlay";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
	JiraSessionFlyoutSurface,
	JiraSessionFlyoutTrigger,
	createJiraSessionFlyoutHandle,
	type JiraSessionFlyoutHandle,
} from "./jira-session-flyout";

export type JiraSidebarSessionStatus = "awaiting-input" | "running" | "pr-open" | "merged" | "stopped";
export type JiraSidebarSessionHost = "cloud" | "local";
export type JiraSidebarLayoutMode = "by-project" | "one-list";
export type JiraSidebarSortMode = "priority" | "last-updated" | "manual";

export type JiraSidebarWorkItemPriority = "highest" | "high" | "medium" | "low" | "lowest";

export interface JiraSidebarAssignee {
	name: string;
	src?: string;
}

export interface JiraSidebarSessionChecks {
	failed: number;
	passed: number;
}

export interface JiraSidebarSessionItem {
	additions?: number;
	agentAvatarSrc?: string;
	/** Third-party brand mark for the hexagonal agent identity, when the session has no `agentAvatarSrc`. */
	brandName?: ThirdPartyLogoName;
	/** VPK product mark for platform-owned runners such as Rovo. */
	vpkLogo?: "rovo";
	agentName: string;
	/** Human who started the agent session, shown beside the session timestamp. */
	invokedBy?: JiraSidebarAssignee;
	/** Human accountable for the Jira work item, shown in the work-item Smart Link. */
	assignee?: JiraSidebarAssignee;
	branch?: string;
	checks?: JiraSidebarSessionChecks;
	commit?: string;
	completedAtMs?: number;
	completedSecondsAgo?: number;
	deletions?: number;
	/** Number of files in the PR diff, shown on the pull-request Smart Link hover card. */
	files?: number;
	host: JiraSidebarSessionHost;
	id: string;
	initialElapsedSeconds?: number;
	issueKey: string;
	issueSummary: string;
	/** Board/work-item status shown on the Jira smart-link chip. Overrides the session-lifecycle default. */
	issueStatus?: string;
	priority?: JiraSidebarWorkItemPriority;
	/** PR author shown on the pull-request Smart Link hover card. Falls back to `invokedBy`. */
	pullRequestAuthor?: JiraSidebarAssignee;
	/** PR summary shown on the pull-request Smart Link hover card. */
	pullRequestDescription?: string;
	pullRequestNumber?: number;
	/** Number of reviewers shown in the untracked-work PR summary. */
	pullRequestReviewerCount?: number;
	pullRequestTitle?: string;
	/** Preformatted relative PR update time, for example `1h ago`. */
	pullRequestUpdatedLabel?: string;
	pullRequestUrl?: string;
	repository?: string;
	status: JiraSidebarSessionStatus;
	/** Branch the PR merges into (e.g. `main`). */
	targetBranch?: string;
	startedAtMs?: number;
	title: string;
	worktreePath?: string;
}

export interface JiraSidebarSessionNavigation {
	activeSessionId: string;
	layoutMode: JiraSidebarLayoutMode;
	onArchiveSession: (sessionId: string) => void;
	onLayoutModeChange: (mode: JiraSidebarLayoutMode) => void;
	onReorderSession: (activeSessionId: string, overSessionId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onSortModeChange: (mode: JiraSidebarSortMode) => void;
	onStopSession: (sessionId: string) => void;
	onTogglePinSession: (sessionId: string) => void;
	orderedSessions: readonly JiraSidebarSessionItem[];
	pinnedSessionIds: ReadonlySet<string>;
	sessionsBySpaceId: Readonly<Record<string, readonly JiraSidebarSessionItem[]>>;
	sortMode: JiraSidebarSortMode;
}

interface JiraSidebarNavItem {
	actions?: React.ReactNode;
	hasChevron?: boolean;
	hasExternalLink?: boolean;
	icon: React.ReactNode;
	isExpanded?: boolean;
	isSelected?: boolean;
	label: string;
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

interface JiraSidebarProps {
	selectedItem: string;
	onSelectItem: (item: string) => void;
	sessionNavigation?: JiraSidebarSessionNavigation;
}

function JiraSessionAvatar({ session }: Readonly<{ session: JiraSidebarSessionItem }>) {
	const fallback = session.agentName.trim()[0]?.toUpperCase() ?? "A";
	const isDecorative = true;

	return (
		<Tile aria-hidden={isDecorative} label="Agent avatar" variant="transparent" size="xsmall" isSnug>
			{session.agentAvatarSrc ? (
				<TileAvatar alt="" aria-hidden shape="hexagon" src={session.agentAvatarSrc} />
			) : (
				<span className="grid size-full place-items-center text-xs font-semibold text-text-subtle">
					{fallback}
				</span>
			)}
		</Tile>
	);
}

export function JiraSessionLabel({ session }: Readonly<{ session: JiraSidebarSessionItem }>) {
	return session.status === "awaiting-input" ? (
		<span className="flex min-w-0 items-baseline">
			<Shimmer as="span" className="min-w-0 truncate" duration={1.4} spread={2}>
				Needs input
			</Shimmer>
			<AnimatedDots />
		</span>
	) : session.title;
}

export function JiraSessionLifecycle({ status }: Readonly<{ status: JiraSidebarSessionStatus }>) {
	switch (status) {
		case "awaiting-input":
			return (
				<span className="grid size-4 shrink-0 place-items-center text-icon-information" title="Needs input">
					<StatusInformationIcon label="Needs input" size="small" color="currentColor" />
				</span>
			);
		case "running":
			return <Spinner label="Running" size="xs" />;
		case "pr-open":
			return (
				<span className="grid size-4 shrink-0 place-items-center text-icon-success" title="Pull request open">
					<PullRequestIcon label="Pull request open" size="small" color="currentColor" />
				</span>
			);
		case "merged":
			return (
				<span className="grid size-4 shrink-0 place-items-center text-icon-accent-purple" title="Pull request merged">
					<MergeSuccessIcon label="Pull request merged" size="small" color="currentColor" />
				</span>
			);
		case "stopped":
			return (
				<span className="grid size-4 shrink-0 place-items-center text-icon-subtle" title="Stopped">
					<VideoStopIcon label="Stopped" size="small" color="currentColor" />
				</span>
			);
	}
}

export function JiraSessionDescription({ session }: Readonly<{ session: JiraSidebarSessionItem }>) {
	const issueDescription = `${session.issueKey}: ${session.issueSummary}`;

	return (
		<span className="flex min-w-0 items-center gap-1">
			<JiraSessionAvatar session={session} />
			<span className="shrink-0" aria-hidden="true">·</span>
			<span className="flex min-w-0 flex-1 items-center gap-0.5" title={issueDescription}>
				<span className="grid size-4 shrink-0 place-items-center text-icon-brand" aria-hidden="true">
					<TaskIcon label="" size="small" color="currentColor" />
				</span>
				<span className="shrink-0">{session.issueKey}:</span>
				<span className="truncate">{session.issueSummary}</span>
			</span>
		</span>
	);
}

function JiraSidebarSection({
	children,
	title,
}: Readonly<{
	children: React.ReactNode;
	title?: string;
}>) {
	return (
		<div className="flex flex-col gap-1">
			{title ? (
				<div className="px-1.5 text-xs font-semibold leading-4 text-text-subtlest">
					{title}
				</div>
			) : null}
			<div className="flex flex-col">{children}</div>
		</div>
	);
}

function JiraSidebarExpandableLeadingIcon({
	icon,
	isExpanded,
}: Readonly<{
	icon: React.ReactNode;
	isExpanded: boolean;
}>) {
	return (
		<span className="flex items-center justify-center">
			<span className="flex items-center justify-center group-hover/sidebar-nav-item:hidden">
				{icon}
			</span>
			<span className="hidden items-center justify-center group-hover/sidebar-nav-item:flex">
				{isExpanded ? <ChevronDownIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />}
			</span>
		</span>
	);
}

const handleSidebarActionClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
	event.stopPropagation();
};

function JiraSidebarActions() {
	return (
		<>
			<SidebarNavItemAction
				aria-label="Add"
				className="opacity-0 transition-opacity duration-normal ease-out group-hover/sidebar-nav-item:opacity-100 focus-visible:opacity-100"
				onClick={handleSidebarActionClick}
			>
				<AddIcon label="" size="small" />
			</SidebarNavItemAction>
			<SidebarNavItemAction
				aria-label="More"
				className="opacity-0 transition-opacity duration-normal ease-out group-hover/sidebar-nav-item:opacity-100 focus-visible:opacity-100"
				onClick={handleSidebarActionClick}
			>
				<ShowMoreHorizontalIcon label="" size="small" />
			</SidebarNavItemAction>
		</>
	);
}

function JiraSpacesOrganizeAction({
	layoutMode,
	onLayoutModeChange,
	onSortModeChange,
	sortMode,
}: Readonly<{
	layoutMode: JiraSidebarLayoutMode;
	onLayoutModeChange: (mode: JiraSidebarLayoutMode) => void;
	onSortModeChange: (mode: JiraSidebarSortMode) => void;
	sortMode: JiraSidebarSortMode;
}>) {
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger
				render={(
					<SidebarNavItemAction
						aria-label="Organize spaces"
						className="opacity-0 transition-opacity duration-normal ease-out group-hover/sidebar-nav-item:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
						onClick={(event) => event.stopPropagation()}
					/>
				)}
			>
				<SortOptionsIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-52" side="right" sideOffset={8}>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Organize</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={layoutMode}
						onValueChange={(value) => {
							if (value === "by-project" || value === "one-list") onLayoutModeChange(value);
						}}
					>
						<DropdownMenuRadioItem value="by-project">By project</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="one-list">In one list</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel>Sort by</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={sortMode}
						onValueChange={(value) => {
							if (value === "priority" || value === "last-updated" || value === "manual") onSortModeChange(value);
						}}
					>
						<DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="last-updated">Last updated</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="manual">Manual order</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function JiraSessionRowActions({
	isPinned,
	onArchive,
	onStop,
	onTogglePin,
	status,
	title,
}: Readonly<{
	isPinned: boolean;
	onArchive: () => void;
	onStop?: () => void;
	onTogglePin: () => void;
	status: JiraSidebarSessionStatus;
	title: string;
}>) {
	const isArchivable = status === "pr-open" || status === "merged" || status === "stopped";
	const shouldShowLifecycleAction = isArchivable || onStop !== undefined;
	const PinGlyph = isPinned ? PinFilledIcon : PinIcon;

	return (
		<>
			<SidebarNavItemAction
				aria-label={`${isPinned ? "Unpin" : "Pin"} ${title}`}
				className="opacity-0 transition-opacity duration-normal ease-out group-data-[selected=true]/sidebar-nav-item:text-icon-subtle group-hover/sidebar-nav-item:opacity-100 group-hover/chat-history-thread:opacity-100 focus-visible:opacity-100"
				onClick={(event) => {
					event.stopPropagation();
					onTogglePin();
				}}
			>
				<PinGlyph label="" size="small" />
			</SidebarNavItemAction>
			{shouldShowLifecycleAction ? (
				<SidebarNavItemAction
					aria-label={`${isArchivable ? "Archive" : "Stop"} ${title}`}
					className={cn(
						"opacity-0 transition-opacity duration-normal ease-out group-hover/sidebar-nav-item:opacity-100 group-hover/chat-history-thread:opacity-100 focus-visible:opacity-100",
						isArchivable
							? "group-data-[selected=true]/sidebar-nav-item:text-icon-subtle"
							: "text-icon-danger group-data-[selected=true]/sidebar-nav-item:text-icon-danger",
					)}
					onClick={(event) => {
						event.stopPropagation();
						if (isArchivable) onArchive();
						else onStop?.();
					}}
				>
					{isArchivable ? <ArchiveBoxIcon label="" size="small" /> : <VideoStopOverlayIcon label="" size="small" />}
				</SidebarNavItemAction>
			) : null}
		</>
	);
}

function JiraSessionRow({
	canReorder,
	flyoutHandle,
	isPinned,
	isSelected,
	onArchive,
	onSelect,
	onStop,
	onTogglePin,
	session,
}: Readonly<{
	canReorder: boolean;
	flyoutHandle: JiraSessionFlyoutHandle;
	isPinned: boolean;
	isSelected: boolean;
	onArchive: () => void;
	onSelect: () => void;
	onStop: () => void;
	onTogglePin: () => void;
	session: JiraSidebarSessionItem;
}>) {
	const {
		attributes,
		isDragging,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ disabled: !canReorder, id: session.id });
	return (
		<div
			className={cn("relative", isDragging && "z-20 opacity-80")}
			data-dragging={isDragging || undefined}
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<JiraSessionFlyoutTrigger
				handle={flyoutHandle}
				render={<div className="w-full" />}
				session={session}
			>
				<SidebarNavItem
					buttonProps={canReorder ? {
							...attributes,
							...listeners,
							style: { touchAction: "none" },
						} : undefined}
					buttonRef={setActivatorNodeRef}
					actions={(
						<JiraSessionRowActions
							isPinned={isPinned}
							onArchive={onArchive}
							onStop={onStop}
							onTogglePin={() => {
								flyoutHandle.close();
								onTogglePin();
							}}
							status={session.status}
							title={session.title}
						/>
					)}
					className={cn("min-h-11", canReorder && "cursor-grab active:cursor-grabbing")}
					description={<JiraSessionDescription session={session} />}
					isSelected={isSelected}
					label={<JiraSessionLabel session={session} />}
					meta={(
						<span className="grid size-6 shrink-0 place-items-center group-hover/sidebar-nav-item:hidden group-has-[[data-slot=button]:focus-visible]/sidebar-nav-item:hidden">
							<JiraSessionLifecycle status={session.status} />
						</span>
					)}
					onClick={onSelect}
				/>
			</JiraSessionFlyoutTrigger>
		</div>
	);
}

export function JiraProjectAvatar({
	label = "",
	src,
}: Readonly<{
	label?: string;
	size?: "small" | "medium";
	src: string;
}>) {
	const isDecorative = label === "";

	return (
		<Tile
			aria-hidden={isDecorative ? true : undefined}
			label={label || "Project avatar"}
			variant="transparent"
			size="small"
			isSnug
		>
			<TileAvatar
				alt={label}
				aria-hidden={isDecorative ? true : undefined}
				shape="square"
				src={src}
			/>
		</Tile>
	);
}

function JiraSidebarRow({
	actions,
	hasChevron = false,
	hasExternalLink = false,
	icon,
	isExpanded,
	isSelected = false,
	label,
	onClick,
}: Readonly<JiraSidebarNavItem>) {
	const leading = hasChevron ? (
		<JiraSidebarExpandableLeadingIcon icon={icon} isExpanded={isExpanded ?? false} />
	) : (
		icon
	);

	return (
		<SidebarNavItem
			actions={actions}
			isExpanded={isExpanded}
			isSelected={isSelected}
			label={label}
			leading={leading}
			leadingSize="medium"
			meta={hasExternalLink ? (
				<IconTile
					aria-hidden
					as="span"
					icon={<LinkExternalIcon label="" size="small" />}
					iconSize="small"
					label=""
					size="small"
					variant="transparent"
				/>
			) : null}
			onClick={onClick}
		/>
	);
}

export function JiraSidebar({
	selectedItem,
	onSelectItem,
	sessionNavigation,
}: Readonly<JiraSidebarProps>) {
	const router = useRouter();
	const [isSpacesExpanded, setIsSpacesExpanded] = useState(true);
	const [expandedSpaceIds, setExpandedSpaceIds] = useState<ReadonlySet<string>>(
		() => new Set(sessionNavigation ? [STARRED_PROJECTS[0]?.id].filter((id): id is string => Boolean(id)) : []),
	);
	const [sessionFlyoutHandle] = useState(createJiraSessionFlyoutHandle);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const selectItem = (item: string, href?: string) => {
		onSelectItem(item);
		if (href) {
			router.push(href);
		}
	};
	const toggleSpace = (spaceId: string) => {
		setExpandedSpaceIds((current) => {
			const next = new Set(current);
			if (next.has(spaceId)) {
				next.delete(spaceId);
			} else {
				next.add(spaceId);
			}
			return next;
		});
	};
	const allSessions = sessionNavigation?.orderedSessions ?? [];
	const pinnedSessions = sessionNavigation
		? allSessions.filter((session) => sessionNavigation.pinnedSessionIds.has(session.id))
		: [];
	const unpinnedSessions = sessionNavigation
		? allSessions.filter((session) => !sessionNavigation.pinnedSessionIds.has(session.id))
		: [];
	const renderSessionRow = (session: JiraSidebarSessionItem) => (
		<JiraSessionRow
			key={session.id}
			canReorder={sessionNavigation?.sortMode === "manual"}
			flyoutHandle={sessionFlyoutHandle}
			isPinned={sessionNavigation?.pinnedSessionIds.has(session.id) ?? false}
			isSelected={sessionNavigation?.activeSessionId === session.id}
			onArchive={() => sessionNavigation?.onArchiveSession(session.id)}
			onSelect={() => sessionNavigation?.onSelectSession(session.id)}
			onStop={() => sessionNavigation?.onStopSession(session.id)}
			onTogglePin={() => sessionNavigation?.onTogglePinSession(session.id)}
			session={session}
		/>
	);
	const handleSessionDragEnd = ({ active, over }: DragEndEvent) => {
		if (!sessionNavigation || sessionNavigation.sortMode !== "manual" || !over) return;
		const activeSessionId = String(active.id);
		const overSessionId = String(over.id);
		if (activeSessionId !== overSessionId) {
			sessionNavigation.onReorderSession(activeSessionId, overSessionId);
		}
	};

	return (
		<DndContext
			id="jira-session-navigation-dnd"
			collisionDetection={closestCenter}
			modifiers={[restrictToVerticalAxis]}
			onDragEnd={handleSessionDragEnd}
			sensors={sensors}
		>
			<nav aria-label="Jira" className="flex shrink-0 flex-col gap-3">
			<JiraSidebarSection>
				<JiraSidebarRow
					icon={<PersonAvatarIcon label="" />}
					label="For you"
					isSelected={selectedItem === "For you"}
					onClick={() => selectItem("For you")}
				/>
				<JiraSidebarRow
					icon={<ClockIcon label="" />}
					label="Recent"
					hasChevron
					onClick={() => selectItem("Recent")}
				/>
				<JiraSidebarRow
					icon={<StarUnstarredIcon label="" />}
					label="Starred"
					hasChevron
					onClick={() => selectItem("Starred")}
				/>
				<JiraSidebarRow
					icon={<AppsIcon label="" />}
					label="Apps"
					hasChevron
					isExpanded={false}
					onClick={() => selectItem("Apps")}
				/>
				<JiraSidebarRow
					icon={<RoadmapIcon label="" />}
					label="Roadmaps"
					onClick={() => selectItem("Roadmaps")}
				/>
				<JiraSidebarRow
					actions={<JiraSidebarActions />}
					icon={<PlanIcon label="" />}
					label="Plans"
					hasChevron
					isExpanded={false}
					onClick={() => selectItem("Plans")}
				/>
				<JiraSidebarRow
					actions={sessionNavigation ? (
						<>
							<JiraSpacesOrganizeAction
								layoutMode={sessionNavigation.layoutMode}
								onLayoutModeChange={sessionNavigation.onLayoutModeChange}
								onSortModeChange={sessionNavigation.onSortModeChange}
								sortMode={sessionNavigation.sortMode}
							/>
							<JiraSidebarActions />
						</>
					) : <JiraSidebarActions />}
					icon={<SpacesIcon label="" />}
					label="Spaces"
					hasChevron
					isExpanded={isSpacesExpanded}
					onClick={() => setIsSpacesExpanded((prev) => !prev)}
				/>
			</JiraSidebarSection>

			{isSpacesExpanded ? (
				<div className="flex flex-col gap-3">
					{pinnedSessions.length > 0 ? (
						<JiraSidebarSection title="Pinned">
							<SortableContext
								items={pinnedSessions.map((session) => session.id)}
								strategy={verticalListSortingStrategy}
							>
								<div className="flex flex-col gap-0.5 pl-3">
									{pinnedSessions.map(renderSessionRow)}
								</div>
							</SortableContext>
						</JiraSidebarSection>
					) : null}
					<JiraSidebarSection title="Starred">
						<div className="flex flex-col pl-3">
							{sessionNavigation?.layoutMode === "one-list" ? (
								<SortableContext
									items={unpinnedSessions.map((session) => session.id)}
									strategy={verticalListSortingStrategy}
								>
									<div className="flex flex-col gap-0.5">
										{unpinnedSessions.map(renderSessionRow)}
									</div>
								</SortableContext>
							) : (
								STARRED_PROJECTS.map((project, projectIndex) => {
									const sessions = (sessionNavigation?.sessionsBySpaceId[project.id] ?? [])
										.filter((session) => !sessionNavigation?.pinnedSessionIds.has(session.id));
									const hasSessions = sessions.length > 0;
									const isExpanded = hasSessions && expandedSpaceIds.has(project.id);

									return (
										<div
											key={project.id}
											className={cn(isExpanded && projectIndex < STARRED_PROJECTS.length - 1 && "mb-3")}
										>
											<SidebarNavItem
												label={project.name}
												leading={hasSessions ? (
													<JiraSidebarExpandableLeadingIcon
														icon={<JiraProjectAvatar src={project.imageSrc} />}
														isExpanded={isExpanded}
													/>
												) : <JiraProjectAvatar src={project.imageSrc} />}
												leadingSize="medium"
												isExpanded={hasSessions ? isExpanded : undefined}
												isSelected={!hasSessions && selectedItem === project.name}
												onClick={() => {
													selectItem(project.name);
													if (hasSessions) toggleSpace(project.id);
												}}
												className="min-h-7"
											/>
											{isExpanded ? (
												<SortableContext
													items={sessions.map((session) => session.id)}
													strategy={verticalListSortingStrategy}
												>
													<div className="flex flex-col gap-0.5 pl-4">
														{sessions.map(renderSessionRow)}
													</div>
												</SortableContext>
											) : null}
										</div>
									);
								})
							)}
							<SidebarNavItem
								label="View all plans"
								leading={<AlignTextLeftIcon label="" />}
								leadingSize="medium"
								onClick={() => selectItem("View all plans")}
								className="min-h-7"
							/>
						</div>
						<JiraSidebarRow
							icon={<DashboardIcon label="" />}
							label="Dashboards"
							onClick={() => selectItem("Dashboards")}
						/>
					</JiraSidebarSection>
				</div>
			) : null}

			<JiraSidebarSection>
				{JIRA_EXTERNAL_LINKS.map((link) => (
					<JiraSidebarRow
						key={link.id}
						icon={<link.icon label="" />}
						label={link.label}
						hasExternalLink
						onClick={() => selectItem(link.label, link.href)}
					/>
				))}
			</JiraSidebarSection>

			<JiraSidebarSection>
				<JiraSidebarRow
					icon={<ShowMoreHorizontalIcon label="" />}
					label="More"
					onClick={() => selectItem("More")}
				/>
			</JiraSidebarSection>
			</nav>
			{sessionNavigation ? (
				<JiraSessionFlyoutSurface handle={sessionFlyoutHandle} />
			) : null}
		</DndContext>
	);
}
