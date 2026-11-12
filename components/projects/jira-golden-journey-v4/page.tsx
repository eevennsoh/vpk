"use client";

import { useCallback, useRef, useState } from "react";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
} from "@/components/blocks/jira-issue";
import { toJiraIssueDemoAttachedActivity } from "@/components/blocks/jira-issue/agent-session-demo-attach";
import type { JiraIssueAgentSessionRef } from "@/components/blocks/jira-issue/agent-session-transfer";
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import ExperimentalJiraKanbanPage from "@/components/blocks/jira-kanban/experimental/page";
import { isPulseAgentSession, type PulseLooseWork } from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { linkJiraKanbanAgentSession, moveJiraKanbanAgentSession, unlinkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import {
	JiraList,
	useJiraListRowFlashSource,
	type JiraListAssignedAgent,
	type JiraListInsertion,
} from "@/components/blocks/jira-list";
import { useDesignVariants } from "@/components/hooks/use-design-variants";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";
import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journey-v1/data/agent-chat-data";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { JiraViewTabs } from "@/components/projects/jira/components/jira-header";
import {
	DEFAULT_JIRA_WORK_ITEM_VIEW,
	DEFAULT_JIRA_WORK_ITEMS_TAB_LABEL,
	type JiraWorkItemView,
} from "@/components/projects/jira/data/tabs";
import { useJiraTabs } from "@/components/projects/jira/hooks/use-jira-tabs";
import { resolveJiraTab } from "@/components/projects/jira/lib/jira-tab-model";
import AppLayout from "@/components/projects/page";
import { cn } from "@/lib/utils";

import { renderJiraGoldenJourneyV4AgentActivityIndicator } from "./data/agent-activity-indicators";
import {
	createJiraGoldenJourneyV4PayBoardColumns,
	toJiraGoldenJourneyV4DetachedAgentSession,
	JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS,
	JIRA_GOLDEN_JOURNEY_V4_PAY_HEADER_ASSIGNEES,
	JIRA_GOLDEN_JOURNEY_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
} from "./data/presentation-story";
import { useJiraGoldenJourneyV4AgentSessionSync } from "./hooks/use-jira-golden-journey-v4-agent-session-sync";
import { useJiraGoldenJourneyV4GenerativeActions } from "./hooks/use-jira-golden-journey-v4-generative-actions";
import { useJiraGoldenJourneyV4List } from "./hooks/use-jira-golden-journey-v4-list";

const JIRA_LIST_PANEL_END_GAP_PX = 24;

export default function JiraGoldenJourneyV4Page(): React.ReactElement {
	return (
		<RovoChatProvider agentProfiles={JGP_CHAT_AGENT_PROFILES}>
			<JiraGoldenJourneyV4App />
		</RovoChatProvider>
	);
}

function JiraGoldenJourneyV4App(): React.ReactElement {
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useJgpAgentChatDemo();
	const [boardColumns, setBoardColumns] = useState(createJiraGoldenJourneyV4PayBoardColumns);
	const {
		composerPrefillRequest,
		handleCardGenerativeActionSubmit,
		handleComposerPrefillConsumed,
	} =
		useJiraGoldenJourneyV4GenerativeActions({
			openAgentChat,
			setBoardColumns,
		});
	const [detachedAgentSessionsByCard, setDetachedAgentSessionsByCard] = useState<
		Readonly<Record<string, readonly AgentSessionItem[]>>
	>({});
	const detachedActivitiesByIdRef = useRef<Record<string, JiraIssueAgentActivity>>({});
	// Team EU without Simple views splits work items into Board and List tabs,
	// so the tab bar owns the view and the board header's own switcher stands
	// down. Simple views collapse them into one Work items tab and the switcher
	// owns it instead. Both write the same state, so the choice survives
	// flipping the property.
	const tabs = useJiraTabs();
	// The one place the global variant store meets the board. Panel is off by
	// default, so untracked work starts as the in-flow column on both Board
	// and List; on, it lifts into the floating side surface both views share.
	const { designVariants } = useDesignVariants();
	const createWorkItemDropZoneLabel = "Create new work item";
	const [workItemView, setWorkItemView] = useState<JiraWorkItemView>(DEFAULT_JIRA_WORK_ITEM_VIEW);
	const [selectedTabLabel, setSelectedTabLabel] = useState(DEFAULT_JIRA_WORK_ITEMS_TAB_LABEL);
	const activeTab = resolveJiraTab(tabs, selectedTabLabel, workItemView);
	const tabOwnsView = activeTab?.view !== undefined;
	const activeView = activeTab?.view ?? workItemView;
	const showBoardContent = activeTab?.hasContent === true;
	const {
		reviewAgentSessions,
		newAgentSessionIds,
		syncedAgentSessions,
	} = useJiraGoldenJourneyV4AgentSessionSync({ active: showBoardContent });
	const handleTabChange = useCallback((tabLabel: string) => {
		setSelectedTabLabel(tabLabel);
		const tabView = tabs.find((tab) => tab.label === tabLabel)?.view;
		if (tabView) {
			setWorkItemView(tabView);
		}
	}, [tabs]);
	const [resumeAnnouncement, setResumeAnnouncement] = useState("");
	// Untracked work offers Resume on the rows running on the viewer's own
	// device; that gate is the board's default, so this route only supplies the
	// behavior. The card owns the clipboard copy and its own "Copied" label, so
	// the announcement here is the only thing a screen reader hears.
	const handleResumeLooseWork = useCallback((item: PulseLooseWork) => {
		if (!isPulseAgentSession(item)) return;
		setResumeAnnouncement(
			`Resume command copied for ${item.title}. Paste it in a terminal on ${item.machineName} to continue the session.`,
		);
	}, []);
	const handleViewChat = useCallback((activity: JiraIssueAgentActivity, card: JiraKanbanCardData) => {
		openAgentChat({
			agentId: activity.id.includes(":")
				? activity.id.slice(activity.id.lastIndexOf(":") + 1)
				: activity.id,
			agentName: activity.name,
			issueKey: card.code,
			issueSummary: card.title,
			intro: activity.message,
			question: activity.question,
		});
	}, [openAgentChat]);
	const handleViewCompletedRun = useCallback((run: JiraIssueCompletedAgentRun) => {
		openAgentChat({
			agentId: run.agentName.toLowerCase().replace(/\s+/g, "-"),
			agentName: run.agentName,
			issueKey: run.issueKey,
			issueSummary: run.issueSummary,
			intro: run.description,
		});
	}, [openAgentChat]);
	const handleListAssignedAgentSelect = useCallback((
		issueKey: string,
		agent: JiraListAssignedAgent,
	) => {
		const card = boardColumns
			.flatMap((column) => column.cards)
			.find((candidate) => candidate.code === issueKey);
		if (!card) {
			openAgentChat({
				agentId: agent.id,
				agentName: agent.name,
				issueKey,
				issueSummary: "",
			});
			return;
		}

		const activity = card.agentActivities?.find((candidate) => (
			candidate.id === agent.id
			|| candidate.id.endsWith(`:${agent.id}`)
			|| candidate.name === agent.name
		));
		if (activity) {
			handleViewChat(activity, card);
			return;
		}

		const run = card.agentDoneRuns?.find((candidate) => (
			candidate.id === agent.id
			|| candidate.agentName === agent.name
		));
		if (run) {
			handleViewCompletedRun(run);
			return;
		}

		openAgentChat({
			agentId: agent.id,
			agentName: agent.name,
			issueKey: card.code,
			issueSummary: card.title,
		});
	}, [boardColumns, handleViewChat, handleViewCompletedRun, openAgentChat]);
	const {
		createBoardFromAgentSession,
		createFromAgentSession,
		getProps: getListProps,
		onAssignedAgentIdsChange,
	} = useJiraGoldenJourneyV4List({
		boardColumns,
		onAssignedAgentSelect: handleListAssignedAgentSelect,
		setBoardColumns,
	});
	// Sessions dropped into the list neither select the rows they land in nor
	// leave a badge behind, so the flash carries the acknowledgement. One drop of
	// three marked sessions publishes one flash covering all three rows.
	//
	// It only reaches rows the list is rendering. Board-created cards are
	// assigned to Venn (the prototype current user), so the matching assignee
	// filter keeps the new row visible long enough for this acknowledgement.
	const { flash: listRowFlash, flashRow: flashListRow } = useJiraListRowFlashSource();
	// Unlink always lands in `detachedAgentSessionsByCard`. The Untracked list
	// reads that map, so the session reappears there immediately. Proximity
	// stays off, so it never parks beside the card.
	const handleAgentSessionUnlink = useCallback((session: { id: string }, card: JiraKanbanCardData) => {
		const activity = card.agentActivities?.find((candidate) => candidate.id === session.id);
		if (!activity) return;
		const detachedSession = toJiraGoldenJourneyV4DetachedAgentSession(activity, card);
		detachedActivitiesByIdRef.current = {
			...detachedActivitiesByIdRef.current,
			[activity.id]: activity,
		};
		setDetachedAgentSessionsByCard((current) => {
			const currentSessions = current[card.code] ?? [];
			return currentSessions.some((candidate) => candidate.id === detachedSession.id)
				? current
				: { ...current, [card.code]: [...currentSessions, detachedSession] };
		});
		setBoardColumns((columns) => unlinkJiraKanbanAgentSession(columns, card.code, session.id));
	}, []);
	const consumeDetachedAgentSession = useCallback((session: AgentSessionItem) => {
		const activity = detachedActivitiesByIdRef.current[session.id]
			?? toJiraIssueDemoAttachedActivity(session);
		if (session.id in detachedActivitiesByIdRef.current) {
			const rest = { ...detachedActivitiesByIdRef.current };
			delete rest[session.id];
			detachedActivitiesByIdRef.current = rest;
		}
		setDetachedAgentSessionsByCard((current) => {
			let changed = false;
			const next: Record<string, readonly AgentSessionItem[]> = {};
			for (const [cardCode, sessions] of Object.entries(current)) {
				const nextSessions = sessions.filter((candidate) => candidate.id !== session.id);
				if (nextSessions.length !== sessions.length) {
					changed = true;
				}
				if (nextSessions.length > 0) {
					next[cardCode] = nextSessions;
				}
			}
			return changed ? next : current;
		});
		return activity;
	}, []);
	const handleAgentSessionLink = useCallback((session: AgentSessionItem, card: JiraKanbanCardData) => {
		const activity = consumeDetachedAgentSession(session);
		setBoardColumns((columns) => linkJiraKanbanAgentSession(columns, card.code, activity));
		flashListRow(card.code);
	}, [consumeDetachedAgentSession, flashListRow]);
	const handleBoardAgentSessionCreate = useCallback((
		session: AgentSessionItem,
		columnTitle: string,
		insertAtIndex?: number,
		issueType?: JiraKanbanCardData["issueType"],
	) => {
		const activity = consumeDetachedAgentSession(session);
		return createBoardFromAgentSession({
			activity,
			columnTitle,
			insertAtIndex,
			issueType,
			session,
		});
	}, [consumeDetachedAgentSession, createBoardFromAgentSession]);
	const handleListAgentSessionCreate = useCallback((
		session: AgentSessionItem,
		insertion: JiraListInsertion,
	) => {
		const activity = consumeDetachedAgentSession(session);
		flashListRow(createFromAgentSession({
			activity,
			insertion,
			session,
		}));
	}, [consumeDetachedAgentSession, createFromAgentSession, flashListRow]);
	const handleAgentSessionMove = useCallback((
		session: JiraIssueAgentSessionRef,
		sourceCard: JiraKanbanCardData,
		targetCard: JiraKanbanCardData,
	) => {
		setBoardColumns((columns) => moveJiraKanbanAgentSession(
			columns,
			sourceCard.code,
			targetCard.code,
			session.id,
		));
	}, []);

	return (
		<>
			<AppLayout
				chatContextBar={chatContextBar}
				chatPanelFlush
				defaultSidebarOpen={true}
				hideFloatingRovo
				product="jira"
			>
				<div className="h-full min-h-0 min-w-0 overflow-hidden bg-surface [&>div]:min-h-0">
					<ExperimentalJiraKanbanPage
						activeView={activeView}
						additionalAgentSessions={syncedAgentSessions}
						agentActivityLayout="merged"
						agentSessionMultiSelect={false}
						cardGenerativeActionPresentation="more-actions"
						createWorkItemDropZoneLabel={createWorkItemDropZoneLabel}
						agentSessionAssigneeIdAliases={JIRA_GOLDEN_JOURNEY_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID}
						agentSessionPresentation={designVariants.panel ? "panel" : "column"}
						columnChrome={designVariants.simpleKanban ? "simple" : "default"}
						agents={JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS}
						ariaLabel="Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."
						boardColumns={boardColumns}
						defaultAgentSessionColumnCollapsed
						defaultShowUntracked={false}
						detachedAgentSessionsByCard={detachedAgentSessionsByCard}
						headerAssignees={JIRA_GOLDEN_JOURNEY_V4_PAY_HEADER_ASSIGNEES}
						insightsEnabled={false}
						newAgentSessionIds={newAgentSessionIds}
						onAgentSessionsReviewed={reviewAgentSessions}
						onBoardAgentSessionCreate={handleBoardAgentSessionCreate}
						onBoardColumnsChange={(columns: readonly JiraKanbanColumnData[]) => {
							setBoardColumns([...columns]);
						}}
						onCardAgentActivityViewChat={handleViewChat}
						onCardAgentDoneRunView={handleViewCompletedRun}
						onCardAssignedAgentIdsChange={onAssignedAgentIdsChange}
						onCardGenerativeActionSubmit={handleCardGenerativeActionSubmit}
						onCardAgentSessionLink={handleAgentSessionLink}
						onCardAgentSessionMove={handleAgentSessionMove}
						onCardAgentSessionUnlink={handleAgentSessionUnlink}
						onListAgentSessionCreate={handleListAgentSessionCreate}
						showAgentSessionUnlinkWell={false}
						onResumeLooseWork={handleResumeLooseWork}
						onViewChange={tabOwnsView ? undefined : setWorkItemView}
						renderListContent={(
							columns,
							{
								agentSessionDropIntent,
								onTrailingContentUnderlapChange,
								scrollEndInset,
								trailingOverlayRef,
							},
						) => {
							const listProps = getListProps(columns);
							const listScrollEndInset = scrollEndInset > 0
								? scrollEndInset + JIRA_LIST_PANEL_END_GAP_PX
								: 0;
							return (
								<div
									className={cn(
										"min-h-0 flex-1 overflow-hidden pb-4 ps-6 md:pb-5",
										scrollEndInset > 0 ? "pe-0" : "pe-4 md:pe-5",
									)}
								>
									<JiraList
										{...listProps}
										agentSessionDropIntent={agentSessionDropIntent}
										onTrailingContentUnderlapChange={onTrailingContentUnderlapChange}
										rowFlash={listRowFlash}
										scrollEndInset={listScrollEndInset}
										trailingOverlayRef={trailingOverlayRef}
									/>
								</div>
							);
						}}
						renderAgentActivityIndicator={renderJiraGoldenJourneyV4AgentActivityIndicator}
						showAgentSessionColumn
						showBoardContent={showBoardContent}
						moreControlsPlacement="end"
						showMoreControls={!designVariants["simple-views"]}
						showCustomizeControl={!designVariants["simple-views"]}
						simpleViews={designVariants["simple-views"]}
						viewTabs={(
							<JiraViewTabs
								selectedTabLabel={selectedTabLabel}
								onTabChange={handleTabChange}
								workItemView={workItemView}
							/>
						)}
					/>
				</div>
			</AppLayout>
			{/* Resume swaps the button label to "Copied" — colour and text alone,
			    which a screen reader on the row never hears. Announce it instead. */}
			<span aria-live="polite" className="sr-only" role="status">
				{resumeAnnouncement}
			</span>
			<JgpRovoOverlay
				chatContextBar={chatContextBar}
				composerPrefillRequest={composerPrefillRequest}
				externalThinkingMessageId={externalThinkingMessageId}
				onComposerPrefillConsumed={handleComposerPrefillConsumed}
			/>
		</>
	);
}
