"use client";

import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import LinkIcon from "@atlaskit/icon/core/link";
import PanelRightIcon from "@atlaskit/icon/core/panel-right";

import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { PRIORITY_LABELS } from "@/components/blocks/jira-list/jira-list-cell-data";
import {
	HierarchyConnector,
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
import { JiraListIssueSelection } from "@/components/blocks/jira-list/jira-list-work-controls";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Lozenge, LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function createJiraListBaseColumns({
	agentCatalog,
	addAgentLabel,
	copiedIssueKey,
	editingSummaryIssueKey,
	onAgentAssign,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
	onCopyLink,
	onIssueClick,
	onIssueKeyClick,
	onSummaryEditStart,
	onStoryPointsChange,
	renderAgentSessions,
	onStatusChange,
	onSelectRow,
	selectedIssueKeys,
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
	onIssueClick?: (row: JiraListRowData) => void;
	onIssueKeyClick?: (row: JiraListRowData) => void;
	onSummaryEditStart?: (row: JiraListRowData, event: ReactMouseEvent<HTMLButtonElement>) => void;
	onStoryPointsChange?: JiraListProps["onStoryPointsChange"];
	renderAgentSessions?: JiraListProps["renderAgentSessions"];
	onStatusChange?: (issueKey: string, status: JiraListStatusOption) => void;
	onSelectRow?: JiraListProps["onSelectRow"];
	selectedIssueKeys: ReadonlySet<string>;
	openCopyTooltipIssueKey: string | null;
	setOpenCopyTooltipIssueKey: Dispatch<SetStateAction<string | null>>;
	statusOptions: readonly JiraListStatusOption[];
}>): readonly JiraListColumnDefinition[] {
	const hasHoverRowActions = Boolean(onIssueClick);

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
							<JiraListIssueSelection
								checked={selectedIssueKeys.has(row.issueKey)}
								issueKey={row.issueKey}
								issueType={row.issueType}
								onChange={onSelectRow}
								showCheckbox={selectedIssueKeys.size > 0}
							/>
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
						{hasHoverRowActions && !isEditing ? (
							<div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
								{onIssueClick ? (
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													aria-label="Open work item"
													className="text-text-subtle hover:text-text"
													onClick={() => onIssueClick(row)}
													size="icon-compact"
													variant="ghost"
												/>
											}
										>
											<Icon render={<PanelRightIcon label="" size="small" />} />
										</TooltipTrigger>
										<TooltipContent>Open work item</TooltipContent>
									</Tooltip>
								) : null}
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
				<span className="text-text-subtle text-sm">Unassigned</span>
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
			widthClassName: "w-[96px]",
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
			widthClassName: "w-[114px]",
			renderCell: (row) => (
				<span className="text-sm text-text">{row.dueDate ?? "No due date"}</span>
			),
		},
	];
}
