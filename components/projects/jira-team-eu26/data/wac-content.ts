import type {
	JiraKanbanAssigneeData,
	JiraKanbanCardData,
	JiraKanbanColumnData,
} from "@/components/blocks/jira-kanban";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import type { PulseAgentSession } from "@/components/blocks/jira-kanban/experimental/pulse/types";
import {
	JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES,
	JIRA_TEAM_EU26_SYNC_SESSIONS,
	JIRA_TEAM_EU26_SYNC_SESSION_COHORT_BY_ID,
	type JiraTeamEu26AgentSessionSyncSource,
} from "@/components/projects/jira-team-eu26/data/agent-session-sync";
import { JIRA_TEAM_EU26_PAY_CURRENT_USER } from "@/components/projects/jira-team-eu26/data/current-user";
import { createJiraTeamEu26PayBoardColumns, JIRA_TEAM_EU26_PRIMARY_BOARD_AGENTS } from "@/components/projects/jira-team-eu26/data/presentation-board";
import { JIRA_TEAM_EU26_PAY_SESSION_MEMBERS, PAY_STORY_PEOPLE } from "@/components/projects/jira-team-eu26/data/presentation-people";

export const WAC_BOARD_TITLE = "Checkout roadmap";
export const WAC_REVIEW_FINISH_DELAY_MS = 60_000;
export const WAC_CURRENT_USER = PAY_STORY_PEOPLE.diego;
export const WAC_SESSION_MEMBERS = JIRA_TEAM_EU26_PAY_SESSION_MEMBERS.filter((member) => member.id !== "venn");

const WAC_CURRENT_USER_INVOKER = { name: WAC_CURRENT_USER.name, avatarSrc: WAC_CURRENT_USER.avatarSrc };

export const WAC_BOARD_AGENTS = JIRA_TEAM_EU26_PRIMARY_BOARD_AGENTS;

export const WAC_HEADER_ASSIGNEES = [
	WAC_CURRENT_USER,
	...WAC_BOARD_AGENTS.map(({ headerId, name, avatarSrc }) => ({ id: headerId, name, avatarSrc })),
	PAY_STORY_PEOPLE.jordan,
	PAY_STORY_PEOPLE.maya,
	PAY_STORY_PEOPLE.priya,
] satisfies readonly JiraKanbanAssigneeData[];

type WacAgentId = (typeof WAC_BOARD_AGENTS)[number]["id"];
interface WacCardContent {
	code: string;
	title: string;
	tags: readonly string[];
	agentId?: WacAgentId;
	finished?: boolean;
	completionDescription?: string;
	needsInput?: boolean;
	stateTransition?: JiraIssueAgentActivity["stateTransition"];
}

/** Complete WAC card set in the authored status and display order. */
const WAC_COLUMNS = [
	[
		{ code: "PAY-118", title: "Implement Google Pay option for Android checkout", tags: ["checkout-mobile"] },
		{ code: "PAY-124", title: "Add automatic retry mechanism for failed webhooks", tags: ["webhooks"] },
		{ code: "PAY-125", title: "Design subscription renewal receipt email template", tags: ["notifications"], agentId: "figma" },
	],
	[
		{ code: "PAY-105", title: "Integrate 3D Secure 2.0 card verification flow", tags: ["checkout-web", "3ds"] },
		{ code: "PAY-107", title: "Build customer refund API endpoint for support dash", tags: ["payments-api"], agentId: "review-agent" },
		{ code: "PAY-123", title: 'Add "Save card for future purchases" toggle on checkout', tags: ["wallet"], agentId: "review-agent" },
	],
	[
		{ code: "PAY-112", title: "Add PCI-DSS compliance audit logging to token service", tags: ["compliance"], agentId: "release-agent", needsInput: true },
		{ code: "PAY-115", title: "Build real-time payment success and decline rate dashboard", tags: ["observability"], agentId: "test-agent", stateTransition: "agent-session" },
		{ code: "PAY-119", title: "Optimize transaction history database query latency", tags: ["database"], agentId: "test-agent", stateTransition: "agent-session" },
	],
	[
		{ code: "PAY-101", title: "Add Apple Pay button to checkout screen", tags: ["checkout-ui"], agentId: "claude-code", finished: true, completionDescription: "Added the Apple Pay button to the checkout screen and verified the payment handoff." },
		{ code: "PAY-113", title: "Update credit card expiration date validation logic", tags: ["validation"], agentId: "review-agent", finished: true, completionDescription: "Updated credit card expiration date validation logic." },
	],
] as const satisfies readonly (readonly WacCardContent[])[];

