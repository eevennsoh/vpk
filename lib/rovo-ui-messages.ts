import {
	getToolName,
	isReasoningUIPart,
	isTextUIPart,
	isToolUIPart,
	type DynamicToolUIPart,
	type SourceDocumentUIPart,
	type SourceUrlUIPart,
	type ToolUIPart,
	type UIMessage,
} from "ai";
import type { AgentAutomationRule } from "@/components/blocks/trigger/data/trigger-catalog";
import type { RovoAppCreationMode, RovoAppPromptMode } from "@/lib/rovo-app-types";

// ---------------------------------------------------------------------------
// Routing decision types (v2)
// ---------------------------------------------------------------------------

export type RoutingIntent = "chat" | "artifact_create" | "artifact_update" | "genui";
export type RoutingPresentation = "text" | "genui_card" | "artifact_preview";
export type RoutingOrigin = "text" | "voice";

export interface RoutingDecision {
	readonly intent: RoutingIntent;
	readonly presentation: RoutingPresentation;
	readonly confidence: number;
	readonly reason: string;
	readonly origin: RoutingOrigin;
}

export type AgentExecutionStatus = "working" | "completed" | "failed";

export interface AgentExecutionUpdate {
	agentId: string;
	agentName: string;
	taskId: string;
	taskLabel: string;
	status: AgentExecutionStatus;
	content?: string;
}

export type ThinkingEventPhase = "start" | "result" | "error";

export type ThinkingStatusActivity =
	| "image"
	| "audio"
	| "ui"
	| "data"
	| "results";

export type ThinkingStatusSource = "backend" | "fallback";

export interface ThinkingEventUpdate {
	eventId: string;
	phase: ThinkingEventPhase;
	toolName: string;
	label?: string;
	toolCallId?: string;
	input?: unknown;
	output?: unknown;
	outputPreview?: string;
	outputTruncated?: boolean;
	outputBytes?: number;
	suppressedRawOutput?: boolean;
	errorText?: string;
	timestamp: string;
	mcpServer?: string;
	permissionScenario?: string;
}

export type ThinkingToolState =
	| "approval-requested"
	| "running"
	| "awaiting-input"
	| "completed"
	| "error";

export interface ThinkingToolCallSummary {
	id: string;
	toolName: string;
	label?: string;
	toolCallId?: string;
	state: ThinkingToolState;
	input?: unknown;
	output?: unknown;
	outputPreview?: string;
	outputTruncated?: boolean;
	outputBytes?: number;
	suppressedRawOutput?: boolean;
	errorText?: string;
	timestamp?: string;
	mcpServer?: string;
	permissionScenario?: string;
}

export interface AgentExecutionSummary {
	agentId: string;
	agentName: string;
	taskId: string;
	taskLabel: string;
	status: AgentExecutionStatus;
	content: string;
}

export interface ToolApprovalItem {
	id: string;
	toolCallId: string;
	toolName: string;
	title: string;
	description: string;
	targetPath?: string;
	commandPreview?: string | null;
	riskLevel?: "low" | "medium" | "high";
	permissionScenario?: string;
}

export interface ToolApprovalPayload {
	approvalId: string;
	threadId?: string;
	createdAt?: string;
	items: ToolApprovalItem[];
}

export interface ToolFirstWarningData {
	message: string;
	domains: string[];
	attempts: number;
	retriesUsed: number;
	hadRelevantToolStart: boolean;
	relevantToolErrors: number;
	lastRelevantToolName?: string | null;
	lastRelevantErrorCategory?: string | null;
	lastRelevantError?: string | null;
	rovoDevFallback: boolean;
}

export type RovoMessageInterruptionSource =
	| "artifact-submission"
	| "voice-barge-in"
	| "user-stop";

export interface RovoMessageInterruption {
	status: "interrupted";
	source: RovoMessageInterruptionSource;
	interruptedAt: string;
}

// One subagent attached to a studio agent. `config` mirrors the agent config
// form shape (instructions, triggers, skills, tools, knowledge, …) but is kept
// structural here so this lib stays free of `components/` imports — the studio
// panel/hook cast it to `AgentConfigFormValue` when reading/writing it.
export interface RovoAgentSubagentPrompt {
	id: string;
	triggerName: string;
	condition: string;
	config: Record<string, unknown>;
}

