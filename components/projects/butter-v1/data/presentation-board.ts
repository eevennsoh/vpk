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

import { BUTTER_PAY_CURRENT_USER } from "./current-user";
import { BUTTER_HEADER_AGENT_ASSIGNEES } from "./header-agent-assignees";
import {
	BUTTER_PAY_101_SESSION_ID,
	BUTTER_PAY_101_PULL_REQUEST_NUMBER,
	PAY_101_INVENTORY_COMMIT_ARTIFACT,
	PAY_101_INVENTORY_PR_ARTIFACT,
	PAY_101_SUBTASK_KEYS,
} from "./presentation-build";
import { PAY_STORY_PEOPLE } from "./presentation-people";
import { getButterPullRequestPreview } from "./presentation-pull-requests";
import { BUTTER_TODO_PLACEHOLDERS } from "./work-item-placeholders/todo";

export { BUTTER_PAY_CURRENT_USER };
export { BUTTER_BOARD_AGENTS, BUTTER_PRIMARY_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";

const BUTTER_PAY_CURRENT_USER_INVOKER = {
	avatarSrc: BUTTER_PAY_CURRENT_USER.avatarSrc,
	name: BUTTER_PAY_CURRENT_USER.name,
} as const satisfies NonNullable<JiraIssueAgentActivity["invokedBy"]>;

/** Codex pauses PAY-112 until a human picks the sandbox retention call. */
export const BUTTER_PAY_112_RETENTION_QUESTION = {
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

export const BUTTER_PAY_112_RETENTION_MESSAGE =
	"I confirmed the sandbox can 401 when a replayed key is still retained, but I need a human call before I keep going. Replaying against live accounts without a signed retention window would change the blast radius of PAY-112.";

export const BUTTER_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID = {
	"diego-santos": "diego",
	"jordan-okafor": "jordan",
	"maya-ferreira": "maya",
	"priya-raman": "priya",
} as const satisfies Readonly<Record<string, string>>;

export const BUTTER_PAY_BOARD_AGENTS = [
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

export function toButterAgentActivityFromSession(
	session: AgentSessionItem & { prompt?: string; invokedAtMs?: number },
): JiraIssueAgentActivity {
	return {
		id: session.id,
		name: session.agent.name,
		avatarSrc: session.agent.avatarSrc,
		agentBrandName: session.agent.brandName,
		label: session.title,
		sessionTitle: session.title,
		...(session.prompt ? { prompt: session.prompt } : {}),
		...(session.invokedAtMs ?? session.startedAtMs ? { startedAtMs: session.invokedAtMs ?? session.startedAtMs } : {}),
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

export function toButterDetachedAgentSession(
	activity: JiraIssueAgentActivity,
	card: JiraKanbanCardData,
): AgentSessionItem & { prompt?: string; invokedAtMs?: number } {
	return {
		id: activity.id,
		...(activity.prompt ? { prompt: activity.prompt } : {}),
		...(activity.startedAtMs ? { startedAtMs: activity.startedAtMs, invokedAtMs: activity.startedAtMs } : {}),
		title: activity.sessionTitle ?? activity.label,
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

export const BUTTER_PAY_COMPOSER_AGENTS = [
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

export const BUTTER_PAY_HEADER_ASSIGNEES = [
	BUTTER_PAY_CURRENT_USER,
	...BUTTER_HEADER_AGENT_ASSIGNEES,
] as const satisfies readonly JiraKanbanAssigneeData[];

function attachPullRequestPreview(
	code: string,
	pullRequestNumber: number | undefined,
): JiraKanbanCardData["pullRequestPreview"] {
	if (!pullRequestNumber) {
		return undefined;
	}

	const preview = getButterPullRequestPreview(code);
	if (!preview) {
		throw new Error(`Missing dummy pull-request preview for ${code}`);
	}

	return { ...preview, href: preview.repository ? `https://github.com/${preview.repository}/pull/${pullRequestNumber}` : undefined };
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
	sessionTitle,
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
	sessionTitle?: string;
	state: "working" | "awaiting-input";
	timeLabel: string;
}>): JiraIssueAgentActivity {
	const resolvedInvoker = role === "owner"
		? BUTTER_PAY_CURRENT_USER_INVOKER
		: invokedBy;

	return {
		id,
		name: agentName,
		avatarSrc,
		agentBrandName,
		cycleIntervalJitterMs,
		cycleIntervalMs,
		label,
		sessionTitle: sessionTitle ?? label,
		labels: state === "working"
			? labels ?? [label]
			: [label],
		message: message ?? (state === "working"
			? `${agentName} is working and will post the next result to the Jira work item.`
			: `${agentName} needs a person to answer before continuing.`),
		state,
		timeLabel,
		...(host !== undefined ? { host } : {}),
		...(resolvedInvoker ? { invokedBy: resolvedInvoker } : {}),
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
	invokedBy,
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
	invokedBy?: JiraIssueCompletedAgentRun["invokedBy"];
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
		...(invokedBy ? { invokedBy } : {}),
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

export const BUTTER_PAY_STATUS_PHASES = [
	"To do",
	"In progress",
	"In review",
	"Done",
] as const satisfies readonly string[];

export const BUTTER_SUGGESTION_DEMO_KEY = "PAY-999";

const PAY_BOARD_COLUMNS: readonly JiraKanbanColumnData[] = [
	{
		title: "To do",
		count: 5,
		cards: [
			createCard({
				assignee: PAY_STORY_PEOPLE.diego,
				code: "PAY-118",
				tags: [{ text: "wallet", color: "purple" }],
				title: "Carry card-artwork metadata into the next wallet epic",
			}),
			{ code: BUTTER_SUGGESTION_DEMO_KEY, title: "Improve merchant onboarding for Payments SDK v2", tags: [{ text: "onboarding", color: "blue" }], priority: "medium" },
			createCard({
				assignee: PAY_STORY_PEOPLE.priya,
				code: "PAY-124",
				priority: "major",
				tags: [{ text: "rollout", color: "blue" }],
				title: "Confirm the English-only account allow-list",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.maya,
				code: "PAY-125",
				tags: [{ text: "observability", color: "green" }],
				title: "Add production dashboards for the one-percent slice",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.jordan,
				code: "PAY-127",
				priority: "minor",
				tags: [{ text: "cleanup", color: "gray" }],
				title: "Remove the two dead v1 exports after rollout",
			}),
		],
	},
	{
		title: "In progress",
		statuses: ["In progress", "Paused"],
		count: 4,
		cards: [
			createCard({
				assignee: PAY_STORY_PEOPLE.jordan,
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
				assignee: PAY_STORY_PEOPLE.maya,
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
						avatarSrc: PAY_STORY_PEOPLE.maya.avatarSrc,
						name: PAY_STORY_PEOPLE.maya.name,
					},
					label: "Implementing webhook retry semantics",
					labels: ["Implementing webhook retry semantics", "Moving backoff into the v2 client", "Running payments API retry tests"],
					role: "viewer",
					state: "working",
					timeLabel: "Yesterday",
				})],
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.jordan,
				code: "PAY-123",
				priority: "major",
				tags: [{ text: "fixtures", color: "purple" }],
				title: "Record the three missing decline-code fixtures",
				agentActivities: [
					createActivity({
						id: "PAY-123:codex-coverage",
						agentName: "Codex",
						agentBrandName: "openai-codex",
						cycleIntervalJitterMs: 1900,
						cycleIntervalMs: 2700,
						host: "cloud",
						label: "Checking decline fixture coverage",
						labels: ["Checking decline fixture coverage", "Reviewing missing test cases"],
						role: "owner",
						state: "working",
						timeLabel: "12m",
					}),
					createActivity({
						id: "PAY-123:test-agent",
						agentName: "Cursor",
						agentBrandName: "cursor",
						cycleIntervalJitterMs: 1700,
						cycleIntervalMs: 1900,
						host: "cloud",
						invokedBy: {
							avatarSrc: PAY_STORY_PEOPLE.jordan.avatarSrc,
							name: PAY_STORY_PEOPLE.jordan.name,
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
					createActivity({
						id: "PAY-123:maya-claude",
						agentName: "Claude",
						agentBrandName: "claude",
						host: "cloud",
						invokedBy: PAY_STORY_PEOPLE.maya,
						label: "Reviewing decline response examples",
						role: "viewer",
						state: "working",
						timeLabel: "24m",
					}),
					createActivity({
						id: "PAY-123:diego-copilot",
						agentName: "GitHub Copilot",
						agentBrandName: "github-copilot",
						host: "cloud",
						invokedBy: PAY_STORY_PEOPLE.diego,
						label: "Checking localised decline keys",
						role: "viewer",
						state: "working",
						timeLabel: "42m",
					}),
					createActivity({
						id: "PAY-123:priya-codex",
						agentName: "Codex",
						agentBrandName: "openai-codex",
						host: "local",
						invokedBy: PAY_STORY_PEOPLE.priya,
						label: "Validating fixture replay results",
						role: "viewer",
						state: "working",
						timeLabel: "1h",
					}),
				],
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.diego,
				code: "PAY-130",
				priority: "major",
				tags: [{ text: "localisation", color: "purple" }],
				title: "Localise eleven v2 decline strings into nine languages",
				agentActivities: [
					createActivity({
						id: "PAY-130:claude-code",
						agentName: "Claude",
						agentBrandName: "claude",
						host: "cloud",
						label: "Localising decline messages",
						labels: ["Localising decline messages", "Checking language coverage", "Reviewing translated copy"],
						role: "owner",
						state: "working",
						timeLabel: "8m",
					}),
					createActivity({
						id: "PAY-130:test-agent",
						agentName: "Cursor",
						agentBrandName: "cursor",
						host: "local",
						label: "Checking localisation fixtures",
						labels: ["Checking localisation fixtures", "Comparing decline identifiers", "Running locale tests"],
						role: "owner",
						state: "working",
						timeLabel: "5m",
					}),
				],
			}),
		],
	},
	{
		title: "In review",
		count: 8,
		cards: [
			createCard({
				assignee: PAY_STORY_PEOPLE.jordan,
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
					label: "Needs the retention window",
					sessionTitle: "Review sandbox key retention",
					message: BUTTER_PAY_112_RETENTION_MESSAGE,
					question: BUTTER_PAY_112_RETENTION_QUESTION,
					role: "owner",
					state: "awaiting-input",
					timeLabel: "Last week",
				})],
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.priya,
				code: "PAY-115",
				tags: [{ text: "release note", color: "blue" }],
				title: "Rewrite the customer ship note after the wallet cut",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.maya,
				code: "PAY-119",
				pullRequestNumber: 1880,
				pullRequestStatus: "open",
				tags: [{ text: "runbook", color: "teal" }],
				title: "Publish and link the rollback rehearsal runbook",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.diego,
				code: "PAY-132",
				priority: "minor",
				tags: [{ text: "copy", color: "purple" }],
				title: "Approve the final issuer-unavailable recovery message",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.jordan,
				code: "PAY-104",
				priority: "major",
				pullRequestNumber: 1851,
				pullRequestStatus: "open",
				tags: [{ text: "checkout-web", color: "blue" }],
				title: "Port createPaymentIntent onto the v2 client",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.maya,
				code: "PAY-109",
				pullRequestNumber: 1863,
				pullRequestStatus: "open",
				tags: [{ text: "codegen", color: "gray" }],
				title: "Regenerate webhook payloads from the v2 OpenAPI spec",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.priya,
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
				assignee: PAY_STORY_PEOPLE.maya,
				code: "PAY-128",
				priority: "major",
				pullRequestNumber: 1881,
				pullRequestStatus: "open",
				tags: [{ text: "ledger-sync", color: "teal" }],
				title: "Stamp SDK version at settlement for finance exports",
				agentActivities: [
					createActivity({
						id: "PAY-128:review-agent",
						agentName: "Codex",
						agentBrandName: "openai-codex",
						host: "cloud",
						label: "Reviewing settlement exports",
						labels: ["Reviewing settlement exports", "Checking SDK version fields", "Comparing finance records"],
						role: "owner",
						state: "working",
						timeLabel: "14m",
					}),
					createActivity({
						id: "PAY-128:claude-code",
						agentName: "Claude",
						agentBrandName: "claude",
						host: "local",
						label: "Verifying settlement version stamps",
						labels: ["Verifying settlement version stamps", "Checking export mappings", "Running settlement tests"],
						role: "owner",
						state: "working",
						timeLabel: "6m",
					}),
				],
			}),
		],
	},
	{
		title: "Done",
		count: 4,
		cards: [
			createCard({
				assignee: PAY_STORY_PEOPLE.jordan,
				code: "PAY-101",
				priority: "major",
				pullRequestNumber: BUTTER_PAY_101_PULL_REQUEST_NUMBER,
				pullRequestStatus: "merged",
				tags: [{ text: "discovery", color: "purple" }],
				title: "Inventory every v1 call site across services and name an owner for each",
				agentActivityMode: "completed",
				agentDoneRuns: [createCompletedRun({
					id: BUTTER_PAY_101_SESSION_ID,
					invokedBy: {
						name: PAY_STORY_PEOPLE.maya.name,
						avatarSrc: PAY_STORY_PEOPLE.maya.avatarSrc,
					},
					agentName: "Claude",
					agentBrandName: "claude",
					issueKey: "PAY-101",
					issueSummary: "Inventory every v1 call site across services and name an owner for each",
					description: "Mapped 61 call sites and linked the merged four-service inventory. The separate local rationale session remains uncaptured.",
					outputs: [PAY_101_INVENTORY_PR_ARTIFACT, PAY_101_INVENTORY_COMMIT_ARTIFACT],
					pullRequestNumber: BUTTER_PAY_101_PULL_REQUEST_NUMBER,
					summary: "Captured inventory run and durable evidence",
				})],
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.maya,
				code: "PAY-102",
				priority: "major",
				pullRequestNumber: 1847,
				pullRequestStatus: "merged",
				tags: [{ text: "spike", color: "teal" }, { text: "sdk", color: "blue" }],
				title: "Prove LegacyGatewayAdapter can be deleted outright",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.jordan,
				code: "PAY-113",
				pullRequestNumber: 1863,
				pullRequestStatus: "merged",
				tags: [{ text: "contract tests", color: "green" }],
				title: "Land the 3-D Secure contract suite with 214 assertions",
			}),
			createCard({
				assignee: PAY_STORY_PEOPLE.maya,
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

export function createButterPayBoardColumns(): JiraKanbanColumnData[] {
	const peopleByName: Readonly<Record<string, JiraKanbanAssigneeData>> = Object.fromEntries(
		Object.values(PAY_STORY_PEOPLE).map((person) => [person.name, person]),
	);
	const priorities = {
		Highest: "critical",
		High: "major",
		Medium: "medium",
		Low: "minor",
		Lowest: "minor",
	} as const satisfies Readonly<Record<string, JiraKanbanCardData["priority"]>>;
	const subtasks = (["PAY-118", "PAY-999", "PAY-127"] as const).flatMap((parentIssueKey) =>
		BUTTER_TODO_PLACEHOLDERS[parentIssueKey].children.map((child) => ({
			status: child.status,
			card: {
				assignee: peopleByName[child.assignee],
				code: child.key,
				dueDate: child.dueDate,
				parentIssueKey,
				priority: priorities[child.priority],
				storyPoints: child.estimate ? Number(child.estimate) : undefined,
				tags: [],
				title: child.summary,
			} satisfies JiraKanbanCardData,
		})),
	);
	return PAY_BOARD_COLUMNS.map((column) => {
		const cards = [...column.cards, ...subtasks.filter((item) => item.status === column.title).map((item) => item.card)].map((card) => ({
			...cloneBoardCard(card),
			parentIssueKey: PAY_101_SUBTASK_KEYS.some((key) => key === card.code) ? "PAY-101" : card.parentIssueKey,
		}));
		return { ...column, cards, count: cards.length };
	});
}
