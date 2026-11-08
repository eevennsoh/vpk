import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { PROJECT_BUTTER_JOURNEY_PULL_REQUEST, projectButterDevelopmentChecks } from "../../../blocks/jira-work-item/project-butter/development-journey-model.ts";
import { BUTTER_PAY_CURRENT_USER } from "./current-user.ts";

export type MerchantJourneyPhase = "prepare" | "invoke" | "working" | "pr" | "failed" | "fixing" | "passed" | "merged";

type JourneyActivity = JiraIssueAgentActivity & {
	merchantJourneyCreated?: true;
};

type JourneyCard = JiraKanbanCardData & {
	merchantJourneyBaseline?: Pick<JiraKanbanCardData, "assignee" | "avatarSrc" | "status" | "pullRequestNumber" | "pullRequestPreview" | "pullRequestStatus"> & {
		generatedAssignee?: JiraKanbanCardData["assignee"];
	};
};

const PR_PREVIEW = {
	title: PROJECT_BUTTER_JOURNEY_PULL_REQUEST.title,
	href: PROJECT_BUTTER_JOURNEY_PULL_REQUEST.href,
	author: { name: BUTTER_PAY_CURRENT_USER.name, avatarUrl: BUTTER_PAY_CURRENT_USER.avatarSrc, assistedBy: { name: "Claude", brandName: "claude" } },
	repository: "payments-platform/payments",
	branch: PROJECT_BUTTER_JOURNEY_PULL_REQUEST.branch,
	targetBranch: PROJECT_BUTTER_JOURNEY_PULL_REQUEST.targetBranch,
	additions: PROJECT_BUTTER_JOURNEY_PULL_REQUEST.additions,
	deletions: PROJECT_BUTTER_JOURNEY_PULL_REQUEST.deletions,
	filesChanged: PROJECT_BUTTER_JOURNEY_PULL_REQUEST.filesChanged,
	relativeTime: "Just now",
} as const;

export function createMerchantJourneyAgentActivity(sessionId: string): JourneyActivity {
	return {
		id: sessionId,
		name: "Claude",
		avatarSrc: "/illustration/agent-lanyard/claude.svg",
		agentBrandName: "claude",
		label: "Working",
		sessionTitle: "Improve merchant onboarding",
		state: "working",
		host: "cloud",
		timeLabel: "Just now",
		invokedBy: { name: BUTTER_PAY_CURRENT_USER.name, avatarSrc: BUTTER_PAY_CURRENT_USER.avatarSrc },
		merchantJourneyCreated: true,
	};
}

export function projectMerchantJourneyActivities(activities: readonly JourneyActivity[] | undefined, phase: MerchantJourneyPhase, session?: string | JiraIssueAgentActivity): readonly JourneyActivity[] | undefined {
	const beforeWork = phase === "prepare" || phase === "invoke";
	const sessionId = typeof session === "string" ? session : session?.id;
	if (beforeWork) return activities?.filter((activity) => !activity.merchantJourneyCreated && activity.id !== sessionId);
	if (!sessionId) return activities;
	const existing = activities?.find((activity) => activity.id === sessionId);
	const source: JourneyActivity | undefined = existing ?? (typeof session === "string" ? createMerchantJourneyAgentActivity(sessionId) : session);
	if (!source) return activities;
	const projected: JourneyActivity = {
		...source,
		state: phase === "merged" ? "completed" : "working",
		...(source.merchantJourneyCreated ? { label: phase === "merged" ? "Finished" : "Working" } : {}),
	};
	return existing
		? activities?.map((activity) => activity.id === sessionId ? projected : activity)
		: [...(activities ?? []), projected];
}

export function merchantJourneyAuthoredCard(card: JiraKanbanCardData): JiraKanbanCardData {
	const journeyCard: JourneyCard = card;
	const baseline = journeyCard.merchantJourneyBaseline;
	if (!baseline) return card;
	const generatedAssignee = baseline.generatedAssignee && card.assignee === baseline.generatedAssignee;
	return {
		...card,
		status: baseline.status,
		assignee: generatedAssignee ? baseline.assignee : card.assignee,
		avatarSrc: generatedAssignee && card.avatarSrc === baseline.generatedAssignee?.avatarSrc ? baseline.avatarSrc : card.avatarSrc,
	};
}

