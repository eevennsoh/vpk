import FilterIcon from "@atlaskit/icon/core/filter";
import SearchIcon from "@atlaskit/icon/core/search";

import { JiraListAvatar } from "@/components/blocks/jira-list/jira-list-cells";
import type { JiraListPerson } from "@/components/blocks/jira-list/jira-list-types";
import { AvatarGroup, AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupInput, InputGroupSearchAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { BACKLOG_STATUS_OPTIONS, type JiraBacklogProps, type JiraBacklogStatus } from "./types";

interface BacklogToolbarProps {
	query: string;
	countLabel: string;
	onQueryChange: (query: string) => void;
	people: readonly JiraListPerson[];
	assigneeIds: ReadonlySet<string | undefined>;
	onToggleAssignee: (id: string | undefined) => void;
	statuses: ReadonlySet<JiraBacklogStatus>;
	statusOptions?: JiraBacklogProps["statusOptions"];
	onToggleStatus: (status: JiraBacklogStatus) => void;
}

function AssigneeFilter({ person, assigneeIds, onToggleAssignee }: Readonly<{
	person?: JiraListPerson;
	assigneeIds: BacklogToolbarProps["assigneeIds"];
	onToggleAssignee: BacklogToolbarProps["onToggleAssignee"];
}>) {
	const selected = assigneeIds.has(person?.id);

	return (
		<button
			aria-label={`Filter backlog by ${person?.name ?? "Unassigned"}`}
			aria-pressed={selected}
			className={cn(
				"rounded-full outline-none aria-pressed:ring-2 aria-pressed:ring-border-selected focus-visible:ring-3 focus-visible:ring-ring/50",
				assigneeIds.size > 0 && !selected && "opacity-50 hover:opacity-100 focus-visible:opacity-100",
			)}
			onClick={() => onToggleAssignee(person?.id)}
			type="button"
		>
			{person ? <JiraListAvatar person={person} /> : <AvatarUnassigned aria-hidden size="sm" />}
		</button>
	);
}

export function BacklogToolbar({
	query,
	countLabel,
	onQueryChange,
	people,
	assigneeIds,
	onToggleAssignee,
	statuses,
	statusOptions = BACKLOG_STATUS_OPTIONS,
	onToggleStatus,
}: Readonly<BacklogToolbarProps>) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<InputGroup className="w-44 max-w-full">
				<InputGroupSearchAddon><Icon render={<SearchIcon label="" size="small" />} /></InputGroupSearchAddon>
				<InputGroupInput
					aria-label="Search backlog"
					placeholder="Search backlog"
					type="search"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
				/>
			</InputGroup>
			{people.length > 0 ? (
				<AvatarGroup className="items-center -space-x-1.5" label="Backlog assignees" size="sm">
					<AssigneeFilter assigneeIds={assigneeIds} onToggleAssignee={onToggleAssignee} />
					{people.slice(0, 6).map((person) => (
						<AssigneeFilter key={person.id} person={person} assigneeIds={assigneeIds} onToggleAssignee={onToggleAssignee} />
					))}
				</AvatarGroup>
			) : null}
			<div className="ml-auto flex items-center gap-2">
				<span className="text-xs text-text-subtle tabular-nums">{countLabel}</span>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button aria-label="Filter backlog by status" aria-pressed={statuses.size > 0} size="icon" variant="outline" />}
					>
						<Icon render={<FilterIcon label="" />} />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{statusOptions.map(({ status }) => (
							<DropdownMenuCheckboxItem key={status} checked={statuses.has(status)} onCheckedChange={() => onToggleStatus(status)}>
								{status}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
