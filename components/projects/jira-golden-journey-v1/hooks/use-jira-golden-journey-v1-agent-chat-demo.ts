"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import { useRovoChat } from "@/app/contexts/context-rovo-chat";
import {
	buildJgpAgentChatContextBar,
	buildJgpAgentChatPlayback,
	buildJgpAgentSessionMessages,
	type JgpAgentChatScenario,
} from "@/components/projects/jira-golden-journey-v1/data/agent-chat-data";
import { getMessageText } from "@/lib/rovo-ui-messages";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";

export interface UseJgpAgentChatDemoResult {
	activeSessionId: string | null;
	chatContextBar: ChatContextBarDescriptor | null;
	externalThinkingMessageId: string | null;
	isSwitchingSession: boolean;
	openAgentChat: (scenario: JgpAgentChatScenario) => Promise<boolean>;
	setSessionThinking: (sessionId: string, messageId: string) => void;
}

export function useJgpAgentChatDemo(): UseJgpAgentChatDemoResult {
	const { openChat, applyLocalTurn, selectAgent } = useRovoChatControls();
	const { activeThreadId, activateSession, selectThread } = useRovoChat();
	const sessionThreads = useRef(new Map<string, string>());
	const sessionThinkingMessages = useRef(new Map<string, string>());
	const pendingSession = useRef<{ sessionId: string; previousThreadId: string | null } | null>(null);
	const [chatContextBar, setChatContextBar] = useState<ChatContextBarDescriptor | null>(null);
	const [externalThinkingMessageId, setExternalThinkingMessageId] = useState<string | null>(null);
	const [isSwitchingSession, setIsSwitchingSession] = useState(false);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const playbackAbortRef = useRef<AbortController | null>(null);
	const runCounterRef = useRef(0);

	const cancelPlayback = useCallback(() => {
		playbackAbortRef.current?.abort();
	}, []);
	const setSessionThinking = useCallback((sessionId: string, messageId: string) => {
		sessionThinkingMessages.current.set(sessionId, messageId);
		if (activeSessionId === sessionId) setExternalThinkingMessageId(messageId);
	}, [activeSessionId]);

	useEffect(() => cancelPlayback, [cancelPlayback]);
	useEffect(() => {
		if (pendingSession.current && activeThreadId && activeThreadId !== pendingSession.current.previousThreadId) {
			sessionThreads.current.set(pendingSession.current.sessionId, activeThreadId);
			pendingSession.current = null;
		}
	}, [activeThreadId]);

	const openAgentChat = useCallback((scenario: JgpAgentChatScenario) => {
		cancelPlayback();
		pendingSession.current = null;
		const controller = new AbortController();
		playbackAbortRef.current = controller;
		const runId = `${scenario.issueKey.toLowerCase()}-${runCounterRef.current += 1}`;
		setChatContextBar(buildJgpAgentChatContextBar(scenario));
		const sessionId = scenario.sessionId;
		if (sessionId) {
			setIsSwitchingSession(true);
			return (async () => {
				try {
					const threadId = sessionThreads.current.get(sessionId);
					if (threadId) {
						await selectThread(threadId);
					} else {
						const activated = await activateSession({ agentId: scenario.agentId, threadId: null, messages: scenario.recordedSession?.messages ?? buildJgpAgentSessionMessages(scenario, sessionId) });
						if (!activated || controller.signal.aborted) return false;
						pendingSession.current = { sessionId, previousThreadId: activeThreadId };
					}
					if (controller.signal.aborted) return false;
					const thinkingMessageId = scenario.recordedSession?.thinkingMessageId ?? sessionThinkingMessages.current.get(sessionId) ?? null;
					setExternalThinkingMessageId(thinkingMessageId);
					setActiveSessionId(sessionId);
					openChat("floating");
					return true;
				} catch (error) {
					if (!controller.signal.aborted) console.error("[JGP] Failed to open agent session:", error);
					return false;
				} finally {
					if (!controller.signal.aborted) setIsSwitchingSession(false);
				}
			})();
		}
		setIsSwitchingSession(false);
		setActiveSessionId(null);
		openChat("floating");
		void (async () => {
			selectAgent(scenario.agentId, { preserveCurrentThread: true });
			const playback = buildJgpAgentChatPlayback(scenario, runId);
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
			if (!started && !controller.signal.aborted) setExternalThinkingMessageId(null);
		})();
		return Promise.resolve(true);

	}, [activeThreadId, activateSession, cancelPlayback, openChat, applyLocalTurn, selectAgent, selectThread]);

	return { activeSessionId, chatContextBar, externalThinkingMessageId, isSwitchingSession, openAgentChat, setSessionThinking };
}
