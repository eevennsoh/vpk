import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
} from "@/components/blocks/jira-issue";
import type { QuestionCardQuestion } from "@/components/blocks/question-card/types";
import type {
	JiraKanbanAgentData,
	JiraKanbanAssigneeData,
	JiraKanbanCardData,
	JiraKanbanColumnData,
} from "@/components/blocks/jira-kanban";
import type { ArtifactListItem } from "@/components/ui-custom/artifact-list";

import { JIRA_GOLDEN_JOURNEYS_V4_PAY_CURRENT_USER } from "./current-user";
import {
	JIRA_GOLDEN_JOURNEYS_V4_PAY_101_SESSION_ID,
	JIRA_GOLDEN_JOURNEYS_V4_PAY_101_PULL_REQUEST_NUMBER,
	PAY_101_INVENTORY_COMMIT_ARTIFACT,
	PAY_101_INVENTORY_PR_ARTIFACT,
} from "./presentation-build";
import { getJiraGoldenJourneysV4PullRequestPreview } from "./presentation-pull-requests";

export { JIRA_GOLDEN_JOURNEYS_V4_PAY_CURRENT_USER };

const PAY_AVATARS = {
	diego: "/avatar-user/dev-rana/color/asow-product-purple.png",
	jordan: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
	maya: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
	priya: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
	releaseAgent: "/avatar-agent/strategy-agents/strategic-insight.svg",
	reviewAgent: "/avatar-agent/teamwork-agents/decision-director.svg",
	testAgent: "/avatar-agent/service-agents/rca-agent.svg",
} as const;

const PAY_ASSIGNEES = {
	diego: {
		id: "diego-santos",
		name: "Diego Santos",
		avatarSrc: PAY_AVATARS.diego,
	},
	jordan: {
		id: "jordan-okafor",
		name: "Jordan Okafor",
		avatarSrc: PAY_AVATARS.jordan,
	},
	maya: {
		id: "maya-ferreira",
		name: "Maya Ferreira",
		avatarSrc: PAY_AVATARS.maya,
	},
	priya: {
		id: "priya-raman",
		name: "Priya Raman",
		avatarSrc: PAY_AVATARS.priya,
	},
} as const satisfies Record<string, JiraKanbanAssigneeData>;

/** Codex pauses PAY-112 until a human picks the sandbox retention call. */
export const JIRA_GOLDEN_JOURNEYS_V4_PAY_112_RETENTION_QUESTION = {
	id: "pay-112-sandbox-retention",
	kind: "single-select",
	label: "How should Codex treat sandbox key retention before replay?",
	description: "Replaying without a signed window changes the blast radius of PAY-112.",
	options: [
		{
			id: "seven-day-sandbox",
			label: "Assume a 7-day sandbox window",
			description: "Treat keys as retained for seven days and keep replay inside sandbox only.",
		},
		{
			id: "hold-live-replay",
			label: "Do not replay keys against live accounts",
			description: "Hold the replay work until payments platform confirms the retention window in writing.",
		},
		{
			id: "jordan-signs-off",
			label: "Jordan signs off the retention window",
			description: "Pause until Jordan confirms the number, then resume the sandbox replay plan.",
		},
	],
} as const satisfies QuestionCardQuestion;

export const JIRA_GOLDEN_JOURNEYS_V4_PAY_112_RETENTION_MESSAGE =
	"I confirmed the sandbox can 401 when a replayed key is still retained, but I need a human call before I keep going. Replaying against live accounts without a signed retention window would change the blast radius of PAY-112.";

export const JIRA_GOLDEN_JOURNEYS_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID = {
	"diego-santos": "diego",
	"jordan-okafor": "jordan",
	"maya-ferreira": "maya",
	"priya-raman": "priya",
} as const satisfies Readonly<Record<string, string>>;

