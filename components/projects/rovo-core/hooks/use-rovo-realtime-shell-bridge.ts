"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FileUIPart } from "ai";
import { appendDictationTranscript } from "@/lib/composer-dictation";

export type RovoRealtimeMessageRole = "user" | "assistant";

export type RovoRealtimeMessageMutationResult =
	| string
	| {
			id?: string | null;
	  }
	| void;

export interface RovoRealtimeShellBridgeAdapter {
	appendRealtimeMessage?: (
		role: RovoRealtimeMessageRole,
		content: string,
		options?: Record<string, unknown>,
	) => Promise<RovoRealtimeMessageMutationResult> | RovoRealtimeMessageMutationResult;
	isVoiceMode?: boolean;
	messages?: ReadonlyArray<{ id: string; role: string }>;
	submitRealtimeText?: (payload: { text: string; files: FileUIPart[]; contextDescription?: string }) => Promise<void>;
	setRealtimeMessageContent?: (messageId: string, content: string) => Promise<void> | void;
	setVoiceMode?: (next: boolean) => void;
	toggleVoiceMode?: () => void;
	updateRealtimeMessage?: (messageId: string, contentDelta: string) => Promise<void> | void;
}

export type RovoRealtimeShellAdapter<TChat> = TChat & RovoRealtimeShellBridgeAdapter;

export interface RovoRealtimeShellBridgeChatRef<
	TChat extends RovoRealtimeShellBridgeAdapter = RovoRealtimeShellBridgeAdapter,
> {
	current: TChat | null;
}

export function resolveRovoRealtimeMutationId(result: RovoRealtimeMessageMutationResult): string | null {
	if (typeof result === "string" && result.trim()) {
		return result;
	}

	if (result && typeof result === "object" && typeof result.id === "string" && result.id.trim()) {
		return result.id;
	}

	return null;
}

export function setRovoRealtimeChatVoiceMode(
	realtimeChat: RovoRealtimeShellBridgeAdapter | null | undefined,
	next: boolean,
): void {
	if (!realtimeChat) {
		return;
	}

	if (typeof realtimeChat.setVoiceMode === "function") {
		realtimeChat.setVoiceMode(next);
		return;
	}

	if (realtimeChat.isVoiceMode !== next && typeof realtimeChat.toggleVoiceMode === "function") {
		realtimeChat.toggleVoiceMode();
	}
}

export async function appendRovoRealtimeMessage(
	realtimeChat: RovoRealtimeShellBridgeAdapter | null | undefined,
	role: RovoRealtimeMessageRole,
	content: string,
	options?: Record<string, unknown>,
): Promise<string | null> {
	if (typeof realtimeChat?.appendRealtimeMessage !== "function") {
		return null;
	}

	const result = await realtimeChat.appendRealtimeMessage(role, content, options);
	return resolveRovoRealtimeMutationId(result);
}

export async function updateRovoRealtimeMessage(
	realtimeChat: RovoRealtimeShellBridgeAdapter | null | undefined,
	messageId: string | null,
	content: string,
	options?: { replace?: boolean },
): Promise<void> {
	if (!messageId || !content || !realtimeChat) {
		return;
	}

	if (options?.replace && typeof realtimeChat.setRealtimeMessageContent === "function") {
		await realtimeChat.setRealtimeMessageContent(messageId, content);
		return;
	}

	if (typeof realtimeChat.updateRealtimeMessage === "function") {
		await realtimeChat.updateRealtimeMessage(messageId, content);
	}
}


export interface RovoRealtimeConversationTransport {
	connect: (options?: { transcriptionOnly?: boolean }) => void;
	disconnect: () => void;
	sendTextInput?: (payload: { text: string; messageId?: string; contextDescription?: string }) => Promise<void> | void;
}

type TranscriptPayload = string | { text?: string; delta?: string; transcript?: string };
type AssistantPayload = string | { text?: string; delta?: string; messageId?: string; replace?: boolean; displayOnly?: boolean };

