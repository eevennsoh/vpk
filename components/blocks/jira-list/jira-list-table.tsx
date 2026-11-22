"use client";

import type { ComponentProps } from "react";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { AvatarUnassigned } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag } from "@/components/ui/tag";
import { labelColor } from "@/components/blocks/artifact-pane/label-color";
import { ArtifactParentTag } from "@/components/blocks/artifact-pane/artifact-parent-field";
import { IssueTypeGlyph, JiraListAvatar, PriorityGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import { ProjectButterStatusGlyph } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { cn } from "@/lib/utils";
import { JiraListHierarchyButton } from "./jira-list-work-controls";
import type { JiraListGroupHeading } from "./jira-list-grouping";
import { JIRA_LIST_CELL_CLASS, JIRA_LIST_HEADER_CELL_CLASS, type JiraListVariant } from "@/components/blocks/jira-list/jira-list-appearance";

export { JIRA_LIST_HEADER_CELL_CLASS, type JiraListVariant } from "@/components/blocks/jira-list/jira-list-appearance";

export function JiraListTable({ "aria-label": label, className, containerProps, variant = "project-butter", ...props }: Readonly<ComponentProps<typeof Table> & { variant?: JiraListVariant }>) {
	return <Table
		{...props}
		aria-label={label}
		containerProps={label ? { role: "region", "aria-label": `${label} columns`, tabIndex: 0, ...containerProps } : containerProps}
		className={cn(
			"table-fixed border-separate border-spacing-0",
			variant === "classic"
				? "[&_th]:border-b [&_th]:border-r [&_th]:border-border [&_td]:border-b [&_td]:border-r [&_td]:border-border [&_tr>*:last-child]:border-r-0 [&_tbody_tr:last-child>td]:border-b-0 [&_tr[data-summary-editing=true]>td]:border-r-transparent"
				: "[&_thead_th:first-child]:rounded-l-xl [&_thead_th:last-child]:rounded-r-xl",
			className,
		)}
		data-jira-list-variant={variant}
	/>;
}

export function JiraListTableHead({ className, ...props }: Readonly<ComponentProps<typeof TableHead>>) {
	return <TableHead {...props} className={cn(JIRA_LIST_HEADER_CELL_CLASS, className)} scope="col" />;
}

export function JiraListTableCell({ className, ...props }: Readonly<ComponentProps<typeof TableCell>>) {
	return <TableCell {...props} className={cn(JIRA_LIST_CELL_CLASS, className)} />;
}

export function JiraListGroupHeader({ columnCount, group, selectedIssueKeys, onSelectGroup }: Readonly<{
	columnCount: number;
	group: JiraListGroupHeading;
	selectedIssueKeys?: ReadonlySet<string>;
	onSelectGroup?: (issueKeys: readonly string[], checked: boolean) => void;
}>) {
	const selectedCount = group.issueKeys.filter((key) => selectedIssueKeys?.has(key)).length;
	return (
		<TableRow className="group/group-heading border-0 bg-transparent hover:bg-transparent [&:not(:first-child)>td]:pt-10">
			<TableCell colSpan={columnCount} className="px-3 py-2 text-xs font-semibold text-text-subtle">
				<div className="flex items-center gap-2">
					<div className="flex items-center">
						{onSelectGroup ? <Checkbox aria-label={`Select all work items in ${group.label}`} className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/group-heading:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100" checked={selectedCount === group.issueKeys.length && selectedCount > 0} indeterminate={selectedCount > 0 && selectedCount < group.issueKeys.length} onCheckedChange={(checked) => onSelectGroup(group.issueKeys, checked)} /> : <span className="size-4" />}
						<JiraListHierarchyButton expanded={!group.collapsed} label={`${group.collapsed ? "Expand" : "Collapse"} ${group.label}`} onClick={group.onToggle} />
					</div>
					{group.visual?.kind === "assignee" ? (
						<span aria-hidden="true" className="inline-flex shrink-0 items-center">
							{group.visual.person ? <JiraListAvatar person={group.visual.person} size="xs" /> : <AvatarUnassigned animate={false} size="xs" label="" />}
						</span>
					) : null}
					{group.visual?.kind === "work-type" ? <IssueTypeGlyph issueType={group.visual.issueType} large /> : null}
					{group.visual?.kind === "subtask" ? <IssueTypeGlyph issueType="subtask" large /> : null}
					{group.visual?.kind === "priority" ? <PriorityGlyph priority={group.visual.priority} /> : null}
					{group.visual?.kind === "status" ? <ProjectButterStatusGlyph animated={false} size="xs" status={group.label} /> : null}
					{group.visual?.kind === "agent" ? group.visual.unassigned ? <AvatarUnassigned kind="agent" animate={false} size="xs" label="" /> : <AgentAvatarVisual appearance="coding" label={group.label} sizePx={16} avatarSrc={group.visual.avatarSrc} brandName={group.visual.brandName} vpkLogo={group.visual.vpkLogo} fallbackText={group.label.slice(0, 1)} /> : null}
					{group.visual?.kind === "label" ? <Tag color={group.visual.hasValue ? labelColor(group.label) : "standard"}>{group.label}</Tag> : group.visual?.kind === "epic" ? <ArtifactParentTag parent={group.visual.key ? { key: group.visual.key, summary: group.visual.name } : null} placeholder={group.label} /> : <span>{group.label}</span>}
					<span className="font-normal tabular-nums">{group.count}<span className="sr-only"> work items</span></span>
				</div>
			</TableCell>
		</TableRow>
	);
}
