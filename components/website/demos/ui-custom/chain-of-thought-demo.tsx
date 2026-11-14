"use client";

import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtImage,
	ChainOfThoughtSearchResult,
	ChainOfThoughtSearchResults,
	ChainOfThoughtScenario,
	ChainOfThoughtStep,
} from "@/components/ui-custom/chain-of-thought";
import { TwgTool, type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { renderResolvedToolIcon, resolveToolIcon } from "@/components/projects/shared/lib/tool-icon-resolver";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ui-custom/tool";
import {
	Collapsible,
	CollapsibleContent,
} from "@/components/ui/collapsible";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ImageIcon from "@atlaskit/icon/core/image";
import SearchIcon from "@atlaskit/icon/core/search";
import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { AnimatedDot } from "@/components/ui-custom/animated-dot";
import {
	getAwaitingUserResponseLabel,
	getQuestionsAnsweredLabel,
} from "@/components/ui-custom/lib/reasoning-labels";
import { resolveThinkingLabelForSurface } from "@/components/projects/shared/lib/thinking-label-policy";
import {
	buildThinkingNarrationDetailMap,
	buildThinkingNarrationMap,
	getThinkingToolCallSummaries,
	type RovoUIMessage,
	type ThinkingEventUpdate,
	type ThinkingNarrationDetailRow,
	type ThinkingToolCallSummary,
} from "@/lib/rovo-ui-messages";
import {
	getThinkingToolByline,
	getThinkingToolTitle,
} from "@/components/projects/shared/lib/thinking-tool-display";
import { cn } from "@/lib/utils";

const PROFILE_SOURCES = [
	"https://www.x.com/haydenbleasel",
	"https://www.instagram.com/haydenbleasel",
	"https://www.github.com/haydenbleasel",
] as const;

const RECENT_WORK_SOURCES = [
	"https://www.github.com/haydenbleasel",
	"https://www.dribbble.com/haydenbleasel",
] as const;

const TWG_TOOL_SOURCES = [
	{ id: "twg", label: "Teamwork Graph", provider: "twg" },
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "figma", label: "Figma", provider: "twg", name: "figma" },
] satisfies ReadonlyArray<TwgToolSource>;

type ToolIconRow = {
	category: string;
	toolName: string;
	note: string;
	mcpServer?: string;
};

const TOOL_ICON_ROWS: ReadonlyArray<ToolIconRow> = [
	{ category: "Built-in", toolName: "invoke_subagents", note: "Agent orchestration" },
	{ category: "Built-in", toolName: "get_skill", note: "Skill lookup" },
	{ category: "Built-in", toolName: "exit_plan_mode", note: "Plan handoff" },
	{ category: "Built-in", toolName: "ask_user_questions", note: "Question prompt" },
	{ category: "Built-in", toolName: "update_todo", note: "Checklist update" },
	{ category: "Built-in", toolName: "open_files", note: "Open files" },
	{ category: "Built-in", toolName: "create_file", note: "Create file" },
	{ category: "Built-in", toolName: "delete_file", note: "Delete file" },
	{ category: "Built-in", toolName: "move_file", note: "Move file" },
	{ category: "Built-in", toolName: "expand_code_chunks", note: "Expand code chunks" },
	{ category: "Built-in", toolName: "find_and_replace_code", note: "Find and replace" },
	{ category: "Built-in", toolName: "grep", note: "Search code" },
	{ category: "Built-in", toolName: "expand_folder", note: "Expand folder" },
	{ category: "Built-in", toolName: "bash", note: "Shell command" },
	{ category: "Built-in", toolName: "multi_tool_use.parallel", note: "Parallel tool execution" },

	{ category: "Fallback", toolName: "custom_internal_tool", note: "Tool fallback — wrench icon" },
	{ category: "Fallback", toolName: "mcp__custom_server__run", mcpServer: "custom-server", note: "MCP fallback — globe icon" },

	{ category: "MCP", toolName: "mcp__atlassian__invoke_tool", mcpServer: "atlassian", note: "Atlassian platform logo" },
	{ category: "MCP", toolName: "mcp__bitbucket__search_repositories", mcpServer: "bitbucket", note: "Bitbucket logo" },
	{ category: "MCP", toolName: "mcp__google_calendar__list_events", mcpServer: "google-calendar", note: "3P logo" },
	{ category: "MCP", toolName: "mcp__google_drive__search_files", mcpServer: "google-drive", note: "3P logo" },
	{ category: "MCP", toolName: "mcp__gcp__list_projects", mcpServer: "gcp", note: "MCP server" },
	{ category: "MCP", toolName: "mcp__gmail__search_messages", mcpServer: "gmail", note: "3P logo" },
	{ category: "MCP", toolName: "mcp__atlassian_tenant__get_sites", mcpServer: "atlassian-tenant", note: "Atlassian platform logo" },
	{ category: "MCP", toolName: "mcp__atlassian_project__search_issues", mcpServer: "atlassian-project", note: "Projects logo" },
	{ category: "MCP", toolName: "mcp__atlassian_goal__list_goals", mcpServer: "atlassian-goal", note: "Goals logo" },
	{ category: "MCP", toolName: "mcp__atlassian_team__search_teams", mcpServer: "atlassian-team", note: "Teams logo" },
	{ category: "MCP", toolName: "mcp__teamwork_graph__search", mcpServer: "teamwork-graph", note: "Teamwork graph" },
	{ category: "MCP", toolName: "mcp__s360__search", mcpServer: "s360", note: "S360 logo" },
	{ category: "MCP", toolName: "mcp__slack__post_message", mcpServer: "slack", note: "3P logo" },
	{ category: "MCP", toolName: "mcp__compass__find_component", mcpServer: "compass", note: "Compass logo" },
	{ category: "MCP", toolName: "mcp__talent__search_people", mcpServer: "talent", note: "Talent logo" },
	{ category: "MCP", toolName: "mcp__remote_bitbucket_search__search", mcpServer: "remote-bitbucket-search", note: "MCP server" },
	{ category: "MCP", toolName: "mcp__rovodev__run", mcpServer: "rovodev", note: "Rovodev logo" },
	{ category: "MCP", toolName: "mcp__forge_knowledge__search", mcpServer: "forge-knowledge", note: "Forge logo" },
	{ category: "MCP", toolName: "mcp__ads_mcp__ads_plan", mcpServer: "ads-mcp", note: "ADS logo" },
	{ category: "MCP", toolName: "mcp__web_search__search", mcpServer: "web-search", note: "Web search" },
	{ category: "MCP", toolName: "mcp__chrome_devtools__navigate_page", mcpServer: "chrome-devtools", note: "Google Chrome logo" },
] as const;