export const JIRA_GOLDEN_JOURNEYS_V4_PAY_BOARD_AGENTS = [
	{
		id: "claude-code",
		name: "Claude",
		byline: "Coding agent by Anthropic",
		brandName: "claude",
	},
	{
		id: "review-agent",
		name: "Codex",
		byline: "Reviews every pull request",
		brandName: "openai-codex",
	},
	{
		id: "test-agent",
		name: "Cursor",
		byline: "Writes and repairs tests",
		brandName: "cursor",
	},
	{
		id: "release-agent",
		name: "GitHub Copilot",
		byline: "Owns the flag and rollout",
		brandName: "github-copilot",
	},
] as const satisfies readonly JiraKanbanAgentData[];

export function toJiraGoldenJourneysV4AgentActivityFromSession(
	session: AgentSessionItem,
): JiraIssueAgentActivity {
	return {
		id: session.id,
		name: session.agent.name,
		avatarSrc: session.agent.avatarSrc,
		agentBrandName: session.agent.brandName,
		label: session.title,
		state: session.state === "needs-input" || session.state === "attention"
			? "awaiting-input"
			: session.state === "complete"
				? "completed"
				: "working",
		...(session.invokedBy ? { invokedBy: session.invokedBy } : {}),
		...(session.host !== undefined ? { host: session.host } : {}),
		...(session.role !== undefined ? { role: session.role } : {}),
		...(session.timeLabel ? { timeLabel: session.timeLabel } : {}),
	};
}

export function toJiraGoldenJourneysV4DetachedAgentSession(
	activity: JiraIssueAgentActivity,
	card: JiraKanbanCardData,
): AgentSessionItem {
	return {
		id: activity.id,
		title: activity.label,
		state: activity.state === "awaiting-input"
			? "needs-input"
			: activity.state === "completed"
				? "complete"
				: "running",
		agent: {
			avatarSrc: activity.avatarSrc,
			brandName: activity.agentBrandName,
			id: activity.id,
			kind: "agent",
			name: activity.name,
		},
		sessionDetails: {
			issueKey: card.code,
			issueSummary: card.title,
			...(activity.host !== undefined ? { host: activity.host } : {}),
		},
		...(activity.invokedBy ? { invokedBy: activity.invokedBy } : {}),
		...(activity.host !== undefined ? { host: activity.host } : {}),
		...(activity.role !== undefined ? { role: activity.role } : {}),
		...(activity.timeLabel ? { timeLabel: activity.timeLabel } : {}),
	};
}

export const JIRA_GOLDEN_JOURNEYS_V4_PAY_COMPOSER_AGENTS = [
	{
		id: "claude-code",
		name: "Claude",
		byline: "Coding agent by Anthropic",
		brandName: "claude",
	},
	{
		id: "review-agent",
		name: "Codex",
		byline: "Reviews every pull request",
		brandName: "openai-codex",
	},
	{
		id: "test-agent",
		name: "Cursor",
		byline: "Writes and repairs tests",
		brandName: "cursor",
	},
	{
		id: "release-agent",
		name: "GitHub Copilot",
		byline: "Owns the flag and rollout",
		brandName: "github-copilot",
	},
] as const satisfies readonly AgentSelectorAgent[];

export const JIRA_GOLDEN_JOURNEYS_V4_PAY_HEADER_ASSIGNEES = [
	JIRA_GOLDEN_JOURNEYS_V4_PAY_CURRENT_USER,
	{
		id: "review-agent",
		name: "Codex",
		avatarSrc: PAY_AVATARS.reviewAgent,
	},
	{
		id: "test-agent",
		name: "Cursor",
		avatarSrc: PAY_AVATARS.testAgent,
	},
	{
		id: "release-agent",
		name: "GitHub Copilot",
		avatarSrc: PAY_AVATARS.releaseAgent,
	},
] as const satisfies readonly JiraKanbanAssigneeData[];

