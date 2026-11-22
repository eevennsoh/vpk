"use client";

import { useRef, useState } from "react";

import { BacklogSection } from "./backlog-section";
import { BacklogToolbar } from "./backlog-toolbar";
import { SprintBoundary } from "./sprint-boundary";
import type { JiraBacklogItem, JiraBacklogProps, JiraBacklogStatus } from "./types";

export type { JiraBacklogItem, JiraBacklogProps, JiraBacklogSection, JiraBacklogSprintMove, JiraBacklogStatus } from "./types";

function toggleFilterValue<T>(values: ReadonlySet<T>, value: T) {
	const next = new Set(values);
	if (!next.delete(value)) next.add(value);
	return next;
}

export function JiraBacklog(props: Readonly<JiraBacklogProps>) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
	const [assigneeIds, setAssigneeIds] = useState<ReadonlySet<string | undefined>>(() => new Set());
	const [statuses, setStatuses] = useState<ReadonlySet<JiraBacklogStatus>>(() => new Set());
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
	const [backlogExpanded, setBacklogExpanded] = useState(true);
	const rootRef = useRef<HTMLDivElement>(null);
	const search = query.trim().toLowerCase();

	function matches(item: JiraBacklogItem) {
		return (assigneeIds.size === 0 || assigneeIds.has(item.assignee?.id))
			&& (statuses.size === 0 || statuses.has(item.status))
			&& `${item.issueKey} ${item.summary}`.toLowerCase().includes(search);
	}

	function selectItems(ids: readonly string[], checked: boolean) {
		const next = new Set(selected);
		for (const id of ids) {
			if (checked) next.add(id);
			else next.delete(id);
		}
		setSelected(next);
		props.onSelectionChange?.(next);
	}

	const visibleBacklog = props.backlog.filter(matches);
	const lastSprint = props.sprints.at(-1);
	const boundary = props.sprintBoundary;
	const runningSprint = lastSprint?.id === boundary?.sprintId ? lastSprint : undefined;
	let disabledReason: string | undefined;
	if (runningSprint) {
		if (collapsed.has(runningSprint.id) || !backlogExpanded) {
			disabledReason = "Expand both sections to move work items";
		} else if (visibleBacklog.length !== props.backlog.length || !runningSprint.items.every(matches)) {
			disabledReason = "Clear filters to move work items";
		} else if (runningSprint.items.length + props.backlog.length === 0) {
			disabledReason = "No work items to move";
		}
	}

	return (
		<div
			className="relative flex min-w-0 flex-col gap-6 bg-surface text-text data-[dragging-sprint-boundary]:[&_*]:cursor-ns-resize"
			data-testid="jira-backlog"
			ref={rootRef}
		>
			<BacklogToolbar
				query={query}
				onQueryChange={setQuery}
				people={props.people ?? []}
				assigneeIds={assigneeIds}
				onToggleAssignee={(id) => setAssigneeIds((current) => toggleFilterValue(current, id))}
				statuses={statuses}
				onToggleStatus={(status) => setStatuses((current) => toggleFilterValue(current, status))}
			/>
			{props.sprints.map((section) => (
				<BacklogSection
					key={section.id}
					section={section}
					visibleItems={section.items.filter(matches)}
					boundarySide={section === runningSprint ? "sprint" : undefined}
					expanded={!collapsed.has(section.id)}
					onToggleExpanded={() => setCollapsed((current) => toggleFilterValue(current, section.id))}
					selected={selected}
					onSelectItems={selectItems}
					actions={props}
				/>
			))}
			{runningSprint && boundary ? (
				<SprintBoundary rootRef={rootRef} sprint={runningSprint} backlog={props.backlog} disabledReason={disabledReason} onMove={boundary.onMove} />
			) : null}
			<BacklogSection
				section={{ id: "backlog", title: "Backlog", items: props.backlog }}
				visibleItems={visibleBacklog}
				isBacklog
				boundarySide={runningSprint ? "backlog" : undefined}
				expanded={backlogExpanded}
				onToggleExpanded={() => setBacklogExpanded((current) => !current)}
				selected={selected}
				onSelectItems={selectItems}
				actions={props}
			/>
		</div>
	);
}
