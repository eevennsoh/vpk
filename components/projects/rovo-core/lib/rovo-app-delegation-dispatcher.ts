"use client";

import type { ChatStatus } from "ai";
import {
	cancelRovoAppRun,
	toRovoAppUserErrorMessage,
	upsertRovoAppRealtimeMessage,
} from "@/components/projects/rovo-core/lib/api";
import {
	isRovoAppDelegationAbortError,
	readRovoAppDelegationResponseStream,
} from "@/components/projects/rovo-core/lib/rovo-app-delegation-stream";
import { getLatestDocumentContent } from "@/components/projects/rovo-core/lib/rovo-app-message-artifacts";
import {
	normalizeDelegatedRealtimeMessage,
	upsertRealtimeMessage,
} from "@/components/projects/rovo-core/lib/rovo-app-realtime-message-state";
import type { RovoAppStreamingArtifact } from "@/components/projects/rovo-core/lib/rovo-app-streaming-artifact";
import type { RovoAppDirectDelegationPhase } from "@/components/projects/shared/lib/rovo-app-composer-submit-state";
import { API_ENDPOINTS } from "@/lib/api-config";
import type {
	RovoAppActiveRun,
	RovoAppDocument,
	RovoAppRunStatus,
	RovoAppVisibility,
} from "@/lib/rovo-app-types";
import {
	getMessageText,
	type RovoMessageMetadata,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import {
	buildActiveArtifactMetadata,
	buildArtifactContextPayload,
	buildRecentHistory,
	resolveActiveArtifactContext,
	type RovoAppArtifactSteeringPayload,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";

interface MutableRef<T> {
	current: T;
}

type RealtimeMessagesUpdater = (currentMessages: RovoUIMessage[]) => RovoUIMessage[];

interface RealtimeMessagesStateOptions {
	incrementVersion?: boolean;
}

type MutateRealtimeMessagesState = (
	updater: RealtimeMessagesUpdater,
	options?: RealtimeMessagesStateOptions,
) => RovoUIMessage[];

type StateSetter<T> = (value: T | ((currentValue: T) => T)) => void;

export interface RovoAppDelegationDispatchOptions {
	contextDescription?: string;
	conversationSummary?: string;
	existingRealtimeMessageId?: string | null;
	intentType?: string;
	prompt?: string;
	referencedFiles?: string[];
	urgency?: string;
}

export interface DispatchRovoAppDelegationNowInput {
	activeDocument: RovoAppDocument | null;
	activeDocumentContent: string;
	activeThreadIdRef: MutableRef<string | null>;
	appendRealtimeMessage: (
		role: "assistant" | "user",
		content: string,
		options?: { metadata?: Partial<RovoMessageMetadata> },
	) => Promise<unknown>;
	artifactDraftContent: string;
	attachedRunStatus: RovoAppRunStatus | null;
	clearDirectDelegationState: () => void;
	currentActiveRun?: RovoAppActiveRun | null;
	delegationAbortControllerRef: MutableRef<AbortController | null>;
	ensureThread: (text: string) => Promise<string>;
	messageId: string;
	messages: ReadonlyArray<RovoUIMessage>;
	mutateRealtimeMessagesState: MutateRealtimeMessagesState;
	options?: RovoAppDelegationDispatchOptions;
	realtimeMessagesRef: MutableRef<RovoUIMessage[]>;
	resetPendingArtifactAssociation: () => void;
	rovoMessagesRef: MutableRef<RovoUIMessage[]>;
	runSubscriptionAbortControllerRef: MutableRef<AbortController | null>;
	runSubscriptionThreadIdRef: MutableRef<string | null>;
	saveStreamingArtifactCheckpoint: () => Promise<RovoAppDocument | null>;
	setAttachedRunStatus: (status: RovoAppRunStatus | null) => void;
	setBackgroundDelegationMessageId: StateSetter<string | null>;
	setDelegationTurnStatus: (status: ChatStatus) => void;
	setDirectDelegationPhase: (phase: RovoAppDirectDelegationPhase) => void;
	setInputError: (errorMessage: string | null) => void;
	setLocalThreadActiveRun: (threadId: string, activeRun: RovoAppActiveRun | null) => void;
	smartGenerationRequest: unknown;
	statusRef: MutableRef<ChatStatus>;
	stopUseChat: () => Promise<unknown>;
	streamingArtifact: RovoAppStreamingArtifact | null;
	threadVisibility: RovoAppVisibility;
	useChatStatus: ChatStatus;
}

export async function dispatchRovoAppDelegationNow({
	activeDocument,
	activeDocumentContent,
	activeThreadIdRef,
	appendRealtimeMessage,
	artifactDraftContent,
	attachedRunStatus,
	clearDirectDelegationState,
	currentActiveRun,
	delegationAbortControllerRef,
	ensureThread,
	messageId,
	messages,
	mutateRealtimeMessagesState,
	options,
	realtimeMessagesRef,
	resetPendingArtifactAssociation,
	rovoMessagesRef,
	runSubscriptionAbortControllerRef,
	runSubscriptionThreadIdRef,
	saveStreamingArtifactCheckpoint,
	setAttachedRunStatus,
	setBackgroundDelegationMessageId,
	setDelegationTurnStatus,
	setDirectDelegationPhase,
	setInputError,
	setLocalThreadActiveRun,
	smartGenerationRequest,
	statusRef,
	stopUseChat,
	streamingArtifact,
	threadVisibility,
	useChatStatus,
}: DispatchRovoAppDelegationNowInput): Promise<void> {
	if (!messageId) {
		return;
	}

	setInputError(null);
	const delegatedMessage =
		realtimeMessagesRef.current.find((message) => message.id === messageId)
		?? messages.find((message) => message.id === messageId)
		?? null;
	const delegatedText =
		options?.prompt?.trim()
		|| (delegatedMessage ? getMessageText(delegatedMessage).trim() : "");
	if (!delegatedText) {
		return;
	}

	const hadActiveTurn =
		statusRef.current === "submitted" || statusRef.current === "streaming";
	const checkpointDocument = hadActiveTurn
		? await saveStreamingArtifactCheckpoint()
		: null;
	if (hadActiveTurn) {
		if (useChatStatus === "submitted" || useChatStatus === "streaming") {
			await stopUseChat();
		} else if (attachedRunStatus !== null || currentActiveRun !== null) {
			const activeThreadId = activeThreadIdRef.current;
			if (activeThreadId) {
				await cancelRovoAppRun(activeThreadId).catch(() => false);
				setLocalThreadActiveRun(activeThreadId, null);
			}
		}
		runSubscriptionAbortControllerRef.current?.abort();
		runSubscriptionAbortControllerRef.current = null;
		runSubscriptionThreadIdRef.current = null;
		setAttachedRunStatus(null);
		delegationAbortControllerRef.current?.abort();
		delegationAbortControllerRef.current = null;
		clearDirectDelegationState();
	}

	const resolvedArtifactContext = checkpointDocument
		? buildArtifactContextPayload(checkpointDocument, getLatestDocumentContent(checkpointDocument))
		: resolveActiveArtifactContext(
			activeDocument, artifactDraftContent, activeDocumentContent, streamingArtifact,
		);
	const threadId = await ensureThread(delegatedText);
	resetPendingArtifactAssociation();

	const abortController = new AbortController();
	delegationAbortControllerRef.current = abortController;
	setDelegationTurnStatus("submitted");
	setDirectDelegationPhase("requesting");

	try {
		const response = await fetch(API_ENDPOINTS.ROVO_APP_CHAT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: threadId,
				messages: [
					...rovoMessagesRef.current,
					...realtimeMessagesRef.current,
				],
				artifactContext: resolvedArtifactContext ?? undefined,
				artifactSteering: checkpointDocument
					? ({
						preferCurrentArtifact: true,
						source: "voice",
					} satisfies RovoAppArtifactSteeringPayload)
					: undefined,
				contextDescription: options?.contextDescription,
				conversationSummary: options?.conversationSummary,
				delegatedMessageId: messageId,
				smartGeneration: smartGenerationRequest,
				activeArtifact: buildActiveArtifactMetadata(activeDocument),
				origin: "voice" as const,
				voiceMetadata: {
					intentType: options?.intentType,
					urgency: options?.urgency,
					conversationSummary: options?.conversationSummary,
				},
				recentHistory: buildRecentHistory([
					...rovoMessagesRef.current,
					...realtimeMessagesRef.current,
				]),
				visibility: threadVisibility,
			}),
			signal: abortController.signal,
		});
		if (!response.ok || !response.body) {
			throw new Error((await response.text().catch(() => "")) || "Failed to stream delegated response");
		}

		setDelegationTurnStatus("streaming");
		setDirectDelegationPhase("background");
		const existingRealtimeMessageId = options?.existingRealtimeMessageId;
		let mappedStreamedId: string | null = null;
		for await (const streamedMessage of readRovoAppDelegationResponseStream({
			stream: response.body,
			onError: (error) => {
				console.error("[RovoApp] Failed to read delegated UI message stream:", error);
			},
			terminateOnError: true,
		})) {
			let effectiveId = streamedMessage.id;
			if (existingRealtimeMessageId) {
				if (!mappedStreamedId || mappedStreamedId === streamedMessage.id) {
					mappedStreamedId = streamedMessage.id;
					effectiveId = existingRealtimeMessageId;
				}
			}

			mutateRealtimeMessagesState((previousMessages) => {
				// Reuse an existing GPT interim message ID so the delegated response
				// merges into the same bubble instead of creating a second one.
				const existingMessage = previousMessages.find(
					(message) => message.id === effectiveId,
				);
				const normalizedMessage = normalizeDelegatedRealtimeMessage({
					delegatedFromId: messageId,
					effectiveId,
					existingMessage,
					streamedMessage,
				});
				void upsertRovoAppRealtimeMessage({
					threadId,
					message: normalizedMessage,
				}).catch((error) => {
					console.warn("[RovoApp] Failed to persist delegated realtime message:", error);
				});
				return upsertRealtimeMessage(previousMessages, normalizedMessage);
			});
			setBackgroundDelegationMessageId((currentId) => currentId ?? effectiveId);
		}
		clearDirectDelegationState();
	} catch (error) {
		if (
			abortController.signal.aborted
			|| isRovoAppDelegationAbortError(error)
		) {
			clearDirectDelegationState();
			return;
		}

		const errorMessage = toRovoAppUserErrorMessage(error);
		setInputError(errorMessage);
		await appendRealtimeMessage("assistant", errorMessage, {
			metadata: {
				origin: "rovo",
				delegatedFromId: messageId,
			},
		});
		clearDirectDelegationState();
		throw error;
	} finally {
		if (delegationAbortControllerRef.current === abortController) {
			delegationAbortControllerRef.current = null;
		}
	}
}
