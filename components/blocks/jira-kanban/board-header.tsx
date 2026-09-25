"use client";

import { useMemo, useState, type ReactNode } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import ChartTrendIcon from "@atlaskit/icon/core/chart-trend";
import FilterIcon from "@atlaskit/icon/core/filter";
import PersonAddIcon from "@atlaskit/icon/core/person-add";
import SearchIcon from "@atlaskit/icon/core/search";
import SettingsIcon from "@atlaskit/icon/core/settings";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import GroupIcon from "@atlaskit/icon-lab/core/group";

import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarImage,
	AvatarUnassigned,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollMask } from "@/components/visual/scroll-mask";
import { JiraProjectAvatar } from "@/components/blocks/product-sidebar/variants/jira";
import { JIRA_DESIGN_PROJECT } from "@/components/blocks/product-sidebar/data/jira-navigation";
import { cn } from "@/lib/utils";
import type { JiraKanbanAssigneeData } from "./index";

const FILTER_FIELDS = [
	"Project",
	"Parent",
	"Assignee",
	"Status",
	"Work type",
	"Labels",
] as const;

interface JiraKanbanBoardHeaderProps {
	assignees: readonly JiraKanbanAssigneeData[];
	compact?: boolean;
	onSelectedAssigneeIdsChange: (assigneeIds: Set<string>) => void;
	searchPlaceholder?: string;
	selectedAssigneeIds: ReadonlySet<string>;
	surfaceLabel?: string;
	viewTabs?: ReactNode;
}

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
	return (
		<Avatar
			className={cn(
				showGroupStroke && "ring-2 ring-background",
				selected && "ring-2! ring-border-selected!",
				muted && "opacity-(--opacity-disabled)",
			)}
			label={assignee.name}
			size="sm"
		>
			<AvatarImage alt="" src={assignee.avatarSrc} />
			<AvatarFallback>{assignee.name.slice(0, 1)}</AvatarFallback>
		</Avatar>
	);
}

export function JiraKanbanBoardHeader({
	assignees,
	compact = false,
	onSelectedAssigneeIdsChange,
	searchPlaceholder = "Search board",
	selectedAssigneeIds,
	surfaceLabel = "board",
	viewTabs,
}: Readonly<JiraKanbanBoardHeaderProps>) {
	const [filterOpen, setFilterOpen] = useState(false);
	const [query, setQuery] = useState("");
	const filteredAssignees = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		return normalizedQuery
			? assignees.filter((assignee) => assignee.name.toLocaleLowerCase().includes(normalizedQuery))
			: assignees;
	}, [assignees, query]);
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
		<header className="shrink-0 pb-4 pt-3">
			<div className="flex min-w-0 items-center gap-2 px-4">
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

			<div className="mt-4 flex flex-wrap items-center gap-2 px-4">
				<InputGroup className="w-44">
					<InputGroupAddon>
						<Icon render={<SearchIcon label="" size="small" />} />
					</InputGroupAddon>
					<InputGroupInput aria-label={searchPlaceholder} placeholder={searchPlaceholder} readOnly />
				</InputGroup>

				<AvatarGroup
					className="ml-1 -space-x-1.5"
					label={`${surfaceTitle} assignees`}
				>
					<AvatarUnassigned kind="person" label="Unassigned" size="sm" />
					{assignees.slice(0, 6).map((assignee) => (
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

				<Popover open={filterOpen} onOpenChange={setFilterOpen}>
					<PopoverTrigger
						render={
							<Button
								aria-expanded={filterOpen}
								aria-label={hasSelection ? `Filter ${surfaceLabel}, ${selectedAssigneeIds.size} selected` : `Filter ${surfaceLabel}`}
								aria-pressed={hasSelection}
								size={compact ? "icon" : undefined}
								variant="outline"
							/>
						}
					>
						<Icon render={<FilterIcon label="" />} />
						{compact ? null : "Filter"}
						{hasSelection && !compact ? <Badge variant="information">{selectedAssigneeIds.size}</Badge> : null}
					</PopoverTrigger>
					<PopoverContent align="start" className="w-[560px] max-w-[calc(100vw-32px)] gap-0 overflow-hidden p-0">
						<div className="grid h-[360px] grid-cols-[200px_minmax(0,1fr)]">
							<div className="border-r border-border p-3">
								<Button aria-disabled variant="ghost">
									<Icon data-icon="inline-start" render={<AddIcon label="" size="small" />} />
									Add field
								</Button>
								<div className="mt-2">
									{FILTER_FIELDS.map((field) => {
										const enabled = field === "Assignee";
										return (
											<Button
												aria-current={enabled ? "page" : undefined}
												className="w-full justify-start"
												disabled={!enabled}
												key={field}
												variant={enabled ? "secondary" : "ghost"}
											>
												{field}
											</Button>
										);
									})}
								</div>
							</div>

							<div className="flex min-h-0 min-w-0 flex-col p-3">
								<InputGroup>
									<InputGroupAddon>
										<Icon render={<SearchIcon label="" size="small" />} />
									</InputGroupAddon>
									<InputGroupInput
										aria-label="Search assignee"
										onChange={(event) => setQuery(event.target.value)}
										placeholder="Search assignee"
										value={query}
									/>
								</InputGroup>

								<ScrollMask
									className="mt-2 min-h-0 flex-1 rounded-none border-0 bg-transparent"
									footer={
										<div className="flex items-center justify-between gap-3">
											<p className="text-xs text-text-subtle">{selectedAssigneeIds.size} selected</p>
											<Button
												disabled={!hasSelection}
												onClick={() => onSelectedAssigneeIdsChange(new Set())}
												size="compact"
												variant="ghost"
											>
												Clear all
											</Button>
										</div>
									}
									footerClassName="bg-popover px-0 pb-0 pt-3"
									viewportClassName="[scrollbar-gutter:auto]"
								>
									{filteredAssignees.map((assignee) => (
										<label
											className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-neutral-subtle-hovered"
											key={assignee.id}
										>
											<Checkbox
												checked={selectedAssigneeIds.has(assignee.id)}
												onCheckedChange={() => toggleAssignee(assignee.id)}
											/>
											<AssigneeAvatar assignee={assignee} />
											<span className="min-w-0 truncate text-sm">{assignee.name}</span>
										</label>
									))}
									{filteredAssignees.length === 0 ? (
										<p className="px-2 py-6 text-center text-sm text-text-subtle">No assignees found</p>
									) : null}
								</ScrollMask>
							</div>
						</div>
					</PopoverContent>
				</Popover>

				<Button aria-disabled aria-label={`Group ${surfaceLabel}`} size={compact ? "icon" : undefined} variant="outline">
					<Icon render={<GroupIcon label="" />} />
					{compact ? null : "Group"}
				</Button>

				<div className={cn("flex items-center gap-1", compact ? undefined : "ml-auto")}>
					{compact ? (
						<Button aria-disabled aria-label={`More ${surfaceLabel} controls`} size="icon" variant="outline">
							<Icon render={<ShowMoreHorizontalIcon label="" />} />
						</Button>
					) : (
						<>
							<Button aria-disabled aria-label="View insights" size="icon" variant="outline">
								<Icon render={<ChartTrendIcon label="" />} />
							</Button>
							<Button aria-disabled aria-label={`${surfaceTitle} settings`} size="icon" variant="outline">
								<Icon render={<SettingsIcon label="" />} />
							</Button>
							<Button aria-disabled aria-label={`More ${surfaceLabel} controls`} size="icon" variant="outline">
								<Icon render={<ShowMoreHorizontalIcon label="" />} />
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
