"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useInstantTransition } from "motion/react";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { DEFAULT_SKILLS, ROVO_DIRECTORY_AGENT_PROFILES } from "@/app/data/directory";
import { useDesignVariants } from "@/components/hooks/use-design-variants";
import { MountOnFirstUse } from "@/components/projects/shared/components/mount-on-first-use";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
} from "@/components/blocks/jira-issue";
import { toJiraIssueDemoAttachedActivity } from "@/components/blocks/jira-issue/agent-session-demo-attach";
import type { JiraIssueAgentSessionRef } from "@/components/blocks/jira-issue/agent-session-transfer";
import type { JiraKanbanCardData } from "@/components/blocks/jira-kanban";
import ExperimentalJiraKanbanPage from "@/components/blocks/jira-kanban/experimental/page";
import { countNeedsInputAgents } from "@/components/blocks/jira-kanban/experimental/lib/board-agent-filter";
import {
	isPulseAgentSession,
	type PulseLooseWork,
} from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { linkJiraKanbanAgentSession, moveJiraKanbanAgentSession, unlinkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import {
	useJiraListRowFlashSource,
	type JiraListAssignedAgent,
	type JiraListInsertion,
} from "@/components/blocks/jira-list";

import { HeaderLanyards } from "./components/header-lanyards";
import { statusVariant } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";
import { renderEu26HeaderAssignee } from "@/components/projects/shared/components/eu26-header-assignee";

import { JgpRovoOverlay } from "@/components/projects/jira-golden-journeys-v1/components/jira-golden-journeys-v1-rovo-overlay";
import { BUTTER_CHAT_AGENT_PROFILES } from "@/components/projects/butter/data/chat-agent-profiles";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journeys-v1/hooks/use-jira-golden-journeys-v1-agent-chat-demo";
import { JiraViewTabs } from "@/components/projects/jira/components/jira-header";
import {
	DEFAULT_JIRA_WORK_ITEM_VIEW,
	getJiraTabs,
	type JiraWorkItemView,
} from "@/components/projects/jira/data/tabs";
import {
	getJiraWorkItemsTabLabel,
	resolveJiraTab,
} from "@/components/projects/jira/lib/jira-tab-model";
import AppLayout from "@/components/projects/page";
import { cn } from "@/lib/utils";
import { ButterList } from "./components/butter-list";

import { renderButterAgentActivityIndicator } from "./data/agent-activity-indicators";
import { BUTTER_BOARD_AGENTS } from "@/components/projects/butter/data/presentation-board";
import {
	toButterDetachedAgentSession,
	BUTTER_PAY_BOARD_AGENTS,
	BUTTER_PAY_HEADER_ASSIGNEES,
	BUTTER_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
	BUTTER_PAY_SESSION_MEMBERS,
} from "./data/presentation-story";
import { useButterAgentSessionSync } from "./hooks/use-butter-agent-session-sync";
import { BUTTER_SEEDED_AGENT_SESSION_OVERRIDES } from "./data/agent-session-sync";
import { useButterGenerativeActions } from "./hooks/use-butter-generative-actions";
import { useButterList } from "./hooks/use-butter-list";
import { useButterAssignmentMove } from "@/components/projects/butter/hooks/use-butter-assignment-move";
import { useButterContent } from "./hooks/use-butter-content";
import { BUTTER_WORK_ITEM_PLACEHOLDERS } from "@/components/projects/butter/data/work-item-placeholders";
import { useButterWorkItem } from "@/components/projects/butter/hooks/use-butter-work-item";
import {
	WAC_BOARD_TITLE,
	WAC_HEADER_ASSIGNEES,
	WAC_SEEDED_AGENT_SESSION_OVERRIDES,
	WAC_AGENT_SESSION_SYNC_SOURCE,
	WAC_CURRENT_USER,
	WAC_SESSION_MEMBERS,
} from "./data/wac-content";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));
const SkillsDirectoryDialog = dynamic(() => import("@/components/blocks/skills-directory").then((module) => module.SkillsDirectoryDialog));
const ProjectButterJiraWorkItem = dynamic(() => import("@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item").then((module) => module.ProjectButterJiraWorkItem));

const BUTTER_TABS = getJiraTabs(false);
const BUTTER_DEFAULT_TAB_LABEL = getJiraWorkItemsTabLabel(BUTTER_TABS);
const BUTTER_ADD_AGENT_LABEL = "Add agent";
const BUTTER_PINNED_CODING_AGENT_IDS = BUTTER_PAY_BOARD_AGENTS.map((agent) => agent.id);
const BUTTER_SETTINGS_DESIGN_VARIANT_IDS = [
	"kanbanBackground",
	"advancedTimeline",
	"agentSessionColumnResizing",
	"manualLink",
	"autoArrange",
	"sessionStroke",
	"sessionBloom",
	"sessionProximity",
	"sessionPeel",
	"moveVisual",
] as const;
const isButterLooseWorkResumable = () => true;

