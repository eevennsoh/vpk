import { getRovoAgentProfile, type RovoAgentProfile } from "@/app/data/directory/agents";
import { STARRED_PROJECTS } from "@/components/blocks/product-sidebar/data/jira-navigation";
import type {
	JiraSidebarSessionChecks,
	JiraSidebarSessionItem,
} from "@/components/blocks/product-sidebar/variants/jira";
import type { QuestionCardQuestion } from "@/components/blocks/question-card/types";
import type { RovoAppThread } from "@/lib/rovo-app-types";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

export type AsxQueueSessionStatus =
	| "awaiting-input"
	| "running"
	| "pr-open"
	| "merged"
	| "stopped";

export type AsxQueueSessionHost = "cloud" | "local";

export type AsxQueueJiraColumn = "To do" | "In progress" | "In review" | "Done";

export type AsxQueueLayoutMode = "by-project" | "one-list";

export type AsxQueueSortMode = "priority" | "last-updated" | "manual";

export interface AsxQueueFileChanges {
	additions: number;
	deletions: number;
	files: readonly string[];
	isDismissed: boolean;
}

export interface AsxQueueQuestion {
	prompt: string;
	questions: readonly QuestionCardQuestion[];
}

export interface AsxQueueAssignee {
	name: string;
	src?: string;
}

export type AsxQueueWorkItemPriority = "highest" | "high" | "medium" | "low" | "lowest";

export interface AsxQueueSession {
	agentId: string;
	/** Human accountable for the Jira work item (shown in the work-item smart link). */
	assignee?: AsxQueueAssignee;
	/** Human who started the agent session (shown beside the flyout timestamp). */
	invokedBy?: AsxQueueAssignee;
	branch?: string;
	checks?: JiraSidebarSessionChecks;
	commit?: string;
	fileChanges?: AsxQueueFileChanges;
	host: AsxQueueSessionHost;
	id: string;
	isPinned: boolean;
	issueKey: string;
	issueSummary: string;
	jiraColumn: AsxQueueJiraColumn;
	manualRank: number;
	messages: RovoUIMessage[];
	/** Jira work-item priority (shown in the work-item smart link). */
	priority?: AsxQueueWorkItemPriority;
	priorityRank: number;
	pullRequestAuthor?: AsxQueueAssignee;
	pullRequestDescription?: string;
	pullRequestNumber?: number;
	pullRequestTitle?: string;
	question?: AsxQueueQuestion;
	repository?: string;
	/** Branch the PR merges into (e.g. `main`). */
	targetBranch?: string;
	spaceId: string;
	status: AsxQueueSessionStatus;
	title: string;
	updatedRank: number;
	worktreePath?: string;
}

function message(id: string, role: "assistant" | "user", text: string): RovoUIMessage {
	return {
		id,
		role,
		parts: [{ type: "text", text, state: "done" }],
	};
}

const ASX_QUEUE_INVOKER: AsxQueueAssignee = {
	name: "Jordan Lee",
	src: "/avatar-user/andrew-park/color/asow-dev-lime.png",
};

/**
 * Builds the trailing chain-of-thought message for a "running" session: two
 * completed tool steps plus a final tool call that stays pending. Because there
 * is no `data-turn-complete` part, the final "start"-only tool event never
 * resolves. It is the LAST assistant message in the turn — rendered after the
 * typed response so the words appear first — and the workspace's `isStreaming`
 * signal keeps its header animating: a perpetual live snapshot with no timers.
 */
