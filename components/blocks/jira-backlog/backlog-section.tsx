import { Fragment, useId, useMemo, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { AnimatePresence } from "motion/react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { JIRA_LIST_AGENT_SESSIONS_COLUMN_WIDTH } from "@/components/blocks/jira-list/jira-list-appearance";
import { getInsertionLineTarget, getRowAnchorName, getRowZone, type JiraListInsertionTarget } from "@/components/blocks/jira-list/jira-list-dnd";
import { useJiraListRowHover } from "@/components/blocks/jira-list/use-jira-list-row-hover";
import { arrangeListHierarchy, useGroupedJiraRows } from "@/components/blocks/jira-list/jira-list-grouping";
import { JiraListDragOverlay, RowBoundaryCreateControls } from "@/components/blocks/jira-list/jira-list-rows";
import { JiraListGroupHeader, JiraListTable, JiraListTableCell, JiraListTableHead } from "@/components/blocks/jira-list/jira-list-table";
import { JiraListHierarchyButton } from "@/components/blocks/jira-list/jira-list-work-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Lozenge } from "@/components/ui/lozenge";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { BacklogRow } from "./backlog-row";
import { BacklogInlineDraftRow, reorderBacklogRows, useBacklogRowEditing } from "./backlog-row-editing";
import type { JiraBacklogItem, JiraBacklogProps, JiraBacklogSection } from "./types";

interface BacklogSectionProps {
	isDragging: boolean;
	onDraggingChange: (dragging: boolean) => void;
	draftSectionId: string | null;
	onDraftChange: (sectionId: string | null) => void;
	section: JiraBacklogSection;
	visibleItems: readonly JiraBacklogItem[];
	isBacklog?: boolean;
	boundarySide?: "sprint" | "backlog";
	expanded: boolean;
	onToggleExpanded: () => void;
	selected: ReadonlySet<string>;
	onSelectItems: (ids: readonly string[], checked: boolean) => void;
	actions: Pick<JiraBacklogProps,
		"people" | "onIssueClick" | "onStatusChange" | "onAssigneeChange" | "onCreate" | "onReorder" | "onSprintAction" |
		"agentCatalog" | "onAssignedAgentIdsChange" | "onAssignedAgentSelect" | "statusOptions" | "groups"
	>;
}

export function BacklogSection({
	isDragging,
	onDraggingChange,
	draftSectionId,
	onDraftChange,
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
	const editing = useBacklogRowEditing(section.id, onDraftChange, actions.onCreate);
	const { bodyRef, overlay, setOverlay, hovered, gripHover, setHovered, setInsertionHover, leave, leaveRow } = useJiraListRowHover();
	const [focusedGap, setFocusedGap] = useState<JiraListInsertionTarget | null>(null);
	const [emptyHierarchyExpanded, setEmptyHierarchyExpanded] = useState(false);
	const hierarchy = useMemo(() => arrangeListHierarchy(visibleItems, editing.expandedKeys), [visibleItems, editing.expandedKeys]);
	const grouped = useGroupedJiraRows(hierarchy, actions.groups);
	const rows = grouped?.items ?? hierarchy;
	const activeInsertionTarget = isDragging || draftSectionId ? null : focusedGap ?? (actions.onCreate && hovered && hovered.zone !== "drag" ? { issueKey: hovered.issueKey, position: hovered.zone } : null);
	const insertionLineTarget = getInsertionLineTarget(editing.draft ? null : activeInsertionTarget, rows);
	const selectedCount = rows.filter(({ id }) => selected.has(id)).length;
	const selectedIssueKeys = new Set(visibleItems.filter(({ id }) => selected.has(id)).map(({ issueKey }) => issueKey));
	const selectGroup = (keys: readonly string[], checked: boolean) => {
		const keySet = new Set(keys);
		onSelectItems(visibleItems.filter(({ issueKey }) => keySet.has(issueKey)).map(({ id }) => id), checked);
	};
	const visibleKeys = new Set(visibleItems.map(({ issueKey }) => issueKey));
	const parentKeys = new Set(visibleItems.flatMap(({ parentIssueKey }) => parentIssueKey && visibleKeys.has(parentIssueKey) ? [parentIssueKey] : []));
	const allExpanded = parentKeys.size > 0
		? [...parentKeys].every((key) => editing.expandedKeys.has(key))
		: emptyHierarchyExpanded;
	const todo = visibleItems.filter(({ status }) => status === "To do").length;
	const done = visibleItems.filter(({ status }) => status === "Done").length;
	const inProgress = visibleItems.length - todo - done;
	const sprintActionLabel = isBacklog ? "Create sprint" : "Complete sprint";
	const moveRow = actions.onReorder && !actions.groups && visibleItems.length === section.items.length && !editing.draft
		? (key: string, index: number) => {
			const keys = reorderBacklogRows(rows, key, index);
			if (keys) actions.onReorder?.(section.id, keys);
		}
		: undefined;
	const anchorIndex = editing.draft?.insertion ? rows.findIndex((item) => item.issueKey === editing.draft?.insertion?.relativeToIssueKey) : -1;
	const draftIndex = anchorIndex >= 0
		? anchorIndex + Number(editing.draft?.insertion?.position === "after")
		: editing.draft?.insertion?.insertAtIndex ?? rows.length;
	const renderDraft = (index: number) => editing.draft && index === draftIndex ? (
		<BacklogInlineDraftRow key={`draft-${index}`} draft={editing.draft} previous={rows[index - 1]} onChange={editing.setSummary} onParentChange={editing.setParent} onSubmit={editing.submit} onCancel={editing.cancel} />
	) : null;

	return (
		<section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2" data-sprint-boundary-side={boundarySide}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<div className="flex min-w-0 flex-wrap items-center gap-2 ps-0.5">
					<JiraListHierarchyButton
						expanded={expanded}
						label={`${expanded ? "Collapse" : "Expand"} ${section.title}`}
						onClick={onToggleExpanded}
					/>
					<h2 className="text-sm font-semibold text-text" id={headingId}>{section.title}</h2>
					{section.dateLabel ? <span className="text-xs text-text-subtlest">{section.dateLabel}</span> : null}
				</div>
				<div className="ml-auto flex items-center gap-2">
					<div className="flex items-center gap-1" role="group" aria-label={`Status counts: ${todo} to do, ${inProgress} started, ${done} done`}>
						<Lozenge aria-hidden>{todo}</Lozenge>
						<Lozenge aria-hidden variant="information">{inProgress}</Lozenge>
						<Lozenge aria-hidden variant="success">{done}</Lozenge>
					</div>
					<Button onClick={() => actions.onSprintAction?.(section.id)} size="compact" variant="outline">
						{sprintActionLabel}
					</Button>
				</div>
			</div>
			{expanded ? (
				<>
					<DndContext
						id={editing.instanceId}
						sensors={editing.sensors}
						onDragStart={() => { setHovered(null); setFocusedGap(null); onDraggingChange(true); }}
						onDragCancel={() => onDraggingChange(false)}
						onDragEnd={({ active, over }) => {
							onDraggingChange(false);
							if (over) moveRow?.(String(active.id), rows.findIndex((item) => item.issueKey === over.id));
						}}
					>
					<JiraListTable
						aria-label={`${section.title} work items`}
						className="min-w-[52rem]"
						containerClassName="rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
					>
						<colgroup>
							<col className="w-15" />
							<col />
							<col className="w-32" />
							<col className="w-40" />
							<col className={JIRA_LIST_AGENT_SESSIONS_COLUMN_WIDTH} />
							<col className="w-28" />
						</colgroup>
						<TableHeader>
							<TableRow className="border-0 hover:bg-transparent">
								<JiraListTableHead className="px-0">
									<div className="flex items-center ps-3">
									<Checkbox
										aria-label={`Select all work items in ${section.title}`}
										checked={rows.length > 0 && selectedCount === rows.length}
										indeterminate={selectedCount > 0 && selectedCount < rows.length}
										onCheckedChange={(checked) => onSelectItems(rows.map(({ id }) => id), checked)}
									/>
									<JiraListHierarchyButton
										expanded={allExpanded}
										label={`${allExpanded ? "Collapse" : "Expand"} all subtasks in ${section.title}`}
										onClick={() => {
											setEmptyHierarchyExpanded(!allExpanded);
											editing.toggleAll(parentKeys, allExpanded);
										}}
									/>
									</div>
								</JiraListTableHead>
							<JiraListTableHead className="ps-1">Work</JiraListTableHead>
								<JiraListTableHead>Status</JiraListTableHead>
								<JiraListTableHead>Assignee</JiraListTableHead>
								<JiraListTableHead>Agent sessions</JiraListTableHead>
								<JiraListTableHead>Priority</JiraListTableHead>
							</TableRow>
						</TableHeader>
						<TableBody ref={bodyRef} onPointerLeave={leave}>
							<SortableContext items={rows.map(({ issueKey }) => issueKey)} strategy={verticalListSortingStrategy}>
							{[
								...rows.flatMap((item, rowIndex) => [
									...(grouped?.before.get(item.issueKey) ?? []).map((group) => <JiraListGroupHeader key={`group-${group.id}`} columnCount={6} group={group} selectedIssueKeys={selectedIssueKeys} onSelectGroup={selectGroup} />),
									<Fragment key={item.id}>
										<AnimatePresence custom={Boolean(editing.draft)} initial={false}>{renderDraft(rowIndex)}</AnimatePresence>
										<BacklogRow
											item={item}
											createdDraftRow={editing.draft?.createdIssueKeys?.includes(item.issueKey) ?? false}
											firstCreatedDraftRow={editing.draft?.createdIssueKeys?.[0] === item.issueKey}
											insertionLinePosition={insertionLineTarget?.issueKey === item.issueKey ? insertionLineTarget.position : undefined}
											dimmed={Boolean(editing.draft && !editing.draft.createdIssueKeys?.includes(item.issueKey) && !(editing.draft.parentIssueKey && (item.issueKey === editing.draft.parentIssueKey || item.parentIssueKey === editing.draft.parentIssueKey)))}
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
											statusOptions={actions.statusOptions}
											onToggleExpanded={() => editing.toggleExpanded(item.issueKey)}
											rowControls={{
												instanceId: editing.instanceId,
												handleOverlayElement: overlay,
												isDropTarget: false,
												isHandleVisible: hovered?.issueKey === item.issueKey,
												onMoveRow: moveRow,
												onPointerLeave: leaveRow,
												onPointerMove: (event) => {
													if (isDragging) return;
													const { top, height } = event.currentTarget.getBoundingClientRect();
													const zone = getRowZone(event.clientY - top, height);
													setHovered((current) => current?.issueKey === item.issueKey && current.zone === zone ? current : { issueKey: item.issueKey, zone });
												},
												rowCount: rows.length,
												rowIndex,
												style: { anchorName: getRowAnchorName(editing.instanceId, rowIndex) },
											}}
										/>
									</Fragment>,
								]),
								...(grouped?.tail ?? []).map((group) => <JiraListGroupHeader key={`group-${group.id}`} columnCount={6} group={group} selectedIssueKeys={selectedIssueKeys} onSelectGroup={selectGroup} />),
							]}
							</SortableContext>
							<AnimatePresence custom={Boolean(editing.draft)} initial={false}>{renderDraft(rows.length)}</AnimatePresence>
							{visibleItems.length === 0 && !draftSectionId ? (
								<TableRow className="border-0 hover:bg-transparent">
									<JiraListTableCell colSpan={6} className="text-text-subtle">
										{section.items.length > 0 ? "No matching work items" : actions.onCreate ? (
											<Button onClick={() => editing.begin()} variant="ghost">Create work item</Button>
										) : "No work items"}
									</JiraListTableCell>
								</TableRow>
							) : null}
						</TableBody>
					</JiraListTable>
					<RowBoundaryCreateControls
						activeTarget={activeInsertionTarget}
						gripHover={gripHover}
						instanceId={editing.instanceId}
						onCreate={actions.onCreate && !draftSectionId && !isDragging ? editing.begin : undefined}
						onFocusedTargetChange={setFocusedGap}
						onHoveredTargetChange={setInsertionHover}
						overlayRef={setOverlay}
						onPointerLeave={leave}
						rows={rows}
						showHoverGrip={Boolean(moveRow && !isDragging)}
					/>
					<JiraListDragOverlay />
					</DndContext>
				</>
			) : null}
		</section>
	);
}
