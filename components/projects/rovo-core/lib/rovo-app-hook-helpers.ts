import type { FileUIPart } from "ai";
import {
	buildClarificationDismissPrompt,
	buildClarificationMessageMetadata,
	buildClarificationSummaryPrompt,
	buildDeferredToolResponse,
	createClarificationSubmission,
	type ClarificationAnswers,
	type ParsedQuestionCardPayload,
} from "@/components/projects/shared/lib/question-card-widget";
import {
	getLatestDataPart,
	getMessageArtifactResult,
	getMessageText,
	type RovoMessageMetadata,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import {
	type RovoAppCreationMode,
	type RovoAppDocument,
	type RovoAppDocumentKind,
	type RovoAppPromptMode,
	type RovoAppQueuedDelegationAction,
	type RovoAppQueuedPromptAction,
	type RovoAppVote,
	type VoteValue,
} from "@/lib/rovo-app-types";
import { createId, sortByUpdatedAtDesc } from "@/lib/utils";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";
import type { RovoAppArtifactContextPayload } from "@/components/projects/rovo-core/lib/rovo-app-chat-request-body";
export {
	buildRovoAppPromptModeMetadata,
	resolveRovoAppDelegationDispatch,
	resolveRovoAppDispatchQueueDecision,
	resolveRovoAppPromptDispatch,
	resolveRovoAppQueuedActionDispatch,
	type RovoAppDelegationDispatchResolution,
	type RovoAppDispatchQueueDecision,
	type RovoAppPromptDispatchResolution,
	type RovoAppQueuedActionDispatchResolution,
	type RovoAppQueuedDelegationDispatchOptions,
	type RovoAppQueuedPromptDispatchPayload,
	type RovoAppSendMode,
	type RovoAppSendModeSetter,
} from "@/components/projects/rovo-core/lib/rovo-app-dispatch";
export {
	ROVO_APP_PLAN_MODE_CONTEXT,
	ROVO_APP_VOICE_MODE_CONTEXT,
	buildActiveArtifactMetadata,
	buildArtifactContextPayload,
	buildRecentHistory,
	buildRovoAppChatRequestBody,
	resolveActiveArtifactContext,
	type BuildRovoAppChatRequestBodyInput,
	type RovoAppArtifactContextPayload,
	type RovoAppChatRequestBody,
	type RovoAppChatRequestBodyInput,
} from "@/components/projects/rovo-core/lib/rovo-app-chat-request-body";

export const ROVO_APP_PLAN_MODE_POST_CLARIFICATION_CONTEXT = [
	"[POST-CLARIFICATION — Plan Mode]",
	"Plan mode is enabled. The user has already answered clarification questions for this planning request.",
	"If the answers provide enough detail, proceed directly to plan generation now by calling exit_plan_mode with a concise markdown plan.",
	"If essential details are still missing, you may call ask_user_questions again to gather what you need before planning.",
	"Use the answered clarification details to finish planning, not implementation.",
	"Do not use free-form text, suggestion chips, invoke_subagents, or update_todo as a substitute for the exit_plan_mode handoff.",
	"[End POST-CLARIFICATION]",
].join(" ");

export const ROVO_APP_PLAN_MODE_RETRY_PROMPT = [
	"The previous response did not include a plan widget with tasks.",
	"If you still need essential details, you may ask clarification questions. Otherwise, generate the plan.",
	"Generate the plan now by calling exit_plan_mode with a concise markdown plan.",
	"Do not explore the codebase. Do not use workspace tools.",
	"Your only action: call exit_plan_mode with the plan.",
].join(" ");

export const ROVO_APP_AGENT_CREATION_POST_CLARIFICATION_CONTEXT = [
	"[POST-CLARIFICATION — Studio Agent Creation]",
	"The user has answered clarification questions for a Studio agent creation request.",
	"Use the answers to finish a reusable session-local agent profile.",
	"If required profile fields are still missing, ask another concise question-card round.",
	"Otherwise, emit the required structured agent result for selection in Studio.",
	"[End POST-CLARIFICATION]",
].join(" ");

export type RovoAppPlanningPhase = "awaiting-plan" | "retrying-missing-plan";

export interface RovoAppPlanningSession {
	requestId: number;
	phase: RovoAppPlanningPhase;
	hasStreamStarted: boolean;
	retryUsed: boolean;
	baselineAssistantMessageId: string | null;
}

interface RovoAppPlanningSessionStartInput {
	requestId: number;
	baselineAssistantMessageId: string | null;
}

export interface RovoAppArtifactSteeringPayload {
	preferCurrentArtifact: true;
	source: "voice";
}

export interface RovoAppClarificationSubmitOptions {
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	onSubmitted?: () => void;
}

export interface RovoAppPlanRetryPayload {
	body: {
		contextDescription: string;
		id: string;
		isPlanMode: true;
		sessionId: string;
		sessionMode: "persistent" | "ephemeral";
	};
	metadata: RovoMessageMetadata;
	text: string;
}

export interface RovoAppStreamingArtifactSendPayload {
	content: string;
	id: string;
	kind: string;
	title: string;
}

interface BuildRovoAppQueuedPromptActionInput {
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	files: ReadonlyArray<FileUIPart>;
	messageMetadata?: RovoMessageMetadata;
	mode: RovoAppPromptMode;
	text: string;
	threadId: string;
}

interface BuildRovoAppQueuedDelegationActionInput {
	contextDescription?: string;
	conversationSummary?: string;
	delegatedMessageId: string;
	existingRealtimeMessageId?: string | null;
	intentType?: string;
	prompt: string;
	referencedFiles?: string[];
	threadId: string;
	urgency?: string;
}

interface BuildRovoAppPromptSendBodyInput {
	artifactContext: RovoAppArtifactContextPayload | null;
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	isPlanMode: boolean;
	streamingArtifact?: RovoAppStreamingArtifactSendPayload;
	threadId: string;
}

interface BuildRovoAppStreamingArtifactSendPayloadInput {
	currentArtifact: RovoAppStreamingArtifact;
	freshSnapshot?: RovoAppStreamingArtifact | null;
}

interface BuildRovoAppClarificationPayloadInput {
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	questionCard: ParsedQuestionCardPayload;
	threadId: string;
	wasPlanModeActive: boolean;
}

interface BuildRovoAppClarificationAnswerPayloadInput
	extends BuildRovoAppClarificationPayloadInput {
	answers: ClarificationAnswers;
}

interface ResolveRovoAppClarificationPlanModeInput {
	creationMode?: RovoAppCreationMode;
	hasDeferredToolCall?: boolean;
	includeDeferredToolPlanMode?: boolean;
	isPlanModeActive: boolean;
}

interface ResolveRovoAppClarificationContextInput {
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	wasPlanModeActive: boolean;
}

export interface RovoAppPromptSendBody extends Record<string, unknown> {
	artifactContext?: RovoAppArtifactContextPayload;
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	id: string;
	isPlanMode: boolean;
	streamingArtifact?: RovoAppStreamingArtifactSendPayload;
}

export interface RovoAppClarificationPayload {
	body: Record<string, unknown>;
	metadata: RovoMessageMetadata;
	text: string;
}

export function deriveThreadTitle(promptText: string): string {
	const firstLine = promptText
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
	return firstLine?.slice(0, 80) || "New chat";
}

export function createRovoAppQueueItemId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return createId("rovo-app-queue");
}