export type RovoDataParts = {
	id: string;
	title: string;
	kind: "text" | "code" | "html" | "image" | "sheet" | "react" | "excalidraw" | "browser";
	"artifact-result": {
		documentId: string;
		threadId?: string;
		title: string;
		kind: "text" | "code" | "html" | "image" | "sheet" | "react" | "excalidraw" | "browser";
		action: "create" | "update";
	};
	"agent-result": {
		agentId: string;
		name: string;
		byline?: string;
		sourceLabel?: string;
		description?: string;
		instructions?: string;
		contextDescription?: string;
		conversationStarters?: string[];
		conversationStarterIcons?: string[];
		avatarSrc?: string;
		avatarFallback?: {
			initials?: string;
			backgroundColor?: string;
			iconName?: string;
			label?: string;
		};
		assignedColumn?: string;
		summary: string;
		trigger?: string;
		triggers?: string[];
		automationRules?: AgentAutomationRule[];
		tools?: string[];
		// `skills`, `knowledge`, and `subagents` are edited via the agent config
		// panel and have long been persisted on the draft through the
		// key-preserving reducer in context-rovo-chat. Declared here so the typed
		// config code can read them directly instead of casting.
		skills?: string[];
		knowledge?: string[];
		subagents?: string[];
		// Canonical "apps" membership (the tools + knowledge umbrella). Derived at
		// ingest from the tools[]/knowledge[] facet arrays (joined via the unified
		// apps catalog) plus any @[app:id] body tokens, and force-injected from the
		// composer's app mentions. The facet arrays remain the source of granular
		// detail (custom knowledge content, tool permissions); apps[] is membership.
		apps?: string[];
		// Full per-subagent configs (instructions, trigger, condition, tools, …).
		// Persisted alongside the base agent so the studio subagents experience
		// survives panel close/reopen, agent switching, and publish.
		subagentPrompts?: RovoAgentSubagentPrompt[];
		guardrail?: string;
		// Config "mode" selectors: Memory ("on"|"off"), Reasoning level, and
		// Knowledge scope ("all"|"custom"|"none"). Persisted on the draft so
		// generation-set modes survive panel close/reopen, agent switching, and
		// publish (carried by the same key-preserving reducer as skills/knowledge).
		// Typed as `string` on the wire; the valid value sets are owned by the
		// option lists in components/blocks/agent/components/agent.tsx
		// (MEMORY_MODE_OPTIONS, REASONING_MODE_SECTIONS, KNOWLEDGE_MODE_OPTIONS).
		memoryMode?: string;
		reasoningMode?: string;
		knowledgeMode?: string;
		action: "create" | "update";
	};
	clear: null;
	finish: null;
	"cancel-streaming": null;
	textDelta: string;
	codeDelta: string;
	"widget-loading": {
		type?: string;
		loading: boolean;
	};
	"widget-data": {
		type?: string;
		payload: unknown;
	};
	"widget-error": {
		type?: string;
		code?: string;
		message: string;
		details?: string;
		canRetry?: boolean;
	};
	"suggested-questions": {
		questions: string[];
	};
	"thinking-status": {
		label: string;
		content?: string;
		/**
		 * Explicit tool-call association for this narration row. When present it
		 * is authoritative; the narration map groups the row directly under this
		 * id instead of inferring it from chronological position. Lets a step
		 * stream multiple stacked rows without bleeding into adjacent steps.
		 */
		toolCallId?: string;
		/**
		 * Optional per-row detail. When present, the row renders as its own
		 * collapsible sub-step with these Parameters (`input`) and Result
		 * (`output`) instead of sharing the tool call's single detail block.
		 */
		input?: unknown;
		output?: unknown;
		activity?: ThinkingStatusActivity;
		source?: ThinkingStatusSource;
		timestamp?: string;
	};
	"thinking-event": ThinkingEventUpdate;
	"tool-first-warning": ToolFirstWarningData;
	"agent-execution": AgentExecutionUpdate;
	"tool-approval": ToolApprovalPayload;
	"todo-queue": {
		items: Array<{
			id: string;
			text: string;
			blockedBy: string[];
			agent?: string;
		}>;
	};
	"turn-complete": {
		timestamp: string;
	};
	"browser-state": {
		workspaceId?: string;
		provider?: "browser-workspace";
		url: string;
		title: string;
		status: "navigating" | "ready" | "error";
		streamConfig?: {
			enabled: boolean;
			wsUrl: string;
		};
	};
	"browser-screenshot": {
		workspaceId?: string;
		url: string;
		contentType?: string;
		height?: number;
		imageData?: string;
		imageUrl?: string;
		thumbnailUrl?: string;
		timestamp: string;
		width?: number;
	};
	"route-decision": RoutingDecision;
};

