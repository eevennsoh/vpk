import { useId } from "react";
import AddIcon from "@atlaskit/icon/core/add";

import { JIRA_LIST_AGENT_SESSIONS_COLUMN_WIDTH } from "@/components/blocks/jira-list/jira-list-appearance";
import { JiraListTable, JiraListTableCell, JiraListTableHead } from "@/components/blocks/jira-list/jira-list-table";
import { JiraListHierarchyButton } from "@/components/blocks/jira-list/jira-list-work-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { BacklogRow } from "./backlog-row";
import type { JiraBacklogItem, JiraBacklogProps, JiraBacklogSection } from "./types";

interface BacklogSectionProps {
	section: JiraBacklogSection;
	visibleItems: readonly JiraBacklogItem[];
	isBacklog?: boolean;
	boundarySide?: "sprint" | "backlog";
	expanded: boolean;
	onToggleExpanded: () => void;
	selected: ReadonlySet<string>;
	onSelectItems: (ids: readonly string[], checked: boolean) => void;
	actions: Pick<JiraBacklogProps,
		"people" | "onIssueClick" | "onStatusChange" | "onAssigneeChange" | "onCreate" | "onSprintAction" |
		"agentCatalog" | "onAssignedAgentIdsChange" | "onAssignedAgentSelect"
	>;
}

export function BacklogSection({
	section,
	visibleItems,
	isBacklog,
	boundarySide,
	expanded,
	onToggleExpanded,
	selected,
	onSelectItems,
	actions,
}: Readonly<BacklogSectionProps>) {
	const headingId = useId();
	const selectedCount = visibleItems.filter(({ id }) => selected.has(id)).length;
	const todo = visibleItems.filter(({ status }) => status === "To do").length;
	const done = visibleItems.filter(({ status }) => status === "Done").length;
	const inProgress = visibleItems.length - todo - done;
	const sprintActionLabel = isBacklog ? "Create sprint" : "Complete sprint";

	return (
		<section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2" data-sprint-boundary-side={boundarySide}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<JiraListHierarchyButton
						expanded={expanded}
						label={`${expanded ? "Collapse" : "Expand"} ${section.title}`}
						onClick={onToggleExpanded}
					/>
					<h2 className="text-sm font-semibold text-text" id={headingId}>{section.title}</h2>
					{section.dateLabel ? <span className="text-xs text-text-subtlest">{section.dateLabel}</span> : null}
				</div>
				<div className="ml-auto flex items-center gap-3">
					<div className="flex items-center gap-1" role="group" aria-label={`Status counts: ${todo} to do, ${inProgress} in progress or in review, ${done} done`}>
						<Badge aria-hidden>{todo}</Badge>
						<Badge aria-hidden variant="information">{inProgress}</Badge>
						<Badge aria-hidden variant="success">{done}</Badge>
					</div>
					<Button onClick={() => actions.onSprintAction?.(section.id)} size="compact" variant="outline">
						{sprintActionLabel}
					</Button>
				</div>
			</div>
			{expanded ? (
				<>
					<JiraListTable
						aria-label={`${section.title} work items`}
						className="min-w-[52rem]"
						containerClassName="rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
					>
						<colgroup>
							<col className="w-10" />
							<col />
							<col className="w-32" />
							<col className="w-40" />
							<col className={JIRA_LIST_AGENT_SESSIONS_COLUMN_WIDTH} />
							<col className="w-28" />
						</colgroup>
						<TableHeader>
							<TableRow className="border-0 hover:bg-transparent">
								<JiraListTableHead>
									<Checkbox
										aria-label={`Select all work items in ${section.title}`}
										checked={visibleItems.length > 0 && selectedCount === visibleItems.length}
										indeterminate={selectedCount > 0 && selectedCount < visibleItems.length}
										onCheckedChange={(checked) => onSelectItems(visibleItems.map(({ id }) => id), checked)}
									/>
								</JiraListTableHead>
								<JiraListTableHead>Work</JiraListTableHead>
								<JiraListTableHead>Status</JiraListTableHead>
								<JiraListTableHead>Assignee</JiraListTableHead>
								<JiraListTableHead>Agent sessions</JiraListTableHead>
								<JiraListTableHead>Priority</JiraListTableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{visibleItems.map((item) => (
								<BacklogRow
									key={item.id}
									item={item}
									selected={selected.has(item.id)}
									showSelection={selectedCount > 0}
									people={actions.people}
									onSelect={(checked) => onSelectItems([item.id], checked)}
									onIssueClick={actions.onIssueClick}
									onStatusChange={actions.onStatusChange}
									onAssigneeChange={actions.onAssigneeChange}
									agentCatalog={actions.agentCatalog}
									onAssignedAgentIdsChange={actions.onAssignedAgentIdsChange}
									onAssignedAgentSelect={actions.onAssignedAgentSelect}
								/>
							))}
							{visibleItems.length === 0 ? (
								<TableRow className="border-0 hover:bg-transparent">
									<JiraListTableCell colSpan={6} className="text-text-subtle">
										{section.items.length > 0 ? "No matching work items" : "No work items"}
									</JiraListTableCell>
								</TableRow>
							) : null}
						</TableBody>
					</JiraListTable>
					<div className="-mt-2 flex min-h-10 items-center justify-between gap-2 border-t border-border px-1 text-sm text-text-subtle">
						<Button onClick={() => actions.onCreate?.(section.id)} variant="ghost">
							<Icon data-icon="inline-start" render={<AddIcon label="" />} />
							Create
						</Button>
						<span className="pe-2 tabular-nums">
							{visibleItems.length} of {section.items.length}<span className="sr-only"> work items</span>
						</span>
					</div>
				</>
			) : null}
		</section>
	);
}