function createWacCard(base: JiraKanbanCardData, content: WacCardContent): JiraKanbanCardData {
	const card: JiraKanbanCardData = {
		...base,
		title: content.title,
		tags: content.tags.map((text) => ({ text, color: "gray" })),
		pullRequestPreview: base.pullRequestPreview ? {
			...base.pullRequestPreview,
			title: content.title,
			branch: `${content.code.toLowerCase()}/checkout-roadmap`,
		} : undefined,
		agentActivities: undefined,
		agentActivityMode: undefined,
		agentDoneRuns: undefined,
	};
	if (!content.agentId) return card;

	const agent = WAC_BOARD_AGENTS.find((candidate) => candidate.id === content.agentId)!;
	const invokedBy = { ...WAC_CURRENT_USER_INVOKER };
	const activity: JiraIssueAgentActivity = {
		id: `wac:${content.code}:${agent.id}`,
		...(content.stateTransition ? { stateTransition: content.stateTransition } : {}),
		name: agent.name,
		avatarSrc: agent.avatarSrc,
		agentBrandName: agent.brandName,
		label: content.title,
		message: content.needsInput ? `${agent.name} needs input on: ${content.title}.` : `${agent.name} is working on: ${content.title}.`,
		state: content.needsInput ? "awaiting-input" : "working",
		host: "local",
		role: "owner",
		invokedBy,
		timeLabel: "Just now",
	};
	return {
		...card,
		agentActivities: content.finished ? undefined : [activity],
		agentActivityMode: content.finished ? "completed" : content.needsInput ? "awaiting-input" : "working",
		agentDoneRuns: content.finished ? [{
			id: `wac:${content.code}:${agent.id}`,
			agentName: agent.name,
			agentAvatarSrc: agent.avatarSrc,
			agentBrandName: agent.brandName,
			host: "local",
			invokedBy,
			issueKey: content.code,
			issueSummary: content.title,
			summary: content.title,
			description: content.completionDescription ?? content.title,
			state: "done",
			relativeTime: "Just now",
		}] : undefined,
	};
}

export function createJiraTeamEu26WacBoardColumns(): JiraKanbanColumnData[] {
	const original = createJiraTeamEu26PayBoardColumns();
	const cardsByCode = new Map(original.flatMap((column) => column.cards).map((card) => [card.code, card]));
	return original.map((column, index) => ({
		...column,
		statuses: column.statuses ? [...column.statuses] : undefined,
		count: WAC_COLUMNS[index].length,
		cards: WAC_COLUMNS[index].map((content) => createWacCard(cardsByCode.get(content.code)!, content)),
	}));
}

/** Finish only the seeded review sessions; card placement and user edits stay intact. */
export function finishWacReviewAgents(columns: JiraKanbanColumnData[]): JiraKanbanColumnData[] {
	const nextColumns = columns.map((column) => {
		const cards = column.cards.map((card): JiraKanbanCardData => {
			if (card.code !== "PAY-115" && card.code !== "PAY-119") return card;
			const activity = card.agentActivities?.find((candidate) => candidate.id === `wac:${card.code}:test-agent` && candidate.state === "working");
			if (!activity) return card;
			const remaining = card.agentActivities!.filter((candidate) => candidate !== activity);
			return {
				...card,
				agentActivities: remaining.length > 0 ? remaining : undefined,
				agentActivityMode: remaining.length > 0 ? card.agentActivityMode : "completed",
				agentDoneRuns: [...(card.agentDoneRuns ?? []), {
					id: activity.id,
					...(activity.stateTransition ? { stateTransition: activity.stateTransition } : {}),
					agentName: activity.name,
					agentAvatarSrc: activity.avatarSrc,
					agentBrandName: activity.agentBrandName,
					host: activity.host,
					invokedBy: activity.invokedBy ? { ...activity.invokedBy } : undefined,
					issueKey: card.code,
					issueSummary: card.title,
					summary: card.title,
					description: `Completed: ${card.title}.`,
					state: "done",
					relativeTime: "Just now",
				}],
			};
		});
		return cards.some((card, index) => card !== column.cards[index]) ? { ...column, cards } : column;
	});
	return nextColumns.some((column, index) => column !== columns[index]) ? nextColumns : columns;
}