export type RovoDataPart<KEY extends keyof RovoDataParts & string> = {
	type: `data-${KEY}`;
	id?: string;
	data: RovoDataParts[KEY];
};

export interface RovoMessageMetadata {
	visibility?: "visible" | "hidden";
	source?:
		| "clarification-submit"
		| "plan-approval-submit"
		| "agent-directive"
		| "jira-issue-generative-action"
		| "plan-retry"
		| "plan-task-dispatch";
	/** Internal provenance for unified voice/chat routing */
	origin?: "realtime" | "rovo";
	/** Stable timestamps for merging persisted realtime + Rovo threads */
	createdAt?: string;
	updatedAt?: string;
	/** OpenAI Realtime-side identifier for correlating client/server events */
	realtimeMessageId?: string;
	/** Existing user message reused when GPT-Realtime delegates to Rovo */
	delegatedFromId?: string;
	/** Mode snapped when the user submitted the prompt. */
	submittedMode?: RovoAppPromptMode;
	/** Creation flow snapped when the user submitted a prompt or clarification answer. */
	creationMode?: RovoAppCreationMode;
	planApprovalDecision?: "auto-accept" | "continue-planning" | "custom";
	planApprovalPlanKey?: string;
	/** Short label shown in the user bubble instead of the full prompt text */
	displayLabel?: string;
	/** Structured skill invocation rendered as an on-colored tag plus instruction. */
	skillInvocation?: {
		id: string;
		label: string;
		instruction: string;
	};
	/** Structured clarification rows shown in the specialized user summary bubble */
	clarificationSummary?: Array<{
		question: string;
		answer: string;
		status?: "skipped";
	}>;
	/** Correlates clarification submits/dismissals with a specific deferred question card */
	clarificationToolCallId?: string;
	clarificationSessionId?: string;
	clarificationRound?: number;
	clarificationStatus?: "answered" | "dismissed";
	/** Assistant turn status used for transcript rendering and persistence */
	interruption?: RovoMessageInterruption;
}

export type RovoUIMessage = UIMessage<RovoMessageMetadata, RovoDataParts>;
export type RovoRenderableUIMessage = RovoUIMessage & {
	role: "user" | "assistant";
};
export type RovoToolPart = ToolUIPart | DynamicToolUIPart;
export type RovoSourcePart = SourceUrlUIPart | SourceDocumentUIPart;

const CREATE_PLAN_SIGNAL_REGEX = /\bcreate[-_\s]?plan\b/i;
const REQUEST_USER_INPUT_TOOL_NAME_REGEX =
	/(?:^|\.)(?:request_user_input|ask_user_questions|ask_user_question)$/i;
const ROUTING_INTENTS = new Set<RoutingIntent>([
	"chat",
	"artifact_create",
	"artifact_update",
	"genui",
]);
const ROUTING_PRESENTATIONS = new Set<RoutingPresentation>([
	"text",
	"genui_card",
	"artifact_preview",
]);
const ROUTING_ORIGINS = new Set<RoutingOrigin>(["text", "voice"]);

export function isRequestUserInputToolName(toolName: unknown): boolean {
	if (typeof toolName !== "string") {
		return false;
	}

	const normalizedToolName = toolName.trim();
	if (!normalizedToolName) {
		return false;
	}

	return REQUEST_USER_INPUT_TOOL_NAME_REGEX.test(normalizedToolName);
}

function thinkingPhaseToState(
	phase: ThinkingEventPhase,
	options: { permissionScenario?: string } = {}
): ThinkingToolState {
	if (phase === "error") return "error";
	if (phase === "result") return "completed";
	if (
		typeof options.permissionScenario === "string" &&
		options.permissionScenario.trim().length > 0
	) {
		return "approval-requested";
	}
	return "running";
}