function runningThinkingMessage(id: string): RovoUIMessage {
	return {
		id,
		role: "assistant",
		parts: [
			{
				type: "data-thinking-status",
				data: {
					label: "Working",
					content:
						"Cross-checking the Q3 pricing exceptions against the approved discount matrix before updating the readiness score.",
					toolCallId: "rfp-104-work",
					activity: "data",
					source: "fallback",
					timestamp: "2026-07-17T02:10:00.000Z",
				},
			},
			{
				type: "data-thinking-event",
				id: "rfp-104-read-start",
				data: {
					eventId: "rfp-104-read-start",
					phase: "start",
					toolName: "jira.read_work_item_context",
					label: "Reading the work item and linked context",
					toolCallId: "rfp-104-read",
					timestamp: "2026-07-17T02:10:01.000Z",
				},
			},
			{
				type: "data-thinking-event",
				id: "rfp-104-read-result",
				data: {
					eventId: "rfp-104-read-result",
					phase: "result",
					toolName: "jira.read_work_item_context",
					label: "Reading the work item and linked context",
					toolCallId: "rfp-104-read",
					outputPreview: "Work item and linked pricing context reviewed.",
					timestamp: "2026-07-17T02:10:03.000Z",
				},
			},
			{
				type: "data-thinking-event",
				id: "rfp-104-pricing-start",
				data: {
					eventId: "rfp-104-pricing-start",
					phase: "start",
					toolName: "finance.pull_pricing_tables",
					label: "Pulling the Q3 pricing tables",
					toolCallId: "rfp-104-pricing",
					timestamp: "2026-07-17T02:10:04.000Z",
				},
			},
			{
				type: "data-thinking-event",
				id: "rfp-104-pricing-result",
				data: {
					eventId: "rfp-104-pricing-result",
					phase: "result",
					toolName: "finance.pull_pricing_tables",
					label: "Pulling the Q3 pricing tables",
					toolCallId: "rfp-104-pricing",
					outputPreview: "Loaded 42 pricing rows with 6 flagged exceptions.",
					timestamp: "2026-07-17T02:10:06.000Z",
				},
			},
			{
				type: "data-thinking-event",
				id: "rfp-104-approval-start",
				data: {
					eventId: "rfp-104-approval-start",
					phase: "start",
					toolName: "finance.check_discount_matrix",
					label: "Running approval checks",
					toolCallId: "rfp-104-approval",
					timestamp: "2026-07-17T02:10:07.000Z",
				},
			},
		],
	};
}

export const ASX_QUEUE_SPACES = STARRED_PROJECTS;

