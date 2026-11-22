import type { ComponentProps } from "react";
import { PRIORITY_LABELS } from "@/components/blocks/jira-list/jira-list-cell-data";
import { getInsertionLineClassName } from "@/components/blocks/jira-list/jira-list-dnd";
import { HierarchyConnector, IssueTypeGlyph, JiraListAvatar, PriorityGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import { JiraListTableCell } from "@/components/blocks/jira-list/jira-list-table";
import { JiraListSortableRow } from "@/components/blocks/jira-list/jira-list-rows";
import { JiraListHierarchyButton } from "@/components/blocks/jira-list/jira-list-work-controls";
import { ButterListAgentCell } from "@/components/blocks/jira-list/project-butter-agent-cell";
import { AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Lozenge, LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { cn } from "@/lib/utils";
import { BACKLOG_STATUS_OPTIONS, type JiraBacklogItem, type JiraBacklogProps } from "./types";

type BacklogRowProps = Pick<JiraBacklogProps,
	"people" | "onIssueClick" | "onStatusChange" | "onAssigneeChange" |
	"agentCatalog" | "onAssignedAgentIdsChange" | "onAssignedAgentSelect" | "statusOptions"
> & {
	item: JiraBacklogItem;
	selected: boolean;
	showSelection: boolean;
	dimmed?: boolean;
	createdDraftRow?: boolean;
	firstCreatedDraftRow?: boolean;
	insertionLinePosition?: "before" | "after";
	onSelect: (checked: boolean) => void;
	onToggleExpanded: () => void;
	rowControls: Pick<ComponentProps<typeof JiraListSortableRow>,
		"handleOverlayElement" | "instanceId" | "isDropTarget" | "isHandleVisible" | "onMoveRow" | "onPointerMove" | "onPointerLeave" | "rowCount" | "rowIndex" | "style"
	>;
};

export function BacklogRow({
	item,
	selected,
	showSelection,
	dimmed,
	createdDraftRow,
	firstCreatedDraftRow,
	insertionLinePosition,
	people = [],
	onSelect,
	onToggleExpanded,
	rowControls,
	onIssueClick,
	onStatusChange,
	onAssigneeChange,
	agentCatalog,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
	statusOptions = BACKLOG_STATUS_OPTIONS,
}: Readonly<BacklogRowProps>) {
	const assigneeName = item.assignee?.name ?? "Unassigned";
	const statusVariant = statusOptions.find(({ status }) => status === item.status)?.statusVariant ?? "neutral";
	const lineClassName = getInsertionLineClassName(insertionLinePosition);
	const backdrop = createdDraftRow ? "bg-surface-sunken" : undefined;

	return (
		<JiraListSortableRow {...rowControls} row={item} className={cn("group/row border-0", dimmed && "opacity-20", createdDraftRow && "hover:bg-transparent")} data-backlog-item-id={item.id} data-backlog-item-row={item.parentIssueKey ? undefined : ""} data-backlog-child-row={item.parentIssueKey ? "" : undefined} data-state={selected ? "selected" : undefined}>
			<JiraListTableCell className={cn("px-0", lineClassName, backdrop, firstCreatedDraftRow && "rounded-tl-xl")} data-insertion-line={insertionLinePosition}>
				<div className="flex items-center ps-3">
					<Checkbox
						aria-label={`Select ${item.issueKey}`}
						checked={selected}
						onCheckedChange={onSelect}
						className={cn(!showSelection && "pointer-fine:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100")}
					/>
					{item.hasChildren ? (
						<JiraListHierarchyButton expanded={Boolean(item.isExpanded)} label={`${item.isExpanded ? "Collapse" : "Expand"} ${item.issueKey}`} onClick={onToggleExpanded} />
					) : null}
				</div>
			</JiraListTableCell>
			<JiraListTableCell className={cn("ps-1", lineClassName, backdrop)} data-insertion-line={insertionLinePosition}>
				<div className="flex min-w-0 items-center gap-1.5">
					<HierarchyConnector indentLevel={item.indentLevel ?? 0} />
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
			<JiraListTableCell className={cn(lineClassName, backdrop)} data-insertion-line={insertionLinePosition}>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<LozengeDropdownTrigger
							aria-label={`Change status for ${item.issueKey}. Current status: ${item.status}`}
						variant={statusVariant}
						/>}
					>
						{item.status}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{statusOptions.map(({ status, statusVariant: variant }) => (
							<DropdownMenuItem key={status} onSelect={() => onStatusChange?.(item.id, status)} selected={status === item.status}>
								<Lozenge variant={variant ?? "neutral"}>{status}</Lozenge>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</JiraListTableCell>
			<JiraListTableCell className={cn(lineClassName, backdrop)} data-insertion-line={insertionLinePosition}>
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
			<JiraListTableCell className={cn(lineClassName, backdrop)} data-insertion-line={insertionLinePosition}>
				<ButterListAgentCell
					agentCatalog={agentCatalog}
					onAssignedAgentIdsChange={onAssignedAgentIdsChange}
					onAssignedAgentSelect={onAssignedAgentSelect}
					row={item}
				/>
			</JiraListTableCell>
			<JiraListTableCell className={cn(lineClassName, backdrop, firstCreatedDraftRow && "rounded-tr-xl")} data-insertion-line={insertionLinePosition}>
				<div className="flex items-center gap-2">
					<span aria-hidden><PriorityGlyph priority={item.priority} /></span>
					{PRIORITY_LABELS[item.priority]}
				</div>
			</JiraListTableCell>
		</JiraListSortableRow>
	);
}