export function createRovoAppPlanningSession({
	requestId,
	baselineAssistantMessageId,
}: RovoAppPlanningSessionStartInput): RovoAppPlanningSession {
	return {
		requestId,
		phase: "awaiting-plan",
		hasStreamStarted: false,
		retryUsed: false,
		baselineAssistantMessageId,
	};
}

export function restartRovoAppPlanningSession(
	currentSession: RovoAppPlanningSession | null,
	input: RovoAppPlanningSessionStartInput,
): RovoAppPlanningSession {
	if (!currentSession) {
		return createRovoAppPlanningSession(input);
	}

	return {
		...currentSession,
		phase: "awaiting-plan",
		hasStreamStarted: false,
		baselineAssistantMessageId: input.baselineAssistantMessageId,
	};
}

export function markRovoAppPlanningSessionStreamStarted(
	currentSession: RovoAppPlanningSession | null,
): RovoAppPlanningSession | null {
	if (!currentSession || currentSession.hasStreamStarted) {
		return currentSession;
	}

	return {
		...currentSession,
		hasStreamStarted: true,
	};
}

export function markRovoAppPlanningSessionRetrying(
	currentSession: RovoAppPlanningSession | null,
	baselineAssistantMessageId: string | null,
): RovoAppPlanningSession | null {
	if (!currentSession) {
		return currentSession;
	}

	return {
		...currentSession,
		phase: "retrying-missing-plan",
		retryUsed: true,
		hasStreamStarted: false,
		baselineAssistantMessageId,
	};
}