export const ASX_QUEUE_SESSION_SEEDS: readonly AsxQueueSession[] = [
	{
		id: "acme-qualification",
		spaceId: "enterprise-rfp-qualification",
		agentId: "readiness-checker",
		host: "cloud",
		issueKey: "RFP-101",
		issueSummary: "Acme procurement questionnaire",
		title: "Confirm Acme rollout plan",
		status: "awaiting-input",
		isPinned: false,
		jiraColumn: "In progress",
		manualRank: 1,
		priority: "high",
		priorityRank: 1,
		updatedRank: 2,
		assignee: { name: "Priya Hansra", src: "/avatar-user/priya-hansra/color/asow-service-yellow.png" },
		invokedBy: ASX_QUEUE_INVOKER,
		repository: "acme-corp/rfp-response-platform",
		question: {
			prompt: "What target go-live date should I use for the readiness assessment?",
			questions: [
				{
					id: "target-go-live-date",
					kind: "single-select",
					label: "What is the target go-live date?",
					description: "I need the customer-approved date to finish the delivery risk score.",
					options: [
						{
							id: "october-15",
							label: "15 October 2026",
							description: "Use the launch date requested in the customer timeline.",
						},
						{
							id: "november-1",
							label: "1 November 2026",
							description: "Add a two-week buffer for security and deployment readiness.",
						},
						{
							id: "not-confirmed",
							label: "Date not confirmed",
							description: "Finish the assessment with the schedule risk clearly flagged.",
						},
					],
					placeholder: "Enter another date or add context",
				},
			],
		},
		messages: [
			message(
				"acme-user-1",
				"user",
				"Can you review the Acme procurement questionnaire, validate every response owner, and flag anything that blocks qualification?",
			),
			message(
				"acme-agent-1",
				"assistant",
				[
					"I completed the qualification review across all 78 response items and reconciled them against the approved answer library, evidence register, and owner matrix.",
					"",
					"**Qualification summary**",
					"- **Commercial:** All 24 responses are complete. The non-standard pricing exception is assigned to Priya Shah in Finance and is within the approved discount threshold.",
					"- **Security:** All 18 mandatory controls have current evidence for SOC 2, ISO 27001, encryption, incident response, access management, and business continuity.",
					"- **Privacy and residency:** The Australian data residency response is supported by the latest APAC hosting letter. Subprocessor and retention statements match the signed DPA.",
					"- **Implementation:** The delivery approach, migration responsibilities, and support model are ready. Every response section has a named accountable owner.",
					"",
					"**Items needing attention**",
					"- The DPA counter-signature is still pending, but it can remain a tracked follow-up and does not block qualification.",
					"- The rollout plan says ‘Q4 2026’ without a customer-approved go-live date. This is the only remaining input that changes the implementation risk score.",
					"",
					"**Recommendation**",
					"Proceed as conditionally qualified. Once you confirm the target date below, I can finalize the readiness score, update the implementation response, and close the remaining qualification action.",
				].join("\n"),
			),
		],
	},
	{
		id: "northstar-evidence-pr",
		spaceId: "enterprise-rfp-qualification",
		agentId: "pipeline-troubleshooter",
		host: "local",
		issueKey: "RFP-102",
		issueSummary: "Northstar security evidence automation",
		title: "Automate Northstar security evidence",
		status: "pr-open",
		isPinned: false,
		jiraColumn: "Done",
		manualRank: 2,
		priority: "medium",
		priorityRank: 2,
		updatedRank: 1,
		assignee: { name: "Darius Pavri", src: "/avatar-user/darius-pavri/color/asow-strategy-orange.png" },
		invokedBy: ASX_QUEUE_INVOKER,
		repository: "acme-corp/rfp-response-platform",
		branch: "rovo/rfp-102-evidence-sync",
		targetBranch: "main",
		worktreePath: "~/src/rfp-response-platform/.worktrees/rfp-102",
		pullRequestNumber: 1847,
		pullRequestTitle: "RFP-102 Automate Northstar security evidence",
		pullRequestDescription:
			"## Summary - Automate Northstar security evidence collection with owner resolution, proof-link validation, and a no-write dry-run.",
		commit: "7d3a91c",
		checks: { passed: 2, failed: 1 },
		fileChanges: {
			additions: 148,
			deletions: 37,
			files: [
				"src/evidence/collect-security-controls.ts",
				"src/evidence/map-control-owners.ts",
				"src/evidence/__tests__/collect-security-controls.test.ts",
				"docs/rfp/northstar-security-evidence.md",
			],
			isDismissed: false,
		},
		messages: [
			message(
				"northstar-user-1",
				"user",
				"Can you automate the Northstar security evidence collection so reviewers can refresh control owners and proof links before submission?",
			),
			message(
				"northstar-agent-1",
				"assistant",
				[
					"I implemented the evidence refresh workflow on branch **rovo/rfp-102-evidence-sync** and opened pull request **#1847**.",
					"",
					"**What changed**",
					"- Added a collector for the 37 in-scope SOC 2 and ISO 27001 controls. It normalizes control IDs before matching them to questionnaire responses.",
					"- Added owner resolution that preserves manual overrides while filling missing owners from the security responsibility matrix.",
					"- Added proof-link validation for missing, expired, and superseded evidence, with a clear reason attached to every rejected link.",
					"- Added a no-write dry-run mode that reports proposed owner and evidence changes before anything is updated.",
					"- Added reviewer documentation covering the refresh command, expected summary, manual override behavior, and rollback steps.",
					"",
					"**Validation**",
					"- Regression coverage includes duplicate control IDs, missing owners, expired links, manual overrides, and dry-run output.",
					"- Lint, unit tests, and typecheck pass locally.",
					"- Two of three pull-request checks pass; one failing check remains.",
					"",
					"**Delivery status**",
					"PR #1847 contains four changed files with **148 additions** and **37 deletions**. It is ready for review; the Jira transition is set to **Done** by default and can be changed from the context bar below.",
				].join("\n"),
			),
		],
	},
	{
		id: "security-evidence-merged",
		spaceId: "enterprise-rfp-qualification",
		agentId: "code-reviewer",
		host: "local",
		issueKey: "RFP-103",
		issueSummary: "Security response validation",
		title: "Validate security response evidence",
		status: "merged",
		isPinned: false,
		jiraColumn: "Done",
		manualRank: 3,
		priority: "highest",
		priorityRank: 3,
		updatedRank: 3,
		assignee: { name: "Olivia Yang", src: "/avatar-user/olivia-yang/color/asow-service-yellow.png" },
		invokedBy: ASX_QUEUE_INVOKER,
		repository: "acme-corp/rfp-response-platform",
		branch: "rovo/rfp-103-response-validation",
		targetBranch: "main",
		worktreePath: "~/src/rfp-response-platform/.worktrees/rfp-103",
		pullRequestNumber: 1842,
		pullRequestTitle: "RFP-103 Validate security response evidence",
		pullRequestDescription:
			"## Summary - Add validation for missing, superseded, and unowned security evidence so every finding is actionable.",
		commit: "2f6bc84",
		checks: { passed: 6, failed: 0 },
		fileChanges: {
			additions: 92,
			deletions: 18,
			files: [
				"src/validation/security-response.ts",
				"src/validation/__tests__/security-response.test.ts",
				"docs/rfp/security-response-evidence.md",
			],
			isDismissed: false,
		},
		messages: [
			message(
				"security-user-1",
				"user",
				"Can you add validation for missing security evidence and make every finding actionable for the response owners?",
			),
			message(
				"security-agent-1",
				"assistant",
				[
					"I completed the validator update and merged pull request **#1842** after Security Engineering approval.",
					"",
					"**What the audit found**",
					"- Nine mandatory responses were missing an evidence citation.",
					"- Four responses referenced superseded policy or certification documents.",
					"- Three findings had no accountable owner in the response matrix.",
					"- Duplicate citations made two response sections appear complete even though they pointed to the same proof document.",
					"",
					"**What changed**",
					"- Findings are grouped by accountable owner and response section instead of appearing as one flat error list.",
					"- Missing mandatory evidence blocks submission; optional evidence remains visible as a warning.",
					"- Every finding includes a direct link to the affected response and explains the action required to clear it.",
					"- Owner fallback uses the security responsibility matrix when a response-specific owner is absent.",
					"- The sample report separates blockers from warnings so pursuit leads can assess submission readiness immediately.",
					"",
					"**Validation and delivery**",
					"Six focused regression tests cover missing evidence, optional warnings, duplicate citations, stale versions, owner fallback, and deep links. The full suite and all six PR checks passed. The merged change updates three files with **92 additions** and **18 deletions**, and the response-owner guide now documents how to resolve each finding.",
				].join("\n"),
			),
		],
	},
	{
		id: "pricing-exception-review",
		spaceId: "enterprise-rfp-qualification",
		agentId: "deal-desk-reviewer",
		host: "cloud",
		issueKey: "RFP-104",
		issueSummary: "Q3 pricing exception review",
		title: "Validate Q3 pricing exceptions",
		status: "running",
		isPinned: false,
		jiraColumn: "In progress",
		manualRank: 4,
		priority: "low",
		priorityRank: 4,
		updatedRank: 4,
		assignee: { name: "Michael Chu", src: "/avatar-user/michael-chu/color/asow-service-yellow.png" },
		invokedBy: ASX_QUEUE_INVOKER,
		repository: "acme-corp/rfp-response-platform",
		messages: [
			message(
				"pricing-user-1",
				"user",
				"Can you validate the Q3 pricing exceptions and confirm every non-standard discount has an accountable owner before we submit?",
			),
			message(
				"pricing-agent-1",
				"assistant",
				[
					"I'm partway through validating the Q3 pricing exceptions. Here is what I've confirmed so far while the final approval check runs.",
					"",
					"**Exceptions reviewed**",
					"- 4 of the 6 flagged discounts sit within the approved threshold and already have an accountable owner recorded in the deal desk matrix.",
					"- 2 exceptions exceed the standard discount band, so they need explicit finance sign-off before they can ship in the response.",
					"",
					"**Owners confirmed**",
					"- Enterprise tier: Priya Shah (Finance) owns the non-standard pricing note and the volume discount rationale.",
					"- Public sector tier: the discount is currently unassigned, so I'm matching it against the responsibility matrix now.",
					"",
					"**Still in progress**",
					"I'm running the approval-matrix check on the two out-of-band exceptions to confirm whether they clear automatically or require a manual finance approval before I finalize the owner list.",
				].join("\n"),
			),
			runningThinkingMessage("pricing-agent-2"),
		],
	},
];

