"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRovoChat } from "@/app/contexts";
import type { QueuedPromptItem } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import type { RovoLocalAssistantStage, RovoLocalTurn } from "@/app/contexts/rovo-chat-transcript";
import type { RovoMessageMetadata, RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { FileUIPart } from "ai";

export interface ChatSubmitInterceptOutcome {
	handled: boolean;
	assistantReply?: string;
	assistantParts?: RovoUIMessage["parts"];
	getAssistantParts?: (context: { startedAt: Date }) => RovoUIMessage["parts"];
	assistantPartStages?: readonly RovoLocalAssistantStage[];
	delayMs?: number;
	onApply?: () => Promise<void> | void;
	/** Apply the intercepted action after the final assistant response is committed. */
	onApplyAfterResponse?: () => Promise<void> | void;
	pendingAssistantParts?: RovoUIMessage["parts"];
	getPendingAssistantParts?: (context: { startedAt: Date }) => RovoUIMessage["parts"];
	userMetadata?: RovoMessageMetadata;
}

interface UseChatSubmitReturn {
	prompt: string;
	setPrompt: (prompt: string) => void;
	handleSubmit: (message: { text: string; files: FileUIPart[] }) => Promise<void>;
	submitPrompt: (prompt: string, files?: ReadonlyArray<FileUIPart>) => Promise<void>;
	recordLocalAssistantTurn: (params: {
		assistantParts: RovoUIMessage["parts"];
		files?: ReadonlyArray<FileUIPart>;
		promptText: string;
	}) => Promise<void>;
	/**
	 * Runs the deterministic submit interceptor against `text`. When the prompt
	 * is a handled build intent, this aborts any in-flight turn, injects the user
	 * message + scripted reply locally, and returns `true` so the caller can skip
	 * the model. Returns `false` when no interceptor is configured or the prompt
	 * was not handled — the caller should fall back to its normal send path.
	 */
	interceptSubmit: (
		text: string,
		files?: ReadonlyArray<FileUIPart>,
		options?: { userMetadata?: RovoMessageMetadata },
	) => Promise<boolean>;
	abort: () => void;
	uiMessages: RovoUIMessage[];
	isStreaming: boolean;
	hasInFlightTurn: boolean;
	isSubmitPending: boolean;
	activeRequestStartedAt: number | null;
	localThinkingAssistantMessageId: string | null;
	queuedPrompts: ReadonlyArray<QueuedPromptItem>;
	removeQueuedPrompt: (id: string) => void;
}

interface UseChatSubmitOptions {
	defaultPromptOptions?: SendPromptOptions;
	/**
	 * When true, submissions that are not handled by `onInterceptSubmit` are
	 * still kept local to this chat surface instead of falling through to the
	 * normal Rovo send path. Used while an edit context bar is open so typed
	 * agent-edit prompts cannot accidentally enter clarification / plan review.
	 */
	requireIntercept?: boolean;
	requiredInterceptReply?: string;
	/**
	 * Deterministic submit interceptor. When it reports the prompt as handled,
	 * the model call is skipped and the user message + returned `assistantReply`
	 * are injected locally. Used by the studio agent-edit chat to apply scripted
	 * agent edits without hitting the backend.
	 */
	onInterceptSubmit?: (text: string) => ChatSubmitInterceptOutcome;
}

const DEFAULT_REQUIRED_INTERCEPT_REPLY =
	"I can only update the open agent from this edit context. Try asking me to add a trigger, update the instructions, or add an app or skill. Close the Edit context to chat normally.";

export function useChatSubmit({
	defaultPromptOptions,
	onInterceptSubmit,
	requireIntercept = false,
	requiredInterceptReply = DEFAULT_REQUIRED_INTERCEPT_REPLY,
}: Readonly<UseChatSubmitOptions> = {}): UseChatSubmitReturn {
	const [prompt, setPrompt] = useState("");
	const [localThinkingAssistantMessageId, setLocalThinkingAssistantMessageId] = useState<string | null>(null);
	const isSubmittingRef = useRef(false);
	const {
		uiMessages,
		sendPrompt,
		applyLocalTurn,
		stopStreaming,
		isStreaming,
		hasInFlightTurn,
		isSubmitPending,
		pendingSubmitStartedAt,
		activePrompt,
		queuedPrompts,
		removeQueuedPrompt,
	} = useRovoChat();

	const localTurnAbortRef = useRef<AbortController | null>(null);
	useEffect(() => () => localTurnAbortRef.current?.abort(), []);
	const injectLocalAssistantTurn = useCallback(async (turn: RovoLocalTurn) => {
		setPrompt("");
		localTurnAbortRef.current?.abort();
		const controller = new AbortController();
		localTurnAbortRef.current = controller;
		await applyLocalTurn({
			...turn,
			signal: controller.signal,
			onThinkingMessageChange: setLocalThinkingAssistantMessageId,
		});
	}, [applyLocalTurn]);

	// Deterministic interception: when the prompt is a handled build intent, skip
	// the model and inject the user message + scripted reply locally so the
	// agent-edit conversation reads naturally. Returns true when handled.
	const interceptSubmit = useCallback(
		async (
			text: string,
			files: ReadonlyArray<FileUIPart> = [],
			options?: { userMetadata?: RovoMessageMetadata },
		): Promise<boolean> => {
			const promptText = text.trim();
			if (!onInterceptSubmit || !promptText) {
				return false;
			}
			const outcome = onInterceptSubmit(promptText);
			if (!outcome.handled) {
				return false;
			}

			const finalAssistantParts = outcome.assistantParts
				?? (outcome.assistantReply
					? [{ type: "text" as const, text: outcome.assistantReply, state: "done" as const }]
					: []);
			await injectLocalAssistantTurn({
				assistantParts: finalAssistantParts,
				assistantPartStages: outcome.assistantPartStages,
				delayMs: outcome.delayMs,
				files,
				getAssistantParts: outcome.getAssistantParts,
				getPendingAssistantParts: outcome.getPendingAssistantParts,
				onApply: outcome.onApply,
				onApplyAfterResponse: outcome.onApplyAfterResponse,
				pendingAssistantParts: outcome.pendingAssistantParts,
				promptText,
				userMetadata: {
					...options?.userMetadata,
					...outcome.userMetadata,
				},
			});
			return true;
		},
		[injectLocalAssistantTurn, onInterceptSubmit]
	);

	const recordLocalAssistantTurn = useCallback(
		async ({
			assistantParts,
			files = [],
			promptText,
		}: {
			assistantParts: RovoUIMessage["parts"];
			files?: ReadonlyArray<FileUIPart>;
			promptText: string;
		}) => {
			const trimmedPrompt = promptText.trim();
			if (!trimmedPrompt && files.length === 0) {
				return;
			}

			await injectLocalAssistantTurn({
				assistantParts,
				files,
				promptText: trimmedPrompt,
			});
		},
		[injectLocalAssistantTurn],
	);

	const submitPrompt = useCallback(
		async (nextPrompt: string, files: ReadonlyArray<FileUIPart> = []) => {
			const promptText = nextPrompt.trim();
			if ((!promptText && files.length === 0) || isSubmittingRef.current) {
				return;
			}

			if (await interceptSubmit(nextPrompt, files)) {
				return;
			}

			if (requireIntercept) {
				await injectLocalAssistantTurn({
					assistantParts: [{ type: "text" as const, text: requiredInterceptReply, state: "done" as const }],
					files,
					promptText,
				});
				return;
			}

			isSubmittingRef.current = true;
			setPrompt("");

			try {
				await sendPrompt(promptText, defaultPromptOptions, files);
			} finally {
				isSubmittingRef.current = false;
			}
		},
		[defaultPromptOptions, injectLocalAssistantTurn, interceptSubmit, requireIntercept, requiredInterceptReply, sendPrompt]
	);

	const handleSubmit = useCallback(async ({ files, text }: { text: string; files: FileUIPart[] }) => {
		await submitPrompt(text || prompt, files);
	}, [prompt, submitPrompt]);

	const abort = useCallback(() => {
		localTurnAbortRef.current?.abort();
		void stopStreaming();
	}, [stopStreaming]);

	return {
		prompt,
		setPrompt,
		handleSubmit,
		submitPrompt,
		recordLocalAssistantTurn,
		interceptSubmit,
		abort,
		uiMessages,
		isStreaming,
		hasInFlightTurn,
		isSubmitPending,
		activeRequestStartedAt: activePrompt?.createdAt ?? pendingSubmitStartedAt,
		localThinkingAssistantMessageId,
		queuedPrompts,
		removeQueuedPrompt,
	};
}
