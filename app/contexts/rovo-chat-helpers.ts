import type { FileUIPart } from "ai";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import {
	appendTurnCompleteToLastAssistantMessage,
	markClarificationToolResolved,
} from "@/components/projects/rovo-core/lib/rovo-app-streaming-assistant";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import { getRovoAgentPromptContext } from "@/app/data/directory/agents";
import {
	type RovoAppThread,
} from "@/lib/rovo-app-types";
import { mergeRovoContextDescriptions } from "@/lib/rovo-context";
import {
	getMessageText,
	type RovoMessageMetadata,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import {
	buildWorkItemReportRequestContext,
	isWorkItemReportIntent,
	VPK_HTML_SKILL_ID,
} from "@/lib/work-item-report-intent";

export interface SendPromptOptions {
	backendPreference?: "rovo" | "ai-gateway";
	contextDescription?: string;
	userName?: string;
	clientTimeZone?: string;
	messageMetadata?: RovoMessageMetadata;
	clarification?: unknown;
	approval?: unknown;
	deferredToolResponse?: {
		tool_call_id: string;
		result: unknown;
	};
	planRequestId?: string;
	creationMode?: "skill" | "agent";
	smartGeneration?: {
		enabled?: boolean;
		surface?: string;
		containerWidthPx?: number;
		viewportWidthPx?: number;
		widthClass?: "compact" | "regular" | "wide";
	};
}

export interface QueuedPromptItem {
	id: string;
	files: FileUIPart[];
	text: string;
	options?: SendPromptOptions;
	createdAt: number;
}

export function clearSkillInvocationForEdit(
	metadata: RovoMessageMetadata | undefined,
): RovoMessageMetadata | undefined {
	if (!metadata?.skillInvocation) return metadata;
	const nextMetadata = { ...metadata };
	delete nextMetadata.skillInvocation;
	return nextMetadata;
}

type RovoUIMessagePart = RovoUIMessage["parts"][number];

const INLINE_DATA_PLACEHOLDER = "[inline data omitted]";
const CHAT_REQUEST_MAX_BYTES = 4 * 1024 * 1024;
const CHAT_REQUEST_MIN_MESSAGES = 8;
const TURN_COMPLETE_TIMESTAMP_TOLERANCE_MS = 1_000;

type AgentSelectorProfile = Pick<
	RovoAgentProfile,
	"avatarSrc" | "brandName" | "byline" | "id" | "logoName" | "name"
>;

function toAgentSelectorAgent(agent: AgentSelectorProfile): AgentSelectorAgent {
	return {
		id: agent.id,
		name: agent.name,
		byline: agent.byline,
		avatarSrc: agent.avatarSrc,
		logoName: agent.logoName,
		brandName: agent.brandName,
	};
}

export function buildSelectableAgents(
	staticAgents: readonly AgentSelectorProfile[],
	sessionEntries: readonly { profile: AgentSelectorProfile }[],
): readonly AgentSelectorAgent[] {
	const sessionAgentById = new Map(
		sessionEntries.map((entry) => [
			entry.profile.id,
			toAgentSelectorAgent(entry.profile),
		]),
	);
	const orderedAgents = staticAgents.map((agent) => {
		const sessionOverride = sessionAgentById.get(agent.id);
		if (sessionOverride) {
			sessionAgentById.delete(agent.id);
			return sessionOverride;
		}
		return toAgentSelectorAgent(agent);
	});
	orderedAgents.push(...sessionAgentById.values());
	return orderedAgents;
}

function resolveClientTimeZone(explicitTimeZone?: string): string | undefined {
	if (typeof explicitTimeZone === "string" && explicitTimeZone.trim().length > 0) {
		return explicitTimeZone.trim();
	}

	try {
		const inferredTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return typeof inferredTimeZone === "string" && inferredTimeZone.trim().length > 0
			? inferredTimeZone.trim()
			: undefined;
	} catch {
		return undefined;
	}
}

export function buildSendMessageBody(
	options: SendPromptOptions | undefined,
	hasQueuedPrompts: boolean,
): Record<string, unknown> {
	return {
		backendPreference: options?.backendPreference,
		contextDescription: options?.contextDescription,
		userName: options?.userName,
		clientTimeZone: resolveClientTimeZone(options?.clientTimeZone),
		clarification: options?.clarification,
		approval: options?.approval,
		deferredToolResponse: options?.deferredToolResponse,
		planRequestId: options?.planRequestId,
		creationMode: options?.creationMode,
		smartGeneration: options?.smartGeneration,
		hasQueuedPrompts,
	};
}

function mergePromptOptionObject<T extends object>(
	defaultValue: T | undefined,
	value: T | undefined,
): T | undefined {
	if (!defaultValue && !value) {
		return undefined;
	}

	return {
		...(defaultValue ?? {}),
		...(value ?? {}),
	} as T;
}

export function resolveWorkItemReportPromptOptions(
	prompt: string,
	options?: SendPromptOptions,
): SendPromptOptions | undefined {
	if (options?.creationMode === "agent") {
		return options;
	}

	if (!isWorkItemReportIntent(prompt)) {
		return options;
	}

	const reportContextBlock = buildWorkItemReportRequestContext({
		contextDescription: options?.contextDescription,
		promptText: prompt,
		skillId: VPK_HTML_SKILL_ID,
	});
	if (!reportContextBlock) {
		return options;
	}

	return {
		...(options ?? {}),
		contextDescription: mergeRovoContextDescriptions(
			options?.contextDescription,
			reportContextBlock,
		),
	};
}

export function mergeSendPromptOptions(
	defaultOptions?: SendPromptOptions,
	options?: SendPromptOptions,
): SendPromptOptions | undefined {
	if (!defaultOptions) return options;
	if (!options) return defaultOptions;

	return {
		...defaultOptions,
		...options,
		contextDescription: mergeRovoContextDescriptions(
			defaultOptions.contextDescription,
			options.contextDescription,
		),
		messageMetadata: mergePromptOptionObject(
			defaultOptions.messageMetadata,
			options.messageMetadata,
		),
		smartGeneration: mergePromptOptionObject(
			defaultOptions.smartGeneration,
			options.smartGeneration,
		),
	};
}

export function mergeSelectedAgentPromptOptions(
	options: SendPromptOptions | undefined,
	selectedAgent: RovoAgentProfile,
): SendPromptOptions | undefined {
	const selectedAgentContext = getRovoAgentPromptContext(selectedAgent);
	if (!selectedAgentContext) {
		return options;
	}

	return {
		...(options ?? {}),
		contextDescription: mergeRovoContextDescriptions(
			options?.contextDescription,
			selectedAgentContext,
		),
	};
}

function isValidRovoUiMessagePart(part: unknown): part is RovoUIMessagePart {
	return (
		typeof part === "object" &&
		part !== null &&
		typeof (part as { type?: unknown }).type === "string"
	);
}

function isDataUrl(value: string): boolean {
	return /^data:[^,]+,/i.test(value);
}

export function sanitizeValueForTransport(value: unknown): unknown {
	if (typeof value === "string") {
		return isDataUrl(value) ? INLINE_DATA_PLACEHOLDER : value;
	}

	if (Array.isArray(value)) {
		let hasChanged = false;
		const next = value.map((item) => {
			const sanitized = sanitizeValueForTransport(item);
			if (sanitized !== item) {
				hasChanged = true;
			}
			return sanitized;
		});
		return hasChanged ? next : value;
	}

	if (!value || typeof value !== "object") {
		return value;
	}

	let hasChanged = false;
	const record = value as Record<string, unknown>;
	const nextRecord: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(record)) {
		const sanitized = sanitizeValueForTransport(item);
		nextRecord[key] = sanitized;
		if (sanitized !== item) {
			hasChanged = true;
		}
	}

	return hasChanged ? nextRecord : value;
}