const ASX_QUEUE_HISTORY_UPDATED_AT: Readonly<Record<string, string>> = {
	"pricing-exception-review": "2026-07-17T03:00:00.000Z",
	"acme-qualification": "2026-07-17T00:30:00.000Z",
	"northstar-evidence-pr": "2026-07-16T01:15:00.000Z",
	"security-evidence-merged": "2026-07-15T02:45:00.000Z",
};

function getAsxQueueHistoryMessages(session: AsxQueueSession): RovoUIMessage[] {
	const question = session.question;
	const lastAssistantMessage = session.messages.findLast((item) => item.role === "assistant");
	if (!question || !lastAssistantMessage) return [...session.messages];

	const toolCallId = `asx-queue-question-${session.id}`;
	return session.messages.map((item) => (
		item.id === lastAssistantMessage.id
			? {
				...item,
				parts: [
					...item.parts,
					{
						type: "data-widget-data",
						data: {
							type: "question-card",
							payload: {
								type: "question-card",
								maxRounds: 1,
								questions: question.questions.map((item) => ({ ...item, required: true })),
								requiredCount: question.questions.length,
								round: 1,
								sessionId: toolCallId,
								title: "Answer to continue",
								toolCallId,
							},
						},
					},
				],
			}
			: item
	));
}

