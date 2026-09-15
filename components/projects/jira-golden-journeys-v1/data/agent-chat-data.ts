import {
	ROVO_AGENT_PROFILES,
	type RovoAgentProfile,
} from "@/app/data/directory/agents";
import type { CodeListItem } from "@/components/ui-custom/code-list";
import { getDeterministicAgentAvatarSrc } from "@/lib/agent-avatars";
import type { RovoMessageMetadata, RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import type { QuestionCardQuestion } from "@/components/blocks/question-card/types";
import type { AsxQueueSession } from "@/components/projects/jira-queue/data/queue-sessions";

export interface JgpAgentChatScenario {
	agentId: string;
	agentName: string;
	issueKey: string;
	issueSummary: string;
	intro?: string;
	question?: QuestionCardQuestion;
	request?: string;
	result?: string;
	skillInvocation?: RovoMessageMetadata["skillInvocation"];
}

export interface JgpAgentChatPlaybackFrame {
	delayMs: number;
	parts: RovoUIMessage["parts"];
}

export interface JgpAgentChatPlayback {
	assistantMessageId: string;
	frames: readonly JgpAgentChatPlaybackFrame[];
	userMessage: RovoUIMessage;
}

const JGP_AGENT_PROFILES = [
	{
		id: "claude-code",
		name: "Claude",
			byline: "Coding agent by Anthropic",
			brandName: "claude",
			description: "Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools.",
			starters: [],
			contextDescription: "Answer as Claude Code for the selected JGP Jira issue and pull request.",
	},
	{
		id: "cursor",
		name: "Cursor",
		byline: "Coding agent",
		brandName: "cursor",
		description: "Implements scoped Jira engineering tasks and prepares code changes for human review.",
		starters: [],
		contextDescription: "Answer as Cursor for the selected JGP Jira issue.",
	},
	{
		id: "rfp-drafter",
		name: "RFP Drafter",
		byline: "JGP demo agent by Rovo",
		avatarSrc: getDeterministicAgentAvatarSrc("rfp-drafter"),
		description: "Drafts response narratives and prepares concise RFP handoffs for review.",
		starters: [],
		contextDescription: "Answer as RFP Drafter for the selected JGP Jira issue.",
	},
	{
		id: "response-reviewer",
		name: "Response Reviewer",
		byline: "RFP review agent by Rovo",
		avatarSrc: "/avatar-agent/dev-agents/code-reviewer.svg",
		description: "Reviews enterprise responses for product, security, legal, and delivery risks before bid decisions.",
		starters: [],
		contextDescription: "Answer as Response Reviewer for the selected Jira RFP work item.",
	},
	{
		id: "service-impact-agent",
		name: "Service impact agent",
		byline: "JGP demo agent by Rovo",
		avatarSrc: "/avatar-agent/service-agents/rca-agent.svg",
		description: "Maps affected services, owners, and customer-facing impact for Jira work items.",
		starters: [],
		contextDescription: "Answer as Service impact agent for the selected JGP Jira issue.",
	},
	{
		id: "dependency-mapper",
		name: "Dependency mapper",
		byline: "JGP demo agent by Rovo",
		avatarSrc: "/avatar-agent/teamwork-agents/work-item-planner.svg",
		description: "Finds dependent components, linked work, and blocked handoffs.",
		starters: [],
		contextDescription: "Answer as Dependency mapper for the selected JGP Jira issue.",
	},
	{
		id: "unit-test-creator",
		name: "Unit Test Creator",
		byline: "JGP demo agent by Rovo",
		avatarSrc: "/avatar-agent/dev-agents/unit-test-creator.svg",
		description: "Creates focused regression coverage and review-ready test artifacts for Jira work items.",
		starters: [],
		contextDescription: "Answer as Unit Test Creator for the selected JGP Jira issue.",
	},
	{
		id: "review-agent",
		name: "Codex",
		byline: "Reviews every pull request",
		avatarSrc: "/avatar-agent/teamwork-agents/decision-director.svg",
		brandName: "openai-codex",
		description: "Confirms sandbox key retention and replay risk before the PAY-112 replay work continues.",
		starters: [],
		contextDescription: "Answer as Codex for the selected Payments SDK work item.",
	},
] as const satisfies readonly RovoAgentProfile[];

export const JGP_CLAUDE_CODE_AGENT_PROFILE: RovoAgentProfile = JGP_AGENT_PROFILES[0];

/** Static profiles supplied to the JGP-local provider so chat can select demo agents. */
export const JGP_CHAT_AGENT_PROFILES: readonly RovoAgentProfile[] = [
	...ROVO_AGENT_PROFILES,
	...JGP_AGENT_PROFILES,
];

function queueMessage(id: string, role: "assistant" | "user", text: string): RovoUIMessage {
	return { id, role, parts: [{ type: "text", text, state: "done" }] };
}

export const JGP_CODE_LIST_WIDGET_TYPE = "jgp-code-list";

export interface JgpCodeListWidgetPayload {
	items: readonly CodeListItem[];
}

const JGP_COMPLETED_CODE_ITEMS: readonly CodeListItem[] = [
	{
		id: "assignee-focus-toolbar",
		path: "src/boards/assignee-focus/assignee-focus-toolbar.tsx",
		additions: 24,
		deletions: 3,
		code: `export function AssigneeFocusToolbar({ focusedAssignee, onClearFocus }: Props) {
	return focusedAssignee ? (
		<Button appearance="subtle" onClick={onClearFocus}>
			Clear focus
		</Button>
	) : null;
}`,
	},
	{
		id: "assignee-focus-toolbar-test",
		path: "src/boards/assignee-focus/assignee-focus-toolbar.test.tsx",
		additions: 18,
		deletions: 5,
		code: `it("restores the full board without moving keyboard focus", async () => {
	await user.click(screen.getByRole("button", { name: "Clear focus" }));
	expect(screen.getAllByRole("article")).toHaveLength(12);
	expect(screen.getByRole("button", { name: "Clear focus" })).toHaveFocus();
});`,
	},
];

export const JGP_ROVO_COMPLETED_SESSION_PATCH: Readonly<Partial<AsxQueueSession>> = {
	status: "pr-open",
	jiraColumn: "Done",
	repository: "atlassian/jira-cloud",
	branch: "cursor/jgp-252-clear-focus-action",
	commit: "6f4c2ab",
	checks: { passed: 5, failed: 0 },
	fileChanges: {
		additions: 42,
		deletions: 8,
		files: JGP_COMPLETED_CODE_ITEMS.map((item) => item.path),
		isDismissed: false,
	},
	question: undefined,
};

export function parseJgpCodeListWidgetPayload(data: unknown): JgpCodeListWidgetPayload | null {
	if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items)) {
		return null;
	}
	return { items: data.items as CodeListItem[] };
}

