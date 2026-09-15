import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
} from "@/components/blocks/jira-issue";
import type {
	JiraKanbanAgentData,
	JiraKanbanAssigneeData,
	JiraKanbanCardData,
	JiraKanbanColumnData,
} from "@/components/blocks/jira-kanban";
import type { ArtifactListItem } from "@/components/ui-custom/artifact-list";

import {
	JIRA_GOLDEN_JOURNEYS_V3_PAY_101_SESSION_ID,
	JIRA_GOLDEN_JOURNEYS_V3_PAY_101_PULL_REQUEST_NUMBER,
	PAY_101_INVENTORY_COMMIT_ARTIFACT,
	PAY_101_INVENTORY_PR_ARTIFACT,
} from "./presentation-build";

const PAY_AVATARS = {
	diego: "/avatar-user/dev-rana/color/asow-product-purple.png",
	jordan: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
	maya: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
	priya: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
	releaseAgent: "/avatar-agent/strategy-agents/strategic-insight.svg",
	reviewAgent: "/avatar-agent/teamwork-agents/decision-director.svg",
	testAgent: "/avatar-agent/service-agents/rca-agent.svg",
	venn: "/avatar-user/venn/venn.png",
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

export const JIRA_GOLDEN_JOURNEYS_V3_PAY_BOARD_AGENTS = [
	{
		id: "claude-code",
		name: "Claude",
		byline: "Coding agent by Anthropic",
		brandName: "claude",
	},
	{
		id: "review-agent",
		name: "Review Agent",
		byline: "Reviews every pull request",
		avatarSrc: PAY_AVATARS.reviewAgent,
	},
	{
		id: "test-agent",
		name: "Test Author Agent",
		byline: "Writes and repairs tests",
		avatarSrc: PAY_AVATARS.testAgent,
	},
	{
		id: "release-agent",
		name: "Release Captain Agent",
		byline: "Owns the flag and rollout",
		avatarSrc: PAY_AVATARS.releaseAgent,
	},
] as const satisfies readonly JiraKanbanAgentData[];

export const JIRA_GOLDEN_JOURNEYS_V3_PAY_COMPOSER_AGENTS = [
	{
		id: "claude-code",
		name: "Claude",
		byline: "Coding agent by Anthropic",
		brandName: "claude",
	},
	{
		id: "review-agent",
		name: "Review Agent",
		byline: "Reviews every pull request",
		avatarSrc: PAY_AVATARS.reviewAgent,
	},
	{
		id: "test-agent",
		name: "Test Author Agent",
		byline: "Writes and repairs tests",
		avatarSrc: PAY_AVATARS.testAgent,
	},
	{
		id: "release-agent",
		name: "Release Captain Agent",
		byline: "Owns the flag and rollout",
		avatarSrc: PAY_AVATARS.releaseAgent,
	},
] as const satisfies readonly AgentSelectorAgent[];

export const JIRA_GOLDEN_JOURNEYS_V3_PAY_HEADER_ASSIGNEES = [
	{
		id: "venn",
		name: "Venn",
		avatarSrc: PAY_AVATARS.venn,
	},
	{
		id: "review-agent",
		name: "Review Agent",
		avatarSrc: PAY_AVATARS.reviewAgent,
	},
	{
		id: "test-agent",
		name: "Test Author Agent",
		avatarSrc: PAY_AVATARS.testAgent,
	},
	{
		id: "release-agent",
		name: "Release Captain Agent",
		avatarSrc: PAY_AVATARS.releaseAgent,
	},
] as const satisfies readonly JiraKanbanAssigneeData[];

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
	id,
	label,
	labels,
	state,
}: Readonly<{
	agentBrandName?: JiraIssueAgentActivity["agentBrandName"];
	agentName: string;
	avatarSrc?: string;
	cycleIntervalJitterMs?: number;
	cycleIntervalMs?: number;
	id: string;
	label: string;
	labels?: readonly string[];
	state: "working" | "awaiting-input";
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
		message: state === "working"
			? `${agentName} is working and will post the next result to the Jira work item.`
			: `${agentName} needs a person to answer before continuing.`,
		state,
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

export const JIRA_GOLDEN_JOURNEYS_V3_PAY_STATUS_PHASES = [
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
					agentName: "Test Author Agent",
					avatarSrc: PAY_AVATARS.testAgent,
					cycleIntervalJitterMs: 1800,
					cycleIntervalMs: 2600,
					label: "Replaying 3-D Secure fixtures",
					labels: ["Replaying 3-D Secure fixtures", "Comparing challenge payloads", "Running checkout recovery cases"],
					state: "working",
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
					label: "Implementing webhook retry semantics",
					labels: ["Implementing webhook retry semantics", "Moving backoff into the v2 client", "Running payments API retry tests"],
					state: "working",
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
						agentName: "Test Author Agent",
						avatarSrc: PAY_AVATARS.testAgent,
						cycleIntervalJitterMs: 1700,
						cycleIntervalMs: 1900,
						label: "Recording decline-code fixtures",
						labels: ["Recording decline-code fixtures", "Comparing missing decline cases", "Running fixture coverage"],
						state: "working",
					}),
					createActivity({
						id: "PAY-123:claude-code",
						agentName: "Claude",
						agentBrandName: "claude",
						cycleIntervalJitterMs: 2100,
						cycleIntervalMs: 2400,
						label: "Wiring recorded fixtures into the v2 client",
						labels: ["Wiring recorded fixtures into the v2 client", "Adapting client assertions", "Running v2 client tests"],
						state: "working",
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
					agentName: "Review Agent",
					avatarSrc: PAY_AVATARS.reviewAgent,
					label: "Needs the retention window",
					state: "awaiting-input",
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
					agentName: "Release Captain Agent",
					avatarSrc: PAY_AVATARS.releaseAgent,
					cycleIntervalJitterMs: 2400,
					cycleIntervalMs: 3600,
					label: "Validating one-percent targeting",
					labels: ["Validating one-percent targeting", "Checking account kill-switch rules", "Reviewing release telemetry gates"],
					state: "working",
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
				pullRequestNumber: JIRA_GOLDEN_JOURNEYS_V3_PAY_101_PULL_REQUEST_NUMBER,
				pullRequestStatus: "merged",
				tags: [{ text: "discovery", color: "purple" }],
				title: "Inventory every v1 call site across services and name an owner for each",
				agentActivityMode: "completed",
				agentDoneRuns: [createCompletedRun({
					id: JIRA_GOLDEN_JOURNEYS_V3_PAY_101_SESSION_ID,
					agentName: "Claude",
					agentBrandName: "claude",
					issueKey: "PAY-101",
					issueSummary: "Inventory every v1 call site across services and name an owner for each",
					description: "Mapped 61 call sites and linked the merged four-service inventory. The separate local rationale session remains uncaptured.",
					outputs: [PAY_101_INVENTORY_PR_ARTIFACT, PAY_101_INVENTORY_COMMIT_ARTIFACT],
					pullRequestNumber: JIRA_GOLDEN_JOURNEYS_V3_PAY_101_PULL_REQUEST_NUMBER,
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
		agentDoneRuns: card.agentDoneRuns?.map((run) => ({
			...run,
			outputs: run.outputs?.map((output) => ({
				...output,
				pullRequest: output.pullRequest ? { ...output.pullRequest } : undefined,
			})),
		})),
	};
}

export function createJiraGoldenJourneysV3PayBoardColumns(): JiraKanbanColumnData[] {
	return PAY_BOARD_COLUMNS.map((column) => ({
		...column,
		cards: column.cards.map(cloneBoardCard),
	}));
}