export function createAsxQueueHistoryThreads(
	sessions: readonly AsxQueueSession[],
): RovoAppThread[] {
	return sessions.map((session) => {
		const updatedAt = ASX_QUEUE_HISTORY_UPDATED_AT[session.id] ?? "2026-07-14T00:00:00.000Z";
		return {
			activeDocumentId: null,
			createdAt: updatedAt,
			id: session.id,
			messages: getAsxQueueHistoryMessages(session),
			modelId: null,
			provider: null,
			realtimeMessages: [],
			sessionId: null,
			sessionMode: null,
			title: session.title,
			updatedAt,
			visibility: "private",
		};
	});
}

/** Demo timing that preserves the flyout's previous relative-time labels. */
const QUEUE_SESSION_TIMING: Readonly<
	Record<
		AsxQueueSessionStatus,
		Pick<JiraSidebarSessionItem, "completedSecondsAgo" | "initialElapsedSeconds">
	>
> = {
	"awaiting-input": { completedSecondsAgo: undefined, initialElapsedSeconds: 2 * 24 * 60 * 60 },
	running: { completedSecondsAgo: undefined, initialElapsedSeconds: 3 * 60 },
	"pr-open": { completedSecondsAgo: 60 * 60, initialElapsedSeconds: undefined },
	merged: { completedSecondsAgo: 5 * 60 * 60, initialElapsedSeconds: undefined },
	stopped: { completedSecondsAgo: 24 * 60 * 60, initialElapsedSeconds: undefined },
};

export function createAsxQueueSidebarSessionItem(
	session: AsxQueueSession,
): JiraSidebarSessionItem {
	const agent = getAsxQueueAgent(session.agentId);
	return {
		...QUEUE_SESSION_TIMING[session.status],
		additions: session.fileChanges?.additions,
		agentAvatarSrc: agent.avatarSrc,
		agentName: agent.name,
		assignee: session.assignee,
		invokedBy: session.invokedBy,
		branch: session.branch,
		checks: session.checks,
		commit: session.commit,
		deletions: session.fileChanges?.deletions,
		files: session.fileChanges?.files.length,
		host: session.host,
		id: session.id,
		issueKey: session.issueKey,
		issueSummary: session.issueSummary,
		priority: session.priority,
		pullRequestAuthor: session.pullRequestAuthor ?? session.invokedBy,
		pullRequestDescription: session.pullRequestDescription,
		pullRequestNumber: session.pullRequestNumber,
		pullRequestTitle: session.pullRequestTitle,
		repository: session.repository,
		targetBranch: session.targetBranch,
		status: session.status,
		title: session.title,
		worktreePath: session.worktreePath,
	};
}

/**
 * ASX-local agent profiles that are not in the shared Rovo directory. Keeps
 * demo-only personas (e.g. the Deal Desk Reviewer used by the running session)
 * scoped to the queue instead of polluting the global agent catalog.
 */
const ASX_QUEUE_LOCAL_AGENTS: Readonly<Record<string, RovoAgentProfile>> = {
	"deal-desk-reviewer": {
		id: "deal-desk-reviewer",
		name: "Deal Desk Reviewer",
		byline: "Agent by Rovo",
		avatarSrc: "/avatar-agent-new/purple/pitch-perfector.svg",
		description:
			"Reviews non-standard pricing and discount exceptions and confirms an accountable owner before a response goes out.",
		starters: [],
		contextDescription: "Answer as Deal Desk Reviewer for the selected ASX Jira issue.",
	},
};

export function getAsxQueueAgent(agentId: string): RovoAgentProfile {
	return ASX_QUEUE_LOCAL_AGENTS[agentId] ?? getRovoAgentProfile(agentId);
}
