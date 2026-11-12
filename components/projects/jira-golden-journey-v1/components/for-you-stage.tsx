"use client";

import { useMemo, useState } from "react";

import { JiraKanbanBoardHeader } from "@/components/blocks/jira-kanban/board-header";
import JiraKanbanPage from "@/components/blocks/jira-kanban/page";
import type { JiraKanbanAgentData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import {
	filterJiraKanbanColumnsByAssignee,
	getJiraKanbanAssignees,
} from "@/components/blocks/jira-kanban/state";
import { JiraList } from "@/components/blocks/jira-list";
import { JIRA_DESIGN_PROJECT } from "@/components/blocks/product-sidebar/data/jira-navigation";
import { JiraForYouWorkspace } from "@/components/projects/jira-for-you/jira-for-you-workspace";
import { JiraForYouShell } from "@/components/projects/jira-for-you/page";
import type { JiraForYouItem, JiraForYouSection } from "@/components/projects/jira-for-you/jira-for-you-types";
import {
	createJiraDesignListRows,
	JIRA_DESIGN_KANBAN_AGENTS,
	JIRA_DESIGN_KANBAN_COLUMNS,
	JIRA_DESIGN_WORKSPACE_SECTIONS,
} from "../data/jira-design-work-items";
import { JiraDesignViewTabs, type JiraDesignView } from "./jira-design-view-tabs";

interface JiraShellStageProps {
	children?: React.ReactNode;
	defaultSelectedSidebarItem?: string;
	defaultSidebarOpen?: boolean;
}

export function JiraShellStage({
	children,
	defaultSelectedSidebarItem,
	defaultSidebarOpen,
}: Readonly<JiraShellStageProps>): React.ReactElement {
	return (
		<div className="relative left-1/2 h-full min-h-0 w-[100cqw] -translate-x-1/2 overflow-hidden">
			<JiraForYouShell
				defaultSelectedSidebarItem={defaultSelectedSidebarItem}
				defaultSidebarOpen={defaultSidebarOpen}
				shellHeight="parent"
				showConversationHeaderBorder={false}
			>
				{children ? (
					<div className="h-full min-h-0 min-w-0 flex-1 overflow-auto">
						{children}
					</div>
				) : undefined}
			</JiraForYouShell>
		</div>
	);
}

export function ForYouStage(): React.ReactElement {
	return <JiraShellStage />;
}

interface JiraDesignWorkspaceStageProps {
	view: JiraDesignView;
	onViewChange: (view: JiraDesignView) => void;
	agents?: readonly JiraKanbanAgentData[];
	boardColumns?: readonly JiraKanbanColumnData[];
	defaultOpenItemId?: string;
	onBoardColumnsChange?: (columns: readonly JiraKanbanColumnData[]) => void;
	sections?: readonly JiraForYouSection[];
}

function JiraListFeed({
	activeIssueKey,
	boardColumns,
	compactHeader,
	onItemActivate,
	onViewChange,
	workItemsByKey,
}: Readonly<Pick<JiraDesignWorkspaceStageProps, "onViewChange"> & {
	activeIssueKey?: string;
	boardColumns: readonly JiraKanbanColumnData[];
	compactHeader: boolean;
	onItemActivate: (item: JiraForYouItem) => void;
	workItemsByKey: ReadonlyMap<string, JiraForYouItem>;
}>): React.ReactElement {
	const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(() => new Set());
	const assignees = useMemo(() => getJiraKanbanAssignees(boardColumns), [boardColumns]);
	const filteredBoardColumns = useMemo(
		() => filterJiraKanbanColumnsByAssignee(boardColumns, selectedAssigneeIds),
		[boardColumns, selectedAssigneeIds],
	);
	const rows = useMemo(
		() => createJiraDesignListRows(filteredBoardColumns, workItemsByKey),
		[filteredBoardColumns, workItemsByKey],
	);

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-surface">
			<JiraKanbanBoardHeader
				assignees={assignees}
				compact={compactHeader}
				onSelectedAssigneeIdsChange={setSelectedAssigneeIds}
				searchPlaceholder="Search list"
				selectedAssigneeIds={selectedAssigneeIds}
				surfaceLabel="list"
				viewTabs={<JiraDesignViewTabs activeView="list" onViewChange={onViewChange} />}
			/>
			<div className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
				<JiraList
					activeIssueKey={activeIssueKey}
					agentCatalog={JIRA_DESIGN_KANBAN_AGENTS}
					ariaLabel="For you work items list"
					onIssueClick={(row) => {
						const item = workItemsByKey.get(row.issueKey);
						if (item) {
							onItemActivate(item);
						}
					}}
					rows={rows}
					totalCountLabel={`${rows.length}`}
					visibleCount={rows.length}
				/>
			</div>
		</div>
	);
}

