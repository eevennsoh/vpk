"use client";

import type { ReactNode } from "react";
import BoardIcon from "@atlaskit/icon/core/board";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import ExpandHorizontalIcon from "@atlaskit/icon/core/expand-horizontal";
import PersonAddIcon from "@atlaskit/icon/core/person-add";
import SearchIcon from "@atlaskit/icon/core/search";
import ShareIcon from "@atlaskit/icon/core/share";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import TableIcon from "@atlaskit/icon/core/table";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarImage,
	AvatarUnassigned,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JiraProjectAvatar } from "@/components/blocks/product-sidebar/variants/jira";
import { JIRA_DESIGN_PROJECT } from "@/components/blocks/product-sidebar/data/jira-navigation";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { JiraKanbanAssigneeData } from "../index";
import {
	BoardGroupByMenu,
	BoardNeedsInputButton,
	BoardViewMenu,
} from "./components/board-view-menu";
import type { BoardAgentFilterId, BoardAgentSessionStateId } from "./data/board-view-options";
import {
	JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME,
	JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS,
} from "./header-facepile";

const EMPTY_ASSIGNEE_IDS: ReadonlySet<string> = new Set();

function toggleSelectedAssigneeId(
	selectedAssigneeIds: ReadonlySet<string>,
	assigneeId: string,
	onSelectedAssigneeIdsChange?: (assigneeIds: Set<string>) => void,
) {
	if (!onSelectedAssigneeIdsChange) {
		return;
	}
	const nextSelection = new Set(selectedAssigneeIds);
	if (nextSelection.has(assigneeId)) {
		nextSelection.delete(assigneeId);
	} else {
		nextSelection.add(assigneeId);
	}
	onSelectedAssigneeIdsChange(nextSelection);
}

/**
 * Experimental fork of `components/blocks/jira-kanban/board-header.tsx`.
 * Starts identical to the default board header and diverges independently.
 */
interface ExperimentalJiraKanbanBoardHeaderProps {
	activeView?: ExperimentalJiraKanbanView;
	assignees?: readonly JiraKanbanAssigneeData[];
	compact?: boolean;
	/**
	 * Trailing inset in px for the control row, matching the width of a docked
	 * side panel. The panel covers this band, so without it the row's trailing
	 * cluster (the view switcher) would sit underneath and be unclickable. The
	 * row still keeps its `px-6` end gutter on top of that inset so the cluster
	 * does not sit flush against the rail's notches. Board columns below still
	 * slide under the panel.
	 */
	controlsInsetEnd?: number;
	onSelectedAssigneeIdsChange?: (assigneeIds: Set<string>) => void;
	onViewChange?: (view: ExperimentalJiraKanbanView) => void;
	searchPlaceholder?: string;
	selectedAssigneeIds?: ReadonlySet<string>;
	/**
	 * The control row (search, facepile, filter, group, right-hand icon
	 * buttons). Pulse deliberately keeps it: the facepile is its roster filter
	 * and the mode toggle sits in the same row, so hiding it would take the
	 * primary filter away with it.
	 */
	showBoardControls?: boolean;
	/**
	 * Replaces the assignee facepile. Pulse swaps in its own roster — humans and
	 * agents — so one facepile drives whichever surface is showing.
	 */
	facepile?: ReactNode;
	/** Clickable Filter control, including the two-pane popover. */
	filterControl?: ReactNode;
	/** Mode control, rendered inline with Filter and Group. */
	modeToggle?: ReactNode;
	/**
	 * Trailing cluster slot after the board/list view switcher and before
	 * the Configure / More pair.
	 */
	endSlot?: ReactNode;
	/**
	 * Where the overflow ("…") control sits when it is shown. `"inline"` keeps
	 * it with Filter / Group. `"end"` parks it after Customize.
	 */
	moreControlsPlacement?: "inline" | "end";
	/**
	 * Overflow ("…") control. Simple views omits it; missing capability stays
	 * display-only when the control is shown.
	 */
	showMoreControls?: boolean;
	/**
	 * Outline Customize control before More when both sit at the end. Shown
	 * when Simple views is off; missing capability stays display-only.
	 */
	showCustomizeControl?: boolean;
	surfaceLabel?: string;
	shownSessionStateIds?: ReadonlySet<BoardAgentSessionStateId>;
	onShownSessionStateIdsChange?: (shownSessionStateIds: Set<BoardAgentSessionStateId>) => void;
	showUntracked?: boolean;
	onShowUntrackedChange?: (showUntracked: boolean) => void;
	agentFilterId?: BoardAgentFilterId | null;
	onAgentFilterIdChange?: (agentFilterId: BoardAgentFilterId | null) => void;
	/** Renders Team EU26's focused Needs input and Group by controls. */
	needsInputCount?: number;
	/**
	 * Reveals Column size, Hide done, and Show fields in View. The route owns
	 * Simple views so this header does not read the design-variant store.
	 */
	simpleViews?: boolean;
	viewTabs?: ReactNode;
	/** Project name in the title cluster. Defaults to the Jira Design space. */
	title?: string;
}

