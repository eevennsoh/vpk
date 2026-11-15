// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, the realtime voice session, timers, and window listeners; dependencies are constrained to avoid restarting those bridges.

/* eslint-disable react-hooks/exhaustive-deps -- These callbacks/effects intentionally read stable refs that bridge the realtime voice session and composer state. */

import { useCallback, useEffect, useReducer, useRef, type RefObject } from "react";
import type { SendPromptOptions, useRovoChat } from "@/app/contexts";
import { type DelegationRequest, useRealtimeVoice } from "@/components/projects/rovo-core/hooks/use-realtime-voice";
import { useDefaultClickyVoice } from "@/components/projects/rovo-core/hooks/use-default-clicky-voice";
import type { StudioScreenAssistantToolCall, StudioScreenAssistantToolResponder } from "@/components/projects/rovo-core/lib/screen-assistant";
import { appendDictationTranscript, resolveComposerDictationState } from "@/lib/composer-dictation";
import { mergeRovoContextDescriptions } from "@/lib/rovo-context";
import { isLocalConversationSubmitHandled } from "../lib/chat-panel-local-conversation";
import type { ChatPanelLocalConversation } from "../lib/chat-panel-types";
import { reduceDictationPresentation, subscribeToUserActivation } from "../lib/sidebar-chat-state";
import type { useChatSubmit } from "./use-chat-submit";
import type { ChatPanelClicky } from "./use-chat-panel-clicky";
import type { LocalConversationVoice } from "./use-local-conversation-voice";

type RealtimeTranscriptPayload =
	| string
	| {
			delta?: string;
			text?: string;
			transcript?: string;
	  };

type RealtimeAssistantTextPayload =
	| string
	| {
			delta?: string;
			displayOnly?: boolean;
			messageId?: string;
			replace?: boolean;
			source?: "text" | "audio_transcript";
			text?: string;
	  };

function getRealtimeTranscriptText(payload: RealtimeTranscriptPayload): string {
	if (typeof payload === "string") {
		return payload;
	}

	return payload.text ?? payload.transcript ?? payload.delta ?? "";
}

type ChatSubmit = ReturnType<typeof useChatSubmit>;

interface UseChatPanelRealtimeOptions {
	clicky: ChatPanelClicky["clicky"];
	handleScreenAssistantToolCall: (call: StudioScreenAssistantToolCall, respond: StudioScreenAssistantToolResponder) => void;
	handleSubmit: ChatSubmit["handleSubmit"];
	hideAiCursor: boolean;
	isStreaming: boolean;
	localConversation: ChatPanelLocalConversation | null;
	localConversationVoice: LocalConversationVoice;
	promptRef: RefObject<string>;
	recordLocalAssistantTurn: ChatSubmit["recordLocalAssistantTurn"];
	requestComposerFocus: () => void;
	resolvedSendPromptOptions: SendPromptOptions | undefined;
	sendPrompt: ReturnType<typeof useRovoChat>["sendPrompt"];
	setPrompt: (prompt: string) => void;
	startRealtimeVoiceRequestKey: number;
	streamClickyAssistantText: ChatPanelClicky["streamClickyAssistantText"];
	uiMessages: ChatSubmit["uiMessages"];
}

/**
 * Realtime voice for the chat panel: composer dictation, the AI cursor's
 * private voice loop, direct voice answers mirrored into chat history, and
 * delegation of spoken requests to Rovo (or to a host local conversation).
 */
