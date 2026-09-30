"use client";

import type { ReactNode } from "react";
import BoardIcon from "@atlaskit/icon/core/board";
import PersonAddIcon from "@atlaskit/icon/core/person-add";
import SearchIcon from "@atlaskit/icon/core/search";
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
import { cn } from "@/lib/utils";
import type { JiraKanbanAssigneeData } from "../index";
import { BoardViewMenu } from "../experimental/components/board-view-menu";
import {
	JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME,
	JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS,
} from "../experimental/header-facepile";

/**
 * Experimental v2 fork of `components/blocks/jira-kanban/experimental/experimental-board-header.tsx`.
 * Starts identical to the experimental board header and diverges independently.
 */
interface ExperimentalV2JiraKanbanBoardHeaderProps {
	activeView?: ExperimentalV2JiraKanbanView;
	assignees: readonly JiraKanbanAssigneeData[];
	compact?: boolean;
	onSelectedAssigneeIdsChange: (assigneeIds: Set<string>) => void;
	onViewChange?: (view: ExperimentalV2JiraKanbanView) => void;
	searchPlaceholder?: string;
	selectedAssigneeIds: ReadonlySet<string>;
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
	filterControl: ReactNode;
	/** Mode control, rendered inline with Filter and Group. */
	modeToggle?: ReactNode;
	/**
	 * Trailing cluster end slot — after the board/list view switcher.
	 */
	endSlot?: ReactNode;
	surfaceLabel?: string;
	viewTabs?: ReactNode;
}

export type ExperimentalV2JiraKanbanView = "board" | "list";

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
	const isAgent = assignee.avatarSrc?.startsWith("/avatar-agent/") ?? false;

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

export function ExperimentalV2JiraKanbanBoardHeader({
	activeView = "board",
	assignees,
	compact = false,
	onSelectedAssigneeIdsChange,
	onViewChange,
	searchPlaceholder = "Search board",
	selectedAssigneeIds,
	showBoardControls = true,
	facepile,
	filterControl,
	modeToggle,
	endSlot,
	surfaceLabel = "board",
	viewTabs,
}: Readonly<ExperimentalV2JiraKanbanBoardHeaderProps>) {
	const hasSelection = selectedAssigneeIds.size > 0;
	const surfaceTitle = `${surfaceLabel.slice(0, 1).toLocaleUpperCase()}${surfaceLabel.slice(1)}`;

	const toggleAssignee = (assigneeId: string) => {
		const nextSelection = new Set(selectedAssigneeIds);
		if (nextSelection.has(assigneeId)) {
			nextSelection.delete(assigneeId);
		} else {
			nextSelection.add(assigneeId);
		}
		onSelectedAssigneeIdsChange(nextSelection);
	};

	return (
		<header className={cn("shrink-0 pt-3", showBoardControls ? "pb-6" : "pb-0")}>
			<div className="flex min-w-0 items-center gap-2 px-6">
				<JiraProjectAvatar label={JIRA_DESIGN_PROJECT.name} src={JIRA_DESIGN_PROJECT.imageSrc} />
				<Heading as="h1" className="truncate" size="large">Jira Design</Heading>
				<div className="flex items-center gap-1">
					<Button aria-disabled aria-label="Add people" size="icon" variant="ghost">
						<Icon render={<PersonAddIcon label="" />} />
					</Button>
					<Button aria-disabled aria-label={`More ${surfaceLabel} actions`} size="icon" variant="ghost">
						<Icon render={<ShowMoreHorizontalIcon label="" />} />
					</Button>
				</div>
			</div>
			{viewTabs ? <div className="mt-2">{viewTabs}</div> : null}

			{showBoardControls ? (
				<div className="mt-6 flex flex-wrap items-center gap-2 px-6">
					<InputGroup className="w-44">
						<InputGroupAddon>
							<Icon render={<SearchIcon label="" size="small" />} />
						</InputGroupAddon>
						<InputGroupInput aria-label={searchPlaceholder} placeholder={searchPlaceholder} readOnly />
					</InputGroup>

					{facepile ?? (
						<>
						{/* Facepile stacks leftmost-on-top: keep DOM order (so tab order matches
					    left→right visual order) and assign descending z-index instead. `isolate`
					    contains these low z-indexes; `[&>*]:relative` is required because the
					    face <button> wrappers are position:static, where z-index is inert. */}
					<AvatarGroup
						className={JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME}
						label={`${surfaceTitle} assignees`}
					>
						<AvatarUnassigned kind="person" label="Unassigned" size="sm" />
						{assignees.slice(0, JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS - 1).map((assignee) => (
							<button
								aria-label={`Filter ${surfaceLabel} by ${assignee.name}`}
								aria-pressed={selectedAssigneeIds.has(assignee.id)}
								className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
								key={assignee.id}
								onClick={() => toggleAssignee(assignee.id)}
								type="button"
							>
								<AssigneeAvatar
									assignee={assignee}
									muted={hasSelection && !selectedAssigneeIds.has(assignee.id)}
									selected={selectedAssigneeIds.has(assignee.id)}
									showGroupStroke
								/>
							</button>
						))}
					</AvatarGroup>
						</>
					)}

					{filterControl}

					<BoardViewMenu compact={compact} surfaceLabel={surfaceLabel} />

					{modeToggle}
					<Button aria-disabled aria-label={`More ${surfaceLabel} controls`} size="icon" variant="outline">
						<Icon render={<ShowMoreHorizontalIcon label="" />} />
					</Button>

					<div className={cn("flex items-center gap-1", compact ? undefined : "ml-auto")}>
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
					</div>
				</div>
			) : null}
		</header>
	);
}
