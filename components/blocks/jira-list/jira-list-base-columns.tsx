"use client";

import { useState, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from "react";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import EditIcon from "@atlaskit/icon/core/edit";
import LinkIcon from "@atlaskit/icon/core/link";

import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { PRIORITY_LABELS } from "@/components/blocks/jira-list/jira-list-cell-data";
import {
	HierarchyConnector,
	IssueTypeGlyph,
	JiraListAgentSessionsCell,
	JiraListAvatar,
	JiraListLabelsCell,
	PriorityGlyph,
} from "@/components/blocks/jira-list/jira-list-cells";
import type { JiraListColumnDefinition } from "@/components/blocks/jira-list/jira-list-column-model";
import type {
	JiraListProps,
	JiraListRowData,
	JiraListStatusOption,
} from "@/components/blocks/jira-list/jira-list-types";
import { JiraListPointsCell } from "@/components/blocks/jira-list/jira-list-points-cell";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Lozenge, LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function JiraListDueDateCell({ dueDate, issueKey, onChange }: Readonly<{
	dueDate?: string;
	issueKey: string;
	onChange: (dueDate: string | undefined) => void;
}>) {
	const [open, setOpen] = useState(false);
	const parsed = dueDate ? new Date(/^\d{4}-\d{2}-\d{2}$/u.test(dueDate) ? `${dueDate}T00:00:00` : dueDate) : undefined;
	const selected = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger render={
				<button
					aria-label={dueDate ? `Edit due date for ${issueKey}: ${dueDate}` : `Add due date for ${issueKey}`}
					className="flex min-w-0 items-center gap-2 rounded-sm text-left text-sm focus-visible:outline-2 focus-visible:outline-border-focused"
					type="button"
				/>
			}>
				<span className={cn("inline-flex", !dueDate && "text-icon-subtlest")}><CalendarIcon label="" size="small" /></span>
				{dueDate ? (
					<span className="truncate">{selected ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(selected) : dueDate}</span>
				) : (
					<span className="whitespace-nowrap text-sm text-text-subtlest [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100">Add</span>
				)}
			</PopoverTrigger>
			<PopoverContent align="end" className="w-auto p-2">
				<Calendar
					defaultMonth={selected}
					mode="single"
					onSelect={(date) => {
						onChange(date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : undefined);
						setOpen(false);
					}}
					selected={selected}
				/>
			</PopoverContent>
		</Popover>
	);
}