function extractOutputPreview(
	phase: ThinkingEventPhase,
	preview: unknown
): string | undefined {
	if (phase !== "result" && phase !== "error") return undefined;
	return typeof preview === "string" ? preview : undefined;
}

export function createAssistantTextMessage(
	id: string,
	content: string
): RovoUIMessage {
	return {
		id,
		role: "assistant",
		parts: [{ type: "text", text: content, state: "done" }],
	};
}

export function getLatestUserMessageId(
	messages: ReadonlyArray<Pick<RovoUIMessage, "id" | "role">>
): string | null {
	for (let index = messages.length - 1; index >= 0; index--) {
		if (messages[index].role === "user") {
			return messages[index].id;
		}
	}

	return null;
}

export function isRenderableRovoUIMessage(
	message: RovoUIMessage
): message is RovoRenderableUIMessage {
	return (
		(message.role === "user" || message.role === "assistant") &&
		message.metadata?.visibility !== "hidden"
	);
}

export function isMessageVisibleInTranscript(
	message: Pick<RovoUIMessage, "metadata">
): boolean {
	return message.metadata?.visibility !== "hidden";
}

export function getLatestDataPart<KEY extends keyof RovoDataParts & string>(
	message: Pick<RovoUIMessage, "parts">,
	type: `data-${KEY}`
): RovoDataPart<KEY> | null {
	for (let index = message.parts.length - 1; index >= 0; index--) {
		const part = message.parts[index];
		if (part.type === type) {
			return part as RovoDataPart<KEY>;
		}
	}

	return null;
}

function clampRoutingConfidence(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return 1;
	}

	return Math.max(0, Math.min(1, value));
}

export function isRoutingDecision(value: unknown): value is RoutingDecision {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<RoutingDecision>;
	return (
		ROUTING_INTENTS.has(candidate.intent as RoutingIntent) &&
		ROUTING_PRESENTATIONS.has(candidate.presentation as RoutingPresentation) &&
		typeof candidate.confidence === "number" &&
		Number.isFinite(candidate.confidence) &&
		typeof candidate.reason === "string" &&
		candidate.reason.trim().length > 0 &&
		ROUTING_ORIGINS.has(candidate.origin as RoutingOrigin)
	);
}

function normalizeRoutingDecision(value: unknown): RoutingDecision | null {
	if (!isRoutingDecision(value)) {
		return null;
	}

	return {
		intent: value.intent,
		presentation: value.presentation,
		confidence: clampRoutingConfidence(value.confidence),
		reason: value.reason.trim(),
		origin: value.origin,
	};
}

export function getLatestRouteDecision(
	message: Pick<RovoUIMessage, "parts">
): RoutingDecision | null {
	for (let index = message.parts.length - 1; index >= 0; index -= 1) {
		const part = message.parts[index];
		if (part.type !== "data-route-decision") {
			continue;
		}

		const routeDecision = normalizeRoutingDecision(part.data);
		if (routeDecision) {
			return routeDecision;
		}
	}

	return null;
}

export function getAllDataParts<KEY extends keyof RovoDataParts & string>(
	message: Pick<RovoUIMessage, "parts">,
	type: `data-${KEY}`
): RovoDataPart<KEY>[] {
	const result: RovoDataPart<KEY>[] = [];
	for (const part of message.parts) {
		if (part.type === type) {
			result.push(part as RovoDataPart<KEY>);
		}
	}
	return result;
}

export function hasTurnCompleteSignal(
	message: Pick<RovoUIMessage, "parts">
): boolean {
	for (let index = message.parts.length - 1; index >= 0; index--) {
		if (message.parts[index].type === "data-turn-complete") {
			return true;
		}
	}

	return false;
}

function getIsoTimestamp(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	return Number.isFinite(Date.parse(trimmed)) ? trimmed : undefined;
}

function getLatestTurnCompleteTimestamp(
	message: Pick<RovoUIMessage, "parts">
): string | undefined {
	return getIsoTimestamp(
		getLatestDataPart(message, "data-turn-complete")?.data.timestamp
	);
}

export interface MessageReasoningTimestamps {
	startedAt?: string;
	completedAt?: string;
}