type ReplayMode = "normal" | "awaiting";
type StudioReplayPhase = "playing" | "awaiting" | "generating" | "completed";
type RovoMessagePart = RovoUIMessage["parts"][number];

interface StudioReplayContentRow {
	content: string;
	input?: unknown;
	output?: unknown;
	outputPreview?: string;
}

interface StudioReplayStep {
	toolName: string;
	toolCallId: string;
	label: string;
	content: string;
	input?: unknown;
	output?: unknown;
	outputPreview?: string;
	contentRows: readonly StudioReplayContentRow[];
}

type StudioReplayTimelineEntry =
	| {
		at: number;
		part: RovoMessagePart;
	}
	| {
		at: number;
		phase: StudioReplayPhase;
		duration?: number;
	};

const STUDIO_REPLAY_TOOL_CALL_DELAY_MS = 2300;
const STUDIO_REPLAY_NARRATION_ROW_DELAY_MS = 550;
const STUDIO_REPLAY_ANSWER_HOLD_MS = 1200;
const STUDIO_REPLAY_RESPONSE_HOLD_MS = 1400;
const STUDIO_REPLAY_MESSAGE_ID = "studio-agent-creation-replay";
const STUDIO_REPLAY_DESIGNING_AGENT_LABEL = "Designing agent";
const STUDIO_REPLAY_DESIGNING_AGENT_CONTENT =
	"Reviewing the brief, checking missing profile details, and shaping the Studio agent.";
const STUDIO_REPLAY_ANSWER_RESULT = "Answers received.";

const STUDIO_AGENT_CREATION_FIRST_TURN_STEPS = [
	{
		toolName: "studio.read_brief",
		toolCallId: "studio-agent-replay-turn-1-read-brief",
		label: "Reading agent brief",
		content: "Identifying the job, audience, and expected outcome for Rovo agent.",
		input: {
			prompt: "Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
		},
		outputPreview: "Agent brief captured: Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
		contentRows: [
			{
				content: "Identifying the job, audience, and expected outcome for Rovo agent.",
				input: {
					prompt: "Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
				},
				outputPreview: "Agent brief captured: Build a Rovo agent named OKR Generator that creates effective OKRs in Jira Product Discovery, reviews draft OKRs in Confluence, finds similar examples, and shares guidance for str…",
			},
			{
				content: "Parsing the brief for the core task and success criteria.",
				input: { step: "parse_task" },
				outputPreview: "Core task and success criteria extracted.",
			},
			{
				content: "Noting the intended audience and tone.",
				input: { step: "audience_tone" },
				outputPreview: "Audience and tone recorded.",
			},
			{
				content: "Flagging any constraints to respect while drafting.",
				input: { step: "constraints" },
				outputPreview: "Constraints flagged for the draft.",
			},
		],
	},
	{
		toolName: "ask_user_questions",
		toolCallId: "studio-agent-replay-turn-1-ask-questions",
		label: "Preparing clarification questions",
		content: "Asking a few targeted questions to shape Rovo agent before drafting the profile.",
		input: { round: 1 },
		contentRows: [
			{
				content: "Asking a few targeted questions to shape Rovo agent before drafting the profile.",
				input: { round: 1 },
				outputPreview: "Clarification questions ready for your input.",
			},
			{
				content: "Spotting the gaps that would change the design.",
				input: { step: "find_gaps" },
				outputPreview: "Key gaps identified.",
			},
			{
				content: "Phrasing each question to be quick to answer.",
				input: { step: "phrase_questions" },
				outputPreview: "Questions phrased concisely.",
			},
			{
				content: "Ordering questions from most to least impactful.",
				input: { step: "order_questions" },
				outputPreview: "Questions ordered by impact.",
			},
		],
	},
] as const satisfies readonly StudioReplayStep[];

