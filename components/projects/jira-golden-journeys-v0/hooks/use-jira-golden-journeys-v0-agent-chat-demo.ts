"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRovoChatControls } from "@/app/contexts";
import {
	buildAsxAgentChatContextBar,
	buildAsxAgentChatPlayback,
	type AsxAgentChatScenario,
} from "@/components/projects/jira-golden-journeys-v0/data/agent-chat-data";
import { getMessageText } from "@/lib/rovo-ui-messages";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";

export interface UseAsxAgentChatDemoResult {
	chatContextBar: ChatContextBarDescriptor | null;
	externalThinkingMessageId: string | null;
	openAgentChat: (scenario: AsxAgentChatScenario) => void;
}

export function useAsxAgentChatDemo(): UseAsxAgentChatDemoResult {
	const { openChat, applyLocalTurn, selectAgent } = useRovoChatControls();
	const [chatContextBar, setChatContextBar] = useState<ChatContextBarDescriptor | null>(null);
	const [externalThinkingMessageId, setExternalThinkingMessageId] = useState<string | null>(null);
	const playbackAbortRef = useRef<AbortController | null>(null);
	const runCounterRef = useRef(0);

	const cancelPlayback = useCallback(() => {
		playbackAbortRef.current?.abort();
	}, []);

	useEffect(() => cancelPlayback, [cancelPlayback]);

	const openAgentChat = useCallback((scenario: AsxAgentChatScenario) => {
		cancelPlayback();
		const controller = new AbortController();
		playbackAbortRef.current = controller;
		const runId = `${scenario.issueKey.toLowerCase()}-${runCounterRef.current += 1}`;
		const playback = buildAsxAgentChatPlayback(scenario, runId);

		selectAgent(scenario.agentId, { preserveCurrentThread: true });
		setChatContextBar(buildAsxAgentChatContextBar(scenario));
		openChat("floating");
		setExternalThinkingMessageId(playback.assistantMessageId);

		void applyLocalTurn({
			history: "replace",
			promptText: getMessageText(playback.userMessage),
			userMessage: playback.userMessage,
			assistantMessageId: playback.assistantMessageId,
			assistantParts: playback.frames[0]?.parts ?? [],
			assistantPartStages: playback.frames.map((frame) => ({
				delayMs: frame.delayMs,
				getAssistantParts: () => frame.parts,
			})),
			signal: controller.signal,
			onThinkingMessageChange: (id) => {
				if (controller.signal.aborted) return;
				if (id || !playback.keepThinkingActiveAfterLastFrame) setExternalThinkingMessageId(id);
			},
		});

	}, [cancelPlayback, openChat, applyLocalTurn, selectAgent]);

	return { chatContextBar, externalThinkingMessageId, openAgentChat };
}