export function getMessageReasoningTimestamps(
	message: Pick<RovoUIMessage, "parts" | "metadata">
): MessageReasoningTimestamps {
	const thinkingStatusParts = getAllDataParts(message, "data-thinking-status");
	const thinkingEventParts = getAllDataParts(message, "data-thinking-event");
	const thinkingStatusTimestamps = thinkingStatusParts
		.map((part) => getIsoTimestamp(part.data.timestamp))
		.filter((timestamp): timestamp is string => timestamp !== undefined);
	const thinkingEventTimestamps = thinkingEventParts
		.map((part) => getIsoTimestamp(part.data.timestamp))
		.filter((timestamp): timestamp is string => timestamp !== undefined);
	const startedAt =
		thinkingEventTimestamps[0] ??
		thinkingStatusTimestamps[0] ??
		getIsoTimestamp(message.metadata?.createdAt);
	const completedAt =
		getLatestTurnCompleteTimestamp(message) ??
		thinkingEventTimestamps[thinkingEventTimestamps.length - 1] ??
		thinkingStatusTimestamps[thinkingStatusTimestamps.length - 1] ??
		getIsoTimestamp(message.metadata?.updatedAt);

	return {
		startedAt,
		completedAt,
	};
}

export function getMessageInterruption(
	message: Pick<RovoUIMessage, "metadata">
): RovoMessageInterruption | null {
	const interruption = message.metadata?.interruption;
	if (interruption?.status !== "interrupted") {
		return null;
	}

	return interruption;
}

export function getMessageText(
	message: Pick<RovoUIMessage, "parts">
): string {
	return message.parts
		.filter(isTextUIPart)
		.map((part) => part.text)
		.join("\n\n")
		.trim();
}

export function isMessageTextStreaming(
	message: Pick<RovoUIMessage, "parts">
): boolean {
	return message.parts.some(
		(part) => part.type === "text" && part.state === "streaming"
	);
}

export function getMessageReasoning(
	message: Pick<RovoUIMessage, "parts">
): { text: string; isStreaming: boolean } | null {
	const reasoningParts = message.parts.filter(isReasoningUIPart);
	if (reasoningParts.length === 0) {
		return null;
	}

	const text = reasoningParts
		.map((part) => part.text)
		.join("\n\n")
		.trim();
	const isStreaming = reasoningParts.some((part) => part.state === "streaming");
	if (text.length === 0 && !isStreaming) {
		return null;
	}

	return {
		text,
		isStreaming,
	};
}

export function getMessageSources(
	message: Pick<RovoUIMessage, "parts">
): RovoSourcePart[] {
	const sources = message.parts.filter(
		(part): part is RovoSourcePart =>
			part.type === "source-url" || part.type === "source-document"
	);
	const seenSourceIds = new Set<string>();

	return sources.filter((sourcePart) => {
		const sourceKey = `${sourcePart.type}:${sourcePart.sourceId}`;
		if (seenSourceIds.has(sourceKey)) {
			return false;
		}

		seenSourceIds.add(sourceKey);
		return true;
	});
}

export function getMessageArtifactResult(
	message: Pick<RovoUIMessage, "parts">
): RovoDataParts["artifact-result"] | null {
	return getLatestDataPart(message, "data-artifact-result")?.data ?? null;
}

export function getMessageAgentResult(
	message: Pick<RovoUIMessage, "parts">
): RovoDataParts["agent-result"] | null {
	return getLatestDataPart(message, "data-agent-result")?.data ?? null;
}

export function getMessageToolParts(
	message: Pick<RovoUIMessage, "parts">
): RovoToolPart[] {
	return message.parts.filter(isToolUIPart);
}

export function getThinkingEvents(
	message: Pick<RovoUIMessage, "parts">
): ThinkingEventUpdate[] {
	return getAllDataParts(message, "data-thinking-event").map((part) => part.data);
}

export interface ThinkingNarrationMap {
	/** Narration texts keyed by toolCallId */
	byToolCallId: Map<string, string[]>;
	/** Narration texts that don't precede any tool call */
	unassociated: string[];
}

/** A single narration row with optional per-row Parameters/Result detail. */
export interface ThinkingNarrationDetailRow {
	content: string;
	input?: unknown;
	output?: unknown;
}

export interface ThinkingNarrationDetailMap {
	/** Detail rows keyed by toolCallId, in chronological (streamed) order */
	byToolCallId: Map<string, ThinkingNarrationDetailRow[]>;
}