const STUDIO_AGENT_CREATION_FOLLOW_UP_STEPS = [
	{
		toolName: "studio.read_brief",
		toolCallId: "studio-agent-replay-turn-2-read-brief",
		label: "Reading agent brief",
		content: "Identifying the job, audience, and expected outcome for the agent.",
		input: {
			prompt: "Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
		},
		outputPreview: "Agent brief captured: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
		contentRows: [
			{
				content: "Identifying the job, audience, and expected outcome for the agent.",
				input: {
					prompt: "Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
				},
				outputPreview: "Agent brief captured: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft in Confluence, use Jira Product Discovery examples, and keep recommend…",
			},
			{
				content: "Parsing the brief for the core task and success criteria.",
				input: { step: "parse_task" },
				outputPreview: "Core task and success criteria extracted.",
			},
			{
				content: "Noting the intended audience and tone.",
				input: { step: "audience_tone" },
				outputPreview: "Audience and tone recorded.",
			},
			{
				content: "Flagging any constraints to respect while drafting.",
				input: { step: "constraints" },
				outputPreview: "Constraints flagged for the draft.",
			},
		],
	},
	{
		toolName: "studio.review_answers",
		toolCallId: "studio-agent-replay-turn-2-review-answers",
		label: "Reviewing agent details",
		content: "Merging your latest answers into the agent profile draft.",
		input: {
			exchange: "Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
		},
		outputPreview: "Clarifications applied: Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
		contentRows: [
			{
				content: "Merging your latest answers into the agent profile draft.",
				input: {
					exchange: "Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
				},
				outputPreview: "Clarifications applied: Q: What team should the agent support, where should it draft, and which examples should it use? — A: Here are my clarification answers for \"OKR Generator\": The audience is product teams, the agent should draft…",
			},
			{
				content: "Reconciling new answers with the original brief.",
				input: { step: "reconcile" },
				outputPreview: "Answers reconciled with the brief.",
			},
			{
				content: "Resolving any conflicting preferences.",
				input: { step: "resolve_conflicts" },
				outputPreview: "Conflicting preferences resolved.",
			},
			{
				content: "Locking in the confirmed direction.",
				input: { step: "lock_direction" },
				outputPreview: "Direction confirmed.",
			},
		],
	},
	{
		toolName: "studio.select_tools",
		toolCallId: "studio-agent-replay-turn-2-select-tools",
		label: "Selecting agent tools",
		content: "Matching the requested workflow to relevant tools and skills.",
		input: { selected: ["Jira", "Confluence"] },
		outputPreview: "Agent tools matched: Jira, Confluence",
		contentRows: [
			{
				content: "Matching the requested workflow to relevant tools and skills.",
				input: { selected: ["Jira", "Confluence"] },
				outputPreview: "Agent tools matched: Jira, Confluence",
			},
			{
				content: "Scanning the brief for named integrations.",
				input: { step: "scan_integrations" },
				outputPreview: "Integrations found: Jira, Confluence.",
			},
			{
				content: "Mapping each task to a capable tool or skill.",
				input: { step: "map_tasks" },
				outputPreview: "Tasks mapped to tools and skills.",
			},
		],
	},
	{
		toolName: "studio.draft_instructions",
		toolCallId: "studio-agent-replay-turn-2-draft-instructions",
		label: "Drafting agent instructions",
		content: "Writing role, scope, and guardrails for the agent.",
		input: {
			focus: "the agent",
			hasContext: false,
		},
		outputPreview: "Instruction draft covers role, boundaries, tools, and tone.",
		contentRows: [
			{
				content: "Writing role, scope, and guardrails for the agent.",
				input: {
					focus: "the agent",
					hasContext: false,
				},
				outputPreview: "Instruction draft covers role, boundaries, tools, and tone.",
			},
			{
				content: "Defining what the agent should and shouldn't do.",
				input: { step: "define_scope" },
				outputPreview: "Scope boundaries defined.",
			},
			{
				content: "Setting the tone and response style.",
				input: { step: "set_tone" },
				outputPreview: "Tone and style set.",
			},
			{
				content: "Adding guardrails for edge cases.",
				input: { step: "add_guardrails" },
				outputPreview: "Guardrails added.",
			},
		],
	},
	{
		toolName: "studio.name_agent",
		toolCallId: "studio-agent-replay-turn-2-name-agent",
		label: "Naming agent profile",
		content: "Choosing a name, byline, and profile-card summary that match the brief.",
		input: {
			hint: "agent that draft in Confluence, use Jira Product Discovery example…",
		},
		outputPreview: "Profile naming cue: agent that draft in Confluence, use Jira Product Discovery example…",
		contentRows: [
			{
				content: "Choosing a name, byline, and profile-card summary that match the brief.",
				input: {
					hint: "agent that draft in Confluence, use Jira Product Discovery example…",
				},
				outputPreview: "Profile naming cue: agent that draft in Confluence, use Jira Product Discovery example…",
			},
			{
				content: "Brainstorming names that signal the agent's purpose.",
				input: { step: "brainstorm_names" },
				outputPreview: "Candidate names generated.",
			},
			{
				content: "Writing a one-line byline.",
				input: { step: "write_byline" },
				outputPreview: "Byline drafted.",
			},
			{
				content: "Summarizing the agent for its profile card.",
				input: { step: "summarize_card" },
				outputPreview: "Profile-card summary written.",
			},
		],
	},
	{
		toolName: "studio.save_profile",
		toolCallId: "studio-agent-replay-turn-2-save-profile",
		label: "Saving agent profile",
		content: "Persisting the agent so it shows up in your Studio library.",
		outputPreview: "Agent profile ready for Studio.",
		contentRows: [
			{
				content: "Persisting the agent so it shows up in your Studio library.",
				outputPreview: "Agent profile ready for Studio.",
			},
			{
				content: "Validating the profile before saving.",
				input: { step: "validate" },
				outputPreview: "Profile validated.",
			},
			{
				content: "Writing the agent to your Studio library.",
				input: { step: "persist" },
				outputPreview: "Agent saved to the library.",
			},
			{
				content: "Confirming it's ready to use.",
				input: { step: "confirm" },
				outputPreview: "Agent ready to use.",
			},
		],
	},
] as const satisfies readonly StudioReplayStep[];

const toHostname = (url: string) => new URL(url).hostname;

function getReplayStepStatus(state: ThinkingToolCallSummary["state"]): "complete" | "active" | "pending" {
	if (state === "running" || state === "awaiting-input" || state === "approval-requested") {
		return "active";
	}
	return "complete";
}

function createReplayTimestamp(baseTimestampMs: number, offsetMs: number): string {
	return new Date(baseTimestampMs + offsetMs).toISOString();
}

function hasStudioReplayStepResult(step: StudioReplayStep): boolean {
	return step.output !== undefined || Boolean(step.outputPreview);
}

function createDesigningAgentStatusPart(
	turnId: string,
	timestamp: string
): RovoMessagePart {
	return {
		type: "data-thinking-status",
		id: `${turnId}-designing-agent-status`,
		data: {
			label: STUDIO_REPLAY_DESIGNING_AGENT_LABEL,
			content: STUDIO_REPLAY_DESIGNING_AGENT_CONTENT,
			activity: "data",
			source: "backend",
			timestamp,
		},
	} as RovoMessagePart;
}

function createStudioReplayStatusPart(
	step: StudioReplayStep,
	row: StudioReplayContentRow,
	rowIndex: number,
	timestamp: string
): RovoMessagePart {
	const output = row.output ?? row.outputPreview;
	const data: Record<string, unknown> = {
		label: step.label,
		content: row.content,
		toolCallId: step.toolCallId,
		activity: "data",
		source: "backend",
		timestamp,
	};

	if (row.input !== undefined) {
		data.input = row.input;
	}
	if (output !== undefined) {
		data.output = output;
	}

	return {
		type: "data-thinking-status",
		id: `${step.toolCallId}-status-${rowIndex}`,
		data,
	} as RovoMessagePart;
}

