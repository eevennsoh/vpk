"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import {
	buildJgpAgentChatContextBar,
	buildJgpAgentChatPlayback,
	type JgpAgentChatScenario,
} from "@/components/projects/jira-golden-journeys-v1/data/agent-chat-data";
import { getMessageText } from "@/lib/rovo-ui-messages";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";

export interface UseJgpAgentChatDemoResult {
	chatContextBar: ChatContextBarDescriptor | null;
	externalThinkingMessageId: string | null;
	openAgentChat: (scenario: JgpAgentChatScenario) => void;
}

export function useJgpAgentChatDemo(): UseJgpAgentChatDemoResult {
	const { openChat, applyLocalTurn, selectAgent } = useRovoChatControls();
	const [chatContextBar, setChatContextBar] = useState<ChatContextBarDescriptor | null>(null);
	const [externalThinkingMessageId, setExternalThinkingMessageId] = useState<string | null>(null);
	const playbackAbortRef = useRef<AbortController | null>(null);
	const runCounterRef = useRef(0);

	const cancelPlayback = useCallback(() => {
		playbackAbortRef.current?.abort();
	}, []);

	useEffect(() => cancelPlayback, [cancelPlayback]);

	const openAgentChat = useCallback((scenario: JgpAgentChatScenario) => {
		cancelPlayback();
		const controller = new AbortController();
		playbackAbortRef.current = controller;
		const runId = `${scenario.issueKey.toLowerCase()}-${runCounterRef.current += 1}`;
		const playback = buildJgpAgentChatPlayback(scenario, runId);

		selectAgent(scenario.agentId, { preserveCurrentThread: true });
		setChatContextBar(buildJgpAgentChatContextBar(scenario));
		openChat("floating");
		setExternalThinkingMessageId(scenario.question ? null : playback.assistantMessageId);

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
				if (id || !Boolean(scenario.question)) setExternalThinkingMessageId(id);
			},
		});

	}, [cancelPlayback, openChat, applyLocalTurn, selectAgent]);

	return { chatContextBar, externalThinkingMessageId, openAgentChat };
}