/**
 * Build a structured per-row narration map: each `data-thinking-status` part
 * that carries an explicit `toolCallId` becomes a {@link ThinkingNarrationDetailRow}
 * (content plus any per-row `input`/`output`) appended under that tool call.
 * Status parts without a `toolCallId` are skipped — the detail view is opt-in
 * and only the scripted demo trace stamps the id.
 */
export function buildThinkingNarrationDetailMap(
	message: Pick<RovoUIMessage, "parts">,
): ThinkingNarrationDetailMap {
	const byToolCallId = new Map<string, ThinkingNarrationDetailRow[]>();

	for (const part of message.parts) {
		if (part.type !== "data-thinking-status") {
			continue;
		}
		const data = (part as RovoDataPart<"thinking-status">).data;
		const toolCallId =
			typeof data.toolCallId === "string" && data.toolCallId.trim()
				? data.toolCallId.trim()
				: undefined;
		if (!toolCallId || typeof data.content !== "string" || !data.content.trim()) {
			continue;
		}

		const row: ThinkingNarrationDetailRow = { content: data.content.trim() };
		if (data.input !== undefined) {
			row.input = data.input;
		}
		if (data.output !== undefined) {
			row.output = data.output;
		}

		const existing = byToolCallId.get(toolCallId) ?? [];
		existing.push(row);
		byToolCallId.set(toolCallId, existing);
	}

	return { byToolCallId };
}

/**
 * Walk `message.parts` in chronological order to associate narration
 * (`data-thinking-status` content) with the tool call it belongs to.
 *
 * Two association modes coexist:
 *
 * 1. **Explicit** — when a status part carries its own `toolCallId`, the row is
 *    grouped directly under that id. This is authoritative and order-independent,
 *    so a step can stream several stacked rows (emitted before *and* after its
 *    own `start` event) without bleeding into adjacent steps.
 * 2. **Positional fallback** — for status parts without a `toolCallId` (real
 *    backends today), buffer consecutive rows and flush them into the next
 *    `data-thinking-event` `phase === "start"` bucket, matching the original
 *    behavior.
 *
 * Any leftover narration that never reaches a tool call is `unassociated`.
 */
export function buildThinkingNarrationMap(
	message: Pick<RovoUIMessage, "parts">,
): ThinkingNarrationMap {
	const byToolCallId = new Map<string, string[]>();
	let buffer: string[] = [];

	const appendToToolCall = (toolCallId: string, lines: string[]) => {
		if (lines.length === 0) {
			return;
		}
		const existing = byToolCallId.get(toolCallId) ?? [];
		existing.push(...lines);
		byToolCallId.set(toolCallId, existing);
	};

	for (const part of message.parts) {
		if (part.type === "data-thinking-status") {
			const data = (part as RovoDataPart<"thinking-status">).data;
			if (typeof data.content !== "string" || !data.content.trim()) {
				continue;
			}
			const line = data.content.trim();
			const explicitToolCallId =
				typeof data.toolCallId === "string" && data.toolCallId.trim()
					? data.toolCallId.trim()
					: undefined;
			if (explicitToolCallId) {
				appendToToolCall(explicitToolCallId, [line]);
			} else {
				buffer.push(line);
			}
			continue;
		}

		if (part.type === "data-thinking-event") {
			const data = (part as RovoDataPart<"thinking-event">).data;
			if (data.phase === "start" && buffer.length > 0) {
				const toolCallId =
					typeof data.toolCallId === "string" && data.toolCallId.trim()
						? data.toolCallId.trim()
						: undefined;
				if (toolCallId) {
					appendToToolCall(toolCallId, buffer);
					buffer = [];
				}
			}
		}
	}

	return { byToolCallId, unassociated: buffer };
}

export function getToolFirstWarning(
	message: RovoUIMessage
): ToolFirstWarningData | null {
	return getLatestDataPart(message, "data-tool-first-warning")?.data ?? null;
}