/** Route-owned mobile Rovo snapshots for Sarah's global-session story. */
export const JGP_ROVO_SESSION_SEEDS: readonly AsxQueueSession[] = [
	{
		id: "jgp-251-persistence-question",
		spaceId: "jira-board-focus-workflows",
		agentId: "cursor",
		host: "cloud",
		issueKey: "JGP-251",
		issueSummary: "Remember assignee focus per board",
		title: "Remember assignee focus per board",
		status: "awaiting-input",
		isPinned: false,
		jiraColumn: "In progress",
		manualRank: 1,
		priority: "low",
		priorityRank: 1,
		updatedRank: 1,
		assignee: { name: "Sarah" },
		question: {
			prompt: "Should assignee focus persist when someone returns to this board?",
			questions: [{
				id: "focus-persistence",
				kind: "single-select",
				label: "How should assignee focus be remembered?",
				description: "This determines whether the saved focus follows the person or stays scoped to the current board.",
				options: [
					{ id: "per-board", label: "Remember per board", description: "Restore the last focused assignee separately for each board." },
					{ id: "global", label: "Remember everywhere", description: "Use the same focused assignee across every board." },
					{ id: "session-only", label: "Only this visit", description: "Clear focus when the board is closed." },
				],
			}],
		},
		messages: [
			queueMessage("jgp-251-user", "user", "Implement saved assignee focus for this board."),
			queueMessage("jgp-251-agent", "assistant", "I have the board preference storage ready, but one product decision changes the data scope and restore behavior."),
		],
	},
];

/** Builds the persistent, non-dismissible work-item context shown in JGP chat. */
export function buildJgpAgentChatContextBar(
	scenario: JgpAgentChatScenario,
): ChatContextBarDescriptor {
	return {
		iconName: "work-item",
		label: `${scenario.issueKey}: ${scenario.issueSummary}`,
		showDismissPlaceholder: false,
		signature: `jira-golden-journeys-v1-work-item:${scenario.issueKey}`,
	};
}

function getScenarioRequest(scenario: JgpAgentChatScenario): string {
	return scenario.request ?? `Continue working on ${scenario.issueKey}: ${scenario.issueSummary}.`;
}

function getScenarioResult(scenario: JgpAgentChatScenario): string {
	if (scenario.result) return scenario.result;

	return [
		`I finished a first pass for **${scenario.issueKey}** with the context available on the work item.`,
		"I mapped the relevant requirements, checked the linked evidence, and prepared a concise handoff for Review.",
	].join("\n\n");
}