export function JiraDesignWorkspaceStage({
	agents = JIRA_DESIGN_KANBAN_AGENTS,
	boardColumns: controlledBoardColumns,
	defaultOpenItemId = "vitafleet-presentation",
	onBoardColumnsChange,
	onViewChange,
	sections = JIRA_DESIGN_WORKSPACE_SECTIONS,
	view,
}: Readonly<JiraDesignWorkspaceStageProps>): React.ReactElement {
	const [localBoardColumns, setLocalBoardColumns] = useState(
		() => JIRA_DESIGN_KANBAN_COLUMNS.map((column) => ({
			...column,
			cards: [...column.cards],
		})),
	);
	const boardColumns = controlledBoardColumns ?? localBoardColumns;
	const workItemsById = useMemo(
		() => new Map(sections.flatMap((section) => section.items).map((item) => [item.id, item])),
		[sections],
	);
	const workItemsByKey = useMemo(
		() => new Map([...workItemsById.values()].map((item) => [item.issueKey, item])),
		[workItemsById],
	);
	const updateBoardColumns = (columns: readonly JiraKanbanColumnData[]) => {
		const nextColumns = columns.map((column) => ({ ...column, cards: [...column.cards] }));
		if (controlledBoardColumns !== undefined) {
			onBoardColumnsChange?.(nextColumns);
			return;
		}
		setLocalBoardColumns(nextColumns);
	};

	return (
		<JiraShellStage
			defaultSelectedSidebarItem={JIRA_DESIGN_PROJECT.name}
			defaultSidebarOpen={false}
		>
			<JiraForYouWorkspace
				chrome="plain"
				className="h-full min-h-0 flex-1"
				defaultDetailPanelOpen
				defaultOpenItemId={defaultOpenItemId}
				feedResizeLabel="Resize Jira Design view panel"
				preserveChatWidthAcrossSidebar
				renderFeed={({ activeItemId, onItemActivate }) => (
					view === "board" ? (
						<JiraKanbanPage
							activeCardCode={activeItemId
								? workItemsById.get(activeItemId)?.issueKey
								: undefined}
							agents={agents}
							ariaLabel="For you work items board. Scroll horizontally to review all statuses."
							boardColumns={boardColumns}
							compactHeader={Boolean(activeItemId)}
							onBoardColumnsChange={updateBoardColumns}
							onCardClick={(card) => {
								const item = workItemsByKey.get(card.code);
								if (item) {
									onItemActivate(item);
								}
							}}
							viewTabs={<JiraDesignViewTabs activeView="board" onViewChange={onViewChange} />}
						/>
					) : (
						<JiraListFeed
							activeIssueKey={activeItemId
								? workItemsById.get(activeItemId)?.issueKey
								: undefined}
							boardColumns={boardColumns}
							compactHeader={Boolean(activeItemId)}
							onItemActivate={onItemActivate}
							onViewChange={onViewChange}
							workItemsByKey={workItemsByKey}
						/>
					)
				)}
				sections={sections}
				showConversationHeaderBorder={false}
			/>
		</JiraShellStage>
	);
}