export function getThinkingToolCallSummaries(
	message: Pick<RovoUIMessage, "parts">
): ThinkingToolCallSummary[] {
	const events = getThinkingEvents(message);
	if (events.length === 0) {
		return [];
	}

	const summaries: ThinkingToolCallSummary[] = [];
	const summaryIndexByKey = new Map<string, number>();

	for (const [index, event] of events.entries()) {
		const eventId =
			typeof event.eventId === "string" && event.eventId.trim()
				? event.eventId.trim()
				: `thinking-event-${index}`;
		const toolCallId =
			typeof event.toolCallId === "string" && event.toolCallId.trim()
				? event.toolCallId.trim()
				: undefined;
		const key = toolCallId ? `call:${toolCallId}` : `event:${eventId}`;
		const toolName =
			typeof event.toolName === "string" && event.toolName.trim()
				? event.toolName.trim()
				: "Tool";
		const label =
			typeof event.label === "string" && event.label.trim()
				? event.label.trim()
				: undefined;
		const timestamp =
			typeof event.timestamp === "string" && event.timestamp.trim()
				? event.timestamp.trim()
				: undefined;
		const summaryIndex = summaryIndexByKey.get(key);
		const eventOutput = event.output;
		const eventOutputPreview =
			typeof event.outputPreview === "string"
				? event.outputPreview
				: typeof eventOutput === "string"
					? eventOutput
					: undefined;
		const eventOutputTruncated = event.outputTruncated === true;
		const eventOutputBytes =
			typeof event.outputBytes === "number" && Number.isFinite(event.outputBytes)
				? event.outputBytes
				: undefined;
		const eventSuppressedRawOutput = event.suppressedRawOutput === true;

		if (summaryIndex === undefined) {
			const summary: ThinkingToolCallSummary = {
				id: key,
				toolName,
				toolCallId,
				state: thinkingPhaseToState(event.phase, {
					permissionScenario: event.permissionScenario,
				}),
				input: event.input,
				output:
					event.phase === "result" || event.phase === "error"
						? eventOutput
						: undefined,
				outputPreview: extractOutputPreview(event.phase, eventOutputPreview),
				outputTruncated: eventOutputTruncated || undefined,
				outputBytes: eventOutputBytes,
				suppressedRawOutput: eventSuppressedRawOutput || undefined,
				errorText:
					event.phase === "error"
						? event.errorText ??
							(typeof eventOutputPreview === "string"
								? eventOutputPreview
								: undefined)
						: undefined,
				timestamp,
				mcpServer: typeof event.mcpServer === "string" && event.mcpServer.trim() ? event.mcpServer.trim() : undefined,
				permissionScenario: typeof event.permissionScenario === "string" && event.permissionScenario.trim() ? event.permissionScenario.trim() : undefined,
			};
			if (label) {
				summary.label = label;
			}
			summaries.push(summary);
			summaryIndexByKey.set(key, summaries.length - 1);
			continue;
		}

		const summary = summaries[summaryIndex];
		summary.toolName = toolName;
		summary.toolCallId = toolCallId;
		if (label) {
			summary.label = label;
		}
		if (timestamp) {
			summary.timestamp = timestamp;
		}
		if (typeof event.mcpServer === "string" && event.mcpServer.trim()) {
			summary.mcpServer = event.mcpServer.trim();
		}
		if (typeof event.permissionScenario === "string" && event.permissionScenario.trim()) {
			summary.permissionScenario = event.permissionScenario.trim();
		}
		if (event.phase === "start") {
			if (summary.state !== "completed" && summary.state !== "error") {
				summary.state = thinkingPhaseToState(event.phase, {
					permissionScenario: event.permissionScenario,
				});
			}
			if (event.input !== undefined) {
				summary.input = event.input;
			}
			continue;
		}
		if (event.phase === "result") {
			summary.state = "completed";
			summary.errorText = undefined;
			if (eventOutput !== undefined) {
				summary.output = eventOutput;
			}
			if (typeof eventOutputPreview === "string") {
				summary.outputPreview = eventOutputPreview;
			}
			if (eventOutputTruncated) {
				summary.outputTruncated = true;
			}
			if (eventOutputBytes !== undefined) {
				summary.outputBytes = eventOutputBytes;
			}
			if (eventSuppressedRawOutput) {
				summary.suppressedRawOutput = true;
			}
			continue;
		}
		summary.state = "error";
		if (eventOutput !== undefined) {
			summary.output = eventOutput;
		}
		if (typeof eventOutputPreview === "string") {
			summary.outputPreview = eventOutputPreview;
		}
		if (eventOutputTruncated) {
			summary.outputTruncated = true;
		}
		if (eventOutputBytes !== undefined) {
			summary.outputBytes = eventOutputBytes;
		}
		if (eventSuppressedRawOutput) {
			summary.suppressedRawOutput = true;
		}
		summary.errorText =
			event.errorText ??
			(typeof eventOutputPreview === "string"
				? eventOutputPreview
				: summary.errorText);
	}

	if (hasTurnCompleteSignal(message)) {
		const agentExecutionUpdates = getAgentExecutionUpdates(message);
		for (const summary of summaries) {
			if (
				summary.state !== "running" &&
				summary.state !== "approval-requested"
			) {
				continue;
			}

			const isRequestUserInput = isRequestUserInputToolName(summary.toolName);
			summary.state = isRequestUserInput ? "awaiting-input" : "completed";
			if (summary.output !== undefined || summary.outputPreview || summary.errorText) {
				continue;
			}

			const hasSubagentExecution =
				summary.toolName === "invoke_subagents" &&
				agentExecutionUpdates.some((update) => update.taskId.trim().length > 0);
			const completionNote = isRequestUserInput
				? "Awaiting your answers in the question card."
				: hasSubagentExecution
					? "Subagent exploration completed, but the parent tool did not emit a final result event."
					: "Tool finished without an explicit result event.";
			summary.output = completionNote;
			summary.outputPreview = completionNote;
		}
	}

	return summaries;
}