function projectCard(card: JourneyCard, phase: MerchantJourneyPhase, session?: string | JiraIssueAgentActivity): JourneyCard {
	const beforeWork = phase === "prepare" || phase === "invoke";
	const { merchantJourneyBaseline, ...authored } = card;
	const assignCurrentUser = !beforeWork && !merchantJourneyBaseline && !card.assignee;
	const baseline = merchantJourneyBaseline ?? {
		assignee: card.assignee,
		avatarSrc: card.avatarSrc,
		status: card.status ?? "To do",
		generatedAssignee: assignCurrentUser ? BUTTER_PAY_CURRENT_USER : undefined,
		pullRequestNumber: card.pullRequestNumber === PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number ? undefined : card.pullRequestNumber,
		pullRequestPreview: card.pullRequestNumber === PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number ? undefined : card.pullRequestPreview,
		pullRequestStatus: card.pullRequestNumber === PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number ? undefined : card.pullRequestStatus,
	};
	const hasPullRequest = phase === "pr" || phase === "failed" || phase === "fixing" || phase === "passed" || phase === "merged";
	const restorePullRequest = card.pullRequestNumber === PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number;
	const authoredCard = merchantJourneyAuthoredCard(card);
	return {
		...authored,
		...(!beforeWork ? { merchantJourneyBaseline: baseline } : {}),
		status: phase === "merged" ? "Done" : beforeWork ? "To do" : "In progress",
		assignee: beforeWork ? authoredCard.assignee : assignCurrentUser ? BUTTER_PAY_CURRENT_USER : card.assignee,
		avatarSrc: beforeWork ? authoredCard.avatarSrc : assignCurrentUser ? BUTTER_PAY_CURRENT_USER.avatarSrc : card.avatarSrc,
		animatePullRequestOnMount: phase === "pr",
		pullRequestNumber: hasPullRequest ? PROJECT_BUTTER_JOURNEY_PULL_REQUEST.number : restorePullRequest ? baseline.pullRequestNumber : card.pullRequestNumber,
		pullRequestPreview: hasPullRequest ? { ...PR_PREVIEW, checks: projectButterDevelopmentChecks(phase) } : restorePullRequest ? baseline.pullRequestPreview : card.pullRequestPreview,
		pullRequestStatus: hasPullRequest ? (phase === "merged" ? "merged" : phase === "failed" ? "failed" : "open") : restorePullRequest ? baseline.pullRequestStatus : card.pullRequestStatus,
		agentActivities: projectMerchantJourneyActivities(card.agentActivities, phase, session),
	};
}

/** Project journey-owned fields in either direction while retaining authored data. */
export function applyMerchantJourneyToBoard(columns: readonly JiraKanbanColumnData[], phase: MerchantJourneyPhase, session?: string | JiraIssueAgentActivity): JiraKanbanColumnData[] {
	const source = columns.find((column) => column.cards.some((card) => card.code === "PAY-999"));
	const card = source?.cards.find((item) => item.code === "PAY-999");
	if (!source || !card) return [...columns];
	const destination = phase === "merged" ? "Done" : phase === "prepare" || phase === "invoke" ? "To do" : "In progress";
	if (!columns.some((column) => column.title === destination)) return [...columns];
	const updated = projectCard(card, phase, session);
	return columns.map((column) => {
		if (source.title === destination && column === source) return { ...column, cards: column.cards.map((item) => item.code === card.code ? updated : item) };
		if (column === source) { const cards = column.cards.filter((item) => item.code !== card.code); return { ...column, cards, count: cards.length }; }
		if (column.title === destination) { const cards = [updated, ...column.cards]; return { ...column, cards, count: cards.length }; }
		return column;
	});
}