function buildJgpQuestionCardParts(
	scenario: JgpAgentChatScenario,
	runId: string,
): RovoUIMessage["parts"] | null {
	if (!scenario.question) return null;

	const toolCallId = `jira-golden-journeys-v1-agent-question-${runId}`;
	return [
		{
			type: "text",
			text: scenario.intro ?? "I found a decision point that needs your input before I can continue with the implementation notes.",
			state: "done",
		},
		{
			type: "data-widget-data",
			data: {
				type: "question-card",
				payload: {
					type: "question-card",
					sessionId: toolCallId,
					round: 1,
					maxRounds: 1,
					title: "Answer to continue",
					requiredCount: 1,
					toolCallId,
					questions: [{ ...scenario.question, required: true }],
				},
			},
		},
	];
}

/**
 * Builds a deterministic local thinking -> generating -> completed transcript.
 * The ids vary per playback, while the visible content and timing stay stable.
 */
export function buildJgpAgentChatPlayback(
	scenario: JgpAgentChatScenario,
	runId: string,
	now = Date.now(),
): JgpAgentChatPlayback {
	const assistantMessageId = `jira-golden-journeys-v1-agent-assistant-${runId}`;
	const questionCardParts = buildJgpQuestionCardParts(scenario, runId);
	const toolCallId = `jira-golden-journeys-v1-agent-work-${runId}`;
	const startedAt = new Date(now).toISOString();
	const completedAt = new Date(now + 2_400).toISOString();
	const thinkingStatus = {
		type: "data-thinking-status" as const,
		data: {
			label: `Reviewing ${scenario.issueKey}`,
			content: `${scenario.agentName} is reading the issue context and connected work before preparing an update.`,
			toolCallId,
			activity: "data" as const,
			source: "fallback" as const,
			timestamp: startedAt,
		},
	};
	const toolStart = {
		type: "data-thinking-event" as const,
		id: `${toolCallId}-start`,
		data: {
			eventId: `${toolCallId}-start`,
			phase: "start" as const,
			toolName: "jira.read_work_item_context",
			label: "Reading the work item and linked context",
			toolCallId,
			input: { issueKey: scenario.issueKey, summary: scenario.issueSummary },
			timestamp: startedAt,
		},
	};
	const toolResult = {
		type: "data-thinking-event" as const,
		id: `${toolCallId}-result`,
		data: {
			eventId: `${toolCallId}-result`,
			phase: "result" as const,
			toolName: "jira.read_work_item_context",
			label: "Reading the work item and linked context",
			toolCallId,
			output: { status: "ready-for-handoff", issueKey: scenario.issueKey },
			outputPreview: "Issue context reviewed and handoff prepared.",
			timestamp: completedAt,
		},
	};
	const result = getScenarioResult(scenario);

	return {
		assistantMessageId,
		userMessage: {
			id: `jira-golden-journeys-v1-agent-user-${runId}`,
			metadata: scenario.skillInvocation ? {
				source: "jira-issue-generative-action",
				skillInvocation: scenario.skillInvocation,
			} : undefined,
			role: "user",
			parts: [{ type: "text", text: getScenarioRequest(scenario), state: "done" }],
		},
		frames: questionCardParts ? [{ delayMs: 0, parts: questionCardParts }] : [
			{ delayMs: 0, parts: [thinkingStatus] },
			{ delayMs: 700, parts: [thinkingStatus, toolStart] },
			{
				delayMs: 900,
				parts: [thinkingStatus, toolStart, { type: "text", text: result.split("\n\n")[0] ?? result, state: "streaming" }],
			},
			{
				delayMs: 800,
				parts: [thinkingStatus, toolStart, toolResult, { type: "text", text: result, state: "done" }],
			},
		],
	};
}

/**
 * Continues the blocked Cursor session after the required choice is submitted.
 * It deliberately reuses the standard JGP thinking frames and delays, then
 * appends route-owned generated files for the shared CodeList renderer.
 */
export function buildJgpRovoContinuationPlayback(
	runId: string,
	now = Date.now(),
): JgpAgentChatPlayback {
	const playback = buildJgpAgentChatPlayback({
		agentId: "cursor",
		agentName: "Cursor",
		issueKey: "JGP-252",
		issueSummary: "Add a Clear focus action",
		result: "I added the Clear focus action, kept keyboard focus stable, and updated the focused tests. The changes are ready to review before creating a pull request.",
	}, runId, now);
	const finalFrameIndex = playback.frames.length - 1;

	return {
		...playback,
		frames: playback.frames.map((frame, index) => {
			if (index !== finalFrameIndex) return frame;

			return {
				...frame,
				parts: [
					...frame.parts,
					{
						type: "data-widget-data" as const,
						data: {
							type: JGP_CODE_LIST_WIDGET_TYPE,
							payload: { items: JGP_COMPLETED_CODE_ITEMS },
						},
					},
				],
			};
		}),
	};
}