function sanitizeMessagePartForTransport(part: RovoUIMessagePart): RovoUIMessagePart | null {
	if (part.type === "file" && isDataUrl(part.url)) {
		return null;
	}

	return sanitizeValueForTransport(part) as RovoUIMessagePart;
}

export function sanitizeRovoUiMessages(
	messages: ReadonlyArray<RovoUIMessage>,
): RovoUIMessage[] {
	let hasChanged = false;

	const nextMessages = messages.map((message) => {
		const hasPartsArray = Array.isArray(message.parts);
		const messageParts = hasPartsArray ? message.parts : [];
		const nextParts = messageParts.filter(isValidRovoUiMessagePart);

		if (!hasPartsArray || nextParts.length !== messageParts.length) {
			hasChanged = true;
			return { ...message, parts: nextParts };
		}

		return message;
	});

	return hasChanged ? nextMessages : (messages as RovoUIMessage[]);
}

export function isClarificationResolutionPrompt(options: SendPromptOptions | undefined): boolean {
	return Boolean(options?.clarification) || options?.messageMetadata?.source === "clarification-submit";
}

function getClarificationResolutionOutput(options: SendPromptOptions | undefined): string {
	return options?.messageMetadata?.clarificationStatus === "dismissed"
		? "Question dismissed."
		: "Answers received.";
}