/** Keep new cards and assignments on the WAC persona at the page's state boundary. */
export function normalizeWacBoardCurrentUser(columns: JiraKanbanColumnData[]): JiraKanbanColumnData[] {
	return columns.map((column) => {
		const cards = column.cards.map((card) => {
			const replaceAssignee = card.assignee?.id === JIRA_TEAM_EU26_PAY_CURRENT_USER.id;
			const agentActivities = card.agentActivities?.map((activity) => activity.invokedBy?.name === JIRA_TEAM_EU26_PAY_CURRENT_USER.name
				? { ...activity, invokedBy: { ...WAC_CURRENT_USER_INVOKER } } : activity);
			const agentDoneRuns = card.agentDoneRuns?.map((run) => run.invokedBy?.name === JIRA_TEAM_EU26_PAY_CURRENT_USER.name
				? { ...run, invokedBy: { ...WAC_CURRENT_USER_INVOKER } } : run);
			const changed = replaceAssignee
				|| agentActivities?.some((activity, index) => activity !== card.agentActivities?.[index])
				|| agentDoneRuns?.some((run, index) => run !== card.agentDoneRuns?.[index]);
			return changed ? {
				...card,
				assignee: replaceAssignee ? { ...WAC_CURRENT_USER } : card.assignee,
				avatarSrc: replaceAssignee ? WAC_CURRENT_USER.avatarSrc : card.avatarSrc,
				agentActivities,
				agentDoneRuns,
			} : card;
		});
		return cards.some((card, index) => card !== column.cards[index]) ? { ...column, cards } : column;
	});
}

interface WacSessionContent {
	id: string;
	shortTitle: string;
	agentId?: PulseAgentSession["agentId"];
	keepNarrative?: boolean;
}

const WAC_SESSION_CONTENT = [
	{ id: "lw-sync-final-readiness", shortTitle: "Add audit logging for customer refunds" },
	{ id: "lw-sync-capture-metrics", shortTitle: "Standardize payment decline error codes", agentId: "copilot" },
	{ id: "lw-sync-decline-parity", shortTitle: "Update runbook docs", agentId: "copilot" },
	{ id: "lw-sync-payout-recovery", shortTitle: "Recover failed merchant payout batches" },
	{ id: "lw-sync-auth-fallback", shortTitle: "Lock database records during account migration" },
	{ id: "lw-sync-retry-headers", shortTitle: "Retry header audit", keepNarrative: true },
	{ id: "lw-sync-rollback-metrics", shortTitle: "Rollback metric thresholds", agentId: "copilot" },
	{ id: "lw-sync-account-locks", shortTitle: "Trace gateway outage failures" },
	{ id: "lw-sync-fee-rounding", shortTitle: "Fee rounding edge cases", keepNarrative: true },
	{ id: "lw-sync-token-rotation", shortTitle: "Rotate payment API security tokens" },
] as const satisfies readonly WacSessionContent[];

function toWacSession(session: PulseAgentSession, content?: WacSessionContent): PulseAgentSession {
	const memberIds = [...new Set(session.memberIds.map((id) => id === "venn" ? "diego" : id))];
	if (!content) {
		return { ...session, id: `wac:${session.id}`, memberIds, pullRequest: session.pullRequest ? { ...session.pullRequest } : undefined };
	}
	return {
		...session,
		id: `wac:${session.id}`,
		memberIds,
		shortTitle: content.shortTitle,
		title: content.keepNarrative ? session.title : content.shortTitle,
		agentId: content.agentId ?? session.agentId,
		detail: `${session.detail.split(" · ").slice(0, 2).join(" · ")} · ${content.shortTitle}`,
		pullRequest: session.pullRequest ? {
			...session.pullRequest,
			title: content.shortTitle,
			description: content.shortTitle,
			branch: `wac/${session.id.replace("lw-sync-", "")}`,
		} : undefined,
	};
}

export const WAC_SEEDED_AGENT_SESSION_OVERRIDES: ReadonlyMap<string, PulseAgentSession> = new Map(
	[...JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES].map(([id, session]) => [id, toWacSession(session)]),
);

const WAC_SESSION_CONTENT_BY_ID: ReadonlyMap<string, WacSessionContent> = new Map(
	WAC_SESSION_CONTENT.map((content) => [content.id, content]),
);

/** Namespace the 32 sync and 16 seed identities so capture/archive decisions stay within WAC. */
export const WAC_AGENT_SESSIONS: readonly PulseAgentSession[] = JIRA_TEAM_EU26_SYNC_SESSIONS
	.map((session) => toWacSession(session, WAC_SESSION_CONTENT_BY_ID.get(session.id)));

export const WAC_AGENT_SESSION_SYNC_SOURCE: JiraTeamEu26AgentSessionSyncSource = {
	sessions: WAC_AGENT_SESSIONS,
	seedOverrides: WAC_SEEDED_AGENT_SESSION_OVERRIDES,
	cohortById: new Map([...JIRA_TEAM_EU26_SYNC_SESSION_COHORT_BY_ID].map(([id, cohort]) => [`wac:${id}`, cohort])),
};