export type ExperimentalJiraKanbanView = "board" | "list";

/**
 * Offset in px from the board root's top edge to the *underside of the tab
 * strip's rule* — the header's `pt-3` (12) plus the title+tabs band (89), plus
 * one for the rule itself (102). The Spaces label sits above the heading, so
 * this band is taller than the previous 71px title+tabs stack: 16px `text-xs`
 * line-height plus 2px `gap-0.5`.
 *
 * That last pixel is the whole point of this constant, and is why it is not
 * simply the band's height. The `line` tabs variant draws its rule as an inset
 * box-shadow on the list's own bottom edge, and the list carries `-mb-px pb-px`
 * so that edge hangs 1px *below* the band's content box. A docked side panel
 * placed at the band height (101) therefore starts on the rule's own row and
 * punches a hole in it for the panel's width. Landing at 102 is immediately
 * beneath the rule, so the rule runs unbroken across the board.
 *
 * The untracked-work rail takes this as a real `top` offset rather than
 * spanning the board root and padding its content — the element must
 * genuinely stop at the tabs, not just appear to. Full height from this
 * line to the page bottom wins over lining the header up with the
 * search/filter row.
 *
 * Browser-measured, not nominal. `tests/blocks/agent-session-panel.spec.ts`
 * asserts the panel's top equals the tab strip's bottom *exactly*; the
 * tolerance there is zero precisely because a 1px drift is invisible to
 * review but very visible on screen.
 */
export const BOARD_HEADER_TAB_STRIP_BOTTOM_PX = 102;

function AssigneeAvatar({
	assignee,
	muted,
	selected,
	showGroupStroke,
}: Readonly<{
	assignee: JiraKanbanAssigneeData;
	muted?: boolean;
	selected?: boolean;
	showGroupStroke?: boolean;
}>) {
	const isAgent = assignee.avatarSrc.startsWith("/avatar-agent/");

	return (
		<Avatar
			className={cn(
				showGroupStroke && !isAgent && "ring-2 ring-background",
				selected && !isAgent && "ring-2! ring-border-selected!",
				muted && "opacity-(--opacity-disabled)",
			)}
			label={assignee.name}
			shape={isAgent ? "hexagon" : "circle"}
			size="sm"
		>
			<AvatarImage alt="" src={assignee.avatarSrc} />
			<AvatarFallback>{assignee.name.slice(0, 1)}</AvatarFallback>
		</Avatar>
	);
}

export function ExperimentalJiraKanbanBoardHeader({
	activeView = "board",
	assignees = [],
	compact = false,
	controlsInsetEnd = 0,
	onSelectedAssigneeIdsChange,
	onViewChange,
	searchPlaceholder = "Search board",
	selectedAssigneeIds = EMPTY_ASSIGNEE_IDS,
	showBoardControls = true,
	facepile,
	filterControl,
	modeToggle,
	endSlot,
	moreControlsPlacement = "inline",
	showMoreControls = true,
	showCustomizeControl = false,
	surfaceLabel = "board",
	shownSessionStateIds,
	onShownSessionStateIdsChange,
	showUntracked,
	onShowUntrackedChange,
	agentFilterId,
	onAgentFilterIdChange,
	needsInputCount,
	simpleViews,
	viewTabs,
	title = JIRA_DESIGN_PROJECT.name,
}: Readonly<ExperimentalJiraKanbanBoardHeaderProps>) {
	return (
		<header className={cn("shrink-0 pt-3", showBoardControls ? "pb-6" : "pb-0")}>
			<BoardHeaderTitleCluster surfaceLabel={surfaceLabel} title={title} />
			{viewTabs ? <div className="mt-2">{viewTabs}</div> : null}
			{showBoardControls ? (
				<BoardHeaderControlsRow
					activeView={activeView}
					assignees={assignees}
					compact={compact}
					controlsInsetEnd={controlsInsetEnd}
					moreControlsPlacement={moreControlsPlacement}
					onSelectedAssigneeIdsChange={onSelectedAssigneeIdsChange}
					onShowUntrackedChange={onShowUntrackedChange}
					onShownSessionStateIdsChange={onShownSessionStateIdsChange}
					onViewChange={onViewChange}
					searchPlaceholder={searchPlaceholder}
					selectedAssigneeIds={selectedAssigneeIds}
					showCustomizeControl={showCustomizeControl}
					showMoreControls={showMoreControls}
					showUntracked={showUntracked}
					shownSessionStateIds={shownSessionStateIds}
					agentFilterId={agentFilterId}
					onAgentFilterIdChange={onAgentFilterIdChange}
					needsInputCount={needsInputCount}
					simpleViews={simpleViews}
					surfaceLabel={surfaceLabel}
					{...{ endSlot, facepile, filterControl, modeToggle }}
				/>
			) : null}
		</header>
	);
}

