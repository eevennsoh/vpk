"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
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
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import ExperimentalJiraKanbanPage from "@/components/blocks/jira-kanban/experimental/page";
import {
	isPulseAgentSession,
	type PulseCodingAgentId,
	type PulseLooseWork,
} from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { linkJiraKanbanAgentSession, moveJiraKanbanAgentSession, unlinkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import {
	useJiraListRowFlashSource,
	type JiraListAssignedAgent,
	type JiraListInsertion,
} from "@/components/blocks/jira-list";

import { JgpRovoOverlay } from "@/components/projects/jira-golden-journeys-v1/components/jira-golden-journeys-v1-rovo-overlay";
import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journeys-v1/data/agent-chat-data";
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
import { JiraTeamEu26List } from "./components/jira-team-eu26-list";

import { renderJiraTeamEu26AgentActivityIndicator } from "./data/agent-activity-indicators";
import {
	createJiraTeamEu26PayBoardColumns,
	toJiraTeamEu26DetachedAgentSession,
	JIRA_TEAM_EU26_PAY_BOARD_AGENTS,
	JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES,
	JIRA_TEAM_EU26_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
	JIRA_TEAM_EU26_PAY_SESSION_MEMBERS,
} from "./data/presentation-story";
import { useJiraTeamEu26AgentSessionSync } from "./hooks/use-jira-team-eu26-agent-session-sync";
import { JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES } from "./data/agent-session-sync";
import { useJiraTeamEu26GenerativeActions } from "./hooks/use-jira-team-eu26-generative-actions";
import { useJiraTeamEu26List } from "./hooks/use-jira-team-eu26-list";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));
const SkillsDirectoryDialog = dynamic(() => import("@/components/blocks/skills-directory").then((module) => module.SkillsDirectoryDialog));

const JIRA_TEAM_EU26_TABS = getJiraTabs(false);
const JIRA_TEAM_EU26_DEFAULT_TAB_LABEL = getJiraWorkItemsTabLabel(JIRA_TEAM_EU26_TABS);
const JIRA_TEAM_EU26_ADD_AGENT_LABEL = "Add agent";
const JIRA_TEAM_EU26_SETTINGS_DESIGN_VARIANT_IDS = [
	"kanbanBackground",
	"advancedTimeline",
	"agentSessionColumnResizing",
	"manualLink",
	"sessionStroke",
	"sessionBloom",
	"sessionProximity",
	"sessionPeel",
] as const;
const isJiraTeamEu26LooseWorkResumable = () => true;

function resolveJiraTeamEu26ContinueChatAgent(
	agentId: PulseCodingAgentId,
): Readonly<{ agentId: string; agentName: string }> {
	switch (agentId) {
		case "claude":
			return { agentId: "claude-code", agentName: "Claude" };
		case "codex":
			return { agentId: "review-agent", agentName: "Codex" };
		case "copilot":
			return { agentId: "github-copilot", agentName: "GitHub Copilot" };
		case "cursor":
			return { agentId: "cursor", agentName: "Cursor" };
		default: {
			const exhaustive: never = agentId;
			return exhaustive;
		}
	}
}

export default function JiraTeamEu26Page(): React.ReactElement {
	return (
		<RovoChatProvider agentProfiles={JGP_CHAT_AGENT_PROFILES}>
			<JiraTeamEu26App />
		</RovoChatProvider>
	);
}