export function useChatPanelRealtime({
	clicky,
	handleScreenAssistantToolCall,
	handleSubmit,
	hideAiCursor,
	isStreaming,
	localConversation,
	localConversationVoice,
	promptRef,
	recordLocalAssistantTurn,
	requestComposerFocus,
	resolvedSendPromptOptions,
	sendPrompt,
	setPrompt,
	startRealtimeVoiceRequestKey,
	streamClickyAssistantText,
	uiMessages,
}: Readonly<UseChatPanelRealtimeOptions>) {
	const {
		activate: activateClicky,
		isActive: isClickyActive,
		deactivate: deactivateClicky,
		startListening: clickyStartListening,
		startProcessing: clickyStartProcessing,
		addExchange: clickyAddExchange,
	} = clicky;
	const {
		localConversationVoiceSuppressedUntilRef,
		realtimeVoiceStateRef,
		sendRealtimeTextInputRef,
		speakLocalConversationVoiceText,
	} = localConversationVoice;
	const isLocalConversationActive = localConversation !== null;
	const realtimeTranscriptRef = useRef("");
	const sendFunctionCallOutputRef = useRef<
		((payload: { callId: string; output: unknown; createResponse?: boolean }) => void) | null
	>(null);
	const dictationBaselineRef = useRef<string | null>(null);
	const dictationCommittedTextRef = useRef<string | null>(null);
	const isDictationActiveRef = useRef(false);
	const [{ isActive: isDictationActive, transcriptPreview: dictationTranscriptPreview }, dispatchDictation] = useReducer(
		reduceDictationPresentation,
		{ isActive: false, transcriptPreview: null },
	);

	const handleRealtimeSpeechStarted = useCallback(() => {
		realtimeTranscriptRef.current = "";

		if (isDictationActiveRef.current) {
			dispatchDictation({ type: "preview", transcript: null });
			return;
		}

		// The AI cursor runs a private voice loop; leave the composer untouched.
		if (isClickyActive) {
			clickyStartListening();
			return;
		}
	}, [isClickyActive, clickyStartListening]);
	const handleRealtimeTranscript = useCallback((payload: RealtimeTranscriptPayload) => {
		// Suppress live transcript deltas in the composer while Clicky is active.
		if (isClickyActive) {
			return;
		}

		const transcriptText = getRealtimeTranscriptText(payload);
		if (!transcriptText.trim()) {
			return;
		}

		if (
			localConversation &&
			(Date.now() < localConversationVoiceSuppressedUntilRef.current || realtimeVoiceStateRef.current === "speaking")
		) {
			realtimeTranscriptRef.current = "";
			return;
		}

		if (isDictationActiveRef.current) {
			dispatchDictation({ type: "preview", transcript: transcriptText });
			const nextText = appendDictationTranscript(dictationCommittedTextRef.current ?? dictationBaselineRef.current ?? "", transcriptText);
			promptRef.current = nextText;
			setPrompt(nextText);
			requestComposerFocus();
			return;
		}

		realtimeTranscriptRef.current = transcriptText;
	}, [isClickyActive, localConversation]);
	const handleRealtimeTranscriptCompleted = useCallback((payload: RealtimeTranscriptPayload) => {
		const transcriptText = getRealtimeTranscriptText(payload);

		if (isDictationActiveRef.current) {
			if (!transcriptText.trim()) {
				return;
			}

			const nextText = appendDictationTranscript(dictationCommittedTextRef.current ?? dictationBaselineRef.current ?? "", transcriptText);
			dictationCommittedTextRef.current = nextText;
			promptRef.current = nextText;
			dispatchDictation({ type: "preview", transcript: transcriptText });
			setPrompt(nextText);
			requestComposerFocus();
			return;
		}

		if (!transcriptText.trim()) {
			return;
		}

		if (
			localConversation &&
			(Date.now() < localConversationVoiceSuppressedUntilRef.current || realtimeVoiceStateRef.current === "speaking")
		) {
			realtimeTranscriptRef.current = "";
			return;
		}

		// Clicky: transition to processing and record the user's spoken question
		// instead of routing it into the chat composer/thread.
		if (isClickyActive) {
			clickyStartProcessing();
			if (transcriptText.trim()) {
				clickyAddExchange({ role: "user", content: transcriptText });
			}
			return;
		}

		if (localConversation) {
			void Promise.resolve(localConversation.onSubmit(transcriptText)).then((result) => {
				if (isLocalConversationSubmitHandled(result)) {
					realtimeTranscriptRef.current = "";
					speakLocalConversationVoiceText(result);
					return;
				}
				realtimeTranscriptRef.current = transcriptText;
				void handleSubmit({ files: [], text: transcriptText });
			});
			return;
		}

		realtimeTranscriptRef.current = transcriptText;
	}, [clickyAddExchange, clickyStartProcessing, handleSubmit, isClickyActive, localConversation, setPrompt, speakLocalConversationVoiceText]);

	const handleRealtimeAssistantTextDelta = useCallback((payload: RealtimeAssistantTextPayload) => {
		if (isDictationActiveRef.current) {
			return;
		}

		if (localConversation) {
			return;
		}

		// Stream direct realtime text into the cursor overlay as it arrives.
		const text = typeof payload === "string" ? payload : (payload.text ?? "");
		if (!text) {
			return;
		}

		streamClickyAssistantText(text);
	}, [localConversation, streamClickyAssistantText]);

	const handleRealtimeAssistantTextCompleted = useCallback((payload: { messageId?: string; text?: string } | string) => {
		if (isDictationActiveRef.current) {
			return;
		}

		if (localConversation) {
			return;
		}

		// Realtime may answer directly without delegating to Rovo. Keep the
		// audible/Clicky response, but also mirror that direct voice turn into
		// compact chat history when we have the user's transcript.
		const text = typeof payload === "string" ? payload : (payload.text ?? "");
		const promptText = realtimeTranscriptRef.current.trim();
		if (!text) {
			return;
		}

		const didStreamToClicky = streamClickyAssistantText(text);
		if (promptText) {
			realtimeTranscriptRef.current = "";
			void recordLocalAssistantTurn({
				assistantParts: [{ type: "text", text, state: "done" }],
				promptText,
			});
		}

		if (didStreamToClicky) {
			clickyAddExchange({ role: "assistant", content: text });
		}
	}, [clickyAddExchange, recordLocalAssistantTurn, localConversation, streamClickyAssistantText]);
	const handleRealtimeDelegateToRovo = useCallback(
		(request: DelegationRequest) => {
			if (isDictationActiveRef.current) {
				return;
			}

			// Clicky's spoken queries must never delegate into the chat thread.
			if (isClickyActive) {
				return;
			}

			const promptText = request.prompt.trim();
			if (!promptText) {
				return;
			}

			realtimeTranscriptRef.current = "";
			setPrompt("");
			const sendRealtimePrompt = () => {
				const contextDescription = mergeRovoContextDescriptions(
					resolvedSendPromptOptions?.contextDescription,
					request.conversationSummary ? `[Voice context] ${request.conversationSummary}` : undefined,
				);
				const promptOptions = contextDescription
					? {
							...resolvedSendPromptOptions,
							contextDescription,
						}
					: resolvedSendPromptOptions;
				void sendPrompt(promptText, promptOptions);
			};

			if (!localConversation) {
				sendRealtimePrompt();
				return;
			}

			void Promise.resolve(localConversation.onSubmit(promptText)).then((result) => {
				if (!isLocalConversationSubmitHandled(result)) {
					sendRealtimePrompt();
					return;
				}
				speakLocalConversationVoiceText(result);
			});
		},
		[isClickyActive, resolvedSendPromptOptions, localConversation, sendPrompt, setPrompt, speakLocalConversationVoiceText],
	);
	const realtime = useRealtimeVoice({
		sessionPolicyMode: "auto",
		chatMessages: uiMessages,
		isGenerating: isStreaming,
		onDelegateToRovo: handleRealtimeDelegateToRovo,
		onSpeechStarted: handleRealtimeSpeechStarted,
		onSpeechTranscriptCompleted: handleRealtimeTranscriptCompleted,
		onSpeechTranscriptDelta: handleRealtimeTranscript,
		onAssistantTextDelta: handleRealtimeAssistantTextDelta,
		onAssistantTextCompleted: handleRealtimeAssistantTextCompleted,
		onEndVoiceSession: useCallback(() => {
			realtimeTranscriptRef.current = "";
			deactivateClicky();
		}, [deactivateClicky]),
		onToolCall: useCallback(
			({ name, args, callId }: { name: string; args: Record<string, unknown>; callId: string }) => {
				const respond = (output: unknown, createResponse?: boolean) =>
					sendFunctionCallOutputRef.current?.({
						callId,
						output,
						...(createResponse === false ? { createResponse: false } : {}),
					});

				handleScreenAssistantToolCall({ args, callId, name }, respond);
			},
			[handleScreenAssistantToolCall],
		),
	});

	useEffect(() => {
		sendRealtimeTextInputRef.current = realtime.sendTextInput;
		realtimeVoiceStateRef.current = realtime.voiceState;
		sendFunctionCallOutputRef.current = realtime.sendFunctionCallOutput;
	}, [realtime.sendFunctionCallOutput, realtime.sendTextInput, realtime.voiceState]);

	// --- AI cursor voice bridge: connects realtime + injects tool-based prompt ---
	useDefaultClickyVoice({
		isClickyActive,
		isRealtimeConnected: realtime.isConnected,
		connectRealtime: realtime.connect,
		injectContext: realtime.injectContext,
	});
	const isRealtimeVoiceActive = realtime.voiceState !== "idle";
	const dictationState = resolveComposerDictationState({
		active: isDictationActive,
		voiceState: realtime.voiceState,
	});
	const handleStopDictation = useCallback(() => {
		dictationBaselineRef.current = null;
		dictationCommittedTextRef.current = null;
		isDictationActiveRef.current = false;
		dispatchDictation({ type: "stop" });
		realtime.disconnect();
	}, [realtime]);
	const handleStartDictation = useCallback(() => {
		if (realtime.voiceState !== "idle") {
			realtimeTranscriptRef.current = "";
			realtime.disconnect();
		}

		const baselineText = promptRef.current;
		dictationBaselineRef.current = baselineText;
		dictationCommittedTextRef.current = baselineText;
		isDictationActiveRef.current = true;
		dispatchDictation({ type: "start" });
		requestComposerFocus();
		realtime.connect({ transcriptionOnly: true });
	}, [realtime]);

	const startRealtimeVoice = useCallback(() => {
		if (isDictationActiveRef.current) {
			dictationBaselineRef.current = null;
			dictationCommittedTextRef.current = null;
			isDictationActiveRef.current = false;
			dispatchDictation({ type: "stop" });
		}

		realtimeTranscriptRef.current = "";
		realtime.connect(isLocalConversationActive ? { explicitResponseOnly: true } : undefined);
	}, [isLocalConversationActive, realtime]);
	const lastStartRealtimeVoiceRequestKeyRef = useRef(0);
	const cleanupDeferredStartRealtimeVoiceRef = useRef<(() => void) | null>(null);
	const clearDeferredStartRealtimeVoice = useCallback(() => {
		cleanupDeferredStartRealtimeVoiceRef.current?.();
		cleanupDeferredStartRealtimeVoiceRef.current = null;
	}, []);
	const shouldDeferRealtimeVoiceStartForUserActivation = useCallback(() => {
		if (typeof navigator === "undefined" || !navigator.userActivation) {
			return false;
		}

		return !navigator.userActivation.hasBeenActive;
	}, []);
	const startRealtimeVoiceAfterUserActivation = useCallback(() => {
		if (typeof window === "undefined") {
			return;
		}

		clearDeferredStartRealtimeVoice();
		const handleUserActivation = (event: Event) => {
			if (!event.isTrusted) {
				return;
			}

			clearDeferredStartRealtimeVoice();
			startRealtimeVoice();
		};
		cleanupDeferredStartRealtimeVoiceRef.current = subscribeToUserActivation(handleUserActivation);
	}, [clearDeferredStartRealtimeVoice, startRealtimeVoice]);
	useEffect(() => {
		if (startRealtimeVoiceRequestKey <= 0) {
			lastStartRealtimeVoiceRequestKeyRef.current = 0;
			clearDeferredStartRealtimeVoice();
			return;
		}

		if (lastStartRealtimeVoiceRequestKeyRef.current === startRealtimeVoiceRequestKey) {
			return;
		}

		lastStartRealtimeVoiceRequestKeyRef.current = startRealtimeVoiceRequestKey;
		if (realtime.voiceState !== "idle") {
			return;
		}

		if (shouldDeferRealtimeVoiceStartForUserActivation()) {
			startRealtimeVoiceAfterUserActivation();
			return;
		}

		startRealtimeVoice();
	}, [
		clearDeferredStartRealtimeVoice,
		realtime.voiceState,
		shouldDeferRealtimeVoiceStartForUserActivation,
		startRealtimeVoice,
		startRealtimeVoiceAfterUserActivation,
		startRealtimeVoiceRequestKey,
	]);
	useEffect(() => {
		return () => clearDeferredStartRealtimeVoice();
	}, [clearDeferredStartRealtimeVoice]);

	const handleToggleRealtimeVoice = useCallback(() => {
		clearDeferredStartRealtimeVoice();
		if (realtime.voiceState === "idle") {
			startRealtimeVoice();
			return;
		}

		realtimeTranscriptRef.current = "";
		realtime.disconnect();
		deactivateClicky();
	}, [clearDeferredStartRealtimeVoice, deactivateClicky, realtime, startRealtimeVoice]);

	const handleToggleClicky = useCallback(() => {
		if (isClickyActive) {
			deactivateClicky();
			return;
		}

		activateClicky();
		if (realtime.voiceState === "idle") {
			startRealtimeVoice();
		}
	}, [activateClicky, deactivateClicky, isClickyActive, realtime.voiceState, startRealtimeVoice]);

	// Cmd+Shift+K (Mac) / Ctrl+Shift+K toggles the AI cursor; Escape deactivates it.
	useEffect(() => {
		if (hideAiCursor) {
			return;
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "K" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleToggleClicky();
				return;
			}

			if (e.key === "Escape" && isClickyActive) {
				deactivateClicky();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [deactivateClicky, handleToggleClicky, hideAiCursor, isClickyActive]);

	return {
		dictationState,
		dictationTranscriptPreview,
		handleStartDictation,
		handleStopDictation,
		handleToggleClicky,
		handleToggleRealtimeVoice,
		isRealtimeVoiceActive,
		realtime,
	};
}