function createStudioReplayEventPart(
	step: StudioReplayStep,
	phase: "start" | "result",
	timestamp: string
): RovoMessagePart {
	const data: ThinkingEventUpdate = {
		eventId: `${step.toolCallId}-${phase}`,
		phase,
		toolName: step.toolName,
		label: step.label,
		toolCallId: step.toolCallId,
		timestamp,
	};

	if (phase === "start" && step.input !== undefined) {
		data.input = step.input;
	}
	if (phase === "result") {
		data.output = step.output ?? step.outputPreview ?? "Completed.";
		if (step.outputPreview) {
			data.outputPreview = step.outputPreview;
		}
	}

	return {
		type: "data-thinking-event",
		id: `${step.toolCallId}-${phase}`,
		data,
	} as RovoMessagePart;
}

function createResolvedQuestionEventPart(timestamp: string): RovoMessagePart {
	const askStep = STUDIO_AGENT_CREATION_FIRST_TURN_STEPS[1];

	return {
		type: "data-thinking-event",
		id: `${askStep.toolCallId}-resolved`,
		data: {
			eventId: `${askStep.toolCallId}-resolved`,
			phase: "result",
			toolName: askStep.toolName,
			label: askStep.label,
			toolCallId: askStep.toolCallId,
			output: STUDIO_REPLAY_ANSWER_RESULT,
			outputPreview: STUDIO_REPLAY_ANSWER_RESULT,
			timestamp,
		},
	} as RovoMessagePart;
}

function createTurnCompletePart(timestamp: string): RovoMessagePart {
	return {
		type: "data-turn-complete",
		data: { timestamp },
	} as RovoMessagePart;
}

function appendStudioStepTimelineEntries({
	baseTimestampMs,
	entries,
	startAt,
	steps,
}: Readonly<{
	baseTimestampMs: number;
	entries: StudioReplayTimelineEntry[];
	startAt: number;
	steps: readonly StudioReplayStep[];
}>): number {
	let currentAt = startAt;

	for (const step of steps) {
		const [firstRow, ...restRows] = step.contentRows;
		const stepStartTimestamp = createReplayTimestamp(baseTimestampMs, currentAt);

		if (firstRow) {
			entries.push({
				at: currentAt,
				part: createStudioReplayStatusPart(step, firstRow, 0, stepStartTimestamp),
			});
		}
		entries.push({
			at: currentAt,
			part: createStudioReplayEventPart(step, "start", stepStartTimestamp),
		});

		const narrationBudgetMs = Math.min(
			restRows.length * STUDIO_REPLAY_NARRATION_ROW_DELAY_MS,
			Math.round(STUDIO_REPLAY_TOOL_CALL_DELAY_MS * 0.6),
		);
		const perRowDelayMs = restRows.length > 0
			? Math.round(narrationBudgetMs / restRows.length)
			: 0;

		for (const [offset, row] of restRows.entries()) {
			const rowAt = currentAt + perRowDelayMs * (offset + 1);
			entries.push({
				at: rowAt,
				part: createStudioReplayStatusPart(
					step,
					row,
					offset + 1,
					createReplayTimestamp(baseTimestampMs, rowAt),
				),
			});
		}

		const remainingRunMs = Math.max(0, STUDIO_REPLAY_TOOL_CALL_DELAY_MS - narrationBudgetMs);
		const hasResult = hasStudioReplayStepResult(step);
		const resultDelayMs = hasResult ? Math.round(remainingRunMs * 0.7) : remainingRunMs;
		const resultAt = currentAt + narrationBudgetMs + resultDelayMs;

		if (hasResult) {
			entries.push({
				at: resultAt,
				part: createStudioReplayEventPart(
					step,
					"result",
					createReplayTimestamp(baseTimestampMs, resultAt),
				),
			});
		}

		currentAt += STUDIO_REPLAY_TOOL_CALL_DELAY_MS;
	}

	return currentAt;
}

function buildStudioReplayTimeline(
	mode: ReplayMode,
	baseTimestampMs: number
): StudioReplayTimelineEntry[] {
	const entries: StudioReplayTimelineEntry[] = [
		{
			at: 0,
			part: createDesigningAgentStatusPart(
				"studio-agent-replay-turn-1",
				createReplayTimestamp(baseTimestampMs, 0),
			),
		},
	];
	const firstTurnEndAt = appendStudioStepTimelineEntries({
		baseTimestampMs,
		entries,
		startAt: 0,
		steps: STUDIO_AGENT_CREATION_FIRST_TURN_STEPS,
	});

	if (mode === "awaiting") {
		entries.push({
			at: firstTurnEndAt,
			part: createTurnCompletePart(createReplayTimestamp(baseTimestampMs, firstTurnEndAt)),
		});
		entries.push({
			at: firstTurnEndAt,
			phase: "awaiting",
		});
		return entries;
	}

	const answerAt = firstTurnEndAt + STUDIO_REPLAY_ANSWER_HOLD_MS;
	entries.push({
		at: answerAt,
		part: createResolvedQuestionEventPart(createReplayTimestamp(baseTimestampMs, answerAt)),
	});

	const followUpStartAt = answerAt + STUDIO_REPLAY_ANSWER_HOLD_MS;
	entries.push({
		at: followUpStartAt,
		part: createDesigningAgentStatusPart(
			"studio-agent-replay-turn-2",
			createReplayTimestamp(baseTimestampMs, followUpStartAt),
		),
	});

	const followUpEndAt = appendStudioStepTimelineEntries({
		baseTimestampMs,
		entries,
		startAt: followUpStartAt,
		steps: STUDIO_AGENT_CREATION_FOLLOW_UP_STEPS,
	});
	entries.push({
		at: followUpEndAt,
		phase: "generating",
	});

	const completedAt = followUpEndAt + STUDIO_REPLAY_RESPONSE_HOLD_MS;
	entries.push({
		at: completedAt,
		part: createTurnCompletePart(createReplayTimestamp(baseTimestampMs, completedAt)),
	});
	entries.push({
		at: completedAt,
		phase: "completed",
		duration: Math.ceil(completedAt / 1000),
	});

	return entries;
}

