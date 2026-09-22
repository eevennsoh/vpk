"use client";

import type { DragEventHandler, MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import { type AgentAssignmentAgent } from "@/components/blocks/agent-assignment";
import { type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { AgentSession, type AgentSessionItem } from "@/components/blocks/agent-session";
import {
	JiraIssue,
	type JiraIssueAgentActivity,
	type JiraIssueAgentActivityIndicatorRenderer,
	type JiraIssueAgentActivityLayout,
	type JiraIssueAgentAssignment,
	type JiraIssueAgentSessionDragControl,
	type JiraIssueAgentLinkFlash,
	type JiraIssueChrome,
	type JiraIssueCompletedAgentRun,
	type JiraIssueGenerativeActionConfig,
	type JiraIssueGenerativeActionPresentation,
	type JiraIssueIconScale,
} from "@/components/blocks/jira-issue";
import { resolveRelatedJiraIssueAgentActivityMode } from "@/components/blocks/jira-issue/agent-activity-model";
import type { JiraIssueAgentSessionDragBinding } from "@/components/blocks/jira-issue/agent-session-drag";
import type { JiraIssueAgentSessionRef } from "@/components/blocks/jira-issue/agent-session-transfer";
import {
	getJiraIssuePresenceMotion,
	JIRA_ISSUE_MOTION_STYLE,
} from "@/components/blocks/jira-issue/lib";
import {
	DEFAULT_PINNED_SPACE_AGENT_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
} from "@/components/blocks/jira-work-item/experimental-v3/lib/work-item-picker-options";
import { token } from "@/lib/tokens";

import type {
	JiraKanbanAgentData,
	JiraKanbanCardData,
	JiraKanbanProps,
} from "../index";

function canonicalizeAssignedAgentId(issueKey: string, agentId: string): string {
	const prefix = `${issueKey}:`;
	return agentId.startsWith(prefix) ? agentId.slice(prefix.length) : agentId;
}

function toSelectorAgentFromCatalog(agent: JiraKanbanAgentData): AgentSelectorAgent {
	return {
		id: agent.id,
		name: agent.name,
		byline: agent.byline,
		...(agent.avatarSrc ? { avatarSrc: agent.avatarSrc } : {}),
		...(agent.brandName ? { brandName: agent.brandName } : {}),
	};
}

function toAssignedAgentFromActivity(
	cardCode: string,
	activity: JiraIssueAgentActivity,
): AgentAssignmentAgent {
	const statusKind = activity.state === "awaiting-input"
		? "needs-input"
		: activity.state === "completed"
			? "finished"
			: "working";
	return {
		id: canonicalizeAssignedAgentId(cardCode, activity.id),
		name: activity.name,
		byline: "",
		...(activity.avatarSrc ? { avatarSrc: activity.avatarSrc } : {}),
		...(activity.agentBrandName ? { brandName: activity.agentBrandName } : {}),
		status: activity.label,
		statusKind,
		statusLabel: activity.label,
		...(activity.invokedBy ? { invokedBy: activity.invokedBy } : {}),
		...(activity.host !== undefined ? { host: activity.host } : {}),
		...(activity.role !== undefined ? { role: activity.role } : {}),
		...(activity.timeLabel ? { timeLabel: activity.timeLabel } : {}),
	};
}

function toAssignedAgentFromDoneRun(
	cardCode: string,
	run: JiraIssueCompletedAgentRun,
): AgentAssignmentAgent {
	return {
		id: canonicalizeAssignedAgentId(cardCode, run.id),
		name: run.agentName,
		byline: "",
		...(run.agentAvatarSrc ? { avatarSrc: run.agentAvatarSrc } : {}),
		...(run.agentBrandName ? { brandName: run.agentBrandName } : {}),
		...(run.invokedBy ? { invokedBy: run.invokedBy } : {}),
		status: run.summary,
		statusKind: "finished",
		statusLabel: run.summary,
		host: run.host ?? "cloud",
		...(run.relativeTime ? { timeLabel: run.relativeTime } : {}),
	};
}

function resolveKanbanCardAssignment(
	card: JiraKanbanCardData,
	catalog: readonly JiraKanbanAgentData[] | undefined,
	onAssignedAgentIdsChange?: (issueKey: string, agentIds: readonly string[]) => void,
	addAgentLabel?: string,
): JiraIssueAgentAssignment | undefined {
	if (!onAssignedAgentIdsChange) {
		return undefined;
	}

	const assignedAgents = assignedAgentsFromKanbanCard(card);
	const seenIds = new Set(ROVO_AGENT_SELECTOR_AGENTS.map((agent) => agent.id));
	const extraAgents: AgentSelectorAgent[] = [];
	for (const assigned of assignedAgents) {
		if (seenIds.has(assigned.id)) {
			continue;
		}
		seenIds.add(assigned.id);
		extraAgents.push({
			id: assigned.id,
			name: assigned.name,
			byline: assigned.byline,
			...(assigned.avatarSrc ? { avatarSrc: assigned.avatarSrc } : {}),
			...(assigned.brandName ? { brandName: assigned.brandName } : {}),
		});
	}
	for (const agent of catalog ?? []) {
		if (seenIds.has(agent.id)) {
			continue;
		}
		seenIds.add(agent.id);
		extraAgents.push(toSelectorAgentFromCatalog(agent));
	}
	const assignmentAgents = extraAgents.length > 0
		? [...ROVO_AGENT_SELECTOR_AGENTS, ...extraAgents]
		: ROVO_AGENT_SELECTOR_AGENTS;
	const pinnedAgentIds = DEFAULT_PINNED_SPACE_AGENT_IDS.filter((agentId) => (
		assignmentAgents.some((agent) => agent.id === agentId)
	));

	return {
		addAgentLabel,
		...(assignmentAgents.length > 0 ? { agents: assignmentAgents } : {}),
		assignedAgents,
		defaultPinnedAgentIds: pinnedAgentIds,
		onAssignedAgentIdsChange: (agentIds) => onAssignedAgentIdsChange(
			card.code,
			agentIds.map((agentId) => canonicalizeAssignedAgentId(card.code, agentId)),
		),
		pinnedItemsLabel: WORK_ITEM_PINNED_ITEMS_LABEL,
	};
}

function assignedAgentsFromKanbanCard(card: JiraKanbanCardData): AgentAssignmentAgent[] {
	const assigned: AgentAssignmentAgent[] = [];
	const seenIds = new Set<string>();
	for (const activity of card.agentActivities ?? []) {
		const agent = toAssignedAgentFromActivity(card.code, activity);
		if (seenIds.has(agent.id)) {
			continue;
		}
		seenIds.add(agent.id);
		assigned.push(agent);
	}
	for (const run of card.agentDoneRuns ?? []) {
		const agent = toAssignedAgentFromDoneRun(card.code, run);
		if (seenIds.has(agent.id)) {
			continue;
		}
		seenIds.add(agent.id);
		assigned.push(agent);
	}
	return assigned;
}

interface ExperimentalJiraKanbanCardProps {
	active: boolean;
	addAgentLabel?: string;
	agentActivityLayout: JiraIssueAgentActivityLayout;
	/** One-shot brand sweep across the chin rows a drop just added. */
	agentLinkFlash?: JiraIssueAgentLinkFlash;
	agentSessionDragControl?: JiraIssueAgentSessionDragControl;
	agentSessionTargetHighlighted: boolean;
	card: JiraKanbanCardData;
	chrome: JiraIssueChrome;
	columnTitle: string;
	capturedItemIds?: ReadonlySet<string>;
	detachedAgentSessions: readonly AgentSessionItem[];
	detachedSessionDrag?: JiraIssueAgentSessionDragBinding;
	dragging: boolean;
	generativeActionAgents: JiraIssueGenerativeActionConfig["agents"];
	generativeActionPresentation: JiraIssueGenerativeActionPresentation;
	generativeActionSkills: JiraIssueGenerativeActionConfig["skills"];
	generativeActionFooterActions?: Pick<
		JiraIssueGenerativeActionConfig,
		"onBrowseAgents" | "onBrowseSkills" | "onCreateAgent" | "onCreateSkill"
	>;
	iconScale?: JiraIssueIconScale;
	/** Session hovered in the Untracked work column; lights its row here. */
	highlightedSessionId?: string | null;
	onAgentActivityOpenChange?: JiraKanbanProps["onCardAgentActivityOpenChange"];
	onAgentActivityViewChat?: JiraKanbanProps["onCardAgentActivityViewChat"];
	agents?: readonly JiraKanbanAgentData[];
	onAssignedAgentIdsChange?: (issueKey: string, agentIds: readonly string[]) => void;
	onAgentDoneRunReview?: JiraKanbanProps["onCardAgentDoneRunReview"];
	onAgentDoneRunView?: JiraKanbanProps["onCardAgentDoneRunView"];
	onClick: (event: MouseEvent<HTMLButtonElement>) => void;
	onDragEnd: DragEventHandler<HTMLButtonElement>;
	onCreateWorkItem?: (item: AgentSessionItem) => void;
	onItemHover?: (item: AgentSessionItem | null) => void;
	onDragStart: DragEventHandler<HTMLButtonElement>;
	onGenerativeActionSubmit?: JiraKanbanProps["onCardGenerativeActionSubmit"];
	onLinkWorkItem?: (item: AgentSessionItem, workItemKey?: string) => void;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	onSessionLink?: (
		session: AgentSessionItem,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	onSessionUnlink?: (
		session: JiraIssueAgentSessionRef,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	/** When false, chin rows stay draggable but the dashed unlink well is omitted. */
	showUnlinkWell?: boolean;
	showUntrackedWorkFooter?: boolean;
	onSubtasks?: (item: AgentSessionItem) => void;
	selected: boolean;
	subtaskChrome?: JiraIssueChrome;
}

function getCardAssigneeAvatarSrc(card: JiraKanbanCardData) {
	return card.avatarSrc ?? card.assignee?.avatarSrc;
}

function getCardAssigneeAvatarShape(card: JiraKanbanCardData) {
	if (card.avatarShape) {
		return card.avatarShape;
	}
	return getCardAssigneeAvatarSrc(card)?.startsWith("/avatar-agent/") ? "hexagon" as const : undefined;
}

export function ExperimentalJiraKanbanCard({
	active,
	addAgentLabel,
	agents,
	agentActivityLayout,
	agentLinkFlash,
	agentSessionDragControl,
	agentSessionTargetHighlighted,
	capturedItemIds,
	card,
	chrome,
	columnTitle,
	detachedAgentSessions,
	detachedSessionDrag,
	dragging,
	generativeActionAgents,
	generativeActionPresentation,
	generativeActionSkills,
	generativeActionFooterActions,
	highlightedSessionId,
	iconScale = "compact",
	onAgentActivityOpenChange,
	onAgentActivityViewChat,
	onAssignedAgentIdsChange,
	onAgentDoneRunReview,
	onAgentDoneRunView,
	onClick,
	onCreateWorkItem,
	onDragEnd,
	onDragStart,
	onGenerativeActionSubmit,
	onLinkWorkItem,
	onItemHover,
	renderAgentActivityIndicator,
	onSessionLink,
	onSessionUnlink,
	onSubtasks,
	selected,
	showUnlinkWell = true,
	showUntrackedWorkFooter,
	subtaskChrome,
}: Readonly<ExperimentalJiraKanbanCardProps>) {
	const shouldReduceMotion = useReducedMotion();
	const proximityMotion = getJiraIssuePresenceMotion(shouldReduceMotion);
	const firstActiveAgentSession = card.agentActivities?.find(
		(activity) => activity.state !== "completed",
	);
	const canUnlinkAgentSession = Boolean(onSessionUnlink && firstActiveAgentSession);
	const canLinkAgentSession = Boolean(onSessionLink && detachedAgentSessions.length > 0);
	const isBoardDropTarget = agentSessionDragControl?.dropTarget !== null
		&& agentSessionDragControl?.dropTarget !== undefined;
	const canTransferAgentSession = canUnlinkAgentSession || canLinkAgentSession || isBoardDropTarget;
	// Related detached sessions keep the Unlink grey backdrop even after the
	// last chin row leaves. Stored mode stays `none`; presentation lights `working`.
	const agentActivityMode = resolveRelatedJiraIssueAgentActivityMode(
		card.agentActivityMode,
		detachedAgentSessions.length > 0,
	);

	function handleSessionLink(sessionId?: string) {
		const item = detachedAgentSessions.find((candidate) => candidate.id === sessionId);
		if (item) {
			onSessionLink?.(item, card, columnTitle);
		}
	}

	function handleLinkWorkItem(item: AgentSessionItem, workItemKey?: string) {
		if (onSessionLink) {
			onSessionLink(item, card, columnTitle);
			return;
		}
		onLinkWorkItem?.(item, workItemKey);
	}

	return (
		<JiraIssue
			active={active}
			agentActivities={card.agentActivities}
			agentActivityLayout={agentActivityLayout}
			assignment={resolveKanbanCardAssignment(card, agents, onAssignedAgentIdsChange, addAgentLabel)}
			agentLinkFlash={agentLinkFlash}
			agentActivityMode={agentActivityMode}
			agentSessionDragControl={agentSessionDragControl}
			agentSessionTargetPreview={{ highlighted: agentSessionTargetHighlighted }}
			agentDoneRuns={card.agentDoneRuns}
			agentSessionTransfer={canTransferAgentSession ? {
				onLink: canLinkAgentSession
					? (session) => handleSessionLink(session?.id)
					: undefined,
				onUnlink: canUnlinkAgentSession
					? (session) => {
						const resolvedSession = session ?? firstActiveAgentSession;
						if (resolvedSession) {
							onSessionUnlink?.(resolvedSession, card, columnTitle);
						}
					}
					: undefined,
				showUnlinkWell,
			} : undefined}
			assigneeAvatarLabel={card.assignee?.name}
			assigneeAvatarShape={getCardAssigneeAvatarShape(card)}
			assigneeAvatarSrc={getCardAssigneeAvatarSrc(card)}
			assigneePulse={card.avatarPulse}
			assigneeUnassignedKind={card.avatarUnassignedKind}
			chrome={chrome}
			compact
			dragging={dragging}
			iconScale={iconScale}
			parentOwnsLayout
			generativeAction={{
				agents: generativeActionAgents,
				...generativeActionFooterActions,
				onSubmit: (request) => {
					void onGenerativeActionSubmit?.(request, card, columnTitle);
				},
				skills: generativeActionSkills,
			}}
			generativeActionPresentation={generativeActionPresentation}
			issueKey={card.code}
			onAgentActivityOpenChange={onAgentActivityOpenChange
				? (open) => onAgentActivityOpenChange(open, card, columnTitle)
				: undefined}
			onAgentActivityViewChat={onAgentActivityViewChat
				? (activity) => onAgentActivityViewChat(activity, card, columnTitle)
				: undefined}
			onAgentDoneRunReview={onAgentDoneRunReview
				? (run) => onAgentDoneRunReview(run, card, columnTitle)
				: undefined}
			onAgentDoneRunView={onAgentDoneRunView
				? (run) => onAgentDoneRunView(run, card, columnTitle)
				: undefined}
			onClick={onClick}
			onDragEnd={onDragEnd}
			onDragStart={onDragStart}
			priority={card.priority}
			pullRequestNumber={card.pullRequestNumber}
			pullRequestPreview={card.pullRequestPreview}
			pullRequestStatus={card.pullRequestStatus}
			selected={selected}
			renderAgentActivityIndicator={renderAgentActivityIndicator}
			sessionTransferAfter={detachedAgentSessions.length > 0
				? (localSessionDrag) => (
					<AnimatePresence>
						<motion.div
							animate={proximityMotion.animate}
							className="has-[[data-session-dragging]]:relative has-[[data-session-dragging]]:z-30"
							exit={proximityMotion.exit}
							initial={proximityMotion.initial}
							key="proximity-sessions"
							style={JIRA_ISSUE_MOTION_STYLE}
						>
							<AgentSession
								capturedItemIds={capturedItemIds}
								highlightedItemId={highlightedSessionId}
								issueKey={card.code}
								items={detachedAgentSessions}
								onCreateWorkItem={onCreateWorkItem}
								onItemHover={onItemHover}
								onLinkWorkItem={onSessionLink || onLinkWorkItem
									? handleLinkWorkItem
									: undefined}
								onSubtasks={onSubtasks}
								sessionDrag={canLinkAgentSession
									? detachedSessionDrag ?? localSessionDrag
									: undefined}
								showUntrackedWorkFooter={showUntrackedWorkFooter}
								style={{ marginTop: token("space.025") }}
								variant="medium-detached"
							/>
						</motion.div>
					</AnimatePresence>
				)
				: undefined}
			subtaskChrome={subtaskChrome}
			summary={card.title}
			tags={card.tags}
		/>
	);
}
