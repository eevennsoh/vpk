"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

import { motionDuration, motionEase } from "@/lib/motion";

import { BacklogSection } from "./backlog-section";
import { BacklogToolbar } from "./backlog-toolbar";
import { SprintBoundary } from "./sprint-boundary";
import type { JiraBacklogItem, JiraBacklogProps, JiraBacklogSprintMove, JiraBacklogStatus } from "./types";

export type { JiraBacklogInlineCreate, JiraBacklogItem, JiraBacklogProps, JiraBacklogSection, JiraBacklogSprintMove, JiraBacklogStatus } from "./types";

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
	const [draftSectionId, setDraftSectionId] = useState<string | null>(null);
	const [isRowDragging, setIsRowDragging] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const pendingMove = useRef<JiraBacklogSprintMove | null>(null);
	const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const animations = useRef<ReturnType<typeof animate>[]>([]);
	const reduceMotion = useReducedMotion();
	const search = query.trim().toLowerCase();

	function matches(item: JiraBacklogItem) {
		return (props.visibleIssueKeys?.has(item.issueKey) ?? true)
			&& (assigneeIds.size === 0 || assigneeIds.has(item.assignee?.id))
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
	const sprintSections = props.sprints.map((section) => ({ section, visibleItems: section.items.filter(matches) }));
	const visibleCount = sprintSections.reduce((count, { visibleItems }) => count + visibleItems.length, visibleBacklog.length);
	const totalCount = props.sprints.reduce((count, { items }) => count + items.length, props.backlog.length);
	const lastSprint = props.sprints.at(-1);
	const boundary = props.sprintBoundary;
	const runningSprint = lastSprint?.id === boundary?.sprintId ? lastSprint : undefined;

	useLayoutEffect(() => {
		const move = pendingMove.current;
		if (!move || !runningSprint || !rootRef.current) return;
		const destination = move.destination === "sprint" ? runningSprint.items : props.backlog;
		const source = move.destination === "sprint" ? props.backlog : runningSprint.items;
		if (!move.itemIds.every((id) => destination.some((item) => item.id === id) && !source.some((item) => item.id === id))) return;
		pendingMove.current = null;
		if (pendingTimer.current) clearTimeout(pendingTimer.current);
		if (reduceMotion) return;
		const ids = new Set(move.itemIds);
		const rows = rootRef.current.querySelectorAll<HTMLElement>(`[data-sprint-boundary-side="${move.destination}"] [data-backlog-item-row]`);
		const cells: Element[] = [];
		for (const row of rows) {
			if (!ids.has(row.dataset.backlogItemId ?? "")) continue;
			let current: Element | null = row;
			do {
				cells.push(...current.children);
				current = current.nextElementSibling;
			} while (current?.hasAttribute("data-backlog-child-row"));
		}
		if (cells.length) animations.current.push(animate(cells, { y: [move.destination === "sprint" ? 10 : -10, 0], opacity: [0.65, 1] }, { duration: motionDuration.medium, ease: motionEase.outPractical }));
	});

	useLayoutEffect(() => () => {
		if (pendingTimer.current) clearTimeout(pendingTimer.current);
		for (const animation of animations.current) animation.cancel();
	}, []);

	function moveAcrossBoundary(move: JiraBacklogSprintMove) {
		if (pendingTimer.current) clearTimeout(pendingTimer.current);
		for (const animation of animations.current) animation.cancel();
		animations.current = [];
		pendingMove.current = move;
		pendingTimer.current = setTimeout(() => { pendingMove.current = null; }, 1000);
		boundary?.onMove(move);
	}
	let disabledReason: string | undefined;
	if (runningSprint) {
		if (collapsed.has(runningSprint.id) || !backlogExpanded) {
			disabledReason = "Expand both sections to move work items";
		} else if (visibleBacklog.length !== props.backlog.length || !runningSprint.items.every(matches)) {
			disabledReason = "Clear filters to move work items";
		} else if (props.groups) {
			disabledReason = "Clear grouping to move work items";
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
			{props.showToolbar !== false ? <BacklogToolbar
				query={query}
				countLabel={`${visibleCount} of ${totalCount} work items`}
				onQueryChange={setQuery}
				people={props.people ?? []}
				assigneeIds={assigneeIds}
				onToggleAssignee={(id) => setAssigneeIds((current) => toggleFilterValue(current, id))}
				statuses={statuses}
				statusOptions={props.statusOptions}
				onToggleStatus={(status) => setStatuses((current) => toggleFilterValue(current, status))}
			/> : null}
			{sprintSections.map(({ section, visibleItems }) => (
				<BacklogSection
					isDragging={isRowDragging}
					onDraggingChange={setIsRowDragging}
					draftSectionId={draftSectionId}
					onDraftChange={setDraftSectionId}
					key={section.id}
					section={section}
					visibleItems={visibleItems}
					boundarySide={section === runningSprint ? "sprint" : undefined}
					expanded={!collapsed.has(section.id)}
					onToggleExpanded={() => setCollapsed((current) => toggleFilterValue(current, section.id))}
					selected={selected}
					onSelectItems={selectItems}
					actions={props}
				/>
			))}
			{runningSprint && boundary ? (
				<SprintBoundary
					rootRef={rootRef}
					sprint={{ ...runningSprint, items: runningSprint.items.filter((item) => !item.parentIssueKey) }}
					backlog={props.backlog.filter((item) => !item.parentIssueKey)}
					disabledReason={disabledReason}
					onMove={moveAcrossBoundary}
				/>
			) : null}
			<BacklogSection
				isDragging={isRowDragging}
				onDraggingChange={setIsRowDragging}
				draftSectionId={draftSectionId}
				onDraftChange={setDraftSectionId}
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