function useStudioReplayMessage(mode: ReplayMode): {
	duration: number | undefined;
	message: RovoUIMessage;
	phase: StudioReplayPhase;
} {
	const [parts, setParts] = useState<RovoMessagePart[]>([]);
	const [phase, setPhase] = useState<StudioReplayPhase>("playing");
	const [duration, setDuration] = useState<number | undefined>(undefined);

	useEffect(() => {
		const baseTimestampMs = Date.now();
		const timeline = buildStudioReplayTimeline(mode, baseTimestampMs);
		setParts([]);
		setPhase("playing");
		setDuration(undefined);

		const timeoutIds = timeline.map((entry) => window.setTimeout(() => {
			if ("part" in entry) {
				setParts((currentParts) => [...currentParts, entry.part]);
				return;
			}
			setPhase(entry.phase);
			setDuration(entry.duration);
		}, entry.at));

		return () => {
			for (const timeoutId of timeoutIds) {
				window.clearTimeout(timeoutId);
			}
		};
	}, [mode]);

	const message = useMemo<RovoUIMessage>(() => ({
		id: STUDIO_REPLAY_MESSAGE_ID,
		role: "assistant",
		metadata: {},
		parts,
	}), [parts]);

	return { duration, message, phase };
}

function ChainOfThoughtDemoFrame({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div
			className="flex min-h-[400px] w-full items-center justify-center p-4 sm:p-6"
			data-chain-of-thought-demo-frame="true"
		>
			{children}
		</div>
	);
}

function ToolDetailRowAccordion({
	row,
}: Readonly<{ row: ThinkingNarrationDetailRow }>): ReactNode {
	const [open, setOpen] = useState(false);
	const hasDetail = row.input !== undefined || row.output !== undefined;
	const trigger = (
		<span
			className={cn(
				"group/tool-row flex items-start gap-1.5 text-text-subtlest transition-colors",
				hasDetail ? "group-hover/tool-row:text-text" : null,
			)}
		>
			<span className="min-w-0 truncate">{row.content}</span>
			{hasDetail ? (
				<Icon
					render={<ChevronDownIcon label="" size="small" spacing="none" />}
					className={cn(
						"mt-0.5 size-4 shrink-0 transition-[transform,opacity] duration-medium ease-out opacity-0 group-hover/tool-row:opacity-100 group-focus-visible/tool-row:opacity-100",
						open ? "rotate-0" : "-rotate-90",
					)}
				/>
			) : null}
		</span>
	);

	if (!hasDetail) {
		return <div className="group/tool-row">{trigger}</div>;
	}

	return (
		<Collapsible onOpenChange={setOpen} open={open}>
			<button
				type="button"
				className="group/tool-row w-full text-left"
				onClick={() => setOpen((currentOpen) => !currentOpen)}
			>
				{trigger}
			</button>
			<CollapsibleContent className="space-y-2 overflow-hidden pt-2 h-(--collapsible-panel-height) transition-[height,opacity] ease-out duration-medium data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0">
				{row.input !== undefined ? <ToolInput codeBlockSize="sm" input={row.input} /> : null}
				{row.output !== undefined ? <ToolOutput codeBlockSize="sm" errorText={undefined} output={row.output} /> : null}
			</CollapsibleContent>
		</Collapsible>
	);
}

function ToolNarrationDisclosure({
	children,
	detailRows,
}: Readonly<{
	children: ReactNode;
	detailRows: readonly ThinkingNarrationDetailRow[] | undefined;
}>): ReactNode {
	const rows = (detailRows ?? []).filter((row) => row.content.trim().length > 0);

	if (rows.length === 0) {
		return children;
	}

	return (
		<div className="flex flex-col gap-1">
			{rows.map((row, index) => (
				<ToolDetailRowAccordion key={`${index}-${row.content}`} row={row} />
			))}
		</div>
	);
}

function StudioReplayToolCallStep({
	detailRows,
	narration,
	onOpenChange,
	open,
	toolCall,
}: Readonly<{
	detailRows: readonly ThinkingNarrationDetailRow[] | undefined;
	narration: string[] | undefined;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	toolCall: ThinkingToolCallSummary;
}>): ReactNode {
	const status = getReplayStepStatus(toolCall.state);
	const resolvedToolIcon = resolveToolIcon({
		toolName: toolCall.toolName,
		title: toolCall.toolName,
		input: toolCall.input,
		mcpServer: toolCall.mcpServer,
	});

	return (
		<ChainOfThoughtStep
			collapsible
			defaultOpen={false}
			description={toolCall.state === "completed" ? null : getThinkingToolByline(toolCall, narration)}
			iconRender={renderResolvedToolIcon(resolvedToolIcon, { className: "size-4" })}
			label={getThinkingToolTitle(toolCall)}
			onOpenChange={onOpenChange}
			open={open}
			status={status}
		>
			<ToolNarrationDisclosure detailRows={detailRows}>
				{toolCall.input !== undefined ? <ToolInput codeBlockSize="sm" input={toolCall.input} /> : null}
				<ToolOutput
					codeBlockSize="sm"
					errorText={toolCall.errorText}
					output={toolCall.output}
					outputPreview={toolCall.outputPreview}
					outputBytes={toolCall.outputBytes}
					outputTruncated={toolCall.outputTruncated}
					suppressedRawOutput={toolCall.suppressedRawOutput}
				/>
			</ToolNarrationDisclosure>
		</ChainOfThoughtStep>
	);
}

function getLatestThinkingStatusLabel(message: RovoUIMessage): string {
	for (let index = message.parts.length - 1; index >= 0; index -= 1) {
		const part = message.parts[index];
		if (part.type !== "data-thinking-status") {
			continue;
		}
		const label = part.data.label;
		if (typeof label === "string" && label.trim()) {
			return label.trim();
		}
	}
	return STUDIO_REPLAY_DESIGNING_AGENT_LABEL;
}

function getLatestThinkingEvent(message: RovoUIMessage): { phase?: string; toolName?: string } | null {
	for (let index = message.parts.length - 1; index >= 0; index -= 1) {
		const part = message.parts[index];
		if (part.type === "data-thinking-event") {
			return part.data;
		}
	}
	return null;
}

