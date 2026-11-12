"use client";

import { useState } from "react";

import type { KanbanColumnChrome } from "@/components/blocks/jira-kanban/column-chrome";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import Page from "@/components/blocks/jira-kanban/page";
import ExperimentalPage from "@/components/blocks/jira-kanban/experimental/page";
import ExperimentalV2Page from "@/components/blocks/jira-kanban/experimental-v2/page";
import { JiraList } from "@/components/blocks/jira-list";
import { useDesignVariants } from "@/components/hooks/use-design-variants";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	createJiraGoldenJourneyV4PayBoardColumns,
	JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS,
	JIRA_GOLDEN_JOURNEY_V4_PAY_HEADER_ASSIGNEES,
	JIRA_GOLDEN_JOURNEY_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
} from "@/components/projects/jira-golden-journey-v4/data/presentation-story";
import {
	applyAssignedAgentIdsToColumns,
	createListRows,
} from "@/components/projects/jira-golden-journey-v4/lib/list-rows";

function readKanbanColumnChrome(
	values: readonly string[],
): KanbanColumnChrome | undefined {
	const next = values[0];
	if (next === "default" || next === "simple") {
		return next;
	}
	return undefined;
}

function createEmptyColumnExample(): JiraKanbanColumnData[] {
	return createJiraGoldenJourneyV4PayBoardColumns().map((column) => (
		column.title === "In review"
			? column
			: { ...column, cards: [], count: 0 }
	));
}

export default function JiraKanbanDemo() {
	return <JiraKanbanDemoProjectButter />;
}

export function JiraKanbanDemoProjectButter({ emptyColumns = false }: Readonly<{ emptyColumns?: boolean }> = {}) {
	const { designVariants } = useDesignVariants();
	const [boardColumns, setBoardColumns] = useState(
		emptyColumns ? createEmptyColumnExample : createJiraGoldenJourneyV4PayBoardColumns,
	);
	return (
		<ExperimentalPage
			advancedAgentSessionTimeline={designVariants.advancedTimeline}
			agentActivityLayout="merged"
			agentSessionAssigneeIdAliases={JIRA_GOLDEN_JOURNEY_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID}
			agentSessionColumnGlow={{
				glowBloom: designVariants.sessionBloom,
				glowReach: designVariants.sessionProximity,
				glowStroke: designVariants.sessionStroke,
			}}
			agentSessionColumnResizable={designVariants.agentSessionColumnResizing}
			agentSessionLinkingVariant="glow"
			agentSessionMultiSelect={false}
			agentSessionPresentation="column"
			agentSessionPreviewEffect={designVariants.sessionPeel ? "peel" : undefined}
			agents={JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS}
			ariaLabel="Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."
			boardColumns={boardColumns}
			cardAppearance="project-butter"
			cardGenerativeActionPresentation="more-actions"
			columnChrome="default"
			columnSizing="content"
			createWellBounce="off"
			createWorkItemDropZoneLabel="Drop to create work item"
			defaultShowUntracked={false}
			headerAssignees={JIRA_GOLDEN_JOURNEY_V4_PAY_HEADER_ASSIGNEES}
			iconScale="comfortable"
			insightsEnabled={false}
			issueDragTransitions
			issueDropMotion="solitaire"
			issueSelectionAppearance="fused-backdrop"
			onBoardColumnsChange={(columns) => setBoardColumns([...columns])}
			showAgentSessionColumn
			showAgentSessionFilter={false}
			showAgentSessionFlyoutFooter={false}
			showAgentSessionLinkAction={false}
			showAgentSessionLinkWorkItemMenuItem={designVariants.manualLink}
			showAgentSessionOverflow={false}
			showAgentSessionUnlinkWell={false}
			suggestSessionBoardLinkOnHover={false}
		/>
	);
}

export function JiraKanbanDemoStandard() {
	return <Page />;
}

export function JiraKanbanDemoExperimental() {
	return <ExperimentalPage columnChrome="simple" />;
}

function JiraKanbanDemoExperimentalV2Body({
	columnChrome: columnChromeProp,
}: Readonly<{
	columnChrome: KanbanColumnChrome;
}>) {
	const [activeView, setActiveView] = useState<"board" | "list">("board");
	const [boardColumns, setBoardColumns] = useState(createJiraGoldenJourneyV4PayBoardColumns);
	const [columnChrome, setColumnChrome] = useState(columnChromeProp);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 justify-end px-3 py-2">
				<ToggleGroup
					aria-label="Kanban column chrome"
					onValueChange={(values) => {
						const nextChrome = readKanbanColumnChrome(values);
						if (nextChrome) {
							setColumnChrome(nextChrome);
						}
					}}
					size="sm"
					value={[columnChrome]}
					variant="outline"
				>
					<ToggleGroupItem value="default">Default</ToggleGroupItem>
					<ToggleGroupItem value="simple">Simple</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<ExperimentalV2Page
				activeView={activeView}
				agentActivityLayout="split"
				agentSessionAssigneeIdAliases={JIRA_GOLDEN_JOURNEY_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID}
				agents={JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS}
				ariaLabel="Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."
				boardColumns={boardColumns}
				columnChrome={columnChrome}
				headerAssignees={JIRA_GOLDEN_JOURNEY_V4_PAY_HEADER_ASSIGNEES}
				insightsEnabled={false}
				onBoardColumnsChange={(columns) => setBoardColumns([...columns])}
				onViewChange={setActiveView}
				renderListContent={(columns) => {
					const listRows = createListRows(columns, JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS);
					return (
						<div className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
							<JiraList
								agentCatalog={JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS}
								ariaLabel="Payments SDK v2 migration work items list"
								className="max-h-full"
								onAssignedAgentIdsChange={(issueKey, agentIds) => {
									setBoardColumns((columns) => applyAssignedAgentIdsToColumns(
										columns,
										issueKey,
										agentIds,
										JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS,
									));
								}}
								rows={listRows}
								totalCountLabel={`${listRows.length}`}
								visibleCount={listRows.length}
							/>
						</div>
					);
				}}
				showAgentSessionColumn
			/>
		</div>
	);
}

export function JiraKanbanDemoExperimentalV2() {
	return <JiraKanbanDemoExperimentalV2Body columnChrome="default" />;
}

export function JiraKanbanDemoExperimentalV2Simple() {
	return <JiraKanbanDemoExperimentalV2Body columnChrome="simple" />;
}

export function JiraKanbanDemoEmptyColumns() {
	return <JiraKanbanDemoProjectButter emptyColumns />;
}