function BoardHeaderTitleCluster({
	surfaceLabel,
	title,
}: Readonly<{
	surfaceLabel: string;
	title: string;
}>) {
	return (
		<div className="flex min-w-0 items-center justify-between gap-2 px-6">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-xs text-text-subtlest">Spaces</span>
				<div className="flex min-w-0 items-center gap-2">
					<JiraProjectAvatar label={title} src={JIRA_DESIGN_PROJECT.imageSrc} />
					<Heading as="h1" className="min-w-0 truncate" size="medium">{title}</Heading>
					<div className="flex shrink-0 items-center gap-1">
						<Button aria-disabled aria-label="Add people" size="icon" variant="ghost">
							<Icon render={<PersonAddIcon label="" />} />
						</Button>
						<Button aria-disabled aria-label={`More ${surfaceLabel} actions`} size="icon" variant="ghost">
							<Icon render={<ShowMoreHorizontalIcon label="" />} />
						</Button>
					</div>
				</div>
			</div>
			<div className="flex shrink-0 gap-2">
				<Button aria-disabled aria-label="Share" size="icon" variant="ghost">
					<Icon render={<ShareIcon label="" />} />
				</Button>
				<Button aria-disabled aria-label="Expand" size="icon" variant="ghost">
					<Icon render={<ExpandHorizontalIcon label="" />} />
				</Button>
			</div>
		</div>
	);
}

function BoardHeaderDefaultFacepile({
	assignees,
	onSelectedAssigneeIdsChange,
	selectedAssigneeIds,
	surfaceLabel,
}: Readonly<{
	assignees: readonly JiraKanbanAssigneeData[];
	onSelectedAssigneeIdsChange?: (assigneeIds: Set<string>) => void;
	selectedAssigneeIds: ReadonlySet<string>;
	surfaceLabel: string;
}>) {
	const hasSelection = selectedAssigneeIds.size > 0;
	const surfaceTitle = `${surfaceLabel.slice(0, 1).toLocaleUpperCase()}${surfaceLabel.slice(1)}`;

	return (
		<>
			<AvatarGroup
				className={JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME}
				label={`${surfaceTitle} assignees`}
			>
				<AvatarUnassigned kind="person" label="Unassigned" size="sm" />
				{assignees.slice(0, JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS - 1).map((assignee) => (
					<BoardHeaderAssigneeFacepileItem
						assignee={assignee}
						key={assignee.id}
						muted={hasSelection && !selectedAssigneeIds.has(assignee.id)}
						onSelectedAssigneeIdsChange={onSelectedAssigneeIdsChange}
						selected={selectedAssigneeIds.has(assignee.id)}
						selectedAssigneeIds={selectedAssigneeIds}
						surfaceLabel={surfaceLabel}
					/>
				))}
			</AvatarGroup>
		</>
	);
}

function BoardHeaderAssigneeFacepileItem({
	assignee,
	muted,
	onSelectedAssigneeIdsChange,
	selected,
	selectedAssigneeIds,
	surfaceLabel,
}: Readonly<{
	assignee: JiraKanbanAssigneeData;
	muted: boolean;
	onSelectedAssigneeIdsChange?: (assigneeIds: Set<string>) => void;
	selected: boolean;
	selectedAssigneeIds: ReadonlySet<string>;
	surfaceLabel: string;
}>) {
	const avatar = (
		<AssigneeAvatar assignee={assignee} muted={muted} selected={selected} showGroupStroke />
	);

	if (!onSelectedAssigneeIdsChange) {
		return (
			<span className="rounded-full">
				{avatar}
			</span>
		);
	}

	return (
		<button
			aria-label={`Filter ${surfaceLabel} by ${assignee.name}`}
			aria-pressed={selected}
			className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
			onClick={() => {
				toggleSelectedAssigneeId(
					selectedAssigneeIds,
					assignee.id,
					onSelectedAssigneeIdsChange,
				);
			}}
			type="button"
		>
			{avatar}
		</button>
	);
}