/** Owns one conversation's identities, ordering and transport lifecycle. */
export function createRovoRealtimeConversation(initialChatRef?: RovoRealtimeShellBridgeChatRef) {
	let chatRef = initialChatRef ?? { current: null };
	let generation = 0;
	let userMessageId: string | null = null;
	let assistantMessageId: string | null = null;
	let assistantPromise: Promise<string | null> | null = null;
	let speechStartedAt: string | null = null;
	let dictation: { committed: string } | null = null;
	let manuallyStopped = false;
	const resetAssistant = () => {
		generation += 1;
		assistantMessageId = null;
		assistantPromise = null;
	};
	const stop = () => {
		resetAssistant();
		userMessageId = null;
		speechStartedAt = null;
		manuallyStopped = true;
	};
	const ensureAssistant = async (preferredMessageId?: string | null): Promise<string | null> => {
		if (dictation || manuallyStopped) return null;
		if (assistantMessageId) return assistantMessageId;
		if (assistantPromise) return assistantPromise;
		if (preferredMessageId && chatRef.current?.messages?.some((message) => message.id === preferredMessageId && message.role === "assistant")) {
			assistantMessageId = preferredMessageId;
			return assistantMessageId;
		}
		const token = generation;
		const createdAt = speechStartedAt ? new Date(new Date(speechStartedAt).getTime() + 1).toISOString() : undefined;
		const pending = appendRovoRealtimeMessage(chatRef.current, "assistant", "", { messageId: preferredMessageId ?? undefined, createdAt })
			.then((id) => {
				if (token !== generation) return null;
				assistantMessageId = id;
				return id;
			}).finally(() => { if (assistantPromise === pending) assistantPromise = null; });
		assistantPromise = pending;
		return pending;
	};
	return {
		bindChat(next: RovoRealtimeShellBridgeChatRef) { chatRef = next; },
		get userMessageId() { return userMessageId; },
		get assistantMessageId() { return assistantMessageId; },
		isDictating: () => dictation !== null,
		resetAssistant,
		ensureAssistant,
		interrupt: stop,
		endSession: stop,
		startLive(transport: RovoRealtimeConversationTransport, onStart: () => void) {
			dictation = null;
			manuallyStopped = false;
			onStart();
			transport.connect();
		},
		stopVoice(transport: RovoRealtimeConversationTransport) {
			stop();
			transport.disconnect();
		},
		startDictation(transport: RovoRealtimeConversationTransport, baseline: string, wasActive: boolean) {
			if (wasActive) { stop(); transport.disconnect(); }
			dictation = { committed: baseline };
			transport.connect({ transcriptionOnly: true });
		},
		stopDictation(transport: RovoRealtimeConversationTransport) {
			dictation = null;
			stop();
			transport.disconnect();
		},
		beginSpeech() {
			if (dictation) return false;
			resetAssistant();
			manuallyStopped = false;
			userMessageId = null;
			speechStartedAt = new Date().toISOString();
			return true;
		},
		transcriptDelta(payload: TranscriptPayload) {
			const preview = typeof payload === "string" ? payload : payload.text ?? payload.delta ?? "";
			return preview && dictation ? { preview, text: appendDictationTranscript(dictation.committed, preview) } : null;
		},
		async completeSpeech(payload: TranscriptPayload, onUser?: (text: string) => void) {
			const transcript = typeof payload === "string" ? payload : payload.transcript ?? payload.text ?? "";
			if (dictation) {
				if (!transcript.trim()) return null;
				dictation.committed = appendDictationTranscript(dictation.committed, transcript);
				return { preview: transcript, text: dictation.committed };
			}
			onUser?.(transcript);
			if (manuallyStopped) return null;
			if (!transcript) return null;
			const token = generation;
			const id = await appendRovoRealtimeMessage(chatRef.current, "user", transcript, { createdAt: speechStartedAt ?? undefined });
			if (token === generation) { userMessageId = id; speechStartedAt = null; }
			return null;
		},
		async assistantDelta(payload: AssistantPayload, onText?: (text: string) => void) {
			if (dictation || manuallyStopped) return;
			const text = typeof payload === "string" ? payload : payload.text ?? "";
			const delta = typeof payload === "string" ? payload : payload.delta ?? payload.text ?? "";
			if (!delta) return;
			if (text) onText?.(text);
			if (typeof payload !== "string" && payload.displayOnly) return;
			const token = generation;
			const id = await ensureAssistant(typeof payload === "string" ? null : payload.messageId);
			if (token !== generation) return;
			const replace = typeof payload !== "string" && payload.replace === true;
			await updateRovoRealtimeMessage(chatRef.current, id, replace ? text : delta, replace ? { replace: true } : undefined);
		},
		async assistantCompleted(payload: AssistantPayload, onText?: (text: string) => void) {
			if (dictation || manuallyStopped) return;
			const text = typeof payload === "string" ? payload : payload.text ?? "";
			if (!text) return;
			onText?.(text);
			const token = generation;
			const id = await ensureAssistant(typeof payload === "string" ? null : payload.messageId);
			if (token === generation) await updateRovoRealtimeMessage(chatRef.current, id, text, { replace: true });
		},
		async submitText(payload: { text: string; files: FileUIPart[]; contextDescription?: string }, transport: RovoRealtimeConversationTransport, onStart: (mode: "chat" | "voice") => void): Promise<boolean> {
			if (chatRef.current?.submitRealtimeText) {
				manuallyStopped = false;
				onStart("chat");
				await chatRef.current.submitRealtimeText(payload);
				return true;
			}
			if (!transport.sendTextInput) return false;
			manuallyStopped = false;
			resetAssistant();
			onStart("voice");
			const token = generation;
			const id = await appendRovoRealtimeMessage(chatRef.current, "user", payload.text, { contextDescription: payload.contextDescription });
			if (token !== generation) return true;
			userMessageId = id;
			await transport.sendTextInput({ text: payload.text, contextDescription: payload.contextDescription, messageId: id ?? undefined });
			return true;
		},
		activate() { manuallyStopped = false; },
		destroy: stop,
	};
}

export function useRovoRealtimeShellBridge<TChat extends RovoRealtimeShellBridgeAdapter>({
	chatRef,
}: {
	chatRef: RovoRealtimeShellBridgeChatRef<TChat>;
}) {
	const [conversation] = useState(() => createRovoRealtimeConversation());
	useEffect(() => {
		conversation.bindChat(chatRef);
		conversation.activate();
		return () => conversation.destroy();
	}, [chatRef, conversation]);
	const setChatVoiceMode = useCallback((next: boolean) => {
		setRovoRealtimeChatVoiceMode(chatRef.current, next);
	}, [chatRef]);

	const appendRealtimeMessage = useCallback(
		async (
			role: RovoRealtimeMessageRole,
			content: string,
			options?: Record<string, unknown>,
		): Promise<string | null> => appendRovoRealtimeMessage(chatRef.current, role, content, options),
		[chatRef],
	);

	const updateRealtimeMessage = useCallback(
		async (messageId: string | null, content: string, options?: { replace?: boolean }) => {
			await updateRovoRealtimeMessage(chatRef.current, messageId, content, options);
		},
		[chatRef],
	);

	return useMemo(
		() => ({
			conversation,
			appendRealtimeMessage,
			setChatVoiceMode,
			updateRealtimeMessage,
		}),
		[appendRealtimeMessage, conversation, setChatVoiceMode, updateRealtimeMessage],
	);
}