export function buildRovoAppPlanRetryPayload({
	sessionId,
	sessionMode,
	threadId,
}: {
	sessionId: string;
	sessionMode?: "persistent" | "ephemeral" | null;
	threadId: string;
}): RovoAppPlanRetryPayload {
	return {
		body: {
			id: threadId,
			isPlanMode: true,
			contextDescription: ROVO_APP_PLAN_MODE_POST_CLARIFICATION_CONTEXT,
			sessionId,
			sessionMode: sessionMode ?? "persistent",
		},
		metadata: {
			visibility: "hidden",
			source: "plan-retry",
		},
		text: ROVO_APP_PLAN_MODE_RETRY_PROMPT,
	};
}

export function resolveRovoAppClarificationPlanMode({
	creationMode,
	hasDeferredToolCall = false,
	includeDeferredToolPlanMode = false,
	isPlanModeActive,
}: ResolveRovoAppClarificationPlanModeInput): boolean {
	if (creationMode) {
		return false;
	}

	return isPlanModeActive || (includeDeferredToolPlanMode && hasDeferredToolCall);
}

export function resolveRovoAppClarificationContextDescription({
	contextDescription,
	creationMode,
	wasPlanModeActive,
}: ResolveRovoAppClarificationContextInput): string | undefined {
	if (contextDescription?.trim()) {
		return contextDescription.trim();
	}

	if (creationMode === "agent") {
		return ROVO_APP_AGENT_CREATION_POST_CLARIFICATION_CONTEXT;
	}

	return wasPlanModeActive ? ROVO_APP_PLAN_MODE_POST_CLARIFICATION_CONTEXT : undefined;
}

export function upsertDocumentRecord(
	documents: ReadonlyArray<RovoAppDocument>,
	nextDocument: RovoAppDocument,
): RovoAppDocument[] {
	const withoutPrevious = documents.filter((document) => document.id !== nextDocument.id);
	return sortByUpdatedAtDesc([nextDocument, ...withoutPrevious]);
}

export function buildVotesMap(votes: ReadonlyArray<RovoAppVote>): Record<string, VoteValue> {
	return votes.reduce<Record<string, VoteValue>>((result, vote) => {
		if (vote.value === "up" || vote.value === "down") {
			result[vote.messageId] = vote.value;
		}
		return result;
	}, {});
}

export function applyRovoAppVoteToMap(
	currentVotes: Readonly<Record<string, VoteValue>>,
	vote: Pick<RovoAppVote, "messageId" | "value">,
): Record<string, VoteValue> {
	const nextVotes = { ...currentVotes };
	if (vote.value === "up" || vote.value === "down") {
		nextVotes[vote.messageId] = vote.value;
	} else {
		delete nextVotes[vote.messageId];
	}
	return nextVotes;
}