function attachPullRequestPreview(
	code: string,
	pullRequestNumber: number | undefined,
): JiraKanbanCardData["pullRequestPreview"] {
	if (!pullRequestNumber) {
		return undefined;
	}

	const preview = getJiraGoldenJourneysV4PullRequestPreview(code);
	if (!preview) {
		throw new Error(`Missing dummy pull-request preview for ${code}`);
	}

	return preview;
}

function createCard({
	agentActivities,
	agentDoneRuns,
	agentActivityMode,
	assignee,
	code,
	priority = "medium",
	pullRequestNumber,
	pullRequestStatus,
	tags,
	title,
}: Readonly<{
	agentActivities?: readonly JiraIssueAgentActivity[];
	agentDoneRuns?: readonly JiraIssueCompletedAgentRun[];
	agentActivityMode?: JiraKanbanCardData["agentActivityMode"];
	assignee: JiraKanbanAssigneeData;
	code: string;
	priority?: JiraKanbanCardData["priority"];
	pullRequestNumber?: number;
	pullRequestStatus?: JiraKanbanCardData["pullRequestStatus"];
	tags: JiraKanbanCardData["tags"];
	title: string;
}>): JiraKanbanCardData {
	return {
		agentActivities,
		agentDoneRuns,
		agentActivityMode,
		assignee,
		avatarSrc: assignee.avatarSrc,
		code,
		priority,
		pullRequestNumber,
		pullRequestPreview: attachPullRequestPreview(code, pullRequestNumber),
		pullRequestStatus,
		tags,
		title,
	};
}

function createActivity({
	agentBrandName,
	agentName,
	avatarSrc,
	cycleIntervalJitterMs,
	cycleIntervalMs,
	host,
	id,
	invokedBy,
	label,
	labels,
	message,
	question,
	role,
	state,
	timeLabel,
}: Readonly<{
	agentBrandName?: JiraIssueAgentActivity["agentBrandName"];
	agentName: string;
	avatarSrc?: string;
	cycleIntervalJitterMs?: number;
	cycleIntervalMs?: number;
	host?: JiraIssueAgentActivity["host"];
	id: string;
	invokedBy?: JiraIssueAgentActivity["invokedBy"];
	label: string;
	labels?: readonly string[];
	message?: string;
	question?: JiraIssueAgentActivity["question"];
	role?: JiraIssueAgentActivity["role"];
	state: "working" | "awaiting-input";
	timeLabel: string;
}>): JiraIssueAgentActivity {
	return {
		id,
		name: agentName,
		avatarSrc,
		agentBrandName,
		cycleIntervalJitterMs,
		cycleIntervalMs,
		label,
		labels: state === "working"
			? labels ?? [label]
			: [label],
		message: message ?? (state === "working"
			? `${agentName} is working and will post the next result to the Jira work item.`
			: `${agentName} needs a person to answer before continuing.`),
		state,
		timeLabel,
		...(host !== undefined ? { host } : {}),
		...(invokedBy ? { invokedBy } : {}),
		...(question ? { question } : {}),
		...(role !== undefined ? { role } : {}),
	};
}

function createCompletedRun({
	agentBrandName,
	agentName,
	avatarSrc,
	description,
	id,
	issueKey,
	issueSummary,
	outputs,
	pullRequestNumber,
	state = "done",
	summary,
}: Readonly<{
	agentBrandName?: JiraIssueCompletedAgentRun["agentBrandName"];
	agentName: string;
	avatarSrc?: string;
	description: string;
	id: string;
	issueKey: string;
	issueSummary: string;
	outputs?: readonly ArtifactListItem[];
	pullRequestNumber?: number;
	state?: JiraIssueCompletedAgentRun["state"];
	summary: string;
}>): JiraIssueCompletedAgentRun {
	return {
		id,
		agentName,
		agentBrandName,
		agentAvatarSrc: avatarSrc,
		description,
		elapsedSeconds: 486,
		issueKey,
		issueSummary,
		outputs,
		pullRequestNumber,
		relativeTime: "This week",
		state,
		summary,
	};
}