function getTurnCompleteTimestampMs(message: RovoUIMessage): number | null | undefined {
	for (let index = message.parts.length - 1; index >= 0; index -= 1) {
		const part = message.parts[index];
		if (part.type !== "data-turn-complete") {
			continue;
		}

		const timestamp = (part as { data?: { timestamp?: unknown } }).data?.timestamp;
		if (typeof timestamp !== "string") {
			return null;
		}

		const timestampMs = Date.parse(timestamp);
		return Number.isFinite(timestampMs) ? timestampMs : null;
	}

	return undefined;
}

export function hasTurnCompleteForPrompt(
	message: RovoUIMessage,
	prompt: QueuedPromptItem,
): boolean {
	const timestampMs = getTurnCompleteTimestampMs(message);
	if (timestampMs === undefined) {
		return false;
	}

	return (
		timestampMs === null ||
		timestampMs + TURN_COMPLETE_TIMESTAMP_TOLERANCE_MS >= prompt.createdAt
	);
}

function getFileSignature(file: FileUIPart): string {
	return [
		file.url,
		file.filename ?? "",
		file.mediaType ?? "",
	].join("\u0000");
}

function hasMatchingFileParts(
	message: RovoUIMessage,
	files: ReadonlyArray<FileUIPart>,
): boolean {
	if (files.length === 0) {
		return false;
	}

	const messageFileSignatures = new Set(
		message.parts
			.filter((part): part is FileUIPart => part.type === "file")
			.map(getFileSignature),
	);

	return files.every((file) => messageFileSignatures.has(getFileSignature(file)));
}

export function didAssistantCompleteActivePrompt(
	messages: ReadonlyArray<RovoUIMessage>,
	assistantIndex: number,
	prompt: QueuedPromptItem,
): boolean {
	const promptText = prompt.text.trim();
	for (let index = assistantIndex - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === "assistant") {
			return false;
		}

		if (message.role !== "user") {
			continue;
		}

		return (
			(promptText.length > 0 && getMessageText(message).trim() === promptText) ||
			hasMatchingFileParts(message, prompt.files)
		);
	}

	return false;
}

export function markPendingClarificationResolvedInMessages(
	messages: ReadonlyArray<RovoUIMessage>,
	options: SendPromptOptions | undefined,
): RovoUIMessage[] {
	const resolved = markClarificationToolResolved(
		sanitizeRovoUiMessages(messages),
		getClarificationResolutionOutput(options),
	);

	return appendTurnCompleteToLastAssistantMessage(resolved).messages;
}

export function sanitizeMessagesForTransport(
	messages: ReadonlyArray<RovoUIMessage>,
): RovoUIMessage[] {
	let hasChanged = false;

	const nextMessages = messages.map((message) => {
		const nextParts: RovoUIMessagePart[] = [];
		const hasPartsArray = Array.isArray(message.parts);
		let messageChanged = !hasPartsArray;
		const messageParts = hasPartsArray ? message.parts : [];
		if (messageChanged) {
			hasChanged = true;
		}

		for (const part of messageParts) {
			const sanitizedPart = sanitizeMessagePartForTransport(part);
			if (!sanitizedPart) {
				hasChanged = true;
				messageChanged = true;
				continue;
			}
			if (sanitizedPart !== part) {
				hasChanged = true;
				messageChanged = true;
			}
			nextParts.push(sanitizedPart);
		}

		if (!messageChanged) {
			return message;
		}

		return { ...message, parts: nextParts };
	});

	return hasChanged ? nextMessages : (messages as RovoUIMessage[]);
}