export function createJiraListBaseColumns({
	agentCatalog,
	addAgentLabel,
	copiedIssueKey,
	editingSummaryIssueKey,
	onAgentAssign,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
	onCopyLink,
	onDueDateChange,
	onIssueClick,
	onIssueKeyClick,
	onSummaryEditStart,
	onStoryPointsChange,
	renderAgentSessions,
	onStatusChange,
	openCopyTooltipIssueKey,
	setOpenCopyTooltipIssueKey,
	statusOptions,
}: Readonly<{
	agentCatalog?: readonly AgentSelectorAgent[];
	addAgentLabel?: string;
	copiedIssueKey: string | null;
	editingSummaryIssueKey?: string;
	onAgentAssign?: JiraListProps["onAgentAssign"];
	onAssignedAgentIdsChange?: JiraListProps["onAssignedAgentIdsChange"];
	onAssignedAgentSelect?: JiraListProps["onAssignedAgentSelect"];
	onCopyLink?: (row: JiraListRowData) => void;
	onDueDateChange?: JiraListProps["onDueDateChange"];
	onIssueClick?: (row: JiraListRowData) => void;
	onIssueKeyClick?: (row: JiraListRowData) => void;
	onSummaryEditStart?: (row: JiraListRowData, event: ReactMouseEvent<HTMLButtonElement>) => void;
	onStoryPointsChange?: JiraListProps["onStoryPointsChange"];
	renderAgentSessions?: JiraListProps["renderAgentSessions"];
	onStatusChange?: (issueKey: string, status: JiraListStatusOption) => void;
	openCopyTooltipIssueKey: string | null;
	setOpenCopyTooltipIssueKey: Dispatch<SetStateAction<string | null>>;
	statusOptions: readonly JiraListStatusOption[];
}>): readonly JiraListColumnDefinition[] {
	return [
		{
			id: "work",
			label: "Work",
			widthClassName: "w-[438px]",
			renderCell: (row) => {
				const indentLevel = row.indentLevel ?? 0;
				const isCopiedRow = copiedIssueKey === row.issueKey;
				const isEditing = editingSummaryIssueKey === row.issueKey;

				return (
					<div className="flex min-w-0 items-center gap-2">
						<div className="flex min-w-0 flex-1 items-center gap-1.5">
							<HierarchyConnector indentLevel={indentLevel} />
							<IssueTypeGlyph issueType={row.issueType} large />
							<div className="group/issue-key flex shrink-0 items-center">
								{onIssueKeyClick ? (
									<Button
										className="h-auto shrink-0 px-0 text-link hover:underline focus-visible:underline"
										onClick={() => onIssueKeyClick(row)}
										size="compact"
										variant="link"
									>
										{row.issueKey}
									</Button>
								) : (
									<span className="shrink-0 text-[13px] font-medium text-text-subtle">
										{row.issueKey}
									</span>
								)}
								{onCopyLink ? (
									<span
										className={cn(
											"pointer-events-none max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-normal ease-out-practical motion-reduce:transition-none group-hover/issue-key:pointer-events-auto group-hover/issue-key:max-w-7 group-hover/issue-key:opacity-100 group-has-[:focus-visible]/issue-key:pointer-events-auto group-has-[:focus-visible]/issue-key:max-w-7 group-has-[:focus-visible]/issue-key:opacity-100",
											isCopiedRow && "pointer-events-auto max-w-7 opacity-100",
										)}
										data-testid={`copy-link-reveal-${row.issueKey}`}
									>
										<Tooltip
											onOpenChange={(open) => setOpenCopyTooltipIssueKey(open ? row.issueKey : null)}
											open={isCopiedRow || openCopyTooltipIssueKey === row.issueKey}
										>
											<TooltipTrigger
												render={
													<Button
														aria-label={`${isCopiedRow ? "Copied link" : "Copy link"} for ${row.issueKey}`}
														className="ms-0.5 size-6 shrink-0 hover:bg-transparent active:bg-transparent"
														onClick={() => onCopyLink(row)}
														size="icon"
														variant="ghost"
													/>
												}
											>
												<CopyFeedbackIcon copied={isCopiedRow} idleIcon={<LinkIcon label="" size="small" />} />
											</TooltipTrigger>
											<TooltipContent>{isCopiedRow ? "Copied" : "Copy link"}</TooltipContent>
										</Tooltip>
									</span>
								) : null}
							</div>
							{onSummaryEditStart || onIssueClick ? (
								<button
									className={cn("min-w-0 flex-1 truncate rounded-sm text-left text-sm font-normal text-text hover:text-link focus-visible:text-link focus-visible:outline-none", isEditing && "invisible")}
									aria-label={onSummaryEditStart ? `Edit summary for ${row.issueKey}: ${row.summary}` : undefined}
									data-summary-trigger={row.issueKey}
									onClick={(event) => onSummaryEditStart ? onSummaryEditStart(row, event) : onIssueClick?.(row)}
									type="button"
								>
									{row.summary}
								</button>
							) : (
								<span className="min-w-0 flex-1 truncate text-sm font-normal text-text">
									{row.summary}
								</span>
							)}
						</div>
						{onSummaryEditStart && !isEditing ? (
							<div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													aria-label={`Edit work item name for ${row.issueKey}`}
													className="text-text-subtle hover:text-text"
													onClick={(event) => onSummaryEditStart(row, event)}
													size="icon-compact"
													variant="ghost"
												/>
											}
										>
											<Icon render={<EditIcon label="" size="small" />} />
										</TooltipTrigger>
										<TooltipContent>Edit</TooltipContent>
									</Tooltip>
							</div>
						) : null}
					</div>
				);
			},
		},
		{
			id: "status",
			label: "Status",
			widthClassName: "w-[126px]",
			renderCell: (row) => onStatusChange && statusOptions.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<LozengeDropdownTrigger
								aria-label={`Change status for ${row.issueKey}. Current status: ${row.status}`}
								variant={row.statusVariant ?? "neutral"}
							/>
						}
					>
						{row.status}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-40" sideOffset={6}>
						{statusOptions.map((option) => (
							<DropdownMenuItem
								key={option.status}
								onSelect={() => onStatusChange(row.issueKey, option)}
								selected={option.status === row.status}
							>
								<Lozenge variant={option.statusVariant ?? "neutral"}>
									{option.status}
								</Lozenge>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<Lozenge variant={row.statusVariant ?? "neutral"}>{row.status}</Lozenge>
			),
		},
		{
			id: "assignee",
			label: "Assignee",
			widthClassName: "w-[214px]",
			renderCell: (row) => row.assignee ? (
				<div className="flex min-w-0 items-center gap-2">
					<JiraListAvatar person={row.assignee} />
					<span className="truncate text-sm text-text">{row.assignee.name}</span>
				</div>
			) : (
				<div className="flex min-w-0 items-center gap-2">
					<AvatarUnassigned aria-hidden="true" size="sm" />
					<span className="text-text-subtle text-sm">Unassigned</span>
				</div>
			),
		},
		{
			id: "agentSessions",
			label: "Agent sessions",
			widthClassName: "w-[247px]",
			renderCell: (row) => renderAgentSessions ? renderAgentSessions(row) : (
				<JiraListAgentSessionsCell
					addAgentLabel={addAgentLabel}
					agentCatalog={agentCatalog}
					agentSessions={row.agentSessions}
					onAgentAssign={
						onAgentAssign
							? (agent) => onAgentAssign(row.issueKey, agent)
							: undefined
					}
					onAssignedAgentIdsChange={
						onAssignedAgentIdsChange
							? (agentIds) => onAssignedAgentIdsChange(row.issueKey, agentIds)
							: undefined
					}
					onAssignedAgentSelect={
						onAssignedAgentSelect
							? (agent) => onAssignedAgentSelect(row.issueKey, agent)
							: undefined
					}
				/>
			),
		},
		{
			id: "priority",
			label: "Priority",
			widthClassName: "w-[112px]",
			renderCell: (row) => (
				<div className="flex items-center gap-2">
					<span aria-hidden="true">
						<PriorityGlyph priority={row.priority} />
					</span>
					<span className="text-sm text-text">{PRIORITY_LABELS[row.priority]}</span>
				</div>
			),
		},
		...(onStoryPointsChange ? [{
			id: "storyPoints",
			label: "Points",
			widthClassName: "w-[156px]",
			renderCell: (row: JiraListRowData) => (
				<JiraListPointsCell issueKey={row.issueKey} onChange={(points) => onStoryPointsChange(row.issueKey, points)} points={row.storyPoints} />
			),
		}] : []),
		{
			id: "labels",
			label: "Labels",
			widthClassName: "w-[180px]",
			renderCell: (row) => <JiraListLabelsCell labels={row.labels} />,
		},
		{
			id: "dueDate",
			label: "Due date",
			widthClassName: "w-[146px]",
			renderCell: (row) => onDueDateChange ? (
				<JiraListDueDateCell dueDate={row.dueDate} issueKey={row.issueKey} onChange={(dueDate) => onDueDateChange(row.issueKey, dueDate)} />
			) : <span className="text-sm text-text">{row.dueDate ?? "No due date"}</span>,
		},
	];
}
