"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { useRovoChat } from "@/app/contexts/context-rovo-chat";
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
	const { activeThreadId, activateSession, selectThread } = useRovoChat();
	const sessionThreads = useRef(new Map<string, string>());
	const pendingSession = useRef<string | null>(null);
	const [chatContextBar, setChatContextBar] = useState<ChatContextBarDescriptor | null>(null);
	const [externalThinkingMessageId, setExternalThinkingMessageId] = useState<string | null>(null);
	const playbackAbortRef = useRef<AbortController | null>(null);
	const runCounterRef = useRef(0);

	const cancelPlayback = useCallback(() => {
		playbackAbortRef.current?.abort();
	}, []);

	useEffect(() => cancelPlayback, [cancelPlayback]);
	useEffect(() => {
		if (pendingSession.current && activeThreadId) {
			sessionThreads.current.set(pendingSession.current, activeThreadId);
			pendingSession.current = null;
		}
	}, [activeThreadId]);

	const openAgentChat = useCallback((scenario: JgpAgentChatScenario) => {
		cancelPlayback();
		pendingSession.current = null;
		const controller = new AbortController();
		playbackAbortRef.current = controller;
		const runId = `${scenario.issueKey.toLowerCase()}-${runCounterRef.current += 1}`;
		const playback = buildJgpAgentChatPlayback(scenario, runId);

		setChatContextBar(buildJgpAgentChatContextBar(scenario));
		openChat("floating");
		void (async () => {
			const threadId = scenario.sessionId ? sessionThreads.current.get(scenario.sessionId) : undefined;
			if (threadId) {
				setExternalThinkingMessageId(null);
				await selectThread(threadId);
				return;
			}
			if (scenario.sessionId) {
				const activated = await activateSession({ agentId: scenario.agentId, threadId: null, messages: [] });
				if (!activated || controller.signal.aborted) return;
				pendingSession.current = scenario.sessionId;
			} else {
				selectAgent(scenario.agentId, { preserveCurrentThread: true });
			}
			setExternalThinkingMessageId(scenario.question ? null : playback.assistantMessageId);
			const started = await applyLocalTurn({
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
			if (!started && pendingSession.current === scenario.sessionId) pendingSession.current = null;
		})();

	}, [activateSession, cancelPlayback, openChat, applyLocalTurn, selectAgent, selectThread]);

	return { chatContextBar, externalThinkingMessageId, openAgentChat };
}