export const JIRA_GOLDEN_JOURNEYS_V4_PAY_STATUS_PHASES = [
	"To do",
	"In progress",
	"In review",
	"Done",
] as const satisfies readonly string[];

const PAY_BOARD_COLUMNS: readonly JiraKanbanColumnData[] = [
	{
		title: "To do",
		count: 4,
		cards: [
			createCard({
				assignee: PAY_ASSIGNEES.diego,
				code: "PAY-118",
				tags: [{ text: "wallet", color: "purple" }],
				title: "Carry card-artwork metadata into the next wallet epic",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.priya,
				code: "PAY-124",
				priority: "major",
				tags: [{ text: "rollout", color: "blue" }],
				title: "Confirm the English-only account allow-list",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.maya,
				code: "PAY-125",
				tags: [{ text: "observability", color: "green" }],
				title: "Add production dashboards for the one-percent slice",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.jordan,
				code: "PAY-127",
				priority: "minor",
				tags: [{ text: "cleanup", color: "gray" }],
				title: "Remove the two dead v1 exports after rollout",
			}),
		],
	},
	{
		title: "In progress",
		count: 4,
		cards: [
			createCard({
				assignee: PAY_ASSIGNEES.jordan,
				code: "PAY-105",
				priority: "major",
				pullRequestNumber: 1851,
				pullRequestStatus: "failed",
				tags: [{ text: "checkout-web", color: "blue" }, { text: "3ds", color: "orange" }],
				title: "Port confirmPaymentIntent and the 3-D Secure challenge flow",
				agentActivities: [createActivity({
					id: "PAY-105:test-agent",
					agentName: "Cursor",
					agentBrandName: "cursor",
					cycleIntervalJitterMs: 1800,
					cycleIntervalMs: 2600,
					host: "local",
					label: "Replaying 3-D Secure fixtures",
					labels: ["Replaying 3-D Secure fixtures", "Comparing challenge payloads", "Running checkout recovery cases"],
					role: "owner",
					state: "working",
					timeLabel: "12m",
				})],
			}),
			createCard({
				assignee: PAY_ASSIGNEES.maya,
				code: "PAY-107",
				priority: "major",
				pullRequestNumber: 1856,
				pullRequestStatus: "open",
				tags: [{ text: "payments-api", color: "lime" }],
				title: "Move retry and backoff out of LegacyGatewayAdapter",
				agentActivities: [createActivity({
					id: "PAY-107:claude-code",
					agentName: "Claude",
					agentBrandName: "claude",
					cycleIntervalJitterMs: 2200,
					cycleIntervalMs: 3100,
					host: "cloud",
					invokedBy: {
						avatarSrc: PAY_ASSIGNEES.maya.avatarSrc,
						name: PAY_ASSIGNEES.maya.name,
					},
					label: "Implementing webhook retry semantics",
					labels: ["Implementing webhook retry semantics", "Moving backoff into the v2 client", "Running payments API retry tests"],
					role: "viewer",
					state: "working",
					timeLabel: "Yesterday",
				})],
			}),
			createCard({
				assignee: PAY_ASSIGNEES.jordan,
				code: "PAY-123",
				priority: "major",
				tags: [{ text: "fixtures", color: "purple" }],
				title: "Record the three missing decline-code fixtures",
				agentActivities: [
					createActivity({
						id: "PAY-123:test-agent",
						agentName: "Cursor",
						agentBrandName: "cursor",
						cycleIntervalJitterMs: 1700,
						cycleIntervalMs: 1900,
						host: "cloud",
						invokedBy: {
							avatarSrc: PAY_ASSIGNEES.jordan.avatarSrc,
							name: PAY_ASSIGNEES.jordan.name,
						},
						label: "Recording decline-code fixtures",
						labels: ["Recording decline-code fixtures", "Comparing missing decline cases", "Running fixture coverage"],
						role: "viewer",
						state: "working",
						timeLabel: "36s",
					}),
					createActivity({
						id: "PAY-123:claude-code",
						agentName: "Claude",
						agentBrandName: "claude",
						cycleIntervalJitterMs: 2100,
						cycleIntervalMs: 2400,
						host: "local",
						label: "Wiring recorded fixtures into the v2 client",
						labels: ["Wiring recorded fixtures into the v2 client", "Adapting client assertions", "Running v2 client tests"],
						role: "owner",
						state: "working",
						timeLabel: "3h",
					}),
				],
			}),
			createCard({
				assignee: PAY_ASSIGNEES.diego,
				code: "PAY-130",
				priority: "major",
				tags: [{ text: "localisation", color: "purple" }],
				title: "Localise eleven v2 decline strings into nine languages",
			}),
		],
	},
	{
		title: "In review",
		count: 8,
		cards: [
			createCard({
				assignee: PAY_ASSIGNEES.jordan,
				code: "PAY-112",
				priority: "major",
				pullRequestNumber: 1858,
				pullRequestStatus: "failed",
				tags: [{ text: "idempotency", color: "red" }],
				title: "Confirm the sandbox key retention window before replay",
				agentActivities: [createActivity({
					id: "PAY-112:review-agent",
					agentName: "Codex",
					agentBrandName: "openai-codex",
					host: "cloud",
					invokedBy: {
						avatarSrc: PAY_ASSIGNEES.jordan.avatarSrc,
						name: PAY_ASSIGNEES.jordan.name,
					},
					label: "Needs the retention window",
					message: JIRA_GOLDEN_JOURNEYS_V4_PAY_112_RETENTION_MESSAGE,
					question: JIRA_GOLDEN_JOURNEYS_V4_PAY_112_RETENTION_QUESTION,
					role: "owner",
					state: "awaiting-input",
					timeLabel: "Last week",
				})],
			}),
			createCard({
				assignee: PAY_ASSIGNEES.priya,
				code: "PAY-115",
				tags: [{ text: "release note", color: "blue" }],
				title: "Rewrite the customer ship note after the wallet cut",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.maya,
				code: "PAY-119",
				pullRequestNumber: 1880,
				pullRequestStatus: "open",
				tags: [{ text: "runbook", color: "teal" }],
				title: "Publish and link the rollback rehearsal runbook",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.diego,
				code: "PAY-132",
				priority: "minor",
				tags: [{ text: "copy", color: "purple" }],
				title: "Approve the final issuer-unavailable recovery message",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.jordan,
				code: "PAY-104",
				priority: "major",
				pullRequestNumber: 1851,
				pullRequestStatus: "open",
				tags: [{ text: "checkout-web", color: "blue" }],
				title: "Port createPaymentIntent onto the v2 client",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.maya,
				code: "PAY-109",
				pullRequestNumber: 1863,
				pullRequestStatus: "open",
				tags: [{ text: "codegen", color: "gray" }],
				title: "Regenerate webhook payloads from the v2 OpenAPI spec",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.priya,
				code: "PAY-121",
				priority: "major",
				pullRequestNumber: 1866,
				pullRequestStatus: "open",
				tags: [{ text: "release flag", color: "green" }],
				title: "Add per-account targeting and an armed kill switch",
				agentActivities: [createActivity({
					id: "PAY-121:release-agent",
					agentName: "GitHub Copilot",
					agentBrandName: "github-copilot",
					cycleIntervalJitterMs: 2400,
					cycleIntervalMs: 3600,
					host: "cloud",
					label: "Validating one-percent targeting",
					labels: ["Validating one-percent targeting", "Checking account kill-switch rules", "Reviewing release telemetry gates"],
					role: "owner",
					state: "working",
					timeLabel: "18m",
				})],
			}),
			createCard({
				assignee: PAY_ASSIGNEES.maya,
				code: "PAY-128",
				priority: "major",
				pullRequestNumber: 1881,
				pullRequestStatus: "open",
				tags: [{ text: "ledger-sync", color: "teal" }],
				title: "Stamp SDK version at settlement for finance exports",
			}),
		],
	},
	{
		title: "Done",
		count: 4,
		cards: [
			createCard({
				assignee: PAY_ASSIGNEES.jordan,
				code: "PAY-101",
				priority: "major",
				pullRequestNumber: JIRA_GOLDEN_JOURNEYS_V4_PAY_101_PULL_REQUEST_NUMBER,
				pullRequestStatus: "merged",
				tags: [{ text: "discovery", color: "purple" }],
				title: "Inventory every v1 call site across services and name an owner for each",
				agentActivityMode: "completed",
				agentDoneRuns: [createCompletedRun({
					id: JIRA_GOLDEN_JOURNEYS_V4_PAY_101_SESSION_ID,
					agentName: "Claude",
					agentBrandName: "claude",
					issueKey: "PAY-101",
					issueSummary: "Inventory every v1 call site across services and name an owner for each",
					description: "Mapped 61 call sites and linked the merged four-service inventory. The separate local rationale session remains uncaptured.",
					outputs: [PAY_101_INVENTORY_PR_ARTIFACT, PAY_101_INVENTORY_COMMIT_ARTIFACT],
					pullRequestNumber: JIRA_GOLDEN_JOURNEYS_V4_PAY_101_PULL_REQUEST_NUMBER,
					summary: "Captured inventory run and durable evidence",
				})],
			}),
			createCard({
				assignee: PAY_ASSIGNEES.maya,
				code: "PAY-102",
				priority: "major",
				pullRequestNumber: 1847,
				pullRequestStatus: "merged",
				tags: [{ text: "spike", color: "teal" }, { text: "sdk", color: "blue" }],
				title: "Prove LegacyGatewayAdapter can be deleted outright",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.jordan,
				code: "PAY-113",
				pullRequestNumber: 1863,
				pullRequestStatus: "merged",
				tags: [{ text: "contract tests", color: "green" }],
				title: "Land the 3-D Secure contract suite with 214 assertions",
			}),
			createCard({
				assignee: PAY_ASSIGNEES.maya,
				code: "PAY-126",
				pullRequestNumber: 1874,
				pullRequestStatus: "merged",
				tags: [{ text: "migration", color: "blue" }],
				title: "Delete LegacyGatewayAdapter after all 61 ports land",
			}),
		],
	},
];

function cloneBoardCard(card: JiraKanbanCardData): JiraKanbanCardData {
	return {
		...card,
		assignee: card.assignee ? { ...card.assignee } : undefined,
		tags: card.tags.map((tag) => ({ ...tag })),
		agentActivities: card.agentActivities?.map((activity) => ({
			...activity,
			labels: activity.labels ? [...activity.labels] : undefined,
			question: activity.question
				? {
					...activity.question,
					options: activity.question.options.map((option) => ({ ...option })),
				}
				: undefined,
		})),
		pullRequestPreview: card.pullRequestPreview
			? {
				...card.pullRequestPreview,
				author: card.pullRequestPreview.author
					? { ...card.pullRequestPreview.author }
					: undefined,
			}
			: undefined,
		agentDoneRuns: card.agentDoneRuns?.map((run) => ({
			...run,
			outputs: run.outputs?.map((output) => ({
				...output,
				pullRequest: output.pullRequest ? { ...output.pullRequest } : undefined,
			})),
		})),
	};
}

export function createJiraGoldenJourneysV4PayBoardColumns(): JiraKanbanColumnData[] {
	return PAY_BOARD_COLUMNS.map((column) => ({
		...column,
		cards: column.cards.map(cloneBoardCard),
	}));
}