export function getAgentExecutionUpdates(
	message: Pick<RovoUIMessage, "parts">
): AgentExecutionUpdate[] {
	return getAllDataParts(message, "data-agent-execution")
		.map((part) => part.data)
		.filter(
			(update): update is AgentExecutionUpdate =>
				typeof update?.agentId === "string" &&
				update.agentId.trim().length > 0 &&
				typeof update?.taskId === "string" &&
				update.taskId.trim().length > 0
		);
}

export function getAgentExecutionSummaries(
	message: Pick<RovoUIMessage, "parts">
): AgentExecutionSummary[] {
	const updates = getAgentExecutionUpdates(message);
	if (updates.length === 0) {
		return [];
	}

	const summaries: AgentExecutionSummary[] = [];
	const summaryIndexByTaskId = new Map<string, number>();

	for (const update of updates) {
		const summaryIndex = summaryIndexByTaskId.get(update.taskId);
		if (summaryIndex === undefined) {
			summaries.push({
				agentId: update.agentId,
				agentName: update.agentName,
				taskId: update.taskId,
				taskLabel: update.taskLabel,
				status: update.status,
				content: update.content ?? "",
			});
			summaryIndexByTaskId.set(update.taskId, summaries.length - 1);
			continue;
		}

		const summary = summaries[summaryIndex];
		summary.agentId = update.agentId;
		summary.agentName = update.agentName;
		summary.taskId = update.taskId;
		summary.taskLabel = update.taskLabel;
		summary.status = update.status;
		if (update.content) {
			summary.content = `${summary.content}${update.content}`;
		}
	}

	return summaries;
}

export function getLatestTodoQueue(
	message: Pick<RovoUIMessage, "parts">
): RovoDataParts["todo-queue"] | null {
	return getLatestDataPart(message, "data-todo-queue")?.data ?? null;
}

export function getToolPartName(toolPart: RovoToolPart): string {
	return getToolName(toolPart);
}

function hasCreatePlanSignal(value: unknown): boolean {
	if (typeof value !== "string") {
		return false;
	}

	return CREATE_PLAN_SIGNAL_REGEX.test(value);
}

export function hasCreatePlanSkillSignal(
	message: Pick<RovoUIMessage, "parts">
): boolean {
	if (hasCreatePlanSignal(getMessageText(message))) {
		return true;
	}

	const thinkingStatusParts = getAllDataParts(message, "data-thinking-status");
	for (const part of thinkingStatusParts) {
		if (
			hasCreatePlanSignal(part.data.label) ||
			hasCreatePlanSignal(part.data.content)
		) {
			return true;
		}
	}

	const toolParts = getMessageToolParts(message);
	for (const toolPart of toolParts) {
		if (hasCreatePlanSignal(getToolPartName(toolPart))) {
			return true;
		}
	}

	return false;
}
