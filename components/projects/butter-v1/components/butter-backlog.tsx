"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";

import { JiraBacklog, type JiraBacklogInlineCreate, type JiraBacklogProps, type JiraBacklogSprintMove } from "@/components/blocks/jira-backlog";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { moveJiraKanbanCardsToStatus } from "@/components/blocks/jira-kanban/card-drop";
import type { JiraListPerson } from "@/components/blocks/jira-list";
import type { JiraWorkItemGroup } from "@/components/blocks/jira-list/jira-list-grouping";
import { BUTTER_PAY_CURRENT_USER } from "../data/current-user";
import { PAY_STORY_PEOPLE } from "../data/presentation-people";
import type { ButterBacklogOrder } from "../lib/backlog-order";
import { applyListOrder, BUTTER_LIST_STATUS_OPTIONS, createListRows, getNextPayIssueKey, insertWorkItemCard, toKanbanCardFromDraft } from "../lib/list-rows";

const SPRINT_ID = "butter-current-sprint";

interface ButterBacklogProps extends Pick<JiraBacklogProps, "agentCatalog" | "onAssignedAgentIdsChange" | "onAssignedAgentSelect"> {
	panelId: string;
	columns: readonly JiraKanbanColumnData[];
	filteredColumns: readonly JiraKanbanColumnData[];
	groups?: readonly JiraWorkItemGroup[];
	setBoardColumns: Dispatch<SetStateAction<JiraKanbanColumnData[]>>;
	order: ButterBacklogOrder;
	wacContent: boolean;
	onMove: (move: JiraBacklogSprintMove) => void;
	onOrderChange: NonNullable<JiraBacklogProps["onReorder"]>;
	onIssueOpen: (issueKey: string) => void;
}

export default function ButterBacklog({
	panelId,
	columns,
	filteredColumns,
	groups,
	setBoardColumns,
	order,
	wacContent,
	onMove,
	onOrderChange,
	onIssueOpen,
	agentCatalog,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
}: Readonly<ButterBacklogProps>) {
	const { sprintItems, backlogItems, people } = useMemo(() => {
		const rows = createListRows(columns, agentCatalog ?? []);
		const sprintKeys = new Set(order.sprintKeys);
		const rowsByKey = new Map(rows.map((row) => [row.issueKey, row]));
		function inSprint(issueKey: string) {
			const seen = new Set<string>();
			let current = issueKey;
			while (!seen.has(current)) {
				seen.add(current);
				const parent = rowsByKey.get(current)?.parentIssueKey;
				if (!parent || !rowsByKey.has(parent)) return sprintKeys.has(current);
				current = parent;
			}
			return false;
		}
		const toItem = (row: (typeof rows)[number]) => ({ ...row, id: row.issueKey });
		const peopleById = new Map<string, JiraListPerson>();
		if (!wacContent) peopleById.set(BUTTER_PAY_CURRENT_USER.id, BUTTER_PAY_CURRENT_USER);
		for (const person of Object.values(PAY_STORY_PEOPLE)) peopleById.set(person.id, person);
		for (const { assignee } of rows) {
			if (assignee) peopleById.set(assignee.id, assignee);
		}
		return {
			sprintItems: applyListOrder(rows.filter(({ issueKey }) => inSprint(issueKey)), order.sprintKeys).map(toItem),
			backlogItems: applyListOrder(rows.filter(({ issueKey }) => !inSprint(issueKey)), order.backlogKeys).map(toItem),
			people: [...peopleById.values()],
		};
	}, [columns, agentCatalog, order, wacContent]);
	const visibleIssueKeys = useMemo(() => new Set(filteredColumns.flatMap(({ cards }) => cards.map(({ code }) => code))), [filteredColumns]);

	function createWorkItem({ sectionId, insertion, parentIssueKey, summary }: JiraBacklogInlineCreate) {
		const items = sectionId === SPRINT_ID ? sprintItems : backlogItems;
		const parent = items.find((item) => item.issueKey === parentIssueKey);
		const anchor = items.find((item) => item.issueKey === insertion?.relativeToIssueKey);
		const source = parent ?? (groups ? anchor : undefined);
		const column = columns.find(({ cards }) => cards.some(({ code }) => code === source?.issueKey));
		const issueKey = getNextPayIssueKey(columns);
		const card = toKanbanCardFromDraft({
			issueKey,
			issueType: parent ? "subtask" : "task",
			parentIssueKey: parent?.issueKey,
			summary,
		});
		const keys = items.map((item) => item.issueKey);
		const index = anchor && insertion ? keys.indexOf(anchor.issueKey) + Number(insertion.position === "after") : keys.length;
		keys.splice(index, 0, issueKey);
		setBoardColumns((current) => insertWorkItemCard(current, { ...card, status: source?.status }, column?.title ?? "To do"));
		onOrderChange(sectionId, keys);
		return issueKey;
	}

	return (
		<div
			aria-labelledby={`${panelId}-tab`}
			className="min-h-0 min-w-0 flex-1 overflow-auto px-6 pb-6 pt-0.5"
			id={panelId}
			role="tabpanel"
			tabIndex={0}
		>
			<JiraBacklog
				agentCatalog={agentCatalog}
				backlog={backlogItems}
				groups={groups}
				onAssignedAgentIdsChange={onAssignedAgentIdsChange}
				onAssignedAgentSelect={onAssignedAgentSelect}
				onAssigneeChange={(id, assignee) => setBoardColumns((current) => current.map((column) => (
					column.cards.some((card) => card.code === id) ? {
						...column,
						cards: column.cards.map((card) => card.code === id ? { ...card, assignee, avatarSrc: assignee?.avatarSrc } : card),
					} : column
				)))}
				onIssueClick={(item) => onIssueOpen(item.issueKey)}
				onCreate={createWorkItem}
				onReorder={onOrderChange}
				onStatusChange={(id, status) => setBoardColumns((current) => moveJiraKanbanCardsToStatus(current, [id], status))}
				people={people}
				showToolbar={false}
				sprintBoundary={{ sprintId: SPRINT_ID, onMove }}
				sprints={[{ id: SPRINT_ID, title: wacContent ? "Checkout sprint" : "Payments SDK sprint", items: sprintItems }]}
				statusOptions={BUTTER_LIST_STATUS_OPTIONS}
				visibleIssueKeys={visibleIssueKeys}
			/>
		</div>
	);
}