function BoardHeaderControlsRow({
	activeView,
	agentFilterId,
	assignees,
	compact,
	controlsInsetEnd,
	endSlot,
	facepile,
	filterControl,
	modeToggle,
	moreControlsPlacement,
	onAgentFilterIdChange,
	needsInputCount,
	onSelectedAssigneeIdsChange,
	onShowUntrackedChange,
	onShownSessionStateIdsChange,
	onViewChange,
	searchPlaceholder,
	selectedAssigneeIds,
	showCustomizeControl,
	showMoreControls,
	showUntracked,
	shownSessionStateIds,
	simpleViews,
	surfaceLabel,
}: Readonly<{
	activeView: ExperimentalJiraKanbanView;
	agentFilterId?: BoardAgentFilterId | null;
	assignees: readonly JiraKanbanAssigneeData[];
	compact: boolean;
	controlsInsetEnd: number;
	endSlot?: ReactNode;
	facepile?: ReactNode;
	filterControl?: ReactNode;
	modeToggle?: ReactNode;
	moreControlsPlacement: "inline" | "end";
	onAgentFilterIdChange?: (agentFilterId: BoardAgentFilterId | null) => void;
	needsInputCount?: number;
	onSelectedAssigneeIdsChange?: (assigneeIds: Set<string>) => void;
	onShowUntrackedChange?: (showUntracked: boolean) => void;
	onShownSessionStateIdsChange?: (shownSessionStateIds: Set<BoardAgentSessionStateId>) => void;
	onViewChange?: (view: ExperimentalJiraKanbanView) => void;
	searchPlaceholder: string;
	selectedAssigneeIds: ReadonlySet<string>;
	showCustomizeControl: boolean;
	showMoreControls: boolean;
	showUntracked?: boolean;
	shownSessionStateIds?: ReadonlySet<BoardAgentSessionStateId>;
	simpleViews?: boolean;
	surfaceLabel: string;
}>) {
	const moreControls = showMoreControls ? (
		<Button aria-disabled aria-label={`More ${surfaceLabel} controls`} size="icon" variant="outline">
			<Icon render={<ShowMoreHorizontalIcon label="" />} />
		</Button>
	) : null;
	const customizeControl = showCustomizeControl ? (
		<Button aria-disabled aria-label="Customize" size="icon" variant="outline">
			<Icon render={<CustomizeIcon label="" />} />
		</Button>
	) : null;

	return (
		<div
			className="mt-6 flex flex-wrap items-center gap-2 px-6"
			// Board columns are meant to slide under the panel, but the row's
			// trailing cluster (view switcher) must stay clickable. `px-6` is
			// overridden by this inline padding, so add the same 24px gutter
			// back on top of the panel width or the cluster sits on the rail.
			style={
				controlsInsetEnd > 0
					? { paddingInlineEnd: `calc(${controlsInsetEnd}px + ${token("space.300")})` }
					: undefined
			}
		>
			<InputGroup className="w-44">
				<InputGroupAddon>
					<Icon render={<SearchIcon label="" size="small" />} />
				</InputGroupAddon>
				<InputGroupInput aria-label={searchPlaceholder} placeholder={searchPlaceholder} readOnly />
			</InputGroup>

			{facepile ?? (
				<BoardHeaderDefaultFacepile
					assignees={assignees}
					onSelectedAssigneeIdsChange={onSelectedAssigneeIdsChange}
					selectedAssigneeIds={selectedAssigneeIds}
					surfaceLabel={surfaceLabel}
				/>
			)}

			{filterControl}

			{needsInputCount !== undefined ? (
				<>
					<BoardGroupByMenu />
					<BoardNeedsInputButton
						agentFilterId={agentFilterId}
						count={needsInputCount}
						onAgentFilterIdChange={onAgentFilterIdChange}
					/>
				</>
			) : (
				<BoardViewMenu
					compact={compact}
					agentFilterId={agentFilterId}
					onAgentFilterIdChange={onAgentFilterIdChange}
					onShownSessionStateIdsChange={onShownSessionStateIdsChange}
					onShowUntrackedChange={onShowUntrackedChange}
					shownSessionStateIds={shownSessionStateIds}
					showUntracked={showUntracked}
					simpleViews={simpleViews}
					surfaceLabel={surfaceLabel}
				/>
			)}

			{modeToggle}
			{moreControlsPlacement === "inline" ? moreControls : null}

			<div className={cn("flex items-center gap-2", compact ? undefined : "ml-auto")}>
				{onViewChange ? (
					<Tabs
						onValueChange={(value) => {
							if (value === "board" || value === "list") {
								onViewChange(value);
							}
						}}
						value={activeView}
					>
						<TabsList aria-label="Work items view">
							<TabsTrigger value="board">
								<Icon aria-hidden render={<BoardIcon label="" />} />
								Board
							</TabsTrigger>
							<TabsTrigger value="list">
								<Icon aria-hidden render={<TableIcon label="" />} />
								List
							</TabsTrigger>
						</TabsList>
					</Tabs>
				) : null}
				{endSlot ? endSlot : null}
				{customizeControl}
				{moreControlsPlacement === "end" ? moreControls : null}
			</div>
		</div>
	);
}