export function inferArtifactKind(message: RovoUIMessage, content: string): RovoAppDocumentKind {
	if (
		/^\s*\{\s*"type"\s*:\s*"excalidraw"/iu.test(content) &&
		/"elements"\s*:\s*\[/iu.test(content)
	) {
		return "excalidraw";
	}

	if (/```[\w-]*[\s\S]+```/u.test(content)) {
		return "code";
	}

	const widget = getLatestDataPart(message, "data-widget-data");
	if (widget?.data?.type === "image-preview") {
		return "image";
	}
	if (widget?.data?.type === "table") {
		return "sheet";
	}
	if (
		widget?.data?.type === "genui-preview" &&
		widget.data.payload &&
		typeof widget.data.payload === "object" &&
		"body" in widget.data.payload &&
		widget.data.payload.body &&
		typeof widget.data.payload.body === "object" &&
		"kind" in widget.data.payload.body &&
		widget.data.payload.body.kind === "excalidraw"
	) {
		return "excalidraw";
	}

	return "text";
}

export function buildArtifactContentFromMessage(message: RovoUIMessage): string {
	const text = getMessageText(message);
	if (text) {
		return text;
	}

	const widget = getLatestDataPart(message, "data-widget-data");
	if (!widget) {
		return "";
	}

	try {
		return JSON.stringify(widget.data.payload, null, 2);
	} catch {
		return String(widget.data.payload ?? "");
	}
}

export function getRovoAppArtifactDocumentIdsFromMessages(
	messages: ReadonlyArray<RovoUIMessage>,
): string[] {
	const seenDocumentIds = new Set<string>();
	const documentIds: string[] = [];

	for (const message of messages) {
		const artifactResult = getMessageArtifactResult(message);
		if (!artifactResult?.documentId || seenDocumentIds.has(artifactResult.documentId)) {
			continue;
		}

		seenDocumentIds.add(artifactResult.documentId);
		documentIds.push(artifactResult.documentId);
	}

	return documentIds;
}

export function waitForRovoApp(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

export function pushRovoAppHistoryPath(path: string): void {
	window.history.pushState(null, "", path);
}

export function replaceRovoAppHistoryPath(path: string): void {
	window.history.replaceState(null, "", path);
}

export function buildRovoAppQueuedPromptAction({
	contextDescription,
	creationMode,
	files,
	messageMetadata,
	mode,
	text,
	threadId,
}: BuildRovoAppQueuedPromptActionInput): RovoAppQueuedPromptAction {
	return {
		id: createRovoAppQueueItemId(),
		threadId,
		text,
		createdAt: Date.now(),
		kind: "prompt",
		files: [...files],
		contextDescription,
		...(creationMode ? { creationMode } : {}),
		messageMetadata,
		mode,
	};
}

export function buildRovoAppQueuedDelegationAction({
	contextDescription,
	conversationSummary,
	delegatedMessageId,
	existingRealtimeMessageId,
	intentType,
	prompt,
	referencedFiles,
	threadId,
	urgency,
}: BuildRovoAppQueuedDelegationActionInput): RovoAppQueuedDelegationAction {
	return {
		id: createRovoAppQueueItemId(),
		threadId,
		text: prompt,
		createdAt: Date.now(),
		kind: "delegation",
		contextDescription,
		conversationSummary,
		delegatedMessageId,
		existingRealtimeMessageId,
		intentType,
		referencedFiles,
		urgency,
	};
}

export function buildRovoAppPromptSendBody({
	artifactContext,
	contextDescription,
	creationMode,
	isPlanMode,
	streamingArtifact,
	threadId,
}: BuildRovoAppPromptSendBodyInput): RovoAppPromptSendBody {
	return {
		id: threadId,
		artifactContext: artifactContext ?? undefined,
		contextDescription,
		...(creationMode ? { creationMode } : {}),
		isPlanMode,
		streamingArtifact,
	};
}

export function buildRovoAppStreamingArtifactSendPayload({
	currentArtifact,
	freshSnapshot,
}: BuildRovoAppStreamingArtifactSendPayloadInput): RovoAppStreamingArtifactSendPayload {
	return {
		id: freshSnapshot?.documentId ?? currentArtifact.documentId!,
		title: freshSnapshot?.title ?? currentArtifact.title,
		kind: freshSnapshot?.kind ?? currentArtifact.kind,
		content: freshSnapshot?.content ?? currentArtifact.content,
	};
}

function buildRovoAppClarificationBody({
	clarification,
	contextDescription,
	creationMode,
	deferredToolResponse,
	threadId,
	wasPlanModeActive,
}: {
	clarification?: unknown;
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	deferredToolResponse?: unknown;
	threadId: string;
	wasPlanModeActive: boolean;
}): Record<string, unknown> {
	return {
		id: threadId,
		isPlanMode: wasPlanModeActive || undefined,
		contextDescription,
		...(creationMode ? { creationMode } : {}),
		...(clarification ? { clarification } : {}),
		deferredToolResponse: deferredToolResponse ?? undefined,
	};
}

export function buildRovoAppClarificationAnswerPayload({
	answers,
	contextDescription,
	creationMode,
	questionCard,
	threadId,
	wasPlanModeActive,
}: BuildRovoAppClarificationAnswerPayloadInput): RovoAppClarificationPayload {
	const submission = createClarificationSubmission(questionCard, answers);
	const deferredToolCallId = questionCard.deferredToolCallId;
	const deferredToolResponse = buildDeferredToolResponse(questionCard, answers);
	return {
		body: buildRovoAppClarificationBody({
			clarification: {
				...submission,
				status: "answered",
				toolCallId: deferredToolCallId ?? submission.toolCallId,
				deferredToolCallId: deferredToolCallId ?? submission.deferredToolCallId,
			},
			contextDescription,
			creationMode,
			deferredToolResponse,
			threadId,
			wasPlanModeActive,
		}),
		metadata: buildClarificationMessageMetadata(questionCard, {
			answers,
			...(creationMode ? { creationMode } : {}),
			status: "answered",
		}),
		text: buildClarificationSummaryPrompt(questionCard, answers),
	};
}

export function buildRovoAppClarificationDismissPayload({
	contextDescription,
	creationMode,
	questionCard,
	threadId,
	wasPlanModeActive,
}: BuildRovoAppClarificationPayloadInput): RovoAppClarificationPayload {
	return {
		body: {
			id: threadId,
			isPlanMode: wasPlanModeActive || undefined,
			contextDescription,
			...(creationMode ? { creationMode } : {}),
		},
		metadata: buildClarificationMessageMetadata(questionCard, {
			...(creationMode ? { creationMode } : {}),
			status: "dismissed",
		}),
		text: buildClarificationDismissPrompt(questionCard),
	};
}

export function buildRovoAppDeferredClarificationDismissPayload({
	contextDescription,
	creationMode,
	questionCard,
	threadId,
	wasPlanModeActive,
}: BuildRovoAppClarificationPayloadInput): RovoAppClarificationPayload {
	const emptyAnswers: ClarificationAnswers = {};
	const submission = createClarificationSubmission(questionCard, emptyAnswers);
	const deferredToolCallId = questionCard.deferredToolCallId;
	const toolCallId =
		deferredToolCallId ?? questionCard.toolCallId ?? submission.toolCallId;
	const dismissPrompt = buildClarificationDismissPrompt(questionCard);

	return {
		body: buildRovoAppClarificationBody({
			clarification: {
				...submission,
				status: "dismissed",
				toolCallId: deferredToolCallId ?? submission.toolCallId,
				deferredToolCallId: deferredToolCallId ?? submission.deferredToolCallId,
			},
			contextDescription,
			creationMode,
			deferredToolResponse: toolCallId
				? {
					tool_call_id: toolCallId,
					result: dismissPrompt,
				}
				: undefined,
			threadId,
			wasPlanModeActive,
		}),
		metadata: buildClarificationMessageMetadata(questionCard, {
			...(creationMode ? { creationMode } : {}),
			status: "dismissed",
		}),
		text: dismissPrompt,
	};
}

export function meetsStreamingAutoOpenContentThreshold(
	artifact: RovoAppStreamingArtifact | null,
): boolean {
	if (!artifact?.documentId) {
		return false;
	}

	if (artifact.kind === "sheet") {
		return artifact.content.trim().length > 0;
	}

	if (artifact.kind === "code") {
		return artifact.content.length >= 300;
	}

	if (artifact.kind === "image") {
		return artifact.content.trim().length > 0;
	}

	return artifact.content.length >= 400;
}