function getReplayHeaderLabel({
	hasAwaitingInput,
	message,
	phase,
}: Readonly<{
	hasAwaitingInput: boolean;
	message: RovoUIMessage;
	phase: StudioReplayPhase;
}>): ReactNode {
	if (hasAwaitingInput || phase === "awaiting") {
		return getAwaitingUserResponseLabel();
	}

	const latestEvent = getLatestThinkingEvent(message);
	if (
		phase === "playing" &&
		latestEvent?.phase === "result" &&
		latestEvent.toolName === "ask_user_questions"
	) {
		return getQuestionsAnsweredLabel();
	}

	if (phase === "completed") {
		return undefined;
	}

	return resolveThinkingLabelForSurface({
		baseLabel: getLatestThinkingStatusLabel(message),
		reasoningPhase: "thinking",
		surface: "fullscreen",
	});
}

function StudioReplayGeneratingResponseStep(): ReactNode {
	return (
		<ChainOfThoughtStep
			description={null}
			iconRender={<Spinner variant="rainbow" label="Generating a response" />}
			iconShimmer={false}
			label={
				<span className="inline-flex min-w-0 items-baseline">
					<Shimmer as="span" duration={1.4} spread={2} className="min-w-0 truncate text-left">
						Generating a response
					</Shimmer>
					<AnimatedDot />
				</span>
			}
			status="active"
		/>
	);
}

function StudioChainOfThoughtReplay({ mode }: Readonly<{ mode: ReplayMode }>): ReactNode {
	const { duration, message, phase } = useStudioReplayMessage(mode);
	const [isOpen, setIsOpen] = useState(true);
	const [openedToolCallIds, setOpenedToolCallIds] = useState<ReadonlySet<string>>(() => new Set());
	const thinkingToolCalls = useMemo(
		() => getThinkingToolCallSummaries(message),
		[message],
	);
	const thinkingNarrationMap = useMemo(
		() => buildThinkingNarrationMap(message),
		[message],
	);
	const thinkingNarrationDetailMap = useMemo(
		() => buildThinkingNarrationDetailMap(message),
		[message],
	);
	const hasAwaitingInput = thinkingToolCalls.some((toolCall) => toolCall.state === "awaiting-input");
	const hasThinkingDetails = thinkingToolCalls.length > 0 || phase === "generating";
	const shouldAutoCollapse = phase === "completed" || phase === "awaiting" || hasAwaitingInput;
	const headerLabel = getReplayHeaderLabel({
		hasAwaitingInput,
		message,
		phase,
	});

	useEffect(() => {
		if (shouldAutoCollapse) {
			setIsOpen(false);
		}
	}, [shouldAutoCollapse]);

	const handleToolOpenChange = useCallback((toolCallId: string, nextOpen: boolean) => {
		setOpenedToolCallIds((currentIds) => {
			const nextIds = new Set(currentIds);
			if (nextOpen) {
				nextIds.add(toolCallId);
			} else {
				nextIds.delete(toolCallId);
			}
			return nextIds;
		});
	}, []);

	return (
		<ChainOfThought
			className="w-full"
			onOpenChange={setIsOpen}
			open={isOpen}
		>
			<ChainOfThoughtHeader
				duration={duration}
				showChevron={hasThinkingDetails}
				state={phase === "completed" ? "completed" : "thinking"}
			>
				{headerLabel}
			</ChainOfThoughtHeader>
			{hasThinkingDetails ? (
				<ChainOfThoughtContent>
					{thinkingToolCalls.map((toolCall, index) => {
						const narration = toolCall.toolCallId
							? thinkingNarrationMap.byToolCallId.get(toolCall.toolCallId)
							: undefined;
						const detailRows = toolCall.toolCallId
							? thinkingNarrationDetailMap.byToolCallId.get(toolCall.toolCallId)
							: undefined;

						return (
							<StudioReplayToolCallStep
								key={`${toolCall.id}-${index}`}
								detailRows={detailRows}
								narration={narration}
								onOpenChange={(nextOpen) => handleToolOpenChange(toolCall.id, nextOpen)}
								open={openedToolCallIds.has(toolCall.id)}
								toolCall={toolCall}
							/>
						);
					})}
					{phase === "generating" ? <StudioReplayGeneratingResponseStep /> : null}
				</ChainOfThoughtContent>
			) : null}
		</ChainOfThought>
	);
}

function ChainOfThoughtReplayDemo({
	mode,
	resetLabel,
}: Readonly<{
	mode: ReplayMode;
	resetLabel: string;
}>) {
	const [replayKey, setReplayKey] = useState(0);
	const handleReset = useCallback(() => {
		setReplayKey((currentKey) => currentKey + 1);
	}, []);

	return (
		<ChainOfThoughtDemoFrame>
			<div className="flex w-full max-w-2xl flex-col gap-4" data-chain-of-thought-replay-demo="true">
				<div className="flex justify-end">
					<button
						aria-label={resetLabel}
						className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-bg-neutral-subtle px-3 font-medium text-sm text-text-subtle transition-colors hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
						onClick={handleReset}
						type="button"
					>
						<Icon render={<RefreshIcon label="" size="small" />} label="Reset" />
						Reset
					</button>
				</div>
				<StudioChainOfThoughtReplay key={replayKey} mode={mode} />
			</div>
		</ChainOfThoughtDemoFrame>
	);
}

export default function ChainOfThoughtDemo() {
	return <ChainOfThoughtDemoNormalToolCallingReplay />;
}

export function ChainOfThoughtDemoNormalToolCallingReplay() {
	return (
		<ChainOfThoughtReplayDemo
			mode="normal"
			resetLabel="Reset normal tool calling animation"
		/>
	);
}

export function ChainOfThoughtDemoAwaitingUserResponseReplay() {
	return (
		<ChainOfThoughtReplayDemo
			mode="awaiting"
			resetLabel="Reset awaiting user response animation"
		/>
	);
}