function estimateChatRequestBytes(
	messages: ReadonlyArray<RovoUIMessage>,
	body: Record<string, unknown>,
): number {
	try {
		const json = JSON.stringify({
			...body,
			messages,
		});
		return new TextEncoder().encode(json).byteLength;
	} catch {
		return Number.POSITIVE_INFINITY;
	}
}

export function trimMessagesForRequestSize(
	messages: ReadonlyArray<RovoUIMessage>,
	body: Record<string, unknown>,
): { messages: RovoUIMessage[]; trimmed: boolean } {
	if (messages.length <= CHAT_REQUEST_MIN_MESSAGES) {
		return {
			messages: [...messages],
			trimmed: false,
		};
	}

	const nextMessages = [...messages];
	let trimmed = false;
	while (
		nextMessages.length > CHAT_REQUEST_MIN_MESSAGES &&
		estimateChatRequestBytes(nextMessages, body) > CHAT_REQUEST_MAX_BYTES
	) {
		nextMessages.shift();
		trimmed = true;
	}

	return {
		messages: nextMessages,
		trimmed,
	};
}

export function isInvalidPartStateError(error: unknown): boolean {
	return (
		error instanceof TypeError &&
		typeof error.message === "string" &&
		error.message.includes("reading 'state'")
	);
}

function extractErrorMessageFromValue(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as {
		error?: unknown;
		message?: unknown;
		details?: unknown;
	};

	return (
		extractErrorMessageFromValue(record.error) ??
		extractErrorMessageFromValue(record.message) ??
		extractErrorMessageFromValue(record.details)
	);
}

export function isPayloadTooLargeError(rawMessage?: string): boolean {
	const extractedMessage = extractErrorMessageFromValue(rawMessage);
	if (!extractedMessage) {
		return false;
	}

	const normalized = extractedMessage.toLowerCase();
	return (
		normalized.includes("payloadtoolargeerror") ||
		normalized.includes("payload too large") ||
		normalized.includes("entity too large") ||
		normalized.includes("request entity too large") ||
		normalized.includes("request payload too large")
	);
}

export function getPayloadTooLargeUserMessage(): string {
	return "I couldn't process that request because the chat payload is too large (usually from inline image/file history). I trimmed oversized history data, so you can continue chatting.";
}

export function toUserFacingChatErrorMessage(rawMessage?: string): string {
	const fallback = "Sorry, I hit an error. Please try again.";
	const directMessage = extractErrorMessageFromValue(rawMessage);
	if (!directMessage) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(directMessage) as unknown;
		return extractErrorMessageFromValue(parsed) ?? directMessage;
	} catch {
		return directMessage;
	}
}

export function createQueueItemId(fallbackCounter: number): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return `queue-${Date.now()}-${fallbackCounter}`;
}

export function deriveCompactThreadTitle(prompt: string): string {
	const normalized = prompt.replace(/\s+/g, " ").trim();
	if (!normalized) {
		return "New chat";
	}

	return normalized.length > 48 ? `${normalized.slice(0, 45).trim()}...` : normalized;
}

export function buildCompactThreadPersistKey(
	threadId: string | null,
	messages: ReadonlyArray<RovoUIMessage>,
): string {
	return JSON.stringify({
		threadId,
		messages,
	});
}

export function hasRichCompactThreadState(thread: RovoAppThread | null): boolean {
	if (!thread) {
		return false;
	}

	if (thread.activeDocumentId || thread.realtimeMessages.length > 0) {
		return true;
	}

	return hasRichCompactMessageState(thread.messages);
}

export function hasRichCompactMessageState(messages: ReadonlyArray<RovoUIMessage>): boolean {
	return messages.some((message) =>
		message.parts.some((part) => {
			if (!part.type.startsWith("data-")) {
				return false;
			}

			return (
				part.type.includes("artifact") ||
				part.type.includes("plan") ||
				part.type.includes("browser")
			);
		})
	);
}

export function createAssistantThinkingStatusMessage(
	id: string,
	label: string,
	content?: string,
): RovoUIMessage {
	return {
		id,
		role: "assistant",
		parts: [
			{
				type: "data-thinking-status",
				data: {
					label,
					content,
				},
			},
		],
	};
}
