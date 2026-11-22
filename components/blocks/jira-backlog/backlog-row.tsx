import { PRIORITY_LABELS } from "@/components/blocks/jira-list/jira-list-cell-data";
import { IssueTypeGlyph, JiraListAvatar, PriorityGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import { JiraListTableCell } from "@/components/blocks/jira-list/jira-list-table";
import { ButterListAgentCell } from "@/components/blocks/jira-list/project-butter-agent-cell";
import { AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Lozenge, LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BACKLOG_STATUSES, type JiraBacklogItem, type JiraBacklogProps } from "./types";

const STATUS_VARIANTS = {
	"To do": "neutral",
	"In progress": "information",
	"In review": "warning",
	Done: "success",
} as const;

type BacklogRowProps = Pick<JiraBacklogProps,
	"people" | "onIssueClick" | "onStatusChange" | "onAssigneeChange" |
	"agentCatalog" | "onAssignedAgentIdsChange" | "onAssignedAgentSelect"
> & {
	item: JiraBacklogItem;
	selected: boolean;
	showSelection: boolean;
	onSelect: (checked: boolean) => void;
};

export function BacklogRow({
	item,
	selected,
	showSelection,
	people = [],
	onSelect,
	onIssueClick,
	onStatusChange,
	onAssigneeChange,
	agentCatalog,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
}: Readonly<BacklogRowProps>) {
	const assigneeName = item.assignee?.name ?? "Unassigned";

	return (
		<TableRow className="group/row border-0" data-backlog-item-row="" data-state={selected ? "selected" : undefined}>
			<JiraListTableCell>
				<Checkbox
					aria-label={`Select ${item.issueKey}`}
					checked={selected}
					onCheckedChange={onSelect}
					className={cn(!showSelection && "pointer-fine:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100")}
				/>
			</JiraListTableCell>
			<JiraListTableCell>
				<div className="flex min-w-0 items-center gap-1.5">
					<IssueTypeGlyph issueType={item.issueType} large />
					{onIssueClick ? (
						<Button className="h-auto px-0 text-link" onClick={() => onIssueClick(item)} size="compact" variant="link">
							{item.issueKey}
						</Button>
					) : (
						<span className="shrink-0 font-medium text-link">{item.issueKey}</span>
					)}
					{onIssueClick ? (
						<button
							className="truncate rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring"
							onClick={() => onIssueClick(item)}
							title={item.summary}
							type="button"
						>
							{item.summary}
						</button>
					) : (
						<span className="truncate" title={item.summary}>{item.summary}</span>
					)}
				</div>
			</JiraListTableCell>
			<JiraListTableCell>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<LozengeDropdownTrigger
							aria-label={`Change status for ${item.issueKey}. Current status: ${item.status}`}
							variant={STATUS_VARIANTS[item.status]}
						/>}
					>
						{item.status}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{BACKLOG_STATUSES.map((status) => (
							<DropdownMenuItem key={status} onSelect={() => onStatusChange?.(item.id, status)} selected={status === item.status}>
								<Lozenge variant={STATUS_VARIANTS[status]}>{status}</Lozenge>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</JiraListTableCell>
			<JiraListTableCell>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button
							aria-label={`Change assignee for ${item.issueKey}. ${assigneeName}`}
							className="min-w-0 max-w-full justify-start gap-2 px-0"
							selectedAppearance="icon-only"
							variant="ghost"
						/>}
					>
						{item.assignee ? <JiraListAvatar person={item.assignee} /> : <AvatarUnassigned aria-hidden size="sm" />}
						<span className={cn("truncate font-normal", item.assignee ? "text-text" : "text-text-subtle")}>{assigneeName}</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem onSelect={() => onAssigneeChange?.(item.id, undefined)} selected={!item.assignee}>
							<AvatarUnassigned aria-hidden size="sm" />
							Unassigned
						</DropdownMenuItem>
						{people.map((person) => (
							<DropdownMenuItem key={person.id} onSelect={() => onAssigneeChange?.(item.id, person)} selected={item.assignee?.id === person.id}>
								<JiraListAvatar person={person} />
								<span className="truncate">{person.name}</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</JiraListTableCell>
			<JiraListTableCell>
				<ButterListAgentCell
					agentCatalog={agentCatalog}
					onAssignedAgentIdsChange={onAssignedAgentIdsChange}
					onAssignedAgentSelect={onAssignedAgentSelect}
					row={item}
				/>
			</JiraListTableCell>
			<JiraListTableCell>
				<div className="flex items-center gap-2">
					<span aria-hidden><PriorityGlyph priority={item.priority} /></span>
					{PRIORITY_LABELS[item.priority]}
				</div>
			</JiraListTableCell>
		</TableRow>
	);
}