function JiraTeamEu26App(): React.ReactElement {
	const router = useRouter();
	const { designVariants } = useDesignVariants();
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useJgpAgentChatDemo();
	const [agentsDirectoryOpen, setAgentsDirectoryOpen] = useState(false);
	const [skillsDirectoryOpen, setSkillsDirectoryOpen] = useState(false);
	const [boardColumns, setBoardColumns] = useState(createJiraTeamEu26PayBoardColumns);
	const needsInputCount = boardColumns.reduce(
		(total, column) => total + column.cards.reduce(
			(cardTotal, card) => cardTotal + (card.agentActivities?.filter(
				(activity) => activity.state === "awaiting-input",
			).length ?? 0),
			0,
		),
		0,
	);
	const {
		composerPrefillRequest,
		handleCardGenerativeActionSubmit,
		handleComposerPrefillConsumed,
	} =
		useJiraTeamEu26GenerativeActions({
			openAgentChat,
			setBoardColumns,
		});
	const cardGenerativeActionFooterActions = {
		onBrowseAgents: () => setAgentsDirectoryOpen(true),
		onBrowseSkills: () => setSkillsDirectoryOpen(true),
		onCreateAgent: () => router.push("/studio"),
		onCreateSkill: () => router.push("/skills"),
	};
	const [detachedAgentSessionsByCard, setDetachedAgentSessionsByCard] = useState<
		Readonly<Record<string, readonly AgentSessionItem[]>>
	>({});
	const detachedActivitiesByIdRef = useRef<Record<string, JiraIssueAgentActivity>>({});
	// Team EU 26 keeps its page structure fixed: Board and List remain sibling
	// tabs, untracked work remains an in-flow column, and standard kanban chrome
	// stays on. Only the timeline interaction model is user-configurable.
	const tabs = JIRA_TEAM_EU26_TABS;
	const createWorkItemDropZoneLabel = "Drop to create work item";
	const [workItemView, setWorkItemView] = useState<JiraWorkItemView>(DEFAULT_JIRA_WORK_ITEM_VIEW);
	const [selectedTabLabel, setSelectedTabLabel] = useState(JIRA_TEAM_EU26_DEFAULT_TAB_LABEL);
	const startInstantTransition = useInstantTransition();
	const activeTab = resolveJiraTab(tabs, selectedTabLabel, workItemView);
	const tabOwnsView = activeTab?.view !== undefined;
	const activeView = activeTab?.view ?? workItemView;
	const showBoardContent = activeTab?.hasContent === true;
	const [agentSessionColumnInteracting, setAgentSessionColumnInteracting] = useState(false);
	const {
		reviewAgentSessions,
		newAgentSessionIds,
		stateChangeVersions,
		syncedAgentSessions,
	} = useJiraTeamEu26AgentSessionSync({
		active: showBoardContent,
		paused: agentSessionColumnInteracting,
	});
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
	const handleContinueLooseWork = useCallback((item: PulseLooseWork) => {
		if (!isPulseAgentSession(item)) return;
		const agent = resolveJiraTeamEu26ContinueChatAgent(item.agentId);
		openAgentChat({
			agentId: agent.agentId,
			agentName: agent.agentName,
			issueKey: item.sourceTitle,
			issueSummary: item.title,
			intro: item.title,
			request: `Continue the local ${agent.agentName} session on ${item.sourceTitle}.`,
		});
	}, [openAgentChat]);
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
		onVisibleRowsChange,
	} = useJiraTeamEu26List({
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
		const detachedSession = toJiraTeamEu26DetachedAgentSession(activity, card);
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
				sidebarChatMount="on-first-open"
				defaultSidebarOpen={false}
				hideFloatingRovo
				product="jira"
				settingsDesignVariantIds={JIRA_TEAM_EU26_SETTINGS_DESIGN_VARIANT_IDS}
			>
				<div
					className={cn(
						"h-full min-h-0 min-w-0 overflow-hidden [&>div]:min-h-0",
						designVariants.kanbanBackground ? "bg-bg-accent-gray-subtlest" : "bg-surface",
					)}
					data-jira-team-eu26-board-surface=""
				>
					<ExperimentalJiraKanbanPage
						addAgentLabel={JIRA_TEAM_EU26_ADD_AGENT_LABEL}
						activeView={activeView}
						retainWorkItemViews
						additionalAgentSessions={syncedAgentSessions}
						agentSessionSeedOverrides={JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES}
						agentActivityLayout="merged"
						agentSessionMembers={JIRA_TEAM_EU26_PAY_SESSION_MEMBERS}
						agentSessionMultiSelect={false}
						cardGenerativeActionFooterActions={cardGenerativeActionFooterActions}
						cardGenerativeActionPresentation="more-actions"
						iconScale="comfortable"
						issueDragTransitions
						createWellBounce="off"
						createWorkItemDropZoneLabel={createWorkItemDropZoneLabel}
						agentSessionAssigneeIdAliases={JIRA_TEAM_EU26_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID}
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
						agents={JIRA_TEAM_EU26_PAY_BOARD_AGENTS}
						ariaLabel="Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."
						boardColumns={boardColumns}
						defaultAgentSessionColumnCollapsed={false}
						defaultShowUntracked={false}
						detachedAgentSessionsByCard={detachedAgentSessionsByCard}
						headerAssignees={JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES}
						insightsEnabled={false}
						isLooseWorkResumable={isJiraTeamEu26LooseWorkResumable}
						newAgentSessionIds={newAgentSessionIds}
						stateChangeVersions={stateChangeVersions}
						onAgentSessionColumnInteractionChange={setAgentSessionColumnInteracting}
						onAgentSessionsReviewed={reviewAgentSessions}
						onBoardAgentSessionCreate={handleBoardAgentSessionCreate}
						onBoardColumnsChange={(columns: readonly JiraKanbanColumnData[]) => {
							setBoardColumns([...columns]);
						}}
						onCardAgentActivityViewChat={handleViewChat}
						onCardAssignedAgentIdsChange={onAssignedAgentIdsChange}
						onCardAgentDoneRunView={handleViewCompletedRun}
						onCardGenerativeActionSubmit={handleCardGenerativeActionSubmit}
						onCardAgentSessionLink={handleAgentSessionLink}
						onCardAgentSessionMove={handleAgentSessionMove}
						onCardAgentSessionUnlink={handleAgentSessionUnlink}
						onListAgentSessionCreate={handleListAgentSessionCreate}
						showAgentSessionUnlinkWell={false}
						subtaskChrome="stroke"
						onContinueLooseWork={handleContinueLooseWork}
						onResumeLooseWork={handleResumeLooseWork}
						onViewChange={tabOwnsView ? undefined : setWorkItemView}
						renderListContent={(columns, layout) => (
							<JiraTeamEu26List
								addAgentLabel={JIRA_TEAM_EU26_ADD_AGENT_LABEL}
								columns={columns}
								getProps={getListProps}
								onVisibleRowsChange={onVisibleRowsChange}
								rowFlash={listRowFlash}
								{...layout}
							/>
						)}
						renderAgentActivityIndicator={renderJiraTeamEu26AgentActivityIndicator}
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
				chatContextBar={chatContextBar}
				composerPrefillRequest={composerPrefillRequest}
				externalThinkingMessageId={externalThinkingMessageId}
				onComposerPrefillConsumed={handleComposerPrefillConsumed}
			/>
		</>
	);
}