export default function ButterPage(): React.ReactElement {
	return (
		<RovoChatProvider agentProfiles={BUTTER_CHAT_AGENT_PROFILES}>
			<ButterApp />
		</RovoChatProvider>
	);
}

function ButterApp(): React.ReactElement {
	const router = useRouter();
	const { designVariants } = useDesignVariants();
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useJgpAgentChatDemo();
	const [agentsDirectoryOpen, setAgentsDirectoryOpen] = useState(false);
	const [skillsDirectoryOpen, setSkillsDirectoryOpen] = useState(false);
	const workItem = useButterWorkItem();
	const {
		boardColumns,
		contentMode,
		detachedActivitiesByIdRef,
		detachedAgentSessionsByCard,
		setBoardColumns,
		setDetachedAgentSessionsByCard,
		toggleWacContent,
		wacContent,
	} = useButterContent();
	// Same selector the Needs input focus uses, so the count names the rows it shows.
	const needsInputCount = countNeedsInputAgents(boardColumns);
	const { issueMoveRequest, onBoardAssignedAgentIdsChange, onBoardColumnsChange, startAgentSession } = useButterAssignmentMove({
		agents: BUTTER_BOARD_AGENTS,
		boardColumns,
		setBoardColumns,
	});
	const {
		composerPrefillRequest,
		handleCardGenerativeActionSubmit,
		handleComposerPrefillConsumed,
	} =
		useButterGenerativeActions({
			openAgentChat,
			setBoardColumns,
			onStartAgentSession: startAgentSession,
		});
	const cardGenerativeActionFooterActions = {
		onBrowseAgents: () => setAgentsDirectoryOpen(true),
		onBrowseSkills: () => setSkillsDirectoryOpen(true),
		onCreateAgent: () => router.push("/studio"),
		onCreateSkill: () => router.push("/skills"),
	};
	// Team EU 26 keeps its page structure fixed: Board and List remain sibling
	// tabs, untracked work remains an in-flow column, and standard kanban chrome
	// stays on. Only the timeline interaction model is user-configurable.
	const tabs = BUTTER_TABS;
	const createWorkItemDropZoneLabel = "Drop to create work item";
	const [workItemView, setWorkItemView] = useState<JiraWorkItemView>(DEFAULT_JIRA_WORK_ITEM_VIEW);
	const [selectedTabLabel, setSelectedTabLabel] = useState(BUTTER_DEFAULT_TAB_LABEL);
	const startInstantTransition = useInstantTransition();
	const activeTab = resolveJiraTab(tabs, selectedTabLabel, workItemView);
	const tabOwnsView = activeTab?.view !== undefined;
	const activeView = activeTab?.view ?? workItemView;
	const showBoardContent = activeTab?.hasContent === true;
	const [agentSessionColumnInteracting, setAgentSessionColumnInteracting] = useState(false);
	const defaultSessionSync = useButterAgentSessionSync({
		active: showBoardContent && !wacContent,
		paused: agentSessionColumnInteracting,
	});
	const wacSessionSync = useButterAgentSessionSync({
		active: showBoardContent && wacContent,
		paused: agentSessionColumnInteracting,
		source: WAC_AGENT_SESSION_SYNC_SOURCE,
	});
	const { settled: agentSessionsSettled, reviewAgentSessions, newAgentSessionIds, stateChangeVersions, syncedAgentSessions } = wacContent ? wacSessionSync : defaultSessionSync;
	const handleTabChange = useCallback((tabLabel: string) => {
		const tabView = tabs.find((tab) => tab.label === tabLabel)?.view;
		if (!tabView) {
			setSelectedTabLabel(tabLabel);
			return;
		}

		// Board and List keep their DOM through React Activity. Block Motion's
		// cross-view projection so a hidden chin cannot become the next FLIP origin.
		startInstantTransition(() => {
			setSelectedTabLabel(tabLabel);
			setWorkItemView(tabView);
		});
	}, [startInstantTransition, tabs]);
	const [resumeAnnouncement, setResumeAnnouncement] = useState("");
	// Team EU presents every unlinked session as locally resumable, even when the
	// fixture names a teammate's machine. The card owns the clipboard copy and
	// its own "Copied" label, so the announcement here is the only thing a screen
	// reader hears.
	const handleResumeLooseWork = useCallback((item: PulseLooseWork) => {
		if (!isPulseAgentSession(item)) return;
		setResumeAnnouncement(
			`Resume command copied for ${item.title}. Paste it in a terminal on ${item.machineName} to continue the session.`,
		);
	}, []);
	const handleViewChat = useCallback((activity: JiraIssueAgentActivity, card: JiraKanbanCardData) => {
		if (activity.host === "local") return;
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
		if (agent.host === "local") return;
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
		onVisibleRowsChange,
	} = useButterList({
		agents: BUTTER_BOARD_AGENTS,
		boardColumns,
		contentMode,
		listAriaLabel: wacContent ? "Checkout roadmap work items list" : undefined,
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
		const detachedSession = toButterDetachedAgentSession(activity, card);
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
	}, [detachedActivitiesByIdRef, setBoardColumns, setDetachedAgentSessionsByCard]);
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
	}, [detachedActivitiesByIdRef, setDetachedAgentSessionsByCard]);
	const handleAgentSessionLink = useCallback((session: AgentSessionItem, card: JiraKanbanCardData) => {
		const activity = consumeDetachedAgentSession(session);
		setBoardColumns((columns) => linkJiraKanbanAgentSession(columns, card.code, activity));
		flashListRow(card.code);
	}, [consumeDetachedAgentSession, flashListRow, setBoardColumns]);
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
	}, [setBoardColumns]);

	return (
		<>
			<HeaderLanyards>
			<AppLayout
				chatContextBar={chatContextBar}
				chatPanelFlush
				sidebarChatMount="on-first-open"
				defaultSidebarOpen={false}
				hideFloatingRovo
				product="jira"
				currentUser={wacContent ? WAC_CURRENT_USER : undefined}
				settingsDesignVariantIds={BUTTER_SETTINGS_DESIGN_VARIANT_IDS}
				settingsMenuItems={[{
					checked: wacContent,
					id: "butter-wac-content",
					label: "WAC Content",
					onSelect: () => startInstantTransition(toggleWacContent),
				}]}
			>
				<div
					className={cn(
						"h-full min-h-0 min-w-0 overflow-hidden [&>div]:min-h-0",
						designVariants.kanbanBackground ? "bg-bg-accent-gray-subtlest" : "bg-surface",
					)}
					data-butter-board-surface=""
					data-butter-content={wacContent ? "wac" : "default"}
					data-agent-session-sync={agentSessionsSettled ? "settled" : "pending"}
				>
					<ExperimentalJiraKanbanPage
						addAgentLabel={BUTTER_ADD_AGENT_LABEL}
						activeView={activeView}
						retainWorkItemViews
						additionalAgentSessions={syncedAgentSessions}
						agentSessionSeedOverrides={wacContent ? WAC_SEEDED_AGENT_SESSION_OVERRIDES : BUTTER_SEEDED_AGENT_SESSION_OVERRIDES}
						agentActivityLayout="merged"
						agentSessionMembers={wacContent ? WAC_SESSION_MEMBERS : BUTTER_PAY_SESSION_MEMBERS}
						agentSessionMultiSelect={false}
						cardGenerativeActionFooterActions={cardGenerativeActionFooterActions}
						cardGenerativeActionPinnedAgentIds={BUTTER_PINNED_CODING_AGENT_IDS}
						cardGenerativeActionPresentation="more-actions"
						iconScale="comfortable"
						cardAppearance="project-butter"
						issueSelectionAppearance="fused-backdrop"
						getStatusVariant={statusVariant}
						autoArrangeEnabled={designVariants.autoArrange}
						issueDragTransitions
						issueDropMotion="solitaire"
						issueMoveRequest={issueMoveRequest}
						issueMoveVisual={designVariants.moveVisual}
						createWellBounce="off"
						createWorkItemDropZoneLabel={createWorkItemDropZoneLabel}
						agentSessionAssigneeIdAliases={BUTTER_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID}
						agentSessionLinkingVariant="glow"
						agentSessionPreviewEffect={designVariants.sessionPeel ? "peel" : undefined}
						suggestSessionBoardLinkOnHover={false}
						agentSessionPresentation="column"
						advancedAgentSessionTimeline={designVariants.advancedTimeline}
						agentSessionColumnResizable={designVariants.agentSessionColumnResizing}
						agentSessionColumnGlow={{
							glowBloom: designVariants.sessionBloom,
							glowReach: designVariants.sessionProximity,
							glowStroke: designVariants.sessionStroke,
						}}
						columnChrome="default"
						columnSizing="content"
						agents={BUTTER_BOARD_AGENTS}
						ariaLabel={wacContent ? "Track the Checkout roadmap. Scroll horizontally to review all delivery statuses." : "Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."}
						boardTitle={wacContent ? WAC_BOARD_TITLE : undefined}
						boardColumns={boardColumns}
						boardFilterScopeKey={contentMode}
						defaultAgentSessionColumnCollapsed={wacContent}
						defaultShowUntracked={false}
						detachedAgentSessionsByCard={detachedAgentSessionsByCard}
						headerAssignees={wacContent ? WAC_HEADER_ASSIGNEES : BUTTER_PAY_HEADER_ASSIGNEES}
						headerAvatarLimit={wacContent ? WAC_HEADER_ASSIGNEES.length + 1 : undefined}
						renderHeaderAssignee={renderEu26HeaderAssignee}
						insightsEnabled={false}
						isLooseWorkResumable={isButterLooseWorkResumable}
						newAgentSessionIds={newAgentSessionIds}
						stateChangeVersions={stateChangeVersions}
						onAgentSessionColumnInteractionChange={setAgentSessionColumnInteracting}
						onAgentSessionsReviewed={reviewAgentSessions}
						onBoardAgentSessionCreate={handleBoardAgentSessionCreate}
						onBoardColumnsChange={onBoardColumnsChange}
						onCardClick={workItem.openWorkItem}
						onCardAgentActivityViewChat={handleViewChat}
						onCardAssignedAgentIdsChange={onBoardAssignedAgentIdsChange}
						onCardAgentDoneRunView={handleViewCompletedRun}
						onCardGenerativeActionSubmit={handleCardGenerativeActionSubmit}
						onCardAgentSessionLink={handleAgentSessionLink}
						onCardAgentSessionMove={handleAgentSessionMove}
						onCardAgentSessionUnlink={handleAgentSessionUnlink}
						onListAgentSessionCreate={handleListAgentSessionCreate}
						showAgentSessionUnlinkWell={false}
						subtaskChrome="stroke"
						onResumeLooseWork={handleResumeLooseWork}
						onViewChange={tabOwnsView ? undefined : setWorkItemView}
						renderListContent={(columns, layout) => (
							<ButterList
								addAgentLabel={BUTTER_ADD_AGENT_LABEL}
								columns={columns}
								getProps={getListProps}
								onVisibleRowsChange={onVisibleRowsChange}
								rowFlash={listRowFlash}
								{...layout}
							/>
						)}
						renderAgentActivityIndicator={renderButterAgentActivityIndicator}
						showAgentSessionColumn
						showAgentSessionFlyoutFooter={false}
						showAgentSessionFilter={false}
						showAgentSessionLinkAction={false}
						showAgentSessionLinkWorkItemMenuItem={designVariants.manualLink}
						showAgentSessionOverflow={false}
						showBoardContent={showBoardContent}
						moreControlsPlacement="end"
						showMoreControls
						showCustomizeControl
						simpleViews={false}
						needsInputCount={needsInputCount}
						viewTabs={(
							<JiraViewTabs
								selectedTabLabel={selectedTabLabel}
								onTabChange={handleTabChange}
								tabs={tabs}
								workItemView={workItemView}
							/>
						)}
					/>
				</div>
			</AppLayout>
			</HeaderLanyards>
			{workItem.selection ? <ProjectButterJiraWorkItem
				initialPresentation="modal"
				shell="project"
				initialPreset="filled"
				initialSessions={workItem.selection.initialSessions}
				onClose={workItem.closeWorkItem}
				open={workItem.open}
				placeholders={BUTTER_WORK_ITEM_PLACEHOLDERS}
				workItem={workItem.selection.workItem}
			/> : null}
			{/* Resume swaps the button label to "Copied" — colour and text alone,
			    which a screen reader on the row never hears. Announce it instead. */}
			<span aria-live="polite" className="sr-only" role="status">
				{resumeAnnouncement}
			</span>
			<MountOnFirstUse active={agentsDirectoryOpen}>
				<AgentsDirectoryDialog
					agents={ROVO_DIRECTORY_AGENT_PROFILES}
					onCreateAgent={() => router.push("/studio")}
					onOpenChange={setAgentsDirectoryOpen}
					onSelectAgent={() => setAgentsDirectoryOpen(false)}
					open={agentsDirectoryOpen}
				/>
			</MountOnFirstUse>
			<MountOnFirstUse active={skillsDirectoryOpen}>
				<SkillsDirectoryDialog
					onCreateSkill={() => router.push("/skills")}
					onOpenChange={setSkillsDirectoryOpen}
					open={skillsDirectoryOpen}
					skills={DEFAULT_SKILLS}
				/>
			</MountOnFirstUse>
			<JgpRovoOverlay
				chat={workItem.open ? "hidden" : "auto"}
				launcher={workItem.open ? "hidden" : "auto"}
				chatContextBar={chatContextBar}
				composerPrefillRequest={composerPrefillRequest}
				externalThinkingMessageId={externalThinkingMessageId}
				onComposerPrefillConsumed={handleComposerPrefillConsumed}
			/>
		</>
	);
}