export function ChainOfThoughtDemoPreload() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought className="w-full max-w-2xl">
				<ChainOfThoughtHeader showChevron={false} state="preload" shimmer />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Searching the web"
						description="Searching public profiles for Hayden Bleasel"
						status="pending"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoThinking() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-2xl">
				<ChainOfThoughtHeader state="thinking" />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Searching the web"
						description="Searching public profiles for Hayden Bleasel"
						status="complete"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{PROFILE_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={ImageIcon}
						label="Selecting profile image"
						description="Found a likely profile image from the source set"
						status="complete"
						collapsible
					>
						<ChainOfThoughtImage caption="Public profile image selected from matched sources.">
							<Image
								alt="Profile image result"
								className="h-40 w-40 rounded-md border border-border object-cover"
								height={160}
								src="/avatar-human/anthony-chen.png"
								width={160}
							/>
						</ChainOfThoughtImage>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={AiSparkleIcon}
						label="Synthesizing summary"
						description="Synthesizing a short profile summary from validated signals"
						status="complete"
					/>

					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Checking work updates"
						description="Searching GitHub and Dribbble for recent work updates"
						status="active"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{RECENT_WORK_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoCompleted() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought className="w-full max-w-2xl">
				<ChainOfThoughtHeader state="completed" duration={5} />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Searching the web"
						description="Searching public profiles for Hayden Bleasel"
						status="complete"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{PROFILE_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={ImageIcon}
						label="Selecting profile image"
						description="Found a likely profile image from the source set"
						status="complete"
						collapsible
					>
						<ChainOfThoughtImage caption="Public profile image selected from matched sources.">
							<Image
								alt="Profile image result"
								className="h-40 w-40 rounded-md border border-border object-cover"
								height={160}
								src="/avatar-human/anthony-chen.png"
								width={160}
							/>
						</ChainOfThoughtImage>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={AiSparkleIcon}
						label="Synthesizing summary"
						description="Synthesizing a short profile summary from validated signals"
						status="complete"
					/>

					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Checking work updates"
						description="Checked recent work updates across matched sources"
						status="complete"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{RECENT_WORK_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={CheckCircleIcon}
						label="Done"
						description="Reasoning trace complete"
						status="complete"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoStatusVariants() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-xl">
				<ChainOfThoughtHeader>Status progression</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep label="Collecting sources" description="Collected source pages" status="complete" />
					<ChainOfThoughtStep label="Cross-checking dates" description="Cross-checking publication dates" status="active" />
					<ChainOfThoughtStep label="Drafting answer" description="Drafting the final answer" status="pending" />
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoSearchResults() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-xl">
				<ChainOfThoughtHeader>Search result chips</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Evaluating sources"
						description="Ranking sources by recency and authority"
						status="active"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{[
								"https://www.atlassian.com",
								"https://www.vercel.com",
								"https://www.github.com",
								"https://www.npmjs.com",
							].map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoImageStep() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-xl">
				<ChainOfThoughtHeader>Image evidence</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={ImageIcon}
						label="Attaching image evidence"
						description="Attached visual evidence for reasoning context"
						status="complete"
						collapsible
					>
						<ChainOfThoughtImage caption="Image context included before summary generation.">
							<Image
								alt="Reasoning evidence image"
								className="h-40 w-40 rounded-md border border-border object-cover"
								height={160}
								src="/avatar-human/priya-hansra.png"
								width={160}
							/>
						</ChainOfThoughtImage>
					</ChainOfThoughtStep>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoStudioAgentGenerationFlow() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				state="thinking"
				steps={[
					{
						id: "brief",
						icon: SearchIcon,
						label: "Reading agent brief",
						description: "Identified the target Jira project, RFP workflow, and reusable response package outcome.",
						status: "complete",
					},
					{
						id: "clarification",
						icon: AiSparkleIcon,
						label: "Preparing clarification questions",
						description: "Checked whether the brief needs missing inputs before creating the agent.",
						status: "complete",
					},
					{
						id: "tools",
						icon: SearchIcon,
						label: "Selecting Jira and Confluence tools",
						description: "Mapped the agent to the apps, skills, and knowledge it needs for RFP work.",
						status: "complete",
						collapsible: true,
						children: (
							<ChainOfThoughtSearchResults>
								<ChainOfThoughtSearchResult>Jira</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Confluence</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Proposal library</ChainOfThoughtSearchResult>
							</ChainOfThoughtSearchResults>
						),
					},
					{
						id: "instructions",
						icon: AiSparkleIcon,
						label: "Drafting agent instructions",
						description: "Structuring role, workflow, evidence handling, reviewer plan, and guardrails.",
						status: "active",
					},
					{
						id: "save",
						icon: CheckCircleIcon,
						label: "Saving agent profile",
						description: "Queued until the generated instructions are ready.",
						status: "pending",
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoAutomationTriggerFlow() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				state="thinking"
				steps={[
					{
						id: "review",
						icon: SearchIcon,
						label: "Reviewing existing automations",
						description: "Keeping the Jira Drafting trigger unchanged before adding a separate Slack summary trigger.",
						status: "complete",
					},
					{
						id: "schedule",
						icon: AiSparkleIcon,
						label: "Configuring Friday schedule",
						description: "Setting the recurring cadence to every Friday at 9:00 AM.",
						status: "complete",
					},
					{
						id: "delivery",
						icon: AiSparkleIcon,
						label: "Setting Slack delivery",
						description: "Mapping the weekly RFP outcome summary to the leadership Slack channel.",
						status: "active",
						collapsible: true,
						defaultOpen: true,
						children: (
							<ChainOfThoughtSearchResults>
								<ChainOfThoughtSearchResult>Leadership Slack channel</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Weekly RFP outcomes</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Bid/no-bid decisions</ChainOfThoughtSearchResult>
							</ChainOfThoughtSearchResults>
						),
					},
					{
						id: "save",
						icon: CheckCircleIcon,
						label: "Saving automation trigger",
						description: "Queued until Slack delivery configuration is complete.",
						status: "pending",
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoResearchRetrievalFlow() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				state="thinking"
				steps={[
					{
						id: "query",
						icon: SearchIcon,
						label: "Searching approved sources",
						description: "Looking across Confluence, Jira history, and proposal-library snippets.",
						status: "complete",
						collapsible: true,
						children: (
							<ChainOfThoughtSearchResults>
								<ChainOfThoughtSearchResult>Confluence</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Jira history</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Proposal library</ChainOfThoughtSearchResult>
							</ChainOfThoughtSearchResults>
						),
					},
					{
						id: "evaluate",
						icon: AiSparkleIcon,
						label: "Evaluating source fit",
						description: "Ranking snippets by approval status, freshness, and RFP relevance.",
						status: "active",
					},
					{
						id: "synthesize",
						icon: CheckCircleIcon,
						label: "Synthesizing recommendation",
						description: "Queued until the selected evidence has been checked.",
						status: "pending",
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoTwgToolCall() {
	const twgIcon = renderResolvedToolIcon(
		resolveToolIcon({ toolName: "twg.lookup_work_item_delivery_context" }),
		{ className: "size-4" },
	);

	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-2xl">
				<ChainOfThoughtHeader state="thinking" />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						description="Reading the current work item"
						icon={SearchIcon}
						label="Reading the current work item"
						status="complete"
					/>
					<ChainOfThoughtStep
						collapsible
						defaultOpen
						description={null}
						iconRender={twgIcon}
						iconContainerStyle={{ marginTop: 6 }}
						label="Connecting work through Teamwork Graph"
						status="complete"
						headerRender={({ isOpen, toggleOpen }) => (
							<TwgTool
								chevronOpen={isOpen}
								description="Found 4 relevant delivery signals across Jira, Confluence, and Figma."
								onBannerClick={toggleOpen}
								showChevron
								showLoader={false}
								sources={TWG_TOOL_SOURCES}
								status="complete"
								title="Connecting work through Teamwork Graph"
							/>
						)}
					>
						<div className="space-y-1 text-xs leading-5 text-text-subtle">
							<p>Found a matching checkout-funnel research brief in Confluence.</p>
							<p>Linked the work item to the latest checkout flow in Figma.</p>
							<p>Resolved delivery ownership and implementation signals from Jira.</p>
						</div>
					</ChainOfThoughtStep>
					<ChainOfThoughtStep
						description="Checking product requirements"
						icon={SearchIcon}
						label="Checking product requirements"
						status="active"
					/>
					<ChainOfThoughtStep
						description="Queued until the connected delivery context is reviewed"
						icon={AiSparkleIcon}
						label="Drafting the improved description"
						status="pending"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoToolCallDetailsFlow() {
	const defineTriggerIcon = renderResolvedToolIcon(resolveToolIcon({ toolName: "agent.define_trigger" }), { className: "size-4 text-muted-foreground" });
	const saveProfileIcon = renderResolvedToolIcon(resolveToolIcon({ toolName: "studio.save_profile" }), { className: "size-4 text-muted-foreground" });

	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				duration={7}
				state="completed"
				steps={[
					{
						id: "define-trigger",
						iconRender: defineTriggerIcon,
						label: "Defined scheduled trigger",
						description: null,
						status: "complete",
						collapsible: true,
						children: (
							<Tool>
								<ToolHeader
									leadingIcon={defineTriggerIcon}
									state="output-available"
									title="agent.define_trigger"
									toolName="agent.define_trigger"
									type="dynamic-tool"
								/>
								<ToolContent>
									<ToolInput
										codeBlockSize="sm"
										input={{
											automationName: "Send Weekly RFPs Summary",
											schedule: "Every Friday at 9:00 AM",
											scope: "All RFP outcomes",
										}}
									/>
									<ToolOutput
										codeBlockSize="sm"
										errorText={undefined}
										output={{
											status: "configured",
											triggerType: "scheduled",
										}}
									/>
								</ToolContent>
							</Tool>
						),
					},
					{
						id: "save-profile",
						iconRender: saveProfileIcon,
						label: "Saved automation trigger",
						description: null,
						status: "complete",
						collapsible: true,
						children: (
							<Tool>
								<ToolHeader
									leadingIcon={saveProfileIcon}
									state="output-available"
									title="studio.save_profile"
									toolName="studio.save_profile"
									type="dynamic-tool"
								/>
								<ToolContent>
									<ToolInput
										codeBlockSize="sm"
										input={{
											agent: "RFP Drafter",
											change: "append scheduled Slack trigger",
										}}
									/>
									<ToolOutput
										codeBlockSize="sm"
										errorText={undefined}
										output={undefined}
										outputPreview="Send Weekly RFPs Summary is ready to review in the config panel."
									/>
								</ToolContent>
							</Tool>
						),
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoToolIconTable() {
	return (
		<ChainOfThoughtDemoFrame>
			<div className="w-full max-w-4xl overflow-hidden rounded-md bg-background">
				<div className="border-b border-border px-4 py-3">
					<h3 className="font-medium text-sm text-text">Resolved tool icons and logos</h3>
					<p className="mt-1 text-sm text-text-subtle">
						Native tools, Atlassian/VPK branding, 3P logos, and fallback behavior used by chain-of-thought and tool UIs.
					</p>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[720px] text-left text-sm">
						<thead className="bg-surface-raised text-text-subtle">
							<tr>
								<th className="px-4 py-2 font-medium">Type</th>
								<th className="px-4 py-2 font-medium">Resolved icon</th>
								<th className="px-4 py-2 font-medium">Tool / server</th>
								<th className="px-4 py-2 font-medium">Resolved kind</th>
								<th className="px-4 py-2 font-medium">Notes</th>
							</tr>
						</thead>
						<tbody>
							{TOOL_ICON_ROWS.map((row) => {
								const resolved = resolveToolIcon({
									toolName: row.toolName,
									mcpServer: row.mcpServer,
								});

								return (
									<tr key={`${row.category}-${row.toolName}-${row.mcpServer ?? "none"}`} className="border-t border-border align-middle">
										<td className="px-4 py-3 text-text-subtle">{row.category}</td>
										<td className="px-4 py-3">
											<div className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface">
												{renderResolvedToolIcon(resolved, { className: "size-4" })}
											</div>
										</td>
										<td className="px-4 py-3">
											<div className="font-mono text-xs text-text">{row.toolName}</div>
											{row.mcpServer ? (
												<div className="mt-1 text-xs text-text-subtle">server: {row.mcpServer}</div>
											) : null}
										</td>
										<td className="px-4 py-3 text-text-subtle">{resolved.kind}</td>
										<td className="px-4 py-3 text-text-subtle">{row.note}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</ChainOfThoughtDemoFrame>
	);
}
