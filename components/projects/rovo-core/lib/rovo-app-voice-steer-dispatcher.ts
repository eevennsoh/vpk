"use client";

import type { ChatStatus } from "ai";
import { getLatestDocumentContent } from "@/components/projects/rovo-core/lib/rovo-app-message-artifacts";
import {
	buildArtifactContextPayload,
	type RovoAppArtifactSteeringPayload,
} from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";
import type {
	RovoAppDocument,
} from "@/lib/rovo-app-types";
import type {
	RovoMessageMetadata,
	RovoUIMessage,
} from "@/lib/rovo-ui-messages";

interface MutableRef<T> {
	current: T;
}

export interface RovoAppVoiceSteerPayload {
	contextDescription?: string;
	text: string;
}

interface RovoAppVoiceSteerSendMessageInput {
	files: [];
	messageId: string;
	metadata?: RovoMessageMetadata;
	text: string;
}

interface RovoAppVoiceSteerSendMessageOptions {
	body: {
		artifactContext?: unknown;
		artifactSteering: RovoAppArtifactSteeringPayload;
		contextDescription?: string;
		id: string;
		origin: "voice";
	};
}

export interface DispatchRovoAppVoiceSteerInput
	extends RovoAppVoiceSteerPayload {
	appendLocalUserMessage: (payload: {
		files: [];
		text: string;
	}) => {
		message: Pick<RovoUIMessage, "metadata">;
		messageId: string;
	};
	ensureThread: (text: string) => Promise<string>;
	interruptActiveTurn: (options: { source: "voice-barge-in" }) => Promise<unknown>;
	markLocalThreadRunPending: (threadId: string) => void;
	releaseCompletedUseChatTurnIfNeeded: () => Promise<unknown>;
	resetPendingArtifactAssociation: () => void;
	saveStreamingArtifactCheckpoint: () => Promise<RovoAppDocument | null>;
	sendMessage: (
		message: RovoAppVoiceSteerSendMessageInput,
		options: RovoAppVoiceSteerSendMessageOptions,
	) => Promise<unknown>;
	setInputError: (errorMessage: string | null) => void;
	statusRef: MutableRef<ChatStatus>;
	toUserErrorMessage: (error: unknown) => string;
}

export async function dispatchRovoAppVoiceSteer({
	appendLocalUserMessage,
	contextDescription,
	ensureThread,
	interruptActiveTurn,
	markLocalThreadRunPending,
	releaseCompletedUseChatTurnIfNeeded,
	resetPendingArtifactAssociation,
	saveStreamingArtifactCheckpoint,
	sendMessage,
	setInputError,
	statusRef,
	text,
	toUserErrorMessage,
}: DispatchRovoAppVoiceSteerInput): Promise<void> {
	const trimmedText = text.trim();
	if (!trimmedText) {
		return;
	}

	setInputError(null);

	try {
		const hadActiveTurn =
			statusRef.current === "submitted" || statusRef.current === "streaming";
		const checkpointDocument = hadActiveTurn
			? await saveStreamingArtifactCheckpoint()
			: null;
		if (hadActiveTurn) {
			await interruptActiveTurn({ source: "voice-barge-in" });
		}

		await releaseCompletedUseChatTurnIfNeeded();

		const threadId = await ensureThread(trimmedText);
		const { message, messageId } = appendLocalUserMessage({
			files: [],
			text: trimmedText,
		});
		markLocalThreadRunPending(threadId);
		resetPendingArtifactAssociation();
		void sendMessage(
			{
				text: trimmedText,
				files: [],
				messageId,
				metadata: message.metadata,
			},
			{
				body: {
					id: threadId,
					contextDescription,
					origin: "voice",
					artifactSteering: {
						preferCurrentArtifact: true,
						source: "voice",
					},
					artifactContext: checkpointDocument
						? buildArtifactContextPayload(
							checkpointDocument,
							getLatestDocumentContent(checkpointDocument),
						)
						: undefined,
				},
			},
		).catch((error) => {
			setInputError(toUserErrorMessage(error));
		});
	} catch (error) {
		setInputError(toUserErrorMessage(error));
		throw error;
	}
}
