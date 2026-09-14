"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import { mergeJiraKanbanAgentCatalog } from "@/components/blocks/jira-kanban/lib/agent-catalog";
import { linkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import { moveJiraKanbanCardsToDropTarget } from "@/components/blocks/jira-kanban/card-drop";
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type {
	JiraListAssignedAgent,
	JiraListDraftWorkItem,
	JiraListInsertion,
	JiraListIssueType,
	JiraListPerson,
	JiraListProps,
	JiraListRowData,
	JiraListStatusOption,
} from "@/components/blocks/jira-list";

import { JIRA_TEAM_EU26_PAY_BOARD_AGENTS } from "../data/presentation-story";
import {
	applyAssignedAgentIdsToColumns,
	applyListOrder,
	appendBoardCreatedListOrder,
	createBoardWorkItemFromSession,
	createListRows,
	createListRowIndex,
	selectListRows,
	createListWorkItemFromSession,
	getNextPayIssueKey,
	insertListOrderKey,
	insertWorkItemCard,
	JIRA_TEAM_EU26_LIST_STATUS_OPTIONS,
	moveListOrder,
	toKanbanCardFromDraft,
} from "../lib/list-rows";

const ignoreIssueClick = () => undefined;

const JIRA_TEAM_EU26_AGENT_CATALOG = mergeJiraKanbanAgentCatalog(
	JIRA_TEAM_EU26_PAY_BOARD_AGENTS,
);

interface ListDraftWorkItem {
	anchorIssueKey: string | null;
	assignee?: JiraListPerson;
	dueDate?: string;
	insertAtIndex: number | null;
	issueType: JiraListIssueType;
	summary: string;
}

export interface CreateFromAgentSessionInput {
	activity: JiraIssueAgentActivity;
	insertion: JiraListInsertion;
	session: Readonly<Pick<AgentSessionItem, "id" | "invokedBy" | "title">>;
}

export interface CreateBoardFromAgentSessionInput {
	activity: JiraIssueAgentActivity;
	columnTitle: string;
	/** Type the viewer picked in the session menu. Defaults to a task. */
	issueType?: JiraKanbanCardData["issueType"];
	/** Slot within the column. Omitted by the create well, which appends. */
	insertAtIndex?: number;
	session: Readonly<Pick<AgentSessionItem, "id" | "invokedBy" | "title">>;
}

export interface UseJiraTeamEu26ListResult {
	createBoardFromAgentSession: (input: CreateBoardFromAgentSessionInput) => string | undefined;
	/** Returns the row the session landed in, so the caller can acknowledge it. */
	createFromAgentSession: (input: CreateFromAgentSessionInput) => string;
	getProps: (columns: readonly JiraKanbanColumnData[]) => JiraListProps;
	onAssignedAgentIdsChange: (issueKey: string, agentIds: readonly string[]) => void;
	onVisibleRowsChange: (rows: readonly JiraListRowData[]) => void;
}

export function useJiraTeamEu26List({
	boardColumns,
	onAssignedAgentSelect,
	setBoardColumns,
}: Readonly<{
	boardColumns: readonly JiraKanbanColumnData[];
	onAssignedAgentSelect?: (issueKey: string, agent: JiraListAssignedAgent) => void;
	setBoardColumns: Dispatch<SetStateAction<JiraKanbanColumnData[]>>;
}>): UseJiraTeamEu26ListResult {
	const [listOrder, setListOrder] = useState<readonly string[]>([]);
	const [selectedIssueKeys, setSelectedIssueKeys] = useState<Set<string>>(() => new Set());
	const [copiedIssueKey, setCopiedIssueKey] = useState<string | null>(null);
	const [draftWorkItem, setDraftWorkItem] = useState<ListDraftWorkItem | null>(null);
	const rowIndex = useMemo(
		() => createListRowIndex(boardColumns, JIRA_TEAM_EU26_AGENT_CATALOG),
		[boardColumns],
	);
	const nextIssueKey = useMemo(() => getNextPayIssueKey(boardColumns), [boardColumns]);
	const visibleKeysRef = useRef<readonly string[]>([]);
	const onVisibleRowsChange = useCallback((rows: readonly JiraListRowData[]) => {
		visibleKeysRef.current = rows.map((row) => row.issueKey);
	}, []);
	const boardColumnsRef = useRef(boardColumns);
	const listOrderRef = useRef(listOrder);

	useEffect(() => {
		boardColumnsRef.current = boardColumns;
	}, [boardColumns]);

	useEffect(() => {
		listOrderRef.current = listOrder;
	}, [listOrder]);

	useEffect(() => {
		if (!copiedIssueKey) {
			return;
		}

		const copiedStateTimer = window.setTimeout(() => {
			setCopiedIssueKey(null);
		}, 1800);

		return () => window.clearTimeout(copiedStateTimer);
	}, [copiedIssueKey]);

	const handleSelectAllRows = useCallback((checked: boolean) => {
		setSelectedIssueKeys(checked ? new Set(visibleKeysRef.current) : new Set<string>());
	}, []);

	const handleSelectRow = useCallback((issueKey: string, checked: boolean) => {
		setSelectedIssueKeys((currentSelected) => {
			const nextSelected = new Set(currentSelected);
			if (checked) {
				nextSelected.add(issueKey);
			} else {
				nextSelected.delete(issueKey);
			}
			return nextSelected;
		});
	}, []);

	const handleMoveRow = useCallback((issueKey: string, targetIndex: number) => {
		setListOrder((currentOrder) => {
			const allKeys = createListRows(
				boardColumns,
				JIRA_TEAM_EU26_AGENT_CATALOG,
			).map((row) => row.issueKey);
			return moveListOrder(
				currentOrder.length === 0 ? allKeys : currentOrder,
				visibleKeysRef.current,
				issueKey,
				targetIndex,
			);
		});
	}, [boardColumns]);

	const handleCreateWorkItem = useCallback((insertion?: JiraListInsertion) => {
		const visibleKeys = visibleKeysRef.current;
		const anchorIssueKey = insertion?.relativeToIssueKey ?? visibleKeys[visibleKeys.length - 1] ?? null;
		setDraftWorkItem({
			anchorIssueKey,
			insertAtIndex: insertion?.insertAtIndex ?? null,
			issueType: "task",
			summary: "",
		});
	}, []);

	const handleDraftWorkItemSubmit = useCallback(() => {
		if (!draftWorkItem?.summary.trim()) {
			return;
		}

		const issueKey = getNextPayIssueKey(boardColumns);
		const card = toKanbanCardFromDraft({
			assignee: draftWorkItem.assignee,
			dueDate: draftWorkItem.dueDate,
			issueKey,
			issueType: draftWorkItem.issueType,
			summary: draftWorkItem.summary.trim(),
		});
		setBoardColumns((columns) => insertWorkItemCard(columns, card, "To do"));
		setListOrder((currentOrder) => insertListOrderKey(
			currentOrder,
			visibleKeysRef.current,
			issueKey,
			draftWorkItem.insertAtIndex,
		));
		setSelectedIssueKeys(new Set([issueKey]));
		setDraftWorkItem(null);
	}, [boardColumns, draftWorkItem, setBoardColumns]);

	const handleCopyLink = useCallback(async (row: JiraListRowData) => {
		const currentUrl = new URL(window.location.href);
		currentUrl.hash = row.issueKey.toLowerCase();

		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(currentUrl.toString());
			}
		} catch {
			// Keep the demo optimistic even if clipboard access is blocked.
		}

		setCopiedIssueKey(row.issueKey);
	}, []);

	const handleRefresh = useCallback(() => {
		setListOrder([]);
		setSelectedIssueKeys(new Set());
		setCopiedIssueKey(null);
		setDraftWorkItem(null);
	}, []);

	const handleStatusChange = useCallback((issueKey: string, status: JiraListStatusOption) => {
		setBoardColumns((columns) => {
			const column = columns.find((candidate) => (candidate.statuses ?? [candidate.title]).includes(status.status));
			return column ? moveJiraKanbanCardsToDropTarget(columns, [issueKey], column.title, { status: status.status }) : columns;
		});
	}, [setBoardColumns]);

	const handleAssignedAgentIdsChange = useCallback((
		issueKey: string,
		agentIds: readonly string[],
	) => {
		setBoardColumns((columns) => applyAssignedAgentIdsToColumns(
			columns,
			issueKey,
			agentIds,
			JIRA_TEAM_EU26_AGENT_CATALOG,
		));
	}, [setBoardColumns]);

	// One drop can carry several marked sessions, and the transfer plan replays
	// this callback once per session inside a single event. Every read is
	// therefore taken from a ref and written straight back: `visibleKeys`
	// included, because the second session's insertion index is measured against
	// a list that already contains the first session's new row.
	//
	// The created rows are deliberately left unselected — the caller flashes them
	// instead. Checking them would claim the drop made a bulk selection.
	const createFromAgentSession = useCallback((input: CreateFromAgentSessionInput) => {
		const result = createListWorkItemFromSession({
			activity: input.activity,
			columns: boardColumnsRef.current,
			insertion: input.insertion,
			linkSession: linkJiraKanbanAgentSession,
			listOrder: listOrderRef.current,
			session: input.session,
			visibleKeys: visibleKeysRef.current,
		});
		boardColumnsRef.current = result.columns;
		listOrderRef.current = result.listOrder;
		if (result.kind === "created") {
			visibleKeysRef.current = insertListOrderKey(
				visibleKeysRef.current,
				visibleKeysRef.current,
				result.issueKey,
				input.insertion.insertAtIndex,
			);
		}
		setBoardColumns([...result.columns]);
		setListOrder(result.listOrder);
		return result.issueKey;
	}, [setBoardColumns]);

	const createBoardFromAgentSession = useCallback((input: CreateBoardFromAgentSessionInput) => {
		const columnsBeforeCreate = boardColumnsRef.current;
		const result = createBoardWorkItemFromSession({
			activity: input.activity,
			columns: columnsBeforeCreate,
			columnTitle: input.columnTitle,
			issueType: input.issueType,
			insertAtIndex: input.insertAtIndex,
			linkSession: linkJiraKanbanAgentSession,
			session: input.session,
		});
		if (result.kind === "already-attached") {
			return undefined;
		}

		const nextListOrder = appendBoardCreatedListOrder({
			columns: columnsBeforeCreate,
			issueKey: result.issueKey,
			listOrder: listOrderRef.current,
			visibleKeys: visibleKeysRef.current,
		});
		boardColumnsRef.current = result.columns;
		listOrderRef.current = nextListOrder;
		setBoardColumns([...result.columns]);
		setListOrder(nextListOrder);
		return result.issueKey;
	}, [setBoardColumns]);

	const handleDraftWorkItemAssigneeChange = useCallback((
		assignee: JiraListPerson | undefined,
	) => {
		setDraftWorkItem((currentDraft) => (
			currentDraft ? { ...currentDraft, assignee } : currentDraft
		));
	}, []);

	const handleDraftWorkItemDueDateChange = useCallback((
		dueDate: string | undefined,
	) => {
		setDraftWorkItem((currentDraft) => (
			currentDraft ? { ...currentDraft, dueDate } : currentDraft
		));
	}, []);

	const handleDraftWorkItemIssueTypeChange = useCallback((
		issueType: JiraListIssueType,
	) => {
		setDraftWorkItem((currentDraft) => (
			currentDraft ? { ...currentDraft, issueType } : currentDraft
		));
	}, []);

	const handleDraftWorkItemSummaryChange = useCallback((
		summary: string,
	) => {
		setDraftWorkItem((currentDraft) => (
			currentDraft ? { ...currentDraft, summary } : currentDraft
		));
	}, []);

	const handleDraftWorkItemCancel = useCallback(() => setDraftWorkItem(null), []);

	const getProps = useCallback((columns: readonly JiraKanbanColumnData[]): JiraListProps => {
		const rows = applyListOrder(
			selectListRows(columns, JIRA_TEAM_EU26_AGENT_CATALOG, rowIndex),
			listOrder,
		);

		return {
			agentCatalog: JIRA_TEAM_EU26_AGENT_CATALOG,
			ariaLabel: "Payments SDK v2 migration work items list",
			className: "max-h-full",
			copiedIssueKey,
			draftWorkItem: draftWorkItem
				? {
					assignee: draftWorkItem.assignee,
					dueDate: draftWorkItem.dueDate,
					insertAtIndex: draftWorkItem.insertAtIndex,
					issueKeyLabel: nextIssueKey,
					issueType: draftWorkItem.issueType,
					summary: draftWorkItem.summary,
				} satisfies JiraListDraftWorkItem
				: null,
			onAssignedAgentIdsChange: handleAssignedAgentIdsChange,
			onAssignedAgentSelect,
			onCopyLink: handleCopyLink,
			onCreate: handleCreateWorkItem,
			onDraftWorkItemAssigneeChange: handleDraftWorkItemAssigneeChange,
			onDraftWorkItemCancel: handleDraftWorkItemCancel,
			onDraftWorkItemDueDateChange: handleDraftWorkItemDueDateChange,
			onDraftWorkItemIssueTypeChange: handleDraftWorkItemIssueTypeChange,
			onDraftWorkItemSubmit: handleDraftWorkItemSubmit,
			onDraftWorkItemSummaryChange: handleDraftWorkItemSummaryChange,
			onIssueClick: ignoreIssueClick,
			onIssueKeyClick: ignoreIssueClick,
			onMoveRow: handleMoveRow,
			onRefresh: handleRefresh,
			onSelectAllRows: handleSelectAllRows,
			onSelectRow: handleSelectRow,
			onStatusChange: handleStatusChange,
			rows,
			selectedIssueKeys,
			statusOptions: JIRA_TEAM_EU26_LIST_STATUS_OPTIONS,
			totalCountLabel: `${rows.length}`,
			visibleCount: rows.length,
		};
	}, [
		copiedIssueKey,
		draftWorkItem,
		handleAssignedAgentIdsChange,
		handleCopyLink,
		handleCreateWorkItem,
		handleDraftWorkItemAssigneeChange,
		handleDraftWorkItemCancel,
		handleDraftWorkItemDueDateChange,
		handleDraftWorkItemIssueTypeChange,
		handleDraftWorkItemSummaryChange,
		handleDraftWorkItemSubmit,
		handleMoveRow,
		handleRefresh,
		handleSelectAllRows,
		handleSelectRow,
		handleStatusChange,
		listOrder,
		nextIssueKey,
		rowIndex,
		onAssignedAgentSelect,
		selectedIssueKeys,
	]);

	return { createBoardFromAgentSession, createFromAgentSession, getProps, onVisibleRowsChange, onAssignedAgentIdsChange: handleAssignedAgentIdsChange };
}
