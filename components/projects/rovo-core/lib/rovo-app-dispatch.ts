import type { FileUIPart } from "ai";
import type { RovoMessageMetadata } from "@/lib/rovo-ui-messages";
import type {
	RovoAppCreationMode,
	RovoAppPromptMode,
	RovoAppQueuedAction,
} from "@/lib/rovo-app-types";

export type RovoAppSendMode = "queue" | "immediate";
export type RovoAppSendModeSetter = (
	nextMode: RovoAppSendMode | ((currentMode: RovoAppSendMode) => RovoAppSendMode),
) => void;

interface ResolveRovoAppPromptDispatchInput {
	activeThreadId: string | null;
	creationMode?: RovoAppCreationMode;
	draftThreadId: string;
	files: ReadonlyArray<FileUIPart>;
	hasBusyTurn: boolean;
	isPlanModeActive: boolean;
	isQueueProcessorRunning: boolean;
	queuedActionsByThreadId: Readonly<Record<string, ReadonlyArray<unknown> | undefined>>;
	sendMode?: RovoAppSendMode;
	text: string;
}

interface ResolveRovoAppDelegationDispatchInput {
	activeThreadId: string | null;
	delegatedMessageText?: string;
	draftThreadId: string;
	hasBusyTurn: boolean;
	isQueueProcessorRunning: boolean;
	messageId: string;
	optionPrompt?: string;
	queuedActionsByThreadId: Readonly<Record<string, ReadonlyArray<unknown> | undefined>>;
	sendMode?: RovoAppSendMode;
}

interface ResolveRovoAppDispatchQueueDecisionInput {
	hasBusyTurn: boolean;
	isQueueProcessorRunning: boolean;
	queuedActionCount: number;
	sendMode?: RovoAppSendMode;
}

export interface RovoAppDispatchQueueDecision {
	hasBusyTurn: boolean;
	hasQueuedActions: boolean;
	shouldDefer: boolean;
	shouldDispatchImmediately: boolean;
	shouldQueue: boolean;
	wasQueueProcessorRunning: boolean;
}

export interface RovoAppPromptDispatchResolution {
	dispatchDecision: RovoAppDispatchQueueDecision;
	messageMetadata: RovoMessageMetadata;
	mode: RovoAppPromptMode;
	resolvedThreadId: string;
	text: string;
}

export interface RovoAppDelegationDispatchResolution {
	dispatchDecision: RovoAppDispatchQueueDecision;
	messageId: string;
	resolvedThreadId: string;
	text: string;
}

export interface RovoAppQueuedPromptDispatchPayload {
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	files: FileUIPart[];
	messageMetadata?: RovoMessageMetadata;
	mode: RovoAppPromptMode;
	text: string;
}

export interface RovoAppQueuedDelegationDispatchOptions {
	contextDescription?: string;
	conversationSummary?: string;
	existingRealtimeMessageId?: string;
	intentType?: string;
	prompt: string;
	referencedFiles?: string[];
	urgency?: string;
}

export type RovoAppQueuedActionDispatchResolution =
	| {
			kind: "prompt";
			payload: RovoAppQueuedPromptDispatchPayload;
	  }
	| {
			delegatedMessageId: string;
			kind: "delegation";
			options: RovoAppQueuedDelegationDispatchOptions;
	  };

export function buildRovoAppPromptModeMetadata(
	metadata: RovoMessageMetadata | undefined,
	mode: RovoAppPromptMode,
	creationMode?: RovoAppCreationMode,
): RovoMessageMetadata {
	return {
		...(metadata ?? {}),
		...(creationMode ? { creationMode } : {}),
		submittedMode: mode,
	};
}

export function resolveRovoAppQueuedActionDispatch(
	action: RovoAppQueuedAction,
): RovoAppQueuedActionDispatchResolution {
	if (action.kind === "delegation") {
		return {
			delegatedMessageId: action.delegatedMessageId,
			kind: "delegation",
			options: {
				contextDescription: action.contextDescription,
				conversationSummary: action.conversationSummary,
				existingRealtimeMessageId: action.existingRealtimeMessageId ?? undefined,
				intentType: action.intentType,
				prompt: action.text,
				referencedFiles: action.referencedFiles,
				urgency: action.urgency,
			},
		};
	}

	return {
		kind: "prompt",
		payload: {
			text: action.text,
			files: [...action.files],
			contextDescription: action.contextDescription,
			creationMode: action.creationMode,
			messageMetadata: action.messageMetadata,
			mode: action.mode,
		},
	};
}

export function resolveRovoAppDispatchQueueDecision({
	hasBusyTurn,
	isQueueProcessorRunning,
	queuedActionCount,
	sendMode = "queue",
}: ResolveRovoAppDispatchQueueDecisionInput): RovoAppDispatchQueueDecision {
	const hasQueuedActions = queuedActionCount > 0;
	const shouldDefer = isQueueProcessorRunning || hasBusyTurn || hasQueuedActions;

	return {
		hasBusyTurn,
		hasQueuedActions,
		shouldDefer,
		shouldDispatchImmediately: shouldDefer && sendMode === "immediate",
		shouldQueue: shouldDefer && sendMode === "queue",
		wasQueueProcessorRunning: isQueueProcessorRunning,
	};
}

export function resolveRovoAppPromptDispatch({
	activeThreadId,
	creationMode,
	draftThreadId,
	files,
	hasBusyTurn,
	isPlanModeActive,
	isQueueProcessorRunning,
	queuedActionsByThreadId,
	sendMode,
	text,
}: ResolveRovoAppPromptDispatchInput): RovoAppPromptDispatchResolution | null {
	const trimmedText = text.trim();
	if (!trimmedText && files.length === 0) {
		return null;
	}

	const mode: RovoAppPromptMode = isPlanModeActive ? "plan" : "default";
	const resolvedThreadId = activeThreadId ?? draftThreadId;

	return {
		dispatchDecision: resolveRovoAppDispatchQueueDecision({
			hasBusyTurn,
			isQueueProcessorRunning,
			queuedActionCount: queuedActionsByThreadId[resolvedThreadId]?.length ?? 0,
			sendMode,
		}),
		messageMetadata: buildRovoAppPromptModeMetadata(
			undefined,
			mode,
			creationMode,
		),
		mode,
		resolvedThreadId,
		text: trimmedText,
	};
}

export function resolveRovoAppDelegationDispatch({
	activeThreadId,
	delegatedMessageText,
	draftThreadId,
	hasBusyTurn,
	isQueueProcessorRunning,
	messageId,
	optionPrompt,
	queuedActionsByThreadId,
	sendMode,
}: ResolveRovoAppDelegationDispatchInput): RovoAppDelegationDispatchResolution | null {
	if (!messageId) {
		return null;
	}

	const delegatedText =
		optionPrompt?.trim()
		|| delegatedMessageText?.trim()
		|| "";
	if (!delegatedText) {
		return null;
	}

	const resolvedThreadId = activeThreadId ?? draftThreadId;

	return {
		dispatchDecision: resolveRovoAppDispatchQueueDecision({
			hasBusyTurn,
			isQueueProcessorRunning,
			queuedActionCount: queuedActionsByThreadId[resolvedThreadId]?.length ?? 0,
			sendMode,
		}),
		messageId,
		resolvedThreadId,
		text: delegatedText,
	};
}
