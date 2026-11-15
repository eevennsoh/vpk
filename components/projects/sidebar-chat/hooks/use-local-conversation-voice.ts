// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs and parent-controlled state; dependencies are constrained to avoid restarting those bridges.

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { UseRealtimeVoiceResult } from "@/components/projects/rovo-core/hooks/use-realtime-voice";
import { getLocalConversationVoiceSuppressionMs, getLocalConversationVoiceText } from "../lib/chat-panel-local-conversation";
import type { ChatPanelLocalConversation, ChatPanelLocalConversationSubmitResult } from "../lib/chat-panel-types";

export interface LocalConversationVoice {
	localConversationVoiceSuppressedUntilRef: RefObject<number>;
	realtimeVoiceStateRef: RefObject<UseRealtimeVoiceResult["voiceState"]>;
	sendRealtimeTextInputRef: RefObject<UseRealtimeVoiceResult["sendTextInput"] | null>;
	speakLocalConversationVoiceText: (result: ChatPanelLocalConversationSubmitResult) => void;
}

/**
 * Speaks host-scripted local-conversation replies through the realtime voice
 * session, and suppresses transcript capture while that reply is audible so the
 * assistant does not hear itself as user input.
 */
export function useLocalConversationVoice(localConversation: ChatPanelLocalConversation | null): LocalConversationVoice {
	const sendRealtimeTextInputRef = useRef<UseRealtimeVoiceResult["sendTextInput"] | null>(null);
	const realtimeVoiceStateRef = useRef<UseRealtimeVoiceResult["voiceState"]>("idle");
	const lastLocalInitialVoiceKeyRef = useRef<string | null>(null);
	const localConversationVoiceSuppressedUntilRef = useRef(0);
	const speakLocalConversationVoiceText = useCallback((result: ChatPanelLocalConversationSubmitResult) => {
		const voiceText = getLocalConversationVoiceText(result);
		if (!voiceText) {
			return;
		}

		localConversationVoiceSuppressedUntilRef.current = Math.max(
			localConversationVoiceSuppressedUntilRef.current,
			Date.now() + getLocalConversationVoiceSuppressionMs(voiceText),
		);
		void sendRealtimeTextInputRef.current?.({
			text: localConversation?.buildVoiceInput?.(voiceText) ?? voiceText,
		});
	}, [localConversation]);
	useEffect(() => {
		if (!localConversation) {
			lastLocalInitialVoiceKeyRef.current = null;
			localConversationVoiceSuppressedUntilRef.current = 0;
			return;
		}

		const initialVoiceText = localConversation.initialVoiceText?.trim() ?? "";
		if (!initialVoiceText) {
			return;
		}

		const initialVoiceKey = localConversation.initialVoiceKey?.trim() || initialVoiceText;
		if (lastLocalInitialVoiceKeyRef.current === initialVoiceKey) {
			return;
		}

		lastLocalInitialVoiceKeyRef.current = initialVoiceKey;
		speakLocalConversationVoiceText({ voiceText: initialVoiceText });
	}, [localConversation, speakLocalConversationVoiceText]);

	return {
		localConversationVoiceSuppressedUntilRef,
		realtimeVoiceStateRef,
		sendRealtimeTextInputRef,
		speakLocalConversationVoiceText,
	};
}
